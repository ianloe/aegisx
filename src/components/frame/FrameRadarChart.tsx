"use client";

import React from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export interface RadarPoint {
  dimension: string;
  score: number;
}

export function FrameRadarChart({ data }: { data: RadarPoint[] }) {
  return (
    <div className="w-full h-64" role="img" aria-label="FRAME five-dimension maturity radar chart">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
          <PolarGrid stroke="#94a3b8" strokeOpacity={0.35} />
          <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: "currentColor" }} />
          <PolarRadiusAxis angle={90} domain={[0, 4]} tickCount={5} tick={{ fontSize: 10 }} />
          <Radar
            name="Maturity (0 to 4)"
            dataKey="score"
            stroke="#0072B2"
            fill="#0072B2"
            fillOpacity={0.28}
            strokeWidth={2}
          />
          <Tooltip
            formatter={(val) => [`${Number(val).toFixed(2)} / 4.00`, "Maturity"]}
            contentStyle={{ fontSize: "12px", borderRadius: "6px" }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
