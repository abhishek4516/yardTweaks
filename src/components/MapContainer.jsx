import { useState, useRef, useCallback } from "react";
import SlotLayer from "./SlotLayer";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon } from "@turf/helpers";
import slotsData from "../data/slots.json";

const SVG_W = 900;
const SVG_H = 506;

export default function MapContainer() {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });

  const [searchCoord, setSearchCoord] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);

  const svgRef = useRef(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  function handleSearch() {
    if (!searchCoord) return;

    const [lat, lon] = searchCoord.split(",").map(Number);
    const pt = point([lon, lat]);

    for (let slot of slotsData) {
      const coords = slot.LatLong.split(",").map((pair) => {
        const [lat, lon] = pair.trim().split(" ").map(Number);
        return [lon, lat];
      });

      const poly = polygon([[...coords]]);

      if (booleanPointInPolygon(pt, poly)) {
        setSelectedSlot(slot.SlotName);
        return;
      }
    }

    setSelectedSlot(null);
  }

  const handleWheel = useCallback((e) => {
    e.preventDefault();

    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = 1.1;
    const direction = e.deltaY > 0 ? 1 / zoomFactor : zoomFactor;

    setScale((prev) => {
      const newScale = prev * direction;

      setTranslate((t) => ({
        x: mouseX - (mouseX - t.x) * (newScale / prev),
        y: mouseY - (mouseY - t.y) * (newScale / prev),
      }));

      return Math.max(0.5, Math.min(10, newScale));
    });
  }, []);

  const handleMouseDown = (e) => {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;

    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;

    setTranslate((t) => ({
      x: t.x + dx,
      y: t.y + dy,
    }));

    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  return (
    <div style={styles.container}>
      <input
        type="text"
        placeholder="lat,lon"
        value={searchCoord}
        onChange={(e) => setSearchCoord(e.target.value)}
        style={styles.input}
      />

      <button onClick={handleSearch} style={styles.button}>
        Search
      </button>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={styles.svg}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <g
          transform={`translate(${translate.x}, ${translate.y}) scale(${scale})`}
        >
          <SlotLayer selectedSlot={selectedSlot} />
        </g>
      </svg>
    </div>
  );
}

const styles = {
  container: {
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    position: "relative",
    background: "#f3f4f6",
  },
  svg: {
    width: "100%",
    height: "100%",
    cursor: "grab",
  },
  input: {
    position: "absolute",
    top: "16px",
    left: "16px",
    zIndex: 10,
    padding: "8px",
    border: "1px solid #ccc",
    borderRadius: "4px",
  },
  button: {
    position: "absolute",
    top: "16px",
    left: "180px",
    zIndex: 10,
    padding: "8px 12px",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
};
