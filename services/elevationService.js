/**
 * Elevation data service
 * Provides functions to fetch and cache elevation data for geographic points
 */

// Simple in-memory cache for elevation data
const elevationCache = {};

// Rate limiting parameters
const MAX_REQUESTS_PER_MINUTE = 10;
const requestTimestamps = [];

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

  // Apply rate limiting
  if (!checkRateLimit()) {
    console.warn("Rate limit exceeded, using simulated elevation data");
    return getSimulatedElevation(point);
  }

  try {
    // Use a CORS proxy to bypass CORS restrictions
    const corsProxy = "https://corsproxy.io/?";
    const apiUrl = `https://api.open-elevation.com/api/v1/lookup?locations=${point.lat},${point.lng}`;
    const response = await fetch(corsProxy + encodeURIComponent(apiUrl));

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
    return getSimulatedElevation(point);
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

  // If too many uncached points or rate limited, use simulated data
  if (uncachedPoints.length > 10 || !checkRateLimit()) {
    console.warn(
      "Using simulated elevation data due to rate limits or batch size"
    );
    uncachedPoints.forEach((point, i) => {
      const originalIndex = indexMap[i];
      const key = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
      const elevationValue = getSimulatedElevation(point);

      elevationCache[key] = elevationValue;
      results[originalIndex] = elevationValue;
    });

    return results;
  }

  try {
    // Format locations string for the API and use CORS proxy
    const corsProxy = "https://corsproxy.io/?";
    const locationsStr = uncachedPoints
      .map((point) => `${point.lat},${point.lng}`)
      .join("|");
    const apiUrl = `https://api.open-elevation.com/api/v1/lookup?locations=${locationsStr}`;

    const response = await fetch(corsProxy + encodeURIComponent(apiUrl));

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
      const elevationValue = getSimulatedElevation(point);

      elevationCache[key] = elevationValue;
      results[originalIndex] = elevationValue;
    });

    return results;
  }
}

/**
 * Generate simulated elevation based on coordinates
 *
 * @param {Object} point - Geographic point {lat, lng}
 * @returns {number} - Simulated elevation in meters
 */
function getSimulatedElevation(point) {
  // More realistic simulation based on Seattle's topography
  // Higher elevations in north and east
  const baseElevation = 20; // Base elevation in meters
  const latFactor = (point.lat - 47.5) * 200; // Higher in north
  const lngFactor = (-122.4 - point.lng) * 100; // Higher in east

  // Add some terrain variation based on coordinate hashing
  const hash = Math.sin(point.lat * 10) * Math.cos(point.lng * 10) * 50;

  return baseElevation + latFactor + lngFactor + hash;
}

/**
 * Check if we're within rate limits
 *
 * @returns {boolean} - True if within rate limits, false otherwise
 */
function checkRateLimit() {
  const now = Date.now();

  // Remove timestamps older than 1 minute
  while (requestTimestamps.length > 0 && now - requestTimestamps[0] > 60000) {
    requestTimestamps.shift();
  }

  // Check if we've made too many requests in the last minute
  if (requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }

  // Add current timestamp
  requestTimestamps.push(now);
  return true;
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
export async function preloadElevationData(bounds, resolution = 5) {
  // Use a lower resolution to avoid overwhelming the API
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
    // Use simulated data for preloading to avoid rate limits
    points.forEach((point) => {
      const key = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
      if (elevationCache[key] === undefined) {
        elevationCache[key] = getSimulatedElevation(point);
      }
    });
    console.log("Elevation data preloaded successfully (simulated)");
  } catch (error) {
    console.error("Error preloading elevation data:", error);
  }
}
