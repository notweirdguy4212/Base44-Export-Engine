const SOURCE_RE = /\.(?:jsx?|tsx?|mjs|cjs|css|scss|html)$/i;
const ASSET_RE = /\.(?:png|jpe?g|gif|webp|svg|ico|avif|woff2?|ttf|otf|mp4|webm|mp3|wav|pdf)$/i;

export function analyzeProjectFiles(files, projectId) {
  const paths = Object.keys(files).map(path => path.replace(/\\/g, '/')).filter(Boolean).sort();
  const pathSet = new Set(paths);
  const sourcePaths = paths.filter(path => SOURCE_RE.test(path));
  const assets = paths.filter(path => ASSET_RE.test(path));
  const packageImports = new Set();
  const references = [];

  for (const path of sourcePaths) {
    const source = String(files[path] ?? '');
    if (source.startsWith('data:')) continue;
    const importPattern = /(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*["']([^"']+)["']/g;
    let match;
    while ((match = importPattern.exec(source))) {
      const ref = match[1];
      if (ref.startsWith('.') || ref.startsWith('@/')) references.push({ from: path, ref });
      else if (!ref.startsWith('/') && !ref.startsWith('node:') && !/^(https?:|data:)/i.test(ref)) {
        packageImports.add(ref.startsWith('@') ? ref.split('/').slice(0, 2).join('/') : ref.split('/')[0]);
      }
    }
    const cssPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/g;
    while ((match = cssPattern.exec(source))) {
      const ref = match[1];
      if (ref && !/^(?:data:|https?:|#)/i.test(ref)) references.push({ from: path, ref });
    }
  }

  const missing = [];
  for (const item of references) {
    const clean = item.ref.split(/[?#]/)[0].replace(/\\/g, '/');
    const base = item.from.includes('/') ? item.from.slice(0, item.from.lastIndexOf('/') + 1) : '';
    const candidate = clean.startsWith('@/') ? clean.slice(2) : `${base}${clean}`;
    const candidates = [candidate, `${candidate}.ts`, `${candidate}.tsx`, `${candidate}.js`, `${candidate}.jsx`, `${candidate}.json`, `${candidate}/index.ts`, `${candidate}/index.tsx`, `${candidate}/index.js`, `${candidate}/index.jsx`];
    if (!candidates.some(value => pathSet.has(value))) missing.push({ ...item, candidates: candidates.slice(0, 5) });
  }

  let packageJson = {};
  try { packageJson = JSON.parse(String(files['package.json'] ?? '{}')); } catch {}
  const declared = new Set([
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.devDependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {})
  ]);
  const undeclared = [...packageImports].filter(name => !declared.has(name)).sort();
  const lockfiles = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'bun.lock'].filter(path => pathSet.has(path));
  const configs = paths.filter(path => /^(?:tsconfig(?:\..+)?\.json|vite\.config\.|webpack\.config\.|next\.config\.|eslint\.config\.|\.eslintrc|postcss\.config\.|tailwind\.config\.)/.test(path));
  const hasTypeScript = paths.some(path => /\.tsx?$/i.test(path));
  const hasReact = paths.some(path => /\.(?:jsx|tsx)$/i.test(path)) || packageImports.has('react');
  const configurationGaps = [];
  if (hasTypeScript && !pathSet.has('tsconfig.json')) configurationGaps.push('TypeScript files exist but tsconfig.json was not found.');
  if (hasReact && !pathSet.has('package.json')) configurationGaps.push('React-like source exists but package.json was not found.');
  const directories = [...new Set(paths.map(path => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '(root)'))].sort();
  const extensions = [...new Set(paths.map(path => { const name = path.split('/').pop(); return name.includes('.') ? `.${name.split('.').pop()}` : '(no extension)'; }))].sort();
  const report = {
    projectId, generatedAt: new Date().toISOString(), fileCount: paths.length,
    sourceFileCount: sourcePaths.length, assetFiles: assets,
    missingReferences: missing, importedPackages: [...packageImports].sort(),
    undeclaredPackages: undeclared, packageManager: lockfiles[0] || 'not detected',
    lockfiles, configurationFiles: configs, configurationGaps,
    structure: { directories, extensions }
  };
  const structureMarkdown = `# Reconstructed project structure\n\n${paths.map(path => `- \`${path}\``).join('\n')}\n`;
  const missingMarkdown = `# Missing file reference scan\n\n${missing.length ? missing.map(item => `- From \`${item.from}\`: \`${item.ref}\` (not found in the exported paths)`).join('\n') : 'No unresolved relative imports or CSS url() references were detected.'}\n\nA missing reference may be generated at build time, resolved through an alias, or intentionally external. Review before treating it as confirmed missing content.\n`;
  const dependencyMarkdown = `# Dependency and configuration review\n\n- Package: ${packageJson.name || 'not declared'}\n- Package manager: ${report.packageManager}\n\n## Declared dependencies\n\n${[...declared].sort().map(name => `- \`${name}\``).join('\n') || 'No package dependencies declared.'}\n\n## Imported packages not declared\n\n${undeclared.map(name => `- \`${name}\` — verify compatibility and add a deliberate version`).join('\n') || 'No undeclared imports detected by static scan.'}\n\n## Configuration files\n\n${configs.map(name => `- \`${name}\``).join('\n') || 'No common build configuration files detected.'}\n\nThis scan does not query registries, select versions or install packages.\n`;
  const typescriptMarkdown = `# React and TypeScript recovery review\n\n- TypeScript source detected: ${hasTypeScript ? 'yes' : 'no'}\n- React source detected: ${hasReact ? 'yes' : 'no'}\n\n${configurationGaps.map(item => `- ${item}`).join('\n') || 'No obvious React/TypeScript configuration gap was detected by filename scan.'}\n\nDo not fabricate configuration. Recover original compiler and bundler settings from source control or a trusted backup; otherwise recreate them for the actual build pipeline and validate with a production build.\n`;
  const repairMarkdown = `# Recovery and repair plan\n\n1. Review MISSING-FILES-REPORT.md and confirm unresolved references.\n2. Review DEPENDENCY-RECOVERY.md and install only compatible package versions.\n3. Recover original TypeScript and build configuration from source control or a trusted backup.\n4. Restore missing assets from an independently verified source.\n5. Run type-checks, tests and a production build.\n6. Preserve this archive as an immutable recovery checkpoint.\n\nThe extension does not fabricate missing source/configuration or write files back to Base44.\n`;
  return {
    report,
    generatedFiles: {
      'BASE44-RECOVERY-REPORT.json': JSON.stringify(report, null, 2),
      'PROJECT-STRUCTURE.md': structureMarkdown,
      'MISSING-FILES-REPORT.md': missingMarkdown,
      'DEPENDENCY-RECOVERY.md': dependencyMarkdown,
      'REACT-TYPESCRIPT-RECOVERY.md': typescriptMarkdown,
      'REPAIR-PLAN.md': repairMarkdown
    }
  };
}
