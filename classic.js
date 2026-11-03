const appIdInput = document.getElementById("appId");
const tabStatus = document.getElementById("tabStatus");
const logBox = document.getElementById("log");
const detectBtn = document.getElementById("detectBtn");
const downloadBtn = document.getElementById("downloadBtn");
const toggleAdvanced = document.getElementById("toggleAdvanced");
const advancedPanel = document.getElementById("advancedPanel");
const pathsInput = document.getElementById("paths");
const detectPathsBtn = document.getElementById("detectPathsBtn");
const downloadByPathsBtn = document.getElementById("downloadByPathsBtn");
const excludeInput = document.getElementById("excludePaths");
const diagnosticsBtn = document.getElementById("diagnosticsBtn");
const optionIds = ["includeManifest", "includeReadme", "includeChecksums", "skipEmpty"];
const progressBar = document.getElementById("progressBar");
const batchIdsInput = document.getElementById("batchIds");
const compareBtn = document.getElementById("compareBtn");

let activeTab = null;
const clearPathsBtn = document.getElementById("clearPathsBtn");
const clearLogBtn = document.getElementById("clearLogBtn");
function updatePathCount(){document.getElementById("fileCount").textContent=parsePaths(pathsInput.value).length;}
pathsInput.addEventListener("input",()=>{updatePathCount();chrome.storage.local.set({paths:pathsInput.value});});
excludeInput.addEventListener("input",()=>chrome.storage.local.set({excludePaths:excludeInput.value}));
optionIds.forEach(id=>document.getElementById(id).addEventListener("change",saveOptions));
function saveOptions(){const opts={};optionIds.forEach(id=>opts[id]=document.getElementById(id).checked);chrome.storage.local.set({exportOptions:opts});}
appIdInput.addEventListener("change",()=>chrome.storage.local.set({lastProjectId:appIdInput.value.trim()}));
clearPathsBtn.addEventListener("click",()=>{pathsInput.value="";updatePathCount();chrome.storage.local.set({paths:""});log("Path list cleared.");});
clearLogBtn.addEventListener("click",()=>log("Activity log cleared."));
batchIdsInput.addEventListener("input",()=>chrome.storage.local.set({batchIds:batchIdsInput.value}));
compareBtn.addEventListener("click",()=>comparePreviousExport());


init();

async function init() {
  activeTab = await getActiveTab();
  const appId = extractAppId(activeTab?.url || "");
  tabStatus.textContent = appId ? "Base44 detected" : "No Base44 tab";
  if (appId) appIdInput.value = appId;
  const saved = await chrome.storage.local.get(["lastProjectId","paths","excludePaths","exportOptions","batchIds"]);
  if (!appId && saved.lastProjectId) appIdInput.value = saved.lastProjectId;
  pathsInput.value = saved.paths || "";
  batchIdsInput.value = saved.batchIds || "";
  excludeInput.value = saved.excludePaths || "";
  if(saved.exportOptions) optionIds.forEach(id=>{if(typeof saved.exportOptions[id]==="boolean")document.getElementById(id).checked=saved.exportOptions[id];});
  updatePathCount();
  log(appId ? "Project detected in the active tab. Ready to export." : "Open a Base44 project tab, or enter its project ID.");
}

detectBtn.addEventListener("click", async () => {
  activeTab = await getActiveTab();
  const appId = extractAppId(activeTab?.url || "");
  if (!appId) return log("No Base44 project ID found in the active tab.");
  appIdInput.value = appId;
  tabStatus.textContent = "Base44 connected";
  await chrome.storage.local.set({lastProjectId:appId});
  log(`Project detected: ${appId}`);
});

diagnosticsBtn.addEventListener("click", async()=>{
  await withBusy(diagnosticsBtn,async()=>{
    activeTab=await getActiveTab();
    if(!activeTab?.id) throw new Error("No active tab found.");
    const result=await runInPage(inspectBase44Page,[]);
    const checks=[`Base44 page: ${result.isBase44?"yes":"no"}`,`Project ID in URL: ${result.appId?"yes":"no"}`,`Editor detected: ${result.editor?"yes":"no"}`,`File navigation: ${result.navigation?"yes":"no"}`,`Session token available: ${result.token?"yes":"no"}`];
    document.getElementById("diagnosticStatus").textContent=result.isBase44?"Checked":"Wrong tab";
    log("Connection diagnostics\n"+checks.join("\n")+"\n\n"+(result.isBase44?"Keep this project tab active while exporting.":"Open app.base44.com and a project first."));
  });
});

downloadBtn.addEventListener("click", async () => {
  await withBusy(downloadBtn, async () => {
    const appId = requireAppId();
    await chrome.storage.local.set({lastProjectId:appId,paths:pathsInput.value});
    const batchIds = [...new Set(batchIdsInput.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];
    if (batchIds.length) {
      const ids = [...new Set([appId, ...batchIds])];
      const batchSummary = [];
      for (let i=0;i<ids.length;i++) {
        const id=ids[i];
        if(!/^[a-zA-Z0-9_-]{8,}$/.test(id)){batchSummary.push({projectId:id,status:"invalid-id"});continue;}
        log(`Batch export ${i+1}/${ids.length}: ${id}`);
        const result=await runInPage(downloadProjectFromApi,[id]);
        if(!result.ok){batchSummary.push({projectId:id,status:"failed",error:result.error});continue;}
        const files=applyExportOptions(result.files);
        const enriched=await enrichRecoveryFiles(files,id);
        await saveZip(enriched.files,`base44-${id}-backup.zip`,{projectId:id,analysis:enriched.analysis});
        batchSummary.push({projectId:id,status:"exported",files:Object.keys(files).length,missing:enriched.analysis.missingReferences.length});
      }
      const report=`# Batch export report\n\n${JSON.stringify(batchSummary,null,2)}\n`;
      await downloadText(report,"base44-batch-export-report.md");
      log(`Batch complete: ${batchSummary.filter(x=>x.status==="exported").length}/${ids.length} projects exported. See batch report.`);
      return;
    }
    log("Starting direct project export…");
    const result = await runInPage(downloadProjectFromApi, [appId]);
    if (!result.ok) {
      let paths = parsePaths(pathsInput.value);
      try {
        const detected = await runInPage(detectPathsFromPage, []);
        if (detected.paths?.length) {
          paths = detected.paths;
          pathsInput.value = paths.join("\n");
          updatePathCount();
        }
      } catch {}
      if (!paths.length) throw new Error(`${result.error}\nNo paths detected. Use Scan file tree to build the recovery list.`);
      log(`${result.error}\nSwitching to editor recovery for ${paths.length} paths…`);
      const fallback = await runInPage(downloadProjectByPaths, [appId, paths]);
      if (!fallback.ok) {
        log(`${fallback.error}\n\nNiepobrane:\n${(fallback.failures || []).map((x) => `- ${x.path}`).join("\n")}`);
        return;
      }
      const enriched = await enrichRecoveryFiles(applyExportOptions(fallback.files),appId);
      await saveZip(enriched.files, `base44-${appId}-editor.zip`,{projectId:appId,analysis:enriched.analysis});
      const failed = fallback.failures?.length ? `\nPominięto: ${fallback.failures.length}` : "";
      log(`Recovery export complete: ${Object.keys(fallback.files).length} files added to ZIP.${failed}`);
      return;
    }
    const enriched = await enrichRecoveryFiles(applyExportOptions(result.files),appId);
    await saveZip(enriched.files, `base44-${appId}.zip`,{projectId:appId,analysis:enriched.analysis});
    log(`Export complete: ${Object.keys(result.files).length} files added to ZIP.`);
  });
});

toggleAdvanced.addEventListener("click", () => {
  advancedPanel.hidden = !advancedPanel.hidden;
  toggleAdvanced.setAttribute("aria-expanded",String(!advancedPanel.hidden));
  document.getElementById("advancedChevron").textContent=advancedPanel.hidden?"＋":"−";
});

detectPathsBtn.addEventListener("click", async () => {
  await withBusy(detectPathsBtn, async () => {
    const detected = await runInPage(detectPathsFromPage, []);
    const paths = detected.paths || [];
    if (!paths.length) throw new Error("No paths found. Make sure the Base44 file tree is visible and expanded.");
    pathsInput.value = paths.join("\n");
    await chrome.storage.local.set({paths:pathsInput.value});
    updatePathCount();
    log(`Scanned ${paths.length} paths. Review the list before exporting.`);
  });
});

downloadByPathsBtn.addEventListener("click", async () => {
  await withBusy(downloadByPathsBtn, async () => {
    const appId = requireAppId();
    const paths = parsePaths(pathsInput.value);
    if (!paths.length) throw new Error("The path list is empty. Scan the file tree or add paths first.");
    await chrome.storage.local.set({lastProjectId:appId,paths:pathsInput.value});
    log(`Recovering ${paths.length} paths through the editor…`);
    const result = await runInPage(downloadProjectByPaths, [appId, paths]);
    if (!result.ok) {
      log(`${result.error}\n\nNiepobrane:\n${(result.failures || []).map((x) => `- ${x.path}`).join("\n")}`);
      return;
    }
    const enriched = await enrichRecoveryFiles(applyExportOptions(result.files),appId);
    await saveZip(enriched.files, `base44-${appId}-editor.zip`,{projectId:appId,analysis:enriched.analysis});
    const failed = result.failures?.length ? `\nPominięto: ${result.failures.length}` : "";
    log(`Recovery export complete: ${Object.keys(result.files).length} files added to ZIP.${failed}`);
  });
});

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function extractAppId(url) {
  const match = String(url).match(/app\.base44\.com\/apps\/([^/]+)/);
  return match?.[1] || "";
}

function requireAppId() {
  const appId = appIdInput.value.trim();
  if (!/^[a-zA-Z0-9_-]{8,}$/.test(appId)) throw new Error("Enter a valid project ID.");
  return appId;
}

function parsePaths(text) {
  const includes=[...new Set(text.split(/\r?\n/).map(line=>line.trim().replace(/\\/g,"/"))
    .filter(line=>line && !line.startsWith("/") && !line.split("/").includes("..")))];
  const excludes=excludeInput.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  return includes.filter(path=>!excludes.some(pattern=>globMatch(path,pattern)));
}
function globMatch(path,pattern){
  const escaped=pattern.replace(/[.+^${}()|[\]\\]/g,"\\$&").replace(/\*\*/g,"§§").replace(/\*/g,"[^/]*").replace(/§§/g,".*").replace(/\?/g,".");
  try{return new RegExp("^"+escaped+"$","i").test(path)||new RegExp("(^|/)"+escaped+"$","i").test(path);}catch{return false;}
}
function applyExportOptions(input){
  const opts=Object.fromEntries(optionIds.map(id=>[id,document.getElementById(id).checked]));
  const out={}; let skipped=0;
  const explicitIncludes=pathsInput.value.trim()?new Set(parsePaths(pathsInput.value)):null;
  for(const [path,value] of Object.entries(input||{})){
    const safe=sanitizeZipPath(path); if(!safe)continue;
    if(explicitIncludes&&!explicitIncludes.has(safe))continue;
    const content=String(value??""); if(opts.skipEmpty&&!content.length){skipped++;continue;}
    if(excludeInput.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).some(p=>globMatch(safe,p)))continue;
    out[safe]=content;
  }
  if(skipped)log(`Skipped ${skipped} empty files by preference.`);
  return out;
}
async function inspectBase44Page(){
  const url=location.href; const match=url.match(/app\.base44\.com\/apps\/([^/?#]+)/);
  return {isBase44:location.hostname==="app.base44.com",appId:match?.[1]||"",editor:!!document.querySelector(".monaco-editor"),navigation:!!(document.querySelector('[role="navigation"]')||document.querySelector("nav")),token:!!(localStorage.getItem("base44_access_token")||localStorage.getItem("token"))};
}

function log(message) {
  logBox.textContent = message;
  if(!/export|hash|zip/i.test(message)) progressBar.style.width="0%";
}

async function withBusy(button, task) {
  const buttons = [detectBtn, downloadBtn, detectPathsBtn, downloadByPathsBtn, diagnosticsBtn];
  try {
    buttons.forEach((btn) => (btn.disabled = true));
    await task();
  } catch (error) {
    log(error?.message || String(error));
  } finally {
    buttons.forEach((btn) => (btn.disabled = false));
  }
}

async function runInPage(func, args) {
  activeTab = activeTab || await getActiveTab();
  if (!activeTab?.id) throw new Error("Nie mogę odczytać aktywnej karty.");
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    world: "MAIN",
    func,
    args
  });
  return result.result;
}

async function downloadProjectFromApi(appId) {
  try {
    const token = localStorage.getItem("base44_access_token") || localStorage.getItem("token");
    if (!token) return { ok: false, error: "Brak tokenu Base44 w tej karcie. Zaloguj się w app.base44.com." };
    const response = await fetch(`/api/apps/${appId}/code`, {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });
    const text = await response.text();
    if (!response.ok) {
      let detail = text;
      try {
        const parsed = JSON.parse(text);
        detail = parsed.detail || parsed.message || text;
      } catch {}
      return { ok: false, error: `Base44 API: ${response.status} ${detail}` };
    }
    const payload = JSON.parse(text);
    const files = normalizeFiles(payload.files || payload);
    return { ok: true, files };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }

  function normalizeFiles(input) {
    if (Array.isArray(input)) {
      return Object.fromEntries(input.map((file) => [
        file.path || file.filePath || file.file_path || file.name,
        file.base64 ? `data:${file.mimeType || file.mime_type || "application/octet-stream"};base64,${file.base64}` : String(file.content ?? file.code ?? "")
      ]).filter(([path]) => path));
    }
    const out = {};
    for (const [path, value] of Object.entries(input || {})) {
      out[path] = typeof value === "string" ? value : value?.base64 ? `data:${value.mimeType || value.mime_type || "application/octet-stream"};base64,${value.base64}` : String(value?.content ?? value?.code ?? JSON.stringify(value, null, 2));
    }
    return out;
  }
}

async function downloadProjectByPaths(_appId, paths) {
  const files = {};
  const failures = [];

  for (const path of paths) {
    try {
      files[path] = await readEditorFile(path);
    } catch (error) {
      failures.push({ path, error: error?.message || String(error) });
    }
  }

  if (!Object.keys(files).length) {
    return { ok: false, error: "Nie udało się pobrać żadnego pliku przez edytor.", failures };
  }
  return { ok: true, files, failures };

  async function readEditorFile(path) {
    const normalizedPath = normalizePath(path);
    await openPathInTree(normalizedPath);
    await waitForEditorPath(normalizedPath);
    return readEditorText();
  }

  async function openPathInTree(path) {
    const segments = normalizePath(path).split("/").filter(Boolean);
    if (!segments.length) throw new Error("Ścieżka pliku jest pusta.");

    const navigation = findNavigationRoot();
    if (!navigation) throw new Error("Nie znalazłem drzewa plików Base44.");
    let container = findTreeContainer(navigation);
    if (!container) throw new Error("Nie znalazłem zawartości drzewa plików Base44.");

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const button = findTreeButton(container, segment);
      if (!button) {
        throw new Error(`Nie znalazłem segmentu "${segment}" w drzewku plików.`);
      }

      const isLast = i === segments.length - 1;
      if (isLast) {
        if (getEditorPath().endsWith(`/${path}`)) return;
        activate(button);
        return;
      }

      if (button.getAttribute("data-state") !== "open") {
        activate(button);
      }
      container = await waitForTreeSegment(button, segments[i + 1]);
    }
  }

  async function waitForEditorPath(path) {
    const targetSuffix = `/${path}`;
    for (let i = 0; i < 60; i++) {
      if (getEditorPath().endsWith(targetSuffix)) return;
      await sleep(i < 5 ? 100 : 150);
    }
    throw new Error(`Nie udało się otworzyć pliku "${path}".`);
  }

  async function waitForTreeSegment(folderButton, segment) {
    const wanted = normalizeButtonText(segment);
    for (let i = 0; i < 30; i++) {
      const container = getFolderContents(folderButton);
      if (container) {
        const button = findTreeButton(container, wanted);
        if (button) return container;
      }
      await sleep(100);
    }
    throw new Error(`Nie pojawił się segment "${segment}" w drzewku plików.`);
  }

  function findNavigationRoot() {
    return document.querySelector('[role="navigation"]') || document.querySelector("nav");
  }

  function findTreeContainer(navigation) {
    return Array.from(navigation.querySelectorAll("div")).find((container) => {
      const nodes = Array.from(container.children);
      return nodes.length > 0 && nodes.every((node) => getNodeButton(node));
    }) || null;
  }

  function findTreeButton(container, label) {
    const wanted = normalizeButtonText(label);
    for (const node of Array.from(container.children)) {
      const button = getNodeButton(node);
      if (button && normalizeButtonText(button.textContent) === wanted && isVisible(button)) return button;
    }
    return null;
  }

  function getNodeButton(node) {
    return Array.from(node?.children || []).find((child) => child.tagName === "BUTTON") || null;
  }

  function getFolderContents(folderButton) {
    const folderNode = folderButton?.parentElement;
    return Array.from(folderNode?.children || []).filter((child) => child !== folderButton && child.tagName === "DIV").pop() || null;
  }

  function activate(button) {
    if (typeof button.click === "function") {
      button.click();
      return;
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  }

  function findEditorRoot() {
    const editors = Array.from(document.querySelectorAll(".monaco-editor"));
    if (!editors.length) return null;
    return editors.find((editor) => editor.classList.contains("focused")) || editors[0];
  }

  function getEditorPath() {
    return findEditorRoot()?.dataset?.uri || "";
  }

  function readEditorText() {
    const editor = findEditorRoot();
    if (!editor) throw new Error("Nie znaleziono edytora kodu.");
    const viewLines = editor.querySelector(".view-lines");
    if (!viewLines) throw new Error("Nie udało się odczytać kodu z edytora.");
    return viewLines.innerText.replace(/\u00a0/g, " ").replace(/\r\n/g, "\n").trimEnd();
  }

  function normalizePath(value) {
    return String(value).replace(/\\/g, "/").replace(/^\/+/, "").trim();
  }

  function normalizeButtonText(value) {
    return String(value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

async function detectPathsFromPage() {
  const navigation = document.querySelector('[role="navigation"]') || document.querySelector("nav");
  if (!navigation) return { paths: [] };

  const root = findTreeContainer(navigation);
  if (!root) return { paths: [] };

  const paths = [];
  await collectFiles(root, []);
  return { paths: [...new Set(paths)] };

  async function collectFiles(container, parentPath) {
    const nodes = Array.from(container.children);
    for (const node of nodes) {
      const button = getNodeButton(node);
      if (!button) continue;

      const name = normalizeText(button.textContent);
      if (!name) continue;

      if (!button.hasAttribute("data-state")) {
        paths.push([...parentPath, name].join("/"));
        continue;
      }

      if (button.getAttribute("data-state") !== "open") activate(button);
      const contents = await waitForFolderContents(button);
      if (contents) await collectFiles(contents, [...parentPath, name]);
    }
  }

  function findTreeContainer(rootElement) {
    return Array.from(rootElement.querySelectorAll("div")).find((container) => {
      const nodes = Array.from(container.children);
      return nodes.length > 0 && nodes.every((node) => getNodeButton(node));
    }) || null;
  }

  function getNodeButton(node) {
    return Array.from(node?.children || []).find((child) => child.tagName === "BUTTON") || null;
  }

  function getFolderContents(folderButton) {
    const folderNode = folderButton?.parentElement;
    return Array.from(folderNode?.children || []).filter((child) => child !== folderButton && child.tagName === "DIV").pop() || null;
  }

  async function waitForFolderContents(folderButton) {
    for (let i = 0; i < 40; i++) {
      const contents = getFolderContents(folderButton);
      if (contents && (folderButton.getAttribute("data-state") === "open" || contents.children.length > 0)) return contents;
      await sleep(100);
    }
    return getFolderContents(folderButton);
  }

  function activate(button) {
    if (typeof button.click === "function") {
      button.click();
      return;
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  }

  function normalizeText(value) {
    return String(value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}


// Recovery analysis is intentionally evidence-based: inferred files are reported, never silently fabricated.
async function enrichRecoveryFiles(sourceFiles, projectId) {
  const files={...sourceFiles};
  const paths=Object.keys(files).map(sanitizeZipPath).filter(Boolean);
  const pathSet=new Set(paths);
  const assets=paths.filter(p=>/\.(png|jpe?g|gif|webp|svg|ico|avif|woff2?|ttf|otf|mp4|webm|mp3|wav|pdf)$/i.test(p));
  const sourcePaths=paths.filter(p=>/\.(jsx?|tsx?|mjs|cjs|css|scss|html)$/i.test(p));
  const refs=[];
  const importedPackages=new Set();
  for(const path of sourcePaths){
    const text=String(files[path]??"");
    const re=/(?:from\s*|import\s*\(|require\s*\()\s*["']([^"']+)["']/g;
    let m;
    while((m=re.exec(text))){
      const ref=m[1];
      if(!ref.startsWith(".")&&!ref.startsWith("/")&&!ref.startsWith("@/")){if(!ref.startsWith("node:")) importedPackages.add(ref.split("/").slice(0,ref.startsWith("@")?2:1).join("/"));continue;}
      refs.push({from:path,ref});
    }
    const cssRe=/url\(\s*["']?([^"')]+)["']?\s*\)/g;
    let c; while((c=cssRe.exec(text))){if(c[1]&&!/^(data:|https?:|#)/i.test(c[1]))refs.push({from:path,ref:c[1]});}
  }
  const missing=[];
  for(const item of refs){
    const clean=item.ref.split(/[?#]/)[0].replace(/\\/g,"/");
    const base=item.from.includes("/")?item.from.slice(0,item.from.lastIndexOf("/")+1):"";
    const candidate=clean.startsWith("@/")?clean.slice(2):base+clean;
    const candidates=[candidate,candidate+".ts",candidate+".tsx",candidate+".js",candidate+".jsx",candidate+".json",candidate+"/index.ts",candidate+"/index.tsx",candidate+"/index.js",candidate+"/index.jsx"];
    if(!candidates.some(x=>pathSet.has(x)))missing.push({...item,candidates:candidates.slice(0,4)});
  }
  let pkg={};
  try{pkg=JSON.parse(files["package.json"]||"{}");}catch{}
  const declared=new Set([...Object.keys(pkg.dependencies||{}),...Object.keys(pkg.devDependencies||{}),...Object.keys(pkg.peerDependencies||{})]);
  const undeclared=[...importedPackages].filter(x=>!declared.has(x)).sort();
  const lockfiles=["package-lock.json","pnpm-lock.yaml","yarn.lock","bun.lockb","bun.lock"].filter(x=>pathSet.has(x));
  const configs=paths.filter(p=>/^(tsconfig(\..+)?\.json|vite\.config\.|webpack\.config\.|next\.config\.|eslint\.config\.|\.eslintrc|postcss\.config\.|tailwind\.config\.)/.test(p));
  const hasTs=paths.some(p=>/\.tsx?$/.test(p));
  const hasReact=paths.some(p=>/\.(jsx|tsx)$/.test(p)) || importedPackages.has("react");
  const configGaps=[];
  if(hasTs&&!pathSet.has("tsconfig.json"))configGaps.push("TypeScript files exist but tsconfig.json was not found");
  if(hasReact&&!pathSet.has("package.json"))configGaps.push("React-like source exists but package.json was not found");
  const structure={directories:[...new Set(paths.map(p=>p.includes("/")?p.slice(0,p.lastIndexOf("/")):"(root)"))].sort(),extensions:[...new Set(paths.map(p=>{const n=p.split("/").pop();return n.includes(".")?"."+n.split(".").pop():"(no extension)"}))].sort()};
  const analysis={projectId,generatedAt:new Date().toISOString(),fileCount:paths.length,assetFiles:assets,sourceFiles:sourcePaths.length,missingReferences:missing,importedPackages:[...importedPackages].sort(),undeclaredPackages:undeclared,packageManager:lockfiles[0]||"not detected",configurationFiles:configs,configurationGaps:configGaps,structure};
  files["BASE44-RECOVERY-REPORT.json"]=JSON.stringify(analysis,null,2);
  files["PROJECT-STRUCTURE.md"]="# Reconstructed project structure\n\n"+paths.sort().map(p=>"- `"+p+"`").join("\n")+"\n";
  files["REACT-TYPESCRIPT-RECOVERY.md"]="# React and TypeScript configuration review\n\n"+
    `TypeScript source detected: ${hasTs?"yes":"no"}\n\nReact source detected: ${hasReact?"yes":"no"}\n\n`+
    (configGaps.length?configGaps.map(x=>"- "+x).join("\n"):"No obvious React/TypeScript configuration gap was detected by this filename scan.")+
    "\n\nThe exporter does not fabricate tsconfig, bundler, lint or package files. Recover original configuration from source control or a trusted backup; otherwise recreate it for the actual build pipeline and validate with a production build.\n";
  files["DEPENDENCY-RECOVERY.md"]="# Dependency and configuration review\n\n"+
    `Package: ${pkg.name||"not declared"}\n\n`+
    `Detected package manager: ${analysis.packageManager}\n\n`+
    "## Declared dependencies\n\n"+[...declared].sort().map(x=>"- `"+x+"`").join("\n")+
    "\n\n## Imported packages not declared in package.json\n\n"+
    (undeclared.length?undeclared.map(x=>"- `"+x+"` — verify and add the appropriate version manually").join("\n"):"No undeclared imports detected by static scan.")+
    "\n\n## Configuration files detected\n\n"+(configs.length?configs.map(x=>"- `"+x+"`").join("\n"):"No common React/TypeScript/build configuration files detected.")+
    "\n\nThis report does not install packages or invent version numbers. Re-run the appropriate package manager after reviewing imports and project requirements.\n";
  files["REPAIR-PLAN.md"]="# Recovery and repair plan\n\n"+
    "1. Review MISSING-FILES-REPORT.md and confirm each unresolved reference.\n"+
    "2. Review DEPENDENCY-RECOVERY.md and install only compatible package versions.\n"+
    "3. Recover original TypeScript and build configuration from source control or a trusted backup.\n"+
    "4. Restore missing assets from an independently verified source.\n"+
    "5. Run the project's type-check, tests and production build.\n"+
    "6. Preserve this archive as an immutable recovery checkpoint.\n\n"+
    "The extension does not write files back to Base44 or fabricate missing source/configuration.\n";
  files["MISSING-FILES-REPORT.md"]="# Missing file reference scan\n\n"+
    (missing.length?missing.map(x=>`- From \`${x.from}\`: \`${x.ref}\` (not found in exported paths)`).join("\n"):"No unresolved relative imports or CSS url() references were detected.")+
    "\n\nA missing reference may be generated at build time, aliased by project configuration, or intentionally external. Review before treating it as a confirmed missing file.\n";
  return {files,analysis};
}
async function downloadText(text,filename){
  const url=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));
  await chrome.downloads.download({url,filename,saveAs:true});
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function comparePreviousExport(){
  try{
    const stored=await chrome.storage.local.get(["lastExportSnapshot"]);
    const old=stored.lastExportSnapshot;
    if(!old){log("No previous export inventory is stored yet. Export this project once, then compare the next version.");return;}
    const appId=requireAppId();
    if(old.projectId && old.projectId!==appId) throw new Error("The saved baseline belongs to a different project. Export this project once to establish its baseline.");
    const result=await runInPage(downloadProjectFromApi,[appId]);
    if(!result.ok)throw new Error(result.error);
    const current=await hashInventory(applyExportOptions(result.files));
    const before=new Map((old.files||[]).map(x=>[x.path,x.sha256]));
    const after=new Map(current.map(x=>[x.path,x.sha256]));
    const added=[...after.keys()].filter(x=>!before.has(x));
    const removed=[...before.keys()].filter(x=>!after.has(x));
    const changed=[...after.keys()].filter(x=>before.has(x)&&before.get(x)!==after.get(x));
    const report={projectId:appId,comparedAt:new Date().toISOString(),baselineCreatedAt:old.createdAt,added,removed,changed,unchanged:current.length-added.length-changed.length};
    await downloadText("# Project version comparison\n\n"+JSON.stringify(report,null,2)+"\n","base44-version-comparison.md");
    log(`Comparison complete · +${added.length} added · ~${changed.length} changed · −${removed.length} removed.`);
  }catch(e){log("Comparison failed: "+(e.message||e));}
}
async function hashInventory(files){
  const out=[];
  for(const [path,value] of Object.entries(files)){
    const bytes=toBytes(value);
    const digest=await crypto.subtle.digest("SHA-256",bytes);
    out.push({path,size:bytes.length,sha256:[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("")});
  }
  return out;
}

async function saveZip(files, filename, metadata={}) {
  const entries=Object.entries(files||{});
  if(!entries.length)throw new Error("No files remain after applying export filters.");
  const bytesTotal=entries.reduce((n,[,v])=>n+toBytes(v).length,0);
  const fileRecords=[]; const checksumLines=[];
  for(let i=0;i<entries.length;i++){
    const [path,content]=entries[i]; const bytes=toBytes(content);
    const digest=await crypto.subtle.digest("SHA-256",bytes);
    const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
    fileRecords.push({path,size:bytes.length,sha256:hash}); checksumLines.push(`${hash}  ${path}`);
    if(i%5===0)progressBar.style.width=`${Math.round((i+1)/entries.length*75)}%`;
  }
  const options=Object.fromEntries(optionIds.map(id=>[id,document.getElementById(id).checked]));
  const verified=fileRecords.every(record=>record.sha256 && record.size>=0);
  if(options.includeManifest)files["BASE44-EXPORT-MANIFEST.json"]=JSON.stringify({format:"base44-toolkit-export",version:"4.0.0",createdAt:new Date().toISOString(),projectId:metadata.projectId||null,fileCount:fileRecords.length,totalBytes:bytesTotal,integrityStatus:verified?"sha256-generated":"review-required",files:fileRecords},null,2);
  if(options.includeChecksums)files["SHA256SUMS.txt"]=checksumLines.join("\n")+"\n";
  if(options.includeReadme)files["EXPORT-README.md"]=`# Base44 project export\n\nGenerated by Base44 Toolkit 4.0.0 (classic recovery mode).\n\n- Exported source files: ${fileRecords.length}\n- Uncompressed source size: ${bytesTotal} bytes\n- Created: ${new Date().toISOString()}\n- Integrity: SHA-256 hashes are listed in SHA256SUMS.txt and the JSON manifest.\n\n## Important limitations\nThis archive contains only source files accessible to the exporter. It does not include server-side databases, secrets, environment variables, deployment configuration, user records, or inaccessible binary assets. Review the archive before sharing it.\n`;
  document.getElementById("metricFiles").textContent=String(fileRecords.length);
  document.getElementById("metricSize").textContent=formatBytes(bytesTotal);
  document.getElementById("metricHash").textContent=verified?"Hashed":"Review";
  progressBar.style.width="85%";
  let zip = createZip(files);
  const firstCheck=verifyStoredZip(zip);
  files["EXPORT-VERIFICATION-REPORT.json"]=JSON.stringify({
    format:"base44-toolkit-verification",version:"4.0.0",checkedAt:new Date().toISOString(),
    status:firstCheck.ok?"passed":"failed",archiveEntries:firstCheck.entries,
    checks:["ZIP local headers","stored entry sizes","CRC-32 per entry"],
    sha256Manifest:options.includeManifest?"included":"disabled",
    note:"ZIP structural and CRC checks are performed before download. SHA-256 values are recorded in the manifest/checksum list; this is not a test of application buildability."
  },null,2);
  zip=createZip(files);
  const finalCheck=verifyStoredZip(zip);
  if(!finalCheck.ok)throw new Error("Generated ZIP did not pass its structural/CRC verification.");
  const url = URL.createObjectURL(new Blob([zip], { type: "application/zip" }));
  await chrome.downloads.download({url,filename,saveAs:true});
  if(metadata.projectId) {
    const generatedReports=new Set(["BASE44-RECOVERY-REPORT.json","PROJECT-STRUCTURE.md","DEPENDENCY-RECOVERY.md","MISSING-FILES-REPORT.md","REPAIR-PLAN.md","REACT-TYPESCRIPT-RECOVERY.md"]);
    await chrome.storage.local.set({lastExportSnapshot:{projectId:metadata.projectId,createdAt:new Date().toISOString(),files:fileRecords.filter(record=>!generatedReports.has(record.path))}});
  }
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  progressBar.style.width="100%";
  log(`Archive created · ${finalCheck.entries} ZIP entries passed CRC/size checks · SHA-256 hashes ${verified?"generated":"review required"}.`);
}

function toBytes(value){
  const text=String(value??"");
  const match=text.match(/^data:[^;,]+(?:;[^,]*)?;base64,([A-Za-z0-9+/=]+)$/);
  if(match){
    const binary=atob(match[1]); const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return bytes;
  }
  return new TextEncoder().encode(text);
}
function formatBytes(bytes){if(bytes<1024)return `${bytes} B`;const units=["KB","MB","GB"];let n=bytes/1024,i=0;while(n>=1024&&i<units.length-1){n/=1024;i++;}return `${n.toFixed(1)} ${units[i]}`;}

function verifyStoredZip(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let offset=0,count=0;
  while(offset+4<=bytes.length && view.getUint32(offset,true)===0x04034b50){
    if(offset+30>bytes.length)return {ok:false,entries:count,error:"truncated local header"};
    const method=view.getUint16(offset+8,true),crc=view.getUint32(offset+14,true);
    const compressed=view.getUint32(offset+18,true),uncompressed=view.getUint32(offset+22,true);
    const nameLength=view.getUint16(offset+26,true),extraLength=view.getUint16(offset+28,true);
    const dataStart=offset+30+nameLength+extraLength,dataEnd=dataStart+compressed;
    if(method!==0||compressed!==uncompressed||dataEnd>bytes.length)return {ok:false,entries:count,error:"unsupported or truncated entry"};
    const actual=crc32(bytes.subarray(dataStart,dataEnd));
    if(actual!==crc)return {ok:false,entries:count,error:"CRC mismatch"};
    offset=dataEnd;count++;
  }
  return {ok:count>0,entries:count,error:count?"":"no ZIP entries found"};
}

function createZip(files) {
  const encoder = new TextEncoder();
  const seen = new Set();
  const entries = Object.entries(files).map(([name, content]) => ({
    name: sanitizeZipPath(name), data: toBytes(content)
  })).filter(entry => { if(!entry.name || seen.has(entry.name)) return false; seen.add(entry.name); return true; });
  if (!entries.length) throw new Error("No valid files were returned for the ZIP archive.");
  if (entries.length > 65535) throw new Error("ZIP export exceeds the supported file count.");
  if(entries.some(entry=>entry.data.length>0xffffffff)||entries.reduce((n,e)=>n+e.data.length,0)>0xffffffff)throw new Error("This built-in ZIP writer supports archives up to 4 GiB. Export a smaller selection.");

  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const now = new Date();
  const dosTime = ((now.getHours() & 31) << 11) | ((now.getMinutes() & 63) << 5) | ((now.getSeconds() / 2) & 31);
  const dosDate = (((now.getFullYear() - 1980) & 127) << 9) | (((now.getMonth() + 1) & 15) << 5) | (now.getDate() & 31);

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const localHeader = concatBytes(
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(dosTime), u16(dosDate),
      u32(crc), u32(entry.data.length), u32(entry.data.length), u16(nameBytes.length), u16(0), nameBytes
    );
    localParts.push(localHeader, entry.data);
    const centralHeader = concatBytes(
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(dosTime), u16(dosDate),
      u32(crc), u32(entry.data.length), u32(entry.data.length), u16(nameBytes.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), nameBytes
    );
    centralParts.push(centralHeader);
    offset += localHeader.length + entry.data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = concatBytes(
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(centralSize), u32(offset), u16(0)
  );
  return concatBytes(...localParts, ...centralParts, end);
}

function sanitizeZipPath(path) {
  const raw=String(path).replace(/\\/g,"/");
  if(raw.startsWith("/")||/^[a-zA-Z]:/.test(raw))return "";
  const parts=raw.split("/");
  if(parts.some(part=>part===".."))return "";
  return parts.filter(part=>part&&part!==".").join("/");
}

function concatBytes(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function u16(value) {
  return new Uint8Array([value & 255, (value >>> 8) & 255]);
}

function u32(value) {
  return new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
