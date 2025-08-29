/**
 * Drag Performance Service
 *
 * Optimizes drag operations by throttling updates to reduce database load
 * and improve user experience during timeline interactions.
 */

let lastDragUpdateTime = 0;
let dragUpdateQueue: (() => Promise<void>)[] = [];
let isProcessingQueue = false;

/**
 * Throttled drag update function
 * Queues drag operations and processes them at optimal intervals
 */
export function throttledDragUpdate(
  updateFunction: () => Promise<void>,
  throttleMs: number = 100
): void {
  const now = Date.now();

  // Add to queue
  dragUpdateQueue.push(updateFunction);

  // Only process if enough time has passed
  if (now - lastDragUpdateTime >= throttleMs && !isProcessingQueue) {
    processQueue();
  }
}

/**
 * Process the drag update queue
 * Executes the latest update and handles any queued operations
 */
async function processQueue(): Promise<void> {
  if (isProcessingQueue || dragUpdateQueue.length === 0) return;

  isProcessingQueue = true;
  lastDragUpdateTime = Date.now();

  // Get the latest update (discard older ones for better performance)
  const latestUpdate = dragUpdateQueue[dragUpdateQueue.length - 1];
  dragUpdateQueue = [];

  try {
    await latestUpdate();
  } catch (error) {
    console.error('Drag update error:', error);
  } finally {
    isProcessingQueue = false;

    // Process any new updates that came in while we were busy
    if (dragUpdateQueue.length > 0) {
      setTimeout(processQueue, 16); // Next frame
    }
  }
}

/**
 * Clear the drag update queue
 * Useful for cleanup or when drag operations are cancelled
 */
export function clearDragQueue(): void {
  dragUpdateQueue = [];
  isProcessingQueue = false;
}

/**
 * Get current drag queue status
 * Useful for debugging and performance monitoring
 */
export function getDragQueueStatus(): {
  queueLength: number;
  isProcessing: boolean;
  lastUpdateTime: number;
} {
  return {
    queueLength: dragUpdateQueue.length,
    isProcessing: isProcessingQueue,
    lastUpdateTime: lastDragUpdateTime
  };
}
