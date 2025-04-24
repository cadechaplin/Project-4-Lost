/**
 * Grid-based fallback routing algorithm implementation
 */

import { calculateHaversineDistance } from "../geoUtils.js";
import { CustomPriorityQueue } from "./common.js";

/**
 * Fallback grid-based A* algorithm when street data is insufficient
 * Creates a grid over the area and runs A* on it
 *
 * @param {Object} start - Starting point {lat, lng}
 * @param {Object} end - Ending point {lat, lng}
 * @param {Object} bounds - Geographic bounds
 * @param {Object} options - Algorithm options
 * @returns {Object} Path and metrics from the grid-based A* algorithm
 */
export async function fallbackGridBasedAStar(start, end, bounds, options) {
  console.log("Using fallback grid-based A* with grid size:", options.gridSize);

  // Use a higher grid size for better resolution
  const gridSize = Math.max(options.gridSize, 500); // At least 500x500 grid

  console.log(`Using ${gridSize}x${gridSize} grid for fallback A*`);

  // Step 1: Create a grid over the area
  const latStep = (bounds.north - bounds.south) / gridSize;
  const lngStep = (bounds.east - bounds.west) / gridSize;

  console.log(
    `Grid cells are ${latStep.toFixed(6)}° lat x ${lngStep.toFixed(6)}° lng`
  );

  // Step 2: Convert lat/lng to grid coordinates
  const startGrid = {
    x: Math.floor((start.lng - bounds.west) / lngStep),
    y: Math.floor((start.lat - bounds.south) / latStep),
  };

  const endGrid = {
    x: Math.floor((end.lng - bounds.west) / lngStep),
    y: Math.floor((end.lat - bounds.south) / latStep),
  };

  console.log("Grid coordinates:", { startGrid, endGrid });

  // Step 3: Initialize A* algorithm data structures
  const openSet = new CustomPriorityQueue((a, b) => a.f - b.f);
  const closedSet = new Set();
  const cameFrom = {};
  const gScore = {};
  const fScore = {};

  // Use string keys for grid cells: "x,y"
  const startKey = `${startGrid.x},${startGrid.y}`;
  const endKey = `${endGrid.x},${endGrid.y}`;

  gScore[startKey] = 0;
  fScore[startKey] = heuristic(startGrid, endGrid);

  openSet.enqueue({
    key: startKey,
    x: startGrid.x,
    y: startGrid.y,
    f: fScore[startKey],
  });

  let nodesExplored = 0;

  // Step 4: Run A* algorithm on grid
  while (!openSet.isEmpty()) {
    const current = openSet.dequeue();
    nodesExplored++;

    // Check if reached the goal
    if (current.key === endKey) {
      const path = reconstructGridPath(cameFrom, current.key, startKey);
      console.log(`Grid path found with ${path.length} points`);

      // Step 5: Convert grid coordinates back to lat/lng with interpolation
      const latLngPath = [];

      // Add exact start point
      latLngPath.push({
        lat: start.lat,
        lng: start.lng,
      });

      // Add intermediate points from grid cells
      for (let i = 1; i < path.length - 1; i++) {
        const [x, y] = path[i].split(",").map(Number);
        latLngPath.push({
          lat: bounds.south + y * latStep + latStep / 2, // Center of grid cell
          lng: bounds.west + x * lngStep + lngStep / 2,
        });
      }

      // Add exact end point
      latLngPath.push({
        lat: end.lat,
        lng: end.lng,
      });

      console.log(`Converted to ${latLngPath.length} lat/lng points`);

      // Calculate path distance
      let distance = 0;
      for (let i = 1; i < latLngPath.length; i++) {
        distance += calculateHaversineDistance(
          latLngPath[i - 1],
          latLngPath[i]
        );
      }

      return {
        path: latLngPath,
        distance: distance,
        nodesExplored: nodesExplored,
      };
    }

    // Mark current cell as visited
    closedSet.add(current.key);

    // Get neighboring grid cells
    const neighbors = getNeighbors(current.x, current.y, gridSize);

    // Process each neighbor
    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x},${neighbor.y}`;

      // Skip if already visited
      if (closedSet.has(neighborKey)) continue;

      // Calculate tentative gScore (using uniform cost for simplicity)
      const tentativeGScore = gScore[current.key] + 1;

      // If this path is better than any previous one
      if (!gScore[neighborKey] || tentativeGScore < gScore[neighborKey]) {
        // Record this path as best
        cameFrom[neighborKey] = current.key;
        gScore[neighborKey] = tentativeGScore;
        fScore[neighborKey] =
          gScore[neighborKey] + heuristic(neighbor, endGrid);

        // Add to open set if not there already
        if (!openSet.toArray().some((item) => item.key === neighborKey)) {
          openSet.enqueue({
            key: neighborKey,
            x: neighbor.x,
            y: neighbor.y,
            f: fScore[neighborKey],
          });
        }
      }
    }
  }

  // No path found
  return {
    path: [],
    distance: 0,
    nodesExplored: nodesExplored,
  };
}

/**
 * Get neighboring cells in the grid
 *
 * @param {number} x - Current cell x coordinate
 * @param {number} y - Current cell y coordinate
 * @param {number} gridSize - Size of the grid
 * @returns {Array} Array of neighboring cell coordinates
 */
function getNeighbors(x, y, gridSize) {
  const neighbors = [];
  // Include both cardinal and diagonal directions (8-way movement)
  const directions = [
    { dx: 0, dy: 1 }, // up
    { dx: 1, dy: 0 }, // right
    { dx: 0, dy: -1 }, // down
    { dx: -1, dy: 0 }, // left
    { dx: 1, dy: 1 }, // up-right
    { dx: 1, dy: -1 }, // down-right
    { dx: -1, dy: -1 }, // down-left
    { dx: -1, dy: 1 }, // up-left
  ];

  // Check each direction
  for (const dir of directions) {
    const nx = x + dir.dx;
    const ny = y + dir.dy;

    // Ensure we stay within grid bounds
    if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
      neighbors.push({ x: nx, y: ny });
    }
  }

  return neighbors;
}

/**
 * Heuristic function for grid-based A*
 * Uses Manhattan distance for simplicity
 *
 * @param {Object} a - Current grid cell {x, y}
 * @param {Object} b - Goal grid cell {x, y}
 * @returns {number} Estimated distance in grid cells
 */
function heuristic(a, b) {
  // Manhattan distance
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Reconstruct path specifically for grid-based A*
 *
 * @param {Object} cameFrom - Map of grid cell keys to their predecessors
 * @param {string} current - Current grid cell key
 * @param {string} start - Start grid cell key
 * @returns {Array} Path as array of grid cell keys
 */
function reconstructGridPath(cameFrom, current, start) {
  const path = [current];
  while (current !== start) {
    current = cameFrom[current];
    path.unshift(current);
  }
  return path;
}
