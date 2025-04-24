/**
 * Geographic utility functions for distance calculations and polyline encoding/decoding
 */

/**
 * Calculate distance between two geographic points using the Haversine formula
 * This accounts for the Earth's curvature to calculate accurate distances
 * 
 * @param {Object} point1 - First point {lat, lng}
 * @param {Object} point2 - Second point {lat, lng}
 * @returns {number} Distance in meters
 */
export function calculateHaversineDistance(point1, point2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (point1.lat * Math.PI) / 180; // Convert latitude to radians
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180; // Latitude difference in radians
  const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180; // Longitude difference in radians

  // Haversine formula
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Encode an array of points into a Google Polyline Format string
 * This format allows efficient encoding of path data for APIs and storage
 * 
 * @param {Array} points - Array of {lat, lng} points to encode
 * @returns {string} Encoded polyline string
 */
export function encodePolyline(points) {
  let result = "";
  let lat = 0;
  let lng = 0;

  // Process each point
  for (const point of points) {
    // Calculate difference from previous point (delta encoding)
    const latDiff = Math.round((point.lat - lat) * 1e5);
    const lngDiff = Math.round((point.lng - lng) * 1e5);

    // Update reference points for next iteration
    lat = point.lat;
    lng = point.lng;

    // Encode the differences and append to result
    result += encodeNumber(latDiff) + encodeNumber(lngDiff);
  }

  return result;
}

/**
 * Helper function to encode a single number for polyline encoding
 * 
 * @param {number} num - Number to encode
 * @returns {string} Encoded string representation
 */
function encodeNumber(num) {
  let result = "";

  // Shift left by 1 bit, then invert if negative
  num = num < 0 ? ~(num << 1) : num << 1;

  // Process 5 bits at a time, ensure continuation bit
  while (num >= 0x20) {
    result += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
    num >>= 5;
  }

  // Add the final chunk
  result += String.fromCharCode(num + 63);
  return result;
}

/**
 * Decode a Google Polyline Format string into an array of points
 * 
 * @param {string} encoded - Encoded polyline string
 * @returns {Array} Array of {lat, lng} points
 */
export function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  // Process the entire string
  while (index < encoded.length) {
    // Decode latitude
    let b;
    let shift = 0;
    let result = 0;

    // Process chunks of 5 bits until we reach a chunk without continuation bit
    do {
      b = encoded.charCodeAt(index++) - 63; // Convert ASCII to numeric value
      result |= (b & 0x1f) << shift; // Apply 5 bits at current shift position
      shift += 5; // Move to next 5 bits
    } while (b >= 0x20); // Continue if we have a continuation bit

    // Handle negative values by inverting if LSB is 1
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat; // Apply delta to current latitude

    // Repeat the process for longitude
    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    // Add the point to our array, converting back to decimal degrees
    points.push({
      lat: lat * 1e-5,
      lng: lng * 1e-5,
    });
  }

  return points;
}

/**
 * Format coordinates as a human-readable string
 * 
 * @param {Object} point - Point with {lat, lng} properties
 * @returns {string} Formatted coordinate string
 */
export function formatCoordinates(point) {
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
}
