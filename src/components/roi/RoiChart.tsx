"use client";

import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface QuarterlyRoiPoint {
  quarter: string;
  cost: number;
  measuredBenefit: number;
  assumedOrEstimatedBenefit: number;
}

export function RoiChart({ data, currency }: { data: QuarterlyRoiPoint[]; currency: string }) {
  return (
    <div className="w-full h-72" role="img" aria-label="Quarterly cost versus measured and assumed benefit chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
          <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(val, name) => [`${currency} ${Number(val).toLocaleString()}`, String(name)]}
            contentStyle={{ fontSize: "12px", borderRadius: "6px" }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Bar dataKey="cost" name="Investment Cost" fill="#0072B2" radius={[3, 3, 0, 0]} />
          <Bar dataKey="measuredBenefit" name="Measured Benefit (Verified)" fill="#009E73" radius={[3, 3, 0, 0]} />
          <Bar
            dataKey="assumedOrEstimatedBenefit"
            name="Estimated / Assumed Benefit"
            fill="#E69F00"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
