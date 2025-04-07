import fs from "fs";
import path from "path";
// Modified imports to match your actual file structure
import { AStar } from "./AStar.js";
import { ORSM } from "./ORSM.js";
import { LOSM } from "./LOSM.js";
import { ORSMCoverageCache } from "./ORSMCoverageCache.js";
import { ORSMVisitCache } from "./ORSMVisitCache.js";
import { MapImport } from "./importmap.js";

/**
 * Test a pathfinding algorithm and print detailed metrics
 * @param {string} algorithmName - Name of the algorithm
 * @param {string} mapPath - Path to the map file
 * @param {Array} start - Starting coordinates [row, col]
 * @param {Array} goal - Goal coordinates [row, col]
 * @returns {Object} Result metrics
 */
function testAlgorithm(algorithmName, mapPath, start, goal) {
  console.log(`\n========== Testing ${algorithmName} ==========`);
  console.log(`Map: ${mapPath}`);
  console.log(`Start: (${start[0]}, ${start[1]})`);
  console.log(`Goal: (${goal[0]}, ${goal[1]})`);

  const mapImport = new MapImport(mapPath, true); // allowDiag=true
  const gridMap = mapImport.get_grid_map();

  let algorithm;
  switch (algorithmName) {
    case "AStar":
      algorithm = new AStar(gridMap);
      break;
    case "ORSM":
      algorithm = new ORSM(gridMap);
      break;
    case "LOSM":
      algorithm = new LOSM(gridMap);
      break;
    case "ORSMCoverageCache":
      algorithm = new ORSMCoverageCache(gridMap);
      break;
    case "ORSMVisitCache":
      algorithm = new ORSMVisitCache(gridMap);
      break;
    default:
      console.error(`Unknown algorithm: ${algorithmName}`);
      return null;
  }

  const startTime = process.hrtime();
  const path = algorithm.search(start, goal);
  const endTime = process.hrtime(startTime);
  const executionTimeMs = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);

  if (!path) {
    console.log(`No path found from ${start} to ${goal}`);
    return {
      success: false,
      nodesExpanded: algorithm.nodes_expanded,
      timeMs: executionTimeMs,
    };
  }

  const result = {
    success: true,
    pathLength: path.length,
    nodesExpanded: algorithm.nodes_expanded,
    timeMs: executionTimeMs,
    path: path,
  };

  // Print results
  console.log(`Path found with ${path.length} steps`);
  console.log(`Execution time: ${executionTimeMs} ms`);
  console.log(`Nodes expanded: ${algorithm.nodes_expanded}`);
  console.log(`Path:`);

  // Log path in a readable format, but limit to first and last 5 nodes if long
  if (path.length > 10) {
    console.log(`  First 5 nodes: ${JSON.stringify(path.slice(0, 5))}`);
    console.log(`  ... ${path.length - 10} nodes omitted ...`);
    console.log(`  Last 5 nodes: ${JSON.stringify(path.slice(-5))}`);
  } else {
    console.log(`  ${JSON.stringify(path)}`);
  }

  // Create a path visualization in ASCII
  createAsciiVisualization(gridMap, path, start, goal);

  return result;
}

/**
 * Create a simple ASCII visualization of the path
 */
function createAsciiVisualization(gridMap, path, start, goal) {
  if (!path || path.length === 0) return;

  // Create a copy of the grid for visualization
  const height = gridMap.length;
  const width = gridMap[0].length;
  const visualGrid = Array(height)
    .fill()
    .map(() => Array(width).fill(" "));

  // Mark obstacles
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      if (gridMap[i][j] === 1) {
        // Assuming 1 means obstacle
        visualGrid[i][j] = "#";
      }
    }
  }

  // Mark the path
  path.forEach(([row, col]) => {
    visualGrid[row][col] = ".";
  });

  // Mark start and goal
  visualGrid[start[0]][start[1]] = "S";
  visualGrid[goal[0]][goal[1]] = "G";

  console.log("\nPath Visualization:");

  // Only show a window around the path to keep output manageable
  const pathPoints = path.concat([start, goal]);
  const minRow = Math.max(0, Math.min(...pathPoints.map((p) => p[0])) - 5);
  const maxRow = Math.min(
    height - 1,
    Math.max(...pathPoints.map((p) => p[0])) + 5
  );
  const minCol = Math.max(0, Math.min(...pathPoints.map((p) => p[1])) - 5);
  const maxCol = Math.min(
    width - 1,
    Math.max(...pathPoints.map((p) => p[1])) + 5
  );

  console.log(
    `  Showing window from (${minRow},${minCol}) to (${maxRow},${maxCol})`
  );

  for (let i = minRow; i <= maxRow; i++) {
    let rowStr = "";
    for (let j = minCol; j <= maxCol; j++) {
      rowStr += visualGrid[i][j];
    }
    console.log(`  ${rowStr}`);
  }
}

/**
 * Compare multiple algorithms on the same map
 */
function compareAlgorithms(mapPath, start, goal, algorithms = null) {
  if (!algorithms) {
    algorithms = [
      "AStar",
      "ORSM",
      "LOSM",
      "ORSMCoverageCache",
      "ORSMVisitCache",
    ];
  }

  console.log("\n===== ALGORITHM COMPARISON =====");
  console.log(`Map: ${mapPath}`);
  console.log(`Start: (${start[0]}, ${start[1]})`);
  console.log(`Goal: (${goal[0]}, ${goal[1]})`);

  const results = {};

  algorithms.forEach((algo) => {
    console.log(`\nRunning ${algo}...`);
    results[algo] = testAlgorithm(algo, mapPath, start, goal);
  });

  // Print comparison table
  console.log("\n===== RESULTS SUMMARY =====");
  console.log(
    "Algorithm".padEnd(20) +
      "Path Length".padEnd(15) +
      "Nodes Expanded".padEnd(20) +
      "Time (ms)".padEnd(15)
  );
  console.log("-".repeat(70));

  Object.entries(results).forEach(([algo, data]) => {
    if (!data || !data.success) {
      console.log(
        `${algo.padEnd(20)}No path found`.padEnd(50) +
          `${data?.nodesExpanded || "N/A"}`.padEnd(20) +
          `${data?.timeMs || "N/A"}`
      );
    } else {
      console.log(
        `${algo.padEnd(20)}${data.pathLength}`.padEnd(15) +
          `${data.nodesExpanded}`.padEnd(20) +
          `${data.timeMs}`
      );
    }
  });

  // Calculate efficiency metrics
  console.log("\n===== EFFICIENCY METRICS =====");

  const baseAlgo = algorithms[0];
  if (results[baseAlgo] && results[baseAlgo].success) {
    console.log(`Relative to ${baseAlgo}:`);

    algorithms.slice(1).forEach((algo) => {
      if (results[algo] && results[algo].success) {
        const pathRatio = (
          results[algo].pathLength / results[baseAlgo].pathLength
        ).toFixed(2);
        const nodeRatio = (
          results[algo].nodesExpanded / results[baseAlgo].nodesExpanded
        ).toFixed(2);
        const timeRatio = (
          parseFloat(results[algo].timeMs) /
          parseFloat(results[baseAlgo].timeMs)
        ).toFixed(2);

        console.log(
          `${algo}: Path length: ${pathRatio}x, Nodes: ${nodeRatio}x, Time: ${timeRatio}x`
        );
      }
    });
  }
}

// Main execution
const mapPath = "maps/lost_coast.map";
const start = [144, 28]; // Adjust based on your map
const goal = [260, 213]; // Adjust based on your map

// Test specific algorithms (you can modify this list as needed)
compareAlgorithms(mapPath, start, goal, ["AStar", "ORSM"]);

// Uncomment to test all algorithms
// compareAlgorithms(mapPath, start, goal);

// You can also add additional test scenarios with different maps or coordinates
// compareAlgorithms("maps/maze.map", [10, 10], [40, 40], ["AStar", "ORSM"]);
