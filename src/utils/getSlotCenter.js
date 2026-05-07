export function getSlotCenter(slot) {
  const coords =
    slot.LatLong.split(",");

  let totalLat = 0;
  let totalLng = 0;

  coords.forEach((pair) => {
    const [lat, lng] =
      pair.trim().split(" ").map(Number);

    totalLat += lat;
    totalLng += lng;
  });

  return [
    totalLng / coords.length,
    totalLat / coords.length,
  ];
}