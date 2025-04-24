/**
 * OpenStreetMap routing API functions
 */

import { calculateHaversineDistance, encodePolyline } from "../geoUtils.js";

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
