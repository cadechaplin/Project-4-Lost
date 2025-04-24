/**
 * Common utilities used across routing algorithms
 */

/**
 * Custom priority queue implementation for A* algorithm
 */
export class CustomPriorityQueue {
  constructor(comparator) {
    this.values = [];
    this.comparator = comparator; // Function to compare items (f-scores)
  }

  enqueue(element) {
    this.values.push(element);
    this.sort(); // Resort the queue
  }

  dequeue() {
    return this.values.shift(); // Remove and return first (lowest) element
  }

  sort() {
    this.values.sort(this.comparator);
  }

  isEmpty() {
    return this.values.length === 0;
  }

  toArray() {
    return [...this.values];
  }
}
