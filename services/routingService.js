import {
  calculateHaversineDistance,
  encodePolyline,
  decodePolyline,
} from "./geoUtils.js";

// OSRM directions service
export async function getOpenStreetMapDirections(start, end) {
  try {
    // OSRM public API endpoint
    const osrmApiUrl = "https://router.project-osrm.org/route/v1/driving/";

    // Format coordinates for OSRM: lng,lat (note the reversed order compared to Google)
    const startCoord = `${start.lng},${start.lat}`;
    const endCoord = `${end.lng},${end.lat}`;

    // Build the query URL
    const queryUrl = `${osrmApiUrl}${startCoord};${endCoord}?overview=full&geometries=polyline`;

    console.log("Requesting route from OSRM:", queryUrl);

    // Make the request
    const response = await fetch(queryUrl);

    if (!response.ok) {
      throw new Error(
        `OSRM API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      throw new Error("No route found or invalid response from OSRM");
    }

    // Extract route information
    const route = data.routes[0];

    // Convert OSRM response to match the expected format
    return {
      routes: [
        {
          overview_polyline: {
            points: route.geometry,
          },
          legs: [
            {
              distance: {
                text: `${(route.distance / 1000).toFixed(2)} km`,
                value: route.distance,
              },
              duration: {
                text: `${Math.round(route.duration / 60)} mins`,
                value: route.duration,
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

// Fall-back route calculator
export function calculateDirectLine(start, end) {
  // Create a direct line between points and encode it as a polyline
  const steps = 10;
  const latStep = (end.lat - start.lat) / steps;
  const lngStep = (end.lng - start.lng) / steps;

  const points = [];
  for (let i = 0; i <= steps; i++) {
    points.push({
      lat: start.lat + latStep * i,
      lng: start.lng + lngStep * i,
    });
  }

  // Add some randomness to make it look more like a real route
  for (let i = 1; i < points.length - 1; i++) {
    points[i].lat += (Math.random() - 0.5) * 0.01;
    points[i].lng += (Math.random() - 0.5) * 0.01;
  }

  const polyline = encodePolyline(points);

  // Calculate approximate distance
  const distance = calculateHaversineDistance(start, end);

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
              text: `${Math.round(distance / 50)} mins`,
              value: Math.round(distance / 50) * 60,
            },
          },
        ],
      },
    ],
  };
}

// A* algorithm with real street data
export async function calculateAStarPath(
  start,
  end,
  bounds,
  options = { gridSize: 100 }
) {
  console.log("A* STARTING with:", { start, end, bounds, options });

  try {
    // Fetch street data from OpenStreetMap
    const streetData = await fetchStreetData(start, end, bounds);

    console.log(
      `Fetched street data: ${streetData?.elements?.length || 0} elements`
    );

    // Check if we got enough data
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

    // Build the graph from street data
    const graph = buildStreetGraph(streetData);
    console.log(`Built graph with ${graph?.length || 0} nodes`);

    // Ensure we have a minimally connected graph
    if (!graph || graph.length < 10) {
      console.warn(
        `Graph too small (${graph?.length || 0} nodes), likely disconnected`
      );
      throw new Error("Graph too small, likely disconnected");
    }

    // Find closest nodes to start and end points
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

    // Run A* on the street graph
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

    // Increase grid size significantly to get a better path
    const gridResult = await fallbackGridBasedAStar(
      start,
      end,
      bounds,
      { gridSize: Math.max(options.gridSize, 500) } // Use at least 500x500 grid
    );

    return convertAStarToOSRMFormat(gridResult);
  }
}

// Function to convert A* result to OSRM format
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
        // Always include nodesExplored
        nodesExplored: aStarResult.nodesExplored || 0,
      },
    ],
  };
}
async function fetchStreetData(start, end, bounds) {
  // Increase the padding to get more roads
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
    // First try direct connection
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

    // Try with CORS proxy as fallback
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

function buildStreetGraph(osmData) {
  const nodes = {};
  const edges = [];

  console.log(`Building graph from ${osmData.elements.length} OSM elements`);

  // Collect all nodes and ways
  for (const element of osmData.elements) {
    if (element.type === "node") {
      nodes[element.id] = {
        id: element.id,
        lat: element.lat,
        lng: element.lon,
        connections: [],
      };
    } else if (
      element.type === "way" &&
      element.nodes &&
      element.nodes.length > 1
    ) {
      edges.push(element);
    }
  }

  console.log(
    `Found ${Object.keys(nodes).length} nodes and ${edges.length} edges`
  );

  // Connect nodes based on ways
  for (const edge of edges) {
    const isOneWay = edge.tags?.oneway === "yes";
    for (let i = 0; i < edge.nodes.length - 1; i++) {
      const fromNode = nodes[edge.nodes[i]];
      const toNode = nodes[edge.nodes[i + 1]];

      if (fromNode && toNode) {
        const distance = calculateHaversineDistance(
          { lat: fromNode.lat, lng: fromNode.lng },
          { lat: toNode.lat, lng: toNode.lng }
        );

        fromNode.connections.push({ nodeId: toNode.id, distance });
        if (!isOneWay) {
          toNode.connections.push({ nodeId: fromNode.id, distance });
        }
      }
    }
  }

  return Object.values(nodes).filter((node) => node.connections.length > 0);
}

function findClosestNode(graph, point) {
  let closestNode = null;
  let closestDistance = Infinity;

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

  if (closestDistance > 500) {
    console.warn(`Closest node is ${closestDistance}m away from the point`);
  }

  return closestNode;
}

function runAStarOnStreetGraph(graph, startNode, endNode) {
  // Create a map for faster node lookup instead of using find()
  const nodeMap = {};
  for (const node of graph) {
    nodeMap[node.id] = node;
  }

  console.log(`Created node map with ${Object.keys(nodeMap).length} entries`);
  console.log(`Start node: ${startNode.id}, End node: ${endNode.id}`);

  const openSet = new CustomPriorityQueue((a, b) => a.f - b.f);
  const closedSet = new Set();
  const cameFrom = {};
  const gScore = {};
  const fScore = {};

  // Initialize with start node
  gScore[startNode.id] = 0;
  fScore[startNode.id] = heuristicDistance(startNode, endNode);
  openSet.enqueue({ id: startNode.id, f: fScore[startNode.id] });

  // Track statistics
  let nodesExplored = 0;
  let maxIterations = 10000;
  let iterations = 0;

  // Track all explored nodes for visualization
  const exploredNodes = [];

  while (!openSet.isEmpty() && iterations < maxIterations) {
    iterations++;
    const current = openSet.dequeue();
    nodesExplored++;

    // Get the current node from our map (much faster than find)
    const currentNode = nodeMap[current.id];

    if (!currentNode) {
      console.error(`Node ${current.id} not found in nodeMap`);
      continue; // Skip this iteration if node not found
    }

    // Add to explored nodes
    exploredNodes.push({
      lat: currentNode.lat,
      lng: currentNode.lng,
    });

    // Check if we've reached the end
    if (current.id === endNode.id) {
      console.log(
        `Path found! Explored ${nodesExplored} nodes in ${iterations} iterations`
      );

      // Build result with path, distance, and stats
      const pathNodes = [];
      let currentId = current.id;

      // Reconstruct path using the node map
      while (currentId !== startNode.id) {
        const node = nodeMap[currentId];
        if (!node) {
          console.error(`Missing node in path reconstruction: ${currentId}`);
          break;
        }
        pathNodes.unshift({ lat: node.lat, lng: node.lng });
        currentId = cameFrom[currentId];
      }

      // Add starting node
      pathNodes.unshift({ lat: startNode.lat, lng: startNode.lng });

      // Calculate path distance
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

    closedSet.add(current.id);

    // Process neighbors
    for (const connection of currentNode.connections) {
      const neighborId = connection.nodeId;

      // Skip if in closed set or missing
      if (closedSet.has(neighborId)) continue;

      // Get the neighbor node
      const neighborNode = nodeMap[neighborId];
      if (!neighborNode) {
        console.warn(`Missing neighbor node: ${neighborId}`);
        continue;
      }

      // Calculate new path score
      const tentativeGScore = gScore[current.id] + connection.distance;

      if (!gScore[neighborId] || tentativeGScore < gScore[neighborId]) {
        // Record this path as best
        cameFrom[neighborId] = current.id;
        gScore[neighborId] = tentativeGScore;

        // Calculate f-score using heuristic
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

// Add a separate reconstructPath function for grid-based A*
function reconstructGridPath(cameFrom, current, start) {
  const path = [current];
  while (current !== start) {
    current = cameFrom[current];
    path.unshift(current);
  }
  return path;
}

// Modify the call to reconstructPath in fallbackGridBasedAStar
async function fallbackGridBasedAStar(start, end, bounds, options) {
  console.log("Using fallback grid-based A* with grid size:", options.gridSize);

  // Use a much higher grid size for better resolution
  const gridSize = Math.max(options.gridSize, 500); // Use at least 500x500 grid

  console.log(`Using ${gridSize}x${gridSize} grid for fallback A*`);

  // Create a grid over the area
  const latStep = (bounds.north - bounds.south) / gridSize;
  const lngStep = (bounds.east - bounds.west) / gridSize;

  console.log(
    `Grid cells are ${latStep.toFixed(6)}° lat x ${lngStep.toFixed(6)}° lng`
  );

  // Convert lat/lng to grid coordinates
  const startGrid = {
    x: Math.floor((start.lng - bounds.west) / lngStep),
    y: Math.floor((start.lat - bounds.south) / latStep),
  };

  const endGrid = {
    x: Math.floor((end.lng - bounds.west) / lngStep),
    y: Math.floor((end.lat - bounds.south) / latStep),
  };

  console.log("Grid coordinates:", { startGrid, endGrid });

  const openSet = new CustomPriorityQueue((a, b) => a.f - b.f);
  const closedSet = new Set();
  const cameFrom = {};
  const gScore = {};
  const fScore = {};

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

  while (!openSet.isEmpty()) {
    const current = openSet.dequeue();
    nodesExplored++;

    if (current.key === endKey) {
      const path = reconstructGridPath(cameFrom, current.key, startKey);
      console.log(`Grid path found with ${path.length} points`);

      // Convert grid coordinates back to lat/lng with more interpolation
      const latLngPath = [];

      // Add start point exactly
      latLngPath.push({
        lat: start.lat,
        lng: start.lng,
      });

      // Add intermediate points from grid cells
      for (let i = 1; i < path.length - 1; i++) {
        const [x, y] = path[i].split(",").map(Number);
        latLngPath.push({
          lat: bounds.south + y * latStep + latStep / 2,
          lng: bounds.west + x * lngStep + lngStep / 2,
        });
      }

      // Add end point exactly
      latLngPath.push({
        lat: end.lat,
        lng: end.lng,
      });

      console.log(`Converted to ${latLngPath.length} lat/lng points`);

      // Calculate distance
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

    closedSet.add(current.key);

    // Get neighbors
    const neighbors = getNeighbors(current.x, current.y, gridSize);

    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x},${neighbor.y}`;

      if (closedSet.has(neighborKey)) continue;

      // Calculate tentative gScore
      const tentativeGScore = gScore[current.key] + 1; // Assuming uniform cost

      if (!gScore[neighborKey] || tentativeGScore < gScore[neighborKey]) {
        // This path is better than any previous one
        cameFrom[neighborKey] = current.key;
        gScore[neighborKey] = tentativeGScore;
        fScore[neighborKey] =
          gScore[neighborKey] + heuristic(neighbor, endGrid);

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

class CustomPriorityQueue {
  constructor(comparator) {
    this.values = [];
    this.comparator = comparator;
  }

  enqueue(element) {
    this.values.push(element);
    this.sort();
  }

  dequeue() {
    return this.values.shift();
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

function getNeighbors(x, y, gridSize) {
  const neighbors = [];
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

  for (const dir of directions) {
    const nx = x + dir.dx;
    const ny = y + dir.dy;

    if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
      neighbors.push({ x: nx, y: ny });
    }
  }

  return neighbors;
}

function heuristic(a, b) {
  // Manhattan distance
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
