import { fetchStreetData, buildStreetGraph } from "./routingService.js";

// Cache for the Seattle street graph
let cachedGraph = null;
let isLoading = false;
let loadPromise = null;

/**
 * Load and cache the Seattle street graph
 *
 * @param {Object} bounds - Geographic bounds of Seattle
 * @returns {Promise<Array>} Graph of street nodes
 */
export async function getSeattleGraph(bounds) {
  // If we already have a cached graph, return it
  if (cachedGraph) {
    console.log("Using cached Seattle graph");
    return cachedGraph;
  }

  // If already loading, return the existing promise
  if (isLoading) {
    console.log("Graph loading in progress, waiting...");
    return loadPromise;
  }

  // Start loading
  isLoading = true;
  console.log("Initializing Seattle graph - first load");

  // Define the full Seattle area
  const fullAreaStart = { lat: bounds.south, lng: bounds.west };
  const fullAreaEnd = { lat: bounds.north, lng: bounds.east };

  // Use expanded bounds for comprehensive coverage
  const expandedBounds = {
    south: bounds.south - 0.2,
    north: bounds.north + 0.2,
    west: bounds.west - 0.2,
    east: bounds.east + 0.2,
  };

  // Create a promise to load the data
  loadPromise = fetchStreetData(fullAreaStart, fullAreaEnd, expandedBounds)
    .then((streetData) => {
      console.log(
        `Fetched Seattle street data: ${
          streetData?.elements?.length || 0
        } elements`
      );

      if (
        !streetData ||
        !streetData.elements ||
        streetData.elements.length < 20
      ) {
        throw new Error("Insufficient Seattle street data");
      }

      cachedGraph = buildStreetGraph(streetData);
      console.log(`Built Seattle graph with ${cachedGraph?.length || 0} nodes`);
      isLoading = false;
      return cachedGraph;
    })
    .catch((error) => {
      console.error("Error loading Seattle graph:", error);
      isLoading = false;
      throw error;
    });

  return loadPromise;
}

/**
 * Clear the cached graph (useful for testing or when bounds change)
 */
export function clearCache() {
  cachedGraph = null;
  isLoading = false;
  loadPromise = null;
  console.log("Seattle graph cache cleared");
}
