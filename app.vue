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

      <!-- Map component with full functionality -->
      <MapComponent />
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
