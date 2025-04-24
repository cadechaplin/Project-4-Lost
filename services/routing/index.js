/**
 * Routing service index - exports all routing methods
 */

import {
  getOpenStreetMapDirections,
  calculateDirectLine,
} from "./osrmRouting.js";
import { calculateAStarPath } from "./aStarRouting.js";
import { calculateThirdRoute } from "./thirdRouting.js";
import { fetchStreetData, buildStreetGraph } from "./graphUtils.js";

export {
  getOpenStreetMapDirections,
  calculateDirectLine,
  calculateAStarPath,
  calculateThirdRoute,
  fetchStreetData,
  buildStreetGraph,
};
