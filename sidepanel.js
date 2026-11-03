const $ = id => document.getElementById(id);
let activeTab = null;
let detectedId = '';
let jobsCache = [];

init();
$('detectBtn').addEventListener('click', detectProject);
$('startBtn').addEventListener('click', () => queueExports([$('projectInput').value.trim()]));
$('batchBtn').addEventListener('click', () => {
  const ids = $('batchInput').value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  queueExports(ids);
});
$('viewAllJobs').addEventListener('click', () => showView('jobs'));
$('refreshJobs').addEventListener('click', refreshJobs);
$('restorePlanBtn').addEventListener('click', downloadRestorePlan);
document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
chrome.runtime.onMessage.addListener(message => {
  if (message?.target === 'panel' && message.type === 'JOB_UPDATED') {
    const index = jobsCache.findIndex(job => job.id === message.job.id);
    if (index >= 0) jobsCache[index] = message.job; else jobsCache.unshift(message.job);
    renderJobs();
  }
});
setInterval(refreshJobs, 3000);

async function init() {
  await detectProject();
  await refreshJobs();
}
async function detectProject() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    activeTab = tab || null;
    const match = String(tab?.url || '').match(/app\.base44\.com\/apps\/([^/?#]+)/);
    detectedId = match?.[1] || '';
    $('connection').classList.toggle('connected', !!detectedId);
    $('connection').innerHTML = `<i></i>${detectedId ? 'Connected tab' : 'No project tab'}`;
    $('projectName').textContent = detectedId ? 'Base44 project detected' : 'Connect a Base44 project';
    $('projectHint').textContent = detectedId ? 'The active project tab can be used for an authenticated export.' : 'Open an authorised project in this tab, then queue a verified backup.';
    $('projectId').textContent = detectedId || 'No project detected';
    if (detectedId) $('projectInput').value = detectedId;
  } catch (error) { toast(error.message, true); }
}
async function queueExports(ids) {
  const clean = [...new Set(ids.filter(Boolean))];
  if (!clean.length) return toast('Enter a project ID first.', true);
  if (!activeTab?.id || !detectedId) await detectProject();
  if (!activeTab?.id || !detectedId) return toast('Open a Base44 project tab and detect it before exporting.', true);
  const response = await chrome.runtime.sendMessage({ target: 'background', type: 'START_BATCH', projectIds: clean, tabId: activeTab.id });
  if (!response?.ok) return toast(response?.error || 'Could not queue export.', true);
  toast(`${response.jobs.length} export job${response.jobs.length === 1 ? '' : 's'} queued.`);
  await refreshJobs(); showView('jobs');
}
async function refreshJobs() {
  const response = await chrome.runtime.sendMessage({ target: 'background', type: 'LIST_JOBS' }).catch(error => ({ ok: false, error: error.message }));
  if (response?.ok) { jobsCache = response.jobs || []; renderJobs(); }
}
function renderJobs() {
  const active = jobsCache.filter(job => !['completed', 'cancelled'].includes(job.status));
  $('jobCount').textContent = String(active.length);
  renderJobList($('recentJobs'), jobsCache.slice(0, 3));
  renderJobList($('allJobs'), jobsCache);
}
function renderJobList(container, jobs) {
  if (!jobs.length) { container.className = 'job-list empty-state'; container.textContent = 'No export jobs yet.'; return; }
  container.className = 'job-list';
  container.innerHTML = jobs.map(job => {
    const title = escapeHtml(job.projectId);
    const message = escapeHtml(job.message || '');
    const status = escapeHtml(job.status || 'queued');
    const canPause = ['queued', 'fetching', 'staging'].includes(job.status);
    const canResume = job.status === 'paused';
    const canRetry = job.status === 'failed';
    const canCancel = !['completed', 'cancelled'].includes(job.status);
    return `<article class="job-card"><div class="job-top"><div><div class="job-title">${title}</div><div class="job-meta">${new Date(job.createdAt).toLocaleString()} · ${Number(job.fileCount || 0)} files · ${formatBytes(job.bytes || 0)}</div></div><span class="job-status ${status}">${status}</span></div><div class="job-progress"><i style="width:${Math.max(0,Math.min(100,Number(job.progress)||0))}%"></i></div><div class="job-message">${message}</div><div class="job-actions">${canPause ? `<button data-action="PAUSE_JOB" data-id="${job.id}">Pause</button>` : ''}${canResume ? `<button data-action="RESUME_JOB" data-id="${job.id}">Resume</button>` : ''}${canRetry ? `<button data-action="RETRY_JOB" data-id="${job.id}">Retry</button>` : ''}${canCancel ? `<button data-action="CANCEL_JOB" data-id="${job.id}">Cancel</button>` : ''}</div></article>`;
  }).join('');
  container.querySelectorAll('button[data-action]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    const response = await chrome.runtime.sendMessage({ target: 'background', type: button.dataset.action, jobId: button.dataset.id });
    if (!response?.ok) toast(response?.error || 'Could not update job.', true);
    await refreshJobs();
  }));
}
function showView(view) {
  document.querySelectorAll('.tab').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  document.querySelectorAll('.view').forEach(section => section.classList.toggle('active', section.id === `view-${view}`));
}
function toast(message, error = false) {
  const el = $('toast'); el.textContent = message; el.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.className = 'toast'; }, 4200);
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
function formatBytes(value) { if (value < 1024) return `${value} B`; const units = ['KB','MB','GB','TB']; let n = value / 1024, i = 0; while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; } return `${n.toFixed(1)} ${units[i]}`; }
async function downloadRestorePlan() {
  const content = `# Base44 Toolkit restore runbook\n\n## Safety gate\n\nNo supported Base44 write/import adapter is active in this release. Do not send writes to undocumented endpoints.\n\n## Restore procedure\n\n1. Preserve the original ZIP64 archive unchanged.\n2. Verify the archive with a ZIP64-capable archive utility.\n3. Review BASE44-EXPORT-MANIFEST.json and SHA256SUMS.txt.\n4. Review MISSING-FILES-REPORT.md and DEPENDENCY-RECOVERY.md if present.\n5. Restore through an official Base44 import/restore workflow when available.\n6. Validate the restored app with type-check, tests and production build.\n\n## Adapter contract\n\nA future adapter must be based on documented Base44 import API semantics, explicit project targeting, a dry-run/preview, user confirmation, idempotency or conflict detection, and a post-restore verification read.\n`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
  await chrome.downloads.download({ url, filename: 'base44-restore-runbook.md', saveAs: true });
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  toast('Restore runbook prepared.');
}
