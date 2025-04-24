<template>
  <!-- Container for displaying and managing selected points -->
  <div class="bg-white rounded-lg shadow-md p-4 mb-4">
    <h2 class="text-xl font-semibold mb-2">Selected Points</h2>

    <!-- Display list of selected points with coordinates -->
    <div v-if="points.length">
      <ul class="space-y-1">
        <li v-for="(point, index) in points" :key="index">
          <strong>Point {{ index + 1 }}:</strong> {{ formatCoordinates(point) }}
        </li>
      </ul>
    </div>

    <!-- Instructions shown when no points are selected -->
    <div v-else>
      <p>No points selected yet. Click on the map to add points.</p>
    </div>

    <!-- Action buttons that appear when at least 2 points are selected -->
    <div class="mt-4" v-if="points.length >= 2">
      <!-- Calculate route button - emits 'calculate' event to parent -->
      <button
        @click="$emit('calculate')"
        class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full"
        :disabled="isLoading"
      >
        {{ isLoading ? "Calculating..." : "Calculate Route" }}
      </button>

      <!-- Reset points button - emits 'reset' event to parent -->
      <button
        @click="$emit('reset')"
        class="mt-2 bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 w-full"
      >
        Reset Points
      </button>
    </div>
  </div>
</template>

<script>
// Import utility function to format coordinates as readable strings
import { formatCoordinates } from "../services/geoUtils";

export default {
  // Component props definition
  props: {
    // Array of geographic points (lat/lng objects) selected by the user
    points: {
      type: Array,
      default: () => [], // Default to empty array if not provided
    },
    // Loading state to disable the calculate button during route calculation
    isLoading: {
      type: Boolean,
      default: false,
    },
  },
  // Events emitted by this component to its parent
  emits: ["calculate", "reset"],
  // Methods available to the component
  methods: {
    // Make the formatCoordinates utility available to the template
    formatCoordinates,
  },
};
</script>