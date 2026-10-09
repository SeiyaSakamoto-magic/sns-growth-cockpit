import { useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell,
} from "recharts";
import type { Reel } from "../lib/types";
import { compact, pct } from "../lib/format";

type Metric = "spread" | "engagement" | "views";

const META: Record<Metric, { label: string; get: (r: Reel) => number | null; fmt: (v: number) => string }> = {
  spread: { label: "拡散率", get: (r) => r.spread_rate, fmt: (v) => v.toFixed(2) + "×" },
  engagement: { label: "反応率", get: (r) => r.engagement_rate, fmt: (v) => pct(v) },
  views: { label: "再生数", get: (r) => r.views, fmt: (v) => compact(v) },
};

const PER_LINE = 11;
const MAX_LINES = 2;

function wrap(text: string): string[] {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  const lines: string[] = [];
  let rest = clean;
  for (let i = 0; i < MAX_LINES && rest.length; i++) {
    if (i === MAX_LINES - 1 && rest.length > PER_LINE) {
      lines.push(rest.slice(0, PER_LINE - 1) + "…");
      rest = "";
    } else {
      lines.push(rest.slice(0, PER_LINE));
      rest = rest.slice(PER_LINE);
    }
  }
  return lines;
}

function YTick({ x, y, payload }: any) {
  const lines = wrap(payload.value);
  const startDy = lines.length > 1 ? -2 : 4;
  return (
    <text x={x} y={y} textAnchor="end" fontSize={11} fill="var(--text-2)">
      {lines.map((ln, i) => (
        <tspan key={i} x={x} dy={i === 0 ? startDy : 13}>{ln}</tspan>
      ))}
    </text>
  );
}

export default function PostBarChart({ reels, onOpen }: { reels: Reel[]; onOpen: (r: Reel) => void }) {
  const [metric, setMetric] = useState<Metric>("spread");
  const m = META[metric];

  const rows = reels
    .filter((r) => m.get(r) != null)
    .map((r) => ({
      shortcode: r.shortcode,
      label: (r.caption_excerpt || r.shortcode).replace(/\s+/g, " "),
      value: m.get(r) as number,
    }))
    .sort((a, b) => b.value - a.value);

  const avg = rows.length ? rows.reduce((s, r) => s + r.value, 0) / rows.length : 0;
  const openByShortcode = (sc?: string) => { const r = reels.find((x) => x.shortcode === sc); if (r) onOpen(r); };

  return (
    <div>
      <div className="row between" style={{ marginBottom: 12 }}>
        <h2 className="sec-h" style={{ margin: 0 }}>企画別パフォーマンス</h2>
        <div className="segmented">
          {(Object.keys(META) as Metric[]).map((k) => (
            <button key={k} className={metric === k ? "active" : ""} onClick={() => setMetric(k)}>
              {META[k].label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ width: "100%", height: Math.max(240, rows.length * 56) }}>
        <ResponsiveContainer>
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 60, left: 4, bottom: 4 }} barCategoryGap="28%">
            <CartesianGrid stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false}
              tickFormatter={(v) => (metric === "views" ? compact(v) : metric === "engagement" ? `${(v * 100).toFixed(0)}%` : v.toFixed(1))} />
            <YAxis type="category" dataKey="label" width={150} tick={<YTick />} axisLine={false} tickLine={false} interval={0} />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 13 }}
              labelFormatter={(v) => String(v)}
              formatter={(v: number) => [m.fmt(v), m.label]}
            />
            <ReferenceLine x={avg} stroke="var(--text-3)" strokeDasharray="4 4"
              label={{ value: `平均 ${m.fmt(avg)}`, fontSize: 11, fill: "var(--text-3)", position: "right" }} />
            <Bar dataKey="value" radius={[0, 5, 5, 0]} barSize={20}
              onClick={(d: any) => openByShortcode(d?.payload?.shortcode)} cursor="pointer">
              {rows.map((r) => (
                <Cell key={r.shortcode} fill={r.value >= avg ? "var(--data-1)" : "var(--border-strong)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="tiny" style={{ marginTop: 6 }}>バーをクリックすると、その場で動画が再生されます。</div>
    </div>
  );
}
