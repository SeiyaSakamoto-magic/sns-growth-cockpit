import { useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import type { TrendPoint } from "../lib/types";
import { shortDate, compact } from "../lib/format";

function TrendTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", fontSize: 13, maxWidth: 250, boxShadow: "var(--shadow)" }}>
      <div style={{ fontWeight: 700, marginBottom: 3, lineHeight: 1.45 }}>{p.caption || "（キャプションなし）"}</div>
      <div style={{ color: "var(--text-3)", fontSize: 12, marginBottom: 7 }}>{p.fulldate}</div>
      <div style={{ color: "var(--text)", marginBottom: 2 }}>▶ 再生数 <b>{compact(p.views)}</b></div>
      <div style={{ color: "var(--accent-text)", marginBottom: 2 }}>拡散率 <b>{p.spread}×</b></div>
      <div style={{ color: "var(--warn-text)" }}>反応率 <b>{p.engagement}%</b></div>
      <div style={{ color: "var(--text-3)", fontSize: 11, marginTop: 7 }}>クリックで動画を再生 ▶</div>
    </div>
  );
}

type LineMetric = "spread" | "engagement";

export default function TrendChart({ trend, follower, onOpen }: { trend: TrendPoint[]; follower: number | null; onOpen: (shortcode: string) => void }) {
  const [metric, setMetric] = useState<LineMetric>("spread");

  const rows = [...trend]
    .sort((a, b) => (a.posted_at || "").localeCompare(b.posted_at || ""))
    .map((p) => ({
      shortcode: p.shortcode,
      date: shortDate(p.posted_at),
      fulldate: p.posted_at ? new Date(p.posted_at).toLocaleDateString("ja-JP") : "—",
      caption: p.caption_excerpt,
      views: p.views ?? 0,
      spread: p.spread_rate != null ? +p.spread_rate.toFixed(2) : null,
      engagement: p.engagement_rate != null ? +(p.engagement_rate * 100).toFixed(1) : null,
    }));

  if (rows.length === 0) return <div className="empty">推移データがありません</div>;

  const open = (d: any) => { const sc = d?.payload?.shortcode || d?.shortcode; if (sc) onOpen(sc); };
  const lineColor = metric === "spread" ? "var(--data-2)" : "var(--warn)";
  const lineName = metric === "spread" ? "拡散率(×)" : "反応率(%)";
  const fmtR = (v: number) => (metric === "spread" ? `${v}×` : `${v}%`);

  return (
    <div>
      <div className="row" style={{ marginBottom: 10, justifyContent: "flex-end" }}>
        <div className="segmented">
          <button className={metric === "spread" ? "active" : ""} onClick={() => setMetric("spread")}>拡散率</button>
          <button className={metric === "engagement" ? "active" : ""} onClick={() => setMetric("engagement")}>反応率</button>
        </div>
      </div>
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="v" tick={{ fontSize: 12, fill: "var(--text-3)" }} axisLine={false} tickLine={false} tickFormatter={(v) => compact(v)} />
            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 12, fill: "var(--text-3)" }} axisLine={false} tickLine={false} tickFormatter={fmtR} />
            <Tooltip content={<TrendTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {follower ? (
              // 基準線は中立グレー破線（正常色の緑と混同させない: 意味色とデータ色の分離）
              <ReferenceLine yAxisId="v" y={follower} stroke="var(--data-ref)" strokeDasharray="5 4"
                label={{ value: `フォロワー ${compact(follower)}`, position: "insideTopRight", fontSize: 11, fill: "var(--data-ref)" }} />
            ) : null}
            <Bar yAxisId="v" dataKey="views" name="再生数" fill="var(--data-1)" fillOpacity={0.75} stroke="var(--data-1)" strokeWidth={1} radius={[4, 4, 0, 0]} barSize={30} cursor="pointer" onClick={open} />
            <Line yAxisId="r" type="monotone" dataKey={metric} name={lineName} stroke={lineColor} strokeWidth={2.5} dot={{ r: 3, cursor: "pointer" }} activeDot={{ r: 5, onClick: (_: any, d: any) => open(d) }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="tiny" style={{ marginTop: 6 }} title="折れ線は右上のトグルで拡散率／反応率を切替。棒・プロットのクリックで動画を再生できます">
        棒が<b style={{ color: "var(--data-ref)" }}>灰破線（フォロワー数）</b>を超えた投稿＝フォロワーの外まで拡散 ・ クリックで再生
      </div>
    </div>
  );
}
