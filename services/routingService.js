/**
 * Routing service that provides pathfinding capabilities using both
 * OpenStreetMap Routing Machine (OSRM) API and a custom A* algorithm implementation
 */

import {
  calculateHaversineDistance,
  encodePolyline,
  decodePolyline,
} from "./geoUtils.js";
import waterBodies from "../data/waterBodies.json";

/**
 * Get directions from OpenStreetMap's OSRM API
 * Creates a route between two geographic points
 *
 * @param {Object} start - Starting point {lat, lng}
 * @param {Object} end - Ending point {lat, lng}
 * @returns {Object} Route data in standardized format
 */
export async function getOpenStreetMapDirections(start, end) {
  try {
    // OSRM public API endpoint
    const osrmApiUrl = "https://router.project-osrm.org/route/v1/driving/";

    // Format coordinates for OSRM: lng,lat (note the reversed order compared to Google)
    const startCoord = `${start.lng},${start.lat}`;
    const endCoord = `${end.lng},${end.lat}`;

    // Build the query URL with parameters for full path and polyline geometry
    const queryUrl = `${osrmApiUrl}${startCoord};${endCoord}?overview=full&geometries=polyline`;

    console.log("Requesting route from OSRM:", queryUrl);

    // Make the API request
    const response = await fetch(queryUrl);

    if (!response.ok) {
      throw new Error(
        `OSRM API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    // Validate the response structure
    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      throw new Error("No route found or invalid response from OSRM");
    }

    // Extract route information
    const route = data.routes[0];

    // Convert OSRM response to match the expected format for consistency
    return {
      routes: [
        {
          overview_polyline: {
            points: route.geometry, // Polyline string for the route
          },
          legs: [
            {
              distance: {
                text: `${(route.distance / 1000).toFixed(2)} km`, // Human-readable distance
                value: route.distance, // Distance in meters
              },
              duration: {
                text: `${Math.round(route.duration / 60)} mins`, // Human-readable duration
                value: route.duration, // Duration in seconds
              },
            },
          ],
        },
      ],
    };
  } catch (error) {
    console.error("Error getting directions from OSRM:", error);
    // Fall back to direct line calculation if OSRM fails
    return calculateDirectLine(start, end);
  }
}

/**
 * Fall-back route calculator when OSRM fails
 * Creates a simplified route as a line between points with slight randomization
 *
 * @param {Object} start - Starting point {lat, lng}
 * @param {Object} end - Ending point {lat, lng}
 * @returns {Object} Route data in standardized format
 */
export function calculateDirectLine(start, end) {
  // Create a direct line between points and encode it as a polyline
  const steps = 10; // Number of intermediate points
  const latStep = (end.lat - start.lat) / steps;
  const lngStep = (end.lng - start.lng) / steps;

  // Generate intermediate points
  const points = [];
  for (let i = 0; i <= steps; i++) {
    points.push({
      lat: start.lat + latStep * i,
      lng: start.lng + lngStep * i,
    });
  }

  // Add some randomness to make it look more like a real route
  for (let i = 1; i < points.length - 1; i++) {
    points[i].lat += (Math.random() - 0.5) * 0.01; // ~1km variation
    points[i].lng += (Math.random() - 0.5) * 0.01;
  }

  // Convert points to polyline format
  const polyline = encodePolyline(points);

  // Calculate approximate distance using Haversine formula
  const distance = calculateHaversineDistance(start, end);

  // Return route in standardized format
  return {
    routes: [
      {
        overview_polyline: {
          points: polyline,
        },
        legs: [
          {
            distance: {
              text: `${(distance / 1000).toFixed(2)} km`,
              value: distance,
            },
            duration: {
              text: `${Math.round(distance / 50)} mins`, // Estimate speed as 50m/min
              value: Math.round(distance / 50) * 60,
            },
          },
        ],
      },
    ],
  };
}

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
  // Always use the entire Seattle bounds, not just around the points
  const fullAreaStart = { lat: bounds.south, lng: bounds.west };
  const fullAreaEnd = { lat: bounds.north, lng: bounds.east };

  // Use full Seattle bounds instead of the smaller area
  const expandedBounds = {
    south: bounds.south - 0.2,
    north: bounds.north + 0.2,
    west: bounds.west - 0.2,
    east: bounds.east + 0.2,
  };
  console.log("A* STARTING with:", { start, end, expandedBounds, options });

  try {
    // Step 1: Fetch street data from OpenStreetMap for the area
    const streetData = await fetchStreetData(start, end, expandedBounds);

    console.log(
      `Fetched street data: ${streetData?.elements?.length || 0} elements`
    );

    // Check if we got enough data to build a meaningful graph
    if (
      !streetData ||
      !streetData.elements ||
      streetData.elements.length < 20
    ) {
      console.warn(
        "Not enough street data elements, falling back to grid-based approach"
      );
      throw new Error("Insufficient street data");
    }

    // Step 2: Build the graph from street data
    const graph = buildStreetGraph(streetData);
    console.log(`Built graph with ${graph?.length || 0} nodes`);

    // Ensure we have a minimally connected graph
    if (!graph || graph.length < 10) {
      console.warn(
        `Graph too small (${graph?.length || 0} nodes), likely disconnected`
      );
      throw new Error("Graph too small, likely disconnected");
    }

    // Step 3: Find closest nodes to start and end points
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

    // Step 4: Run A* algorithm on the street graph
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

    // Increase grid size significantly for better resolution if street data fails
    const gridResult = await fallbackGridBasedAStar(
      start,
      end,
      bounds,
      { gridSize: Math.max(options.gridSize, 500) } // Use at least 500x500 grid
    );

    return convertAStarToOSRMFormat(gridResult);
  }
}

/**
 * Calculate a path between two points using a third route (identical to A* for now)
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
    bounds,
    options,
  });

  try {
    // Always use the entire Seattle bounds, not just around the points
    const fullAreaStart = { lat: bounds.south, lng: bounds.west };
    const fullAreaEnd = { lat: bounds.north, lng: bounds.east };

    // Use full Seattle bounds instead of the smaller area
    const expandedBounds = {
      south: bounds.south - 0.2,
      north: bounds.north + 0.2,
      west: bounds.west - 0.2,
      east: bounds.east + 0.2,
    };

    // Fetch street data for the entire area
    const streetData = await fetchStreetData(
      fullAreaStart,
      fullAreaEnd,
      expandedBounds // Use expanded bounds
    );

    console.log(
      `Fetched street data: ${streetData?.elements?.length || 0} elements`
    );

    // Check if we got enough data to build a meaningful graph
    if (
      !streetData ||
      !streetData.elements ||
      streetData.elements.length < 20
    ) {
      console.warn(
        "Not enough street data elements, falling back to grid-based approach"
      );
      throw new Error("Insufficient street data");
    }

    // Step 2: Build the graph from street data
    const graph = buildStreetGraph(streetData);
    console.log(`Built graph with ${graph?.length || 0} nodes`);

    // Ensure we have a minimally connected graph
    if (!graph || graph.length < 10) {
      console.warn(
        `Graph too small (${graph?.length || 0} nodes), likely disconnected`
      );
      throw new Error("Graph too small, likely disconnected");
    }

    // Step 3: Find closest nodes to start and end points
    const startNode = findClosestNode(graph, start);
    const endNode = findClosestNode(graph, end);

    console.log("Found nodes:", { startNode, endNode });

    if (!startNode || !endNode) {
      console.warn(
        "Could not find suitable road nodes near the selected points"
      );
      throw new Error("Could not find suitable road nodes");
    }

    // Step 4: Run A* algorithm on the street graph
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
      throw error; // Re-throw the error to trigger fallback
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
 * Convert A* result to OSRM format for consistency in the application
 *
 * @param {Object} aStarResult - Result from A* algorithm
 * @returns {Object} Result formatted to match OSRM response structure
 */
function convertAStarToOSRMFormat(aStarResult) {
  // Encode the path as a polyline
  const polylinePoints = encodePolyline(aStarResult.path);

  // Build the OSRM-compatible response
  return {
    routes: [
      {
        overview_polyline: {
          points: polylinePoints,
        },
        legs: [
          {
            distance: {
              text: `${(aStarResult.distance / 1000).toFixed(2)} km`,
              value: aStarResult.distance,
            },
            duration: {
              // Estimate duration based on distance (assuming average speed of 30 km/h)
              text: `${Math.round(aStarResult.distance / 500)} mins`,
              value: Math.round(aStarResult.distance / 500) * 60,
            },
          },
        ],
        // Include algorithm metrics for evaluation
        nodesExplored: aStarResult.nodesExplored || 0,
      },
    ],
  };
}

/**
 * Fetch street data from OpenStreetMap for a geographic area
 *
 * @param {Object} start - Starting point {lat, lng}
 * @param {Object} end - Ending point {lat, lng}
 * @param {Object} bounds - Geographic bounds to constrain the query
 * @returns {Object} Raw OpenStreetMap data with nodes and ways
 */
async function fetchStreetData(start, end, bounds) {
  // Increase the padding to get more roads for better path finding
  const padding = 0.03; // ~3km padding (up from 0.01)
  const bbox = {
    south: Math.min(start.lat, end.lat) - padding,
    north: Math.max(start.lat, end.lat) + padding,
    west: Math.min(start.lng, end.lng) - padding,
    east: Math.max(start.lng, end.lng) + padding,
  };

  // Ensure the box stays within Seattle bounds
  bbox.south = Math.max(bbox.south, bounds.south);
  bbox.north = Math.min(bbox.north, bounds.north);
  bbox.west = Math.max(bbox.west, bounds.west);
  bbox.east = Math.min(bbox.east, bounds.east);

  console.log("Fetching street data for bounding box:", bbox);

  // Improve the Overpass query to get more complete street data
  // Exclude minor paths like footways to focus on drivable roads
  const overpassQuery = `
    [out:json];
    (
      // Get all highways except minor ones
      way[highway][highway!~"footway|path|track|service|steps"]
        (${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    );
    out body;
    >;  // Get all nodes referenced by ways
    out skel qt;
  `;

  // Execute the query - use a CORS proxy if needed
  const corsProxy = "https://corsproxy.io/?";
  const overpassUrl = "https://overpass-api.de/api/interpreter";

  try {
    // First try direct connection to Overpass API
    console.log("Attempting direct Overpass API connection");
    const response = await fetch(overpassUrl, {
      method: "POST",
      body: overpassQuery,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log(
        `Successfully fetched street data: ${data.elements.length} elements`
      );
      return data;
    }

    throw new Error(`Overpass API error: ${response.status}`);
  } catch (error) {
    console.warn("Direct connection failed, trying with CORS proxy:", error);

    // Try with CORS proxy as fallback (for browser environments)
    const proxyResponse = await fetch(
      corsProxy + encodeURIComponent(overpassUrl),
      {
        method: "POST",
        body: overpassQuery,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    if (!proxyResponse.ok) {
      throw new Error(`Overpass API error with proxy: ${proxyResponse.status}`);
    }

    const data = await proxyResponse.json();
    console.log(
      `Successfully fetched street data through proxy: ${data.elements.length} elements`
    );
    return data;
  }
}

/**
 * Build a graph structure from OpenStreetMap data for use with A* algorithm
 *
 * @param {Object} osmData - Raw OpenStreetMap data from Overpass API
 * @returns {Array} Array of nodes with their connections for pathfinding
 */
function buildStreetGraph(osmData) {
  const nodes = {};
  const edges = [];

  console.log(`Building graph from ${osmData.elements.length} OSM elements`);

  // Step 1: Collect all nodes and ways
  for (const element of osmData.elements) {
    if (element.type === "node") {
      // Store nodes with empty connections array
      nodes[element.id] = {
        id: element.id,
        lat: element.lat,
        lng: element.lon, // Note: OSM uses 'lon', we use 'lng' for consistency
        connections: [],
      };
    } else if (
      element.type === "way" &&
      element.nodes &&
      element.nodes.length > 1
    ) {
      // Store ways (road segments)
      edges.push(element);
    }
  }

  console.log(
    `Found ${Object.keys(nodes).length} nodes and ${edges.length} edges`
  );

  // Step 2: Connect nodes based on ways (roads)
  for (const edge of edges) {
    // Check if this is a one-way road
    const isOneWay = edge.tags?.oneway === "yes";

    // Connect sequential nodes in the way
    for (let i = 0; i < edge.nodes.length - 1; i++) {
      const fromNode = nodes[edge.nodes[i]];
      const toNode = nodes[edge.nodes[i + 1]];

      if (fromNode && toNode) {
        // Calculate distance between these nodes
        const distance = calculateHaversineDistance(
          { lat: fromNode.lat, lng: fromNode.lng },
          { lat: toNode.lat, lng: toNode.lng }
        );

        // Add forward connection
        fromNode.connections.push({ nodeId: toNode.id, distance });

        // Add reverse connection if not a one-way road
        if (!isOneWay) {
          toNode.connections.push({ nodeId: fromNode.id, distance });
        }
      }
    }
  }

  // Return only nodes that have connections (part of the road network)
  return Object.values(nodes).filter((node) => node.connections.length > 0);
}

/**
 * Find the closest node in the graph to a geographic point
 *
 * @param {Array} graph - Array of nodes from buildStreetGraph
 * @param {Object} point - Point to find closest node for {lat, lng}
 * @returns {Object} The closest node in the graph
 */
function findClosestNode(graph, point) {
  let closestNode = null;
  let closestDistance = Infinity;

  // Find node with minimum distance to the point
  for (const node of graph) {
    const distance = calculateHaversineDistance(
      { lat: node.lat, lng: node.lng },
      point
    );

    if (distance < closestDistance) {
      closestDistance = distance;
      closestNode = node;
    }
  }

  // Warn if closest node is far away from the point
  if (closestDistance > 500) {
    console.warn(`Closest node is ${closestDistance}m away from the point`);
  }

  return closestNode;
}

/**
 * Run A* search algorithm on a street graph
 *
 * @param {Array} graph - Array of nodes from buildStreetGraph
 * @param {Object} startNode - Starting node from the graph
 * @param {Object} endNode - Ending node from the graph
 * @returns {Object} Path and metrics from the A* algorithm
 */
function runAStarOnStreetGraph(graph, startNode, endNode) {
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

/**
 * Run A* search algorithm on a street graph
 *
 * @param {Array} graph - Array of nodes from buildStreetGraph
 * @param {Object} startNode - Starting node from the graph
 * @param {Object} endNode - Ending node from the graph
 * @returns {Object} Path and metrics from the A* algorithm
 */
function runAStarOnStreetGraph3(graph, startNode, endNode) {
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

/**
 * Heuristic function for A* - estimates remaining distance
 * Uses Haversine distance which is admissible (never overestimates)
 *
 * @param {Object} nodeA - Current node
 * @param {Object} nodeB - Goal node
 * @returns {number} Estimated distance in meters
 */
function heuristicDistance(nodeA, nodeB) {
  // Add null checks to prevent errors with undefined nodes
  if (!nodeA || !nodeB) {
    console.error("Invalid nodes in heuristicDistance:", { nodeA, nodeB });
    return Infinity; // Return a large value to deprioritize this path
  }

  return calculateHaversineDistance(
    { lat: nodeA.lat, lng: nodeA.lng },
    { lat: nodeB.lat, lng: nodeB.lng }
  );
}

/**
 * Reconstruct path from cameFrom mapping
 *
 * @param {Object} cameFrom - Map of nodes to their predecessors
 * @param {string} current - Current node ID
 * @param {string} start - Start node ID
 * @param {Array} graph - Graph of nodes
 * @returns {Array} Path as array of points
 */
function reconstructPath(cameFrom, current, start, graph) {
  const path = [];
  while (current !== start) {
    const node = graph.find((n) => n.id === current);
    path.unshift({ lat: node.lat, lng: node.lng });
    current = cameFrom[current];
  }
  const startNode = graph.find((n) => n.id === start);
  path.unshift({ lat: startNode.lat, lng: startNode.lng });
  return path;
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
async function fallbackGridBasedAStar(start, end, bounds, options) {
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
 * Custom priority queue implementation for A* algorithm
 */
class CustomPriorityQueue {
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
 * Check if a point is inside any water body
 * @param {Object} point - {lat, lng} point to check
 * @returns {boolean} True if the point is inside a water body
 */
function isPointInWater(point) {
  for (const feature of waterBodies.features) {
    const polygon = feature.geometry.coordinates[0];
    if (isPointInPolygon(point, polygon)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a point is inside a polygon
 * @param {Object} point - {lat, lng} point to check
 * @param {Array} polygon - Array of [lng, lat] coordinates defining the polygon
 * @returns {boolean} True if the point is inside the polygon
 */
function isPointInPolygon(point, polygon) {
  let inside = false;
  const x = point.lng,
    y = point.lat;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0],
      yi = polygon[i][1];
    const xj = polygon[j][0],
      yj = polygon[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
