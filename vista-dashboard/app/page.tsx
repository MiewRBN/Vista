"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useEffect, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import StatsPanel from "@/components/StatsPanel";
import AiInsightPanel from "@/components/AiInsightPanel";
import { Target, Accessibility, Building2, MessageSquare, Activity, AlertTriangle, Lightbulb, Trophy, Users, GraduationCap, Mail, Info, Database, Layers, CircleDot, Route, Square, Sparkles, BrainCircuit } from "lucide-react";

import type { ColorMode, GeometryMode } from "@/components/Map";

// MapLibre harus di-import secara dynamic (client-only)
const MapComponent = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="text-center animate-pulse-glow">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <circle cx="12" cy="10" r="3" />
            <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
          </svg>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">Memuat peta Bandung...</p>
      </div>
    </div>
  ),
});

interface TasNitFeature {
  type: "Feature";
  geometry: { type: string; coordinates: any };
  properties: Record<string, unknown>;
}

interface GeoJSONData {
  type: "FeatureCollection";
  features: TasNitFeature[];
}

interface StatsData {
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
}

const COLOR_MODES: { key: ColorMode; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "uvi", label: "UVI", icon: <Target size={20} strokeWidth={1.5} />, color: "#00f2fe" },
  { key: "accessibility", label: "Aktivitas", icon: <Activity size={20} strokeWidth={1.5} />, color: "#4facfe" },
  { key: "physical", label: "Fisik", icon: <Building2 size={20} strokeWidth={1.5} />, color: "#22c55e" },
  { key: "sentiment", label: "Sentimen", icon: <MessageSquare size={20} strokeWidth={1.5} />, color: "#f59e0b" },
];

export const formatStreetName = (name: unknown): string => {
  if (!name) return "Jalan Tanpa Nama";
  let n = String(name).trim();
  if (n.startsWith("[") && n.endsWith("]")) {
    try {
      const parsed = JSON.parse(n.replace(/'/g, '"'));
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .map((s) => String(s).replace(/[\[\]'"]/g, "").trim())
          .filter(Boolean)
          .join(" / ");
      }
    } catch {
      const cleaned = n
        .replace(/[\[\]'"]/g, "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" / ");
      if (cleaned) return cleaned;
    }
  }
  n = n.replace(/[\[\]'"]/g, "").trim();
  return n || "Jalan Tanpa Nama";
};

export const formatTasNitCode = (id: unknown, tasNitCode?: unknown): string => {
  if (tasNitCode && typeof tasNitCode === "string" && tasNitCode.startsWith("TASnit")) {
    return tasNitCode;
  }
  if (!id) return "TASnit";
  const str = String(id).trim();
  if (str.startsWith("TASnit")) return str;
  return str;
};

export const extractStreetNames = (name: unknown): string[] => {
  if (!name) return [];
  const n = String(name).trim();
  if (n.startsWith("[") && n.endsWith("]")) {
    try {
      const parsed = JSON.parse(n.replace(/'/g, '"'));
      if (Array.isArray(parsed)) {
        return parsed
          .map((s) => String(s).replace(/[\[\]'"]/g, "").trim())
          .filter((s) => s.length > 0);
      }
    } catch {
      return n
        .replace(/[\[\]'"]/g, "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
  }
  const clean = n.replace(/[\[\]'"]/g, "").trim();
  return clean ? [clean] : [];
};

export default function Home() {
  const [showTasNits, setShowTasNits] = useState(true);
  const [showBusStops, setShowBusStops] = useState(false);
  const [showPOIs, setShowPOIs] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<Record<string, unknown> | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState("analytics");
  const [colorMode, setColorMode] = useState<ColorMode>("uvi");
  const [geometryMode, setGeometryMode] = useState<GeometryMode>("point");

  const [tasNitsData, setTasNitsData] = useState<GeoJSONData | null>(null);
  const [tasNitsLinesData, setTasNitsLinesData] = useState<GeoJSONData | null>(null);
  const [tasNitsPolygonsData, setTasNitsPolygonsData] = useState<GeoJSONData | null>(null);
  const [busStopsData, setBusStopsData] = useState<GeoJSONData | null>(null);
  const [poisData, setPoisData] = useState<GeoJSONData | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    Promise.all([
      fetch("/api/tas-nits", { signal: controller.signal }),
      fetch("/api/bus-stops", { signal: controller.signal }),
      fetch("/api/pois", { signal: controller.signal }),
      fetch(`/data/tas_nits_lines.json?v=${Date.now()}`, { signal: controller.signal }),
      fetch(`/data/tas_nits_polygons.json?v=${Date.now()}`, { signal: controller.signal }),
    ])
      .then(async ([tasNitsRes, busStopsRes, poisRes, linesRes, polyRes]) => {
        if (!isMounted) return;
        const tasNits: GeoJSONData = await tasNitsRes.json();
        const busStops: GeoJSONData = await busStopsRes.json();
        const pois: GeoJSONData = await poisRes.json();
        const lines: GeoJSONData = await linesRes.json();
        const polys: GeoJSONData = await polyRes.json();

        if (isMounted) {
          const idMap = new Map<string, string>();

          if (tasNits && tasNits.features) {
            tasNits.features.forEach((f, idx) => {
              const code = `TASnit ${String(idx + 1).padStart(4, "0")}`;
              f.properties.tas_nit_code = code;
              if (f.properties.id) idMap.set(String(f.properties.id), code);
              if (f.properties.tas_nit_id) idMap.set(String(f.properties.tas_nit_id), code);
            });
          }

          if (lines && lines.features) {
            lines.features.forEach((f) => {
              const rawId = String(f.properties.id || f.properties.tas_nit_id || "");
              if (idMap.has(rawId)) {
                f.properties.tas_nit_code = idMap.get(rawId);
              }
            });
          }

          if (polys && polys.features) {
            polys.features.forEach((f) => {
              const rawId = String(f.properties.id || f.properties.tas_nit_id || "");
              if (idMap.has(rawId)) {
                f.properties.tas_nit_code = idMap.get(rawId);
              }
            });
          }

          setTasNitsData(tasNits);
          setBusStopsData(busStops);
          setPoisData(pois);
          setTasNitsLinesData(lines);
          setTasNitsPolygonsData(polys);
        }
      })
      .catch((err) => {
        if (!isMounted || err.name === "AbortError") return;
        console.error("Error loading data:", err);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const handleStatsUpdate = useCallback((newStats: StatsData) => {
    setStats(newStats);
  }, []);

  const handleFeatureClick = useCallback((properties: Record<string, unknown> | null) => {
    setSelectedFeature(properties);
    // Auto-switch to analytics tab to show Linked Views detail
    if (properties) {
      setActiveSidebarTab("analytics");
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (val.trim().length > 0) {
      const query = val.toLowerCase().trim();
      const newSuggestions: string[] = [];

      // 1. Search TAS-Nits by ID / Code / Street Name / Stop
      if (tasNitsData) {
        tasNitsData.features.forEach((f) => {
          if (newSuggestions.length >= 6) return;
          const code = formatTasNitCode(f.properties.id || f.properties.tas_nit_id, f.properties.tas_nit_code);
          const rawName = f.properties.street_name;
          const cleanNames = extractStreetNames(rawName);
          const nearestStop = String(f.properties.nearest_stop || "");

          if (code.toLowerCase().includes(query) || String(f.properties.id || "").toLowerCase().includes(query)) {
            const label = `${code} (${cleanNames[0] || "Koridor"} • ${nearestStop})`;
            if (!newSuggestions.includes(label)) {
              newSuggestions.push(label);
            }
          } else {
            cleanNames.forEach((name) => {
              if (name.toLowerCase().includes(query) && !newSuggestions.includes(name)) {
                newSuggestions.push(name);
              }
            });
          }
        });
      }

      // 2. Search Bus Stops
      if (busStopsData && newSuggestions.length < 6) {
        busStopsData.features.forEach((f) => {
          if (newSuggestions.length >= 6) return;
          const rawName = f.properties.name;
          const cleanNames = extractStreetNames(rawName);
          cleanNames.forEach((name) => {
            if (name.toLowerCase().includes(query) && !newSuggestions.includes(name)) {
              newSuggestions.push(name);
            }
          });
        });
      }

      setSuggestions(newSuggestions.slice(0, 6));
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setActiveSearch(searchQuery);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (val: string) => {
    const match = val.match(/^(TASnit \d+)/i);
    const searchVal = match ? match[1] : val;
    setSearchQuery(searchVal);
    setActiveSearch(searchVal);
    setShowSuggestions(false);
  };

  // Dynamic AI Insight (calculated from real data — CCIA framework)
  const aiInsight = useMemo(() => {
    if (!tasNitsData || !stats) return null;

    const features = tasNitsData.features;
    const total = features.length;

    // Condition: How many TAS-Nits have low UVI?
    const lowUvi = features.filter(f => Number(f.properties.uvi_score) < 0.3).length;
    const highUvi = features.filter(f => Number(f.properties.uvi_score) > 0.7).length;
    const lowPct = (lowUvi / total * 100).toFixed(1);
    const highPct = (highUvi / total * 100).toFixed(1);

    // Find best and worst streets
    const withUvi = features.filter(f => Number(f.properties.uvi_score) > 0);
    const sorted = [...withUvi].sort((a, b) => Number(b.properties.uvi_score) - Number(a.properties.uvi_score));
    const best = sorted.slice(0, 3);
    const worst = sorted.slice(-3).reverse();

    // Cause: Which pillar is weakest on average?
    const avgAcc = stats.avgAccessibility;
    const avgPhys = stats.avgPhysical;
    const avgSent = stats.avgSentiment;
    const weakest = avgPhys < avgAcc && avgPhys < avgSent ? "Lingkungan Fisik" : avgSent < avgAcc ? "Sentimen Warga" : "Aktivitas & Fungsi Perkotaan";

    return { total, lowUvi, highUvi, lowPct, highPct, best, worst, weakest, avgAcc, avgPhys, avgSent };
  }, [tasNitsData, stats]);

  return (
    <main className="h-[100dvh] w-screen flex flex-col bg-[var(--bg-primary)] text-white overflow-hidden">
      {/* Top Navbar */}
      <nav 
        style={{ paddingLeft: '16px', paddingRight: '16px' }}
        className="h-[62px] md:h-[72px] w-full flex items-center justify-between gap-2.5 md:gap-4 bg-[rgba(255,255,255,0.01)] border-b border-[var(--border-subtle)] z-50 shrink-0"
      >
        <div className="flex items-center gap-2.5 md:gap-3 shrink-0">
          {/* Logo */}
          <div className="w-7 h-7 md:w-9 md:h-9 flex items-center justify-center shrink-0">
            <img src="/Logo%20Vista.png" alt="VISTA Logo" className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(0,242,254,0.5)]" />
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="text-lg font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-[#94a3b8] leading-tight">
              VISTA
            </span>
            <span className="text-[9px] text-[var(--text-muted)] tracking-wider -mt-0.5">Urban Vitality Index</span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-xl mx-1 md:mx-6">
          <div className="relative">
            <div className="absolute inset-y-0 flex items-center pointer-events-none left-3.5 md:left-4">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 md:w-[18px] md:h-[18px]">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchSubmit}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              style={{ paddingLeft: '44px', paddingRight: '14px' }}
              className="block w-full h-9 md:h-11 border border-[rgba(255,255,255,0.12)] hover:border-[rgba(255,255,255,0.25)] rounded-full leading-5 bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.09)] text-[var(--text-primary)] placeholder-slate-400 focus:outline-none focus:border-[var(--accent-cyan)] focus:ring-2 focus:ring-[rgba(0,242,254,0.2)] focus:bg-[rgba(20,25,35,0.9)] text-xs md:text-[15px] font-normal transition-all shadow-inner"
              placeholder="Cari jalan, halte, atau TASnit..."
            />

            {/* Autocomplete Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                style={{ padding: "6px" }}
                className="absolute top-full left-0 right-0 mt-2 bg-[rgba(15,20,35,0.98)] backdrop-blur-3xl border border-[rgba(255,255,255,0.14)] rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.7)] z-50 animate-fade-in flex flex-col gap-1"
              >
                {suggestions.map((sug, idx) => (
                  <div
                    key={idx}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectSuggestion(sug);
                    }}
                    style={{ padding: "8px 12px" }}
                    className="cursor-pointer hover:bg-[rgba(0,242,254,0.12)] rounded-xl transition-all duration-200 flex items-center gap-2.5 group"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2.2" className="shrink-0 text-[var(--accent-cyan)] opacity-90 group-hover:opacity-100">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <span className="text-sm text-white font-medium truncate leading-[1.35] group-hover:text-[var(--accent-cyan)] transition-colors">
                      {sug}
                    </span>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>

        {/* MAPID Official Branding */}
        <div className="flex items-center shrink-0">
          <div className="flex items-center gap-1.5 md:gap-2 px-1 md:px-2 py-0.5 md:py-1">
            <span className="hidden sm:inline text-[10px] md:text-[11px] font-medium text-[var(--text-muted)] tracking-wide">Powered by</span>
            <img
              src="/mapid-logo-white.png"
              alt="MAPID"
              className="h-3.5 md:h-[22px] w-auto object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] hover:brightness-110 transition-all"
            />
          </div>
        </div>


      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative main-content-layout">

        {/* Sidebar */}
        <Sidebar
          activeTab={activeSidebarTab}
          onTabChange={setActiveSidebarTab}
        />

        {/* Floating Layer Controls + Color Mode Selector */}
        {/* Floating Layer Controls + Color Mode Selector */}
        {activeSidebarTab === "layers" && (
          <div
            style={{ padding: "22px 20px" }}
            className="absolute bottom-[90px] left-[5%] w-[90%] md:w-[380px] md:bottom-auto md:right-auto md:left-[110px] md:top-5 bg-[rgba(15,20,35,0.95)] backdrop-blur-3xl border border-[rgba(255,255,255,0.12)] rounded-3xl shadow-[0_16px_48px_0_rgba(0,0,0,0.65)] z-40 animate-fade-in flex flex-col gap-6"
          >            {/* 1. Color Mode Selector */}
            <div>
              <div className="mb-5">
                <h3 className="text-xs md:text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider truncate">
                  Warnai Berdasarkan
                </h3>
              </div>
              <div className="grid grid-cols-4 gap-2.5">

                {COLOR_MODES.map((mode) => {
                  const active = colorMode === mode.key;
                  return (
                    <button
                      key={mode.key}
                      type="button"
                      onClick={() => setColorMode(mode.key)}
                      className={`relative flex flex-col items-center justify-center gap-1.5 py-3.5 px-2 min-h-[72px] rounded-2xl text-center transition-all cursor-pointer ${
                        active
                          ? "bg-[rgba(255,255,255,0.14)] border border-[rgba(255,255,255,0.28)] shadow-lg"
                          : "hover:bg-[rgba(255,255,255,0.06)] border border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-center text-white">{mode.icon}</div>
                      <span
                        className={`text-[12px] font-semibold leading-none ${
                          active ? "text-white font-bold" : "text-[var(--text-muted)]"
                        }`}
                      >
                        {mode.label}
                      </span>
                      {active && (
                        <div
                          className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
                          style={{ background: mode.color }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Visual Geometry Mode Selector */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xs md:text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Bentuk Visualisasi
                </h3>
                <span className="text-xs text-[var(--accent-cyan)] font-medium">3 Mode</span>
              </div>
              <div className="grid grid-cols-3 gap-2 bg-[rgba(0,0,0,0.35)] p-1.5 rounded-2xl border border-[rgba(255,255,255,0.08)]">
                {[
                  { key: "point", label: "Titik", desc: "Centroid", icon: <CircleDot size={18} /> },
                  { key: "line", label: "Garis", desc: "Koridor", icon: <Route size={18} /> },
                  { key: "polygon", label: "Blok", desc: "TOD 400m", icon: <Layers size={18} /> },
                ].map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setGeometryMode(m.key as GeometryMode)}
                    className={`flex flex-col items-center justify-center gap-1 py-3 px-2 min-h-[72px] rounded-xl text-center transition-all cursor-pointer ${
                      geometryMode === m.key
                        ? "bg-gradient-to-b from-[rgba(0,242,254,0.3)] to-[rgba(79,172,254,0.15)] border border-[rgba(0,242,254,0.5)] text-white shadow-md"
                        : "hover:bg-[rgba(255,255,255,0.06)] text-[var(--text-muted)] border border-transparent"
                    }`}
                  >
                    <div className={geometryMode === m.key ? "text-[var(--accent-cyan)] flex items-center justify-center" : "text-slate-400 flex items-center justify-center"}>
                      {m.icon}
                    </div>
                    <span className="text-[13px] font-bold leading-tight">{m.label}</span>
                    <span className="text-[10px] text-[var(--text-muted)] leading-tight">{m.desc}</span>
                  </button>
                ))}
              </div>

            </div>

            {/* 3. Map Layers */}
            <div>
              <h3 className="text-xs md:text-sm font-bold text-[var(--text-secondary)] mb-5 uppercase tracking-wider">
                Layer Peta
              </h3>
              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-transparent hover:bg-[rgba(255,255,255,0.04)] transition-colors cursor-pointer group">
                  <span className="text-sm font-medium text-white group-hover:text-[var(--accent-cyan)] transition-colors">
                    TAS-Nits (Vitalitas)
                  </span>
                  <input
                    type="checkbox"
                    checked={showTasNits}
                    onChange={() => setShowTasNits(!showTasNits)}
                    className="accent-[var(--accent-cyan)] w-4.5 h-4.5 cursor-pointer rounded"
                  />
                </label>

                <label className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-transparent hover:bg-[rgba(255,255,255,0.04)] transition-colors cursor-pointer group">
                  <span className="text-sm font-medium text-white group-hover:text-emerald-400 transition-colors">
                    Halte Angkot / Bus ({stats?.totalBusStops?.toLocaleString() || "..."})
                  </span>
                  <input
                    type="checkbox"
                    checked={showBusStops}
                    onChange={() => setShowBusStops(!showBusStops)}
                    className="accent-emerald-500 w-4.5 h-4.5 cursor-pointer rounded"
                  />
                </label>

                <label className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-transparent hover:bg-[rgba(255,255,255,0.04)] transition-colors cursor-pointer group">
                  <span className="text-sm font-medium text-white group-hover:text-amber-400 transition-colors">
                    Fasilitas Publik ({stats?.totalPOIs?.toLocaleString() || "..."})
                  </span>
                  <input
                    type="checkbox"
                    checked={showPOIs}
                    onChange={() => setShowPOIs(!showPOIs)}
                    className="accent-amber-500 w-4.5 h-4.5 cursor-pointer rounded"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Center Map (PRIMARY ZONE — coaching: 60-70% of dashboard) */}
        <div className="flex-1 md:rounded-3xl overflow-hidden relative md:border md:border-[var(--border-subtle)] md:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] z-0">
          <MapComponent
            showTasNits={showTasNits}
            showBusStops={showBusStops}
            showPOIs={showPOIs}
            colorMode={colorMode}
            geometryMode={geometryMode}
            onFeatureClick={handleFeatureClick}
            onStatsUpdate={handleStatsUpdate}
            searchQuery={activeSearch}
            tasNitsData={tasNitsData}
            tasNitsLinesData={tasNitsLinesData}
            tasNitsPolygonsData={tasNitsPolygonsData}
            busStopsData={busStopsData}
            poisData={poisData}
            selectedFeature={selectedFeature}
          />
        </div>

        {/* Right Panel — Analytics (SUPPORTING ZONE) */}
        {activeSidebarTab === "analytics" && (
          <div className="absolute left-[5%] right-[5%] bottom-[90px] max-h-[75vh] md:max-h-none md:static md:w-[350px] md:h-full z-40 bg-[rgba(15,20,35,0.95)] md:bg-transparent backdrop-blur-3xl md:backdrop-blur-none border md:border-0 border-[var(--border-subtle)] rounded-3xl shadow-2xl md:shadow-none animate-fade-in shrink-0 panel-popup flex flex-col">
            {/* Mobile Close Button */}
            <div className="md:hidden flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">Analytics</h3>
              <button onClick={() => setActiveSidebarTab("")} className="text-[var(--text-secondary)] hover:text-white">✕</button>
            </div>
            <StatsPanel
              stats={stats}
              selectedFeature={selectedFeature}
              onCloseDetail={() => setSelectedFeature(null)}
              colorMode={colorMode}
            />
          </div>
        )}

        {/* AI Spatial Insight (Context-Aware Prompting — Groq GPT-OSS 120B) */}
        {activeSidebarTab === "insight" && (
          <div
            style={{ padding: "20px" }}
            className="absolute left-[5%] right-[5%] bottom-[90px] max-h-[75vh] md:max-h-none md:static md:w-[350px] md:h-full bg-[rgba(15,20,35,0.95)] md:bg-[rgba(255,255,255,0.03)] backdrop-blur-3xl md:backdrop-blur-2xl border border-[rgba(255,255,255,0.1)] rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] animate-fade-in flex flex-col z-40 shrink-0 panel-popup"
          >
            {/* Header */}
            <div
              style={{ marginBottom: "18px", paddingBottom: "14px" }}
              className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] shrink-0"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-500 flex items-center justify-center shadow-lg shrink-0">
                  <Sparkles size={19} className="text-white" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-base font-bold text-white leading-tight">AI Spatial Insight</h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] leading-tight">
                    <BrainCircuit size={12} className="text-purple-400" />
                    <span>Reasoning Spasial & CCIA</span>
                  </div>
                </div>
              </div>
              {/* Mobile Close Button */}
              <button onClick={() => setActiveSidebarTab("")} className="md:hidden text-[var(--text-secondary)] hover:text-white p-1">✕</button>
            </div>

            {/* Dynamic AI Insight Panel */}
            <AiInsightPanel selectedFeature={selectedFeature} />
          </div>
        )}



        {/* Team Profile */}
        {activeSidebarTab === "team" && (
          <div
            style={{ padding: "20px" }}
            className="absolute left-[5%] right-[5%] bottom-[90px] max-h-[70vh] md:max-h-none md:static md:w-[340px] md:h-full bg-[rgba(15,20,35,0.95)] md:bg-[rgba(255,255,255,0.03)] backdrop-blur-3xl md:backdrop-blur-2xl border border-[rgba(255,255,255,0.1)] rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] animate-fade-in flex flex-col z-40 shrink-0 panel-popup"
          >
            {/* Mobile Close Button */}
            <div className="md:hidden absolute top-4 right-4">
              <button onClick={() => setActiveSidebarTab("")} className="text-[var(--text-secondary)] hover:text-white">✕</button>
            </div>

            {/* Header */}
            <div
              style={{ marginBottom: "20px", paddingBottom: "16px" }}
              className="flex items-center gap-3.5 border-b border-[rgba(255,255,255,0.08)] shrink-0"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shrink-0">
                <Users size={20} className="text-white" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-bold text-white leading-tight">Team VISTA</h3>
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] leading-tight">
                  <GraduationCap size={13} />
                  <span>Kolaborasi ITB & Universitas Siliwangi</span>
                </div>
              </div>
            </div>

            {/* Content Scrollable Container */}
            <div className="flex-1 overflow-y-auto hidden-scrollbar flex flex-col justify-between pr-1 pt-1">
              <div>
                <div
                  style={{ marginBottom: "18px" }}
                  className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest px-1 flex items-center gap-2"
                >
                  <span>Anggota Tim</span>
                  <div className="flex-1 h-[1px] bg-[rgba(255,255,255,0.08)]" />
                </div>
                
                <div className="flex flex-col gap-3.5 pb-2">

                  {[
                    { name: "Audy Amariztha Rapsolly", role: "Perencanaan Wilayah & Kota • ITB", image: "audy.png" },
                    { name: "M. Farrell Nauvaldy", role: "Perencanaan Wilayah & Kota • ITB", image: "farel.png" },
                    { name: "Latief Naufal Andryanto", role: "Informatika • Universitas Siliwangi", image: "latief.png" },
                    { name: "Azmi Nur Shidiq Ridwan", role: "Informatika • Universitas Siliwangi", image: "azmi.png" },
                    { name: "Zaky Zahran Pramadita", role: "Informatika • Universitas Siliwangi", image: "zakyzp.png" }
                  ].map((member, idx) => (

                    <div
                      key={idx}
                      style={{ padding: "14px 16px" }}
                      className="flex flex-col items-center rounded-[22px] bg-gradient-to-b from-[rgba(255,255,255,0.03)] to-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.06)] hover:from-[rgba(255,255,255,0.06)] hover:to-[rgba(255,255,255,0.02)] hover:border-[rgba(0,242,254,0.3)] transition-all duration-300 group shadow-md text-center"
                    >
                      <div className="w-16 h-16 rounded-full bg-[rgba(255,255,255,0.08)] flex items-center justify-center shrink-0 overflow-hidden border-2 border-[rgba(255,255,255,0.1)] group-hover:border-[var(--accent-cyan)] group-hover:shadow-[0_0_15px_rgba(0,242,254,0.3)] transition-all duration-300 shadow-inner mb-2.5">
                        <img src={`/${member.image}?v=3`} alt={member.name} className="w-full h-full object-cover object-center" />
                      </div>

                      <div className="w-full flex flex-col items-center justify-center text-center">
                        <p className="text-[14.5px] font-bold text-white mb-1 leading-tight group-hover:text-[var(--accent-cyan)] transition-colors duration-300 text-center w-full">{member.name}</p>
                        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed text-center w-full px-2">{member.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mt-4 pt-3.5 pb-1 border-t border-[rgba(255,255,255,0.08)] text-center">
                <p className="text-[10px] text-[var(--text-muted)] italic leading-normal">
                  "Menghubungkan ruang, merangkai vitalitas."
                </p>
              </div>
            </div>
          </div>
        )}


        {/* Methodology Info Panel */}
        {activeSidebarTab === "info" && (
          <div
            style={{ padding: "22px 20px" }}
            className="absolute left-[5%] right-[5%] bottom-[90px] max-h-[70vh] md:max-h-none md:static md:w-[360px] md:h-full bg-[rgba(15,20,35,0.95)] md:bg-[rgba(255,255,255,0.03)] backdrop-blur-3xl md:backdrop-blur-2xl border border-[rgba(234,179,8,0.3)] rounded-3xl shadow-[0_8px_32px_0_rgba(234,179,8,0.15)] animate-fade-in flex flex-col z-40 shrink-0 panel-popup"
          >
            {/* Mobile Close Button */}
            <div className="md:hidden absolute top-4 right-4">
              <button onClick={() => setActiveSidebarTab("")} className="text-[var(--text-secondary)] hover:text-white">✕</button>
            </div>

            {/* Header */}
            <div
              style={{ marginBottom: "24px", paddingBottom: "18px" }}
              className="flex items-center gap-3.5 border-b border-[rgba(255,255,255,0.1)] shrink-0"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-500 to-amber-400 flex items-center justify-center shadow-lg shrink-0">
                <Info size={20} className="text-white" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-bold text-white leading-none">Metodologi VISTA</h3>
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] leading-none">
                  <Database size={13} />
                  <span>Data Spasial & AI Generative</span>
                </div>
              </div>
            </div>

            {/* Content Scrollable Container */}
            <div
              style={{ paddingTop: "6px" }}
              className="flex-1 overflow-y-auto hidden-scrollbar flex flex-col gap-[24px] pr-1"
            >
              
              {/* 1. What is VISTA */}
              <div>
                <div
                  style={{ marginBottom: "12px" }}
                  className="flex items-center gap-2 text-[11px] font-bold text-yellow-400 uppercase tracking-wider leading-none"
                >
                  <Info size={14} /> Apa itu VISTA?
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-[1.65] font-normal">
                  VISTA (Urban Vitality Index for TOD) adalah platform analitik yang mengukur seberapa "hidup" dan nyaman lingkungan di sekitar rute transportasi umum, menggunakan pendekatan AI dan Big Data spasial.
                </p>
              </div>

              {/* 1b. What is TAS-Nit */}
              <div
                style={{ padding: "14px 14px 12px 14px" }}
                className="bg-[rgba(6,182,212,0.05)] rounded-2xl border border-[rgba(6,182,212,0.2)] shadow-inner"
              >
                <div
                  style={{ marginBottom: "8px" }}
                  className="flex items-center gap-2 text-cyan-400 font-bold text-xs"
                >
                  <Route size={14} /> Unit Analisis: TAS-Nit (Transit-Access Segment)
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-[1.65] font-normal">
                  <strong className="text-white font-semibold">TAS-Nit</strong> adalah unit analisis mikro-spasial dalam VISTA yang dibentuk dengan membagi ruas jaringan jalan berdasarkan kedekatannya dengan halte bus. Seluruh koridor Bandung dipetakan ke dalam <strong className="text-cyan-300 font-semibold">5.876 unit TAS-Nit</strong> unik (misal: <em>TASnit 0001</em> hingga <em>TASnit 5876</em>) sebagai unit evaluasi UVI mandiri.
                </p>
              </div>

              {/* 2. Three Pillars Calculation */}
              <div>
                <div
                  style={{ marginBottom: "18px" }}
                  className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest px-1 flex items-center gap-2"
                >
                  <span>3 Pilar Perhitungan UVI</span>
                  <div className="flex-1 h-[1px] bg-[rgba(255,255,255,0.08)]" />
                </div>

                <div className="flex flex-col gap-3.5">

                  {/* Pillar 1 */}
                  <div
                    style={{ padding: "14px 14px 12px 14px" }}
                    className="bg-[rgba(34,197,94,0.05)] rounded-2xl border border-[rgba(34,197,94,0.18)] shadow-inner"
                  >
                    <div
                      style={{ marginBottom: "8px" }}
                      className="flex items-center gap-2 text-emerald-400 font-bold text-xs"
                    >
                      <Building2 size={14} /> 1. Lingkungan Fisik (AI)
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-[1.65] font-normal">
                      Kami menggunakan AI <strong className="text-white font-semibold">SegFormer (Computer Vision)</strong> untuk menganalisis 17.000+ gambar Google Street View. AI mengukur proporsi penghijauan (kanopi pohon), keterbukaan langit, keberadaan trotoar, dan lebar jalan.
                    </p>
                  </div>

                  {/* Pillar 2 */}
                  <div
                    style={{ padding: "14px 14px 12px 14px" }}
                    className="bg-[rgba(59,130,246,0.05)] rounded-2xl border border-[rgba(59,130,246,0.18)] shadow-inner"
                  >
                    <div
                      style={{ marginBottom: "8px" }}
                      className="flex items-center gap-2 text-blue-400 font-bold text-xs"
                    >
                      <Activity size={14} /> 2. Aktivitas & Fungsi Perkotaan
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-[1.65] font-normal">
                      Mengukur keragaman dan ketersediaan fasilitas publik (pendidikan, kesehatan, ritel, kuliner) dalam radius jalan kaki 400 meter dari simpul transit menggunakan <strong className="text-white font-semibold">Algoritma KD-Tree Spasial</strong>.
                    </p>
                  </div>

                  {/* Pillar 3 */}
                  <div
                    style={{ padding: "14px 14px 12px 14px" }}
                    className="bg-[rgba(245,158,11,0.05)] rounded-2xl border border-[rgba(245,158,11,0.18)] shadow-inner"
                  >
                    <div
                      style={{ marginBottom: "8px" }}
                      className="flex items-center gap-2 text-amber-400 font-bold text-xs"
                    >
                      <MessageSquare size={14} /> 3. Sentimen Warga
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-[1.65] font-normal">
                      Menganalisis 9.700+ teks ulasan (review) dari Google Places menggunakan algoritma <strong className="text-white font-semibold">NLP Lexicon</strong> untuk memahami persepsi warga terhadap fasilitas di sekitar kawasan TOD.
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Data Sources & Algorithms */}
              <div>
                <div
                  style={{ marginBottom: "10px" }}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-white uppercase tracking-wider"
                >
                  <Database size={14} className="text-yellow-400" /> Sumber Data & Algoritma
                </div>
                <ul className="text-xs text-[var(--text-secondary)] space-y-2 pl-4 list-disc leading-relaxed">
                  <li><strong className="text-white font-medium">MAPID:</strong> Peta Dasar (Basemap) Interaktif</li>
                  <li><strong className="text-white font-medium">TAS-Nits Spasial:</strong> Segmentasi 5.876 koridor rute halte via KD-Tree</li>
                  <li><strong className="text-white font-medium">Google Street View & SegFormer:</strong> Visual jalanan (AI)</li>
                  <li><strong className="text-white font-medium">Google Places API & NLP Lexicon:</strong> Analisis persepsi warga</li>
                  <li><strong className="text-white font-medium">OSM & KD-Tree:</strong> Kepadatan POI dan jaringan jalan</li>
                </ul>
              </div>

            </div>
          </div>
        )}

      </div>
    </main>
  );
}
