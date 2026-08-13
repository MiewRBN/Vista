"use client";

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface StatsPanelProps {
  stats: {
    avgScore: number;
  } | null;
  selectedFeature: any;
  onCloseDetail: () => void;
}

const barData = [
  { name: "Mon", score: 0.8 },
  { name: "Tue", score: 0.4 },
  { name: "Wed", score: 1.2 },
  { name: "Thu", score: 0.7 },
  { name: "Sat", score: 0.9 },
];
const barColors = ["#00f2fe", "#4facfe", "#84cc16", "#eab308", "#f59e0b"];

export default function StatsPanel({ stats, selectedFeature, onCloseDetail }: StatsPanelProps) {
  // Use real average score from data, or fallback to mockup 0.94
  const avgScore = stats?.avgScore || 0.94;
  
  return (
    <aside className="w-[340px] h-full flex flex-col gap-5 overflow-y-auto hidden-scrollbar pb-10">
      
      {/* 1. Accessibility Score + Progress Bar */}
      <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-2xl border border-[var(--border-subtle)] rounded-3xl p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
        <h3 className="text-sm text-[var(--text-secondary)] mb-1">Accessibility Score</h3>
        <div className="text-4xl font-bold text-white mb-4">
          {avgScore.toFixed(2)}
        </div>
        <div className="w-full h-2.5 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#00f2fe] to-[#4facfe] rounded-full shadow-[0_0_10px_rgba(0,242,254,0.5)]" 
            style={{ width: `${Math.min(avgScore * 100, 100)}%` }} 
          />
        </div>
      </div>

      {/* 2. Accessibility Score Bar Chart */}
      <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-2xl border border-[var(--border-subtle)] rounded-3xl p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] h-[180px] flex flex-col">
        <h3 className="text-sm text-[var(--text-secondary)] mb-4">Accessibility Score</h3>
        <div className="flex-1 w-full h-full -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: "#64748b", fontSize: 12 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: "#64748b", fontSize: 12 }} 
                ticks={[0, 0.4, 0.8, 1.2]} 
              />
              <Tooltip 
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
                contentStyle={{ backgroundColor: "rgba(15,20,35,0.9)", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
              />
              <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Computer Vision Indicators (From SegFormer) */}
      <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-2xl border border-[var(--border-subtle)] rounded-3xl p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] flex flex-col gap-4">
        <h3 className="text-sm text-[var(--text-secondary)] mb-1">Visual Environment Assessment</h3>
        
        {/* Sky View Factor */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-bold text-white">45%</div>
            <div className="text-xs text-[var(--text-secondary)]">Sky View Factor</div>
          </div>
          <div className="w-[60px] h-[60px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[{ value: 45 }, { value: 55 }]} cx="50%" cy="50%" innerRadius={20} outerRadius={28} stroke="none" dataKey="value">
                  <Cell fill="#0ea5e9" style={{ filter: "drop-shadow(0px 0px 4px rgba(14,165,233,0.5))" }} />
                  <Cell fill="rgba(255,255,255,0.05)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Green View Index */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-bold text-white">52%</div>
            <div className="text-xs text-[var(--text-secondary)]">Green View Index</div>
          </div>
          <div className="w-[60px] h-[60px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[{ value: 52 }, { value: 48 }]} cx="50%" cy="50%" innerRadius={20} outerRadius={28} stroke="none" dataKey="value">
                  <Cell fill="#84cc16" style={{ filter: "drop-shadow(0px 0px 4px rgba(132,204,22,0.5))" }} />
                  <Cell fill="rgba(255,255,255,0.05)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Road Width Index */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-bold text-white">30%</div>
            <div className="text-xs text-[var(--text-secondary)]">Road Width Ratio</div>
          </div>
          <div className="w-[60px] h-[60px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[{ value: 30 }, { value: 70 }]} cx="50%" cy="50%" innerRadius={20} outerRadius={28} stroke="none" dataKey="value">
                  <Cell fill="#f59e0b" style={{ filter: "drop-shadow(0px 0px 4px rgba(245,158,11,0.5))" }} />
                  <Cell fill="rgba(255,255,255,0.05)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Street Canyon Enclosure */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-bold text-white">22%</div>
            <div className="text-xs text-[var(--text-secondary)]">Building Enclosure</div>
          </div>
          <div className="w-[60px] h-[60px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[{ value: 22 }, { value: 78 }]} cx="50%" cy="50%" innerRadius={20} outerRadius={28} stroke="none" dataKey="value">
                  <Cell fill="#ef4444" style={{ filter: "drop-shadow(0px 0px 4px rgba(239,68,68,0.5))" }} />
                  <Cell fill="rgba(255,255,255,0.05)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </aside>
  );
}
