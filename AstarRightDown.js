export function aStarRightDown(grid, start, goal) {
  const rows = grid.length;
  const cols = grid[0].length;

  const openSet = [{ pos: start, f: heuristic(start, goal), g: 0 }];
  const cameFrom = new Map();

  const gScore = Array.from({ length: rows }, () => Array(cols).fill(Infinity));
  gScore[start[0]][start[1]] = 0;

  const fScore = Array.from({ length: rows }, () => Array(cols).fill(Infinity));
  fScore[start[0]][start[1]] = heuristic(start, goal);

  while (openSet.length > 0) {
    // Select node with lowest f-score
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift().pos;

    // Check if reached goal
    if (current[0] === goal[0] && current[1] === goal[1]) {
      return reconstructPath(cameFrom, current);
    }

    // Right and Down only
    const neighbors = [
      [current[0], current[1] + 1], // right
      [current[0] + 1, current[1]], // down
    ];

    for (const [r, c] of neighbors) {
      if (r < rows && c < cols && grid[r][c] !== 1) {
        const tentativeG = gScore[current[0]][current[1]] + 1;

        if (tentativeG < gScore[r][c]) {
          cameFrom.set(`${r},${c}`, current);
          gScore[r][c] = tentativeG;
          const f = tentativeG + heuristic([r, c], goal);
          fScore[r][c] = f;
          openSet.push({ pos: [r, c], f, g: tentativeG });
        }
      }
    }
  }

  return null; // No path found
}

function heuristic(a, b) {
  // Manhattan distance
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

function reconstructPath(cameFrom, current) {
  const path = [current];
  while (cameFrom.has(`${current[0]},${current[1]}`)) {
    current = cameFrom.get(`${current[0]},${current[1]}`);
    path.unshift(current);
  }
  return path;
}
