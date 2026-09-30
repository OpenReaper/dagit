import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

type HashRequest = { type: 'hash'; file: File } | { type: 'cancel' };
let cancelled = false;

self.onmessage = async ({ data }: MessageEvent<HashRequest>) => {
  if (data.type === 'cancel') { cancelled = true; return; }
  cancelled = false;
  try {
    const hasher = sha256.create();
    const reader = data.file.stream().getReader();
    let processed = 0;
    while (true) {
      if (cancelled) throw new Error('Hashing cancelled.');
      const { done, value } = await reader.read();
      if (done) break;
      hasher.update(value);
      processed += value.byteLength;
      self.postMessage({ type: 'progress', processed, total: data.file.size });
    }
    self.postMessage({ type: 'complete', digest: `0x${bytesToHex(hasher.digest())}`, byteLength: data.file.size });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Local hashing failed.' });
  }
};
