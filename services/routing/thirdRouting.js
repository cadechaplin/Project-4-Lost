/**
 * Third routing algorithm implementation
 * (Dijkstra-based, no heuristic)
 */

import { getSeattleGraph } from "../graphCache.js";
import { findClosestNode, convertAStarToOSRMFormat } from "./graphUtils.js";
import { CustomPriorityQueue } from "./common.js";
import { fallbackGridBasedAStar } from "./gridRouting.js";
import { calculateHaversineDistance } from "../geoUtils.js";

/**
 * Calculate a path between two points using a third route algorithm
 * Currently uses Dijkstra's algorithm (no heuristic)
 *
 * @param {Object} start - Starting point {lat, lng}
 * @param {Object} end - Ending point {lat, lng}
 * @param {Object} bounds - Geographic bounds to constrain the search area
 * @param {Object} options - Optional parameters
 * @returns {Object} Route data in standardized format
 */
export async function calculateThirdRoute(
  start,
  end,
  bounds,
  options = { gridSize: 100 }
) {
  console.log("Third route calculation starting with:", {
    start,
    end,
    options,
  });

  try {
    // Step 1: Get the cached Seattle graph
    const graph = await getSeattleGraph(bounds);

    // Step 2: Find closest nodes to start and end points
    const startNode = findClosestNode(graph, start);
    const endNode = findClosestNode(graph, end);

    console.log("Found nodes:", { startNode, endNode });

    if (!startNode || !endNode) {
      console.warn(
        "Could not find suitable road nodes near the selected points"
      );
      throw new Error("Could not find suitable road nodes");
    }

    // Step 3: Run Dijkstra's algorithm on the street graph
    try {
      const result = runAStarOnStreetGraph3(graph, startNode, endNode);
      console.log(
        `Third route result: ${result.path.length} points, ${result.nodesExplored} nodes explored`
      );

      // Check if we got a valid result
      if (result && result.path && result.path.length >= 3) {
        console.log("Using third route result with street data");
        return convertAStarToOSRMFormat(result);
      } else {
        console.warn(
          `Third route search failed: Path is too short (${
            result.path?.length || 0
          } points)`
        );
        throw new Error(
          `Third route failed: Path too short (${
            result.path?.length || 0
          } points)`
        );
      }
    } catch (error) {
      console.error("Error in runAStarOnStreetGraph3:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error in third route calculation:", error);
    console.log("Falling back to grid-based A*");
    const gridResult = await fallbackGridBasedAStar(start, end, bounds, {
      gridSize: Math.max(options.gridSize, 500),
    });
    return convertAStarToOSRMFormat(gridResult);
  }
}

/**
 * Run Dijkstra's algorithm on a street graph
 * This is a modified version of A* without a heuristic
 *
 * @param {Array} graph - Array of nodes from buildStreetGraph
 * @param {Object} startNode - Starting node from the graph
 * @param {Object} endNode - Ending node from the graph
 * @returns {Object} Path and metrics from the algorithm
 */
export function runAStarOnStreetGraph3(graph, startNode, endNode) {
  // Create a map for faster node lookup by ID
  const nodeMap = {};
  for (const node of graph) {
    nodeMap[node.id] = node;
  }

  console.log(`Created node map with ${Object.keys(nodeMap).length} entries`);
  console.log(`Start node: ${startNode.id}, End node: ${endNode.id}`);

  // Better verification of graph integrity
  if (!nodeMap[startNode.id]) {
    console.error(`Start node ${startNode.id} not in node map!`);
  }
  if (!nodeMap[endNode.id]) {
    console.error(`End node ${endNode.id} not in node map!`);
  }

  // Initialize Dijkstra's data structures (no heuristic)
  const openSet = new CustomPriorityQueue((a, b) => a.g - b.g); // Use gScore only
  const closedSet = new Set();
  const cameFrom = {}; // Track path
  const gScore = {}; // Cost from start to current node

  // Initialize with start node
  gScore[startNode.id] = 0;
  openSet.enqueue({ id: startNode.id, g: gScore[startNode.id] });

  // Track statistics
  let nodesExplored = 0;
  let iterations = 0;

  // Track all explored nodes for visualization
  const exploredNodes = [];

  // Main Dijkstra's algorithm loop - no iteration limit to ensure it runs until a path is found
  while (!openSet.isEmpty()) {
    iterations++;
    const current = openSet.dequeue();
    nodesExplored++;

    // Log progress periodically
    if (iterations % 1000 === 0) {
      console.log(`Iteration ${iterations}, explored ${nodesExplored} nodes`);
    }

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

      // Robust path reconstruction to handle potential issues
      try {
        // Reconstruct path using the cameFrom links
        while (currentId !== startNode.id) {
          const node = nodeMap[currentId];
          if (!node) {
            console.error(`Missing node in path reconstruction: ${currentId}`);
            // Instead of breaking, we'll try to continue
            currentId = cameFrom[currentId];
            if (!currentId) break; // Only break if truly stuck
            continue;
          }
          pathNodes.unshift({ lat: node.lat, lng: node.lng });
          currentId = cameFrom[currentId];
          if (!currentId && currentId !== startNode.id) {
            console.error("Path reconstruction broken: missing parent node");
            break;
          }
        }
      } catch (error) {
        console.error("Error during path reconstruction:", error);
      }

      // Always add starting node as the first point
      pathNodes.unshift({ lat: startNode.lat, lng: startNode.lng });

      // If the path is too short, add the end point directly
      if (pathNodes.length < 2) {
        pathNodes.push({ lat: endNode.lat, lng: endNode.lng });
      }

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

        // Add to open set if not there already
        if (!openSet.toArray().some((item) => item.id === neighborId)) {
          openSet.enqueue({ id: neighborId, g: gScore[neighborId] });
        }
      }
    }
  }

  // If we get here, the openSet is empty but we still didn't find a path
  console.warn(`OpenSet exhausted after ${iterations} iterations`);
  console.warn("Creating direct fallback path instead");

  // Create a direct path as a last resort
  const directPath = [
    { lat: startNode.lat, lng: startNode.lng },
    { lat: endNode.lat, lng: endNode.lng },
  ];

  const directDistance = calculateHaversineDistance(
    { lat: startNode.lat, lng: startNode.lng },
    { lat: endNode.lat, lng: endNode.lng }
  );

  return {
    path: directPath,
    distance: directDistance,
    nodesExplored: nodesExplored,
    exploredNodesList: exploredNodes,
  };
}
