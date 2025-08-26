/**
 * Simple drag performance optimizer
 * Throttles drag operations to reduce database load
 */

let lastDragUpdateTime = 0;
let dragUpdateQueue: (() => Promise<void>)[] = [];
let isProcessingQueue = false;

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

export function clearDragQueue(): void {
  dragUpdateQueue = [];
  isProcessingQueue = false;
}
