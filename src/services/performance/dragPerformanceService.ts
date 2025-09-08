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

  // For performance optimization: only keep the latest update in queue
  // This prevents queue buildup during fast drag operations
  dragUpdateQueue = [updateFunction]; // Replace entire queue with latest update

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

/**
 * Visual drag state management for performance optimization
 */
let lastVisualUpdateTime = 0;
let pendingVisualUpdate: ReturnType<typeof setTimeout> | null = null;

/**
 * Throttled visual state update for drag operations
 * Prevents excessive React re-renders during smooth drag movements
 */
export function throttledVisualUpdate(
  updateFunction: () => void,
  timelineMode: 'days' | 'weeks'
): void {
  const now = performance.now();
  const throttleMs = timelineMode === 'weeks' ? 16 : 8; // 60fps for weeks, 120fps for days
  const timeSinceLastUpdate = now - lastVisualUpdateTime;

  // Clear any pending update
  if (pendingVisualUpdate) {
    clearTimeout(pendingVisualUpdate);
  }

  if (timeSinceLastUpdate >= throttleMs) {
    // Execute immediately if enough time has passed
    lastVisualUpdateTime = now;
    updateFunction();
  } else {
    // Schedule for next available slot
    const delay = throttleMs - timeSinceLastUpdate;
    pendingVisualUpdate = setTimeout(() => {
      lastVisualUpdateTime = performance.now();
      updateFunction();
      pendingVisualUpdate = null;
    }, delay);
  }
}
