<template>
  <div class="min-h-screen bg-gray-100">
    <header class="bg-blue-600 text-white p-4 shadow-md">
      <h1 class="text-2xl font-bold">Seattle Pathfinding</h1>
    </header>
    <main class="container mx-auto p-4">
      <div class="bg-white rounded-lg shadow-md p-4 mb-4">
        <h2 class="text-xl font-semibold mb-2">Instructions</h2>
        <p>
          Click on the map to select start and end points. The app will
          calculate the route using both OpenStreetMap's OSRM routing and the A*
          algorithm.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="md:col-span-2">
          <div class="bg-white rounded-lg shadow-md p-4">
            <div
              v-if="!mapLoaded"
              class="h-[500px] flex items-center justify-center bg-gray-100"
            >
              <p>Loading map... {{ loadingStatus }}</p>
            </div>

            <div v-show="mapLoaded" class="h-[500px] relative">
              <div
                ref="mapRef"
                class="h-[500px] w-full absolute"
                style="z-index: 1"
              ></div>

              <div
                class="absolute bottom-4 left-0 right-0 z-10 flex items-center justify-center space-x-4 bg-white bg-opacity-75 py-2"
              >
                <div class="flex items-center">
                  <div class="w-4 h-4 bg-blue-500 mr-2"></div>
                  <span>OSRM Route</span>
                </div>
                <div class="flex items-center">
                  <div
                    class="w-4 h-4 bg-red-500 mr-2"
                    style="border-top: 2px dashed"
                  ></div>
                  <span>A* Route</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <PointSelector
            :startPoint="startPoint"
            :endPoint="endPoint"
            :isLoading="isLoading"
            @calculate="calculateRoute"
            @reset="resetPoints"
          />

          <RouteInfo :routeInfo="routeInfo" />
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, onMounted, watch, nextTick } from "vue";
import {
  loadLeaflet,
  initializeMap,
  addMarkerToMap,
  addPolylineToMap,
} from "../services/mapService";
import {
  getOpenStreetMapDirections,
  calculateAStarPath,
} from "../services/routingService";
import { decodePolyline } from "../services/geoUtils";
import PointSelector from "./PointSelector.vue";
import RouteInfo from "./RouteInfo.vue";

export default {
  components: {
    PointSelector,
    RouteInfo,
  },
  setup() {
    const mapLoaded = ref(false);
    const mapRef = ref(null);
    const map = ref(null);
    const leafletMarkers = ref([]);
    const leafletPolylines = ref([]);
    const loadingStatus = ref("Initializing...");
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
      west: -122.459696,
    };

    // Seattle center coordinates
    const center = { lat: 47.6062, lng: -122.3321 };

    const mapOptions = {
      center: [center.lat, center.lng],
      zoom: 12,
      maxBounds: [
        [47.491912, -122.459696], // Southwest
        [47.734145, -122.224433], // Northeast
      ],
      minZoom: 10,
    };

    async function initMap() {
      if (!mapRef.value) {
        console.error("Map reference element not found");
        loadingStatus.value = "Error: Map container not found";
        return;
      }

      try {
        console.log("Creating new map instance");

        // Make sure the map container is visible
        if (mapRef.value.offsetWidth === 0 || mapRef.value.offsetHeight === 0) {
          console.warn("Map container has zero width or height");
        }

        // Initialize the map using our service
        map.value = initializeMap(mapRef.value, mapOptions);

        // Add click event listener
        map.value.on("click", (event) => {
          if (isLoading.value) return;

          const point = {
            lat: event.latlng.lat,
            lng: event.latlng.lng,
          };

          console.log("Map clicked at:", point);
          handlePointSelection(point);
        });

        console.log("Map initialized successfully");
        mapLoaded.value = true;
        loadingStatus.value = "Map loaded successfully";

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
        console.error("Error initializing map:", error);
        loadingStatus.value = `Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
      }
    }

    onMounted(async () => {
      console.log("Component mounted");

      try {
        // Load Leaflet library
        L.value = await loadLeaflet();

        loadingStatus.value = "Waiting for map container...";
        await nextTick();

        loadingStatus.value = "Initializing map...";
        await initMap();
      } catch (error) {
        console.error("Error during map initialization:", error);
        loadingStatus.value = `Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
      }
    });

    function updateMarkers() {
      if (!map.value || !mapLoaded.value || !L.value) {
        console.log("Skipping marker update - map not ready");
        return;
      }

      console.log("Updating markers:", markers.value);

      // Clear existing markers
      leafletMarkers.value.forEach((marker) => marker.remove());
      leafletMarkers.value = [];

      // Add new markers
      markers.value.forEach((marker) => {
        console.log("Adding marker at:", marker.position);
        const newMarker = addMarkerToMap(
          map.value,
          marker.position,
          marker.title
        );
        if (newMarker) {
          leafletMarkers.value.push(newMarker);
        }
      });
    }

    function updatePaths() {
      if (!map.value || !mapLoaded.value || !L.value) {
        console.log("Skipping path update - map not ready");
        return;
      }

      console.log("Updating paths:", {
        osmPath: path.value.length,
        aStarPath: aStarPath.value.length,
      });

      // Clear existing polylines
      leafletPolylines.value.forEach((polyline) => polyline.remove());
      leafletPolylines.value = [];

      // Add OSRM route polyline
      if (path.value.length > 0) {
        const osmPath = addPolylineToMap(map.value, path.value, {
          color: "#4285F4",
          weight: 5,
          opacity: 0.8,
        });

        if (osmPath) {
          leafletPolylines.value.push(osmPath);

          // Fit map to the route bounds
          map.value.fitBounds(osmPath.getBounds(), {
            padding: [50, 50],
          });
        }
      }

      // Add A* route polyline with dashed pattern
      if (aStarPath.value.length > 0) {
        const aStarPolyline = addPolylineToMap(map.value, aStarPath.value, {
          color: "#EA4335",
          weight: 5,
          opacity: 0.8,
          dashArray: "10, 10", // Creates a dashed line
        });

        if (aStarPolyline) {
          leafletPolylines.value.push(aStarPolyline);
        }
      }
    }

    // Watch for changes in markers and paths
    watch(() => markers.value, updateMarkers, { deep: true });
    watch(() => path.value, updatePaths, { deep: true });
    watch(() => aStarPath.value, updatePaths, { deep: true });

    function handlePointSelection(point) {
      // Check if point is within Seattle bounds
      if (
        point.lat < SEATTLE_BOUNDS.south ||
        point.lat > SEATTLE_BOUNDS.north ||
        point.lng < SEATTLE_BOUNDS.west ||
        point.lng > SEATTLE_BOUNDS.east
      ) {
        alert("Please select a point within Seattle city limits");
        return;
      }

      if (!startPoint.value) {
        startPoint.value = point;
        markers.value = [{ position: point, title: "Start" }];
      } else if (!endPoint.value) {
        endPoint.value = point;
        markers.value = [
          { position: startPoint.value, title: "Start" },
          { position: endPoint.value, title: "End" },
        ];
      }
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
      clearLeafletMarkers(); // Clear previous markers

      try {
        // Get OSRM route
        const osrmRoute = await getOpenStreetMapDirections(
          startPoint.value,
          endPoint.value
        );
        path.value = decodePolyline(
          osrmRoute.routes[0].overview_polyline.points
        );

        // Calculate bounds correctly, expanding by 0.03 degrees in each direction
        const bounds = {
          south: Math.min(startPoint.value.lat, endPoint.value.lat) - 0.03,
          north: Math.max(startPoint.value.lat, endPoint.value.lat) + 0.03,
          west: Math.min(startPoint.value.lng, endPoint.value.lng) - 0.03,
          east: Math.max(startPoint.value.lng, endPoint.value.lng) + 0.03,
        };

        console.log("Using bounds for A* calculation:", bounds);

        // Calculate A* route with proper bounds
        console.log("Starting point:", startPoint.value);
        console.log("End point:", endPoint.value);
        const aStarResult = await calculateAStarPath(
          startPoint.value,
          endPoint.value,
          SEATTLE_BOUNDS
        );

        console.log("A* result:", aStarResult);

        console.log(`Nodes Explored: ${aStarResult.routes[0].nodesExplored}`);

        // Handle the result based on its format
        if (aStarResult.routes && aStarResult.routes[0]) {
          // New OSRM format
          aStarPath.value = decodePolyline(
            aStarResult.routes[0].overview_polyline.points
          );

          routeInfo.value = {
            osmDistance: osrmRoute.routes[0].legs[0].distance.text,
            osmDuration: osrmRoute.routes[0].legs[0].duration.text,
            aStarDistance: aStarResult.routes[0].legs[0].distance.text,
            nodesExplored: aStarResult.routes[0].nodesExplored || 0,
          };

          // If the result contains explored nodes, show them on the map
          if (aStarResult.routes[0].exploredNodesList) {
            showExploredNodes(aStarResult.routes[0].exploredNodesList);
          }
        } else {
          // Legacy format (fallback)
          aStarPath.value = aStarResult.path || [];

          routeInfo.value = {
            osmDistance: osrmRoute.routes[0].legs[0].distance.text,
            osmDuration: osrmRoute.routes[0].legs[0].duration.text,
            aStarDistance: `${(aStarResult.distance / 1000).toFixed(2)} km`,
            nodesExplored: aStarResult.nodesExplored || 0,
          };

          // If the result contains explored nodes, show them on the map
          if (aStarResult.exploredNodesList) {
            showExploredNodes(aStarResult.exploredNodesList);
          }
        }

        console.log("A* Path points:", aStarPath.value.length);
        console.log("Nodes explored:", routeInfo.value.nodesExplored);
      } catch (error) {
        console.error("Error calculating route:", error);
        alert(`Failed to calculate route: ${error.message || "Unknown error"}`);
      } finally {
        isLoading.value = false;
      }
    }

    // Function to show explored nodes on the map
    function showExploredNodes(nodes) {
      if (!nodes || !map.value) return;

      console.log(`Showing ${nodes.length} explored nodes on the map`);

      // Add markers for explored nodes
      nodes.forEach((node) => {
        const marker = L.value
          .circleMarker([node.lat, node.lng], {
            radius: 2,
            fillColor: "#ff7800",
            color: "#000",
            weight: 1,
            opacity: 0.5,
            fillOpacity: 0.5,
          })
          .addTo(map.value);

        leafletMarkers.value.push(marker);
      });
    }

    // Function to clear all leaflet markers
    function clearLeafletMarkers() {
      if (!map.value) return;

      leafletMarkers.value.forEach((marker) => {
        map.value.removeLayer(marker);
      });

      leafletMarkers.value = [];
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
      resetPoints,
      calculateRoute,
    };
  },
};
</script>

<style>
/* Additional styles to ensure the map displays properly */
.leaflet-container {
  height: 100%;
  width: 100%;
}
</style>
