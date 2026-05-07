export function dijkstra(graph, start, end) {
  const distances = {};
  const previous = {};
  const visited = new Set();

  for (const node in graph) {
    distances[node] = Infinity;
    previous[node] = null;
  }

  distances[start] = 0;

  while (true) {
    let closestNode = null;

    for (const node in distances) {
      if (
        !visited.has(node) &&
        (closestNode === null ||
          distances[node] <
            distances[closestNode])
      ) {
        closestNode = node;
      }
    }

    if (closestNode === null) {
      break;
    }

    if (closestNode === end) {
      break;
    }

    visited.add(closestNode);

    for (const neighbor in graph[
      closestNode
    ]) {
      const newDistance =
        distances[closestNode] +
        graph[closestNode][neighbor];

      if (
        newDistance <
        distances[neighbor]
      ) {
        distances[neighbor] =
          newDistance;

        previous[neighbor] =
          closestNode;
      }
    }
  }

  const path = [];

  let current = end;

  while (current !== null) {
    path.unshift(current);
    current = previous[current];
  }

  return path;
}