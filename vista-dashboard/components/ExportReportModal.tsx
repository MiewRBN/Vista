"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  X,
  Download,
  Sliders,
  Sparkles,
  Layers,
  MapPin,
  Check,
  BrainCircuit,
  Activity,
  Building2,
  MessageSquare,
  FileSpreadsheet,
  FileCode,
  Info,
  CheckSquare,
  Plus,
  Trash2,
  Search
} from "lucide-react";
import { formatStreetName, formatTasNitCode } from "@/app/page";

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFeature: any;
  selectedFeatures?: any[];
  allFeatures: any[];
  onRemoveFeature?: (id: string | number) => void;
  onAddFeature?: (feature: any) => void;
  onClearFeatures?: () => void;
}

type ExportScope = "selected" | "single" | "corridor" | "all";
type ExportFormat = "geojson" | "csv";

// Helper to generate rule-based CCIA AI reasoning
function generateCCIAforSegment(
  props: any,
  includeAcc: boolean,
  includePhys: boolean,
  includeSent: boolean,
  customUvi: number
): { condition: string; cause: string; impact: string; action: string; fullNarrative: string } {
  const street = formatStreetName(props.street_name);
  const acc = Number(props.accessibility_score) || 0;
  const phys = Number(props.physical_score) || 0;
  const sent = Number(props.sentiment_score) || 0;
  const gvi = (Number(props.gvi) || 0) * 100;
  const walkCls = props.walking_class || "Tidak terdefinisi";
  const nReviews = Number(props.n_reviews) || 0;
  const posPct = Math.round((Number(props.positive_ratio) || 0) * 100);

  // Identify primary bottleneck
  const activePillars = [];
  if (includeAcc) activePillars.push({ name: "Aksesibilitas & Fungsi", score: acc });
  if (includePhys) activePillars.push({ name: "Lingkungan Fisik AI", score: phys });
  if (includeSent) activePillars.push({ name: "Sentimen Warga", score: sent });

  activePillars.sort((a, b) => a.score - b.score);
  const lowest = activePillars[0] || { name: "Umum", score: 0 };
  const highest = activePillars[activePillars.length - 1] || { name: "Umum", score: 0 };

  const condition = `Segmen koridor ${street} mencatat Custom UVI sebesar ${customUvi.toFixed(3)} (Kategori: ${
    customUvi >= 0.7 ? "Tinggi / Sangat Vital" : customUvi >= 0.4 ? "Moderat / Berkembang" : "Rendah / Kurang Vital"
  }). Pilar terkuat adalah ${highest.name} (${highest.score.toFixed(3)}), sedangkan pembatas utama adalah ${lowest.name} (${lowest.score.toFixed(3)}).`;

  let cause = "";
  if (lowest.name === "Aksesibilitas & Fungsi") {
    cause = `Keterbatasan fasilitas transit dan keragaman fungsi POI dalam radius 400m (kategori walkability: ${walkCls}).`;
  } else if (lowest.name === "Lingkungan Fisik AI") {
    cause = `Defisit visual pedestrian (Green View Index ${gvi.toFixed(1)}% dan proporsi trotoar yang minim berdasarkan evaluasi AI SegFormer).`;
  } else if (lowest.name === "Sentimen Warga") {
    cause = nReviews > 0
      ? `Persepsi komunitas negatif (${100 - posPct}% ulasan kritis dari ${nReviews} sampel ulasan).`
      : "Belum tersedianya ulasan komunitas yang memadai pada segmen ini sehingga skor mengacu pada baseline rata-rata.";
  } else {
    cause = "Keseimbangan pilar relatif merata di seluruh komponen yang dianalisis.";
  }

  const impact = `Komposisi pilar ini berdampak langsung terhadap kenyamanan pejalan kaki, intensitas aktivitas perkotaan harian, dan daya tarik ekonomi lokal koridor ${street}.`;

  let action = "";
  if (lowest.name === "Aksesibilitas & Fungsi") {
    action = "Rekomendasi: Optimalisasi rute first-mile/last-mile angkutan umum dan penambahan titik fungsi esensial (retail mikro/kesehatan).";
  } else if (lowest.name === "Lingkungan Fisik AI") {
    action = "Rekomendasi: Program peremajaan trotoar terstandar aksesibilitas dan penanaman pohon peneduh (street greening) untuk menaikkan GVI.";
  } else {
    action = "Rekomendasi: Penguatan aktivasi ruang publik komunal, penertiban parkir liar, dan penataan fasad ruko koridor.";
  }

  const fullNarrative = `[KONDISI]: ${condition} [PENYEBAB]: ${cause} [DAMPAK]: ${impact} [TINDAKAN]: ${action}`;

  return { condition, cause, impact, action, fullNarrative };
}

export default function ExportReportModal({
  isOpen,
  onClose,
  selectedFeature,
  selectedFeatures = [],
  allFeatures = [],
  onRemoveFeature,
  onAddFeature,
  onClearFeatures,
}: ExportReportModalProps) {
  const [scope, setScope] = useState<ExportScope>(
    selectedFeatures.length > 0 ? "selected" : "single"
  );
  const [pointSearchQuery, setPointSearchQuery] = useState("");
  const [includeAccessibility, setIncludeAccessibility] = useState(true);
  const [includePhysical, setIncludePhysical] = useState(true);
  const [includeSentiment, setIncludeSentiment] = useState(true);
  const [includeAIReasoning, setIncludeAIReasoning] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // Automatically switch scope to 'selected' when user opens modal with multiple selected points
  useEffect(() => {
    if (selectedFeatures.length > 1) {
      setScope("selected");
    } else if (selectedFeatures.length === 0 && scope === "selected") {
      setScope("single");
    }
  }, [selectedFeatures.length, isOpen]);

  // Determine features to export based on scope
  const targetFeatures = useMemo(() => {
    if (scope === "selected") {
      if (selectedFeatures.length > 0) return selectedFeatures;
      return selectedFeature ? [selectedFeature] : [];
    }

    if (!allFeatures || allFeatures.length === 0) {
      return selectedFeature ? [selectedFeature] : [];
    }

    if (scope === "single") {
      return selectedFeature ? [selectedFeature] : [allFeatures[0]];
    }

    if (scope === "corridor" && selectedFeature) {
      const sfProps = selectedFeature.properties || selectedFeature;
      const targetStreet = sfProps.street_name;
      return allFeatures.filter(
        (f) => (f.properties?.street_name || f.street_name) === targetStreet
      );
    }

    // "all"
    return allFeatures;
  }, [scope, selectedFeature, selectedFeatures, allFeatures]);

  // Dynamic recalculation of Custom UVI
  const calculateCustomUvi = useCallback(
    (props: any) => {
      const acc = Number(props.accessibility_score) || 0;
      const phys = Number(props.physical_score) || 0;
      const sent = Number(props.sentiment_score) || 0;

      const activeScores: number[] = [];
      if (includeAccessibility) activeScores.push(acc);
      if (includePhysical) activeScores.push(phys);
      if (includeSentiment) activeScores.push(sent);

      if (activeScores.length === 0) return 0;
      const sum = activeScores.reduce((a, b) => a + b, 0);
      return sum / activeScores.length;
    },
    [includeAccessibility, includePhysical, includeSentiment]
  );

  // Filter search suggestions for adding points inside modal
  const searchSuggestions = useMemo(() => {
    if (!pointSearchQuery.trim() || !allFeatures) return [];
    const q = pointSearchQuery.toLowerCase().trim();
    const existingIds = new Set(
      (selectedFeatures || []).map((f: any) => {
        const p = f.properties || f;
        return String(p.id || p.tas_nit_id);
      })
    );

    const matches: any[] = [];
    for (const f of allFeatures) {
      if (matches.length >= 6) break;
      const p = f.properties || f;
      const id = String(p.id || p.tas_nit_id || "");
      const code = formatTasNitCode(id, p.tas_nit_code);
      const street = formatStreetName(p.street_name);

      if (!existingIds.has(id)) {
        if (code.toLowerCase().includes(q) || id.toLowerCase().includes(q) || street.toLowerCase().includes(q)) {
          matches.push(f);
        }
      }
    }
    return matches;
  }, [pointSearchQuery, allFeatures, selectedFeatures]);

  if (!isOpen) return null;

  const sfProps = selectedFeature?.properties || selectedFeature || {};
  const currentCustomUvi = calculateCustomUvi(sfProps);
  const originalUvi = Number(sfProps.uvi_score || 0);

  // Export handlers
  const handleExport = (format: ExportFormat) => {
    setIsExporting(true);
    setExportSuccess(null);

    try {
      const exportTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const paramTag = [
        includeAccessibility ? "Acc" : null,
        includePhysical ? "Phys" : null,
        includeSentiment ? "Sent" : null,
      ]
        .filter(Boolean)
        .join("+");

      if (format === "geojson") {
        const geojsonFeatures = targetFeatures.map((f: any) => {
          const props = f.properties || f;
          const coords = f.geometry?.coordinates || [
            Number(props.center_lon || props.lon || 107.61),
            Number(props.center_lat || props.lat || -6.91),
          ];
          const customScore = calculateCustomUvi(props);
          const ccia = includeAIReasoning
            ? generateCCIAforSegment(
                props,
                includeAccessibility,
                includePhysical,
                includeSentiment,
                customScore
              )
            : null;

          return {
            type: "Feature",
            geometry: f.geometry || {
              type: "Point",
              coordinates: coords,
            },
            properties: {
              tas_nit_id: props.id || props.tas_nit_id,
              tas_nit_code: formatTasNitCode(props.id || props.tas_nit_id, props.tas_nit_code),
              street_name: formatStreetName(props.street_name),
              nearest_stop: props.nearest_stop || "N/A",
              distance_to_stop_m: Number(props.avg_distance_to_stop || props.distance_to_stop_m || 0),
              walking_class: props.walking_class || "N/A",
              original_uvi: Number(props.uvi_score || 0),
              custom_uvi: Number(customScore.toFixed(4)),
              parameters_used: paramTag,
              accessibility_score: includeAccessibility ? Number(props.accessibility_score || 0) : null,
              physical_score: includePhysical ? Number(props.physical_score || 0) : null,
              sentiment_score: includeSentiment ? Number(props.sentiment_score || 0) : null,
              gvi: Number(props.gvi || 0),
              svf: Number(props.svf || 0),
              sidewalk: Number(props.sidewalk || 0),
              total_poi_400m:
                (Number(props.poi_pendidikan || 0) +
                  Number(props.poi_kesehatan || 0) +
                  Number(props.poi_komersial || 0) +
                  Number(props.poi_katering || 0) +
                  Number(props.poi_finansial || 0) +
                  Number(props.poi_olahraga || 0)),
              ...(ccia
                ? {
                    ai_condition: ccia.condition,
                    ai_cause: ccia.cause,
                    ai_impact: ccia.impact,
                    ai_action: ccia.action,
                    ai_full_reasoning: ccia.fullNarrative,
                  }
                : {}),
            },
          };
        });

        const geojsonOutput = {
          type: "FeatureCollection",
          metadata: {
            title: "VISTA Custom Spatial Analysis Report",
            timestamp: new Date().toISOString(),
            total_segments: geojsonFeatures.length,
            parameters: {
              include_accessibility: includeAccessibility,
              include_physical: includePhysical,
              include_sentiment: includeSentiment,
              include_ai_reasoning: includeAIReasoning,
            },
          },
          features: geojsonFeatures,
        };

        const blob = new Blob([JSON.stringify(geojsonOutput, null, 2)], {
          type: "application/geo+json;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `VISTA_Report_${scope}_${paramTag}_${exportTimestamp}.geojson`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // CSV Export
        const rows: string[] = [];
        const headers = [
          "tas_nit_id",
          "tas_nit_code",
          "street_name",
          "longitude",
          "latitude",
          "nearest_stop",
          "distance_to_stop_m",
          "walking_class",
          "original_uvi",
          "custom_uvi",
          "accessibility_score",
          "physical_score",
          "sentiment_score",
          "gvi",
          "svf",
          "sidewalk",
          "poi_total_400m",
          ...(includeAIReasoning ? ["ai_reasoning_summary"] : []),
        ];
        rows.push(headers.join(","));

        targetFeatures.forEach((f: any) => {
          const props = f.properties || f;
          const coords = f.geometry?.coordinates || [
            props.center_lon || props.lon || "",
            props.center_lat || props.lat || "",
          ];
          const customScore = calculateCustomUvi(props);
          const ccia = includeAIReasoning
            ? generateCCIAforSegment(
                props,
                includeAccessibility,
                includePhysical,
                includeSentiment,
                customScore
              )
            : null;

          const escapeCsv = (val: any) => {
            if (val === null || val === undefined) return '""';
            const s = String(val).replace(/"/g, '""');
            return `"${s}"`;
          };

          const poiTotal =
            Number(props.poi_pendidikan || 0) +
            Number(props.poi_kesehatan || 0) +
            Number(props.poi_komersial || 0) +
            Number(props.poi_katering || 0) +
            Number(props.poi_finansial || 0) +
            Number(props.poi_olahraga || 0);

          const rowData = [
            escapeCsv(props.id || props.tas_nit_id),
            escapeCsv(formatTasNitCode(props.id || props.tas_nit_id, props.tas_nit_code)),
            escapeCsv(formatStreetName(props.street_name)),
            coords[0] || "",
            coords[1] || "",
            escapeCsv(props.nearest_stop || ""),
            Number(props.avg_distance_to_stop || props.distance_to_stop_m || 0).toFixed(1),
            escapeCsv(props.walking_class || ""),
            Number(props.uvi_score || 0).toFixed(4),
            customScore.toFixed(4),
            includeAccessibility ? Number(props.accessibility_score || 0).toFixed(4) : "",
            includePhysical ? Number(props.physical_score || 0).toFixed(4) : "",
            includeSentiment ? Number(props.sentiment_score || 0).toFixed(4) : "",
            (Number(props.gvi || 0) * 100).toFixed(1) + "%",
            (Number(props.svf || 0) * 100).toFixed(1) + "%",
            (Number(props.sidewalk || 0) * 100).toFixed(1) + "%",
            poiTotal,
            ...(includeAIReasoning && ccia ? [escapeCsv(ccia.fullNarrative)] : []),
          ];

          rows.push(rowData.join(","));
        });

        const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `VISTA_Report_${scope}_${paramTag}_${exportTimestamp}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }

      setExportSuccess(`Berhasil mengunduh laporan ${format.toUpperCase()} (${targetFeatures.length} segmen)`);
      setTimeout(() => setExportSuccess(null), 4000);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-2xl bg-[rgba(15,20,35,0.95)] border border-[rgba(255,255,255,0.12)] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] flex flex-col max-h-[90vh] overflow-hidden"
        style={{ boxSizing: "border-box" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 md:p-6 border-b border-white/[0.08] shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Download size={20} />
            </div>
            <div className="flex flex-col">
              <h3 className="text-base md:text-lg font-bold text-white leading-tight">
                Ekspor Laporan Kustom VISTA
              </h3>
              <span className="text-xs text-[var(--text-secondary)]">
                Kustomisasi Parameter UVI, Narasi AI & Unduh GeoJSON / CSV
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto hidden-scrollbar p-5 md:p-6 flex flex-col gap-6">
          {/* Section 1: Cakupan Segmen */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
                <MapPin size={14} className="text-cyan-400" />
                <span>1. Cakupan Segmen TAS-Nit</span>
              </label>
              {selectedFeatures.length > 0 && (
                <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                  {selectedFeatures.length} titik aktif dalam seleksi
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {/* Option 1: Titik Terpilih (Multi-Select) */}
              <button
                type="button"
                onClick={() => setScope("selected")}
                className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                  scope === "selected"
                    ? "bg-cyan-500/15 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                    : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-bold text-white">Titik Terpilih</span>
                  <CheckSquare size={13} className={scope === "selected" ? "text-cyan-400" : "text-slate-400"} />
                </div>
                <span className="text-[11px] text-[var(--text-secondary)] leading-snug truncate w-full">
                  Pilihan kustom
                </span>
                <span className="text-[10px] font-mono text-cyan-400 mt-2 font-bold">
                  {selectedFeatures.length > 0 ? `${selectedFeatures.length} Titik` : (sfProps.street_name ? "1 Titik" : "0 Titik")}
                </span>
              </button>

              {/* Option 2: Segmen Tunggal Aktif */}
              <button
                type="button"
                onClick={() => setScope("single")}
                className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                  scope === "single"
                    ? "bg-cyan-500/15 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                    : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-bold text-white">Segmen Aktif</span>
                  <MapPin size={13} className={scope === "single" ? "text-cyan-400" : "text-slate-400"} />
                </div>
                <span className="text-[11px] text-[var(--text-secondary)] leading-snug truncate w-full">
                  {sfProps.street_name ? formatStreetName(sfProps.street_name) : "1 Segmen"}
                </span>
                <span className="text-[10px] font-mono text-cyan-400 mt-2">1 Segmen</span>
              </button>

              {/* Option 3: Seluruh Koridor Jalan */}
              <button
                type="button"
                onClick={() => setScope("corridor")}
                disabled={!sfProps.street_name}
                className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                  !sfProps.street_name
                    ? "opacity-40 cursor-not-allowed bg-white/[0.01] border-white/5"
                    : scope === "corridor"
                    ? "bg-cyan-500/15 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                    : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-bold text-white">Koridor Jalan</span>
                  <Layers size={13} className={scope === "corridor" ? "text-cyan-400" : "text-slate-400"} />
                </div>
                <span className="text-[11px] text-[var(--text-secondary)] leading-snug truncate w-full">
                  Ruas yang sama
                </span>
                <span className="text-[10px] font-mono text-cyan-400 mt-2">
                  {sfProps.street_name
                    ? `${
                        allFeatures.filter(
                          (f) => f.properties?.street_name === sfProps.street_name || f.street_name === sfProps.street_name
                        ).length
                      } Segmen`
                    : "Pilih Segmen"}
                </span>
              </button>

              {/* Option 4: Seluruh Kota / Dataset */}
              <button
                type="button"
                onClick={() => setScope("all")}
                className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                  scope === "all"
                    ? "bg-cyan-500/15 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                    : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-bold text-white">Seluruh Kota</span>
                  <Sparkles size={13} className={scope === "all" ? "text-cyan-400" : "text-slate-400"} />
                </div>
                <span className="text-[11px] text-[var(--text-secondary)] leading-snug truncate w-full">
                  Semua titik TAS-Nit
                </span>
                <span className="text-[10px] font-mono text-cyan-400 mt-2">
                  {allFeatures.length.toLocaleString()} Segmen
                </span>
              </button>
            </div>

            {/* Selected Segments Manager (when scope === "selected") */}
            {scope === "selected" && (
              <div className="bg-white/[0.03] border border-cyan-500/30 rounded-2xl p-4 flex flex-col gap-3.5 animate-in fade-in duration-200">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2">
                    <CheckSquare size={15} className="text-cyan-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Kurasi Titik Ekspor ({targetFeatures.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {sfProps.street_name && (
                      <button
                        type="button"
                        onClick={() => {
                          const corridorPoints = allFeatures.filter(
                            (f) => (f.properties?.street_name || f.street_name) === sfProps.street_name
                          );
                          corridorPoints.forEach((p) => {
                            if (onAddFeature) onAddFeature(p);
                          });
                        }}
                        className="text-[10px] font-semibold text-cyan-300 hover:text-white bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={11} />
                        <span>Tambah Koridor Ini ({allFeatures.filter((f) => (f.properties?.street_name || f.street_name) === sfProps.street_name).length})</span>
                      </button>
                    )}
                    {onClearFeatures && targetFeatures.length > 0 && (
                      <button
                        type="button"
                        onClick={onClearFeatures}
                        className="text-[10px] font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        title="Kosongkan Pilihan"
                      >
                        <Trash2 size={11} />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Search to Add Points Directly */}
                <div className="relative">
                  <div className="relative flex items-center">
                    <Search size={13} className="absolute left-3 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={pointSearchQuery}
                      onChange={(e) => setPointSearchQuery(e.target.value)}
                      placeholder="Cari & tambah titik TAS-Nit (kode atau nama jalan)..."
                      className="w-full bg-black/30 border border-white/10 focus:border-cyan-500/50 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 outline-none transition-all"
                    />
                  </div>

                  {/* Autocomplete Dropdown */}
                  {searchSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-[rgba(15,20,35,0.98)] border border-cyan-500/40 rounded-xl shadow-2xl z-30 max-h-48 overflow-y-auto hidden-scrollbar divide-y divide-white/5">
                      {searchSuggestions.map((item: any, idx: number) => {
                        const p = item.properties || item;
                        const id = p.id || p.tas_nit_id;
                        const code = formatTasNitCode(id, p.tas_nit_code);
                        const street = formatStreetName(p.street_name);
                        const uvi = Number(p.uvi_score || 0).toFixed(3);

                        return (
                          <div
                            key={idx}
                            className="p-2.5 hover:bg-white/[0.06] flex items-center justify-between gap-2 transition-colors cursor-pointer"
                            onClick={() => {
                              if (onAddFeature) onAddFeature(item);
                              setPointSearchQuery("");
                            }}
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold font-mono text-cyan-300">{code}</span>
                              <span className="text-[11px] text-slate-300 truncate">{street}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] font-mono text-slate-400">UVI: {uvi}</span>
                              <button
                                type="button"
                                className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 flex items-center justify-center transition-colors"
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Selected Points Chips Gallery */}
                {targetFeatures.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto hidden-scrollbar p-1">
                    {targetFeatures.map((feat: any, idx: number) => {
                      const p = feat.properties || feat;
                      const id = p.id || p.tas_nit_id;
                      const code = formatTasNitCode(id, p.tas_nit_code);
                      const street = formatStreetName(p.street_name);
                      const uvi = Number(p.uvi_score || 0).toFixed(3);

                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 rounded-xl px-2.5 py-1.5 transition-all text-xs"
                        >
                          <span className="font-mono font-bold text-cyan-300 text-[11px]">{code}</span>
                          <span className="text-[11px] text-slate-300 truncate max-w-[120px]" title={street}>{street}</span>
                          <span className="text-[10px] font-mono text-slate-400 bg-black/30 px-1 py-0.5 rounded">
                            {uvi}
                          </span>
                          {onRemoveFeature && (
                            <button
                              type="button"
                              onClick={() => onRemoveFeature(id)}
                              className="w-4 h-4 rounded-full flex items-center justify-center text-slate-400 hover:text-red-300 hover:bg-red-500/20 transition-colors ml-0.5 cursor-pointer"
                              title="Hapus dari daftar ekspor"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-4 text-center text-xs text-slate-400 flex flex-col items-center gap-1">
                    <Info size={16} className="text-slate-500 mb-0.5" />
                    <span>Belum ada titik yang dipilih untuk diekspor.</span>
                    <span className="text-[11px] text-slate-500">
                      Klik titik di peta (atau tahan Shift + Klik) atau gunakan pencarian di atas.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Kustomisasi Parameter UVI */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
                <Sliders size={14} className="text-purple-400" />
                <span>2. Parameter & Komposisi Pilar UVI</span>
              </label>
              <span className="text-[11px] text-[var(--text-muted)]">
                Pilih komponen yang disertakan dalam analisis
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {/* Pillar 1 */}
              <button
                type="button"
                onClick={() => setIncludeAccessibility(!includeAccessibility)}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                  includeAccessibility
                    ? "bg-blue-500/15 border-blue-500/40 text-white"
                    : "bg-white/[0.02] border-white/10 text-slate-500 opacity-60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <Activity size={15} />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-semibold">Aksesibilitas</span>
                    <span className="text-[10px] text-[var(--text-muted)]">Halte & POI 400m</span>
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                    includeAccessibility
                      ? "bg-blue-500 border-blue-400 text-white"
                      : "border-white/20 bg-black/40"
                  }`}
                >
                  {includeAccessibility && <Check size={12} />}
                </div>
              </button>

              {/* Pillar 2 */}
              <button
                type="button"
                onClick={() => setIncludePhysical(!includePhysical)}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                  includePhysical
                    ? "bg-green-500/15 border-green-500/40 text-white"
                    : "bg-white/[0.02] border-white/10 text-slate-500 opacity-60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center shrink-0">
                    <Building2 size={15} />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-semibold">Fisik Visual</span>
                    <span className="text-[10px] text-[var(--text-muted)]">AI SegFormer</span>
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                    includePhysical
                      ? "bg-green-500 border-green-400 text-white"
                      : "border-white/20 bg-black/40"
                  }`}
                >
                  {includePhysical && <Check size={12} />}
                </div>
              </button>

              {/* Pillar 3 */}
              <button
                type="button"
                onClick={() => setIncludeSentiment(!includeSentiment)}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                  includeSentiment
                    ? "bg-amber-500/15 border-amber-500/40 text-white"
                    : "bg-white/[0.02] border-white/10 text-slate-500 opacity-60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <MessageSquare size={15} />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-semibold">Sentimen Warga</span>
                    <span className="text-[10px] text-[var(--text-muted)]">IndoBERT NLP</span>
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                    includeSentiment
                      ? "bg-amber-500 border-amber-400 text-white"
                      : "border-white/20 bg-black/40"
                  }`}
                >
                  {includeSentiment && <Check size={12} />}
                </div>
              </button>
            </div>

            {/* Live Recalculation Preview Banner */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shrink-0">
                  <Layers size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-[var(--text-secondary)] font-medium">
                    Live Score Recalculation Preview (Segmen Aktif):
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Original UVI: <strong className="text-white font-mono">{originalUvi.toFixed(3)}</strong>
                    {" → "}
                    Kustom UVI:{" "}
                    <strong className="text-cyan-300 font-mono font-bold text-xs md:text-sm">
                      {currentCustomUvi.toFixed(3)}
                    </strong>
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono font-semibold px-2.5 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                {[includeAccessibility, includePhysical, includeSentiment].filter(Boolean).length} Pilar Aktif
              </span>
            </div>
          </div>

          {/* Section 3: AI Reasoning Toggle */}
          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
              <BrainCircuit size={14} className="text-fuchsia-400" />
              <span>3. Narasi Reasoning AI (CCIA Framework)</span>
            </label>
            <div
              onClick={() => setIncludeAIReasoning(!includeAIReasoning)}
              className="cursor-pointer bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3.5 flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <Sparkles size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">
                    Sertakan Diagnosis & Solusi CCIA
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    Kondisi, Penyebab (Bottleneck), Dampak Spasial, dan Rekomendasi Aksi Intervensi
                  </span>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                  includeAIReasoning
                    ? "bg-purple-600 border-purple-400 text-white"
                    : "border-white/20 bg-black/40"
                }`}
              >
                {includeAIReasoning && <Check size={12} />}
              </div>
            </div>
          </div>

          {/* Feedback Success Message */}
          {exportSuccess && (
            <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs p-3 rounded-2xl flex items-center gap-2 animate-fade-in">
              <Check size={16} className="shrink-0" />
              <span>{exportSuccess}</span>
            </div>
          )}
        </div>

        {/* Modal Footer / Action Buttons */}
        <div className="p-5 md:p-6 border-t border-white/[0.08] shrink-0 bg-white/[0.02] flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] w-full md:w-auto">
            <Info size={14} />
            <span>Target ekspor: <strong className="text-white">{targetFeatures.length} segmen</strong></span>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <button
              type="button"
              disabled={isExporting}
              onClick={() => handleExport("csv")}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/10 transition-all"
            >
              <FileSpreadsheet size={15} className="text-emerald-400" />
              <span>Unduh CSV</span>
            </button>

            <button
              type="button"
              disabled={isExporting}
              onClick={() => handleExport("geojson")}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all"
            >
              <FileCode size={15} />
              <span>Unduh GeoJSON</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
