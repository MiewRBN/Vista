"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useEffect, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import StatsPanel from "@/components/StatsPanel";
import type { ColorMode } from "@/components/Map";

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
  geometry: { type: "Point"; coordinates: [number, number] };
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

const COLOR_MODES: { key: ColorMode; label: string; icon: string; color: string }[] = [
  { key: "uvi", label: "UVI", icon: "🎯", color: "#00f2fe" },
  { key: "accessibility", label: "Akses", icon: "♿", color: "#4facfe" },
  { key: "physical", label: "Fisik", icon: "🏙️", color: "#22c55e" },
  { key: "sentiment", label: "Sentimen", icon: "💬", color: "#f59e0b" },
];

export default function Home() {
  const [showTasNits, setShowTasNits] = useState(true);
  const [showBusStops, setShowBusStops] = useState(false);
  const [showPOIs, setShowPOIs] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<Record<string, unknown> | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState("analytics");
  const [colorMode, setColorMode] = useState<ColorMode>("uvi");

  const [tasNitsData, setTasNitsData] = useState<GeoJSONData | null>(null);
  const [busStopsData, setBusStopsData] = useState<GeoJSONData | null>(null);
  const [poisData, setPoisData] = useState<GeoJSONData | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetch("/api/tas-nits"),
      fetch("/api/bus-stops"),
      fetch("/api/pois"),
    ])
      .then(async ([tasNitsRes, busStopsRes, poisRes]) => {
        if (!isMounted) return;
        const tasNits: GeoJSONData = await tasNitsRes.json();
        const busStops: GeoJSONData = await busStopsRes.json();
        const pois: GeoJSONData = await poisRes.json();

        if (isMounted) {
          setTasNitsData(tasNits);
          setBusStopsData(busStops);
          setPoisData(pois);
        }
      })
      .catch((err) => console.error("Error loading data:", err));

    return () => {
      isMounted = false;
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
      const query = val.toLowerCase();
      const newSuggestions: string[] = [];

      if (busStopsData) {
        busStopsData.features.forEach(f => {
          const name = String(f.properties.name);
          if (name.toLowerCase().includes(query) && !newSuggestions.includes(name)) {
            newSuggestions.push(name);
          }
        });
      }

      if (tasNitsData) {
        tasNitsData.features.forEach(f => {
          const name = String(f.properties.street_name);
          if (name.toLowerCase().includes(query) && !newSuggestions.includes(name)) {
            newSuggestions.push(name);
          }
        });
      }

      setSuggestions(newSuggestions.slice(0, 5));
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
    setSearchQuery(val);
    setActiveSearch(val);
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
    const weakest = avgPhys < avgAcc && avgPhys < avgSent ? "Lingkungan Fisik" : avgSent < avgAcc ? "Sentimen Warga" : "Aksesibilitas";

    return { total, lowUvi, highUvi, lowPct, highPct, best, worst, weakest, avgAcc, avgPhys, avgSent };
  }, [tasNitsData, stats]);

  return (
    <main className="h-[100dvh] w-screen flex flex-col bg-[var(--bg-primary)] text-white overflow-hidden">
      {/* Top Navbar */}
      <nav className="h-[72px] w-full flex items-center justify-between gap-3 bg-[rgba(255,255,255,0.01)] border-b border-[var(--border-subtle)] z-50 shrink-0" style={{ paddingLeft: '24px', paddingRight: '24px' }}>
        <div className="flex items-center gap-3 shrink-0">
          {/* Logo */}
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-br from-[#00f2fe] to-[#4facfe] shadow-[0_0_15px_rgba(0,242,254,0.3)] shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4l8 16 8-16" />
            </svg>
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="text-lg font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-[#94a3b8] leading-tight">
              VISTA
            </span>
            <span className="text-[9px] text-[var(--text-muted)] tracking-wider -mt-0.5">Urban Vitality Index</span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <div className="absolute inset-y-0 flex items-center pointer-events-none" style={{ left: '12px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              style={{ paddingLeft: '40px' }}
              className="block w-full pr-4 py-2 border border-[var(--border-subtle)] rounded-full leading-5 bg-[rgba(255,255,255,0.05)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-cyan)] focus:ring-1 focus:ring-[var(--accent-cyan)] text-sm transition-all"
              placeholder="Cari jalan atau halte..."
            />

            {/* Autocomplete Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[rgba(20,25,35,0.95)] backdrop-blur-3xl border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in">
                {suggestions.map((sug, idx) => (
                  <div
                    key={idx}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectSuggestion(sug);
                    }}
                    className="px-4 py-3 cursor-pointer hover:bg-[rgba(255,255,255,0.05)] border-b border-[var(--border-subtle)] last:border-b-0 transition-colors"
                  >
                    <span className="text-sm text-white">{sug}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MAPID Branding */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-1.5 bg-[rgba(255,255,255,0.05)] px-3 py-1.5 rounded-full border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--text-muted)]">Powered by</span>
            <span className="text-xs font-bold text-white">MAPID</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-[2px]">
            <div className="w-full h-full rounded-full bg-[var(--bg-primary)] flex items-center justify-center overflow-hidden">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
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
        {activeSidebarTab === "layers" && (
          <div className="absolute bottom-[90px] left-4 right-4 md:bottom-auto md:right-auto md:left-[110px] md:top-5 md:w-[280px] bg-[rgba(15,20,35,0.85)] backdrop-blur-2xl border border-[var(--border-subtle)] rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] z-40 animate-fade-in" style={{ padding: '24px' }}>

            {/* Color Mode Selector (coaching: let user explore different dimensions) */}
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">Warnai Berdasarkan</h3>
            <div className="grid grid-cols-4 gap-1.5 mb-5">
              {COLOR_MODES.map(mode => (
                <button
                  key={mode.key}
                  onClick={() => setColorMode(mode.key)}
                  className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-center transition-all ${colorMode === mode.key
                    ? "bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] shadow-lg"
                    : "hover:bg-[rgba(255,255,255,0.05)] border border-transparent"
                    }`}
                >
                  <span className="text-base">{mode.icon}</span>
                  <span className={`text-[10px] font-medium ${colorMode === mode.key ? "text-white" : "text-[var(--text-muted)]"}`}>{mode.label}</span>
                  {colorMode === mode.key && (
                    <div className="w-4 h-0.5 rounded-full" style={{ background: mode.color }} />
                  )}
                </button>
              ))}
            </div>

            <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">Layer Peta</h3>
            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm text-white group-hover:text-[var(--accent-cyan)] transition-colors">TAS-Nits (Segmen Jalan)</span>
                <input type="checkbox" checked={showTasNits} onChange={() => setShowTasNits(!showTasNits)} className="accent-[var(--accent-cyan)] w-5 h-5 md:w-4 md:h-4" />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm text-white group-hover:text-blue-400 transition-colors">Halte Bus ({stats?.totalBusStops?.toLocaleString() || "..."})</span>
                <input type="checkbox" checked={showBusStops} onChange={() => setShowBusStops(!showBusStops)} className="accent-blue-500 w-5 h-5 md:w-4 md:h-4" />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm text-white group-hover:text-amber-400 transition-colors">Fasilitas Publik ({stats?.totalPOIs?.toLocaleString() || "..."})</span>
                <input type="checkbox" checked={showPOIs} onChange={() => setShowPOIs(!showPOIs)} className="accent-amber-500 w-5 h-5 md:w-4 md:h-4" />
              </label>
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
            onFeatureClick={handleFeatureClick}
            onStatsUpdate={handleStatsUpdate}
            searchQuery={activeSearch}
            tasNitsData={tasNitsData}
            busStopsData={busStopsData}
            poisData={poisData}
          />
        </div>

        {/* Right Panel — Analytics (SUPPORTING ZONE) */}
        {activeSidebarTab === "analytics" && (
          <div className="absolute inset-x-2 bottom-[90px] top-[10%] md:static md:inset-auto md:w-[340px] md:h-full z-40 bg-[rgba(15,20,35,0.85)] md:bg-transparent backdrop-blur-3xl md:backdrop-blur-none border md:border-0 border-[var(--border-subtle)] rounded-3xl shadow-2xl md:shadow-none animate-fade-in overflow-hidden shrink-0 panel-popup">
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

        {/* AI Spatial Insight (CCIA Storytelling — dynamic from data) */}
        {activeSidebarTab === "insight" && (
          <div className="absolute inset-x-2 bottom-[90px] top-[10%] md:static md:inset-auto md:w-[340px] md:h-full bg-[rgba(15,20,35,0.9)] md:bg-[rgba(255,255,255,0.03)] backdrop-blur-3xl md:backdrop-blur-2xl border border-[rgba(168,85,247,0.2)] rounded-3xl shadow-2xl animate-fade-in flex flex-col z-40 shrink-0 panel-popup">
            {/* Mobile Close Button */}
            <div className="md:hidden absolute top-4 right-4">
              <button onClick={() => setActiveSidebarTab("")} className="text-[var(--text-secondary)] hover:text-white">✕</button>
            </div>

            <div className="flex items-center gap-2 mb-5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2">
                <path d="M12 2l3 6 6 3-6 3-3 6-3-6-6-3 6-3z"/>
              </svg>
              <h3 className="text-sm font-semibold text-purple-300">AI Spatial Insight</h3>
            </div>

            <div className="flex-1 overflow-y-auto hidden-scrollbar text-sm text-[var(--text-secondary)] leading-relaxed space-y-4">
              {aiInsight ? (
                <>
                  {/* CONDITION */}
                  <div>
                    <div className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1.5">📊 Kondisi</div>
                    <p>
                      Dari <strong className="text-white">{aiInsight.total.toLocaleString()}</strong> segmen jalan (TAS-Nits) yang dianalisis,{" "}
                      <strong className="text-red-400">{aiInsight.lowPct}%</strong> memiliki Urban Vitality Index di bawah 0.3 (rendah), sementara{" "}
                      <strong className="text-emerald-400">{aiInsight.highPct}%</strong> memiliki UVI di atas 0.7 (tinggi).
                    </p>
                  </div>

                  {/* CAUSE */}
                  <div>
                    <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1.5">🔍 Penyebab</div>
                    <p>
                      Pilar terlemah secara rata-rata adalah <strong className="text-white">{aiInsight.weakest}</strong>.
                      Rata-rata skor: Aksesibilitas <strong className="text-blue-300">{aiInsight.avgAcc.toFixed(3)}</strong>,
                      Fisik <strong className="text-green-300">{aiInsight.avgPhys.toFixed(3)}</strong>,
                      Sentimen <strong className="text-amber-300">{aiInsight.avgSent.toFixed(3)}</strong>.
                    </p>
                  </div>

                  {/* TOP & BOTTOM */}
                  <div className="bg-[rgba(34,197,94,0.08)] p-3 rounded-xl border border-[rgba(34,197,94,0.2)]">
                    <span className="text-emerald-400 font-semibold text-xs block mb-2">🏆 Koridor Terbaik</span>
                    {aiInsight.best.map((f, i) => (
                      <div key={i} className="flex justify-between text-xs mb-1">
                        <span className="text-[var(--text-secondary)] truncate mr-2">{String(f.properties.street_name).substring(0, 25)}</span>
                        <span className="text-emerald-300 font-bold shrink-0">{Number(f.properties.uvi_score).toFixed(3)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-[rgba(239,68,68,0.08)] p-3 rounded-xl border border-[rgba(239,68,68,0.2)]">
                    <span className="text-red-400 font-semibold text-xs block mb-2">⚠️ Koridor Terendah</span>
                    {aiInsight.worst.map((f, i) => (
                      <div key={i} className="flex justify-between text-xs mb-1">
                        <span className="text-[var(--text-secondary)] truncate mr-2">{String(f.properties.street_name).substring(0, 25)}</span>
                        <span className="text-red-300 font-bold shrink-0">{Number(f.properties.uvi_score).toFixed(3)}</span>
                      </div>
                    ))}
                  </div>

                  {/* ACTION */}
                  <div>
                    <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1.5">💡 Rekomendasi</div>
                    <p>
                      Perbaikan prioritas pada koridor dengan UVI rendah: tingkatkan <strong className="text-white">{aiInsight.weakest}</strong> melalui intervensi terarah.
                      Pola spasial menunjukkan kawasan pinggiran kota perlu perhatian lebih dibanding pusat kota.
                    </p>
                  </div>

                  <p className="text-[10px] text-[var(--text-muted)] mt-auto pt-4 border-t border-[var(--border-subtle)]">
                    Insight dihitung secara otomatis dari {aiInsight.total.toLocaleString()} TAS-Nits. Untuk insight berbasis LLM (Gemini), diperlukan API key.
                  </p>
                </>
              ) : (
                <p className="text-[var(--text-muted)]">Memuat data untuk insight...</p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
