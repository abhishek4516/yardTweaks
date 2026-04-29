export default function Slot({ slot, bounds, selectedSlot }) {
  const { minX, minY, height, scale, offsetX, offsetY } = bounds;

  const coords = slot.LatLong.split(",").map((pair) => {
    const [lat, lon] = pair.trim().split(" ").map(Number);

    const x = (lon - minX) * scale + offsetX;
    const y = (minY + height - lat) * scale + offsetY;

    return [x, y];
  });

  const points = coords.map(([x, y]) => `${x},${y}`).join(" ");

  const isSelected = slot.SlotName === selectedSlot;

  return (
    <polygon
      points={points}
      style={{
        fill: isSelected ? "orange" : "rgba(0,0,255,0.3)",
        stroke: isSelected ? "red" : "blue",
        strokeWidth: isSelected ? 2 : 0.5,
      }}
    />
  );
}