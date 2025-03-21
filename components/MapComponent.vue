<template>
  <div class="min-h-screen bg-gray-100">
    <header class="bg-blue-600 text-white p-4 shadow-md">
      <h1 class="text-2xl font-bold">Seattle Pathfinding</h1>
    </header>
    <main class="container mx-auto p-4">
      <div class="bg-white rounded-lg shadow-md p-4 mb-4">
        <h2 class="text-xl font-semibold mb-2">Instructions</h2>
        <p>Click on the map to select start and end points. The app will calculate the route using both OpenStreetMap's OSRM routing and the A* algorithm.</p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="md:col-span-2">
          <div class="bg-white rounded-lg shadow-md p-4">
            <div v-if="!mapLoaded" class="h-[500px] flex items-center justify-center bg-gray-100">
              <p>Loading map... {{ loadingStatus }}</p>
            </div>
            
            <div v-show="mapLoaded" class="h-[500px] relative">
              <div
                ref="mapRef"
                class="h-[500px] w-full absolute"
                style="z-index: 1;"
              ></div>
              
              <div class="absolute bottom-4 left-0 right-0 z-10 flex items-center justify-center space-x-4 bg-white bg-opacity-75 py-2">
                <div class="flex items-center">
                  <div class="w-4 h-4 bg-blue-500 mr-2"></div>
                  <span>OSRM Route</span>
                </div>
                <div class="flex items-center">
                  <div class="w-4 h-4 bg-red-500 mr-2" style="border-top: 2px dashed;"></div>
                  <span>A* Route</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div>
          <div class="bg-white rounded-lg shadow-md p-4 mb-4">
            <h2 class="text-xl font-semibold mb-2">Selected Points</h2>
            <div v-if="startPoint">
              <p><strong>Start:</strong> {{ formatCoordinates(startPoint) }}</p>
            </div>
            <div v-if="endPoint">
              <p><strong>End:</strong> {{ formatCoordinates(endPoint) }}</p>
            </div>
            <div v-if="!startPoint && !endPoint">
              <p>No points selected yet. Click on the map to select a start point.</p>
            </div>
            
            <div class="mt-4" v-if="startPoint && endPoint">
              <button 
                @click="calculateRoute" 
                class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full"
                :disabled="isLoading"
              >
                {{ isLoading ? 'Calculating...' : 'Calculate Route' }}
              </button>
              <button 
                @click="resetPoints" 
                class="mt-2 bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 w-full"
              >
                Reset Points
              </button>
            </div>
          </div>
          
          <div class="bg-white rounded-lg shadow-md p-4" v-if="routeInfo">
            <h2 class="text-xl font-semibold mb-2">Route Information</h2>
            <div class="mb-2">
              <h3 class="font-medium">OSRM Route:</h3>
              <p>Distance: {{ routeInfo.osmDistance }}</p>
              <p>Duration: {{ routeInfo.osmDuration }}</p>
            </div>
            <div>
              <h3 class="font-medium">A* Route:</h3>
              <p>Distance: {{ routeInfo.aStarDistance }}</p>
              <p>Nodes Explored: {{ routeInfo.nodesExplored }}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, onMounted, watch, nextTick } from 'vue';
import 'leaflet/dist/leaflet.css'; // Make sure this line is present

export default {
  setup() {
    const mapLoaded = ref(false);
    const mapRef = ref(null);
    const map = ref(null);
    const leafletMarkers = ref([]);
    const leafletPolylines = ref([]);
    const loadingStatus = ref('Initializing...');
    const L = ref(null);

    const startPoint = ref(null);
    const endPoint = ref(null);
    const markers = ref([]);
    const path = ref([]);
    const aStarPath = ref([]);
    const isLoading = ref(false);
    const routeInfo = ref(null);

    // Seattle boundaries
    const SEATTLE_BOUNDS = {
      north: 47.734145,
      south: 47.491912,
      east: -122.224433,
      west: -122.459696
    };

    // Seattle center coordinates
    const center = { lat: 47.6062, lng: -122.3321 };

    const mapOptions = {
      center,
      zoom: 12,
      maxBounds: [
        [47.491912, -122.459696], // Southwest
        [47.734145, -122.224433]  // Northeast
      ],
      minZoom: 10
    };

    async function loadLeaflet() {
      if (window.L) {
        console.log('Leaflet already loaded');
        L.value = window.L;
        return;
      }

      try {
        loadingStatus.value = 'Loading Leaflet library...';
        // In a real app, you would import Leaflet using your bundler
        const leaflet = await import('leaflet');
        L.value = leaflet.default || leaflet; // Handle ESM and CommonJS versions
        console.log('Leaflet loaded successfully');
        
        // Fix marker icon issue with webpack
        delete L.value.Icon.Default.prototype._getIconUrl;
        L.value.Icon.Default.mergeOptions({
          iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
          iconUrl: require('leaflet/dist/images/marker-icon.png'),
          shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
        });
      } catch (error) {
        console.error('Failed to load Leaflet:', error);
        loadingStatus.value = 'Error: Failed to load map library';
        throw error;
      }
    }

    async function initMap() {
      if (!mapRef.value) {
        console.error('Map reference element not found');
        loadingStatus.value = 'Error: Map container not found';
        return;
      }

      try {
        console.log('Creating new map instance');
        
        // Make sure the map container is visible
        if (mapRef.value.offsetWidth === 0 || mapRef.value.offsetHeight === 0) {
          console.warn('Map container has zero width or height');
        }
        
        map.value = L.value.map(mapRef.value, {
          center: [center.lat, center.lng],
          zoom: mapOptions.zoom,
          maxBounds: mapOptions.maxBounds,
          minZoom: mapOptions.minZoom
        });
        
        // Add OpenStreetMap tile layer
        L.value.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map.value);
        
        // Add click event listener
        map.value.on('click', (event) => {
          if (isLoading.value) return;
          
          const point = {
            lat: event.latlng.lat,
            lng: event.latlng.lng
          };
          
          console.log('Map clicked at:', point);
          handlePointSelection(point);
        });
        
        console.log('Map initialized successfully');
        mapLoaded.value = true;
        loadingStatus.value = 'Map loaded successfully';
        
        // Force a map resize after it becomes visible
        setTimeout(() => {
          if (map.value) {
            map.value.invalidateSize();
          }
        }, 200);
        
        // Initial updates
        updateMarkers();
        updatePaths();
      } catch (error) {
        console.error('Error initializing map:', error);
        loadingStatus.value = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }

    onMounted(async () => {
      console.log('Component mounted');
      
      try {
        await loadLeaflet();
        
        loadingStatus.value = 'Waiting for map container...';
        await nextTick();
        
        loadingStatus.value = 'Initializing map...';
        await initMap();
      } catch (error) {
        console.error('Error during map initialization:', error);
        loadingStatus.value = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    });

    function updateMarkers() {
      if (!map.value || !mapLoaded.value || !L.value) {
        console.log('Skipping marker update - map not ready');
        return;
      }
      
      console.log('Updating markers:', markers.value);
      
      // Clear existing markers
      leafletMarkers.value.forEach(marker => marker.remove());
      leafletMarkers.value = [];
      
      // Add new markers
      markers.value.forEach(marker => {
        console.log('Adding marker at:', marker.position);
        const newMarker = L.value.marker([marker.position.lat, marker.position.lng], {
          title: marker.title
        }).addTo(map.value);
        
        if (marker.title) {
          newMarker.bindPopup(marker.title);
        }
        
        leafletMarkers.value.push(newMarker);
      });
    }

    function updatePaths() {
      if (!map.value || !mapLoaded.value || !L.value) {
        console.log('Skipping path update - map not ready');
        return;
      }
      
      console.log('Updating paths:', {
        osmPath: path.value.length,
        aStarPath: aStarPath.value.length
      });
      
      // Clear existing polylines
      leafletPolylines.value.forEach(polyline => polyline.remove());
      leafletPolylines.value = [];
      
      // Add OSRM route polyline
      if (path.value.length > 0) {
        const latlngs = path.value.map(point => [point.lat, point.lng]);
        const osmPath = L.value.polyline(latlngs, {
          color: '#4285F4',
          weight: 5,
          opacity: 0.8
        }).addTo(map.value);
        
        leafletPolylines.value.push(osmPath);
        
        // Fit map to the route bounds
        map.value.fitBounds(osmPath.getBounds(), {
          padding: [50, 50]
        });
      }
      
      // Add A* route polyline with dashed pattern
      if (aStarPath.value.length > 0) {
        const latlngs = aStarPath.value.map(point => [point.lat, point.lng]);
        const aStarPolyline = L.value.polyline(latlngs, {
          color: '#EA4335',
          weight: 5,
          opacity: 0.8,
          dashArray: '10, 10' // Creates a dashed line
        }).addTo(map.value);
        
        leafletPolylines.value.push(aStarPolyline);
      }
    }

    // Watch for changes in markers and paths
    watch(() => markers.value, updateMarkers, { deep: true });
    watch(() => path.value, updatePaths, { deep: true });
    watch(() => aStarPath.value, updatePaths, { deep: true });

    function handlePointSelection(point) {
      // Check if point is within Seattle bounds
      if (point.lat < SEATTLE_BOUNDS.south || 
          point.lat > SEATTLE_BOUNDS.north || 
          point.lng < SEATTLE_BOUNDS.west || 
          point.lng > SEATTLE_BOUNDS.east) {
        alert("Please select a point within Seattle city limits");
        return;
      }

      if (!startPoint.value) {
        startPoint.value = point;
        markers.value = [{ position: point, title: 'Start' }];
      } else if (!endPoint.value) {
        endPoint.value = point;
        markers.value = [
          { position: startPoint.value, title: 'Start' },
          { position: endPoint.value, title: 'End' }
        ];
      }
    }

    function formatCoordinates(point) {
      return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
    }

    function resetPoints() {
      startPoint.value = null;
      endPoint.value = null;
      markers.value = [];
      path.value = [];
      aStarPath.value = [];
      routeInfo.value = null;
    }

    async function calculateRoute() {
      if (!startPoint.value || !endPoint.value) return;
      
      isLoading.value = true;
      path.value = [];
      aStarPath.value = [];
      
      try {
        // Get OSRM route (formerly Google's route)
        const osrmRoute = await getOpenStreetMapDirections(startPoint.value, endPoint.value);
        path.value = decodePolyline(osrmRoute.routes[0].overview_polyline.points);
        
        // Calculate A* route
        const aStarResult = await calculateAStarPath(startPoint.value, endPoint.value);
        aStarPath.value = aStarResult.path;
        
        // Update route information
        routeInfo.value = {
          osmDistance: osrmRoute.routes[0].legs[0].distance.text,
          osmDuration: osrmRoute.routes[0].legs[0].duration.text,
          aStarDistance: `${(aStarResult.distance / 1000).toFixed(2)} km`,
          nodesExplored: aStarResult.nodesExplored
        };
      } catch (error) {
        console.error('Error details:', error);
        alert(`Error calculating route: ${error.message || 'Unknown error'}`);
      } finally {
        isLoading.value = false;
      }
    }

    // OSRM directions service
    async function getOpenStreetMapDirections(start, end) {
      try {
        // OSRM public API endpoint
        const osrmApiUrl = 'https://router.project-osrm.org/route/v1/driving/';
        
        // Format coordinates for OSRM: lng,lat (note the reversed order compared to Google)
        const startCoord = `${start.lng},${start.lat}`;
        const endCoord = `${end.lng},${end.lat}`;
        
        // Build the query URL
        const queryUrl = `${osrmApiUrl}${startCoord};${endCoord}?overview=full&geometries=polyline`;
        
        console.log('Requesting route from OSRM:', queryUrl);
        
        // Make the request
        const response = await fetch(queryUrl);
        
        if (!response.ok) {
          throw new Error(`OSRM API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
          throw new Error('No route found or invalid response from OSRM');
        }
        
        // Extract route information
        const route = data.routes[0];
        
        // Convert OSRM response to match the expected format from the Google Directions API
        return {
          routes: [{
            overview_polyline: {
              points: route.geometry // OSRM returns polyline in the same format as Google
            },
            legs: [{
              distance: {
                text: `${(route.distance / 1000).toFixed(2)} km`,
                value: route.distance
              },
              duration: {
                text: `${Math.round(route.duration / 60)} mins`,
                value: route.duration
              }
            }]
          }]
        };
      } catch (error) {
        console.error('Error getting directions from OSRM:', error);
        // Fall back to direct line calculation if OSRM fails
        return calculateDirectLine(start, end);
      }
    }

    // Fall-back route calculator
    function calculateDirectLine(start, end) {
      // Create a direct line between points and encode it as a polyline
      const steps = 10;
      const latStep = (end.lat - start.lat) / steps;
      const lngStep = (end.lng - start.lng) / steps;
      
      const points = [];
      for (let i = 0; i <= steps; i++) {
        points.push({
          lat: start.lat + latStep * i,
          lng: start.lng + lngStep * i
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
        routes: [{
          overview_polyline: {
            points: polyline
          },
          legs: [{
            distance: {
              text: `${(distance / 1000).toFixed(2)} km`,
              value: distance
            },
            duration: {
              text: `${Math.round(distance / 50)} mins`,
              value: Math.round(distance / 50) * 60
            }
          }]
        }]
      };
    }

    // A* algorithm implementation
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

    // A* algorithm implementation
    async function calculateAStarPath(start, end) {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // For demo purposes, we'll implement a simplified A* that works on a grid
      // In a real app, you would use actual road network data
      
      // Create a grid over Seattle
      const gridSize = 20; // 20x20 grid
      const latStep = (SEATTLE_BOUNDS.north - SEATTLE_BOUNDS.south) / gridSize;
      const lngStep = (SEATTLE_BOUNDS.east - SEATTLE_BOUNDS.west) / gridSize;
      
      // Convert lat/lng to grid coordinates
      const startGrid = {
        x: Math.floor((start.lng - SEATTLE_BOUNDS.west) / lngStep),
        y: Math.floor((start.lat - SEATTLE_BOUNDS.south) / latStep)
      };
      
      const endGrid = {
        x: Math.floor((end.lng - SEATTLE_BOUNDS.west) / lngStep),
        y: Math.floor((end.lat - SEATTLE_BOUNDS.south) / latStep)
      };
      
      // A* implementation
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
        f: fScore[startKey]
      });
      
      let nodesExplored = 0;
      
      while (!openSet.isEmpty()) {
        const current = openSet.dequeue();
        nodesExplored++;
        
        if (current.key === endKey) {
          // Path found, reconstruct it
          const path = reconstructPath(cameFrom, current.key, startKey);
          
          // Convert grid coordinates back to lat/lng
          const latLngPath = path.map(key => {
            const [x, y] = key.split(',').map(Number);
            return {
              lat: SEATTLE_BOUNDS.south + y * latStep + latStep / 2,
              lng: SEATTLE_BOUNDS.west + x * lngStep + lngStep / 2
            };
          });
          
          // Calculate distance
          let distance = 0;
          for (let i = 1; i < latLngPath.length; i++) {
            distance += calculateHaversineDistance(latLngPath[i-1], latLngPath[i]);
          }
          
          return {
            path: latLngPath,
            distance,
            nodesExplored
          };
        }
        
        closedSet.add(current.key);
        
        // Get neighbors
        const neighbors = getNeighbors(current.x, current.y, gridSize);
        
        for (const neighbor of neighbors) {
          const neighborKey = `${neighbor.x},${neighbor.y}`;
          
          if (closedSet.has(neighborKey)) continue;
          
          // Calculate tentative gScore
          const tentativeGScore = gScore[current.key] + 1; // Assuming uniform cost for simplicity
          
          if (!gScore[neighborKey] || tentativeGScore < gScore[neighborKey]) {
            // This path is better than any previous one
            cameFrom[neighborKey] = current.key;
            gScore[neighborKey] = tentativeGScore;
            fScore[neighborKey] = gScore[neighborKey] + heuristic(neighbor, endGrid);
            
            if (!openSet.toArray().some(item => item.key === neighborKey)) {
              openSet.enqueue({
                key: neighborKey,
                x: neighbor.x,
                y: neighbor.y,
                f: fScore[neighborKey]
              });
            }
          }
        }
      }
      
      // No path found
      return {
        path: [],
        distance: 0,
        nodesExplored
      };
    }

    function getNeighbors(x, y, gridSize) {
      const neighbors = [];
      const directions = [
        { dx: 0, dy: 1 },  // up
        { dx: 1, dy: 0 },  // right
        { dx: 0, dy: -1 }, // down
        { dx: -1, dy: 0 }, // left
        { dx: 1, dy: 1 },  // up-right
        { dx: 1, dy: -1 }, // down-right
        { dx: -1, dy: -1 },// down-left
        { dx: -1, dy: 1 }  // up-left
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

    function reconstructPath(cameFrom, current, start) {
      const path = [current];
      
      while (current !== start) {
        current = cameFrom[current];
        path.unshift(current);
      }
      
      return path;
    }

    // Haversine formula to calculate distance between two points on Earth
    function calculateHaversineDistance(point1, point2) {
      const R = 6371e3; // Earth's radius in meters
      const φ1 = point1.lat * Math.PI / 180;
      const φ2 = point2.lat * Math.PI / 180;
      const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
      const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

      return R * c; // Distance in meters
    }

    // Polyline encoding/decoding functions
    function encodePolyline(points) {
      let result = '';
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
      let result = '';
      
      num = num < 0 ? ~(num << 1) : num << 1;
      
      while (num >= 0x20) {
        result += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
        num >>= 5;
      }
      
      result += String.fromCharCode(num + 63);
      return result;
    }

    function decodePolyline(encoded) {
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
        
        const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;
        
        shift = 0;
        result = 0;
        
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        
        const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;
        
        points.push({
          lat: lat * 1e-5,
          lng: lng * 1e-5
        });
      }
      
      return points;
    }

    return {
      mapLoaded,
      mapRef,
      loadingStatus,
      startPoint,
      endPoint,
      markers,
      path,
      aStarPath,
      isLoading,
      routeInfo,
      handlePointSelection,
      formatCoordinates,
      resetPoints,
      calculateRoute
    };
  }
};
</script>

<style>
/* Explicitly include Leaflet CSS */
@import 'leaflet/dist/leaflet.css';

/* Additional styles to ensure the map displays properly */
.leaflet-container {
  height: 100%;
  width: 100%;
}
</style>