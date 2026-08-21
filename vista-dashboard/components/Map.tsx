"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Map, { NavigationControl } from "react-map-gl/maplibre";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer } from "@deck.gl/layers";
import { FlyToInterpolator } from "@deck.gl/core";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("https://unpkg.com/maplibre-gl@6.3.0/dist/maplibre-gl-worker.mjs");
}

interface TasNitFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Record<string, unknown>;
}

interface GeoJSONData {
  type: "FeatureCollection";
  features: TasNitFeature[];
}

interface MapComponentProps {
  showTasNits: boolean;
  showBusStops: boolean;
  showPOIs: boolean;
  onFeatureClick: (properties: Record<string, unknown> | null) => void;
  onStatsUpdate: (stats: {
    totalTasNits: number;
    totalBusStops: number;
    totalPOIs: number;
    avgScore: number;
    walkingClasses: Record<string, number>;
  }) => void;
  searchQuery?: string;
  tasNitsData: GeoJSONData | null;
  busStopsData: GeoJSONData | null;
  poisData: GeoJSONData | null;
}

const MAPID_API_KEY = process.env.NEXT_PUBLIC_MAPID_BASEMAP_KEY || "";
const mapStyleUrl = `https://basemap.mapid.io/styles/dark/style.json?key=${MAPID_API_KEY}`;

export default function MapComponent({
  showTasNits,
  showBusStops,
  showPOIs,
  onFeatureClick,
  onStatsUpdate,
  searchQuery,
  tasNitsData,
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
      const scores = tasNits.features
        .map((f) => f.properties.accessibility_score as number)
        .filter((s) => s !== null && s !== undefined);

      const walkingClasses: Record<string, number> = {};
      tasNits.features.forEach((f) => {
        const cls = (f.properties.walking_class as string) || "Unknown";
        walkingClasses[cls] = (walkingClasses[cls] || 0) + 1;
      });

      onStatsUpdate({
        totalTasNits: tasNits.features.length,
        totalBusStops: busStops.features.length,
        totalPOIs: pois.features.length,
        avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
        walkingClasses,
      });
    },
    [onStatsUpdate]
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

    // 1. Search in Halte
    let found = busStopsData?.features.find(f => 
      String(f.properties.name).toLowerCase().includes(query)
    );
    
    // 2. Search in TAS-Nits
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

  const layers = useMemo(() => {
    const arr = [];

    if (showTasNits && tasNitsData) {
      arr.push(
        new GeoJsonLayer({
          id: "tas-nits-layer",
          data: tasNitsData,
          pickable: true,
          stroked: false,
          filled: true,
          pointType: "circle",
          lineWidthScale: 1,
          lineWidthMinPixels: 0,
          getPointRadius: 10,
          pointRadiusScale: 1,
          pointRadiusMinPixels: 3,
          getFillColor: (d: any) => {
            const accScore = Number(d.properties.accessibility_score) || 0;
            if (accScore >= 0.8) return [0, 242, 254, 204];    // #00f2fe
            if (accScore >= 0.5) return [132, 204, 22, 204];   // #84cc16
            if (accScore > 0) return [245, 158, 11, 204];      // #f59e0b
            return [239, 68, 68, 204];                         // #ef4444
          },
          onClick: (info) => {
            if (info.object) {
              const props = info.object.properties;
              onFeatureClick(props as Record<string, unknown>);
              
              const accScore = Number(props.accessibility_score);
              const color = accScore >= 0.6 ? "#22c55e" : accScore >= 0.3 ? "#f59e0b" : "#ef4444";

              setPopupInfo({
                x: info.x,
                y: info.y,
                html: `
                  <div style="font-size:13px; color:#f1f5f9;">
                    <div style="font-weight:700;font-size:14px;margin-bottom:6px;color:#06b6d4;">
                      ${props.street_name || "Jalan Tanpa Nama"}
                    </div>
                    <div style="color:#94a3b8;margin-bottom:8px;">
                      Halte: ${props.nearest_stop} • ${props.highway_type}
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                      <div>
                        <span style="color:#64748b;font-size:11px;">Skor Aksesibilitas</span><br/>
                        <span style="font-family:'JetBrains Mono';font-size:20px;font-weight:700;color:${color};">${accScore.toFixed(4)}</span>
                      </div>
                      <div>
                        <span style="color:#64748b;font-size:11px;">Jarak ke Halte</span><br/>
                        <span style="font-family:'JetBrains Mono';font-size:20px;font-weight:700;color:#f1f5f9;">
                          ${Number(props.avg_distance_to_stop).toFixed(0)}m
                        </span>
                      </div>
                    </div>
                  </div>
                `
              });
            }
          }
        })
      );
    }

    if (showBusStops && busStopsData) {
      arr.push(
        new GeoJsonLayer({
          id: "bus-stops-layer",
          data: busStopsData,
          pickable: true,
          stroked: true,
          filled: true,
          pointType: "circle",
          getPointRadius: 15,
          pointRadiusScale: 1,
          pointRadiusMinPixels: 4,
          getFillColor: [59, 130, 246, 255],      // #3b82f6
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
          data: poisData,
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
              case "Pendidikan": return [168, 85, 247, 230]; // #a855f7
              case "Kesehatan": return [236, 72, 153, 230]; // #ec4899
              case "Komersial": return [245, 158, 11, 230]; // #f59e0b
              case "Katering": return [239, 68, 68, 230]; // #ef4444
              case "Finansial": return [34, 197, 94, 230]; // #22c55e
              case "Olahraga": return [6, 182, 212, 230]; // #06b6d4
              default: return [148, 163, 184, 230]; // #94a3b8
            }
          },
          getLineColor: [255, 255, 255, 100],
          getLineWidth: 1
        })
      );
    }

    return arr;
  }, [showTasNits, showBusStops, showPOIs, tasNitsData, busStopsData, poisData, onFeatureClick]);

  return (
    <div className="w-full h-full relative" onClick={(e) => {
        // Close popup if clicking outside layers
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
        <Map mapStyle={mapStyleUrl} mapLib={maplibregl} attributionControl={false}>
          <NavigationControl position="top-right" />
        </Map>
      </DeckGL>
      
      {/* Deck.gl Custom HTML Popup Overlay */}
      {popupInfo && (
        <div 
          className="absolute z-50 p-3 bg-slate-900 border border-slate-700 shadow-2xl rounded-xl pointer-events-auto"
          style={{
            left: popupInfo.x,
            top: popupInfo.y,
            transform: 'translate(-50%, -100%)',
            marginTop: '-15px'
          }}
        >
          {/* Close button */}
          <button 
            className="absolute top-2 right-2 text-slate-400 hover:text-white"
            onClick={() => setPopupInfo(null)}
          >
            ✕
          </button>
          
          <div dangerouslySetInnerHTML={{ __html: popupInfo.html }} className="pr-4 mt-1" />
          
          {/* Triangle Pointer */}
          <div className="absolute left-1/2 bottom-0 w-3 h-3 bg-slate-900 border-b border-r border-slate-700" 
               style={{ transform: 'translate(-50%, 50%) rotate(45deg)' }} />
        </div>
      )}
    </div>
  );
}
