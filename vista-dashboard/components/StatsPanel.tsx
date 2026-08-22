"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { ColorMode } from "./Map";

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
  accessibility: "Aksesibilitas",
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
function MiniBar({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-xs text-[var(--text-secondary)] truncate">{label}</span>
          <span className="text-sm font-bold text-white ml-2">{value.toFixed(3)}</span>
        </div>
        <div className="w-full h-1.5 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
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
    return (
      <aside className="w-full md:w-[340px] h-full flex flex-col gap-4 overflow-y-auto hidden-scrollbar pb-10">
        {/* Header with close */}
        <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-2xl border border-[var(--border-subtle)] rounded-3xl shadow-[var(--shadow-card)] shrink-0" style={{ padding: "20px" }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-base font-bold text-white leading-tight">{sf.street_name || "Jalan Tanpa Nama"}</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1">🚏 {sf.nearest_stop} • {Number(sf.avg_distance_to_stop).toFixed(0)}m</p>
            </div>
            <button onClick={onCloseDetail} className="text-[var(--text-muted)] hover:text-white text-lg transition-colors shrink-0 ml-2">✕</button>
          </div>

          {/* UVI Big Number */}
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-4xl font-extrabold" style={{ color: accentColor }}>{Number(sf.uvi_score).toFixed(3)}</span>
            <span className="text-sm text-[var(--text-secondary)]">UVI</span>
          </div>

          {/* 3 Pilar Breakdown */}
          <div className="flex flex-col gap-3">
            <MiniBar label="Aksesibilitas" value={Number(sf.accessibility_score) || 0} color="#4facfe" icon="♿" />
            <MiniBar label="Lingkungan Fisik" value={Number(sf.physical_score) || 0} color="#22c55e" icon="🏙️" />
            <MiniBar label="Sentimen Warga" value={Number(sf.sentiment_score) || 0} color="#f59e0b" icon="💬" />
          </div>
        </div>

        {/* Physical Environment Detail */}
        {Number(sf.gvi) > 0 && (
          <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-2xl border border-[var(--border-subtle)] rounded-3xl shadow-[var(--shadow-card)]" style={{ padding: "20px" }}>
            <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4">Visual Environment (AI)</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Green View", value: Number(sf.gvi), color: "#84cc16", icon: "🌳" },
                { label: "Sky View", value: Number(sf.svf), color: "#0ea5e9", icon: "☁️" },
                { label: "Trotoar", value: Number(sf.sidewalk), color: "#a78bfa", icon: "🚶" },
                { label: "Lebar Jalan", value: Number(sf.road_width), color: "#f97316", icon: "🛣️" },
                { label: "Enclosure", value: Number(sf.enclosure), color: "#ef4444", icon: "🏢" },
              ].map((item) => (
                <div key={item.label} className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3">
                  <div className="text-lg mb-1">{item.icon}</div>
                  <div className="text-lg font-bold" style={{ color: item.color }}>{(item.value * 100).toFixed(1)}%</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{item.label}</div>
                </div>
              ))}
              <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-3">
                <div className="text-lg mb-1">📸</div>
                <div className="text-lg font-bold text-white">{sf.n_images}</div>
                <div className="text-[10px] text-[var(--text-muted)]">Gambar AI</div>
              </div>
            </div>
          </div>
        )}

        {/* Sentiment Detail */}
        {Number(sf.sentiment_score) > 0 && (
          <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-2xl border border-[var(--border-subtle)] rounded-3xl shadow-[var(--shadow-card)]" style={{ padding: "20px" }}>
            <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Sentimen Warga</h4>
            <div className="flex items-center gap-4 mb-3">
              <div>
                <div className="text-2xl font-bold text-amber-400">⭐ {Number(sf.avg_rating).toFixed(1)}</div>
                <div className="text-[10px] text-[var(--text-muted)]">Rata-rata Rating</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{sf.n_reviews}</div>
                <div className="text-[10px] text-[var(--text-muted)]">Ulasan</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{sf.n_places}</div>
                <div className="text-[10px] text-[var(--text-muted)]">Tempat</div>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-[rgba(34,197,94,0.15)] rounded-lg p-2 text-center">
                <div className="text-sm font-bold text-green-400">{(Number(sf.positive_ratio) * 100).toFixed(0)}%</div>
                <div className="text-[10px] text-green-400/70">Positif</div>
              </div>
              <div className="flex-1 bg-[rgba(239,68,68,0.15)] rounded-lg p-2 text-center">
                <div className="text-sm font-bold text-red-400">{((1 - Number(sf.positive_ratio)) * 100).toFixed(0)}%</div>
                <div className="text-[10px] text-red-400/70">Negatif</div>
              </div>
            </div>
          </div>
        )}

        {/* POI Counts */}
        <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-2xl border border-[var(--border-subtle)] rounded-3xl shadow-[var(--shadow-card)]" style={{ padding: "20px" }}>
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Fasilitas dalam 400m</h4>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Pendidikan", val: sf.poi_pendidikan, icon: "🏫" },
              { label: "Kesehatan", val: sf.poi_kesehatan, icon: "🏥" },
              { label: "Komersial", val: sf.poi_komersial, icon: "🛍️" },
              { label: "Katering", val: sf.poi_katering, icon: "🍽️" },
              { label: "Finansial", val: sf.poi_finansial, icon: "🏦" },
              { label: "Olahraga", val: sf.poi_olahraga, icon: "⚽" },
            ].map((item) => (
              <div key={item.label} className="bg-[rgba(255,255,255,0.03)] rounded-xl p-2">
                <div className="text-sm">{item.icon}</div>
                <div className="text-sm font-bold text-white">{item.val || 0}</div>
                <div className="text-[9px] text-[var(--text-muted)] leading-tight">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  // ===== DEFAULT VIEW: Global stats =====
  return (
    <aside className="w-full md:w-[340px] h-full flex flex-col gap-5 overflow-y-auto hidden-scrollbar pb-10">

      {/* 1. Active Score Big Number */}
      <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-2xl border border-[var(--border-subtle)] rounded-3xl shadow-[var(--shadow-card)] shrink-0" style={{ padding: "24px" }}>
        <h3 className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-1">{LABEL_MAP[colorMode]} (Rata-rata)</h3>
        <div className="text-4xl font-extrabold mb-4" style={{ color: accentColor }}>
          {activeScore.toFixed(4)}
        </div>
        <div className="w-full h-2.5 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full shadow-lg transition-all duration-700"
            style={{
              width: `${Math.min(activeScore * 100, 100)}%`,
              background: `linear-gradient(90deg, ${accentColor}, ${accentColor}aa)`,
              boxShadow: `0 0 12px ${accentColor}66`,
            }}
          />
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-[var(--text-muted)]">
          <span>{stats?.totalTasNits?.toLocaleString() || "..."} TAS-Nits</span>
          <span>{stats?.totalBusStops?.toLocaleString() || "..."} Halte</span>
          <span>{stats?.totalPOIs?.toLocaleString() || "..."} POI</span>
        </div>
      </div>

      {/* 2. Three Pillars Mini Cards */}
      <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-2xl border border-[var(--border-subtle)] rounded-3xl shadow-[var(--shadow-card)]" style={{ padding: "20px" }}>
        <h3 className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-4">Tiga Pilar UVI</h3>
        <div className="flex flex-col gap-3">
          <MiniBar label="Aksesibilitas" value={stats?.avgAccessibility || 0} color="#4facfe" icon="♿" />
          <MiniBar label="Lingkungan Fisik" value={stats?.avgPhysical || 0} color="#22c55e" icon="🏙️" />
          <MiniBar label="Sentimen Warga" value={stats?.avgSentiment || 0} color="#f59e0b" icon="💬" />
        </div>
      </div>

      {/* 3. Score Distribution Histogram (REAL DATA) */}
      <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-2xl border border-[var(--border-subtle)] rounded-3xl shadow-[var(--shadow-card)] flex flex-col" style={{ padding: "20px", minHeight: "220px" }}>
        <h3 className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-4">Distribusi {LABEL_MAP[colorMode]}</h3>
        <div className="w-full -ml-4" style={{ minHeight: "140px", flex: 1 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogramData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="range"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 10 }}
                dy={8}
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
                  fontSize: "12px",
                }}
                formatter={(value: number) => [`${value} TAS-Nits`, "Jumlah"]}
                labelFormatter={(label: string) => `Skor ${label}–${(parseFloat(label) + 0.1).toFixed(1)}`}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
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
      <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-2xl border border-[var(--border-subtle)] rounded-3xl shadow-[var(--shadow-card)]" style={{ padding: "20px" }}>
        <h3 className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-4">Jarak ke Halte</h3>
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
              <div key={cls} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[var(--text-secondary)]">{cls}</span>
                  <span className="text-white font-semibold">{count.toLocaleString()} <span className="text-[var(--text-muted)]">({pct.toFixed(1)}%)</span></span>
                </div>
                <div className="w-full h-1.5 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: colors[cls] || "#94a3b8" }} />
                </div>
              </div>
            );
          })}
      </div>

    </aside>
  );
}
