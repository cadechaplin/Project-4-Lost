<template>
  <div
    class="bg-red-200 border-4 border-red-600 rounded-lg shadow-md p-4"
    v-if="routeInfo"
  >
    <h2 class="text-xl font-semibold mb-2 text-red-800">
      !!! ROUTE INFORMATION !!!
    </h2>
    <div class="mb-2">
      <h3 class="font-medium">OSRM Route:</h3>
      <p>Distance: {{ routeInfo.osmDistance }}</p>
      <p>Duration: {{ routeInfo.osmDuration }}</p>
    </div>
    <div>
      <h3 class="font-medium">A* Route:</h3>
      <p>Distance: {{ routeInfo.aStarDistance }}</p>
      <p>Nodes Explored: {{ routeInfo.nodesExplored }}</p>
      <p class="font-bold text-red-600">THIS IS THE UPDATED VERSION!</p>
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
  },
};
</script>
