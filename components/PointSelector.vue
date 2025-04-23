<template>
  <div class="bg-white rounded-lg shadow-md p-4 mb-4">
    <h2 class="text-xl font-semibold mb-2">Selected Points</h2>

    <div v-if="points.length">
      <ul class="space-y-1">
        <li v-for="(point, index) in points" :key="index">
          <strong>Point {{ index + 1 }}:</strong> {{ formatCoordinates(point) }}
        </li>
      </ul>
    </div>

    <div v-else>
      <p>No points selected yet. Click on the map to add points.</p>
    </div>

    <div class="mt-4" v-if="points.length >= 2">
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
    points: {
      type: Array,
      default: () => [],
    },
    isLoading: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["calculate", "reset"],
  methods: {
    formatCoordinates,
  },
};
</script>