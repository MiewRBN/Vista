"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Map, { NavigationControl } from "react-map-gl/maplibre";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer } from "@deck.gl/layers";
import { FlyToInterpolator, WebMercatorViewport } from "@deck.gl/core";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Plus, Minus, Compass, Layers, Moon, Sun, MapIcon, Globe, Check, ChevronUp, ChevronDown, X, CheckSquare, Download, Trash2 } from "lucide-react";
import { formatStreetName, formatTasNitCode } from "@/app/page";


if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("https://unpkg.com/maplibre-gl@6.3.0/dist/maplibre-gl-worker.mjs");
}

interface TasNitFeature {
  type: "Feature";
  geometry: { type: string; coordinates: any };
  properties: Record<string, unknown>;
}

interface GeoJSONData {
  type: "FeatureCollection";
  features: TasNitFeature[];
}

// Color mode = which score to visualize
export type ColorMode = "uvi" | "accessibility" | "physical" | "sentiment";
export type GeometryMode = "point" | "line" | "polygon";

interface MapComponentProps {
  showTasNits: boolean;
  showBusStops: boolean;
  showPOIs: boolean;
  colorMode: ColorMode;
  geometryMode: GeometryMode;
  onFeatureClick: (properties: Record<string, unknown> | null) => void;
  onStatsUpdate: (stats: {
    totalTasNits: number;
    totalBusStops: number;
    totalPOIs: number;
    avgScore: number;
    avgPhysical: number;
    avgSentiment: number;
    avgAccessibility: number;
    avgUvi: number;
    walkingClasses: Record<string, number>;
    scoreDistribution: number[];
  }) => void;
  searchQuery?: string;
  tasNitsData: GeoJSONData | null;
  tasNitsLinesData?: GeoJSONData | null;
  tasNitsPolygonsData?: GeoJSONData | null;
  busStopsData: GeoJSONData | null;
  poisData: GeoJSONData | null;
  selectedFeature?: Record<string, unknown> | null;
  selectedFeatures?: Record<string, unknown>[];
  isMultiSelectMode?: boolean;
  onToggleMultiSelectMode?: () => void;
  onToggleSelectFeature?: (properties: Record<string, unknown>) => void;
  onSelectAllCorridor?: (streetName: string) => void;
  onClearSelection?: () => void;
  onOpenExport?: () => void;
}

export type BasemapStyle = "dark" | "street" | "light" | "satellite";

const BASEMAP_OPTIONS: { id: BasemapStyle; label: string; icon: React.ReactNode; styleName: string; previewImg: string }[] = [
  { id: "dark", label: "Dark", icon: <Moon size={14} />, styleName: "dark-v2.0", previewImg: "/dark.png" },
  { id: "street", label: "Street", icon: <MapIcon size={14} />, styleName: "street-v2.0", previewImg: "/street.png" },
  { id: "light", label: "Light", icon: <Sun size={14} />, styleName: "light-v2.0", previewImg: "/light.png" },
  { id: "satellite", label: "Satelit", icon: <Globe size={14} />, styleName: "satellite-v2.0", previewImg: "/satelite.png" },
];

// Sequential color palettes (coaching: gradasi halus dari rendah ke tinggi)
const COLOR_PALETTES: Record<ColorMode, { label: string; stops: [number, number, number, number][] }> = {
  uvi: {
    label: "Urban Vitality Index",
    stops: [
      [239, 68, 68, 220],    // 0.0 - merah (vitalitas sangat rendah)
      [245, 158, 11, 220],   // 0.25 - oranye
      [234, 179, 8, 220],    // 0.5 - kuning
      [132, 204, 22, 220],   // 0.75 - hijau muda
      [0, 242, 254, 220],    // 1.0 - cyan (vitalitas tinggi)
    ],
  },
  accessibility: {
    label: "Skor Aktivitas & Fungsi",
    stops: [
      [239, 68, 68, 220],
      [245, 158, 11, 220],
      [234, 179, 8, 220],
      [132, 204, 22, 220],
      [0, 242, 254, 220],
    ],
  },
  physical: {
    label: "Skor Lingkungan Fisik",
    stops: [
      [239, 68, 68, 220],
      [245, 158, 11, 220],
      [234, 179, 8, 220],
      [132, 204, 22, 220],
      [0, 242, 254, 220],
    ],
  },

  sentiment: {
    label: "Skor Sentimen Warga",
    stops: [
      [190, 18, 60, 220],     // sangat negatif - crimson
      [219, 112, 25, 220],    // negatif - oranye
      [250, 204, 21, 220],    // netral - kuning
      [52, 211, 153, 220],    // positif - emerald
      [56, 189, 248, 220],    // sangat positif - sky blue
    ],
  },
};

function getScoreKey(mode: ColorMode): string {
  switch (mode) {
    case "uvi": return "uvi_score";
    case "accessibility": return "accessibility_score";
    case "physical": return "physical_score";
    case "sentiment": return "sentiment_score";
  }
}

function interpolateColor(score: number, stops: [number, number, number, number][]): [number, number, number, number] {
  const t = Math.max(0, Math.min(1, score));
  const segmentCount = stops.length - 1;
  const segIdx = Math.min(Math.floor(t * segmentCount), segmentCount - 1);
  const segT = (t * segmentCount) - segIdx;

  const c0 = stops[segIdx];
  const c1 = stops[segIdx + 1];
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * segT),
    Math.round(c0[1] + (c1[1] - c0[1]) * segT),
    Math.round(c0[2] + (c1[2] - c0[2]) * segT),
    Math.round(c0[3] + (c1[3] - c0[3]) * segT),
  ];
}

function getScoreColor(mode: ColorMode): string {
  switch (mode) {
    case "uvi": return "#00f2fe";
    case "accessibility": return "#4facfe";
    case "physical": return "#22c55e";
    case "sentiment": return "#f59e0b";
  }
}

export default function MapComponent({
  showTasNits,
  showBusStops,
  showPOIs,
  colorMode,
  geometryMode = "line",
  onFeatureClick,
  onStatsUpdate,
  searchQuery,
  tasNitsData,
  tasNitsLinesData,
  tasNitsPolygonsData,
  busStopsData,
  poisData,
  selectedFeature,
  selectedFeatures = [],
  isMultiSelectMode = false,
  onToggleMultiSelectMode,
  onToggleSelectFeature,
  onSelectAllCorridor,
  onClearSelection,
  onOpenExport,
}: MapComponentProps) {
  const MAPID_API_KEY = process.env.NEXT_PUBLIC_MAPID_BASEMAP_KEY || "";
  const [basemapStyle, setBasemapStyle] = useState<BasemapStyle>("dark");
  const [showBasemapMenu, setShowBasemapMenu] = useState(false);

  const activeStyleObj = BASEMAP_OPTIONS.find((b) => b.id === basemapStyle) || BASEMAP_OPTIONS[0];
  const mapStyleUrl = MAPID_API_KEY
    ? `https://v2.basemap.mapid.io/styles/${activeStyleObj.styleName}/style.json?key=${MAPID_API_KEY}`
    : "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

  const [viewState, setViewState] = useState({
    longitude: 107.6191,
    latitude: -6.9175,
    zoom: 12.8,
    pitch: 45,
    bearing: -15,
    transitionDuration: 0,
    transitionInterpolator: undefined as any,
  });

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setContainerSize({ width: rect.width, height: rect.height });
        }
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const [popupInfo, setPopupInfo] = useState<{
    coordinate: [number, number];
    html: string;
  } | null>(null);

  const [selectedFeatureCoords, setSelectedFeatureCoords] = useState<[number, number] | null>(null);
  const [isLegendExpanded, setIsLegendExpanded] = useState(true);
  const [showSelectedListPopover, setShowSelectedListPopover] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsLegendExpanded(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedFeature) {
      setSelectedFeatureCoords(null);
      setPopupInfo(null);
    }
  }, [selectedFeature]);

  const handleStatsUpdate = useCallback(
    (tasNits: GeoJSONData, busStops: GeoJSONData, pois: GeoJSONData) => {
      const accScores: number[] = [];
      const physScores: number[] = [];
      const sentScores: number[] = [];
      const uviScores: number[] = [];

      const walkingClasses: Record<string, number> = {};
      
      tasNits.features.forEach((f) => {
        const p = f.properties;
        const acc = Number(p.accessibility_score) || 0;
        const phys = Number(p.physical_score) || 0;
        const sent = Number(p.sentiment_score) || 0;
        const uvi = Number(p.uvi_score) || 0;

        accScores.push(acc);
        if (phys > 0) physScores.push(phys);
        if (sent > 0) sentScores.push(sent);
        if (uvi > 0) uviScores.push(uvi);

        const cls = (p.walking_class as string) || "Unknown";
        walkingClasses[cls] = (walkingClasses[cls] || 0) + 1;
      });

      // Build score distribution histogram (10 bins: 0-0.1, 0.1-0.2, ..., 0.9-1.0)
      const scoreKey = getScoreKey(colorMode);
      const distribution = new Array(10).fill(0);
      tasNits.features.forEach((f) => {
        const val = Number(f.properties[scoreKey]) || 0;
        const bin = Math.min(Math.floor(val * 10), 9);
        distribution[bin]++;
      });

      onStatsUpdate({
        totalTasNits: tasNits.features.length,
        totalBusStops: busStops.features.length,
        totalPOIs: pois.features.length,
        avgScore: accScores.length > 0 ? accScores.reduce((a, b) => a + b, 0) / accScores.length : 0,
        avgPhysical: physScores.length > 0 ? physScores.reduce((a, b) => a + b, 0) / physScores.length : 0,
        avgSentiment: sentScores.length > 0 ? sentScores.reduce((a, b) => a + b, 0) / sentScores.length : 0,
        avgAccessibility: accScores.length > 0 ? accScores.reduce((a, b) => a + b, 0) / accScores.length : 0,
        avgUvi: uviScores.length > 0 ? uviScores.reduce((a, b) => a + b, 0) / uviScores.length : 0,
        walkingClasses,
        scoreDistribution: distribution,
      });
    },
    [onStatsUpdate, colorMode]
  );

  const [boundaryData, setBoundaryData] = useState<GeoJSONData | null>(null);
  const [maskData, setMaskData] = useState<GeoJSONData | null>(null);

  useEffect(() => {
    fetch("/api/boundary")
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          if (data.boundary) setBoundaryData(data.boundary);
          if (data.mask) setMaskData(data.mask);
          if (data.type === "FeatureCollection") setBoundaryData(data);
        }
      })
      .catch((err) => console.error("Error fetching boundary:", err));
  }, []);

  useEffect(() => {
    if (tasNitsData && busStopsData && poisData) {
      handleStatsUpdate(tasNitsData, busStopsData, poisData);
    }
  }, [tasNitsData, busStopsData, poisData, handleStatsUpdate]);

  const palette = COLOR_PALETTES[colorMode];
  const scoreKey = getScoreKey(colorMode);

  const handleFeatureSelect = useCallback((info: any) => {
    if (info.object) {
      const p = info.object.properties || info.object;
      let coords: [number, number] | null = null;
      if (info.coordinate && Array.isArray(info.coordinate) && typeof info.coordinate[0] === "number" && typeof info.coordinate[1] === "number") {
        coords = [info.coordinate[0], info.coordinate[1]];
      } else if (info.object.geometry && info.object.geometry.coordinates) {
        const c = info.object.geometry.coordinates;
        const lon = Array.isArray(c[0]) ? (Array.isArray(c[0][0]) ? c[0][0][0] : c[0][0]) : c[0];
        const lat = Array.isArray(c[0]) ? (Array.isArray(c[0][0]) ? c[0][0][1] : c[0][1]) : c[1];
        coords = [Number(lon), Number(lat)];
      } else if (p.center_lon && p.center_lat) {
        coords = [Number(p.center_lon), Number(p.center_lat)];
      } else if (p.lon && p.lat) {
        coords = [Number(p.lon), Number(p.lat)];
      } else if (tasNitsData?.features) {
        const id = p.id || p.tas_nit_id;
        const found = tasNitsData.features.find((f: any) =>
          String(f.properties?.id || f.properties?.tas_nit_id || f.id) === String(id) ||
          (p.tas_nit_code && f.properties?.tas_nit_code === p.tas_nit_code)
        );
        if (found?.geometry?.coordinates) {
          const c = found.geometry.coordinates;
          const lon = Array.isArray(c[0]) ? (Array.isArray(c[0][0]) ? c[0][0][0] : c[0][0]) : c[0];
          const lat = Array.isArray(c[0]) ? (Array.isArray(c[0][0]) ? c[0][0][1] : c[0][1]) : c[1];
          coords = [Number(lon), Number(lat)];
        }
      }

      if (coords) {
        setSelectedFeatureCoords(coords);
      }

      const isShift = Boolean(info.srcEvent?.shiftKey);
      if (isMultiSelectMode || isShift) {
        if (onToggleSelectFeature) {
          onToggleSelectFeature(p as Record<string, unknown>);
        }
      }

      onFeatureClick(p as Record<string, unknown>);

      const accScore = Number(p.accessibility_score) || 0;
      const physScore = Number(p.physical_score) || 0;
      const sentScore = Number(p.sentiment_score) || 0;
      const uviScore = Number(p.uvi_score) || 0;

      // Build 3-pilar mini bar for popup
      const maxBarW = 100;
      const makeBar = (val: number, color: string, label: string) => {
        const w = Math.max(2, val * maxBarW);
        return `
          <div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;margin-bottom:4px;">
              <span>${label}</span>
              <span style="color:#f1f5f9;font-weight:600;">${val.toFixed(3)}</span>
            </div>
            <div style="width:100%;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">
              <div style="width:${w}%;height:100%;background:${color};border-radius:3px;transition:width 0.3s;"></div>
            </div>
          </div>`;
      };

      if (coords) {
        setPopupInfo({
          coordinate: coords,
          html: `
            <div style="font-size:13px; color:#f1f5f9; width:100%; box-sizing:border-box;">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px;">
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; flex:1; min-width:0;">
                  <span style="display:inline-flex;align-items:center;font-size:11px;font-weight:700;font-family:monospace;padding:3.5px 10px;line-height:1;border-radius:8px;background:rgba(6,182,212,0.15);color:#22d3ee;border:1.5px solid rgba(6,182,212,0.45);letter-spacing:0.5px;box-shadow:0 0 10px rgba(6,182,212,0.18);">
                    ${formatTasNitCode(p.id || p.tas_nit_id, p.tas_nit_code)}
                  </span>
                  ${p.walking_class ? `<span style="display:inline-flex;align-items:center;font-size:11px;font-weight:500;color:#cbd5e1;background:rgba(255,255,255,0.06);padding:3.5px 10px;line-height:1;border-radius:8px;border:1px solid rgba(255,255,255,0.14);">${p.walking_class}</span>` : ""}
                </div>
                <div style="width:24px; height:24px; flex-shrink:0;"></div>
              </div>

              <div style="font-weight:700;font-size:15px;margin-bottom:6px;color:#38bdf8;line-height:1.35;">
                ${formatStreetName(p.street_name) || "Kawasan TOD"}
              </div>

              <div style="color:#94a3b8;margin-bottom:12px;font-size:12px;">
                ${p.nearest_stop || "-"} ${p.avg_distance_to_stop ? `• ${Number(p.avg_distance_to_stop).toFixed(0)}m` : ""} ${p.n_tas_nits ? `• ${p.n_tas_nits} Segmen` : ""}
              </div>
              <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:12px;">
                <span style="font-size:28px;font-weight:800;color:${getScoreColor(colorMode)};">${uviScore.toFixed(3)}</span>
                <span style="font-size:12px;color:#94a3b8;">UVI Score</span>
              </div>
              ${makeBar(accScore, "#4facfe", "Aktivitas & Fungsi")}
              ${makeBar(physScore, "#22c55e", "Lingkungan Fisik")}
              ${makeBar(sentScore, "#f59e0b", "Sentimen Warga")}
              ${Number(p.gvi) > 0 ? `
              <div style="width:100%;height:1px;background:rgba(255,255,255,0.08);margin:10px 0;"></div>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;text-align:center;">
                <div><div style="font-size:14px;font-weight:700;color:#84cc16;">${(Number(p.gvi)*100).toFixed(0)}%</div><div style="font-size:10px;color:#64748b;">GVI</div></div>
                <div><div style="font-size:14px;font-weight:700;color:#0ea5e9;">${(Number(p.svf)*100).toFixed(0)}%</div><div style="font-size:10px;color:#64748b;">SVF</div></div>
                <div><div style="font-size:14px;font-weight:700;color:#f59e0b;">${(Number(p.sidewalk)*100).toFixed(0)}%</div><div style="font-size:10px;color:#64748b;">Trotoar</div></div>
              </div>` : ""}
            </div>
          `
        });
      }
      return true;
    }
  }, [colorMode, onFeatureClick, isMultiSelectMode, onToggleSelectFeature]);

  // Handle Search FlyTo
  useEffect(() => {
    if (!searchQuery) return;
    const query = searchQuery.toLowerCase().trim();

    let found = busStopsData?.features.find(f =>
      String(f.properties.name || "").toLowerCase().includes(query)
    );

    if (!found && tasNitsData) {
      found = tasNitsData.features.find(f => {
        const code = formatTasNitCode(f.properties.id || f.properties.tas_nit_id, f.properties.tas_nit_code).toLowerCase();
        const street = String(f.properties.street_name || "").toLowerCase();
        const stop = String(f.properties.nearest_stop || "").toLowerCase();
        const rawId = String(f.properties.id || f.properties.tas_nit_id || "").toLowerCase();
        return code.includes(query) || rawId.includes(query) || street.includes(query) || stop.includes(query);
      });
    }

    if (found) {
      const coords = found.geometry.coordinates;
      const lon = Array.isArray(coords[0]) ? (Array.isArray(coords[0][0]) ? coords[0][0][0] : coords[0][0]) : coords[0];
      const lat = Array.isArray(coords[0]) ? (Array.isArray(coords[0][0]) ? coords[0][0][1] : coords[0][1]) : coords[1];

      setSelectedFeatureCoords([Number(lon), Number(lat)]);

      setViewState((prev) => ({
        ...prev,
        longitude: Number(lon),
        latitude: Number(lat),
        zoom: 16.8,
        transitionDuration: 1300,
        transitionInterpolator: new FlyToInterpolator()
      }));

      // Automatically open feature details & popup directly above the selected dot
      setTimeout(() => {
        handleFeatureSelect({
          object: found,
          coordinate: [Number(lon), Number(lat)]
        });
      }, 400);
    }
  }, [searchQuery, busStopsData, tasNitsData, handleFeatureSelect]);

  const layers = useMemo(() => {
    const arr = [];

    if (showTasNits) {
      if (geometryMode === "line" && tasNitsLinesData) {
        // Mode 2: Koridor Garis Jalan (LineString / Street Network - Gambar a Proposal)
        arr.push(
          new GeoJsonLayer({
            id: "tas-nits-lines-layer",
            data: tasNitsLinesData as any,
            pickable: true,
            stroked: true,
            filled: false,
            lineWidthScale: 1,
            lineWidthMinPixels: 2.5,
            getLineWidth: 5,
            getLineColor: (d: any) => {
              const score = Number(d.properties[scoreKey]) || 0;
              return interpolateColor(score, palette.stops);
            },
            updateTriggers: {
              getLineColor: [colorMode],
            },
            onClick: handleFeatureSelect,
          })
        );
      } else if (geometryMode === "polygon" && tasNitsPolygonsData) {
        // Mode 3: Buffer Area Kawasan Catchment Area 400m (Polygon Transparan)
        arr.push(
          new GeoJsonLayer({
            id: "tas-nits-polygons-layer",
            data: tasNitsPolygonsData as any,
            pickable: true,
            stroked: true,
            filled: true,
            getFillColor: (d: any) => {
              const score = Number(d.properties[scoreKey]) || 0;
              const [r, g, b] = interpolateColor(score, palette.stops);
              return [r, g, b, 42]; // Highly transparent fill (~16% opacity) so basemap streets and POIs stay visible
            },
            getLineColor: (d: any) => {
              const score = Number(d.properties[scoreKey]) || 0;
              const [r, g, b] = interpolateColor(score, palette.stops);
              return [r, g, b, 110]; // Subtle translucent border
            },
            lineWidthMinPixels: 1,
            getLineWidth: 1.5,
            updateTriggers: {
              getFillColor: [colorMode],
              getLineColor: [colorMode],
            },
            onClick: handleFeatureSelect,
          })
        );
      } else if (tasNitsData) {
        // Mode 1: Titik Sampling Centroid (Default)
        arr.push(
          new GeoJsonLayer({
            id: "tas-nits-layer",
            data: tasNitsData as any,
            pickable: true,
            stroked: false,
            filled: true,
            pointType: "circle",
            lineWidthScale: 1,
            lineWidthMinPixels: 0,
            getPointRadius: (d: any) => {
              const nPoints = Number(d.properties.n_points) || 1;
              return Math.max(8, Math.min(20, 6 + nPoints * 0.8));
            },
            pointRadiusScale: 1,
            pointRadiusMinPixels: 3,
            pointRadiusMaxPixels: 14,
            getFillColor: (d: any) => {
              const score = Number(d.properties[scoreKey]) || 0;
              return interpolateColor(score, palette.stops);
            },
            updateTriggers: {
              getFillColor: [colorMode],
              getPointRadius: [colorMode],
            },
            onClick: handleFeatureSelect,
          })
        );
      }
    }

    if (showBusStops && busStopsData) {
      arr.push(
        new GeoJsonLayer({
          id: "bus-stops-layer",
          data: busStopsData as any,
          pickable: true,
          stroked: true,
          filled: true,
          pointType: "circle",
          getPointRadius: 15,
          pointRadiusScale: 1,
          pointRadiusMinPixels: 4,
          getFillColor: [59, 130, 246, 255],
          getLineColor: [255, 255, 255, 255],
          getLineWidth: 2,
          onClick: (info) => {
            if (info.object) {
              const props = info.object.properties;
              let coords: [number, number] | null = null;
              if (info.coordinate && Array.isArray(info.coordinate) && typeof info.coordinate[0] === "number" && typeof info.coordinate[1] === "number") {
                coords = [info.coordinate[0], info.coordinate[1]];
              } else if (info.object.geometry && info.object.geometry.coordinates) {
                const c = info.object.geometry.coordinates;
                coords = [Number(c[0]), Number(c[1])];
              }

              if (coords) {
                setPopupInfo({
                  coordinate: coords,
                  html: `
                    <div style="font-size:13px; padding-right:24px; min-width:160px;">
                      <div style="font-weight:700;font-size:14px;color:#3b82f6;">${props.name}</div>
                    </div>
                  `
                });
              }
              return true;
            }
          }
        })
      );
    }

    if (showPOIs && poisData) {
      arr.push(
        new GeoJsonLayer({
          id: "pois-layer",
          data: poisData as any,
          pickable: false,
          stroked: true,
          filled: true,
          pointType: "circle",
          getPointRadius: 8,
          pointRadiusScale: 1,
          pointRadiusMinPixels: 3,
          getFillColor: (d: any) => {
            const cat = d.properties.category;
            switch(cat) {
              case "Pendidikan": return [168, 85, 247, 230];
              case "Kesehatan": return [236, 72, 153, 230];
              case "Komersial": return [245, 158, 11, 230];
              case "Katering": return [239, 68, 68, 230];
              case "Finansial": return [34, 197, 94, 230];
              case "Olahraga": return [6, 182, 212, 230];
              default: return [148, 163, 184, 230];
            }
          },
          getLineColor: [255, 255, 255, 100],
          getLineWidth: 1
        })
      );
    }

    // 0a. Multi-selected Points Layer (Glowing Emerald Rings)
    if (selectedFeatures && selectedFeatures.length > 0) {
      const multiPoints = selectedFeatures.map((f: any) => {
        const p = f.properties || f;
        const coords = f.geometry?.coordinates || [
          Number(p.center_lon || p.lon || 107.61),
          Number(p.center_lat || p.lat || -6.91),
        ];
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: coords },
          properties: p,
        };
      });

      arr.push(
        new GeoJsonLayer({
          id: "multi-selected-features-ring",
          data: multiPoints as any,
          pickable: false,
          stroked: true,
          filled: true,
          pointType: "circle",
          getFillColor: [16, 185, 129, 65],
          getLineColor: [16, 185, 129, 255],
          getPointRadius: 26,
          pointRadiusScale: 1,
          pointRadiusMinPixels: 14,
          pointRadiusMaxPixels: 35,
          lineWidthMinPixels: 2.5,
          getLineWidth: 2.5,
        })
      );
    }

    // 0b. Glowing Cyan Target Ring on Selected / Searched Point
    if (selectedFeatureCoords) {
      arr.push(
        new GeoJsonLayer({
          id: "selected-feature-pulse-ring",
          data: [{
            type: "Feature",
            geometry: { type: "Point", coordinates: selectedFeatureCoords },
            properties: {}
          }] as any,
          pickable: false,
          stroked: true,
          filled: true,
          pointType: "circle",
          getFillColor: [0, 242, 254, 45],
          getLineColor: [0, 242, 254, 255],
          getPointRadius: 30,
          pointRadiusScale: 1,
          pointRadiusMinPixels: 18,
          pointRadiusMaxPixels: 45,
          lineWidthMinPixels: 3.5,
          getLineWidth: 3.5,
        })
      );
    }

    // 1. Dimming Mask Outside Bandung (Spotlight Highlight Effect)
    if (maskData) {
      arr.unshift(
        new GeoJsonLayer({
          id: "bandung-spotlight-mask-layer",
          data: maskData as any,
          pickable: false,
          stroked: false,
          filled: true,
          getFillColor: [10, 14, 25, 175],
        })
      );
    }

    // 2. Boundary Outline around Bandung
    if (boundaryData) {
      if (basemapStyle === "satellite") {
        // Zebra Cross Pattern (Layer Hitam Solid + Layer Putih Putus-Putus)
        arr.unshift(
          new GeoJsonLayer({
            id: "bandung-boundary-zebra-black",
            data: boundaryData as any,
            pickable: false,
            stroked: true,
            filled: false,
            getFillColor: [0, 0, 0, 0],
            getLineColor: [0, 0, 0, 255], // Hitam Solid
            getLineWidth: 3,
            lineWidthUnits: "pixels",
            lineWidthMinPixels: 2,
          }),
          new GeoJsonLayer({
            id: "bandung-boundary-zebra-white",
            data: boundaryData as any,
            pickable: false,
            stroked: true,
            filled: false,
            getFillColor: [0, 0, 0, 0],
            getLineColor: [255, 255, 255, 255], // Putih Putus-putus (Zebra)
            getLineWidth: 3,
            lineWidthUnits: "pixels",
            lineWidthMinPixels: 2,
            getLineDashArray: [10, 10], // 10px Putih, 10px Hitam
            dashJustified: true,
          })
        );
      } else {
        const boundaryColor: [number, number, number, number] = basemapStyle === "dark" 
          ? [255, 255, 255, 245]   // Putih Bersih untuk Dark Mode
          : [15, 23, 42, 240];     // Dark Slate untuk Street/Light Modes

        arr.unshift(
          new GeoJsonLayer({
            id: "bandung-boundary-layer",
            data: boundaryData as any,
            pickable: false,
            stroked: true,
            filled: false,
            getFillColor: [0, 0, 0, 0],
            getLineColor: boundaryColor,
            getLineWidth: 2.5,
            lineWidthUnits: "pixels",
            lineWidthMinPixels: 2,
          })
        );
      }
    }

    return arr;
  }, [showTasNits, showBusStops, showPOIs, geometryMode, tasNitsData, tasNitsLinesData, tasNitsPolygonsData, busStopsData, poisData, boundaryData, maskData, basemapStyle, onFeatureClick, colorMode, palette, scoreKey, selectedFeatureCoords, selectedFeatures]);

  const handleZoomIn = () => {
    setViewState((prev: any) => ({
      ...prev,
      zoom: Math.min((prev.zoom || 12.8) + 1, 20),
      transitionDuration: 300,
      transitionInterpolator: new FlyToInterpolator()
    }));
  };

  const handleZoomOut = () => {
    setViewState((prev: any) => ({
      ...prev,
      zoom: Math.max((prev.zoom || 12.8) - 1, 10),
      transitionDuration: 300,
      transitionInterpolator: new FlyToInterpolator()
    }));
  };

  const handleResetCompass = () => {
    setViewState((prev: any) => ({
      ...prev,
      bearing: 0,
      pitch: prev.pitch === 0 ? 45 : 0,
      transitionDuration: 500,
      transitionInterpolator: new FlyToInterpolator()
    }));
  };

  const popupScreenPos = useMemo(() => {
    if (!popupInfo || !popupInfo.coordinate || containerSize.width === 0 || containerSize.height === 0) {
      return null;
    }
    try {
      const viewport = new WebMercatorViewport({
        width: containerSize.width,
        height: containerSize.height,
        longitude: viewState.longitude,
        latitude: viewState.latitude,
        zoom: viewState.zoom,
        pitch: viewState.pitch,
        bearing: viewState.bearing,
      });
      const [x, y] = viewport.project(popupInfo.coordinate);
      if (isNaN(x) || isNaN(y)) return null;
      return { x, y };
    } catch {
      return null;
    }
  }, [popupInfo, containerSize, viewState.longitude, viewState.latitude, viewState.zoom, viewState.pitch, viewState.bearing]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState as any)}
        controller={true}
        layers={layers}
        onClick={(info) => {
          // Hanya batalkan seleksi jika pengguna mengklik area kosong peta (tidak mengenai feature manapun)
          if (!info || !info.object) {
            setPopupInfo(null);
            setSelectedFeatureCoords(null);
            onFeatureClick(null);
          }
        }}
      >
        <Map mapStyle={mapStyleUrl} mapLib={maplibregl} attributionControl={false} />
      </DeckGL>

      {/* ===== INTERACTIVE MAP NAVIGATION CONTROLS (Top Right) ===== */}
      <div className="absolute top-4 right-4 md:top-5 md:right-5 z-40 flex flex-col bg-[rgba(15,20,35,0.92)] backdrop-blur-2xl border border-[rgba(255,255,255,0.14)] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto">
        {/* Mode Multi-Pilih Toggle */}
        <button
          type="button"
          onClick={onToggleMultiSelectMode}
          className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center transition-colors border-b border-[rgba(255,255,255,0.08)] cursor-pointer active:scale-95 relative ${
            isMultiSelectMode
              ? "bg-cyan-500/25 text-cyan-300 shadow-[inset_0_0_10px_rgba(0,242,254,0.3)]"
              : "text-[var(--text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.1)]"
          }`}
          title={isMultiSelectMode ? "Mode Multi-Pilih Aktif: Klik titik di peta untuk memilih/batal (atau tahan Shift + Klik)" : "Aktifkan Mode Multi-Pilih Titik (atau Shift + Klik)"}
        >
          <CheckSquare size={17} strokeWidth={isMultiSelectMode ? 2.5 : 2} />
          {selectedFeatures && selectedFeatures.length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-[rgba(15,20,35,0.9)]" />
          )}
        </button>
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center text-[var(--text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.1)] transition-colors border-b border-[rgba(255,255,255,0.08)] cursor-pointer active:scale-95"
          title="Perbesar Peta (+)"
        >
          <Plus size={17} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center text-[var(--text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.1)] transition-colors border-b border-[rgba(255,255,255,0.08)] cursor-pointer active:scale-95"
          title="Perkecil Peta (-)"
        >
          <Minus size={17} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={handleResetCompass}
          className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center text-[var(--accent-cyan)] hover:bg-[rgba(0,242,254,0.15)] transition-colors cursor-pointer active:scale-95 group"
          title="Reset Orientasi & Pitch 3D"
        >
          <Compass
            size={17}
            style={{
              transform: `rotate(${- (viewState.bearing || 0)}deg)`,
              transition: "transform 0.4s ease"
            }}
            className="group-hover:rotate-45 transition-transform"
          />
        </button>
      </div>

      {/* ===== FLOATING MULTI-SELECT ACTION BAR (Top Center) ===== */}
      {(isMultiSelectMode || (selectedFeatures && selectedFeatures.length > 0)) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center max-w-[92vw] pointer-events-auto animate-in fade-in slide-in-from-top-3">
          <div 
            style={{ padding: "6px 8px 6px 14px", boxSizing: "border-box" }}
            className="flex items-center gap-2.5 bg-[rgba(15,20,35,0.95)] backdrop-blur-2xl border border-[rgba(255,255,255,0.16)] rounded-full shadow-[0_12px_36px_rgba(0,0,0,0.6)] select-none"
          >
            {/* Interactive Toggle Button to Inspect Selected Points */}
            <button
              type="button"
              onClick={() => setShowSelectedListPopover(!showSelectedListPopover)}
              className="flex items-center gap-1.5 pr-1 hover:opacity-85 transition-all cursor-pointer group"
              title={showSelectedListPopover ? "Tutup daftar titik terpilih" : "Klik untuk melihat daftar titik yang dipilih"}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${isMultiSelectMode ? "bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse" : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"}`} />
              <span className="text-xs font-semibold text-white font-mono whitespace-nowrap leading-none group-hover:text-cyan-300 transition-colors">
                {selectedFeatures?.length || 0} Titik Dipilih
              </span>
              <ChevronDown size={12} className={`text-slate-400 transition-transform duration-200 ${showSelectedListPopover ? "rotate-180 text-cyan-300" : "group-hover:text-white"}`} />
            </button>

            {Boolean(selectedFeature?.street_name) && Boolean(onSelectAllCorridor) && (
              <button
                type="button"
                onClick={() => onSelectAllCorridor && onSelectAllCorridor(String(selectedFeature?.street_name))}
                style={{ padding: "5px 10px", borderRadius: "9999px", boxSizing: "border-box" }}
                className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-cyan-300 hover:text-white bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 transition-colors whitespace-nowrap cursor-pointer"
                title={`Pilih semua titik di ${formatStreetName(selectedFeature?.street_name)}`}
              >
                <Layers size={12} className="shrink-0" />
                <span>Pilih Koridor</span>
              </button>
            )}

            {onOpenExport && (
              <button
                type="button"
                onClick={onOpenExport}
                style={{ padding: "5px 12px", borderRadius: "9999px", boxSizing: "border-box" }}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-[0_0_14px_rgba(6,182,212,0.35)] transition-all cursor-pointer whitespace-nowrap"
                title="Buka Modal Ekspor Laporan"
              >
                <Download size={13} className="shrink-0" />
                <span>Ekspor ({selectedFeatures?.length || 0})</span>
              </button>
            )}

            {onClearSelection && (selectedFeatures?.length || 0) > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClearSelection();
                  setShowSelectedListPopover(false);
                }}
                style={{ width: "24px", height: "24px", borderRadius: "9999px" }}
                className="flex items-center justify-center text-slate-400 hover:text-red-300 hover:bg-red-500/20 transition-colors cursor-pointer shrink-0"
                title="Reset Pilihan"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Selected Points Flyout Popover */}
          {showSelectedListPopover && selectedFeatures && selectedFeatures.length > 0 && (
            <div 
              style={{ padding: "12px 14px", width: "340px", maxWidth: "92vw", boxSizing: "border-box" }}
              className="mt-2 bg-[rgba(15,20,35,0.97)] backdrop-blur-2xl border border-[rgba(255,255,255,0.16)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200 z-50 pointer-events-auto select-none"
            >
              {/* Popover Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Titik Terpilih ({selectedFeatures.length})
                </span>
                <span className="text-[10.5px] text-slate-400">
                  Klik item untuk zoom
                </span>
              </div>

              {/* Centered Symmetric Divider */}
              <div className="w-full h-[1px] bg-white/[0.08]" />

              {/* Scrollable list of selected points */}
              <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto hidden-scrollbar">
                {selectedFeatures.map((feat: any, idx: number) => {
                  const p = feat.properties || feat;
                  const id = p.id || p.tas_nit_id;
                  const code = formatTasNitCode(id, p.tas_nit_code);
                  const street = formatStreetName(p.street_name);
                  const uvi = Number(p.uvi_score || 0).toFixed(3);
                  
                  // Comprehensive coordinate resolution
                  let targetLon = feat.geometry?.coordinates?.[0] || p.center_lon || p.lon;
                  let targetLat = feat.geometry?.coordinates?.[1] || p.center_lat || p.lat;

                  let masterFeat: any = null;
                  if ((!targetLon || !targetLat) && tasNitsData?.features) {
                    masterFeat = tasNitsData.features.find((f: any) =>
                      String(f.properties?.id || f.properties?.tas_nit_id || f.id) === String(id) ||
                      (p.tas_nit_code && f.properties?.tas_nit_code === p.tas_nit_code)
                    );
                    if (masterFeat?.geometry?.coordinates) {
                      const c = masterFeat.geometry.coordinates;
                      targetLon = Array.isArray(c[0]) ? (Array.isArray(c[0][0]) ? c[0][0][0] : c[0][0]) : c[0];
                      targetLat = Array.isArray(c[0]) ? (Array.isArray(c[0][0]) ? c[0][0][1] : c[0][1]) : c[1];
                    }
                  }

                  const lon = Number(targetLon || 107.61);
                  const lat = Number(targetLat || -6.91);

                  return (
                    <div
                      key={idx}
                      style={{ padding: "6px 10px", borderRadius: "10px", boxSizing: "border-box" }}
                      className="flex items-center justify-between gap-2 bg-white/[0.04] hover:bg-cyan-500/15 border border-white/[0.06] hover:border-cyan-500/30 transition-all cursor-pointer group"
                      onClick={() => {
                        // Fly to point and open popup at exact coordinates
                        setViewState((prev: any) => ({
                          ...prev,
                          longitude: lon,
                          latitude: lat,
                          zoom: 17,
                          transitionDuration: 1000,
                          transitionInterpolator: new FlyToInterpolator()
                        }));
                        const resolvedObject = masterFeat || (feat.geometry ? feat : { properties: { ...p, center_lon: lon, center_lat: lat }, geometry: { coordinates: [lon, lat] } });
                        handleFeatureSelect({
                          object: resolvedObject,
                          coordinate: [lon, lat]
                        });
                      }}
                      title="Klik untuk menuju ke titik ini"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold font-mono text-cyan-300 group-hover:text-cyan-200">
                          {code}
                        </span>
                        <span className="text-[11px] text-slate-300 truncate group-hover:text-white" title={street}>
                          {street}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10.5px] font-mono text-slate-300 bg-black/40 px-1.5 py-0.5 rounded font-semibold">
                          {uvi}
                        </span>
                        {onToggleSelectFeature && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleSelectFeature(p);
                            }}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-red-300 hover:bg-red-500/20 transition-colors cursor-pointer"
                            title="Hapus dari daftar pilihan"
                          >
                            <X size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Centered Symmetric Divider */}
              <div className="w-full h-[1px] bg-white/[0.08]" />

              {/* Popover Footer */}
              <div className="flex items-center justify-between gap-2">
                {onClearSelection && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearSelection();
                      setShowSelectedListPopover(false);
                    }}
                    style={{ padding: "4px 8px", borderRadius: "6px" }}
                    className="text-[11px] font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-colors cursor-pointer"
                  >
                    Reset Semua
                  </button>
                )}
                {onOpenExport && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSelectedListPopover(false);
                      onOpenExport();
                    }}
                    style={{ padding: "4px 10px", borderRadius: "6px" }}
                    className="text-[11px] font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all ml-auto cursor-pointer"
                  >
                    Buka Ekspor
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== DYNAMIC MULTILAYER FLOATING LEGEND (Bottom Left - Mobile Optimized) ===== */}
      {(showTasNits || showPOIs || showBusStops) && (
        <div className="absolute bottom-[86px] left-3.5 md:bottom-6 md:left-6 z-40 pointer-events-none">
          {!isLegendExpanded ? (
            <button
              type="button"
              onClick={() => setIsLegendExpanded(true)}
              style={{ padding: "8px 16px", boxSizing: "border-box" }}
              className="pointer-events-auto flex items-center gap-2.5 bg-[rgba(15,20,35,0.94)] backdrop-blur-2xl border border-[rgba(255,255,255,0.16)] hover:border-[var(--accent-cyan)] rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.6)] text-xs font-semibold text-white transition-all cursor-pointer group active:scale-95 select-none"
              title="Tampilkan Keterangan"
            >
              <span className="w-2 h-2 rounded-full bg-[var(--accent-cyan)] shadow-[0_0_8px_rgba(0,242,254,0.8)] animate-pulse shrink-0" />
              <span className="text-xs font-semibold tracking-wide text-white leading-none">Keterangan</span>
              <ChevronUp size={14} className="text-slate-400 group-hover:text-white transition-transform group-hover:-translate-y-0.5 shrink-0" />
            </button>
          ) : (
            <div
              style={{ padding: "14px 16px", minWidth: "220px", maxWidth: "260px" }}
              className="bg-[rgba(15,20,35,0.95)] backdrop-blur-2xl border border-[rgba(255,255,255,0.16)] rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.7)] pointer-events-auto flex flex-col gap-3 transition-all duration-300 max-h-[48vh] overflow-y-auto hidden-scrollbar animate-in fade-in slide-in-from-bottom-2 select-none"
            >
              {/* Card Header with Title and Minimize Button */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cyan)]" />
                  Keterangan Peta
                </span>
                <button
                  type="button"
                  onClick={() => setIsLegendExpanded(false)}
                  className="w-5 h-5 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Sembunyikan Keterangan"
                >
                  <ChevronDown size={14} />
                </button>
              </div>

              {/* Centered Symmetric Divider */}
              <div className="w-full h-[1px] bg-white/[0.08]" />

              {/* 1. Score Palette Gradient Bar */}
              {showTasNits && (
                <div>
                  <div
                    style={{ marginBottom: "8px" }}
                    className="text-[10.5px] font-bold text-[var(--text-secondary)] uppercase tracking-wider leading-none"
                  >
                    {palette.label}
                  </div>

                  {/* Gradient bar */}
                  <div
                    className="w-full h-2.5 rounded-full"
                    style={{
                      marginBottom: "6px",
                      background: `linear-gradient(to right, rgb(${palette.stops[0].slice(0,3).join(",")}), rgb(${palette.stops[1].slice(0,3).join(",")}), rgb(${palette.stops[2].slice(0,3).join(",")}), rgb(${palette.stops[3].slice(0,3).join(",")}), rgb(${palette.stops[4].slice(0,3).join(",")}))`
                    }}
                  />
                  <div className="flex justify-between items-center text-[9.5px] text-[var(--text-muted)] leading-none">
                    <span>0.0 (Rendah)</span>
                    <span>0.5</span>
                    <span>1.0 (Tinggi)</span>
                  </div>
                </div>
              )}

              {/* 2. Public Facilities / POI Legend */}
              {showPOIs && (
                <div
                  style={showTasNits ? { paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.08)" } : undefined}
                >
                  <div
                    style={{ marginBottom: "8px" }}
                    className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center justify-between leading-none"
                  >
                    <span>Fasilitas Publik (POI)</span>
                    <span className="text-[9px] text-[var(--text-muted)] font-normal">Kategori</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2.5 gap-y-1.5 text-[10.5px] text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0 shadow-[0_0_6px_rgba(168,85,247,0.6)]" style={{ backgroundColor: "rgb(168, 85, 247)" }} />
                      <span className="truncate">Pendidikan</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0 shadow-[0_0_6px_rgba(236,72,153,0.6)]" style={{ backgroundColor: "rgb(236, 72, 153)" }} />
                      <span className="truncate">Kesehatan</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0 shadow-[0_0_6px_rgba(245,158,11,0.6)]" style={{ backgroundColor: "rgb(245, 158, 11)" }} />
                      <span className="truncate">Komersial</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0 shadow-[0_0_6px_rgba(239,68,68,0.6)]" style={{ backgroundColor: "rgb(239, 68, 68)" }} />
                      <span className="truncate">Kuliner</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0 shadow-[0_0_6px_rgba(34,197,94,0.6)]" style={{ backgroundColor: "rgb(34, 197, 94)" }} />
                      <span className="truncate">Finansial</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0 shadow-[0_0_6px_rgba(6,182,212,0.6)]" style={{ backgroundColor: "rgb(6, 182, 212)" }} />
                      <span className="truncate">Olahraga</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Bus & Transit Stops Legend */}
              {showBusStops && (
                <div
                  style={(showTasNits || showPOIs) ? { paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.08)" } : undefined}
                >
                  <div
                    style={{ marginBottom: "6px" }}
                    className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider leading-none"
                  >
                    Simpul Transportasi
                  </div>
                  <div className="flex items-center gap-2 text-[10.5px] text-slate-300">
                    <span className="w-2 h-2 rounded-full shrink-0 bg-blue-500 border border-white shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
                    <span>Halte Bus / Angkot</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}


      {/* ===== MAP TYPE THUMBNAIL WIDGET & MENU (Bottom Right - Mobile Optimized) ===== */}
      <div className="absolute bottom-[86px] right-3.5 md:bottom-6 md:right-6 z-40 pointer-events-auto">
        <div className="relative p-[1.5px] md:p-[2px] rounded-2xl bg-gradient-to-br from-cyan-400/50 via-white/10 to-blue-600/40 hover:from-cyan-400 hover:via-indigo-400 hover:to-pink-500 transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.6)] hover:shadow-[0_0_24px_rgba(0,242,254,0.4)]">
          <button
            type="button"
            onClick={() => setShowBasemapMenu(!showBasemapMenu)}
            className={`w-[58px] h-[58px] md:w-[78px] md:h-[78px] rounded-[13px] md:rounded-[14px] overflow-hidden relative group cursor-pointer transition-all duration-300 block select-none ${
              showBasemapMenu
                ? "ring-2 ring-[#00f2fe] shadow-[0_0_25px_rgba(0,242,254,0.5)] scale-105"
                : "hover:scale-105 active:scale-95"
            }`}
            title="Pilih Tipe Peta (Map Type)"
          >
            {/* Background Image Preview with Zoom Animation */}
            <img
              src={activeStyleObj.previewImg}
              alt={activeStyleObj.label}
              className="w-full h-full object-cover group-hover:scale-115 group-hover:rotate-1 transition-all duration-500 ease-out"
            />
            
            {/* Dark vignette overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30 group-hover:from-black/70 transition-colors" />

            {/* Top Right Floating Layers Icon Badge */}
            <div className="absolute top-1 right-1 md:top-1.5 md:right-1.5 w-5 h-5 md:w-6 md:h-6 rounded-md md:rounded-lg bg-[rgba(15,20,35,0.85)] backdrop-blur-md border border-white/20 flex items-center justify-center shadow-sm group-hover:border-[var(--accent-cyan)] transition-colors">
              <Layers size={11} className="text-[var(--accent-cyan)] group-hover:rotate-12 transition-transform duration-300" />
            </div>

            {/* Bottom Frosted Pill with Label */}
            <div className="absolute bottom-1 inset-x-1 md:bottom-1.5 md:inset-x-1.5 py-0.5 md:py-1 px-1 md:px-1.5 bg-[rgba(15,20,35,0.9)] backdrop-blur-md rounded-md md:rounded-lg border border-white/15 flex items-center justify-center gap-1 shadow-sm group-hover:border-white/30 transition-all">
              <span className="text-[9px] md:text-[10px] font-bold text-white tracking-wider uppercase truncate group-hover:text-[var(--accent-cyan)] transition-colors">
                {activeStyleObj.label}
              </span>
            </div>
          </button>


          {/* MAP TYPE POPOVER MENU (EXPANDS UPWARDS FROM BOTTOM RIGHT) */}
          {showBasemapMenu && (
            <div
              style={{ padding: "16px 14px 18px 14px" }}
              className="absolute bottom-16 md:bottom-24 right-0 z-50 w-64 md:w-72 bg-[rgba(15,20,35,0.96)] backdrop-blur-2xl border border-[rgba(255,255,255,0.16)] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-auto"
            >
              {/* Header with Centered Title & Generous Separation */}
              <div className="flex items-center justify-between">
                <div className="w-6 h-6 shrink-0 pointer-events-none" /> {/* Symmetric spacer */}
                <span className="text-sm font-bold text-white tracking-wide leading-none">
                  Tipe Peta
                </span>
                <button
                  type="button"
                  onClick={() => setShowBasemapMenu(false)}
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 text-xs transition-colors cursor-pointer shrink-0"
                  title="Tutup"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Centered Symmetric Divider */}
              <div className="w-full h-[1px] bg-white/[0.1] my-3" />

              {/* 2-Column Grid */}
              <div
                style={{ columnGap: "10px", rowGap: "12px" }}
                className="grid grid-cols-2"
              >
                {BASEMAP_OPTIONS.map((opt) => {
                  const isActive = basemapStyle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setBasemapStyle(opt.id);
                      }}
                      className="flex flex-col items-center group cursor-pointer text-center w-full"
                    >
                      <div
                        className={`w-full h-16 md:h-20 rounded-xl overflow-hidden border-2 transition-all relative ${
                          isActive
                            ? "border-[#00f2fe] ring-2 ring-[#00f2fe]/40 scale-105 shadow-[0_0_15px_rgba(0,242,254,0.4)]"
                            : "border-[rgba(255,255,255,0.12)] group-hover:border-slate-300 opacity-70 group-hover:opacity-100"
                        }`}
                      >
                        <img
                          src={opt.previewImg}
                          alt={opt.label}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                        {isActive && (
                          <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2 w-4.5 h-4.5 md:w-5 md:h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.8)] border border-emerald-300/40">
                            <Check size={11} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <div
                        style={{ marginTop: "5px" }}
                        className="flex items-center justify-center gap-1.5 text-[11px] md:text-xs font-semibold text-slate-300 group-hover:text-white leading-tight"
                      >
                        {opt.icon}
                        <span>{opt.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      
      {/* Deck.gl Custom HTML Popup Overlay (Fixed to Geographic Coordinates) */}
      {popupInfo && popupScreenPos && (
        <div 
          className="absolute z-50 bg-[rgba(10,14,25,0.96)] backdrop-blur-xl border border-[rgba(255,255,255,0.12)] shadow-[0_20px_60px_rgba(0,0,0,0.7)] rounded-2xl pointer-events-auto"
          style={{
            left: `${popupScreenPos.x}px`,
            top: `${popupScreenPos.y}px`,
            transform: 'translate(-50%, -100%)',
            marginTop: '-15px',
            padding: '16px',
            width: '280px',
            maxWidth: 'calc(100vw - 32px)',
            boxSizing: 'border-box',
          }}
        >
          <button 
            className="absolute top-4 right-4 z-10 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
            onClick={() => {
              setPopupInfo(null);
              setSelectedFeatureCoords(null);
              onFeatureClick(null);
            }}
            title="Tutup Popup"
          >
            <X size={13} />
          </button>
          
          <div dangerouslySetInnerHTML={{ __html: popupInfo.html }} />

          {/* Quick toggle into multi-select list right from popup */}
          {selectedFeature && onToggleSelectFeature && (
            <div className="flex flex-col gap-2.5 mt-2.5">
              <div className="w-full h-[1px] bg-white/[0.08]" />
              <div>
                {(() => {
                  const isSelected = selectedFeatures?.some(
                    (f: any) =>
                      String(f?.properties?.id || f?.properties?.tas_nit_id || f?.id || f?.tas_nit_id) ===
                      String(selectedFeature.id || selectedFeature.tas_nit_id)
                  );
                  return (
                    <button
                      type="button"
                      onClick={() => onToggleSelectFeature(selectedFeature)}
                      style={{ padding: "5px 10px", borderRadius: "8px", boxSizing: "border-box" }}
                      className={`w-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                          : "bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white border border-white/10"
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check size={12} className="text-emerald-400" />
                          <span>Titik Terpilih</span>
                        </>
                      ) : (
                        <>
                          <Plus size={12} className="text-slate-400" />
                          <span>Pilih Titik</span>
                        </>
                      )}
                    </button>
                  );
                })()}
              </div>
            </div>
          )}
          
          {/* Triangle Pointer */}
          <div className="absolute left-1/2 bottom-0 w-3 h-3 bg-[rgba(10,14,25,0.95)] border-b border-r border-[rgba(255,255,255,0.1)]" 
               style={{ transform: 'translate(-50%, 50%) rotate(45deg)' }} />
        </div>
      )}
    </div>
  );
}
