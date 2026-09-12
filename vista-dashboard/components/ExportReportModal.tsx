"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  X,
  Check,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-2xl bg-[rgba(15,20,35,0.96)] border border-[rgba(255,255,255,0.14)] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.8)] flex flex-col max-h-[88vh] overflow-hidden select-none"
        style={{ boxSizing: "border-box" }}
      >
        {/* Header */}
        <div 
          style={{ padding: "16px 20px", boxSizing: "border-box" }}
          className="flex items-center justify-between border-b border-white/[0.08] shrink-0 bg-white/[0.02]"
        >
          <div className="flex flex-col">
            <h3 className="text-base font-bold text-white leading-tight">
              Ekspor Laporan Kustom VISTA
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ width: "30px", height: "30px", borderRadius: "8px" }}
            className="flex items-center justify-center text-[var(--text-secondary)] hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="Tutup Modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div 
          style={{ padding: "18px 20px", boxSizing: "border-box" }}
          className="flex-1 overflow-y-auto hidden-scrollbar flex flex-col gap-4.5"
        >
          {/* Section 1: Cakupan Segmen */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                1. Cakupan Segmen TAS-Nit
              </label>
              {selectedFeatures.length > 0 && (
                <span 
                  style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "11px" }}
                  className="font-mono text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 font-semibold"
                >
                  {selectedFeatures.length} titik aktif dalam seleksi
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Option 1: Titik Terpilih (Multi-Select) */}
              <button
                type="button"
                onClick={() => setScope("selected")}
                style={{ padding: "10px 12px", borderRadius: "12px", boxSizing: "border-box" }}
                className={`flex flex-col items-start border text-left transition-all cursor-pointer ${
                  scope === "selected"
                    ? "bg-cyan-500/15 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                    : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]"
                }`}
              >
                <span className="text-xs font-bold text-white mb-1">Titik Terpilih</span>
                <span className="text-[11px] text-[var(--text-secondary)] leading-snug truncate w-full">
                  Pilihan kustom
                </span>
                <span className="text-[10.5px] font-mono text-cyan-300 mt-2 font-bold">
                  {selectedFeatures.length > 0 ? `${selectedFeatures.length} Titik` : (sfProps.street_name ? "1 Titik" : "0 Titik")}
                </span>
              </button>

              {/* Option 2: Segmen Tunggal Aktif */}
              <button
                type="button"
                onClick={() => setScope("single")}
                style={{ padding: "10px 12px", borderRadius: "12px", boxSizing: "border-box" }}
                className={`flex flex-col items-start border text-left transition-all cursor-pointer ${
                  scope === "single"
                    ? "bg-cyan-500/15 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                    : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]"
                }`}
              >
                <span className="text-xs font-bold text-white mb-1">Segmen Aktif</span>
                <span className="text-[11px] text-[var(--text-secondary)] leading-snug truncate w-full">
                  {sfProps.street_name ? formatStreetName(sfProps.street_name) : "1 Segmen"}
                </span>
                <span className="text-[10.5px] font-mono text-cyan-300 mt-2 font-semibold">1 Segmen</span>
              </button>

              {/* Option 3: Seluruh Koridor Jalan */}
              <button
                type="button"
                onClick={() => setScope("corridor")}
                disabled={!sfProps.street_name}
                style={{ padding: "10px 12px", borderRadius: "12px", boxSizing: "border-box" }}
                className={`flex flex-col items-start border text-left transition-all ${
                  !sfProps.street_name
                    ? "opacity-40 cursor-not-allowed bg-white/[0.01] border-white/5"
                    : scope === "corridor"
                    ? "bg-cyan-500/15 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)] cursor-pointer"
                    : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] cursor-pointer"
                }`}
              >
                <span className="text-xs font-bold text-white mb-1">Koridor Jalan</span>
                <span className="text-[11px] text-[var(--text-secondary)] leading-snug truncate w-full">
                  Ruas yang sama
                </span>
                <span className="text-[10.5px] font-mono text-cyan-300 mt-2 font-semibold">
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
                style={{ padding: "10px 12px", borderRadius: "12px", boxSizing: "border-box" }}
                className={`flex flex-col items-start border text-left transition-all cursor-pointer ${
                  scope === "all"
                    ? "bg-cyan-500/15 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                    : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]"
                }`}
              >
                <span className="text-xs font-bold text-white mb-1">Seluruh Kota</span>
                <span className="text-[11px] text-[var(--text-secondary)] leading-snug truncate w-full">
                  Semua titik TAS-Nit
                </span>
                <span className="text-[10.5px] font-mono text-cyan-300 mt-2 font-semibold">
                  {allFeatures.length.toLocaleString()} Segmen
                </span>
              </button>
            </div>

            {/* Selected Segments Manager (when scope === "selected") */}
            {scope === "selected" && (
              <div 
                style={{ padding: "12px 14px", borderRadius: "12px", boxSizing: "border-box" }}
                className="bg-white/[0.03] border border-cyan-500/30 flex flex-col gap-2.5 animate-in fade-in duration-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Kurasi Titik Ekspor ({targetFeatures.length})
                  </span>
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
                        style={{ padding: "5px 10px", borderRadius: "8px", boxSizing: "border-box" }}
                        className="text-[11px] font-semibold text-cyan-300 hover:text-white bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus size={12} />
                        <span>Tambah Koridor Ini ({allFeatures.filter((f) => (f.properties?.street_name || f.street_name) === sfProps.street_name).length})</span>
                      </button>
                    )}
                    {onClearFeatures && targetFeatures.length > 0 && (
                      <button
                        type="button"
                        onClick={onClearFeatures}
                        style={{ padding: "5px 10px", borderRadius: "8px", boxSizing: "border-box" }}
                        className="text-[11px] font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Kosongkan Pilihan"
                      >
                        <Trash2 size={12} />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Divider Garis Tengah Simetris */}
                <div className="w-full h-[1px] bg-white/[0.08]" />

                {/* Live Search to Add Points Directly */}
                <div className="relative">
                  <div className="relative flex items-center">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                      <Search size={14} />
                    </div>
                    <input
                      type="text"
                      value={pointSearchQuery}
                      onChange={(e) => setPointSearchQuery(e.target.value)}
                      placeholder="Cari & tambah titik TAS-Nit (kode atau nama jalan)..."
                      style={{ paddingLeft: "36px", paddingRight: "14px", paddingTop: "8px", paddingBottom: "8px", borderRadius: "10px", boxSizing: "border-box" }}
                      className="w-full bg-black/40 border border-white/10 hover:border-white/20 focus:border-cyan-500/50 text-xs text-white placeholder:text-slate-500 outline-none transition-all shadow-inner"
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
                          style={{ padding: "4px 8px", borderRadius: "8px" }}
                          className="flex items-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 transition-all text-xs"
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
                  <div className="py-3 text-center text-xs text-slate-400 flex flex-col items-center gap-1">
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
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                2. Parameter & Komposisi Pilar UVI
              </label>
              <span className="text-[11px] text-[var(--text-muted)]">
                Pilih komponen yang disertakan dalam analisis
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Pillar 1 */}
              <button
                type="button"
                onClick={() => setIncludeAccessibility(!includeAccessibility)}
                style={{ padding: "10px 14px", borderRadius: "12px", boxSizing: "border-box" }}
                className={`flex items-center justify-between border transition-all cursor-pointer ${
                  includeAccessibility
                    ? "bg-blue-500/15 border-blue-500/40 text-white shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                    : "bg-white/[0.02] border-white/10 text-slate-500 opacity-60"
                }`}
              >
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold">Aksesibilitas TOD</span>
                  <span className="text-[10px] text-[var(--text-muted)]">Halte & POI 400m</span>
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
                style={{ padding: "10px 14px", borderRadius: "12px", boxSizing: "border-box" }}
                className={`flex items-center justify-between border transition-all cursor-pointer ${
                  includePhysical
                    ? "bg-green-500/15 border-green-500/40 text-white shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                    : "bg-white/[0.02] border-white/10 text-slate-500 opacity-60"
                }`}
              >
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold">Lingkungan Fisik</span>
                  <span className="text-[10px] text-[var(--text-muted)]">AI SegFormer</span>
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
                style={{ padding: "10px 14px", borderRadius: "12px", boxSizing: "border-box" }}
                className={`flex items-center justify-between border transition-all cursor-pointer ${
                  includeSentiment
                    ? "bg-amber-500/15 border-amber-500/40 text-white shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                    : "bg-white/[0.02] border-white/10 text-slate-500 opacity-60"
                }`}
              >
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold">Sentimen Warga</span>
                  <span className="text-[10px] text-[var(--text-muted)]">IndoBERT NLP</span>
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
            <div 
              style={{ padding: "10px 14px", borderRadius: "12px", boxSizing: "border-box" }}
              className="bg-white/[0.03] border border-white/[0.08] flex items-center justify-between gap-3"
            >
              <div className="flex flex-col">
                <span className="text-xs text-[var(--text-secondary)] font-medium leading-tight">
                  Live Score Recalculation Preview (Segmen Aktif):
                </span>
                <span className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Original UVI: <strong className="text-white font-mono">{originalUvi.toFixed(3)}</strong>
                  {" → "}
                  Kustom UVI:{" "}
                  <strong className="text-cyan-300 font-mono font-bold text-xs">
                    {currentCustomUvi.toFixed(3)}
                  </strong>
                </span>
              </div>
              <span 
                style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "10.5px" }}
                className="font-mono font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shrink-0"
              >
                {[includeAccessibility, includePhysical, includeSentiment].filter(Boolean).length} Pilar Aktif
              </span>
            </div>
          </div>

          {/* Section 3: AI Reasoning Toggle */}
          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              3. Narasi Reasoning AI (CCIA Framework)
            </label>
            <div
              onClick={() => setIncludeAIReasoning(!includeAIReasoning)}
              style={{ padding: "10px 14px", borderRadius: "12px", boxSizing: "border-box" }}
              className="cursor-pointer bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] flex items-center justify-between transition-all"
            >
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">
                  Sertakan Diagnosis & Solusi CCIA
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  Kondisi, Penyebab (Bottleneck), Dampak Spasial, dan Rekomendasi Aksi Intervensi
                </span>
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
            <div 
              style={{ padding: "10px 14px", borderRadius: "12px", boxSizing: "border-box" }}
              className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in"
            >
              <Check size={15} className="shrink-0" />
              <span>{exportSuccess}</span>
            </div>
          )}
        </div>

        {/* Modal Footer / Action Buttons */}
        <div 
          style={{ padding: "14px 20px", boxSizing: "border-box" }}
          className="border-t border-white/[0.08] shrink-0 bg-white/[0.02] flex flex-col sm:flex-row items-center justify-between gap-3"
        >
          <div className="text-xs text-[var(--text-secondary)] w-full sm:w-auto">
            Target ekspor: <strong className="text-white font-mono">{targetFeatures.length} segmen</strong>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              disabled={isExporting}
              onClick={() => handleExport("csv")}
              style={{ padding: "7px 16px", borderRadius: "8px", boxSizing: "border-box" }}
              className="flex-1 sm:flex-initial flex items-center justify-center text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/10 transition-all cursor-pointer"
            >
              Unduh CSV
            </button>

            <button
              type="button"
              disabled={isExporting}
              onClick={() => handleExport("geojson")}
              style={{ padding: "7px 18px", borderRadius: "8px", boxSizing: "border-box" }}
              className="flex-1 sm:flex-initial flex items-center justify-center text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_14px_rgba(6,182,212,0.35)] transition-all cursor-pointer"
            >
              Unduh GeoJSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
