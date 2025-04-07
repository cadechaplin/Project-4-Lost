import "leaflet/dist/leaflet.css";

let L = null;

export async function loadLeaflet() {
  if (window.L) {
    console.log("Leaflet already loaded");
    L = window.L;
    return L;
  }

  try {
    // Import Leaflet
    const leaflet = await import("leaflet");
    L = leaflet.default || leaflet;
    console.log("Leaflet loaded successfully");

    // Fix marker icon issue with webpack
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
      iconUrl: require("leaflet/dist/images/marker-icon.png"),
      shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
    });

    return L;
  } catch (error) {
    console.error("Failed to load Leaflet:", error);
    throw error;
  }
}

export function initializeMap(mapElement, options) {
  if (!L) {
    throw new Error("Leaflet not loaded yet");
  }

  const map = L.map(mapElement, options);

  // Add OpenStreetMap tile layer
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  return map;
}

export function addMarkerToMap(map, position, title) {
  if (!L || !map) return null;

  const marker = L.marker([position.lat, position.lng], { title });
  marker.addTo(map);

  if (title) {
    marker.bindPopup(title);
  }

  return marker;
}

export function addPolylineToMap(map, points, options = {}) {
  if (!map || !points || points.length < 2) {
    console.error("Invalid map or insufficient points for polyline");
    return null;
  }

  try {
    // Convert points to the format Leaflet expects
    const latLngs = points.map((point) => [point.lat, point.lng]);

    // Create and add polyline
    const polyline = L.polyline(latLngs, {
      color: options.color || "#3388ff",
      weight: options.weight || 3,
      opacity: options.opacity !== undefined ? options.opacity : 1.0,
      dashArray: options.dashArray,
    });

    polyline.addTo(map);
    return polyline;
  } catch (error) {
    console.error("Error adding polyline to map:", error);
    return null;
  }
}
