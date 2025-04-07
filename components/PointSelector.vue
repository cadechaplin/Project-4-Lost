<template>
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
        @click="$emit('calculate')"
        class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full"
        :disabled="isLoading"
      >
        {{ isLoading ? "Calculating..." : "Calculate Route" }}
      </button>
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
import { formatCoordinates } from "../services/geoUtils";

export default {
  props: {
    startPoint: Object,
    endPoint: Object,
    isLoading: {
      type: Boolean,
      default: false,
    },
  },
  methods: {
    formatCoordinates,
  },
  emits: ["calculate", "reset"],
};
</script>
