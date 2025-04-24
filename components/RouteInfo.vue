<template>
  <div class="bg-white rounded-lg shadow-md p-4 mb-4 mt-4">
    <h2 class="text-xl font-semibold mb-2">Route Information</h2>

    <!-- No route info message -->
    <div v-if="!routeInfo" class="text-gray-500">
      No route calculated yet. Select points and click "Calculate Route".
    </div>

    <!-- Route info content -->
    <div v-else>
      <div class="mb-4">
        <h3 class="font-semibold text-blue-600">OSRM Route</h3>
        <div class="grid grid-cols-2 gap-2">
          <div>Distance:</div>
          <div>{{ routeInfo.osmDistance }}</div>
          <div>Duration:</div>
          <div>{{ routeInfo.osmDuration }}</div>
        </div>
      </div>

      <!-- A* Heuristic Results -->
      <div class="mb-4">
        <h3 class="font-semibold text-red-600">A* Algorithm Heuristics</h3>

        <div
          v-for="result in heuristicResults"
          :key="result.heuristic"
          class="mt-3 pb-2 border-b border-gray-200"
        >
          <div class="flex items-center mb-1">
            <div
              class="w-3 h-3 mr-2"
              :style="{ backgroundColor: result.color }"
            ></div>
            <strong>{{ result.label }}</strong>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>Distance:</div>
            <div>{{ result.distance }}</div>
            <div>Nodes Explored:</div>
            <div>{{ result.nodesExplored.toLocaleString() }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    routeInfo: {
      type: Object,
      default: null,
    },
    heuristicResults: {
      type: Array,
      default: () => [],
    },
  },
};
</script>
