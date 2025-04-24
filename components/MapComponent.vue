<template>
  <!-- Main application container with full-height background -->
  <div class="min-h-screen bg-gray-100">
    <!-- Application header with title -->
    <header class="bg-blue-600 text-white p-4 shadow-md">
      <h1 class="text-2xl font-bold">Seattle Pathfinding</h1>
    </header>
    <main class="container mx-auto p-4">
      <!-- Instructions panel explaining usage -->
      <div class="bg-white rounded-lg shadow-md p-4 mb-4">
        <h2 class="text-xl font-semibold mb-2">Instructions</h2>
        <p>
          Click on the map to select start and end points. The app will
          calculate the route using both OpenStreetMap's OSRM routing and the A*
          algorithm.
        </p>
      </div>

      <!-- Responsive grid layout for map and controls -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Map container (takes 2/3 width on medium+ screens) -->
        <div class="md:col-span-2">
          <div class="bg-white rounded-lg shadow-md p-4">
            <!-- Loading indicator shown until map is initialized -->
            <div
              v-if="!mapLoaded"
              class="h-[500px] flex items-center justify-center bg-gray-100"
            >
              <p>Loading map... {{ loadingStatus }}</p>
            </div>

            <!-- Map container shown after initialization -->
            <div v-show="mapLoaded" class="h-[500px] relative">
              <!-- Leaflet will attach to this div element -->
              <div
                ref="mapRef"
                class="h-[500px] w-full absolute"
                style="z-index: 1"
              ></div>

              <!-- Map legend overlay showing route colors -->
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

        <!-- Sidebar with controls and route information (1/3 width) -->
        <div>
          <!-- Point selection component -->
          <PointSelector
            :points="points"
            :isLoading="isLoading"
            @calculate="calculateRoute"
            @reset="resetPoints"
          />

          <!-- Route information display component -->
          <RouteInfo :routeInfo="routeInfo" />
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, onMounted, watch, nextTick } from "vue";
// Import map and routing services
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
// Import child components
import PointSelector from "./PointSelector.vue";
import RouteInfo from "./RouteInfo.vue";

export default {
  // Register child components
  components: {
    PointSelector,
    RouteInfo,
  },
  setup() {
    // Map initialization and state refs
    const mapLoaded = ref(false);
    const mapRef = ref(null);         // DOM reference to map container
    const map = ref(null);            // Leaflet map instance
    const leafletMarkers = ref([]);   // Markers added to the map
    const leafletPolylines = ref([]); // Route polylines added to the map
    const loadingStatus = ref("Initializing..."); // Map loading status message
    const L = ref(null);              // Leaflet library reference

    // Route planning state refs
    const points = ref([]);           // User-selected geographic points
    const markers = ref([]);          // Marker data for rendering
    const path = ref([]);             // OSRM route path points
    const aStarPath = ref([]);        // A* algorithm route path points
    const isLoading = ref(false);     // Loading state for route calculation
    const routeInfo = ref(null);      // Route comparison information

    // Seattle geographic boundaries (used to constrain point selection)
    const SEATTLE_BOUNDS = {
      north: 47.734145,
      south: 47.491912,
      east: -122.224433,
      west: -122.459696,
    };

    // Seattle center coordinates for initial map view
    const center = { lat: 47.6062, lng: -122.3321 };

    // Leaflet map initialization options
    const mapOptions = {
      center: [center.lat, center.lng],
      zoom: 12,
      maxBounds: [
        [47.491912, -122.459696], // Southwest corner
        [47.734145, -122.224433], // Northeast corner
      ],
      minZoom: 10, // Prevent zooming out too far
    };

    /**
     * Initialize the Leaflet map after the component is mounted
     */
    async function initMap() {
      // Check if the map container exists
      if (!mapRef.value) {
        console.error("Map reference element not found");
        loadingStatus.value = "Error: Map container not found";
        return;
      }

      try {
        console.log("Creating new map instance");

        // Check for zero-size container which would cause Leaflet to fail
        if (mapRef.value.offsetWidth === 0 || mapRef.value.offsetHeight === 0) {
          console.warn("Map container has zero width or height");
        }

        // Initialize the map using the service
        map.value = initializeMap(mapRef.value, mapOptions);

        // Add click handler for point selection
        map.value.on("click", (event) => {
          if (isLoading.value) return; // Ignore clicks while loading

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

        // Force a map resize after it becomes visible for proper rendering
        setTimeout(() => {
          if (map.value) {
            map.value.invalidateSize();
          }
        }, 200);

        // Initialize markers and paths
        updateMarkers();
        updatePaths();
      } catch (error) {
        console.error("Error initializing map:", error);
        loadingStatus.value = `Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
      }
    }

    /**
     * Setup function runs when component is mounted
     */
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

    /**
     * Update map markers based on selected points
     */
    function updateMarkers() {
      // Skip if map is not ready
      if (!map.value || !mapLoaded.value || !L.value) {
        console.log("Skipping marker update - map not ready");
        return;
      }

      console.log("Updating markers:", markers.value);

      // Clear existing markers
      leafletMarkers.value.forEach((marker) => marker.remove());
      leafletMarkers.value = [];

      // Add new markers for all points
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

    /**
     * Update route paths on the map
     */
    function updatePaths() {
      // Skip if map is not ready
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

      // Add OSRM route polyline (blue solid line)
      if (path.value.length > 0) {
        console.log("Drawing OSRM path with", path.value.length, "points");
        const osmPath = addPolylineToMap(map.value, path.value, {
          color: "#4285F4", // Google blue
          weight: 5,
          opacity: 0.8,
        });

        if (osmPath) {
          console.log("OSRM polyline added to map");
          leafletPolylines.value.push(osmPath);

          // Fit map view to show the entire route
          map.value.fitBounds(osmPath.getBounds(), {
            padding: [50, 50], // Add padding around route
          });
        } else {
          console.error("Failed to add OSRM polyline to map");
        }
      } else {
        console.warn("No OSRM path points to display");
      }

      // Add A* route polyline (red dashed line)
      if (aStarPath.value.length > 0) {
        console.log("Drawing A* path with", aStarPath.value.length, "points");
        const aStarPolyline = addPolylineToMap(map.value, aStarPath.value, {
          color: "#EA4335", // Google red
          weight: 5,
          opacity: 0.8,
          dashArray: "10, 10", // Creates a dashed line pattern
        });

        if (aStarPolyline) {
          console.log("A* polyline added to map");
          leafletPolylines.value.push(aStarPolyline);
        } else {
          console.error("Failed to add A* polyline to map");
        }
      } else {
        console.warn("No A* path points to display");
      }

      // Ensure the map redraws correctly
      if (map.value) {
        map.value.invalidateSize();
      }
    }

    // Set up watchers to update UI when state changes
    watch(() => markers.value, updateMarkers, { deep: true });
    watch(() => path.value, updatePaths, { deep: true });
    watch(() => aStarPath.value, updatePaths, { deep: true });

    /**
     * Handle user clicking on the map to select a point
     */
    function handlePointSelection(point) {
      // Validate point is within Seattle bounds
      if (
        point.lat < SEATTLE_BOUNDS.south ||
        point.lat > SEATTLE_BOUNDS.north ||
        point.lng < SEATTLE_BOUNDS.west ||
        point.lng > SEATTLE_BOUNDS.east
      ) {
        alert("Please select a point within Seattle city limits");
        return;
      }

      // Add the point to our collection
      const index = points.value.length;
      points.value.push(point);

      // Update marker data for rendering
      markers.value = points.value.map((pt, i) => ({
        position: pt,
        title: `Point ${i + 1}`,
      }));
    }

    /**
     * Reset all points and routes to start fresh
     */
    function resetPoints() {
      points.value = [];
      markers.value = [];
      path.value = [];
      aStarPath.value = [];
      routeInfo.value = null;
    }

    /**
     * Calculate routes between selected points using both algorithms
     */
    async function calculateRoute() {
      if (points.value.length < 2) {
        alert("Select at least two points.");
        return;
      }

      // Set loading state and clear previous data
      isLoading.value = true;
      path.value = [];
      aStarPath.value = [];
      routeInfo.value = null;
      clearLeafletMarkers(); // Clear previous markers

      try {
        // Initialize counters for total metrics
        let totalOSMDistance = 0;
        let totalOSMDuration = 0;
        let totalAStarDistance = 0;
        let totalNodesExplored = 0;

        // Calculate route for each segment between consecutive points
        for (let i = 0; i < points.value.length - 1; i++) {
          const from = points.value[i];
          const to = points.value[i + 1];

          console.log(`Calculating route from point ${i + 1} to point ${i + 2}`);

        // Get OSRM route for the blue line
        const osrmSegment = await getOpenStreetMapDirections(from, to);
        if (osrmSegment?.routes?.[0]) {
          const segment = osrmSegment.routes[0];
          const segmentPath = decodePolyline(segment.overview_polyline.points);
          path.value.push(...segmentPath);

          // Add segment metrics to totals
          totalOSMDistance += segment.legs[0].distance.value;
          totalOSMDuration += segment.legs[0].duration.value;
        }

        // Get A* route with optimized boundaries around the segment
        const padding = 0.005; // ~500m padding
        const smallerBounds = {
          south: Math.max(Math.min(from.lat, to.lat) - padding, SEATTLE_BOUNDS.south),
          north: Math.min(Math.max(from.lat, to.lat) + padding, SEATTLE_BOUNDS.north),
          west: Math.max(Math.min(from.lng, to.lng) - padding, SEATTLE_BOUNDS.west),
          east: Math.min(Math.max(from.lng, to.lng) + padding, SEATTLE_BOUNDS.east),
        };

        // Calculate A* path for this segment
        const aStarSegment = await calculateAStarPath(from, to, smallerBounds);
        if (aStarSegment?.routes?.[0]) {
          const segment = aStarSegment.routes[0];
          const segmentPath = decodePolyline(segment.overview_polyline.points);
          aStarPath.value.push(...segmentPath);

          // Add A* metrics to totals
          totalAStarDistance += segment?.legs?.[0]?.distance?.value || 0;
          totalNodesExplored += segment?.nodesExplored || 0;
        } else {
          console.warn("A* failed for segment. Falling back to OSRM path segment.");
          aStarPath.value.push(...path.value);
        }
      }

      // Create the route info object for display
      routeInfo.value = {
        osmDistance: (totalOSMDistance / 1000).toFixed(2) + " km",
        osmDuration: (totalOSMDuration / 60).toFixed(2) + " min",
        aStarDistance: (totalAStarDistance / 1000).toFixed(2) + " km",
        nodesExplored: totalNodesExplored,
      };

      // Wait for Vue to update before redrawing paths
      await nextTick();
      updatePaths();
    } catch (error) {
      console.error("Error calculating routes:", error);
      alert("Error calculating routes. Please try again.");
    } finally {
      isLoading.value = false;
    }
    }

    /**
     * Remove all Leaflet markers from the map
     */
    function clearLeafletMarkers() {
      if (!map.value) return;

      leafletMarkers.value.forEach((marker) => {
        map.value.removeLayer(marker);
      });

      leafletMarkers.value = [];
    }

    // Return the reactive data and methods for the template
    return {
      mapLoaded,
      mapRef,
      loadingStatus,
      points,
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
