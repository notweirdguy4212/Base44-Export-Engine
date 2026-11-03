/**
 * Deliberately conservative restore adapter contract.
 * No adapter is registered until Base44 documents a supported import/write API.
 */
export class RestoreAdapter {
  get capabilities() { return { supported: false, mode: 'unavailable' }; }
  async inspect() { throw new Error('RestoreAdapter.inspect() must be implemented by a verified platform adapter.'); }
  async preview() { throw new Error('RestoreAdapter.preview() must be implemented by a verified platform adapter.'); }
  async restore() { throw new Error('Restore is disabled: no supported Base44 write/import adapter is installed.'); }
  async verify() { throw new Error('RestoreAdapter.verify() must be implemented by a verified platform adapter.'); }
}

export function getRestoreAdapter() {
  return null;
}

export function getRestoreAvailability() {
  return {
    supported: false,
    status: 'awaiting-official-import-interface',
    message: 'No documented Base44 write/import interface is configured. Remote restore remains disabled.'
  };
}
