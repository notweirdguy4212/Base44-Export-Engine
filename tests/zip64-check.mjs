import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { buildZip64Blob, verifyZip64Blob } from '../lib/zip64.js';

const archive = await buildZip64Blob([
  { path: 'src/App.tsx', blob: new Blob(["export default 'ok';\n"]) },
  { path: 'assets/logo.svg', blob: new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>']) },
  { path: 'docs/README.md', blob: new Blob(['ZIP64 smoke test']) },
  { path: 'src/你好.ts', blob: new Blob([new Uint8Array([0, 1, 2, 253, 254, 255])]) }
]);
assert.ok(archive.size > 150);
const verified = await verifyZip64Blob(archive);
assert.equal(verified.ok, true);
assert.equal(verified.entries, 4);
const corrupted = new Uint8Array(await archive.arrayBuffer());
corrupted[corrupted.length - 98] = 0;
assert.equal((await verifyZip64Blob(new Blob([corrupted]))).ok, false);
const bytes = new Uint8Array(await archive.slice(-98).arrayBuffer());
const signature = new DataView(bytes.buffer).getUint32(0, true);
assert.equal(signature, 0x06064b50, 'ZIP64 EOCD record must be present before the locator and classic EOCD');
await writeFile('/tmp/base44-toolkit-zip64-test.zip', new Uint8Array(await archive.arrayBuffer()));
console.log(`ZIP64 writer test passed (${archive.size} bytes).`);
