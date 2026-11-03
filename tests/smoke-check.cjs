const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const popup = fs.readFileSync(path.join(root, "classic.html"), "utf8");
const script = fs.readFileSync(path.join(root, "classic.js"), "utf8");

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, "4.0.0");
assert.ok(manifest.permissions.includes("downloads"));
assert.ok(manifest.permissions.includes("offscreen"));
assert.ok(manifest.permissions.includes("sidePanel"));
assert.equal(manifest.side_panel.default_path, "sidepanel.html");
assert.equal(manifest.background.service_worker, "background.js");
assert.ok(manifest.permissions.includes("scripting"));
assert.ok(manifest.host_permissions.includes("https://app.base44.com/*"));
for (const id of ["appId", "batchIds", "compareBtn", "downloadBtn", "diagnosticsBtn", "paths"]) {
  assert.ok(popup.includes(`id="${id}"`), `classic recovery page missing ${id}`);
}
for (const marker of ["enrichRecoveryFiles", "MISSING-FILES-REPORT.md", "DEPENDENCY-RECOVERY.md", "PROJECT-STRUCTURE.md", "comparePreviousExport", "hashInventory"]) {
  assert.ok(script.includes(marker), `classic recovery script missing ${marker}`);
}
assert.ok(fs.existsSync(path.join(root, "SECURITY.md")));
assert.ok(fs.existsSync(path.join(root, "CODE_OF_CONDUCT.md")));
assert.ok(fs.existsSync(path.join(root, "CONTRIBUTING.md")));


const vm = require("node:vm");
const helperStart = script.indexOf("function toBytes(value)");
assert.notEqual(helperStart, -1);
const context = { TextEncoder, Uint8Array, Uint32Array, DataView, atob: (s) => Buffer.from(s, "base64").toString("binary") };
vm.runInNewContext(script.slice(helperStart) + "\nglobalThis.__zip = {createZip, verifyStoredZip};", context);
const zip = context.__zip.createZip({"src/App.tsx":"export default 1;", "public/logo.svg":"<svg/>"});
const checked = context.__zip.verifyStoredZip(zip);
assert.equal(checked.ok, true);
assert.equal(checked.entries, 2);
const corrupted = zip.slice();
corrupted[42] ^= 1;
assert.equal(context.__zip.verifyStoredZip(corrupted).ok, false);

(async () => {
  const recoveryContext = {};
  vm.runInNewContext(script.slice(script.indexOf("async function enrichRecoveryFiles")), recoveryContext);
  const recovered = await recoveryContext.enrichRecoveryFiles({
    "package.json": JSON.stringify({dependencies:{react:"^18.0.0"}}),
    "src/App.tsx": "import React from 'react';\\nimport Logo from './assets/logo.svg';",
    "public/logo.png": "fake-image-payload"
  }, "test-project-123");
  assert.ok(recovered.files["PROJECT-STRUCTURE.md"].includes("src/App.tsx"));
  assert.ok(recovered.files["BASE44-RECOVERY-REPORT.json"].includes("public/logo.png"));
  assert.ok(recovered.files["MISSING-FILES-REPORT.md"].includes("./assets/logo.svg"));
  assert.ok(recovered.files["REACT-TYPESCRIPT-RECOVERY.md"]);
  assert.ok(recovered.files["REACT-TYPESCRIPT-RECOVERY.md"].includes("TypeScript source detected: yes"));
  assert.ok(recovered.files["REACT-TYPESCRIPT-RECOVERY.md"].includes("React source detected: yes"));
  assert.ok(recovered.files["REPAIR-PLAN.md"].includes("\n"));
  console.log("Base44 Toolkit 4.0.0 manifest, legacy recovery and static-analysis smoke checks passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
