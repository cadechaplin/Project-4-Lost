// Haversine formula to calculate distance between two points on Earth
export function calculateHaversineDistance(point1, point2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (point1.lat * Math.PI) / 180;
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
  const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Polyline encoding/decoding functions
export function encodePolyline(points) {
  let result = "";
  let lat = 0;
  let lng = 0;

  for (const point of points) {
    const latDiff = Math.round((point.lat - lat) * 1e5);
    const lngDiff = Math.round((point.lng - lng) * 1e5);

    lat = point.lat;
    lng = point.lng;

    result += encodeNumber(latDiff) + encodeNumber(lngDiff);
  }

  return result;
}

function encodeNumber(num) {
  let result = "";

  num = num < 0 ? ~(num << 1) : num << 1;

  while (num >= 0x20) {
    result += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
    num >>= 5;
  }

  result += String.fromCharCode(num + 63);
  return result;
}

export function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      lat: lat * 1e-5,
      lng: lng * 1e-5,
    });
  }

  return points;
}

export function formatCoordinates(point) {
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
}
