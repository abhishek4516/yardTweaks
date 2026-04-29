import slotsData from "../data/slots.json";
import Slot from "./Slot";

const SVG_W = 900;
const SVG_H = 506;

export default function SlotLayer({ selectedSlot }) {
  const allCoords = slotsData.flatMap((slot) =>
    slot.LatLong.split(",").map((pair) => {
      const [lat, lon] = pair.trim().split(" ").map(Number);
      return [lon, lat];
    })
  );

  const xs = allCoords.map(([x]) => x);
  const ys = allCoords.map(([, y]) => y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const width = maxX - minX;
  const height = maxY - minY;

  const scale = Math.min(SVG_W / width, SVG_H / height);

  const offsetX = (SVG_W - width * scale) / 2;
  const offsetY = (SVG_H - height * scale) / 2;

  const bounds = { minX, minY, height, scale, offsetX, offsetY };

  return (
    <>
      {slotsData.map((slot, i) => (
        <Slot
          key={i}
          slot={slot}
          bounds={bounds}
          selectedSlot={selectedSlot}
        />
      ))}
    </>
  );
}