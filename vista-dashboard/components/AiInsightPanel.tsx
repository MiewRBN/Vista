"use client";

import { useState, useCallback } from "react";
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
} from "lucide-react";
import { formatStreetName, formatTasNitCode } from "@/app/page";

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

  // Pisahkan blok kode ```...```
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

          const handleCopy = () => {
            navigator.clipboard.writeText(code);
            setCopiedIdx(index);
            setTimeout(() => setCopiedIdx(null), 2000);
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
                  className="flex items-center gap-1 text-[10px] text-gray-300 hover:text-white transition-colors cursor-pointer py-0.5"
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

        // Teks biasa di luar blok kode
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

  // ── No feature selected state ──
  if (!selectedFeature) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
          <Sparkles size={28} className="text-purple-400" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white mb-1.5">AI Spatial Insight</h4>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-[240px]">
            Klik segmen jalan di peta terlebih dahulu, lalu tekan tombol <strong className="text-purple-300">Analisis</strong> untuk mendapatkan insight berbasis AI.
          </p>
        </div>
      </div>
    );
  }

  const currentFeatureId = String(selectedFeature.id || selectedFeature.tas_nit_id || "");
  const needsReanalysis = currentFeatureId !== lastAnalyzedId;

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
      {/* Segment Header */}
      <div className="bg-[rgba(168,85,247,0.08)] rounded-2xl border border-purple-500/20 shrink-0" style={{ padding: "14px 16px" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-extrabold font-mono px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-400/30">
            {formatTasNitCode(selectedFeature.id || selectedFeature.tas_nit_id, selectedFeature.tas_nit_code)}
          </span>
          {source && !needsReanalysis && (
            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
              source === "groq"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
            }`}>
              {source === "groq" ? <Zap size={10} /> : <ShieldCheck size={10} />}
              {source === "groq" ? "Groq AI" : "Rule-Based"}
            </span>
          )}
        </div>
        <h4 className="text-sm font-bold text-white leading-snug">
          {formatStreetName(selectedFeature.street_name)}
        </h4>
        <p className="text-[11px] text-[var(--text-muted)] mt-1">
          🚏 {String(selectedFeature.nearest_stop || "N/A")} • {Number(selectedFeature.avg_distance_to_stop || 0).toFixed(0)}m
        </p>
      </div>

      {/* Analyze Button */}
      {(!ccia || needsReanalysis) && !loading && (
        <button
          onClick={analyzeSegment}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 active:scale-[0.98] shrink-0"
        >
          <Sparkles size={16} />
          {needsReanalysis ? "Analisis Segmen Baru" : "Analisis dengan AI"}
        </button>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <Loader2 size={24} className="text-purple-400 animate-spin" />
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)] animate-pulse">
            AI sedang menganalisis kawasan...
          </p>
        </div>
      )}

      {/* CCIA Results */}
      {ccia && !needsReanalysis && !loading && (
        <div className="flex-1 overflow-y-auto hidden-scrollbar flex flex-col gap-4 pr-1">
          {/* Condition */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-400 uppercase tracking-wider mb-2">
              <Activity size={14} /> Kondisi
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-[1.7] whitespace-pre-wrap">{renderInlineText(ccia.condition)}</p>
          </div>

          {/* Cause / Contributing Indicator */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-400 uppercase tracking-wider mb-2">
              <Target size={14} /> Indikator Utama
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-[1.7] whitespace-pre-wrap">{renderInlineText(ccia.cause)}</p>
          </div>

          {/* Impact */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-400 uppercase tracking-wider mb-2">
              <AlertTriangle size={14} /> Dampak
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-[1.7] whitespace-pre-wrap">{renderInlineText(ccia.impact)}</p>
          </div>

          {/* Action */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2">
              <Lightbulb size={14} /> Rekomendasi
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-[1.7] whitespace-pre-wrap">{renderInlineText(ccia.action)}</p>
          </div>

          {/* Chat Messages */}
          {chatMessages.length > 0 && (
            <div className="flex flex-col gap-3 pt-3 border-t border-[rgba(255,255,255,0.08)]">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot size={14} className="text-purple-400" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-purple-600/30 text-purple-100 border border-purple-500/20 whitespace-pre-wrap"
                        : "bg-[rgba(255,255,255,0.04)] text-[var(--text-secondary)] border border-[rgba(255,255,255,0.06)]"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <FormattedMessage content={msg.content} />
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <User size={14} className="text-cyan-400" />
                    </div>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-2 items-center">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                    <Loader2 size={14} className="text-purple-400 animate-spin" />
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] animate-pulse">Mengetik...</span>
                </div>
              )}
            </div>
          )}

          {/* Footnote */}
          <p className="text-[10px] text-[var(--text-muted)] pt-2 border-t border-[rgba(255,255,255,0.06)] leading-relaxed">
            {source === "groq"
              ? "Powered by Groq — GPT-OSS 120B. Insight diinterpretasikan dari data VISTA terstruktur."
              : "Insight dihasilkan oleh Rule-Based CCIA Engine. Untuk interpretasi LLM, tambahkan GROQ_API_KEY."}
          </p>
        </div>
      )}

      {/* Chat Input */}
      {ccia && !needsReanalysis && !loading && (
        <div className="shrink-0 flex gap-2 items-center">
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
            placeholder="Tanya lebih lanjut..."
            className="flex-1 h-10 px-4 rounded-xl bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
          />
          <button
            onClick={handleChat}
            disabled={!chatInput.trim() || chatLoading}
            className="w-10 h-10 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/30 flex items-center justify-center text-purple-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
