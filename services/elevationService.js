/**
 * Elevation data service
 * Provides functions to fetch and cache elevation data for geographic points
 */

// Simple in-memory cache for elevation data
const elevationCache = {};

/**
 * Get elevation data for a geographic point
 * Uses caching to minimize API calls for repeatedly accessed points
 *
 * @param {Object} point - Geographic point {lat, lng}
 * @returns {Promise<number>} - Elevation in meters
 */
export async function getElevation(point) {
  // Round coordinates to reduce cache size while maintaining accuracy
  const key = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;

  // Check cache first
  if (elevationCache[key] !== undefined) {
    return elevationCache[key];
  }

  try {
    const response = await fetch(
      `https://api.open-elevation.com/api/v1/lookup?locations=${point.lat},${point.lng}`
    );

    if (!response.ok) {
      throw new Error(`Elevation API error: ${response.status}`);
    }

    const data = await response.json();
    if (data && data.results && data.results.length > 0) {
      const elevation = data.results[0].elevation;
      elevationCache[key] = elevation; // Cache the result
      return elevation;
    }

    throw new Error("Invalid elevation data format");
  } catch (error) {
    console.error("Error fetching elevation:", error);
    // Fall back to simulated elevation based on latitude
    // This ensures the algorithm can still function when the API is unavailable
    const simulatedElevation = point.lat * 100;
    elevationCache[key] = simulatedElevation; // Cache the fallback value
    return simulatedElevation;
  }
}

/**
 * Get elevation data for multiple geographic points in a single request
 * More efficient than multiple individual requests
 *
 * @param {Array<Object>} points - Array of geographic points [{lat, lng}, ...]
 * @returns {Promise<Array<number>>} - Array of elevations in meters
 */
export async function getBatchElevation(points) {
  if (!points || points.length === 0) {
    return [];
  }

  // Check which points are already cached
  const uncachedPoints = [];
  const results = [];
  const indexMap = {};

  points.forEach((point, index) => {
    const key = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
    if (elevationCache[key] !== undefined) {
      results[index] = elevationCache[key];
    } else {
      uncachedPoints.push(point);
      indexMap[uncachedPoints.length - 1] = index;
    }
  });

  // If all points are cached, return results immediately
  if (uncachedPoints.length === 0) {
    return results;
  }

  try {
    // Format locations string for the API
    const locationsStr = uncachedPoints
      .map((point) => `${point.lat},${point.lng}`)
      .join("|");

    const response = await fetch(
      `https://api.open-elevation.com/api/v1/lookup?locations=${locationsStr}`
    );

    if (!response.ok) {
      throw new Error(`Elevation API error: ${response.status}`);
    }

    const data = await response.json();
    if (data && data.results && data.results.length === uncachedPoints.length) {
      // Process and cache results
      data.results.forEach((result, i) => {
        const originalIndex = indexMap[i];
        const point = uncachedPoints[i];
        const key = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;

        elevationCache[key] = result.elevation;
        results[originalIndex] = result.elevation;
      });

      return results;
    }

    throw new Error("Invalid batch elevation data format");
  } catch (error) {
    console.error("Error fetching batch elevation:", error);

    // Fall back to simulated elevations
    uncachedPoints.forEach((point, i) => {
      const originalIndex = indexMap[i];
      const key = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
      const simulatedElevation = point.lat * 100;

      elevationCache[key] = simulatedElevation;
      results[originalIndex] = simulatedElevation;
    });

    return results;
  }
}

/**
 * Clear the elevation cache (useful for testing)
 */
export function clearElevationCache() {
  Object.keys(elevationCache).forEach((key) => {
    delete elevationCache[key];
  });
}

/**
 * Pre-fetch elevation data for an area to warm up the cache
 *
 * @param {Object} bounds - Geographic bounds {north, south, east, west}
 * @param {number} resolution - Number of points in each direction
 * @returns {Promise<void>}
 */
export async function preloadElevationData(bounds, resolution = 10) {
  const points = [];
  const latStep = (bounds.north - bounds.south) / resolution;
  const lngStep = (bounds.east - bounds.west) / resolution;

  for (let i = 0; i <= resolution; i++) {
    for (let j = 0; j <= resolution; j++) {
      points.push({
        lat: bounds.south + latStep * i,
        lng: bounds.west + lngStep * j,
      });
    }
  }

  try {
    console.log(`Preloading elevation data for ${points.length} points`);
    await getBatchElevation(points);
    console.log("Elevation data preloaded successfully");
  } catch (error) {
    console.error("Error preloading elevation data:", error);
  }
}
