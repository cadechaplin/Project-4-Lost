<template>
  <!-- Root container with full viewport height and light gray background -->
  <div class="min-h-screen bg-gray-100">
    <!-- Application header with Seattle Pathfinding title -->
    <header class="bg-blue-600 text-white p-4 shadow-md">
      <h1 class="text-2xl font-bold">Seattle Pathfinding</h1>
    </header>
    <!-- Main content area with responsive container -->
    <main class="container mx-auto p-4">
      <!-- Instructions panel explaining application functionality -->
      <div class="bg-white rounded-lg shadow-md p-4 mb-4">
        <h2 class="text-xl font-semibold mb-2">Instructions</h2>
        <p>
          Click on the map to select start and end points. The app will
          calculate the route using both OpenStreetMap's OSRM routing and the A*
          algorithm.
        </p>
      </div>

      <!-- Map component that handles all mapping and routing functionality -->
      <MapComponent />
    </main>
  </div>
</template>

<script>
// Import the MapComponent which contains all map rendering and pathfinding logic
import MapComponent from "./components/MapComponent.vue";

export default {
  // Register MapComponent for use in the template
  components: {
    MapComponent,
  },
  // Using Vue 3 Composition API setup function
  // This component delegates all functionality to the MapComponent
  setup() {
    return {};
  },
};
</script>

<style>
/* Import Leaflet CSS to support map rendering and controls */
@import "leaflet/dist/leaflet.css";

/* Ensure Leaflet containers expand to fill their parent elements */
.leaflet-container {
  height: 100%;
  width: 100%;
}
</style>
