"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Sparkles,
  Activity,
  Target,
  AlertTriangle,
  Lightbulb,
  Send,
  Loader2,
  Bot,
  User,
  Zap,
  ShieldCheck,
  Copy,
  Check,
  RotateCcw,
  Cpu,
  BrainCircuit,
  CheckCircle2,
  FileText
} from "lucide-react";
import { formatStreetName, formatTasNitCode } from "@/app/page";

async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  
  // 1. Try modern navigator.clipboard if available (HTTPS / localhost)
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }

  // 2. Fallback using document.execCommand('copy') for HTTP / local network IP / mobile browsers
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    textArea.setAttribute("readonly", "");
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, 99999);

    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error("Clipboard copy error:", err);
    return false;
  }
}

function renderInlineText(text: string) {
  if (!text) return "";
  const tokens = text.split(/(\*\*[^*]+?\*\*)/g);
  return tokens.map((tok, i) => {
    if (tok.startsWith("**") && tok.endsWith("**")) {
      return (
        <strong key={i} className="font-bold text-white">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    return tok;
  });
}

function FormattedMessage({ content }: { content: string }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 whitespace-pre-wrap">
      {parts.map((part, index) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const raw = part.slice(3, -3);
          const firstLineEnd = raw.indexOf("\n");
          let lang = "";
          let code = raw;
          if (firstLineEnd !== -1) {
            const first = raw.slice(0, firstLineEnd).trim();
            if (/^[a-zA-Z0-9_-]+$/.test(first)) {
              lang = first;
              code = raw.slice(firstLineEnd + 1);
            }
          }
          code = code.trim();

          const handleCopy = async () => {
            const ok = await copyToClipboard(code);
            if (ok) {
              setCopiedIdx(index);
              setTimeout(() => setCopiedIdx(null), 2000);
            }
          };

          return (
            <div
              key={index}
              className="my-2 rounded-xl bg-black/60 border border-white/10 overflow-hidden font-mono"
            >
              <div className="flex items-center justify-between px-3 py-1 bg-white/5 border-b border-white/10 text-[10px] text-gray-400">
                <span className="font-semibold text-purple-300 uppercase tracking-wider">
                  {lang || "code"}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "6px",
                    lineHeight: 1.2,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px"
                  }}
                  className="text-[10px] text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  {copiedIdx === index ? (
                    <>
                      <Check size={11} className="text-emerald-400" />
                      <span className="text-emerald-400 font-sans">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy size={11} />
                      <span className="font-sans">Salin</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 text-[11px] leading-relaxed text-emerald-300 overflow-x-auto selection:bg-purple-500/30">
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        const subTokens = part.split(/(\*\*[^*]+?\*\*)/g);

        return (
          <span key={index}>
            {subTokens.map((tok, i) => {
              if (tok.startsWith("**") && tok.endsWith("**")) {
                return (
                  <strong key={i} className="font-bold text-white">
                    {tok.slice(2, -2)}
                  </strong>
                );
              }
              return tok;
            })}
          </span>
        );
      })}
    </div>
  );
}

interface CCIAOutput {
  condition: string;
  cause: string;
  impact: string;
  action: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AiInsightPanelProps {
  selectedFeature: Record<string, unknown> | null;
}

export default function AiInsightPanel({ selectedFeature }: AiInsightPanelProps) {
  const [ccia, setCcia] = useState<CCIAOutput | null>(null);
  const [source, setSource] = useState<"groq" | "rule-based" | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [lastAnalyzedId, setLastAnalyzedId] = useState<string>("");

  const analyzeSegment = useCallback(async () => {
    if (!selectedFeature) return;

    const featureId = String(selectedFeature.id || selectedFeature.tas_nit_id || "");
    setLoading(true);
    setCcia(null);
    setChatMessages([]);
    setLastAnalyzedId(featureId);

    try {
      const res = await fetch("/api/ai-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segmentData: selectedFeature,
          mode: "analyze",
        }),
      });

      const data = await res.json();

      if (data.ccia) {
        setCcia(data.ccia);
        setSource(data.source || "rule-based");
      }
    } catch {
      setCcia({
        condition: "Gagal memuat analisis. Pastikan koneksi internet stabil.",
        cause: "-",
        impact: "-",
        action: "-",
      });
      setSource("rule-based");
    } finally {
      setLoading(false);
    }
  }, [selectedFeature]);

  const handleChat = useCallback(async () => {
    if (!chatInput.trim() || !selectedFeature || !ccia) return;

    const question = chatInput.trim();
    const currentHistory = chatMessages.slice(-6);
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: question }]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/ai-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segmentData: selectedFeature,
          mode: "chat",
          question,
          previousCCIA: ccia,
          history: currentHistory,
        }),
      });

      const data = await res.json();
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer || "Tidak dapat memproses pertanyaan." },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Maaf, layanan AI sedang tidak tersedia." },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, selectedFeature, ccia, chatMessages]);

  const handleCopyFullReport = async () => {
    if (!ccia || !selectedFeature) return;
    const reportText = `[AI SPATIAL INSIGHT - VISTA BANDUNG]
Segmen: ${formatTasNitCode(selectedFeature.id || selectedFeature.tas_nit_id, selectedFeature.tas_nit_code)} - ${formatStreetName(selectedFeature.street_name)}
Halte Terdekat: ${String(selectedFeature.nearest_stop || "-")} (${Number(selectedFeature.avg_distance_to_stop || 0).toFixed(0)}m)

1. KONDISI (CONDITION)
${ccia.condition}

2. INDIKATOR UTAMA (CAUSE)
${ccia.cause}

3. DAMPAK (IMPACT)
${ccia.impact}

4. REKOMENDASI (ACTION)
${ccia.action}`;

    const ok = await copyToClipboard(reportText);
    if (ok) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  // ── No feature selected state ──
  if (!selectedFeature) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4 py-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 via-fuchsia-500/15 to-pink-500/20 border border-purple-500/30 flex items-center justify-center shadow-[0_0_25px_rgba(168,85,247,0.2)]">
          <Sparkles size={28} className="text-purple-300 animate-pulse" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white mb-2">Pilih Segmen di Peta</h4>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-[250px]">
            Klik salah satu titik atau garis koridor di peta, lalu tekan tombol <strong className="text-purple-300">Analisis AI</strong> untuk menghasilkan diagnosis cerdas.
          </p>
        </div>
      </div>
    );
  }

  const currentFeatureId = String(selectedFeature.id || selectedFeature.tas_nit_id || "");
  const needsReanalysis = currentFeatureId !== lastAnalyzedId;

  return (
    <div className="flex-1 flex flex-col gap-3.5 overflow-hidden">
      
      {/* ── 1. SEGMENT HEADER CARD ── */}
      <div 
        style={{ padding: "18px 16px", boxSizing: "border-box" }}
        className="dashboard-card bg-[rgba(20,25,35,0.85)] backdrop-blur-2xl border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] shrink-0 flex flex-col gap-3.5 w-full box-border"
      >
        {/* Badges Row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span 
            style={{
              fontSize: "11px",
              fontWeight: 700,
              fontFamily: "monospace",
              padding: "4px 10px",
              lineHeight: 1.2,
              borderRadius: "8px",
              background: "rgba(168,85,247,0.15)",
              color: "#c084fc",
              border: "1.5px solid rgba(168,85,247,0.45)",
              letterSpacing: "0.5px",
              boxShadow: "0 0 10px rgba(168,85,247,0.18)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            {formatTasNitCode(selectedFeature.id || selectedFeature.tas_nit_id, selectedFeature.tas_nit_code)}
          </span>

          {source && !needsReanalysis && (
            <span 
              style={{
                fontSize: "10px",
                fontWeight: 600,
                padding: "4px 10px",
                lineHeight: 1.2,
                borderRadius: "8px",
                background: source === "groq" ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
                color: source === "groq" ? "#34d399" : "#fbbf24",
                border: source === "groq" ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(245,158,11,0.3)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px"
              }}
            >
              {source === "groq" ? <Zap size={11} /> : <ShieldCheck size={11} />}
              {source === "groq" ? "Groq LLaMA-3" : "Rule-Based Engine"}
            </span>
          )}
        </div>

        {/* Street Name & Subtitle */}
        <div className="flex flex-col gap-1.5">
          <h3 className="text-base md:text-[17px] font-bold text-white leading-snug tracking-tight break-words">
            {formatStreetName(selectedFeature.street_name)}
          </h3>

          <p className="text-xs text-[var(--text-secondary)] flex items-center gap-2 font-medium">
            <span>📍 {String(selectedFeature.nearest_stop || "Halte")}</span>
            <span className="text-white/20">•</span>
            <span className="text-purple-300 font-semibold">{Number(selectedFeature.avg_distance_to_stop || 0).toFixed(0)}m</span>
          </p>
        </div>
      </div>

      {/* ── 2. TRIGGER ANALYSIS BUTTON ── */}
      {(!ccia || needsReanalysis) && !loading && (
        <button
          type="button"
          onClick={analyzeSegment}
          style={{ padding: "13px 18px" }}
          className="w-full rounded-2xl bg-gradient-to-r from-purple-600/20 via-fuchsia-600/15 to-purple-600/20 hover:from-purple-600/35 hover:via-fuchsia-600/25 hover:to-purple-600/35 border border-purple-500/35 hover:border-purple-400/60 text-white text-[13px] font-bold flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.3)] active:scale-[0.98] transition-all duration-300 cursor-pointer shrink-0 group"
        >
          <div className="w-6 h-6 rounded-lg bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
            <Sparkles size={13} className="text-purple-300" />
          </div>
          <span className="tracking-wide">{needsReanalysis ? "Analisis Segmen Baru Ini" : "Mulai Analisis AI Sekarang"}</span>
        </button>
      )}

      {/* ── 3. AI THINKING LOADING STATE ── */}
      {loading && (
        <div 
          style={{ padding: "32px 20px", boxSizing: "border-box" }}
          className="flex-1 flex flex-col items-center justify-center gap-4 bg-[rgba(20,25,35,0.85)] backdrop-blur-2xl rounded-2xl border border-[rgba(255,255,255,0.08)] shadow-[0_8px_32px_rgba(0,0,0,0.37)]"
        >
          {/* Animated AI Brain Orb */}
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 opacity-30 animate-ping" />
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600/30 via-fuchsia-600/20 to-pink-600/30 border border-purple-400/40 flex items-center justify-center shadow-[0_0_25px_rgba(168,85,247,0.4)] backdrop-blur-md">
              <BrainCircuit size={28} className="text-purple-300 animate-pulse" />
            </div>
          </div>

          {/* Thinking Status */}
          <div className="text-center flex flex-col items-center gap-1.5">
            <div className="flex items-center justify-center gap-2 text-sm font-bold text-white">
              <Loader2 size={15} className="animate-spin text-purple-400" />
              <span>AI Sedang Berpikir...</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] max-w-[220px] leading-relaxed">
              Menganalisis data spasial koridor dan merumuskan diagnosis CCIA...
            </p>
          </div>
        </div>
      )}

      {/* ── 4. CCIA RESULTS DISPLAY ── */}
      {ccia && !needsReanalysis && !loading && (
        <div className="flex-1 overflow-y-auto hidden-scrollbar flex flex-col gap-3.5 pr-1">
          
          {/* Action Tools: Copy & Reanalyze */}
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Diagnosis CCIA
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyFullReport}
                style={{
                  padding: "4px 10px",
                  borderRadius: "8px",
                  lineHeight: 1.2,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px"
                }}
                className="text-[11px] font-semibold text-purple-300 hover:text-white bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 transition-all cursor-pointer"
                title="Salin Laporan CCIA"
              >
                {copiedAll ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedAll ? "Tersalin!" : "Salin Laporan"}</span>
              </button>
              <button
                type="button"
                onClick={analyzeSegment}
                style={{
                  padding: "4px 8px",
                  borderRadius: "8px",
                  lineHeight: 1.2,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px"
                }}
                className="text-[11px] font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
                title="Analisis Ulang"
              >
                <RotateCcw size={12} />
              </button>
            </div>
          </div>

          {/* 1. KONDISI (Condition) Card */}
          <div style={{ padding: "14px 16px", boxSizing: "border-box" }} className="bg-[rgba(168,85,247,0.06)] border border-purple-500/25 rounded-2xl flex flex-col gap-2 transition-colors hover:border-purple-500/40">
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-400 uppercase tracking-wider">
              <Activity size={14} />
              <span>1. Kondisi Eksisting</span>
            </div>
            <p className="text-xs text-slate-200 leading-[1.7] whitespace-pre-wrap">
              {renderInlineText(ccia.condition)}
            </p>
          </div>

          {/* 2. INDIKATOR UTAMA (Cause) Card */}
          <div style={{ padding: "14px 16px", boxSizing: "border-box" }} className="bg-[rgba(6,182,212,0.06)] border border-cyan-500/25 rounded-2xl flex flex-col gap-2 transition-colors hover:border-cyan-500/40">
            <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 uppercase tracking-wider">
              <Target size={14} />
              <span>2. Indikator Kunci (Cause)</span>
            </div>
            <p className="text-xs text-slate-200 leading-[1.7] whitespace-pre-wrap">
              {renderInlineText(ccia.cause)}
            </p>
          </div>

          {/* 3. DAMPAK (Impact) Card */}
          <div style={{ padding: "14px 16px", boxSizing: "border-box" }} className="bg-[rgba(239,68,68,0.06)] border border-rose-500/25 rounded-2xl flex flex-col gap-2 transition-colors hover:border-rose-500/40">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400 uppercase tracking-wider">
              <AlertTriangle size={14} />
              <span>3. Dampak Spasial</span>
            </div>
            <p className="text-xs text-slate-200 leading-[1.7] whitespace-pre-wrap">
              {renderInlineText(ccia.impact)}
            </p>
          </div>

          {/* 4. REKOMENDASI (Action) Card */}
          <div style={{ padding: "14px 16px", boxSizing: "border-box" }} className="bg-[rgba(245,158,11,0.06)] border border-amber-500/25 rounded-2xl flex flex-col gap-2 transition-colors hover:border-amber-500/40">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
              <Lightbulb size={14} />
              <span>4. Rekomendasi Intervensi TOD</span>
            </div>
            <p className="text-xs text-slate-200 leading-[1.7] whitespace-pre-wrap">
              {renderInlineText(ccia.action)}
            </p>
          </div>

          {/* Chat Q&A Interaction History */}
          {chatMessages.length > 0 && (
            <div className="flex flex-col gap-3 pt-3 border-t border-[rgba(255,255,255,0.08)]">
              <div className="text-[10px] font-bold text-purple-300 uppercase tracking-wider px-1 flex items-center gap-1.5">
                <Bot size={13} />
                <span>Diskusi Lanjutan</span>
              </div>
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot size={13} className="text-purple-300" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-purple-600/30 text-purple-100 border border-purple-500/30 whitespace-pre-wrap"
                        : "bg-white/[0.04] text-slate-200 border border-white/10"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <FormattedMessage content={msg.content} />
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <User size={13} className="text-cyan-300" />
                    </div>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-2 items-center text-xs text-purple-300 bg-purple-500/10 border border-purple-500/20 p-2.5 rounded-xl">
                  <Loader2 size={14} className="text-purple-400 animate-spin" />
                  <span className="text-[11px] font-medium animate-pulse">Mengetik analisis tambahan...</span>
                </div>
              )}
            </div>
          )}

          {/* Footnote */}
          <p className="text-[10px] text-[var(--text-muted)] pt-2 border-t border-[rgba(255,255,255,0.06)] leading-relaxed px-1">
            {source === "groq"
              ? "⚡ Powered by Groq LLaMA-3 (120B). Insight dikontekstualisasikan dari metrik VISTA."
              : "🛡️ Dihasilkan oleh Rule-Based CCIA Engine VISTA Bandung."}
          </p>
        </div>
      )}

      {/* ── 5. CHAT INPUT ── */}
      {ccia && !needsReanalysis && !loading && (
        <div className="shrink-0 flex gap-2 items-center pt-1">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleChat();
              }
            }}
            placeholder="Tanya rekomendasi lebih spesifik..."
            style={{ paddingLeft: "16px", paddingRight: "16px" }}
            className="flex-1 h-11 rounded-2xl bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] hover:border-[rgba(255,255,255,0.2)] text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 focus:bg-[rgba(20,25,35,0.95)] transition-all"
          />
          <button
            type="button"
            onClick={handleChat}
            disabled={!chatInput.trim() || chatLoading}
            className="w-11 h-11 rounded-2xl bg-purple-500/20 hover:bg-purple-500/35 border border-purple-500/35 flex items-center justify-center text-purple-300 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-md shrink-0"
            title="Kirim Pertanyaan"
          >
            <Send size={15} />
          </button>
        </div>
      )}

    </div>
  );
}
