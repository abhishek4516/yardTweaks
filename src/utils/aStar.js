import { roadNodes } from "../data/roadNodes";

function heuristic(a, b) {
  const dx =
    roadNodes[a][0] - roadNodes[b][0];

  const dy =
    roadNodes[a][1] - roadNodes[b][1];

  return Math.sqrt(dx * dx + dy * dy);
}

export function aStar(
  graph,
  start,
  goal,
) {
  const openSet = [start];

  const cameFrom = {};

  const gScore = {};
  const fScore = {};

  for (const node in graph) {
    gScore[node] = Infinity;
    fScore[node] = Infinity;
  }

  gScore[start] = 0;

  fScore[start] = heuristic(
    start,
    goal,
  );

  while (openSet.length > 0) {
    let current = openSet[0];

    for (const node of openSet) {
      if (
        fScore[node] < fScore[current]
      ) {
        current = node;
      }
    }

    if (current === goal) {
      const path = [];

      let temp = current;

      while (temp) {
        path.unshift(temp);
        temp = cameFrom[temp];
      }

      return path;
    }

    openSet.splice(
      openSet.indexOf(current),
      1,
    );

    for (const neighbor in graph[
      current
    ]) {
      const tentativeG =
        gScore[current] +
        graph[current][neighbor];

      if (
        tentativeG < gScore[neighbor]
      ) {
        cameFrom[neighbor] = current;

        gScore[neighbor] =
          tentativeG;

        fScore[neighbor] =
          tentativeG +
          heuristic(neighbor, goal);

        if (
          !openSet.includes(neighbor)
        ) {
          openSet.push(neighbor);
        }
      }
    }
  }

  return [];
}