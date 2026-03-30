// Global throttle for profile picture requests
// Limits to 1 concurrent request with max 3 in queue

let activeRequests = 0;
const MAX_CONCURRENT = 1;
const MAX_QUEUE = 3;
const queue: Array<{ resolve: (v: any) => void; reject: (e: any) => void; fn: () => Promise<any> }> = [];

function processQueue() {
  while (activeRequests < MAX_CONCURRENT && queue.length > 0) {
    const item = queue.shift()!;
    activeRequests++;
    item.fn()
      .then(item.resolve)
      .catch(item.reject)
      .finally(() => {
        activeRequests--;
        processQueue();
      });
  }
}

export function throttledProfilePicture<T>(fn: () => Promise<T>): Promise<T> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++;
    return fn().finally(() => {
      activeRequests--;
      processQueue();
    });
  }
  
  if (queue.length >= MAX_QUEUE) {
    // Drop request - too many pending
    return Promise.resolve(null as any);
  }
  
  return new Promise<T>((resolve, reject) => {
    queue.push({ resolve, reject, fn });
  });
}
