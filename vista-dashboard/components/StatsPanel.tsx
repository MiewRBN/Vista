"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { 
  Target, Building2, MessageSquare, 
  Trees, Cloud, Footprints, Map, Image as ImageIcon, 
  GraduationCap, Activity, HeartPulse, ShoppingBag, Utensils, 
  Landmark, Trophy, Star
} from "lucide-react";
import type { ColorMode } from "./Map";
import { formatStreetName, formatTasNitCode } from "@/app/page";

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

interface StatsPanelProps {
  stats: StatsData | null;
  selectedFeature: any;
  onCloseDetail: () => void;
  colorMode: ColorMode;
}

const COLOR_MAP: Record<ColorMode, string> = {
  uvi: "#00f2fe",
  accessibility: "#4facfe",
  physical: "#22c55e",
  sentiment: "#f59e0b",
};

const LABEL_MAP: Record<ColorMode, string> = {
  uvi: "Urban Vitality Index",
  accessibility: "Aktivitas & Fungsi Perkotaan",
  physical: "Lingkungan Fisik",
  sentiment: "Sentimen Warga",
};

function getActiveScore(stats: StatsData | null, mode: ColorMode): number {
  if (!stats) return 0;
  switch (mode) {
    case "uvi": return stats.avgUvi;
    case "accessibility": return stats.avgAccessibility;
    case "physical": return stats.avgPhysical;
    case "sentiment": return stats.avgSentiment;
  }
}

// Mini progress bar component
function MiniBar({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3.5 w-full">
      <div className="shrink-0 opacity-85" style={{ color }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-2.5">
          <span className="text-xs font-medium text-[var(--text-secondary)] truncate">{label}</span>
          <span className="text-xs md:text-sm font-bold font-mono text-white ml-2">{value.toFixed(3)}</span>
        </div>
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(value * 100, 100)}%`, background: color }}
          />
        </div>
      </div>
    </div>
  );
}

export default function StatsPanel({ stats, selectedFeature, onCloseDetail, colorMode }: StatsPanelProps) {
  const activeScore = getActiveScore(stats, colorMode);
  const accentColor = COLOR_MAP[colorMode];

  // Build histogram data from real score distribution
  const histogramData = (stats?.scoreDistribution || new Array(10).fill(0)).map((count, i) => ({
    range: `${(i / 10).toFixed(1)}`,
    count,
  }));

  // If a feature is selected, show detail view (Linked Views principle)
  if (selectedFeature) {
    const sf = selectedFeature;
    const nReviews = Number(sf.n_reviews || 0);
    const nPlaces = Number(sf.n_places || 0);
    const hasReviews = nReviews > 0;
    const avgRating = Number(sf.avg_rating || 0);
    const posPct = hasReviews ? Math.round((Number(sf.positive_ratio) || 0) * 100) : 0;
    const negPct = hasReviews ? (100 - posPct) : 0;

    return (
      <aside className="w-full h-full flex flex-col gap-3.5 overflow-y-auto hidden-scrollbar pb-8">
        
        {/* ── CARD 1: LOCATION & UVI SCORE ── */}
        <div style={{ padding: "18px 16px", boxSizing: "border-box" }} className="dashboard-card bg-[rgba(20,25,35,0.85)] backdrop-blur-2xl border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] shrink-0 flex flex-col gap-4 w-full box-border">
          {/* 1. Kelompok Header & Info Lokasi */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 flex flex-col gap-2">
              {/* Badges Horizontal Inline with Exact Popup Border Styling */}
              <div className="flex items-center gap-2 flex-wrap">
                <span 
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    fontFamily: "monospace",
                    padding: "3.5px 10px",
                    lineHeight: 1,
                    borderRadius: "8px",
                    background: "rgba(6,182,212,0.15)",
                    color: "#22d3ee",
                    border: "1.5px solid rgba(6,182,212,0.45)",
                    letterSpacing: "0.5px",
                    boxShadow: "0 0 10px rgba(6,182,212,0.18)",
                    display: "inline-flex",
                    alignItems: "center"
                  }}
                >
                  {formatTasNitCode(sf.id || sf.tas_nit_id, sf.tas_nit_code)}
                </span>
                {sf.walking_class && (
                  <span 
                    style={{
                      fontSize: "11px",
                      fontWeight: 500,
                      color: "#cbd5e1",
                      background: "rgba(255,255,255,0.06)",
                      padding: "3.5px 10px",
                      lineHeight: 1,
                      borderRadius: "8px",
                      border: "1px solid rgba(255,255,255,0.14)",
                      display: "inline-flex",
                      alignItems: "center"
                    }}
                  >
                    {sf.walking_class}
                  </span>
                )}
              </div>
              {/* Street Name */}
              <h3 className="text-base md:text-[17px] font-bold text-white leading-snug tracking-tight break-words">
                {formatStreetName(sf.street_name)}
              </h3>
              {/* Location & Distance Subtitle */}
              <p className="text-xs text-[var(--text-secondary)] flex items-center gap-2 font-medium">
                <span>📍 {sf.nearest_stop}</span>
                <span className="text-white/20">•</span>
                <span className="text-cyan-300 font-semibold">{Number(sf.avg_distance_to_stop || sf.distance_to_stop_m || 0).toFixed(0)}m</span>
              </p>
            </div>
            <button 
              onClick={onCloseDetail} 
              className="text-[var(--text-muted)] hover:text-white p-1 rounded-lg hover:bg-white/5 text-base transition-colors shrink-0"
              title="Tutup Detail"
            >
              ✕
            </button>
          </div>

          {/* 2. Kelompok Skor UVI Utama */}
          <div className="flex items-baseline gap-2.5">
            <span className="text-3xl md:text-4xl font-extrabold tracking-tight leading-none" style={{ color: accentColor }}>
              {Number(sf.uvi_score || 0).toFixed(3)}
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">UVI Score</span>
          </div>

          {/* Divider Garis Tengah Simetris */}
          <div className="w-full h-[1px] bg-white/[0.08]" />

          {/* 3. Kelompok 3 Pilar Nilai Dimensi */}
          <div className="flex flex-col gap-3.5">
            <MiniBar label="Aktivitas & Fungsi" value={Number(sf.accessibility_score) || 0} color="#4facfe" icon={<Activity size={16} strokeWidth={2} />} />
            <MiniBar label="Lingkungan Fisik" value={Number(sf.physical_score) || 0} color="#22c55e" icon={<Building2 size={16} strokeWidth={2} />} />
            <MiniBar label="Sentimen Warga" value={Number(sf.sentiment_score) || 0} color="#f59e0b" icon={<MessageSquare size={16} strokeWidth={2} />} />
          </div>
        </div>

        {/* ── CARD 2: SENTIMEN WARGA (ALWAYS RENDERED) ── */}
        <div style={{ padding: "18px 16px", boxSizing: "border-box" }} className="dashboard-card bg-[rgba(20,25,35,0.85)] backdrop-blur-2xl border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] shrink-0 flex flex-col gap-4 w-full box-border">
          {/* 1. Kelompok Heading & Badge */}
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Sentimen Warga</h4>
            {nReviews >= 20 ? (
              <span style={{ fontSize: "10px", fontWeight: 600, padding: "4px 10px", lineHeight: 1.2, borderRadius: "8px", background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>Sampel Tinggi</span>
            ) : nReviews >= 10 ? (
              <span style={{ fontSize: "10px", fontWeight: 600, padding: "4px 10px", lineHeight: 1.2, borderRadius: "8px", background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>Sampel Cukup</span>
            ) : nReviews > 0 ? (
              <span style={{ fontSize: "10px", fontWeight: 600, padding: "4px 10px", lineHeight: 1.2, borderRadius: "8px", background: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>Sampel Terbatas</span>
            ) : (
              <span style={{ fontSize: "10px", fontWeight: 600, padding: "4px 10px", lineHeight: 1.2, borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#cbd5e1", border: "1px solid rgba(255,255,255,0.14)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>Belum Ada Ulasan</span>
            )}
          </div>

          {/* 2. Kelompok 3 Kolom Statistik (Rating, Total Ulasan, Tempat Terulas) */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center gap-1.5 text-xl md:text-2xl font-extrabold text-amber-400 leading-none">
                <Star size={17} fill="currentColor" /> {hasReviews ? avgRating.toFixed(1) : "-"}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1.5 font-medium leading-tight">Rata-rata Rating</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-xl md:text-2xl font-extrabold text-white leading-none">{nReviews.toLocaleString()}</div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1.5 font-medium leading-tight">Total Ulasan</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-xl md:text-2xl font-extrabold text-white leading-none">{nPlaces.toLocaleString()}</div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1.5 font-medium leading-tight">Tempat Terulas</div>
            </div>
          </div>

          {/* 3. Kelompok Kotak Persentase Positif & Negatif */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[rgba(34,197,94,0.12)] border border-emerald-500/20 rounded-xl py-2.5 px-3 text-center flex flex-col items-center justify-center">
              <div className="text-sm md:text-base font-bold text-green-400 leading-none">{hasReviews ? `${posPct}%` : "0%"}</div>
              <div className="text-[10px] font-semibold text-green-400/80 uppercase tracking-wider mt-1.5">Positif</div>
            </div>
            <div className="bg-[rgba(239,68,68,0.12)] border border-red-500/20 rounded-xl py-2.5 px-3 text-center flex flex-col items-center justify-center">
              <div className="text-sm md:text-base font-bold text-red-400 leading-none">{hasReviews ? `${negPct}%` : "0%"}</div>
              <div className="text-[10px] font-semibold text-red-400/80 uppercase tracking-wider mt-1.5">Negatif</div>
            </div>
          </div>

          {/* Divider Garis Tengah Simetris */}
          <div className="w-full h-[1px] bg-white/[0.08]" />

          {/* 4. Kelompok Teks Insight */}
          <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed break-words">
            {hasReviews ? (
              <>💡 Skor {Number(sf.sentiment_score || 0).toFixed(2)} dirata-ratakan dari <strong className="text-white font-semibold">{nReviews.toLocaleString()} ulasan</strong> di <strong className="text-white font-semibold">{nPlaces.toLocaleString()} tempat</strong> sekitar koridor.</>
            ) : (
              <>💡 Belum ada ulasan warga di titik ini (skor sentimen {Number(sf.sentiment_score || 0).toFixed(2)}).</>
            )}
          </div>
        </div>

        {/* ── CARD 3: FASILITAS DALAM 400M (ALWAYS RENDERED) ── */}
        <div style={{ padding: "18px 16px", boxSizing: "border-box" }} className="dashboard-card bg-[rgba(20,25,35,0.85)] backdrop-blur-2xl border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] shrink-0 flex flex-col gap-3.5 w-full box-border">
          {/* 1. Kelompok Heading & Total POI Badge */}
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Fasilitas Sekitar</h4>
            <span style={{ fontSize: "10px", fontWeight: 600, padding: "3.5px 10px", lineHeight: 1, borderRadius: "8px", background: "rgba(6,182,212,0.12)", color: "#22d3ee", border: "1px solid rgba(6,182,212,0.35)", display: "inline-flex", alignItems: "center" }}>
              {(Number(sf.poi_pendidikan || 0) + Number(sf.poi_kesehatan || 0) + Number(sf.poi_komersial || 0) + Number(sf.poi_katering || 0) + Number(sf.poi_finansial || 0) + Number(sf.poi_olahraga || 0))} POI • Radius 400m
            </span>
          </div>

          {/* 2. Kelompok List Fasilitas 2 Kolom dengan Thematic Icon Badges */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Pendidikan", val: Number(sf.poi_pendidikan || 0), icon: <GraduationCap size={16} />, color: "#a855f7", bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.25)" },
              { label: "Kesehatan", val: Number(sf.poi_kesehatan || 0), icon: <HeartPulse size={16} />, color: "#ec4899", bg: "rgba(236,72,153,0.12)", border: "rgba(236,72,153,0.25)" },
              { label: "Komersial", val: Number(sf.poi_komersial || 0), icon: <ShoppingBag size={16} />, color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)" },
              { label: "Katering", val: Number(sf.poi_katering || 0), icon: <Utensils size={16} />, color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)" },
              { label: "Finansial", val: Number(sf.poi_finansial || 0), icon: <Landmark size={16} />, color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.25)" },
              { label: "Olahraga", val: Number(sf.poi_olahraga || 0), icon: <Trophy size={16} />, color: "#06b6d4", bg: "rgba(6,182,212,0.12)", border: "rgba(6,182,212,0.25)" },
            ].map((item) => {
              const hasPoi = item.val > 0;
              return (
                <div 
                  key={item.label} 
                  className={`flex items-center gap-2.5 p-2 rounded-xl transition-all border ${
                    hasPoi 
                      ? "bg-white/[0.03] hover:bg-white/[0.06] border-white/5" 
                      : "bg-white/[0.01] border-white/[0.03] opacity-50"
                  }`}
                >
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" 
                    style={{ backgroundColor: item.bg, color: item.color, border: `1px solid ${item.border}` }}
                  >
                    {item.icon}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-sm md:text-base font-extrabold font-mono leading-none ${hasPoi ? "text-white" : "text-slate-500"}`}>
                      {item.val}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium leading-tight truncate mt-1">
                      {item.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── OPTIONAL: VISUAL ENVIRONMENT (AI) DETAIL ── */}
        {Number(sf.gvi) > 0 && (
          <div style={{ padding: "18px 16px", boxSizing: "border-box" }} className="dashboard-card bg-[rgba(20,25,35,0.85)] backdrop-blur-2xl border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] shrink-0 flex flex-col gap-3.5 w-full box-border">
            {/* 1. Kelompok Heading */}
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Visual Environment</h4>
              <span style={{ fontSize: "10px", fontWeight: 600, padding: "3.5px 10px", lineHeight: 1, borderRadius: "8px", background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.35)", display: "inline-flex", alignItems: "center" }}>AI Vision</span>
            </div>

            {/* 2. Kelompok Grid Metrik Visual AI */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { 
                  label: "Green View", 
                  val: `${(Number(sf.gvi || 0) * 100).toFixed(1)}%`, 
                  color: "#84cc16", 
                  bg: "rgba(132,204,22,0.12)", 
                  border: "rgba(132,204,22,0.25)", 
                  icon: <Trees size={16} /> 
                },
                { 
                  label: "Sky View", 
                  val: `${(Number(sf.svf || 0) * 100).toFixed(1)}%`, 
                  color: "#0ea5e9", 
                  bg: "rgba(14,165,233,0.12)", 
                  border: "rgba(14,165,233,0.25)", 
                  icon: <Cloud size={16} /> 
                },
                { 
                  label: "Trotoar", 
                  val: `${(Number(sf.sidewalk || 0) * 100).toFixed(1)}%`, 
                  color: "#a78bfa", 
                  bg: "rgba(167,139,250,0.12)", 
                  border: "rgba(167,139,250,0.25)", 
                  icon: <Footprints size={16} /> 
                },
                { 
                  label: "Lebar Jalan", 
                  val: `${(Number(sf.road_width || 0) * 100).toFixed(1)}%`, 
                  color: "#f97316", 
                  bg: "rgba(249,115,22,0.12)", 
                  border: "rgba(249,115,22,0.25)", 
                  icon: <Map size={16} /> 
                },
                { 
                  label: "Enclosure", 
                  val: `${(Number(sf.enclosure || 0) * 100).toFixed(1)}%`, 
                  color: "#ef4444", 
                  bg: "rgba(239,68,68,0.12)", 
                  border: "rgba(239,68,68,0.25)", 
                  icon: <Building2 size={16} /> 
                },
                { 
                  label: "Sampel Gambar", 
                  val: `${Number(sf.n_images || 0)} Foto`, 
                  color: "#38bdf8", 
                  bg: "rgba(56,189,248,0.12)", 
                  border: "rgba(56,189,248,0.25)", 
                  icon: <ImageIcon size={16} /> 
                },
              ].map((item) => (
                <div 
                  key={item.label} 
                  className="flex items-center gap-2.5 p-2 rounded-xl transition-all border bg-white/[0.03] hover:bg-white/[0.06] border-white/5"
                >
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" 
                    style={{ backgroundColor: item.bg, color: item.color, border: `1px solid ${item.border}` }}
                  >
                    {item.icon}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm md:text-base font-extrabold font-mono text-white leading-none">
                      {item.val}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium leading-tight truncate mt-1">
                      {item.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </aside>
    );
  }

  // ===== DEFAULT VIEW: Global stats =====
  return (
    <aside className="w-full h-full flex flex-col gap-3.5 overflow-y-auto hidden-scrollbar pb-8">

      {/* 1. Active Score Big Number & Summary */}
      <div style={{ padding: "18px 16px", boxSizing: "border-box" }} className="dashboard-card bg-[rgba(20,25,35,0.85)] backdrop-blur-2xl border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] shrink-0 flex flex-col gap-4 w-full box-border">
        {/* 1. Kelompok Heading */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider truncate">{LABEL_MAP[colorMode]}</h3>
          <span style={{ fontSize: "10px", fontWeight: 600, padding: "3.5px 10px", lineHeight: 1, borderRadius: "8px", background: "rgba(6,182,212,0.12)", color: "#22d3ee", border: "1px solid rgba(6,182,212,0.35)", display: "inline-flex", alignItems: "center" }}>Rata-rata Kota</span>
        </div>

        {/* 2. Kelompok Skor Utama & Progress Bar */}
        <div className="flex flex-col gap-2">
          <div className="text-3xl md:text-4xl font-extrabold tracking-tight leading-none" style={{ color: accentColor }}>
            {activeScore.toFixed(4)}
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mt-1">
            <div
              className="h-full rounded-full shadow-lg transition-all duration-700"
              style={{
                width: `${Math.min(activeScore * 100, 100)}%`,
                background: `linear-gradient(90deg, ${accentColor}, ${accentColor}aa)`,
                boxShadow: `0 0 12px ${accentColor}66`,
              }}
            />
          </div>
        </div>

        {/* 3. Kelompok Ringkasan Data Titik */}
        <div className="flex justify-between items-center text-[10px] md:text-[11px] text-[var(--text-muted)] font-medium pt-3.5 border-t border-white/[0.08]">
          <span>{stats?.totalTasNits?.toLocaleString() || "..."} TAS-Nits</span>
          <span>{stats?.totalBusStops?.toLocaleString() || "..."} Halte</span>
          <span>{stats?.totalPOIs?.toLocaleString() || "..."} POI</span>
        </div>
      </div>

      {/* 2. Three Pillars Mini Cards */}
      <div style={{ padding: "18px 16px", boxSizing: "border-box" }} className="dashboard-card bg-[rgba(20,25,35,0.85)] backdrop-blur-2xl border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] shrink-0 flex flex-col gap-4 w-full box-border">
        {/* 1. Kelompok Heading */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider truncate">Tiga Pilar UVI</h3>
          <span style={{ fontSize: "10px", fontWeight: 600, padding: "3.5px 10px", lineHeight: 1, borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#cbd5e1", border: "1px solid rgba(255,255,255,0.14)", display: "inline-flex", alignItems: "center" }}>3 Dimensi</span>
        </div>

        {/* 2. Kelompok Progress Bars Pilar */}
        <div className="flex flex-col gap-3.5">
          <MiniBar label="Aktivitas & Fungsi Perkotaan" value={stats?.avgAccessibility || 0} color="#4facfe" icon={<Activity size={16} strokeWidth={2} />} />
          <MiniBar label="Lingkungan Fisik" value={stats?.avgPhysical || 0} color="#22c55e" icon={<Building2 size={16} strokeWidth={2} />} />
          <MiniBar label="Sentimen Warga" value={stats?.avgSentiment || 0} color="#f59e0b" icon={<MessageSquare size={16} strokeWidth={2} />} />
        </div>
      </div>

      {/* 3. Score Distribution Histogram (REAL DATA) */}
      <div style={{ padding: "18px 16px", boxSizing: "border-box", minHeight: "220px" }} className="dashboard-card bg-[rgba(20,25,35,0.85)] backdrop-blur-2xl border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] flex flex-col gap-3.5 w-full box-border">
        {/* 1. Kelompok Heading */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider truncate" title={`Distribusi ${LABEL_MAP[colorMode]}`}>
            Distribusi {LABEL_MAP[colorMode]}
          </h3>
          <span style={{ fontSize: "10px", fontWeight: 600, padding: "3.5px 10px", lineHeight: 1, borderRadius: "8px", background: "rgba(6,182,212,0.12)", color: "#22d3ee", border: "1px solid rgba(6,182,212,0.35)", display: "inline-flex", alignItems: "center" }}>Histogram</span>
        </div>

        {/* 2. Kelompok Visualisasi Histogram */}
        <div className="w-full h-[130px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogramData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="range"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 10 }}
                dy={4}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 10 }}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
                contentStyle={{
                  backgroundColor: "rgba(15,20,35,0.95)",
                  borderColor: "rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  fontSize: "11px",
                  color: "white"
                }}
                itemStyle={{ color: "rgba(255,255,255,0.8)" }}
                labelStyle={{ color: "white", fontWeight: "bold", marginBottom: "2px" }}
                formatter={(value: any) => [`${value} TAS-Nits`, "Jumlah"]}
                labelFormatter={(label: any) => `Skor ${label}–${(parseFloat(String(label)) + 0.1).toFixed(1)}`}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {histogramData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={`rgb(${Math.round(239 - index * 24)}, ${Math.round(68 + index * 19)}, ${Math.round(68 + index * 20)})`}
                    style={{ filter: `drop-shadow(0 0 3px ${accentColor}33)` }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Walking Distance Distribution */}
      <div style={{ padding: "18px 16px", boxSizing: "border-box" }} className="dashboard-card bg-[rgba(20,25,35,0.85)] backdrop-blur-2xl border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] shrink-0 flex flex-col gap-3.5 w-full box-border">
        {/* 1. Kelompok Heading */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Jarak ke Halte</h3>
          <span style={{ fontSize: "10px", fontWeight: 600, padding: "3.5px 10px", lineHeight: 1, borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#cbd5e1", border: "1px solid rgba(255,255,255,0.14)", display: "inline-flex", alignItems: "center" }}>Walkability</span>
        </div>

        {/* 2. Kelompok Baris Distribusi Jarak */}
        <div className="flex flex-col gap-3">
          {stats?.walkingClasses && Object.entries(stats.walkingClasses)
            .sort(([a], [b]) => {
              const order = ["Sangat Dekat (<200m)", "Dekat (200-400m)", "Sedang (400-800m)", "Jauh (>800m)"];
              return order.indexOf(a) - order.indexOf(b);
            })
            .map(([cls, count]) => {
              const total = stats.totalTasNits || 1;
              const pct = (count / total * 100);
              const colors: Record<string, string> = {
                "Sangat Dekat (<200m)": "#00f2fe",
                "Dekat (200-400m)": "#84cc16",
                "Sedang (400-800m)": "#f59e0b",
                "Jauh (>800m)": "#ef4444",
              };
              return (
                <div key={cls}>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-xs text-[var(--text-secondary)]">{cls}</span>
                    <span className="text-xs font-bold font-mono text-white">
                      {count.toLocaleString()}{" "}
                      <span className="text-[9px] font-normal text-[var(--text-muted)] ml-0.5">
                        ({pct.toFixed(1)}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: colors[cls] || "#94a3b8" }} />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

    </aside>
  );
}
