import {
  getOpenStreetMapDirections,
  calculateAStarPath,
} from "./services/routingService.js";

// Mock data for testing
const startPoint = { lat: 47.608246, lng: -122.332303 }; // Seattle downtown
const endPoint = { lat: 47.603501, lng: -122.322514 }; // Space Needle
const SEATTLE_BOUNDS = {
  south: 47.573501, // Made smaller for more focused test
  north: 47.638246,
  west: -122.362303,
  east: -122.292514,
};

async function testRoutingService() {
  console.log("Starting tests for routingService.js...");

  try {
    // Test OSRM-based routing
    console.log("\nTesting OSRM-based routing...");
    const osrmRoute = await getOpenStreetMapDirections(startPoint, endPoint);
    console.log("OSRM Route:");
    console.log(`Distance: ${osrmRoute.routes[0].legs[0].distance.text}`);
    console.log(`Duration: ${osrmRoute.routes[0].legs[0].duration.text}`);
    console.log(
      `Polyline length: ${osrmRoute.routes[0].overview_polyline.points.length} chars`
    );

    // Test A* algorithm
    console.log("\nTesting A* algorithm...");
    const aStarResult = await calculateAStarPath(
      startPoint,
      endPoint,
      SEATTLE_BOUNDS
    );
    console.log("A* Result (in OSRM format):");
    console.log(aStarResult);
    console.log(`Distance: ${aStarResult.routes[0].legs[0].distance.text}`);
    console.log(`Duration: ${aStarResult.routes[0].legs[0].duration.text}`);
    console.log(
      `Polyline length: ${aStarResult.routes[0].overview_polyline.points.length} chars`
    );
    console.log(`Nodes Explored: ${aStarResult.routes[0].nodesExplored}`);

    // Decode the polyline to get the actual path points
    const { decodePolyline } = await import("./services/geoUtils.js");
    const pathPoints = decodePolyline(
      aStarResult.routes[0].overview_polyline.points
    );

    console.log(`\nA* Path contains ${pathPoints.length} points:`);
    pathPoints.forEach((point, index) => {
      console.log(
        `Point ${index + 1}: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`
      );
    });

    // Print explored nodes list if available
    if (aStarResult.routes[0].exploredNodesList) {
      console.log(
        `\nAll ${aStarResult.routes[0].exploredNodesList.length} explored nodes:`
      );
      console.log(
        JSON.stringify(
          aStarResult.routes[0].exploredNodesList.slice(0, 10),
          null,
          2
        ) + "..."
      );
    }
  } catch (error) {
    console.error("Error during tests:", error);
  }
}

testRoutingService();
