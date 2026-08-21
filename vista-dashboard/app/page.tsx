"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import StatsPanel from "@/components/StatsPanel";
import Image from "next/image";

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
  walkingClasses: Record<string, number>;
}

export default function Home() {
  const [showTasNits, setShowTasNits] = useState(true);
  const [showBusStops, setShowBusStops] = useState(false);
  const [showPOIs, setShowPOIs] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<Record<string, unknown> | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState("analytics");
  
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
      
      setSuggestions(newSuggestions.slice(0, 5)); // show up to 5 suggestions
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
          <span className="text-xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-[#94a3b8] hidden sm:block">
            VISTA
          </span>
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
                      e.preventDefault(); // Mencegah input kehilangan fokus sebelum klik diproses
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

        {/* Avatar */}
        <div className="flex items-center shrink-0">
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
        
        {/* Sidebar (Liquid Glass) - Positioned bottom on mobile, left on desktop via flex order in its own component */}
        <Sidebar
          activeTab={activeSidebarTab}
          onTabChange={setActiveSidebarTab}
        />

        {/* Floating Layer Controls (Appears when activeTab === "layers") */}
        {activeSidebarTab === "layers" && (
          <div className="absolute bottom-[90px] left-4 right-4 md:bottom-auto md:right-auto md:left-[110px] md:top-5 md:w-[260px] bg-[rgba(15,20,35,0.85)] backdrop-blur-2xl border border-[var(--border-subtle)] rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] z-40 animate-fade-in" style={{ padding: '24px' }}>
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4 uppercase tracking-wider">Layer Peta</h3>
            
            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm text-white group-hover:text-[var(--accent-cyan)] transition-colors">TAS-Nits (Skor Aksesibilitas)</span>
                <input type="checkbox" checked={showTasNits} onChange={() => setShowTasNits(!showTasNits)} className="accent-[var(--accent-cyan)] w-5 h-5 md:w-4 md:h-4" />
              </label>
              
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm text-white group-hover:text-blue-400 transition-colors">Halte Bus (844)</span>
                <input type="checkbox" checked={showBusStops} onChange={() => setShowBusStops(!showBusStops)} className="accent-blue-500 w-5 h-5 md:w-4 md:h-4" />
              </label>
              
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm text-white group-hover:text-amber-400 transition-colors">Fasilitas Publik (3.602)</span>
                <input type="checkbox" checked={showPOIs} onChange={() => setShowPOIs(!showPOIs)} className="accent-amber-500 w-5 h-5 md:w-4 md:h-4" />
              </label>
            </div>
          </div>
        )}

        {/* Center Map */}
        <div className="flex-1 md:rounded-3xl overflow-hidden relative md:border md:border-[var(--border-subtle)] md:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] z-0">
          <MapComponent
            showTasNits={showTasNits}
            showBusStops={showBusStops}
            showPOIs={showPOIs}
            onFeatureClick={handleFeatureClick}
            onStatsUpdate={handleStatsUpdate}
            searchQuery={activeSearch}
            tasNitsData={tasNitsData}
            busStopsData={busStopsData}
            poisData={poisData}
          />

          {/* Floating Status Bar - Hidden on small mobile to save space */}
          <div className="hidden sm:block absolute bottom-5 left-6 text-sm text-[var(--text-secondary)] bg-[rgba(15,20,35,0.7)] backdrop-blur-md px-4 py-2 rounded-xl border border-[var(--border-subtle)] pointer-events-none">
            <span className="font-mono-data text-white">{stats?.totalTasNits?.toLocaleString() || "..."}</span> TAS-Nits <span className="mx-2 text-[var(--text-muted)]">|</span>
            <span className="font-mono-data text-white">{stats?.totalBusStops?.toLocaleString() || "..."}</span> Bus Stops <span className="mx-2 text-[var(--text-muted)]">|</span>
            <span className="font-mono-data text-white">{stats?.totalPOIs?.toLocaleString() || "..."}</span> POIs
          </div>
        </div>

        {/* Right Panel Conditional Rendering */}
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
            />
          </div>
        )}

        {activeSidebarTab === "insight" && (
          <div className="absolute inset-x-2 bottom-[90px] top-[10%] md:static md:inset-auto md:w-[340px] md:h-full bg-[rgba(15,20,35,0.9)] md:bg-[rgba(255,255,255,0.03)] backdrop-blur-3xl md:backdrop-blur-2xl border border-[rgba(168,85,247,0.2)] rounded-3xl shadow-2xl animate-fade-in flex flex-col z-40 shrink-0 panel-popup">
            {/* Mobile Close Button */}
            <div className="md:hidden absolute top-4 right-4">
              <button onClick={() => setActiveSidebarTab("")} className="text-[var(--text-secondary)] hover:text-white">✕</button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2">
                <path d="M12 2l3 6 6 3-6 3-3 6-3-6-6-3 6-3z"/>
              </svg>
              <h3 className="text-sm font-semibold text-purple-300">AI Spatial Insight</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto hidden-scrollbar text-sm text-[var(--text-secondary)] leading-relaxed space-y-4">
              <p>
                Berdasarkan hasil pemrosesan <strong className="text-white">Google Gemini (LLM)</strong> terhadap 5.876 TAS-Nits di Kota Bandung, ditemukan bahwa:
              </p>
              <div className="bg-[rgba(168,85,247,0.1)] p-3 rounded-xl border border-[rgba(168,85,247,0.2)]">
                <span className="text-purple-300 font-semibold block mb-1">Koridor Soekarno-Hatta (Timur)</span>
                Memiliki nilai <span className="text-white">Urban Vitality Index terendah (0.32)</span> karena minimnya fasilitas pejalan kaki (Sidewalk Ratio &lt; 10%) dan kepadatan halte yang sangat jarang (jarak rata-rata &gt; 800m).
              </div>
              <div className="bg-[rgba(14,165,233,0.1)] p-3 rounded-xl border border-[rgba(14,165,233,0.2)]">
                <span className="text-blue-300 font-semibold block mb-1">Koridor Dago - Dipatiukur</span>
                Menunjukkan vitalitas tertinggi dengan <span className="text-white">UVI 0.89</span>. Hal ini didorong oleh persepsi sentimen positif masyarakat (NLP) terhadap kenyamanan berjalan kaki serta tingginya konsentrasi POI Pendidikan dan Katering.
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-auto pt-4 border-t border-[var(--border-subtle)]">
                Insight ini digenerate secara otomatis menggunakan model LLM berdasarkan agregasi data spasial dan sentimen warga.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
