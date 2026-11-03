import assert from 'node:assert/strict';
import { analyzeProjectFiles } from '../lib/analyzer.js';

const result = analyzeProjectFiles({
  'package.json': JSON.stringify({ name: 'sample', dependencies: { react: '^19.0.0' } }),
  'src/App.tsx': "import React from 'react';\nimport Button from './components/Button';\nimport dayjs from 'dayjs';",
  'src/styles.css': '.logo { background: url(../assets/logo.svg) }',
  'assets/logo.svg': '<svg/>',
  'tsconfig.json': '{}'
}, 'sample-project-123');
assert.equal(result.report.fileCount, 5);
assert.ok(result.report.undeclaredPackages.includes('dayjs'));
assert.ok(result.report.missingReferences.some(item => item.ref === './components/Button'));
assert.ok(result.generatedFiles['PROJECT-STRUCTURE.md'].includes('src/App.tsx'));
assert.ok(result.generatedFiles['DEPENDENCY-RECOVERY.md'].includes('dayjs'));
console.log('Project analysis checks passed.');
