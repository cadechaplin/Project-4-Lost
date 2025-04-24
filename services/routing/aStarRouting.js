/**
 * A* algorithm implementation for path finding
 */

import { getSeattleGraph } from "../graphCache.js";
import {
  findClosestNode,
  heuristicDistance,
  convertAStarToOSRMFormat,
} from "./graphUtils.js";
import { CustomPriorityQueue } from "./common.js";
import { fallbackGridBasedAStar } from "./gridRouting.js";
import { calculateHaversineDistance } from "../geoUtils.js";

/**
 * Calculate a path between two points using the A* algorithm with real street data
 *
 * @param {Object} start - Starting point {lat, lng}
 * @param {Object} end - Ending point {lat, lng}
 * @param {Object} bounds - Geographic bounds to constrain the search area
 * @param {Object} options - Optional parameters
 * @returns {Object} A* route data in standardized format
 */
export async function calculateAStarPath(
  start,
  end,
  bounds,
  options = { gridSize: 100 }
) {
  console.log("A* calculation starting with:", { start, end, options });

  try {
    // Step 1: Get the cached Seattle graph
    const graph = await getSeattleGraph(bounds);

    // Step 2: Find closest nodes to start and end points
    const startNode = findClosestNode(graph, start);
    const endNode = findClosestNode(graph, end);

    console.log("Found nodes:", {
      startNode: startNode
        ? { id: startNode.id, lat: startNode.lat, lng: startNode.lng }
        : null,
      endNode: endNode
        ? { id: endNode.id, lat: endNode.lat, lng: endNode.lng }
        : null,
    });

    if (!startNode || !endNode) {
      console.warn(
        "Could not find suitable road nodes near the selected points"
      );
      throw new Error(
        "Could not find suitable road nodes near the selected points"
      );
    }

    // Step 3: Run A* algorithm on the street graph
    const result = runAStarOnStreetGraph(graph, startNode, endNode);
    console.log(
      `A* result: ${result.path.length} points, ${result.nodesExplored} nodes explored`
    );

    // Check if we got a valid result
    if (result && result.path && result.path.length >= 3) {
      console.log("Using A* result with street data");
      return convertAStarToOSRMFormat(result);
    } else {
      console.warn(
        "A* street search produced insufficient path, falling back to grid"
      );
      throw new Error("A* found a too-short path");
    }
  } catch (error) {
    console.error("Error in A* with street data:", error);
    console.log("Falling back to grid-based A*");

    const gridResult = await fallbackGridBasedAStar(start, end, bounds, {
      gridSize: Math.max(options.gridSize, 500),
    });

    return convertAStarToOSRMFormat(gridResult);
  }
}

/**
 * Run A* search algorithm on a street graph
 *
 * @param {Array} graph - Array of nodes from buildStreetGraph
 * @param {Object} startNode - Starting node from the graph
 * @param {Object} endNode - Ending node from the graph
 * @returns {Object} Path and metrics from the A* algorithm
 */
export function runAStarOnStreetGraph(graph, startNode, endNode) {
  // Create a map for faster node lookup by ID
  const nodeMap = {};
  for (const node of graph) {
    nodeMap[node.id] = node;
  }

  console.log(`Created node map with ${Object.keys(nodeMap).length} entries`);
  console.log(`Start node: ${startNode.id}, End node: ${endNode.id}`);

  // Initialize A* data structures
  const openSet = new CustomPriorityQueue((a, b) => a.f - b.f);
  const closedSet = new Set();
  const cameFrom = {}; // Track path
  const gScore = {}; // Cost from start to current node
  const fScore = {}; // Estimated total cost (g + heuristic)

  // Initialize with start node
  gScore[startNode.id] = 0;
  fScore[startNode.id] = heuristicDistance(startNode, endNode);
  openSet.enqueue({ id: startNode.id, f: fScore[startNode.id] });

  // Track statistics
  let nodesExplored = 0;
  let maxIterations = 10000000; // Prevent infinite loops
  let iterations = 0;

  // Track all explored nodes for visualization
  const exploredNodes = [];

  // Main A* algorithm loop
  while (!openSet.isEmpty() && iterations < maxIterations) {
    iterations++;
    const current = openSet.dequeue();
    nodesExplored++;

    // Get the current node from our map
    const currentNode = nodeMap[current.id];

    if (!currentNode) {
      console.error(`Node ${current.id} not found in nodeMap`);
      continue; // Skip this iteration if node not found
    }

    // Add to explored nodes list (for visualization)
    exploredNodes.push({
      lat: currentNode.lat,
      lng: currentNode.lng,
    });

    // Check if we've reached the end node
    if (current.id === endNode.id) {
      console.log(
        `Path found! Explored ${nodesExplored} nodes in ${iterations} iterations`
      );

      // Build result with path, distance, and stats
      const pathNodes = [];
      let currentId = current.id;

      // Reconstruct path using the cameFrom links
      while (currentId !== startNode.id) {
        const node = nodeMap[currentId];
        if (!node) {
          console.error(`Missing node in path reconstruction: ${currentId}`);
          break;
        }
        pathNodes.unshift({ lat: node.lat, lng: node.lng });
        currentId = cameFrom[currentId];
      }

      // Add starting node as the first point
      pathNodes.unshift({ lat: startNode.lat, lng: startNode.lng });

      // Calculate path distance by summing distances between points
      let distance = 0;
      for (let i = 1; i < pathNodes.length; i++) {
        distance += calculateHaversineDistance(pathNodes[i - 1], pathNodes[i]);
      }

      return {
        path: pathNodes,
        distance: distance,
        nodesExplored: nodesExplored,
        exploredNodesList: exploredNodes,
      };
    }

    // Mark current node as visited
    closedSet.add(current.id);

    // Process all connections from current node
    for (const connection of currentNode.connections) {
      const neighborId = connection.nodeId;

      // Skip if we've already explored this node
      if (closedSet.has(neighborId)) continue;

      // Get the neighbor node
      const neighborNode = nodeMap[neighborId];
      if (!neighborNode) {
        console.warn(`Missing neighbor node: ${neighborId}`);
        continue;
      }

      // Calculate new path score (g score)
      const tentativeGScore = gScore[current.id] + connection.distance;

      // If this path is better than any previous one to this neighbor
      if (!gScore[neighborId] || tentativeGScore < gScore[neighborId]) {
        // Record this path as best
        cameFrom[neighborId] = current.id;
        gScore[neighborId] = tentativeGScore;

        // Calculate f-score (g + heuristic)
        const h = heuristicDistance(neighborNode, endNode);
        fScore[neighborId] = tentativeGScore + h;

        // Add to open set if not there already
        if (!openSet.toArray().some((item) => item.id === neighborId)) {
          openSet.enqueue({ id: neighborId, f: fScore[neighborId] });
        }
      }
    }
  }

  // If we get here, no path was found
  console.warn(
    `No path found after exploring ${nodesExplored} nodes in ${iterations} iterations`
  );
  return {
    path: [],
    distance: 0,
    nodesExplored: nodesExplored,
    exploredNodesList: exploredNodes,
  };
}
