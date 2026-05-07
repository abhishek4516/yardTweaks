import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import slotsData from "../data/slots.json";
import "axios";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon } from "@turf/helpers";
// import { io } from "socket.io-client";
// import { graph } from "../data/graph";
// import { roadNodes } from "../data/roadNodes";
// import { aStar } from "../utils/aStar";
// import {dijkstra} from "../utils/dijkstra";
// import { findNearestNode } from "../utils/findNearestNode";
// import { getSlotCenter } from "../utils/getSlotCenter";

function rotatePoint([x, y], [cx, cy], angle) {
  const dx = x - cx;
  const dy = y - cy;
  const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
  const ry = dx * Math.sin(angle) + dy * Math.cos(angle);
  return [cx + rx, cy + ry];
}

function parseSlotName(name) {
  if (!name) return { block: "—", row: "—", column: "—" };
  const parts = name.split(":");
  return {
    block: parts[0] ?? "—",
    row: parts[1] ?? "—",
    column: parts[2] ?? "—",
  };
}

export default function MapView() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const truckMarkerRef = useRef(null);

  const [searchCoord, setSearchCoord] = useState("");
  const [routeData] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [startslot, setStartSlot] = useState(null);
  const [endSlot, setEndSlot] = useState(null);

  const selectedSlotRef = useRef(null);

  useEffect(() => {
    selectedSlotRef.current = selectedSlot;
  }, [selectedSlot]);

  useEffect(() => {
    if (!navigator.geolocation) {
      console.log("Geolocation not supported");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const center = [77.2867, 28.5134];
        const angle = -90 * (Math.PI / 180);
        const rotatedPoint = rotatePoint([lon, lat], center, angle);
        const map = mapInstance.current;
        if (!map) return;

        if (!truckMarkerRef.current) {
          const el = document.createElement("div");
          el.style.width = "10px";
          el.style.height = "10px";
          el.style.backgroundColor = "#22c55e";
          el.style.borderRadius = "50%";
          el.style.border = "2px solid white";
          el.style.boxShadow = "0 0 6px rgba(0,0,0,0.4)";
          truckMarkerRef.current = new maplibregl.Marker({
            element: el,
            anchor: "center",
          })
            .setLngLat(rotatedPoint)
            .addTo(map);
        } else {
          truckMarkerRef.current.setLngLat(rotatedPoint);
        }
      },
      (error) => {
        console.log(error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: {
              "background-color": "#ffffff",
            },
          },
        ],
      },
      center: [77.2867, 28.5134],
      zoom: 16,
    });

    mapInstance.current = map;

    map.on("load", () => {
      map.on("click", (e) => {
        console.log([e.lngLat.lng, e.lngLat.lat]);
      });

      const center = [77.2867, 28.5134];
      const angle = -90 * (Math.PI / 180);

      const features = slotsData.map((slot) => {
        const coords = slot.LatLong.split(",").map((pair) => {
          const [lat, lon] = pair.trim().split(" ").map(Number);
          return [lon, lat];
        });

        const rotatedCoords = coords.map((pt) =>
          rotatePoint(pt, center, angle),
        );

        return {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [rotatedCoords],
          },
          properties: {
            name:
              slot.SlotName && slot.SlotName.toUpperCase() === "T-PATH"
                ? "T-PATH"
                : slot.SlotName,
          },
        };
      });

      map.addSource("slots", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features,
        },
      });

      map.addLayer({
        id: "slots-fill",
        type: "fill",
        source: "slots",
        paint: {
          "fill-color": "#2563eb",
          "fill-opacity": 0.35,
        },
      });

      map.addLayer({
        id: "slots-highlight",
        type: "fill",
        source: "slots",
        paint: {
          "fill-color": "#f97316",
          "fill-opacity": 0.6,
        },
        filter: ["==", "name", ""],
      });

      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [],
          },
        },
      });

      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#f97316",
          "line-width": 3,
        },
      });

      map.addLayer({
        id: "slots-label",
        type: "symbol",
        source: "slots",
        layout: {
          "text-field": ["get", "name"],
          "text-size": 14,
          "text-anchor": "center",
        },
        paint: {
          "text-color": "#000",
        },
        filter: ["==", "name", ""],
      });

      const bounds = new maplibregl.LngLatBounds();
      features.forEach((f) => {
        f.geometry.coordinates[0].forEach((coord) => {
          bounds.extend(coord);
        });
      });

      map.fitBounds(bounds, {
        padding: { top: 120, bottom: 40, left: 40, right: 40 },
        duration: 0,
      });

      map.on("click", "slots-fill", (e) => {
        const name = e.features[0].properties.name;
        if (selectedSlotRef.current === name) {
          map.setFilter("slots-highlight", ["==", "name", ""]);
          map.setFilter("slots-label", ["==", "name", ""]);
          setSelectedSlot(null);
        } else {
          map.setFilter("slots-highlight", ["==", "name", name]);
          map.setFilter("slots-label", ["==", "name", name]);
          setSelectedSlot(name);
        }
      });

      map.on("mouseenter", "slots-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "slots-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      // const path = dijkstra(graph, "N1", "N2");
      // const routeCoords = path.map((nodeId) => roadNodes[nodeId]);
      // dijkstra implementation
      // map.getSource("route").setData({
      //   type: "Feature",
      //   geometry: { type: "LineString", coordinates: routeCoords },
      // });
    });

    return () => map.remove();
  }, []);

  function findSlotFromData(lat, lon) {
    const pt = point([lon, lat]);
    for (let slot of slotsData) {
      const coords = slot.LatLong.split(",").map((pair) => {
        const [lat2, lon2] = pair.trim().split(" ").map(Number);
        return [lon2, lat2];
      });
      const poly = polygon([[...coords, coords[0]]]);
      if (booleanPointInPolygon(pt, poly)) {
        return slot.SlotName ? slot.SlotName.toUpperCase() : null;
      }
    }
    return null;
  }

  const handleSearch = () => {
    if (!searchCoord || !mapInstance.current) return;
    const [lat, lon] = searchCoord.split(",").map(Number);
    const center = [77.2867, 28.5134];
    const angle = -90 * (Math.PI / 180);
    const rotatedCenter = rotatePoint([lon, lat], center, angle);
    mapInstance.current.flyTo({ center: rotatedCenter, zoom: 20 });
    const name = findSlotFromData(lat, lon);
    if (name) {
      mapInstance.current.setFilter("slots-highlight", ["==", "name", name]);
      mapInstance.current.setFilter("slots-label", ["==", "name", name]);
      setSelectedSlot(name);
    } else {
      mapInstance.current.setFilter("slots-highlight", ["==", "name", ""]);
      mapInstance.current.setFilter("slots-label", ["==", "name", ""]);
      setSelectedSlot(null);
    }
  };

  const handleDeselect = () => {
    if (!mapInstance.current) return;
    mapInstance.current.setFilter("slots-highlight", ["==", "name", ""]);
    mapInstance.current.setFilter("slots-label", ["==", "name", ""]);
    setSelectedSlot(null);
  };

  const handleRecenter = () => {
    if (!mapInstance.current) return;
    const bounds = new maplibregl.LngLatBounds();
    const center = [77.2867, 28.5134];
    const angle = -90 * (Math.PI / 180);
    slotsData.forEach((slot) => {
      const coords = slot.LatLong.split(",").map((pair) => {
        const [lat, lon] = pair.trim().split(" ").map(Number);
        return rotatePoint([lon, lat], center, angle);
      });
      coords.forEach((coord) => bounds.extend(coord));
    });
    mapInstance.current.fitBounds(bounds, {
      padding: { top: 120, bottom: 60, left: 40, right: 40 },
      duration: 600,
    });
  };

  useEffect(() => {
    if (!mapInstance.current || !routeData.length) return;
    const coords = routeData.map((p) => [
      parseFloat(p.LONGITUDE),
      parseFloat(p.LATITUDE),
    ]);
    const source = mapInstance.current.getSource("route");
    if (source) {
      source.setData({
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
      });
    }
  }, [routeData]);

  return (
    <div style={styles.container}>

      {/* ── Search bar ── */}
      <div style={styles.topBar}>
        <div style={styles.searchWrapper}>
          <svg style={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by slot name or coordinates..."
            value={searchCoord}
            onChange={(e) => setSearchCoord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            style={styles.input}
          />
          {searchCoord.length > 0 && (
            <button
              onClick={() => setSearchCoord("")}
              style={styles.clearButton}
              title="Clear"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.7)" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          <div style={styles.searchDivider} />
          <button onClick={handleSearch} style={styles.button}>Search</button>
        </div>
      </div>

      {/* ── Slot details panel ── */}
      {selectedSlot && (() => {
        const { block, row, column } = parseSlotName(selectedSlot);
        return (
          <div style={styles.infoPanel}>
            <div style={styles.infoPanelHeader}>
              <div style={styles.infoPanelDot} />
              <span style={styles.infoPanelTitle}>Slot Details</span>
              <button onClick={handleDeselect} style={styles.closeButton} title="Close">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.7)" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={styles.infoPanelSlotRow}>
              <span style={styles.infoPanelSlotName}>{selectedSlot}</span>
              <span style={styles.statusBadge}>Available</span>
            </div>
            <div style={styles.infoGrid}>
              <div style={styles.infoCell}>
                <span style={styles.infoCellLabel}>Block</span>
                <span style={styles.infoCellValue}>{block}</span>
              </div>
              <div style={styles.infoCell}>
                <span style={styles.infoCellLabel}>Row</span>
                <span style={styles.infoCellValue}>{row}</span>
              </div>
              <div style={styles.infoCell}>
                <span style={styles.infoCellLabel}>Column</span>
                <span style={styles.infoCellValue}>{column}</span>
              </div>
            </div>
            <div style={styles.infoDivider} />
            <div style={styles.actionRow}>
              <button style={styles.actionButtonPrimary}>Navigate</button>
              <button onClick={handleDeselect} style={styles.actionButtonSecondary}>Deselect</button>
            </div>
          </div>
        );
      })()}

      {/* ── Zoom + recenter controls ── */}
      <div style={styles.zoomControls}>
        <div style={styles.zoomGroup}>
          <button
            style={styles.zoomButton}
            onClick={() => mapInstance.current?.zoomIn()}
            title="Zoom in"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(200,210,230,0.9)" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <div style={styles.zoomDivider} />
          <button
            style={styles.zoomButton}
            onClick={() => mapInstance.current?.zoomOut()}
            title="Zoom out"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(200,210,230,0.9)" strokeWidth="2.5" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
        <button style={styles.recenterButton} onClick={handleRecenter} title="Recenter map">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(200,210,230,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        </button>
      </div>

      {/* ── Map ── */}
      <div ref={mapRef} style={styles.map} />

      {/* ── Bottom legend bar ── */}
      <div style={styles.legendBar}>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendSwatch, background: "rgba(37,99,235,0.55)", border: "1px solid rgba(37,99,235,0.9)" }} />
          <span style={styles.legendLabel}>Available</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendSwatch, background: "rgba(249,115,22,0.55)", border: "1px solid rgba(249,115,22,0.9)" }} />
          <span style={styles.legendLabel}>Selected</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendDot }} />
          <span style={styles.legendLabel}>Your location</span>
        </div>
        <span style={styles.legendCount}>{slotsData.length} slots total</span>
      </div>

    </div>
  );
}

const glass = {
  background: "rgba(10, 18, 35, 0.92)",
  border: "1px solid rgba(255,255,255,0.08)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
};

const styles = {
  container: {
    width: "100%",
    height: "100vh",
    position: "fixed",
    overflow: "hidden",
    fontFamily: "Inter, system-ui, sans-serif",
    background: "#546896",
  },

  map: {
    width: "100%",
    height: "100%",
    display: "block",
  },

  // ── Search bar ──
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    padding: "16px",
    display: "flex",
    justifyContent: "center",
    zIndex: 10,
    pointerEvents: "none",
  },

  searchWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    ...glass,
    padding: "10px 14px",
    borderRadius: "18px",
    boxShadow: "0 10px 35px rgba(0,0,0,0.35)",
    pointerEvents: "auto",
    width: "100%",
    maxWidth: "520px",
  },

  searchIcon: {
    width: "16px",
    height: "16px",
    flexShrink: 0,
  },

  input: {
    flex: 1,
    padding: "6px 4px",
    border: "none",
    fontSize: "14px",
    outline: "none",
    background: "transparent",
    color: "white",
  },

  clearButton: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "6px",
    flexShrink: 0,
  },

  searchDivider: {
    width: "1px",
    height: "18px",
    background: "rgba(255,255,255,0.1)",
    flexShrink: 0,
  },

  button: {
    padding: "9px 18px",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "14px",
    letterSpacing: "0.3px",
    transition: "all 0.2s ease",
    boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
    flexShrink: 0,
  },

  // ── Slot panel ──
  infoPanel: {
    position: "absolute",
    top: 88,
    right: 16,
    ...glass,
    color: "white",
    padding: "16px 16px 14px",
    borderRadius: "20px",
    boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
    zIndex: 20,
    minWidth: "240px",
    maxWidth: "265px",
  },

  infoPanelHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "6px",
  },

  infoPanelDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "#22c55e",
    flexShrink: 0,
  },

  infoPanelTitle: {
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    color: "rgba(148,163,184,0.9)",
    textTransform: "uppercase",
    flex: 1,
  },

  closeButton: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "6px",
    flexShrink: 0,
  },

  infoPanelSlotRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "14px",
  },

  infoPanelSlotName: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#ffffff",
    letterSpacing: "0.04em",
    lineHeight: 1.2,
  },

  statusBadge: {
    fontSize: "11px",
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: "8px",
    background: "rgba(34,197,94,0.15)",
    color: "#4ade80",
    border: "1px solid rgba(34,197,94,0.28)",
    letterSpacing: "0.03em",
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "8px",
  },

  infoCell: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    background: "rgba(255,255,255,0.05)",
    borderRadius: "12px",
    padding: "10px 6px",
    border: "1px solid rgba(255,255,255,0.06)",
  },

  infoCellLabel: {
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.07em",
    color: "rgba(148,163,184,0.75)",
    textTransform: "uppercase",
  },

  infoCellValue: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#93c5fd",
    lineHeight: 1,
  },

  infoDivider: {
    height: "1px",
    background: "rgba(255,255,255,0.07)",
    margin: "12px 0",
  },

  actionRow: {
    display: "flex",
    gap: "8px",
  },

  actionButtonPrimary: {
    flex: 1,
    padding: "9px",
    background: "rgba(37,99,235,0.2)",
    border: "1px solid rgba(37,99,235,0.4)",
    borderRadius: "10px",
    color: "#93c5fd",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  actionButtonSecondary: {
    flex: 1,
    padding: "9px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    color: "rgba(148,163,184,0.9)",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  // ── Zoom controls ──
  zoomControls: {
    position: "absolute",
    right: 16,
    bottom: 80,
    zIndex: 10,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    alignItems: "center",
  },

  zoomGroup: {
    ...glass,
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    width: "40px",
  },

  zoomButton: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    width: "40px",
    height: "38px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.15s ease",
  },

  zoomDivider: {
    height: "1px",
    background: "rgba(255,255,255,0.08)",
  },

  recenterButton: {
    ...glass,
    background: "rgba(10, 18, 35, 0.92)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "12px",
    width: "40px",
    height: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "background 0.15s ease",
  },

  // legend bar
  legendBar: {
    position: "absolute",
    bottom: 16,
    left: "50%",
    transform: "translateX(-50%)",
    ...glass,
    borderRadius: "14px",
    padding: "10px 18px",
    display: "flex",
    alignItems: "center",
    gap: "18px",
    zIndex: 10,
    whiteSpace: "nowrap",
  },

  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
  },

  legendSwatch: {
    width: "13px",
    height: "13px",
    borderRadius: "3px",
    flexShrink: 0,
  },

  legendDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "#22c55e",
    flexShrink: 0,
  },

  legendLabel: {
    fontSize: "12px",
    fontWeight: 500,
    color: "rgba(200,210,230,0.85)",
  },

  legendCount: {
    fontSize: "12px",
    color: "rgba(148,163,184,0.55)",
    marginLeft: "4px",
  },
};