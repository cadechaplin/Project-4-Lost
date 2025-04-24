/**
 * Graph utilities for routing algorithms
 */

import { calculateHaversineDistance, encodePolyline } from "../geoUtils.js";
import waterBodies from "../../data/waterBodies.json";

/**
 * Build a graph structure from OpenStreetMap data for use with A* algorithm
 *
 * @param {Object} osmData - Raw OpenStreetMap data from Overpass API
 * @returns {Array} Array of nodes with their connections for pathfinding
 */
export function buildStreetGraph(osmData) {
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
export function findClosestNode(graph, point) {
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
 * Convert A* result to OSRM format for consistency in the application
 *
 * @param {Object} aStarResult - Result from A* algorithm
 * @returns {Object} Result formatted to match OSRM response structure
 */
export function convertAStarToOSRMFormat(aStarResult) {
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
 * Heuristic function for A* - estimates remaining distance
 * Uses Haversine distance which is admissible (never overestimates)
 *
 * @param {Object} nodeA - Current node
 * @param {Object} nodeB - Goal node
 * @returns {number} Estimated distance in meters
 */
export function heuristicDistance(nodeA, nodeB) {
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
export function reconstructPath(cameFrom, current, start, graph) {
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
 * Check if a point is inside any water body
 * @param {Object} point - {lat, lng} point to check
 * @returns {boolean} True if the point is inside a water body
 */
export function isPointInWater(point) {
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
export function isPointInPolygon(point, polygon) {
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

/**
 * Fetch street data from OpenStreetMap for a geographic area
 *
 * @param {Object} start - Starting point {lat, lng}
 * @param {Object} end - Ending point {lat, lng}
 * @param {Object} bounds - Geographic bounds to constrain the query
 * @returns {Object} Raw OpenStreetMap data with nodes and ways
 */
export async function fetchStreetData(start, end, bounds) {
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
