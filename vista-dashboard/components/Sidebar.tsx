"use client";

import {
  Layers,
  BarChart2,
  Users,
  Sparkles,
  Info,
  Download
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenExport?: () => void;
}

export default function Sidebar({
  activeTab,
  onTabChange,
  onOpenExport
}: SidebarProps) {
  
  return (
    <aside
      style={{ paddingTop: "28px", paddingBottom: "24px" }}
      className="fixed bottom-4 left-[5%] w-[90%] h-[64px] rounded-[32px] md:static md:w-[72px] md:h-full flex flex-row md:flex-col items-center justify-around md:justify-start bg-[rgba(20,25,35,0.85)] md:bg-[rgba(255,255,255,0.03)] backdrop-blur-3xl border border-[rgba(255,255,255,0.1)] md:border-[var(--border-subtle)] md:rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] md:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] z-50 md:order-first shrink-0 transition-all"
    >
      
      {/* Icons Container */}
      <div className="flex flex-row md:flex-col gap-2 md:gap-6 w-full items-center justify-around md:justify-start px-2 md:px-0">


        
        {/* Layer Icon */}
        <button 
          onClick={() => onTabChange(activeTab === "layers" ? "" : "layers")}
          className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-2xl transition-all ${
            activeTab === "layers" 
              ? "bg-gradient-to-b from-[rgba(0,242,254,0.2)] to-[rgba(79,172,254,0.1)] border border-[rgba(0,242,254,0.3)] shadow-[0_0_20px_rgba(0,242,254,0.2)]"
              : "hover:bg-[rgba(255,255,255,0.05)] text-[var(--text-secondary)]"
          }`}
          title="Map Layers"
        >
          <Layers size={20} className={activeTab === "layers" ? "text-[var(--accent-cyan)]" : "text-[var(--text-secondary)]"} />
        </button>

        {/* Chart Icon */}
        <button 
          onClick={() => onTabChange(activeTab === "analytics" ? "" : "analytics")}
          className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-2xl transition-all ${
            activeTab === "analytics" 
              ? "bg-gradient-to-b from-[rgba(0,242,254,0.2)] to-[rgba(79,172,254,0.1)] border border-[rgba(0,242,254,0.3)] shadow-[0_0_20px_rgba(0,242,254,0.2)]"
              : "hover:bg-[rgba(255,255,255,0.05)] text-[var(--text-secondary)]"
          }`}
          title="AI Analytics Dashboard"
        >
          <BarChart2 size={20} className={activeTab === "analytics" ? "text-[var(--accent-cyan)]" : "text-[var(--text-secondary)]"} />
        </button>

        {/* AI Spatial Insight */}
        <button 
          onClick={() => onTabChange(activeTab === "insight" ? "" : "insight")}
          className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-2xl transition-all ${
            activeTab === "insight" 
              ? "bg-gradient-to-b from-[rgba(168,85,247,0.2)] to-[rgba(236,72,153,0.1)] border border-[rgba(168,85,247,0.3)] shadow-[0_0_20px_rgba(168,85,247,0.2)]"
              : "hover:bg-[rgba(255,255,255,0.05)] text-[var(--text-secondary)]"
          }`}
          title="AI-generated Spatial Insight"
        >
          <Sparkles size={20} className={activeTab === "insight" ? "text-purple-400" : "text-[var(--text-secondary)]"} />
        </button>

        {/* Custom Export Report */}
        {onOpenExport && (
          <button 
            onClick={onOpenExport}
            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-2xl transition-all hover:bg-[rgba(255,255,255,0.08)] text-[var(--text-secondary)] hover:text-cyan-300"
            title="Ekspor Laporan Kustom (GeoJSON & CSV)"
          >
            <Download size={20} />
          </button>
        )}

        {/* Info / Methodology Icon */}
        <button 
          onClick={() => onTabChange(activeTab === "info" ? "" : "info")}
          className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-2xl transition-all ${
            activeTab === "info" 
              ? "bg-gradient-to-b from-[rgba(234,179,8,0.2)] to-[rgba(250,204,21,0.1)] border border-[rgba(234,179,8,0.3)] shadow-[0_0_20px_rgba(234,179,8,0.2)]"
              : "hover:bg-[rgba(255,255,255,0.05)] text-[var(--text-secondary)]"
          }`}
          title="Metodologi & Informasi"
        >
          <Info size={20} className={activeTab === "info" ? "text-yellow-400" : "text-[var(--text-secondary)]"} />
        </button>

        {/* Team Profile Icon */}
        <button 
          onClick={() => onTabChange(activeTab === "team" ? "" : "team")}
          className={`w-10 h-10 md:w-12 md:h-12 md:mt-auto flex items-center justify-center rounded-2xl transition-all ${
            activeTab === "team" 
              ? "bg-gradient-to-b from-[rgba(255,255,255,0.2)] to-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.3)] shadow-[0_0_20px_rgba(255,255,255,0.2)] text-white"
              : "hover:bg-[rgba(255,255,255,0.05)] text-[var(--text-secondary)]"
          }`}
          title="Team Profile"
        >
          <Users size={20} className={activeTab === "team" ? "text-white" : "text-[var(--text-secondary)]"} />
        </button>
      </div>
    </aside>
  );
}
