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

// Seattle landmark nodes for the landmark-based heuristic
const SEATTLE_LANDMARKS = [
  // Downtown Seattle
  { id: "downtown", lat: 47.6062, lng: -122.3321 },
  // University of Washington
  { id: "uw", lat: 47.6553, lng: -122.3035 },
  // Space Needle
  { id: "spaceneedle", lat: 47.6205, lng: -122.3493 },
  // Pike Place Market
  { id: "pikeplace", lat: 47.6097, lng: -122.342 },
];

// Cache for landmark distances
let landmarkDistances = {};

// Available heuristic functions
export const heuristics = {
  // Standard Haversine distance - direct "as the crow flies" distance
  haversine: function (nodeA, nodeB) {
    if (!nodeA || !nodeB) {
      console.error("Invalid nodes in haversine heuristic:", { nodeA, nodeB });
      return Infinity;
    }
    return calculateHaversineDistance(
      { lat: nodeA.lat, lng: nodeA.lng },
      { lat: nodeB.lat, lng: nodeB.lng }
    );
  },

  // Manhattan-style distance approximation (grid-based)
  manhattan: function (nodeA, nodeB) {
    if (!nodeA || !nodeB) {
      console.error("Invalid nodes in manhattan heuristic:", { nodeA, nodeB });
      return Infinity;
    }
    // Convert to approximate grid coordinates
    const latDiff = Math.abs(nodeA.lat - nodeB.lat) * 111000; // ~111km per degree latitude
    const lngDiff =
      Math.abs(nodeA.lng - nodeB.lng) *
      111000 *
      Math.cos(((nodeA.lat + nodeB.lat) * Math.PI) / 360); // Account for longitude scale

    return latDiff + lngDiff;
  },

  // Dijkstra's algorithm (no heuristic)
  dijkstra: function () {
    return 0; // Always return 0, making A* behave like Dijkstra's algorithm
  },

  // Weighted Haversine - penalizes certain paths
  weighted: function (nodeA, nodeB) {
    if (!nodeA || !nodeB) {
      console.error("Invalid nodes in weighted heuristic:", { nodeA, nodeB });
      return Infinity;
    }

    const distance = calculateHaversineDistance(
      { lat: nodeA.lat, lng: nodeA.lng },
      { lat: nodeB.lat, lng: nodeB.lng }
    );

    // Example weight: penalize east-west movement more than north-south
    const latDiff = Math.abs(nodeA.lat - nodeB.lat);
    const lngDiff = Math.abs(nodeA.lng - nodeB.lng);

    if (lngDiff > latDiff * 2) {
      // More east-west movement, apply penalty
      return distance * 1.2;
    }

    return distance;
  },

  // Time-based heuristic - estimates travel time instead of distance
  timeBased: function (nodeA, nodeB) {
    if (!nodeA || !nodeB) {
      console.error("Invalid nodes in timeBased heuristic:", { nodeA, nodeB });
      return Infinity;
    }

    const distance = calculateHaversineDistance(
      { lat: nodeA.lat, lng: nodeA.lng },
      { lat: nodeB.lat, lng: nodeB.lng }
    );

    // Assume average travel speed of 30 km/h in city
    const avgSpeedMps = (30 * 1000) / 3600; // 8.33 meters per second

    // Adjust time estimate based on node properties if available
    if (nodeA.tags) {
      // Different speeds for different road types
      if (nodeA.tags.highway === "motorway" || nodeA.tags.highway === "trunk") {
        return distance / ((60 * 1000) / 3600); // 60 km/h for highways
      } else if (
        nodeA.tags.highway === "residential" ||
        nodeA.tags.highway === "living_street"
      ) {
        return distance / ((20 * 1000) / 3600); // 20 km/h for residential roads
      }
    }

    return distance / avgSpeedMps; // Return time in seconds
  },

  // Landmark-based heuristic - uses pre-selected landmarks for better distance estimates
  landmark: function (nodeA, nodeB) {
    if (!nodeA || !nodeB) {
      console.error("Invalid nodes in landmark heuristic:", { nodeA, nodeB });
      return Infinity;
    }

    // Ensure landmark distances to target are initialized
    if (Object.keys(landmarkDistances).length === 0) {
      // Initialize landmark distances to the target node
      for (const landmark of SEATTLE_LANDMARKS) {
        landmarkDistances[landmark.id] = calculateHaversineDistance(
          { lat: landmark.lat, lng: landmark.lng },
          { lat: nodeB.lat, lng: nodeB.lng }
        );
      }
      console.log("Initialized landmark distances to target");
    }

    // Standard direct distance as baseline
    const directDistance = calculateHaversineDistance(
      { lat: nodeA.lat, lng: nodeA.lng },
      { lat: nodeB.lat, lng: nodeB.lng }
    );

    // Use triangle inequality to improve the estimate
    let maxEstimate = directDistance;

    for (const landmark of SEATTLE_LANDMARKS) {
      // Distance from current node to landmark
      const distToLandmark = calculateHaversineDistance(
        { lat: nodeA.lat, lng: nodeA.lng },
        { lat: landmark.lat, lng: landmark.lng }
      );

      // Use triangle inequality: |d(A,T) - d(L,T)| <= d(A,L)
      // So d(A,T) >= |d(L,T) - d(A,L)|
      const estimate = Math.abs(
        landmarkDistances[landmark.id] - distToLandmark
      );

      if (estimate > maxEstimate) {
        maxEstimate = estimate;
      }
    }

    return maxEstimate;
  },

  // Elevation-aware heuristic - adds penalties for climbing
  elevation: function (nodeA, nodeB, elevationData) {
    if (!nodeA || !nodeB) {
      console.error("Invalid nodes in elevation heuristic:", { nodeA, nodeB });
      return Infinity;
    }

    const baseDistance = calculateHaversineDistance(
      { lat: nodeA.lat, lng: nodeA.lng },
      { lat: nodeB.lat, lng: nodeB.lng }
    );

    // If we have elevation data, use it (for demonstration, we simulate with lat)
    // In a real implementation, you would use actual elevation data from an API
    const simulatedElevationA = nodeA.lat * 100;
    const simulatedElevationB = nodeB.lat * 100;

    // Use latitude as a simple proxy for elevation (just for demonstration)
    // In real implementation, we would use actual elevation data
    const elevationDiff = (nodeB.lat - nodeA.lat) * 1000; // Rough approximation

    // Penalize uphill movement (positive elevation change)
    if (elevationDiff > 0) {
      // Add 10% penalty per 100m of elevation gain
      return baseDistance * (1 + elevationDiff / 1000);
    }

    return baseDistance;
  },
};

/**
 * Calculate a path between two points using the A* algorithm with real street data
 *
 * @param {Object} start - Starting point {lat, lng}
 * @param {Object} end - Ending point {lat, lng}
 * @param {Object} bounds - Geographic bounds to constrain the search area
 * @param {Object} options - Optional parameters including heuristic method
 * @returns {Object} A* route data in standardized format
 */
export async function calculateAStarPath(
  start,
  end,
  bounds,
  options = { gridSize: 100, heuristic: "haversine" }
) {
  console.log("A* calculation starting with:", {
    start,
    end,
    heuristic: options.heuristic || "haversine",
    options,
  });

  // Reset landmark distances cache when starting a new search
  if (options.heuristic === "landmark") {
    landmarkDistances = {};
  }

  // Select heuristic function
  const heuristicName = options.heuristic || "haversine";
  const heuristicFunc = heuristics[heuristicName] || heuristics.haversine;

  console.log(`Using ${heuristicName} heuristic`);

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

    // Step 3: Run A* algorithm on the street graph with selected heuristic
    const result = runAStarOnStreetGraph(
      graph,
      startNode,
      endNode,
      heuristicFunc
    );
    console.log(
      `A* result (${heuristicName}): ${result.path.length} points, ${result.nodesExplored} nodes explored`
    );

    // Check if we got a valid result
    if (result && result.path && result.path.length >= 3) {
      console.log(`Using A* result with ${heuristicName} heuristic`);
      const formattedResult = convertAStarToOSRMFormat(result);
      formattedResult.routes[0].heuristic = heuristicName; // Add heuristic info
      return formattedResult;
    } else {
      console.warn(
        `A* street search with ${heuristicName} heuristic produced insufficient path, falling back to grid`
      );
      throw new Error("A* found a too-short path");
    }
  } catch (error) {
    console.error(`Error in A* with ${heuristicName} heuristic:`, error);
    console.log("Falling back to grid-based A*");

    const gridResult = await fallbackGridBasedAStar(start, end, bounds, {
      gridSize: Math.max(options.gridSize, 500),
      heuristic: options.heuristic,
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
 * @param {Function} heuristicFunc - The heuristic function to use
 * @returns {Object} Path and metrics from the A* algorithm
 */
export function runAStarOnStreetGraph(
  graph,
  startNode,
  endNode,
  heuristicFunc = heuristics.haversine
) {
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
  fScore[startNode.id] = heuristicFunc(startNode, endNode);
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
        const h = heuristicFunc(neighborNode, endNode);
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
