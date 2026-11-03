import assert from 'node:assert/strict';
import { getRestoreAdapter, getRestoreAvailability, RestoreAdapter } from '../lib/restore-adapter.js';
assert.equal(getRestoreAdapter(), null);
assert.equal(getRestoreAvailability().supported, false);
await assert.rejects(() => new RestoreAdapter().restore(), /no supported Base44 write\/import adapter/);
console.log('Restore safety-gate checks passed.');
