// Import Leaflet CSS for proper map styling
import "leaflet/dist/leaflet.css";

// Keep a reference to the Leaflet library
let L = null;

/**
 * Asynchronously loads the Leaflet library for interactive maps
 * Handles both browser-loaded Leaflet and dynamic imports
 * 
 * @returns {Object} The Leaflet library object
 */
export async function loadLeaflet() {
  // Check if Leaflet is already loaded in the global scope
  if (window.L) {
    console.log("Leaflet already loaded");
    L = window.L;
    return L;
  }

  try {
    // Dynamically import Leaflet library
    const leaflet = await import("leaflet");
    L = leaflet.default || leaflet;
    console.log("Leaflet loaded successfully");

    // Fix Leaflet marker icon path issue with webpack/vite bundling
    // This is a common issue where Leaflet can't find icon images
    delete L.Icon.Default.prototype._getIconUrl;

    // Use dynamic URL imports to correctly reference marker icons
    const iconRetinaUrl = new URL(
      "leaflet/dist/images/marker-icon-2x.png",
      import.meta.url
    ).href;
    const iconUrl = new URL(
      "leaflet/dist/images/marker-icon.png",
      import.meta.url
    ).href;
    const shadowUrl = new URL(
      "leaflet/dist/images/marker-shadow.png",
      import.meta.url
    ).href;

    // Configure Leaflet to use the correct icon URLs
    L.Icon.Default.mergeOptions({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
    });

    return L;
  } catch (error) {
    console.error("Failed to load Leaflet:", error);
    throw error;
  }
}

/**
 * Initialize a Leaflet map with OpenStreetMap tiles
 * 
 * @param {HTMLElement} mapElement - DOM element to attach the map to
 * @param {Object} options - Leaflet map options (zoom, center, etc)
 * @returns {Object} Initialized Leaflet map instance
 */
export function initializeMap(mapElement, options) {
  if (!L) {
    throw new Error("Leaflet not loaded yet");
  }

  // Create a new map attached to the provided element
  const map = L.map(mapElement, options);

  // Add default OpenStreetMap tile layer
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  return map;
}

/**
 * Add a marker to a Leaflet map
 * 
 * @param {Object} map - Leaflet map instance
 * @param {Object} position - {lat, lng} object for marker position
 * @param {string} title - Optional title/tooltip for the marker
 * @returns {Object} The created Leaflet marker instance
 */
export function addMarkerToMap(map, position, title) {
  if (!L || !map) return null;

  // Create a marker at the specified position
  const marker = L.marker([position.lat, position.lng], { title });
  marker.addTo(map);

  // Add a popup to the marker if a title was provided
  if (title) {
    marker.bindPopup(title);
  }

  return marker;
}

/**
 * Add a polyline (route path) to a Leaflet map
 * 
 * @param {Object} map - Leaflet map instance
 * @param {Array} points - Array of {lat, lng} objects forming the path
 * @param {Object} options - Styling options for the polyline
 * @returns {Object} The created Leaflet polyline instance
 */
export function addPolylineToMap(map, points, options = {}) {
  if (!map || !points || points.length < 2) {
    console.error("Invalid map or insufficient points for polyline");
    return null;
  }

  try {
    // Convert points to Leaflet's expected format [lat, lng]
    const latLngs = points.map((point) => [point.lat, point.lng]);

    // Create and style the polyline
    const polyline = L.polyline(latLngs, {
      color: options.color || "#3388ff", // Default blue color
      weight: options.weight || 3,       // Line width
      opacity: options.opacity !== undefined ? options.opacity : 1.0,
      dashArray: options.dashArray,      // For dashed lines
    });

    // Add the polyline to the map
    polyline.addTo(map);
    return polyline;
  } catch (error) {
    console.error("Error adding polyline to map:", error);
    return null;
  }
}
