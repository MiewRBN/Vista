"use client";

import {
  Layers,
  BarChart2,
  User,
  Settings,
  Sparkles
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Sidebar({
  activeTab,
  onTabChange
}: SidebarProps) {
  
  return (
    <aside className="w-[72px] h-full flex flex-col items-center py-6 bg-[rgba(255,255,255,0.03)] backdrop-blur-2xl border border-[var(--border-subtle)] rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] relative z-10">
      
      {/* Top Icons */}
      <div className="flex flex-col gap-6 w-full items-center">
        
        {/* Layer Icon */}
        <button 
          onClick={() => onTabChange(activeTab === "layers" ? "" : "layers")}
          className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all ${
            activeTab === "layers" 
              ? "bg-gradient-to-b from-[rgba(0,242,254,0.2)] to-[rgba(79,172,254,0.1)] border border-[rgba(0,242,254,0.3)] shadow-[0_0_20px_rgba(0,242,254,0.2)]"
              : "hover:bg-[rgba(255,255,255,0.05)] text-[var(--text-secondary)]"
          }`}
          title="Map Layers"
        >
          <Layers size={22} className={activeTab === "layers" ? "text-[var(--accent-cyan)]" : "text-[var(--text-secondary)]"} />
        </button>

        {/* Chart Icon */}
        <button 
          onClick={() => onTabChange(activeTab === "analytics" ? "" : "analytics")}
          className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all ${
            activeTab === "analytics" 
              ? "bg-gradient-to-b from-[rgba(0,242,254,0.2)] to-[rgba(79,172,254,0.1)] border border-[rgba(0,242,254,0.3)] shadow-[0_0_20px_rgba(0,242,254,0.2)]"
              : "hover:bg-[rgba(255,255,255,0.05)] text-[var(--text-secondary)]"
          }`}
          title="AI Analytics Dashboard"
        >
          <BarChart2 size={22} className={activeTab === "analytics" ? "text-[var(--accent-cyan)]" : "text-[var(--text-secondary)]"} />
        </button>

        {/* AI Spatial Insight */}
        <button 
          onClick={() => onTabChange(activeTab === "insight" ? "" : "insight")}
          className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all ${
            activeTab === "insight" 
              ? "bg-gradient-to-b from-[rgba(168,85,247,0.2)] to-[rgba(236,72,153,0.1)] border border-[rgba(168,85,247,0.3)] shadow-[0_0_20px_rgba(168,85,247,0.2)]"
              : "hover:bg-[rgba(255,255,255,0.05)] text-[var(--text-secondary)]"
          }`}
          title="AI-generated Spatial Insight"
        >
          <Sparkles size={22} className={activeTab === "insight" ? "text-purple-400" : "text-[var(--text-secondary)]"} />
        </button>

        {/* User Icon */}
        <button 
          className="w-12 h-12 flex items-center justify-center rounded-2xl hover:bg-[rgba(255,255,255,0.05)] text-[var(--text-secondary)] transition-all"
          title="User Profile"
        >
          <User size={22} />
        </button>
      </div>

      {/* Bottom Icon */}
      <div className="mt-auto w-full flex justify-center">
        <button className="w-12 h-12 flex items-center justify-center rounded-2xl hover:bg-[rgba(255,255,255,0.05)] text-[var(--text-secondary)] transition-all">
          <Settings size={22} />
        </button>
      </div>
    </aside>
  );
}
