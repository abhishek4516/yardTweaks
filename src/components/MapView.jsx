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
    if (!mapInstance.current) return;

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
      // coordinates logger
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
        padding: {
          top: 120,
          bottom: 40,
          left: 40,
          right: 40,
        },
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

      //   geometry: {
      //     type: "LineString",
      //     coordinates: routeCoords,
      //   },
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

    mapInstance.current.flyTo({
      center: rotatedCenter,
      zoom: 20,
    });

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
        geometry: {
          type: "LineString",
          coordinates: coords,
        },
      });
    }
  }, [routeData]);

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <div style={styles.searchWrapper}>
          <input
            type="text"
            placeholder="lat, lon"
            value={searchCoord}
            onChange={(e) => setSearchCoord(e.target.value)}
            style={styles.input}
          />

          <button onClick={handleSearch} style={styles.button}>
            Search
          </button>
        </div>
      </div>

      {selectedSlot && (
        <div style={styles.infoPanel}>
          <div style={styles.infoTitle}>Slot Details</div>

          <div style={styles.infoRow}>
            <span style={styles.label}>Slot:</span>
            <span>{selectedSlot}</span>
          </div>
        </div>
      )}

      <div ref={mapRef} style={styles.map} />
    </div>
  );
}

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

  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    padding: "18px",
    display: "flex",
    justifyContent: "center",
    zIndex: 10,
    pointerEvents: "none",
  },

  searchWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "rgba(15, 23, 42, 0.88)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    padding: "12px",
    borderRadius: "18px",
    boxShadow: "0 10px 35px rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.08)",
    pointerEvents: "auto",
    width: "100%",
    maxWidth: "520px",
  },

  input: {
    flex: 1,
    padding: "14px 16px",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "12px",
    fontSize: "14px",
    outline: "none",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    transition: "all 0.2s ease",
  },

  button: {
    padding: "13px 18px",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "14px",
    letterSpacing: "0.3px",
    transition: "all 0.2s ease",
    boxShadow: "0 6px 18px rgba(37,99,235,0.35)",
  },

  resultBox: {
    position: "absolute",
    top: 85,
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(15,23,42,0.92)",
    color: "white",
    padding: "10px 14px",
    borderRadius: "12px",
    boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
    zIndex: 10,
    border: "1px solid rgba(255,255,255,0.08)",
  },

  infoPanel: {
    position: "absolute",
    top: 95,
    right: 20,
    background: "rgba(15,23,42,0.92)",
    color: "white",
    padding: "16px",
    borderRadius: "18px",
    boxShadow: "0 10px 35px rgba(0,0,0,0.35)",
    zIndex: 20,
    minWidth: "220px",
    border: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  },

  infoTitle: {
    fontWeight: 700,
    marginBottom: "14px",
    fontSize: "15px",
    letterSpacing: "0.5px",
    color: "#93c5fd",
  },

  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "14px",
    padding: "10px 12px",
    background: "rgba(255,255,255,0.05)",
    borderRadius: "10px",
  },

  label: {
    color: "#94a3b8",
    fontWeight: 500,
  },
};