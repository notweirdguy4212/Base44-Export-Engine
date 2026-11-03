import { getJob, putJob, listJobs, putEntry, deleteEntries, getSnapshot, putPendingSnapshot, getPendingSnapshot, putSnapshot, deletePendingSnapshot } from './lib/database.js';
import { crc32Blob, safeArchivePath } from './lib/zip64.js';
import { analyzeProjectFiles } from './lib/analyzer.js';

const WATCHDOG = 'base44-job-watchdog';
const TERMINAL = new Set(['completed', 'cancelled']);
let processing = false;

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  resumeOutstandingJobs();
});
chrome.runtime.onStartup.addListener(() => resumeOutstandingJobs());
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === WATCHDOG) resumeOutstandingJobs();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target === 'background' && message.type === 'START_BATCH') {
    enqueueProjects(message.projectIds, message.tabId).then(jobs => sendResponse({ ok: true, jobs })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.target === 'background' && message.type === 'LIST_JOBS') {
    listJobs().then(jobs => sendResponse({ ok: true, jobs })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.target === 'background' && ['PAUSE_JOB', 'RESUME_JOB', 'CANCEL_JOB', 'RETRY_JOB'].includes(message.type)) {
    controlJob(message.type, message.jobId).then(job => sendResponse({ ok: true, job })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.target === 'background' && message.type === 'ZIP_PROGRESS') {
    updateZipProgress(message.jobId, message.progress).then(() => sendResponse({ ok: true })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.target === 'background' && message.type === 'ZIP_FAILED') {
    failPackaging(message.jobId, message.error).then(() => sendResponse({ ok: true })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.target === 'background' && message.type === 'ZIP_READY') {
    handleZipReady(message).then(() => sendResponse({ ok: true })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  return false;
});

chrome.downloads.onChanged.addListener(async delta => {
  if (!delta.id || !delta.state) return;
  const jobs = await listJobs().catch(() => []);
  const job = jobs.find(item => item.downloadId === delta.id);
  if (!job) return;
  if (job.status === 'cancelled') { chrome.runtime.sendMessage({ target: 'offscreen', type: 'REVOKE_URL', jobId: job.id }).catch(() => {}); return; }
  if (delta.state.current === 'complete') {
    job.status = 'completed'; job.stage = 'complete'; job.progress = 100; job.message = 'Archive downloaded and completed.'; job.completedAt = Date.now(); job.leaseUntil = 0;
    await putJob(job); await broadcast(job);
    await commitPendingSnapshot(job.id);
    await deleteEntries(job.id).catch(() => {});
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'REVOKE_URL', jobId: job.id }).catch(() => {});
    await updateWatchdog();
    resumeOutstandingJobs();
  } else if (delta.state.current === 'interrupted') {
    job.status = 'failed'; job.stage = 'download'; job.message = `Download interrupted: ${delta.error?.current || 'unknown error'}`; job.leaseUntil = 0;
    await deletePendingSnapshot(job.id).catch(() => {});
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'REVOKE_URL', jobId: job.id }).catch(() => {});
    await putJob(job); await broadcast(job); await updateWatchdog();
  }
});

async function commitPendingSnapshot(jobId) {
  const pending = await getPendingSnapshot(jobId).catch(() => null);
  if (!pending) return;
  await putSnapshot({ projectId: pending.projectId, createdAt: pending.createdAt, files: pending.files });
  await deletePendingSnapshot(jobId);
}

async function findProjectTab(job) {
  const existing = await chrome.tabs.get(job.tabId).catch(() => null);
  if (String(existing?.url || '').startsWith('https://app.base44.com/')) return existing.id;
  const matches = await chrome.tabs.query({ url: 'https://app.base44.com/*' });
  const available = matches.find(tab => tab.id && String(tab.url || '').startsWith('https://app.base44.com/'));
  if (!available?.id) throw new Error('An authenticated Base44 tab is no longer available. Reopen Base44 and retry this export.');
  job.tabId = available.id; await putJob(job);
  return available.id;
}

async function enqueueProjects(projectIds, tabId) {
  if (!Number.isInteger(tabId)) throw new Error('Open the authorised Base44 project tab before starting an export.');
  const unique = [...new Set((projectIds || []).map(value => String(value).trim()).filter(Boolean))];
  if (!unique.length) throw new Error('Enter at least one project ID.');
  const jobs = [];
  for (const projectId of unique) {
    if (!/^[a-zA-Z0-9_-]{8,}$/.test(projectId)) throw new Error(`Invalid project ID: ${projectId}`);
    const id = crypto.randomUUID();
    const job = { id, projectId, tabId, status: 'queued', stage: 'queued', progress: 0, fileCount: 0, bytes: 0, message: 'Waiting in export queue.', createdAt: Date.now(), updatedAt: Date.now(), leaseUntil: 0, downloadId: null };
    await putJob(job); jobs.push(job); await broadcast(job);
  }
  await updateWatchdog();
  resumeOutstandingJobs();
  return jobs;
}

async function controlJob(type, id) {
  const job = await getJob(id);
  if (!job) throw new Error('Export job not found.');
  if (type === 'PAUSE_JOB' && !TERMINAL.has(job.status)) {
    job.status = 'paused'; job.message = 'Paused by user. Resume to continue.'; job.leaseUntil = 0;
  } else if (type === 'RESUME_JOB' && job.status === 'paused') {
    job.status = 'queued'; job.stage = 'queued'; job.progress = 0; job.fileCount = 0; job.bytes = 0; job.message = 'Queued to resume.'; job.leaseUntil = 0;
  } else if (type === 'CANCEL_JOB' && !TERMINAL.has(job.status)) {
    const wasDownloading = job.status === 'downloading';
    job.status = 'cancelled'; job.stage = 'cancelled'; job.message = 'Cancelled by user.'; job.leaseUntil = 0;
    await deleteEntries(id); await deletePendingSnapshot(id).catch(() => {});
    if (job.downloadId && wasDownloading) await chrome.downloads.cancel(job.downloadId).catch(() => {});
  } else if (type === 'RETRY_JOB' && job.status === 'failed') {
    await deleteEntries(id); await deletePendingSnapshot(id).catch(() => {});
    job.status = 'queued'; job.stage = 'queued'; job.progress = 0; job.fileCount = 0; job.bytes = 0; job.downloadId = null; job.message = 'Retry queued.'; job.leaseUntil = 0;
  }
  job.updatedAt = Date.now(); await putJob(job); await broadcast(job); await updateWatchdog();
  if (job.status === 'queued') resumeOutstandingJobs();
  return job;
}

async function resumeOutstandingJobs() {
  if (processing) return;
  processing = true;
  try {
    const jobs = await listJobs();
    for (const job of jobs) {
      if (job.status === 'downloading' && job.downloadId) {
        const [download] = await chrome.downloads.search({ id: job.downloadId }).catch(() => []);
        if (download?.state === 'complete') {
          job.status = 'completed'; job.stage = 'complete'; job.progress = 100; job.message = 'Archive downloaded and completed.'; job.completedAt = Date.now();
          await putJob(job); await commitPendingSnapshot(job.id); await deleteEntries(job.id).catch(() => {}); await broadcast(job);
        } else if (download?.state === 'interrupted') {
          job.status = 'failed'; job.message = 'Download was interrupted. Retry to package the staged files again.'; job.leaseUntil = 0;
          await deletePendingSnapshot(job.id).catch(() => {});
          await putJob(job); await broadcast(job);
        }
      }
    }
    const refreshed = await listJobs();
    const next = refreshed.find(job => job.status === 'queued' || (['fetching', 'staging', 'packaging'].includes(job.status) && (!job.leaseUntil || job.leaseUntil < Date.now())));
    if (next) await processJob(next);
  } catch (error) {
    console.error('Base44 Toolkit queue recovery failed', error);
  } finally {
    processing = false;
    await updateWatchdog();
  }
}

async function processJob(job) {
  job.leaseUntil = Date.now() + 90000; job.updatedAt = Date.now();
  await putJob(job); await broadcast(job);
  try {
    if (job.status === 'queued' || job.status === 'fetching' || job.status === 'staging') {
      job.status = 'fetching'; job.stage = 'fetching'; job.message = 'Requesting project files from the active Base44 session.';
      await putJob(job); await broadcast(job);
      const targetTabId = await findProjectTab(job);
      const result = await chrome.scripting.executeScript({
        target: { tabId: targetTabId }, world: 'MAIN', func: fetchProjectFilesInPage, args: [job.projectId]
      });
      const payload = result?.[0]?.result;
      if (!payload?.ok) throw new Error(payload?.error || 'The Base44 project export endpoint did not return files. Use Classic editor recovery if available.');
      const latestAfterFetch = await getJob(job.id);
      if (latestAfterFetch?.status === 'paused' || latestAfterFetch?.status === 'cancelled') return;
      job.status = 'staging'; job.stage = 'staging'; job.fileCount = Object.keys(payload.files || {}).length; job.message = `Staging ${job.fileCount} files in IndexedDB.`;
      await putJob(job); await broadcast(job);
      await deleteEntries(job.id);
      const records = [];
      const seenPaths = new Set();
      let processed = 0, totalBytes = 0;
      for (const [rawPath, rawValue] of Object.entries(payload.files || {})) {
        const path = safeArchivePath(rawPath);
        if (!path || seenPaths.has(path)) continue;
        seenPaths.add(path);
        const blob = valueToBlob(rawValue);
        const crc = await crc32Blob(blob);
        let sha256 = null;
        if (blob.size <= 128 * 1024 * 1024) {
          const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
          sha256 = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
        }
        const record = { jobId: job.id, path, blob, size: blob.size, crc32: crc, sha256 };
        await putEntry(record); records.push({ path, size: blob.size, crc32: crc, sha256 });
        processed++; totalBytes += blob.size;
        if (processed % 10 === 0 || processed === job.fileCount) {
          const current = await getJob(job.id);
          if (current?.status === 'cancelled') { await deleteEntries(job.id); return; }
          if (current?.status === 'paused') return;
          job.progress = Math.min(70, Math.round((processed / Math.max(1, job.fileCount)) * 70));
          job.bytes = totalBytes; job.message = `Staged ${processed}/${job.fileCount} files.`; job.updatedAt = Date.now(); job.leaseUntil = Date.now() + 90000;
          await putJob(job); await broadcast(job);
        }
      }
      const latestAfterStage = await getJob(job.id);
      if (latestAfterStage?.status === 'cancelled') { await deleteEntries(job.id); return; }
      if (latestAfterStage?.status === 'paused') return;
      if (!processed) throw new Error('The project response contained no usable files.');
      const analysis = analyzeProjectFiles(payload.files || {}, job.projectId);
      const previousSnapshot = await getSnapshot(job.projectId);
      const previousFiles = new Map((previousSnapshot?.files || []).map(file => [file.path, file]));
      const currentFiles = new Map(records.map(file => [file.path, file]));
      const added = [...currentFiles.keys()].filter(path => !previousFiles.has(path));
      const removed = [...previousFiles.keys()].filter(path => !currentFiles.has(path));
      const changed = [...currentFiles.keys()].filter(path => previousFiles.has(path) && (currentFiles.get(path).sha256 && previousFiles.get(path).sha256 ? currentFiles.get(path).sha256 !== previousFiles.get(path).sha256 : currentFiles.get(path).size !== previousFiles.get(path).size || currentFiles.get(path).crc32 !== previousFiles.get(path).crc32));
      const unchanged = currentFiles.size - added.length - changed.length;
      const comparisonMarkdown = previousSnapshot
        ? `# Project version comparison\n\n- Baseline: ${new Date(previousSnapshot.createdAt).toISOString()}\n- Current export: ${new Date().toISOString()}\n- Added: ${added.length}\n- Changed: ${changed.length}\n- Removed: ${removed.length}\n- Unchanged: ${unchanged}\n\n## Added\n\n${added.map(path => `- \`${path}\``).join('\n') || 'None'}\n\n## Changed\n\n${changed.map(path => `- \`${path}\``).join('\n') || 'None'}\n\n## Removed\n\n${removed.map(path => `- \`${path}\``).join('\n') || 'None'}\n`
        : '# Project version comparison\n\nNo previous successful export baseline existed. This archive establishes the first baseline for this project.\n';
      await putPendingSnapshot({ jobId: job.id, projectId: job.projectId, createdAt: Date.now(), files: records });
      const manifest = { format: 'base44-toolkit-zip64', version: '4.0.0', projectId: job.projectId, createdAt: new Date().toISOString(), fileCount: processed, totalBytes, integrity: 'CRC-32 for every entry; SHA-256 for files up to 128 MiB', files: records };
      const reports = [
        ...Object.entries(analysis.generatedFiles),
        ['BASE44-EXPORT-MANIFEST.json', JSON.stringify(manifest, null, 2)],
        ['PROJECT-VERSION-COMPARISON.md', comparisonMarkdown],
        ['SHA256SUMS.txt', records.filter(x => x.sha256).map(x => `${x.sha256}  ${x.path}`).join('\n') + '\n'],
        ['EXPORT-README.md', `# Base44 project export\n\nCreated by Base44 Toolkit 4.0.0.\n\n- Project: ${job.projectId}\n- Files: ${processed}\n- Source bytes: ${totalBytes}\n- Archive: ZIP64, store-only, UTF-8 paths\n- CRC-32: calculated for every file\n- SHA-256: calculated for files no larger than 128 MiB\n\nThis archive contains only files returned by the active Base44 session. It does not include databases, secrets, environment variables, or inaccessible assets.\n`],
        ['RESTORE-ADAPTER-STATUS.md', '# Restore adapter status\n\nNo supported Base44 write/import interface was detected or assumed by this release. This archive is a portable recovery source. Restore must be performed through an official Base44 import feature or a separately verified adapter. The extension will not call guessed private write endpoints.\n']
      ];
      for (const [path, content] of reports) {
        let outputPath = path;
        if (seenPaths.has(outputPath)) {
          outputPath = `.base44-toolkit/${path}`;
          let suffix = 2;
          while (seenPaths.has(outputPath)) outputPath = `.base44-toolkit/${suffix++}-${path}`;
        }
        seenPaths.add(outputPath);
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        await putEntry({ jobId: job.id, path: outputPath, blob, size: blob.size, crc32: await crc32Blob(blob), sha256: null });
      }
      const beforePackaging = await getJob(job.id);
      if (beforePackaging?.status === 'cancelled') { await deleteEntries(job.id); await deletePendingSnapshot(job.id); return; }
      if (beforePackaging?.status === 'paused') return;
      job.status = 'packaging'; job.stage = 'packaging'; job.progress = 75; job.fileCount = processed; job.bytes = totalBytes; job.message = 'Building ZIP64 archive from staged Blob parts.'; job.updatedAt = Date.now(); job.leaseUntil = Date.now() + 90000;
      await putJob(job); await broadcast(job);
    }
    if (job.status === 'packaging') {
      await ensureOffscreen();
      const response = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'BUILD_ZIP64', jobId: job.id, filename: `base44-${job.projectId}-backup.zip` });
      if (response?.error) throw new Error(response.error);
    }
  } catch (error) {
    const current = await getJob(job.id);
    if (current?.status === 'paused' || current?.status === 'cancelled') return;
    job.status = 'failed'; job.stage = job.stage || 'failed'; job.message = error?.message || String(error); job.leaseUntil = 0; job.updatedAt = Date.now();
    await deletePendingSnapshot(job.id).catch(() => {});
    await putJob(job); await broadcast(job);
  }
}

async function updateZipProgress(id, progress) {
  const job = await getJob(id); if (!job || job.status !== 'packaging') return;
  job.progress = 75 + Math.round((progress.completed / Math.max(1, progress.total)) * 18);
  job.message = `ZIP64 archive: ${progress.completed}/${progress.total} entries written.`; job.updatedAt = Date.now();
  await putJob(job); await broadcast(job);
}
async function failPackaging(id, error) {
  const job = await getJob(id); if (!job || job.status !== 'packaging') return;
  job.status = 'failed'; job.stage = 'packaging'; job.message = error || 'ZIP64 packaging failed.'; job.leaseUntil = 0;
  await putJob(job); await broadcast(job); await updateWatchdog();
}

async function handleZipReady(message) {
  const job = await getJob(message.jobId);
  if (!job || job.status !== 'packaging') { chrome.runtime.sendMessage({ target: 'offscreen', type: 'REVOKE_URL', jobId: message.jobId }).catch(() => {}); return; }
  job.status = 'downloading'; job.stage = 'downloading'; job.progress = 95; job.message = 'Archive built; handing it to Chrome Downloads.'; job.updatedAt = Date.now();
  const downloadId = await chrome.downloads.download({ url: message.url, filename: message.filename, saveAs: true });
  job.downloadId = downloadId; job.leaseUntil = 0; await putJob(job); await broadcast(job);
}

async function ensureOffscreen() {
  const url = chrome.runtime.getURL('offscreen/offscreen.html');
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url] });
  if (!contexts.length) await chrome.offscreen.createDocument({ url: 'offscreen/offscreen.html', reasons: ['BLOBS'], justification: 'Build a ZIP64 archive from IndexedDB Blob parts without creating a giant in-memory byte array.' });
}

async function updateWatchdog() {
  const jobs = await listJobs().catch(() => []);
  if (jobs.some(job => ['queued', 'fetching', 'staging', 'packaging'].includes(job.status))) {
    await chrome.alarms.create(WATCHDOG, { periodInMinutes: 0.5 });
  } else {
    await chrome.alarms.clear(WATCHDOG);
  }
}
async function broadcast(job) { chrome.runtime.sendMessage({ target: 'panel', type: 'JOB_UPDATED', job }).catch(() => {}); }

function valueToBlob(value) {
  const text = String(value ?? '');
  const match = text.match(/^data:([^;,]+)?(?:;[^,]*)?;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return new Blob([text], { type: 'text/plain;charset=utf-8' });
  const encoded = match[2], chunks = [];
  const chunkSize = 32768;
  for (let offset = 0; offset < encoded.length; offset += chunkSize) {
    const part = encoded.slice(offset, Math.min(encoded.length, offset + chunkSize));
    const binary = atob(part);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    chunks.push(bytes);
  }
  return new Blob(chunks, { type: match[1] || 'application/octet-stream' });
}

async function fetchProjectFilesInPage(projectId) {
  try {
    const token = localStorage.getItem('base44_access_token') || localStorage.getItem('token');
    if (!token) return { ok: false, error: 'No Base44 session token found. Sign in to app.base44.com first.' };
    const response = await fetch(`/api/apps/${encodeURIComponent(projectId)}/code`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, credentials: 'same-origin'
    });
    const body = await response.text();
    if (!response.ok) return { ok: false, error: `Base44 export endpoint returned HTTP ${response.status}: ${body.slice(0, 500)}` };
    const payload = JSON.parse(body);
    const input = payload.files || payload;
    const files = {};
    if (Array.isArray(input)) {
      for (const file of input) {
        const path = file.path || file.filePath || file.file_path || file.name;
        if (!path) continue;
        files[path] = file.base64 ? `data:${file.mimeType || file.mime_type || 'application/octet-stream'};base64,${file.base64}` : String(file.content ?? file.code ?? '');
      }
    } else {
      for (const [path, value] of Object.entries(input || {})) {
        files[path] = typeof value === 'string' ? value : value?.base64 ? `data:${value.mimeType || value.mime_type || 'application/octet-stream'};base64,${value.base64}` : String(value?.content ?? value?.code ?? JSON.stringify(value, null, 2));
      }
    }
    return { ok: true, files };
  } catch (error) { return { ok: false, error: error?.message || String(error) }; }
}
