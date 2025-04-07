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
          <MapComponent />
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
              <p>
                No points selected yet. Click on the map to select a start
                point.
              </p>
            </div>

            <div class="mt-4" v-if="startPoint && endPoint">
              <button
                @click="calculateRoute"
                class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full"
                :disabled="isLoading"
              >
                {{ isLoading ? "Calculating..." : "Calculate Route" }}
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
import MapComponent from "./components/MapComponent.vue";

export default {
  components: {
    MapComponent,
  },
  setup() {
    return {};
  },
};
</script>

<style>
/* Explicitly include Leaflet CSS */
@import "leaflet/dist/leaflet.css";

/* Additional styles to ensure the map displays properly */
.leaflet-container {
  height: 100%;
  width: 100%;
}
</style>
