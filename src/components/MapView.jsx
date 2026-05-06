import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import slotsData from "../data/slots.json";
import "axios";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon } from "@turf/helpers";
// import { io } from "socket.io-client";

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
    padding: "12px 16px",
    display: "flex",
    justifyContent: "center",
    zIndex: 10,
    pointerEvents: "none",
  },

  searchWrapper: {
    display: "flex",
    gap: "8px",
    background: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(10px)",
    padding: "8px",
    borderRadius: "10px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
    pointerEvents: "auto",
    width: "100%",
    maxWidth: "420px",
  },

  input: {
    flex: 1,
    padding: "10px 12px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "14px",
    outline: "none",
  },

  button: {
    padding: "10px 14px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: 500,
  },

  resultBox: {
    position: "absolute",
    top: 70,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#fff",
    padding: "8px 12px",
    borderRadius: "6px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    zIndex: 10,
  },

  infoPanel: {
    position: "absolute",
    top: 80,
    right: 20,
    background: "#fff",
    padding: "12px 14px",
    borderRadius: "10px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
    zIndex: 20,
    minWidth: "180px",
  },

  infoTitle: {
    fontWeight: 600,
    marginBottom: "8px",
    fontSize: "14px",
  },

  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "13px",
  },

  label: {
    color: "#000000",
  },
};
