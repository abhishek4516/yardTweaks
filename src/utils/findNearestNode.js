import { roadNodes } from "../data/roadNodes";

export function findNearestNode(
  lng,
  lat,
) {
  let nearestNode = null;

  let minDistance = Infinity;

  for (const nodeId in roadNodes) {
    const [nodeLng, nodeLat] =
      roadNodes[nodeId];

    const dx = nodeLng - lng;
    const dy = nodeLat - lat;

    const distance = Math.sqrt(
      dx * dx + dy * dy,
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestNode = nodeId;
    }
  }

  return nearestNode;
}