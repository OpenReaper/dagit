export type HashProgress = { processed: number; total: number };
export type LocalHash = { digest: `0x${string}`; byteLength: number };

export function hashFileLocally(file: File, onProgress: (progress: HashProgress) => void): { promise: Promise<LocalHash>; cancel: () => void } {
  const worker = new Worker(new URL('../hash-worker.ts', import.meta.url), { type: 'module' });
  const promise = new Promise<LocalHash>((resolve, reject) => {
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') onProgress({ processed: data.processed, total: data.total });
      if (data.type === 'complete') { worker.terminate(); resolve({ digest: data.digest, byteLength: data.byteLength }); }
      if (data.type === 'error') { worker.terminate(); reject(new Error(data.message)); }
    };
    worker.onerror = () => { worker.terminate(); reject(new Error('Local hashing worker failed.')); };
    worker.postMessage({ type: 'hash', file });
  });
  return { promise, cancel: () => { worker.postMessage({ type: 'cancel' }); } };
}
