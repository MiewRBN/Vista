"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Map, { NavigationControl } from "react-map-gl/maplibre";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer } from "@deck.gl/layers";
import { FlyToInterpolator } from "@deck.gl/core";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Plus, Minus, Compass } from "lucide-react";
import { formatStreetName } from "@/app/page";


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
  geometryMode?: GeometryMode;
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
}

const MAPID_API_KEY = process.env.NEXT_PUBLIC_MAPID_BASEMAP_KEY || "";
const mapStyleUrl = `https://basemap.mapid.io/styles/dark/style.json?key=${MAPID_API_KEY}`;

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
    label: "Skor Aksesibilitas",
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
  geometryMode = "point",
  onFeatureClick,
  onStatsUpdate,
  searchQuery,
  tasNitsData,
  tasNitsLinesData,
  tasNitsPolygonsData,
  busStopsData,
  poisData,
}: MapComponentProps) {

  const [viewState, setViewState] = useState({
    longitude: 107.6191,
    latitude: -6.9175,
    zoom: 12.5,
    pitch: 40,
    bearing: -10,
    transitionDuration: 0,
    transitionInterpolator: undefined as any,
  });

  const [popupInfo, setPopupInfo] = useState<{
    x: number;
    y: number;
    html: string;
  } | null>(null);

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

  useEffect(() => {
    if (tasNitsData && busStopsData && poisData) {
      handleStatsUpdate(tasNitsData, busStopsData, poisData);
    }
  }, [tasNitsData, busStopsData, poisData, handleStatsUpdate]);

  // Handle Search FlyTo
  useEffect(() => {
    if (!searchQuery) return;
    const query = searchQuery.toLowerCase();

    let found = busStopsData?.features.find(f =>
      String(f.properties.name).toLowerCase().includes(query)
    );

    if (!found) {
      found = tasNitsData?.features.find(f =>
        String(f.properties.street_name).toLowerCase().includes(query) ||
        String(f.properties.nearest_stop).toLowerCase().includes(query)
      );
    }

    if (found) {
      const [lon, lat] = found.geometry.coordinates;
      setViewState((prev) => ({
        ...prev,
        longitude: lon,
        latitude: lat,
        zoom: 16,
        transitionDuration: 1500,
        transitionInterpolator: new FlyToInterpolator()
      }));
    }
  }, [searchQuery, busStopsData, tasNitsData]);

  const palette = COLOR_PALETTES[colorMode];
  const scoreKey = getScoreKey(colorMode);

  const layers = useMemo(() => {
    const arr = [];

    const handleFeatureSelect = (info: any) => {
      if (info.object) {
        const p = info.object.properties;
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
            <div style="margin-bottom:6px;">
              <div style="display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;margin-bottom:2px;">
                <span>${label}</span>
                <span style="color:#f1f5f9;font-weight:600;">${val.toFixed(3)}</span>
              </div>
              <div style="width:100%;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">
                <div style="width:${w}%;height:100%;background:${color};border-radius:3px;transition:width 0.3s;"></div>
              </div>
            </div>`;
        };

        setPopupInfo({
          x: info.x,
          y: info.y,
          html: `
            <div style="font-size:13px; color:#f1f5f9; min-width:220px;">
              <div style="font-weight:700;font-size:14px;margin-bottom:2px;color:#06b6d4;">
                ${formatStreetName(p.street_name) || "Kawasan TOD"}
              </div>

              <div style="color:#94a3b8;margin-bottom:10px;font-size:12px;">
                🚏 ${p.nearest_stop || "-"} ${p.avg_distance_to_stop ? `• ${Number(p.avg_distance_to_stop).toFixed(0)}m` : ""} ${p.walking_class ? `• ${p.walking_class}` : ""} ${p.n_tas_nits ? `• ${p.n_tas_nits} Segmen` : ""}
              </div>
              <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:12px;">
                <span style="font-size:28px;font-weight:800;color:${getScoreColor(colorMode)};">${uviScore.toFixed(2)}</span>
                <span style="font-size:12px;color:#94a3b8;">UVI Score</span>
              </div>
              ${makeBar(accScore, "#4facfe", "♿ Aksesibilitas")}
              ${makeBar(physScore, "#22c55e", "🏙️ Ling. Fisik")}
              ${makeBar(sentScore, "#f59e0b", "💬 Sentimen")}
              ${Number(p.gvi) > 0 ? `
              <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;text-align:center;">
                <div><div style="font-size:14px;font-weight:700;color:#84cc16;">${(Number(p.gvi)*100).toFixed(0)}%</div><div style="font-size:10px;color:#64748b;">GVI</div></div>
                <div><div style="font-size:14px;font-weight:700;color:#0ea5e9;">${(Number(p.svf)*100).toFixed(0)}%</div><div style="font-size:10px;color:#64748b;">SVF</div></div>
                <div><div style="font-size:14px;font-weight:700;color:#f59e0b;">${(Number(p.sidewalk)*100).toFixed(0)}%</div><div style="font-size:10px;color:#64748b;">Trotoar</div></div>
              </div>` : ""}
            </div>
          `
        });
      }
    };

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
        // Mode 3: Blok Kawasan Catchment Area 400m (Polygon - Gambar b Proposal)
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
              return [r, g, b, 140];
            },
            getLineColor: (d: any) => {
              const score = Number(d.properties[scoreKey]) || 0;
              const [r, g, b] = interpolateColor(score, palette.stops);
              return [r, g, b, 230];
            },
            lineWidthMinPixels: 2,
            getLineWidth: 2,
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
              setPopupInfo({
                x: info.x,
                y: info.y,
                html: `
                  <div style="font-size:13px;">
                    <div style="font-weight:700;font-size:14px;color:#3b82f6;">🚏 ${props.name}</div>
                  </div>
                `
              });
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

    return arr;
  }, [showTasNits, showBusStops, showPOIs, geometryMode, tasNitsData, tasNitsLinesData, tasNitsPolygonsData, busStopsData, poisData, onFeatureClick, colorMode, palette, scoreKey]);

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

  return (
    <div className="w-full h-full relative" onClick={(e) => {
        if (e.target instanceof HTMLCanvasElement && popupInfo) {
          setPopupInfo(null);
        }
    }}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState as any)}
        controller={true}
        layers={layers}
      >
        <Map mapStyle={mapStyleUrl} mapLib={maplibregl} attributionControl={false} />
      </DeckGL>

      {/* ===== INTERACTIVE MAP NAVIGATION CONTROLS (Top Right) ===== */}
      <div className="absolute top-5 right-5 z-40 flex flex-col bg-[rgba(15,20,35,0.92)] backdrop-blur-2xl border border-[rgba(255,255,255,0.14)] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto">
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-10 h-10 flex items-center justify-center text-[var(--text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.1)] transition-colors border-b border-[rgba(255,255,255,0.08)] cursor-pointer active:scale-95"
          title="Perbesar Peta (+)"
        >
          <Plus size={18} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="w-10 h-10 flex items-center justify-center text-[var(--text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.1)] transition-colors border-b border-[rgba(255,255,255,0.08)] cursor-pointer active:scale-95"
          title="Perkecil Peta (-)"
        >
          <Minus size={18} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={handleResetCompass}
          className="w-10 h-10 flex items-center justify-center text-[var(--accent-cyan)] hover:bg-[rgba(0,242,254,0.15)] transition-colors cursor-pointer active:scale-95 group"
          title="Reset Orientasi & Pitch 3D"
        >
          <Compass
            size={18}
            style={{
              transform: `rotate(${- (viewState.bearing || 0)}deg)`,
              transition: "transform 0.4s ease"
            }}
            className="group-hover:rotate-45 transition-transform"
          />
        </button>
      </div>

      {/* ===== FLOATING LEGEND (Balanced Internal Breathing Space) ===== */}

      <div className="absolute bottom-6 left-6 z-40 pointer-events-none">
        <div
          style={{ padding: "16px 18px 14px 18px", minWidth: "220px" }}
          className="bg-[rgba(15,20,35,0.92)] backdrop-blur-2xl border border-[rgba(255,255,255,0.14)] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] pointer-events-auto"
        >
          <div
            style={{ marginBottom: "12px" }}
            className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider leading-none"
          >
            {palette.label}
          </div>

          {/* Gradient bar */}
          <div
            className="w-full h-3 rounded-full"
            style={{
              marginBottom: "8px",
              background: `linear-gradient(to right, rgb(${palette.stops[0].slice(0,3).join(",")}), rgb(${palette.stops[1].slice(0,3).join(",")}), rgb(${palette.stops[2].slice(0,3).join(",")}), rgb(${palette.stops[3].slice(0,3).join(",")}), rgb(${palette.stops[4].slice(0,3).join(",")}))`
            }}
          />
          <div className="flex justify-between items-center text-[10px] text-[var(--text-muted)] leading-none">
            <span>0.0 (Rendah)</span>
            <span>0.5</span>
            <span>1.0 (Tinggi)</span>
          </div>
        </div>

      </div>

      
      {/* Deck.gl Custom HTML Popup Overlay */}
      {popupInfo && (
        <div 
          className="absolute z-50 bg-[rgba(10,14,25,0.95)] backdrop-blur-xl border border-[rgba(255,255,255,0.1)] shadow-[0_20px_60px_rgba(0,0,0,0.6)] rounded-2xl pointer-events-auto"
          style={{
            left: popupInfo.x,
            top: popupInfo.y,
            transform: 'translate(-50%, -100%)',
            marginTop: '-15px',
            padding: '16px',
          }}
        >
          <button 
            className="absolute top-2.5 right-3 text-slate-500 hover:text-white text-sm transition-colors"
            onClick={() => setPopupInfo(null)}
          >
            ✕
          </button>
          
          <div dangerouslySetInnerHTML={{ __html: popupInfo.html }} className="pr-3 mt-0.5" />
          
          {/* Triangle Pointer */}
          <div className="absolute left-1/2 bottom-0 w-3 h-3 bg-[rgba(10,14,25,0.95)] border-b border-r border-[rgba(255,255,255,0.1)]" 
               style={{ transform: 'translate(-50%, 50%) rotate(45deg)' }} />
        </div>
      )}
    </div>
  );
}
