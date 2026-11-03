const UTF8 = new TextEncoder();

export function safeArchivePath(value) {
  const raw = String(value ?? '').replace(/\\/g, '/');
  if (!raw || raw.startsWith('/') || /^[a-zA-Z]:/.test(raw) || raw.includes('\0')) return '';
  const parts = raw.split('/');
  if (parts.some(part => part === '..')) return '';
  return parts.filter(part => part && part !== '.').join('/');
}

function u16(n) { return Uint8Array.of(n & 255, (n >>> 8) & 255); }
function u32(n) { return Uint8Array.of(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255); }
function u64(n) {
  let value = BigInt(n);
  const out = new Uint8Array(8);
  for (let i = 0; i < 8; i++) { out[i] = Number(value & 255n); value >>= 8n; }
  return out;
}
function join(...parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}
function dosDateTime(date = new Date()) {
  const time = ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | ((Math.floor(date.getSeconds() / 2)) & 31);
  const year = Math.max(1980, date.getFullYear());
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

export async function crc32Blob(blob, onChunk) {
  let crc = 0xffffffff;
  const reader = blob.stream().getReader();
  let read = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    for (let i = 0; i < value.length; i++) {
      crc ^= value[i];
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    read += value.length;
    if (onChunk) onChunk(read, blob.size);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Creates a ZIP64 archive using store-only entries. File payloads remain Blob parts;
 * only small headers and the central directory are materialised as typed arrays.
 * This avoids a single 4 GiB Uint8Array and supports ZIP64 64-bit sizes/offsets.
 */
export async function buildZip64Blob(inputEntries, onProgress = () => {}) {
  const seen = new Set();
  const entries = inputEntries.map(entry => ({
    path: safeArchivePath(entry.path),
    blob: entry.blob instanceof Blob ? entry.blob : new Blob([entry.blob ?? '']),
    crc32: entry.crc32
  })).filter(entry => {
    if (!entry.path || seen.has(entry.path)) return false;
    seen.add(entry.path);
    return true;
  }).sort((a, b) => a.path.localeCompare(b.path));
  if (!entries.length) throw new Error('No valid files are available to archive.');

  const parts = [];
  const central = [];
  let offset = 0n;
  let completed = 0;
  const { time, day } = dosDateTime();

  for (const entry of entries) {
    const name = UTF8.encode(entry.path);
    if (name.length > 65535) throw new Error(`ZIP path is too long: ${entry.path}`);
    const size = BigInt(entry.blob.size);
    const crc = Number.isInteger(entry.crc32) ? entry.crc32 >>> 0 : await crc32Blob(entry.blob);
    const localExtra = join(u16(0x0001), u16(16), u64(size), u64(size));
    const local = join(
      u32(0x04034b50), u16(45), u16(0x0800), u16(0), u16(time), u16(day),
      u32(crc), u32(0xffffffff), u32(0xffffffff), u16(name.length), u16(localExtra.length), name, localExtra
    );
    parts.push(local, entry.blob);

    const centralExtra = join(u16(0x0001), u16(24), u64(size), u64(size), u64(offset));
    const centralHeader = join(
      u32(0x02014b50), u16(45), u16(45), u16(0x0800), u16(0), u16(time), u16(day),
      u32(crc), u32(0xffffffff), u32(0xffffffff), u16(name.length), u16(centralExtra.length),
      u16(0), u16(0), u16(0), u32(0), u32(0xffffffff), name, centralExtra
    );
    central.push(centralHeader);
    offset += BigInt(local.length) + size;
    completed++;
    onProgress({ completed, total: entries.length, path: entry.path, bytes: Number(size > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : size) });
  }

  const centralOffset = offset;
  const centralSize = BigInt(central.reduce((sum, part) => sum + part.length, 0));
  const count = BigInt(entries.length);
  const zip64End = join(
    u32(0x06064b50), u64(44), u16(45), u16(45), u32(0), u32(0),
    u64(count), u64(count), u64(centralSize), u64(centralOffset)
  );
  const locator = join(u32(0x07064b50), u32(0), u64(centralOffset + centralSize), u32(1));
  const end = join(
    u32(0x06054b50), u16(0), u16(0), u16(0xffff), u16(0xffff),
    u32(0xffffffff), u32(0xffffffff), u16(0)
  );
  return new Blob([...parts, ...central, zip64End, locator, end], { type: 'application/zip' });
}


export async function verifyZip64Blob(blob) {
  if (!(blob instanceof Blob) || blob.size < 98) return { ok: false, error: 'Archive is too small for ZIP64 end records.' };
  const tail = new Uint8Array(await blob.slice(blob.size - 98).arrayBuffer());
  const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  if (view.getUint32(0, true) !== 0x06064b50) return { ok: false, error: 'ZIP64 end-of-central-directory signature is missing.' };
  if (view.getUint32(56, true) !== 0x07064b50) return { ok: false, error: 'ZIP64 locator signature is missing.' };
  if (view.getUint32(76, true) !== 0x06054b50) return { ok: false, error: 'Classic EOCD sentinel is missing.' };
  const read64 = offset => {
    const low = BigInt(view.getUint32(offset, true));
    const high = BigInt(view.getUint32(offset + 4, true));
    return (high << 32n) | low;
  };
  const count = read64(32);
  const centralSize = read64(40);
  const centralOffset = read64(48);
  const eocdOffset = BigInt(blob.size - 98);
  if (centralOffset + centralSize !== eocdOffset) return { ok: false, error: 'Central directory bounds do not meet the ZIP64 end record.' };
  const centralSignature = new DataView(await blob.slice(Number(centralOffset), Number(centralOffset) + 4).arrayBuffer());
  if (centralSignature.byteLength !== 4 || centralSignature.getUint32(0, true) !== 0x02014b50) return { ok: false, error: 'Central directory header signature is missing.' };
  return { ok: true, entries: Number(count), archiveBytes: blob.size, centralDirectoryBytes: Number(centralSize) };
}
