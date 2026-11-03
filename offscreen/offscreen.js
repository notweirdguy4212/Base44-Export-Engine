import { getEntries } from '../lib/database.js';
import { buildZip64Blob, verifyZip64Blob } from '../lib/zip64.js';

const archiveUrls = new Map();
const activeBuilds = new Set();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== 'offscreen') return false;
  if (message.type === 'BUILD_ZIP64') {
    if (activeBuilds.has(message.jobId)) { sendResponse({ ok: true, alreadyBuilding: true }); return false; }
    activeBuilds.add(message.jobId);
    buildArchive(message.jobId, message.filename).catch(async error => {
      await chrome.runtime.sendMessage({ target: 'background', type: 'ZIP_FAILED', jobId: message.jobId, error: error?.message || String(error) }).catch(() => {});
    }).finally(() => activeBuilds.delete(message.jobId));
    sendResponse({ ok: true, accepted: true });
    return false;
  }
  if (message.type === 'REVOKE_URL') {
    const url = archiveUrls.get(message.jobId);
    if (url) { URL.revokeObjectURL(url); archiveUrls.delete(message.jobId); }
    sendResponse({ ok: true });
    return false;
  }
  return false;
});

async function buildArchive(jobId, filename) {
  const stored = await getEntries(jobId);
  if (!stored.length) throw new Error('No staged files were found for this export job. Retry the job to collect the project again.');
  const entries = stored.map(record => ({ path: record.path, blob: record.blob, crc32: record.crc32 }));
  const preliminary = await buildZip64Blob(entries, progress => {
    chrome.runtime.sendMessage({ target: 'background', type: 'ZIP_PROGRESS', jobId, progress }).catch(() => {});
  });
  const preliminaryCheck = await verifyZip64Blob(preliminary);
  if (!preliminaryCheck.ok) throw new Error(`ZIP64 preflight verification failed: ${preliminaryCheck.error}`);
  const verification = new Blob([JSON.stringify({ format: 'base44-toolkit-zip64-verification', status: 'passed', preliminaryArchiveBytes: preliminaryCheck.archiveBytes, entries: preliminaryCheck.entries, checks: ['ZIP64 EOCD signature', 'ZIP64 locator signature', 'classic EOCD sentinel', 'central directory bounds', 'central directory header'], note: 'The final archive is rebuilt with this report and independently checked again before download.' }, null, 2)], { type: 'application/json' });
  const finalEntries = [...entries.filter(entry => entry.path !== 'EXPORT-VERIFICATION-REPORT.json'), { path: 'EXPORT-VERIFICATION-REPORT.json', blob: verification }];
  const archive = await buildZip64Blob(finalEntries);
  const finalCheck = await verifyZip64Blob(archive);
  if (!finalCheck.ok) throw new Error(`Final ZIP64 verification failed: ${finalCheck.error}`);
  const url = URL.createObjectURL(archive);
  archiveUrls.set(jobId, url);
  const result = await chrome.runtime.sendMessage({ target: 'background', type: 'ZIP_READY', jobId, filename, url });
  if (!result?.ok) throw new Error(result?.error || 'Chrome could not start the archive download.');
}
