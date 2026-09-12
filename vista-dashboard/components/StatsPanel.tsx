"use client";

import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { 
  Building2, MessageSquare, 
  Trees, Cloud, Footprints, Map, Image as ImageIcon, 
  GraduationCap, Activity, HeartPulse, ShoppingBag, Utensils, 
  Landmark, Trophy, Star, ChevronDown, ChevronUp, Download,
  MapPin, Lightbulb, X, Loader2, Filter, Layers, CheckCircle2, CheckSquare
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
  selectedFeatures?: any[];
  onCloseDetail: () => void;
  onOpenExport?: () => void;
  onToggleSelectFeature?: (feature: any) => void;
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
        <div className="w-full h-2 bg-white/10 rounded-md overflow-hidden">
          <div
            className="h-full rounded-md transition-all duration-500"
            style={{ width: `${Math.min(value * 100, 100)}%`, background: color }}
          />
        </div>
      </div>
    </div>
  );
}

export default function StatsPanel({
  stats,
  selectedFeature,
  selectedFeatures = [],
  onCloseDetail,
  onOpenExport,
  onToggleSelectFeature,
  colorMode,
}: StatsPanelProps) {
  const activeScore = getActiveScore(stats, colorMode);
  const accentColor = COLOR_MAP[colorMode];

  // Accordion open/collapse states for 3 pillars
  const [openPillars, setOpenPillars] = useState<Record<string, boolean>>({
    accessibility: true,
    physical: true,
    sentiment: true,
  });

  const togglePillar = (key: string) => {
    setOpenPillars((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // State for raw sentiment reviews drilldown
  const [reviews, setReviews] = useState<any[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [sentimentFilter, setSentimentFilter] = useState<"all" | "positif" | "negatif">("all");

  const currentTasNitId = selectedFeature ? (selectedFeature.id || selectedFeature.tas_nit_id) : null;

  useEffect(() => {
    if (!currentTasNitId) {
      setReviews([]);
      return;
    }

    let isMounted = true;
    setIsLoadingReviews(true);

    fetch(`/api/tas-nits/reviews?id=${encodeURIComponent(currentTasNitId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setReviews(data.reviews || []);
        }
      })
      .catch((err) => {
        console.error("Error fetching reviews:", err);
        if (isMounted) setReviews([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingReviews(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentTasNitId]);

  // Filtered reviews based on active chip
  const filteredReviews = useMemo(() => {
    if (sentimentFilter === "all") return reviews;
    return reviews.filter((r) => r.sentiment === sentimentFilter);
  }, [reviews, sentimentFilter]);

  // Build histogram data from real score distribution
  const histogramData = (stats?.scoreDistribution || new Array(10).fill(0)).map((count, i) => ({
    range: `${(i / 10).toFixed(1)}`,
    count,
  }));

  // If a feature is selected, show detail view (Linked Views principle)
  if (selectedFeature) {
    const sf = selectedFeature;
    const rawRevCount = reviews.length;
    const nReviews = rawRevCount > 0 ? rawRevCount : Number(sf.n_reviews || 0);
    const hasReviews = nReviews > 0;
    const nPlaces = rawRevCount > 0
      ? new Set(reviews.map((r) => r.place_name).filter(Boolean)).size
      : Number(sf.n_places || 0);
    const avgRating = rawRevCount > 0
      ? reviews.reduce((a, b) => a + Number(b.rating || 5), 0) / rawRevCount
      : Number(sf.avg_rating || 0);
    const posReviewsCount = rawRevCount > 0
      ? reviews.filter((r) => r.sentiment === "positif").length
      : 0;
    const posPct = rawRevCount > 0
      ? Math.round((posReviewsCount / rawRevCount) * 100)
      : (hasReviews ? Math.round((Number(sf.positive_ratio) || 0) * 100) : 0);
    const negPct = hasReviews ? (100 - posPct) : 0;

    // Effective sentiment score (fallback to raw review average if sf.sentiment_score was unassigned)
    const rawAvgScore = rawRevCount > 0
      ? (reviews.reduce((a, b) => a + Number(b.score || 0.5), 0) / rawRevCount)
      : 0;
    const effectiveSentimentScore = Number(sf.sentiment_score) > 0
      ? Number(sf.sentiment_score)
      : Number(rawAvgScore.toFixed(3));

    const totalPoi = (
      Number(sf.poi_pendidikan || 0) +
      Number(sf.poi_kesehatan || 0) +
      Number(sf.poi_komersial || 0) +
      Number(sf.poi_katering || 0) +
      Number(sf.poi_finansial || 0) +
      Number(sf.poi_olahraga || 0)
    );

    return (
      <aside className="w-full h-full flex flex-col gap-2.5 overflow-y-auto hidden-scrollbar pb-8">
        
        {/* ── CARD 1: LOCATION & UVI SCORE ── */}
        <div style={{ padding: "14px", boxSizing: "border-box" }} className="dashboard-card bg-[rgba(20,25,35,0.85)] backdrop-blur-2xl border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] shrink-0 flex flex-col gap-3 w-full box-border">
          {/* Row 1: Badges & Close Button */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span 
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  fontFamily: "monospace",
                  padding: "3px 8px",
                  lineHeight: 1,
                  borderRadius: "6px",
                  background: "rgba(6,182,212,0.15)",
                  color: "#22d3ee",
                  border: "1.5px solid rgba(6,182,212,0.45)",
                  letterSpacing: "0.5px",
                  boxShadow: "0 0 10px rgba(6,182,212,0.18)",
                  display: "inline-flex",
                  alignItems: "center",
                  whiteSpace: "nowrap"
                }}
              >
                {formatTasNitCode(sf.id || sf.tas_nit_id, sf.tas_nit_code)}
              </span>
              {sf.walking_class && (
                <span 
                  style={{
                    fontSize: "10.5px",
                    fontWeight: 500,
                    color: "#cbd5e1",
                    background: "rgba(255,255,255,0.06)",
                    padding: "3px 8px",
                    lineHeight: 1,
                    borderRadius: "6px",
                    border: "1px solid rgba(255,255,255,0.14)",
                    display: "inline-flex",
                    alignItems: "center",
                    whiteSpace: "nowrap"
                  }}
                >
                  {sf.walking_class}
                </span>
              )}
            </div>
            
            <button 
              onClick={onCloseDetail} 
              style={{ width: "24px", height: "24px", borderRadius: "6px" }}
              className="flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              title="Tutup Detail"
            >
              <X size={14} />
            </button>
          </div>

          {/* Row 2: Street Name & Subtitle */}
          <div className="flex flex-col gap-1">
            <h3 className="text-[15px] md:text-base font-bold text-white leading-snug tracking-tight break-words">
              {formatStreetName(sf.street_name)}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5 font-medium">
              <span className="flex items-center gap-1 truncate">
                <MapPin size={12} className="text-cyan-400 shrink-0" />
                <span className="truncate">{sf.nearest_stop}</span>
              </span>
              <span className="text-white/20">•</span>
              <span className="text-cyan-300 font-semibold shrink-0">{Number(sf.avg_distance_to_stop || sf.distance_to_stop_m || 0).toFixed(0)}m</span>
            </p>
          </div>

          {/* Row 3: Action Buttons (Pilih & Ekspor) */}
          {(onToggleSelectFeature || onOpenExport) && (
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              {onToggleSelectFeature && (
                <button
                  type="button"
                  onClick={() => onToggleSelectFeature(sf)}
                  style={{ padding: "6px 10px", borderRadius: "8px", boxSizing: "border-box" }}
                  className={`w-full flex items-center justify-center gap-1.5 border text-xs font-semibold transition-all cursor-pointer ${
                    selectedFeatures.some(
                      (f: any) =>
                        String(f?.properties?.id || f?.properties?.tas_nit_id || f?.id || f?.tas_nit_id) ===
                        String(sf.id || sf.tas_nit_id)
                    )
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.25)]"
                      : "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10"
                  }`}
                  title={
                    selectedFeatures.some(
                      (f: any) =>
                        String(f?.properties?.id || f?.properties?.tas_nit_id || f?.id || f?.tas_nit_id) ===
                        String(sf.id || sf.tas_nit_id)
                    )
                      ? "Hapus dari daftar titik ekspor"
                      : "Tambahkan titik ini ke daftar ekspor"
                  }
                >
                  <CheckSquare size={13} />
                  <span>
                    {selectedFeatures.some(
                      (f: any) =>
                        String(f?.properties?.id || f?.properties?.tas_nit_id || f?.id || f?.tas_nit_id) ===
                        String(sf.id || sf.tas_nit_id)
                    )
                      ? "Titik Terpilih"
                      : "Pilih Titik"}
                  </span>
                </button>
              )}
              {onOpenExport && (
                <button
                  onClick={onOpenExport}
                  style={{ padding: "6px 10px", borderRadius: "8px", boxSizing: "border-box" }}
                  className="w-full flex items-center justify-center gap-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-semibold transition-all shadow-[0_0_8px_rgba(6,182,212,0.15)] cursor-pointer"
                  title="Ekspor Laporan Kustom Segmen Ini"
                >
                  <Download size={13} />
                  <span>Ekspor Laporan</span>
                </button>
              )}
            </div>
          )}

          {/* Divider Garis Tengah Simetris */}
          <div className="w-full h-[1px] bg-white/[0.08]" />

          {/* 4. Kelompok Skor UVI Utama */}
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight leading-none" style={{ color: accentColor }}>
              {Number(sf.uvi_score || 0).toFixed(3)}
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">UVI Score</span>
          </div>

          {/* 5. Kelompok 3 Pilar Ringkasan Mini Bar */}
          <div className="flex flex-col gap-2.5">
            <MiniBar label="Aktivitas & Fungsi" value={Number(sf.accessibility_score) || 0} color="#4facfe" icon={<Activity size={15} strokeWidth={2} />} />
            <MiniBar label="Lingkungan Fisik" value={Number(sf.physical_score) || 0} color="#22c55e" icon={<Building2 size={15} strokeWidth={2} />} />
            <MiniBar label="Sentimen Warga" value={effectiveSentimentScore} color="#f59e0b" icon={<MessageSquare size={15} strokeWidth={2} />} />
          </div>
        </div>

        {/* ── EXPANDABLE ACCORDION 1: AKTIVITAS & FUNGSI (AKSESIBILITAS) ── */}
        <div style={{ boxSizing: "border-box" }} className="dashboard-card bg-[rgba(20,25,35,0.85)] backdrop-blur-2xl border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] shrink-0 flex flex-col w-full box-border overflow-hidden">
          {/* Accordion Header */}
          <button
            type="button"
            onClick={() => togglePillar("accessibility")}
            style={{ padding: "10px 12px", boxSizing: "border-box" }}
            className="w-full flex items-center justify-between gap-2 text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <Activity size={14} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[12.5px] font-bold text-white leading-tight">
                  Aktivitas & POI
                </span>
                <span className="text-[10.5px] text-[var(--text-secondary)] mt-0.5 leading-tight">
                  {totalPoi} POI dalam radius 400m
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span 
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  fontFamily: "monospace",
                  padding: "3px 8px",
                  lineHeight: 1,
                  borderRadius: "6px",
                  background: "rgba(59,130,246,0.15)",
                  color: "#60a5fa",
                  border: "1px solid rgba(59,130,246,0.35)",
                  boxShadow: "0 0 10px rgba(59,130,246,0.15)",
                  display: "inline-flex",
                  alignItems: "center"
                }}
              >
                {(Number(sf.accessibility_score) || 0).toFixed(3)}
              </span>
              <div className="w-5 h-5 flex items-center justify-center text-slate-400">
                {openPillars.accessibility ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </div>
            </div>
          </button>

          {/* Accordion Body */}
          {openPillars.accessibility && (
            <div 
              style={{ padding: "12px 12px 14px 12px", boxSizing: "border-box" }}
              className="border-t border-white/[0.08] flex flex-col gap-3 animate-fade-in"
            >
              {/* Transit vs Service Sub-scores */}
              <div className="grid grid-cols-2 gap-2">
                <div 
                  style={{ padding: "10px 12px", boxSizing: "border-box" }}
                  className="bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl flex flex-col gap-1 transition-all"
                >
                  <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">Akses Transit</span>
                  <span className="text-lg font-extrabold font-mono text-cyan-300 leading-tight">
                    {(Number(sf.transit_accessibility || sf.accessibility_score) || 0).toFixed(3)}
                  </span>
                  <span className="text-[10.5px] text-[var(--text-secondary)] font-medium truncate leading-tight">
                    Halte {sf.nearest_stop || "Terdekat"}
                  </span>
                </div>
                <div 
                  style={{ padding: "10px 12px", boxSizing: "border-box" }}
                  className="bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl flex flex-col gap-1 transition-all"
                >
                  <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">Akses Layanan</span>
                  <span className="text-lg font-extrabold font-mono text-blue-400 leading-tight">
                    {(Number(sf.service_accessibility || sf.accessibility_score) || 0).toFixed(3)}
                  </span>
                  <span className="text-[10.5px] text-[var(--text-secondary)] font-medium truncate leading-tight">
                    Keragaman 6 Kategori
                  </span>
                </div>
              </div>

              {/* MAPID Missions (MenuGo & StrukGo) Card (if present) */}
              {(Number(sf.mapid_menu_count || 0) > 0 || Number(sf.mapid_struk_count || 0) > 0) && (
                <div 
                  style={{ padding: "10px 12px", boxSizing: "border-box" }}
                  className="bg-blue-500/[0.08] border border-blue-500/25 rounded-xl flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-bold text-blue-300 uppercase tracking-wider">
                      Misi Ekonomi MAPID
                    </span>
                    <span 
                      style={{ padding: "2.5px 8px", borderRadius: "6px", fontSize: "9.5px", fontWeight: 600, display: "inline-flex", alignItems: "center" }}
                      className="bg-blue-500/20 text-blue-300 border border-blue-500/30 leading-none"
                    >
                      MenuGo & StrukGo
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center pt-0.5">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white font-mono">{sf.mapid_menu_count || 0}</span>
                      <span className="text-[9px] text-[var(--text-muted)]">MenuGo (Katalog F&B)</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white font-mono">{sf.mapid_struk_count || 0}</span>
                      <span className="text-[9px] text-[var(--text-muted)]">StrukGo (Transaksi)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 6 POI Categories Breakdown */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10.5px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Rincian Fasilitas (Radius 400m)
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: "Pendidikan", val: Number(sf.poi_pendidikan || 0), icon: <GraduationCap size={14} />, color: "#a855f7", bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.25)" },
                    { label: "Kesehatan", val: Number(sf.poi_kesehatan || 0), icon: <HeartPulse size={14} />, color: "#ec4899", bg: "rgba(236,72,153,0.12)", border: "rgba(236,72,153,0.25)" },
                    { label: "Komersial", val: Number(sf.poi_komersial || 0), icon: <ShoppingBag size={14} />, color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)" },
                    { label: "Katering", val: Number(sf.poi_katering || 0), icon: <Utensils size={14} />, color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)" },
                    { label: "Finansial", val: Number(sf.poi_finansial || 0), icon: <Landmark size={14} />, color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.25)" },
                    { label: "Olahraga", val: Number(sf.poi_olahraga || 0), icon: <Trophy size={14} />, color: "#06b6d4", bg: "rgba(6,182,212,0.12)", border: "rgba(6,182,212,0.25)" },
                  ].map((item) => {
                    const hasPoi = item.val > 0;
                    return (
                      <div 
                        key={item.label} 
                        style={{ padding: "8px 10px", boxSizing: "border-box" }}
                        className={`flex items-center gap-2 rounded-xl border transition-all ${
                          hasPoi 
                            ? "bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08]" 
                            : "bg-white/[0.01] border-white/[0.03] opacity-40"
                        }`}
                      >
                        <div 
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" 
                          style={{ backgroundColor: item.bg, color: item.color, border: `1px solid ${item.border}` }}
                        >
                          {item.icon}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className={`text-xs font-extrabold font-mono leading-none ${hasPoi ? "text-white" : "text-slate-500"}`}>
                            {item.val}
                          </span>
                          <span className="text-[9.5px] text-slate-400 font-medium leading-tight truncate mt-0.5">
                            {item.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── EXPANDABLE ACCORDION 2: LINGKUNGAN FISIK (AI SEGFORMER) ── */}
        <div style={{ boxSizing: "border-box" }} className="dashboard-card bg-[rgba(20,25,35,0.85)] backdrop-blur-2xl border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] shrink-0 flex flex-col w-full box-border overflow-hidden">
          {/* Accordion Header */}
          <button
            type="button"
            onClick={() => togglePillar("physical")}
            style={{ padding: "10px 12px", boxSizing: "border-box" }}
            className="w-full flex items-center justify-between gap-2 text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-green-500/15 border border-green-500/30 flex items-center justify-center text-green-400 shrink-0">
                <Building2 size={14} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[12.5px] font-bold text-white leading-tight">
                  Lingkungan Fisik AI
                </span>
                <span className="text-[10.5px] text-[var(--text-secondary)] mt-0.5 leading-tight">
                  {(Number(sf.physical_score) > 0 || Number(sf.n_images) > 0)
                    ? (sf.is_phys_estimated
                        ? `Estimasi Koridor (${Number(sf.n_images || 1)} Foto GSV)`
                        : `${Number(sf.n_images || 0)} Foto GSV • AI SegFormer`)
                    : "Di Luar Titik Sampel GSV"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span 
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  fontFamily: "monospace",
                  padding: "3px 8px",
                  lineHeight: 1,
                  borderRadius: "6px",
                  background: (Number(sf.physical_score) > 0 || Number(sf.n_images) > 0) ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
                  color: (Number(sf.physical_score) > 0 || Number(sf.n_images) > 0) ? "#4ade80" : "#94a3b8",
                  border: (Number(sf.physical_score) > 0 || Number(sf.n_images) > 0) ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(255,255,255,0.12)",
                  boxShadow: (Number(sf.physical_score) > 0 || Number(sf.n_images) > 0) ? "0 0 10px rgba(34,197,94,0.15)" : "none",
                  display: "inline-flex",
                  alignItems: "center"
                }}
              >
                {(Number(sf.physical_score) || 0).toFixed(3)}
              </span>
              <div className="w-5 h-5 flex items-center justify-center text-slate-400">
                {openPillars.physical ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </div>
            </div>
          </button>

          {/* Accordion Body */}
          {openPillars.physical && (
            <div 
              style={{ padding: "12px 12px 14px 12px", boxSizing: "border-box" }}
              className="border-t border-white/[0.08] flex flex-col gap-3 animate-fade-in"
            >
              {(Number(sf.physical_score) > 0 || Number(sf.n_images) > 0) ? (
                <>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { 
                        label: "Green View", 
                        val: `${(Number(sf.gvi || 0) * 100).toFixed(1)}%`, 
                        color: "#84cc16", 
                        bg: "rgba(132,204,22,0.12)", 
                        border: "rgba(132,204,22,0.25)", 
                        icon: <Trees size={14} /> 
                      },
                      { 
                        label: "Sky View", 
                        val: `${(Number(sf.svf || 0) * 100).toFixed(1)}%`, 
                        color: "#0ea5e9", 
                        bg: "rgba(14,165,233,0.12)", 
                        border: "rgba(14,165,233,0.25)", 
                        icon: <Cloud size={14} /> 
                      },
                      { 
                        label: "Trotoar", 
                        val: `${(Number(sf.sidewalk || 0) * 100).toFixed(1)}%`, 
                        color: "#a78bfa", 
                        bg: "rgba(167,139,250,0.12)", 
                        border: "rgba(167,139,250,0.25)", 
                        icon: <Footprints size={14} /> 
                      },
                      { 
                        label: "Lebar Jalan", 
                        val: `${(Number(sf.road_width || 0) * 100).toFixed(1)}%`, 
                        color: "#f97316", 
                        bg: "rgba(249,115,22,0.12)", 
                        border: "rgba(249,115,22,0.25)", 
                        icon: <Map size={14} /> 
                      },
                      { 
                        label: "Enclosure", 
                        val: `${(Number(sf.enclosure || 0) * 100).toFixed(1)}%`, 
                        color: "#ef4444", 
                        bg: "rgba(239,68,68,0.12)", 
                        border: "rgba(239,68,68,0.25)", 
                        icon: <Building2 size={14} /> 
                      },
                      { 
                        label: sf.is_phys_estimated ? "Sampel Koridor" : "Sampel GSV", 
                        val: `${Number(sf.n_images || 0)} Foto`, 
                        color: "#38bdf8", 
                        bg: "rgba(56,189,248,0.12)", 
                        border: "rgba(56,189,248,0.25)", 
                        icon: <ImageIcon size={14} /> 
                      },
                    ].map((item) => (
                      <div 
                        key={item.label} 
                        style={{ padding: "8px 10px", boxSizing: "border-box" }}
                        className="flex items-center gap-2 rounded-xl border bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] transition-all"
                      >
                        <div 
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" 
                          style={{ backgroundColor: item.bg, color: item.color, border: `1px solid ${item.border}` }}
                        >
                          {item.icon}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-extrabold font-mono text-white leading-none">
                            {item.val}
                          </span>
                          <span className="text-[9.5px] text-slate-400 font-medium leading-tight truncate mt-0.5">
                            {item.label}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Note / Explanatory card */}
                  <div 
                    style={{ padding: "10px 12px", boxSizing: "border-box" }}
                    className="bg-white/[0.03] border border-white/[0.08] rounded-xl flex items-start gap-2 text-[10.5px] text-[var(--text-secondary)] leading-relaxed"
                  >
                    <Lightbulb size={13} className="text-green-400 shrink-0 mt-0.5" />
                    <span>
                      {sf.is_phys_estimated
                        ? `Skor visual diestimasi dari rata-rata analisis AI SegFormer citra Google Street View pada koridor jalan yang sama (${formatStreetName(sf.street_name)}).`
                        : "Skor visual dihitung secara otomatis oleh model SegFormer berbasis tutupan hijau dan jalur pejalan kaki dari citra panorama Google Street View langsung pada titik ini."}
                    </span>
                  </div>
                </>
              ) : (
                <div 
                  style={{ padding: "14px 12px", boxSizing: "border-box" }}
                  className="bg-white/[0.02] border border-white/[0.08] rounded-xl text-center flex flex-col items-center justify-center gap-1 text-slate-400"
                >
                  <Building2 size={18} className="text-slate-500 mb-0.5" />
                  <span className="text-xs font-semibold text-white">Di Luar Cakupan Sampel GSV</span>
                  <span className="text-[10.5px] text-[var(--text-muted)] leading-relaxed max-w-[280px]">
                    Segmen ini berada di luar 3.494 titik sampel citra Google Street View yang diproses model SegFormer. Pada perhitungan komposit UVI, nilai dinormalisasi proporsional dari pilar Aksesibilitas dan Sentimen Warga.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── EXPANDABLE ACCORDION 3: SENTIMEN WARGA (INDOBERT & RAW REVIEWS) ── */}
        <div style={{ boxSizing: "border-box" }} className="dashboard-card bg-[rgba(20,25,35,0.85)] backdrop-blur-2xl border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] shrink-0 flex flex-col w-full box-border overflow-hidden">
          {/* Accordion Header */}
          <button
            type="button"
            onClick={() => togglePillar("sentiment")}
            style={{ padding: "10px 12px", boxSizing: "border-box" }}
            className="w-full flex items-center justify-between gap-2 text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <MessageSquare size={14} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[12.5px] font-bold text-white leading-tight">
                  Sentimen Warga
                </span>
                <span className="text-[10.5px] text-[var(--text-secondary)] mt-0.5 leading-tight">
                  {nReviews > 0 ? `${nReviews.toLocaleString()} ulasan • ${nPlaces} tempat` : "Belum ada ulasan terpetakan"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span 
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  fontFamily: "monospace",
                  padding: "3px 8px",
                  lineHeight: 1,
                  borderRadius: "6px",
                  background: "rgba(245,158,11,0.15)",
                  color: "#fbbf24",
                  border: "1px solid rgba(245,158,11,0.35)",
                  boxShadow: "0 0 10px rgba(245,158,11,0.15)",
                  display: "inline-flex",
                  alignItems: "center"
                }}
              >
                {(Number(effectiveSentimentScore) || 0).toFixed(3)}
              </span>
              <div className="w-5 h-5 flex items-center justify-center text-slate-400">
                {openPillars.sentiment ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </div>
            </div>
          </button>

          {/* Accordion Body */}
          {openPillars.sentiment && (
            <div 
              style={{ padding: "12px 12px 14px 12px", boxSizing: "border-box" }}
              className="border-t border-white/[0.08] flex flex-col gap-3 animate-fade-in"
            >
              {/* High-level stats summary */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center gap-1 text-lg font-extrabold text-amber-400 leading-none">
                    <Star size={14} fill="currentColor" /> {hasReviews ? avgRating.toFixed(1) : "-"}
                  </div>
                  <div className="text-[9.5px] text-[var(--text-muted)] mt-1 font-medium leading-tight">Rata-rata Rating</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="text-lg font-extrabold text-white leading-none">{nReviews.toLocaleString()}</div>
                  <div className="text-[9.5px] text-[var(--text-muted)] mt-1 font-medium leading-tight">Total Ulasan</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="text-lg font-extrabold text-white leading-none">{nPlaces.toLocaleString()}</div>
                  <div className="text-[9.5px] text-[var(--text-muted)] mt-1 font-medium leading-tight">Tempat Terulas</div>
                </div>
              </div>

              {/* Positif vs Negatif Ratio */}
              <div className="grid grid-cols-2 gap-2">
                <div 
                  style={{ padding: "8px 12px", boxSizing: "border-box" }}
                  className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-center flex flex-col items-center justify-center"
                >
                  <div className="text-xs font-bold text-green-400 leading-none">{hasReviews ? `${posPct}%` : "0%"}</div>
                  <div className="text-[9.5px] font-semibold text-green-400/80 uppercase tracking-wider mt-0.5">Positif</div>
                </div>
                <div 
                  style={{ padding: "8px 12px", boxSizing: "border-box" }}
                  className="bg-red-500/10 border border-red-500/25 rounded-xl text-center flex flex-col items-center justify-center"
                >
                  <div className="text-xs font-bold text-red-400 leading-none">{hasReviews ? `${negPct}%` : "0%"}</div>
                  <div className="text-[9.5px] font-semibold text-red-400/80 uppercase tracking-wider mt-0.5">Negatif</div>
                </div>
              </div>

              {/* MAPID Ecosystem Activities Card (if present) */}
              {Number(sf.mapid_activity_count || 0) > 0 && (
                <div 
                  style={{ padding: "10px 12px", boxSizing: "border-box" }}
                  className="bg-cyan-500/[0.08] border border-cyan-500/25 rounded-xl flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-bold text-cyan-300 uppercase tracking-wider">
                      Aktivitas Ekosistem MAPID
                    </span>
                    <span 
                      style={{ padding: "2.5px 8px", borderRadius: "6px", fontSize: "9.5px", fontWeight: 600, display: "inline-flex", alignItems: "center" }}
                      className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 leading-none"
                    >
                      Crowdsource MAPID
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-center pt-0.5">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white font-mono">{sf.mapid_activity_count}</span>
                      <span className="text-[8.5px] text-[var(--text-muted)]">Postingan</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white font-mono">{sf.mapid_activity_likes || 0}</span>
                      <span className="text-[8.5px] text-[var(--text-muted)]">Likes</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-cyan-300 font-mono">
                        {Number(sf.mapid_activity_sent_score || 0).toFixed(3)}
                      </span>
                      <span className="text-[8.5px] text-[var(--text-muted)]">Skor Sentimen</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Insight Text */}
              <div 
                style={{ padding: "10px 12px", boxSizing: "border-box" }}
                className="text-[10.5px] text-[var(--text-secondary)] leading-relaxed flex items-start gap-2 bg-white/[0.03] border border-white/[0.08] rounded-xl"
              >
                <Lightbulb size={13} className="text-amber-400 shrink-0 mt-0.5" />
                <span>
                  {Number(sf.mapid_activity_count || 0) > 0 && hasReviews
                    ? `Skor pilar sentimen (${effectiveSentimentScore.toFixed(3)}) merupakan perpaduan bobot setara: 50% model AI IndoBERT (Google Reviews) + 50% aktivitas komunitas MAPID.`
                    : hasReviews
                    ? `Skor sentimen (${effectiveSentimentScore.toFixed(3)}) dirata-ratakan dari ulasan Google Places sekitar koridor menggunakan fine-tuned IndoBERT.`
                    : Number(sf.mapid_activity_count || 0) > 0
                    ? `Skor sentimen (${Number(sf.mapid_activity_sent_score || 0).toFixed(3)}) diperoleh dari data aktivitas komunitas aplikasi MAPID.`
                    : "Belum ada ulasan warga terpetakan langsung pada radius segmen ini (skor sentimen mengacu pada default 0.5)."}
                </span>
              </div>

              {/* ── RAW REVIEW FEED DRILLDOWN ── */}
              <div className="flex flex-col gap-2 pt-0.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare size={12} className="text-cyan-400" />
                    <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                      Ulasan
                    </span>
                  </div>

                  {/* Filter chips */}
                  {reviews.length > 0 && (
                    <div className="flex items-center gap-1 bg-white/[0.04] p-0.5 rounded-lg border border-white/5">
                      <button
                        type="button"
                        onClick={() => setSentimentFilter("all")}
                        style={{ padding: "3px 6px" }}
                        className={`text-[9.5px] font-semibold rounded-md transition-colors cursor-pointer ${
                          sentimentFilter === "all" ? "bg-white/15 text-white" : "text-[var(--text-muted)] hover:text-white"
                        }`}
                      >
                        Semua ({reviews.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSentimentFilter("positif")}
                        style={{ padding: "3px 6px" }}
                        className={`text-[9.5px] font-semibold rounded-md transition-colors cursor-pointer ${
                          sentimentFilter === "positif" ? "bg-green-500/20 text-green-300" : "text-[var(--text-muted)] hover:text-white"
                        }`}
                      >
                        Positif ({reviews.filter((r) => r.sentiment === "positif").length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSentimentFilter("negatif")}
                        style={{ padding: "3px 6px" }}
                        className={`text-[9.5px] font-semibold rounded-md transition-colors cursor-pointer ${
                          sentimentFilter === "negatif" ? "bg-red-500/20 text-red-300" : "text-[var(--text-muted)] hover:text-white"
                        }`}
                      >
                        Negatif ({reviews.filter((r) => r.sentiment === "negatif").length})
                      </button>
                    </div>
                  )}
                </div>

                {/* Review Cards List */}
                {isLoadingReviews ? (
                  <div className="flex items-center justify-center py-4 text-xs text-[var(--text-secondary)] gap-2">
                    <Loader2 size={15} className="animate-spin text-cyan-400" />
                    <span>Memuat ulasan mentah segmen...</span>
                  </div>
                ) : filteredReviews.length > 0 ? (
                  <div className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto hidden-scrollbar pr-0.5">
                    {filteredReviews.map((rev, idx) => {
                      const isPos = rev.sentiment === "positif";
                      const isNeg = rev.sentiment === "negatif";

                      return (
                        <div
                          key={idx}
                          style={{ padding: "10px 12px", boxSizing: "border-box" }}
                          className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/5 rounded-xl flex flex-col gap-1.5 transition-all"
                        >
                          {/* Place & Rating Header */}
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="flex items-center gap-1 min-w-0">
                              <MapPin size={11} className="text-slate-400 shrink-0" />
                              <span className="text-[11.5px] font-semibold text-white truncate">
                                {rev.place_name}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                style={{ padding: "1.5px 6px", fontSize: "9.5px", borderRadius: "6px" }}
                                className={`font-semibold border leading-tight ${
                                  isPos
                                    ? "bg-green-500/10 border-green-500/30 text-green-400"
                                    : isNeg
                                    ? "bg-red-500/10 border-red-500/30 text-red-400"
                                    : "bg-slate-500/10 border-slate-500/30 text-slate-300"
                                }`}
                              >
                                {isPos ? "Positif" : isNeg ? "Negatif" : "Netral"} ({Number(rev.score ?? 0).toFixed(3)})
                              </span>
                              <div className="flex items-center text-amber-400 text-xs font-bold font-mono">
                                <Star size={11} fill="currentColor" className="mr-0.5" />
                                {rev.rating}
                              </div>
                            </div>
                          </div>

                          {/* Verbatim Review Text (Scrollable for long content) */}
                          {rev.text ? (
                            <div 
                              style={{ padding: "7px 9px", maxHeight: "100px", boxSizing: "border-box" }}
                              className="text-[10.5px] text-[var(--text-secondary)] leading-relaxed italic bg-black/30 rounded-lg border border-white/[0.04] overflow-y-auto hidden-scrollbar select-text"
                            >
                              &ldquo;{rev.text}&rdquo;
                            </div>
                          ) : (
                            <span className="text-[9.5px] text-[var(--text-muted)] italic px-1">
                              (Pemberian rating bintang tanpa komentar teks)
                            </span>
                          )}

                          {/* Metadata row */}
                          <div className="w-full h-[1px] bg-white/[0.04]" />
                          <div className="flex items-center justify-between text-[9.5px] text-[var(--text-muted)]">
                            <span>{rev.time || "Google Reviews"}</span>
                            <span>{rev.distance_m}m dari titik TAS-Nit</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div 
                    style={{ padding: "14px 12px", boxSizing: "border-box" }}
                    className="bg-white/[0.02] border border-white/5 rounded-xl text-center flex flex-col items-center justify-center gap-1 text-slate-400"
                  >
                    <MessageSquare size={16} className="text-slate-500 mb-0.5" />
                    <span className="text-xs font-semibold">Tidak ada ulasan terdaftar</span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {sentimentFilter !== "all"
                        ? `Tidak ada ulasan dengan kategori ${sentimentFilter}`
                        : "Belum tersedia data teks ulasan dalam radius segmen ini"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </aside>
    );
  }

  // ===== DEFAULT VIEW: Global stats =====
  return (
    <aside className="w-full h-full flex flex-col gap-2.5 overflow-y-auto hidden-scrollbar pb-8">

      {/* 1. Active Score Big Number & Summary */}
      <div style={{ padding: "14px", boxSizing: "border-box" }} className="dashboard-card bg-[rgba(20,25,35,0.85)] backdrop-blur-2xl border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] shrink-0 flex flex-col gap-3 w-full box-border">
        {/* 1. Kelompok Heading */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider truncate">{LABEL_MAP[colorMode]}</h3>
          <span style={{ fontSize: "10px", fontWeight: 600, padding: "3px 8px", lineHeight: 1, borderRadius: "6px", background: "rgba(6,182,212,0.12)", color: "#22d3ee", border: "1px solid rgba(6,182,212,0.35)", display: "inline-flex", alignItems: "center" }}>Rata-rata Kota</span>
        </div>

        {/* 2. Kelompok Skor Utama & Progress Bar */}
        <div className="flex flex-col gap-1.5">
          <div className="text-3xl font-extrabold tracking-tight leading-none" style={{ color: accentColor }}>
            {activeScore.toFixed(3)}
          </div>
          <div className="w-full h-2 bg-white/10 rounded-md overflow-hidden mt-1">
            <div
              className="h-full rounded-md shadow-lg transition-all duration-700"
              style={{
                width: `${Math.min(activeScore * 100, 100)}%`,
                background: `linear-gradient(90deg, ${accentColor}, ${accentColor}aa)`,
                boxShadow: `0 0 12px ${accentColor}66`,
              }}
            />
          </div>
        </div>

        {/* 3. Kelompok Ringkasan Data Titik */}
        <div className="w-full h-[1px] bg-white/[0.08]" />
        <div className="flex justify-between items-center text-[10px] md:text-[11px] text-[var(--text-muted)] font-medium">
          <span>{stats?.totalTasNits?.toLocaleString() || "..."} TAS-Nits</span>
          <span>{stats?.totalBusStops?.toLocaleString() || "..."} Halte</span>
          <span>{stats?.totalPOIs?.toLocaleString() || "..."} POI</span>
        </div>
      </div>

      {/* 2. Three Pillars Mini Cards */}
      <div style={{ padding: "14px", boxSizing: "border-box" }} className="dashboard-card bg-[rgba(20,25,35,0.85)] backdrop-blur-2xl border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] shrink-0 flex flex-col gap-3 w-full box-border">
        {/* 1. Kelompok Heading */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider truncate">Tiga Pilar UVI</h3>
          <span style={{ fontSize: "10px", fontWeight: 600, padding: "3px 8px", lineHeight: 1, borderRadius: "6px", background: "rgba(255,255,255,0.06)", color: "#cbd5e1", border: "1px solid rgba(255,255,255,0.14)", display: "inline-flex", alignItems: "center" }}>3 Dimensi</span>
        </div>

        {/* 2. Kelompok Progress Bars Pilar */}
        <div className="flex flex-col gap-2.5">
          <MiniBar label="Aktivitas & Fungsi Perkotaan" value={stats?.avgAccessibility || 0} color="#4facfe" icon={<Activity size={15} strokeWidth={2} />} />
          <MiniBar label="Lingkungan Fisik" value={stats?.avgPhysical || 0} color="#22c55e" icon={<Building2 size={15} strokeWidth={2} />} />
          <MiniBar label="Sentimen Warga" value={stats?.avgSentiment || 0} color="#f59e0b" icon={<MessageSquare size={15} strokeWidth={2} />} />
        </div>
      </div>

      {/* 3. Score Distribution Histogram (REAL DATA) */}
      <div style={{ padding: "14px", boxSizing: "border-box" }} className="dashboard-card bg-[rgba(20,25,35,0.85)] backdrop-blur-2xl border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] shrink-0 flex flex-col gap-3 w-full box-border">
        {/* 1. Kelompok Heading */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider truncate" title={`Distribusi ${LABEL_MAP[colorMode]}`}>
            Distribusi {LABEL_MAP[colorMode]}
          </h3>
          <span style={{ fontSize: "10px", fontWeight: 600, padding: "3px 8px", lineHeight: 1, borderRadius: "6px", background: "rgba(6,182,212,0.12)", color: "#22d3ee", border: "1px solid rgba(6,182,212,0.35)", display: "inline-flex", alignItems: "center" }}>Histogram</span>
        </div>

        {/* 2. Kelompok Visualisasi Histogram */}
        <div className="w-full h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogramData} margin={{ top: 6, right: 6, left: -14, bottom: -4 }}>
              <XAxis
                dataKey="range"
                axisLine={false}
                tickLine={false}
                height={18}
                tick={{ fill: "#64748b", fontSize: 9.5 }}
                dy={2}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={28}
                tick={{ fill: "#64748b", fontSize: 9.5 }}
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
      <div style={{ padding: "14px", boxSizing: "border-box" }} className="dashboard-card bg-[rgba(20,25,35,0.85)] backdrop-blur-2xl border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] shrink-0 flex flex-col gap-3 w-full box-border">
        {/* 1. Kelompok Heading */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Jarak ke Halte</h3>
          <span style={{ fontSize: "10px", fontWeight: 600, padding: "3px 8px", lineHeight: 1, borderRadius: "6px", background: "rgba(255,255,255,0.06)", color: "#cbd5e1", border: "1px solid rgba(255,255,255,0.14)", display: "inline-flex", alignItems: "center" }}>Walkability</span>
        </div>

        {/* 2. Kelompok Baris Distribusi Jarak */}
        <div className="flex flex-col gap-2.5">
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
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-[11.5px] text-[var(--text-secondary)]">{cls}</span>
                    <span className="text-xs font-bold font-mono text-white">
                      {count.toLocaleString()}{" "}
                      <span className="text-[9px] font-normal text-[var(--text-muted)] ml-0.5">
                        ({pct.toFixed(1)}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-md overflow-hidden">
                    <div className="h-full rounded-md transition-all duration-500" style={{ width: `${pct}%`, background: colors[cls] || "#94a3b8" }} />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

    </aside>
  );
}
