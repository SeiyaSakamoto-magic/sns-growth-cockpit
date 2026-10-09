import { useEffect, useMemo, useRef, useState } from "react";
import type { Compare, Period } from "../lib/period";
import {
  PRESETS, periodLabel, rangeLabel, resolveRange, compareRange, daysBetween,
  monthOptions, monthRange,
} from "../lib/period";

/**
 * 期間セレクタ: プリセットsegmented + 📅カレンダー範囲ポップオーバー（月チップ付き）+ 比較トグル。
 * 比較は任意期間A×B（GAの決定論的な「前の期間」だけでは何の比較か分からない、という
 * 運用者のフィードバックを受け、比較バーに常に両期間の実日付を表示する）。
 * カレンダーは依存ゼロの自作実装（本番cronは npm install を実行しないため、
 * 新規ライブラリ追加=翌朝ビルド停止のリスクを避ける設計判断）。
 */
export default function PeriodPicker({ period, onChange, compare, onChangeCompare }: {
  period: Period;
  onChange: (p: Period) => void;
  /** 比較UI（省略時は非表示のまま従来挙動） */
  compare?: Compare;
  onChangeCompare?: (c: Compare) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useDismiss(rootRef, open, () => setOpen(false));

  const isRange = period.kind === "range";
  const months = useMemo(() => monthOptions(), []);
  const cmpOn = compare != null && compare.mode !== "off";

  return (
    <div className="period-picker" ref={rootRef}>
      <div className="segmented">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            className={period.kind === "preset" && period.days === p.days ? "active" : ""}
            onClick={() => onChange({ kind: "preset", days: p.days })}
          >
            {p.label}
          </button>
        ))}
        <button className={period.kind === "all" ? "active" : ""} onClick={() => onChange({ kind: "all" })}>
          全期間
        </button>
        <button
          className={`cal-btn ${isRange ? "active" : ""}`}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((v) => !v)}
          title="月または日付範囲を指定"
        >
          📅 {isRange ? periodLabel(period) : "期間指定"}
        </button>
      </div>
      {onChangeCompare && (
        <button
          className={`cmp-btn ${cmpOn ? "active" : ""}`}
          aria-pressed={cmpOn}
          disabled={period.kind === "all"}
          title={period.kind === "all"
            ? "全期間には「前」が定義できないため比較できません"
            : "2つの期間を並べて比較します（比較する期間は後から自由に変更できます）"}
          onClick={() => {
            // ONの瞬間は「前の期間」で即自動充填する（空の比較先を選ばせない）
            onChangeCompare(cmpOn ? { mode: "off" } : { mode: "prev" });
          }}
        >
          ⇄ 比較{cmpOn ? " 中" : ""}
        </button>
      )}
      {open && (
        <div className="cal-pop" role="dialog" aria-label="期間を指定">
          <div className="cal-pop-cols">
            <div className="cal-presets" aria-label="月で選ぶ">
              <div className="cal-presets-t">月で選ぶ</div>
              {months.map((m) => {
                const r = monthRange(m.ym);
                const active = isRange && period.from === r.from && period.to === r.to;
                return (
                  <button key={m.ym} className={`cal-preset-chip ${active ? "active" : ""}`}
                    onClick={() => { onChange({ kind: "range", ...r }); setOpen(false); }}>
                    {m.label}
                  </button>
                );
              })}
            </div>
            <RangeCalendar
              value={isRange ? { from: period.from, to: period.to } : null}
              onSelect={(from, to) => {
                onChange({ kind: "range", from, to });
                setOpen(false);
              }}
            />
          </div>
          <div className="cal-note">期間内に<b>投稿された</b>リールを表示します（投稿日ベース）</div>
        </div>
      )}
    </div>
  );
}

/* ===== 比較バー（ヘッダー直下・両期間の実日付を常時表示） ===== */

export function CompareBar({ period, compare, onChangeCompare }: {
  period: Period;
  compare: Compare;
  onChangeCompare: (c: Compare) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useDismiss(rootRef, open, () => setOpen(false));
  const months = useMemo(() => monthOptions(), []);

  if (compare.mode === "off") return null;
  const cur = resolveRange(period);
  const cmp = compareRange(period, compare);
  if (!cur || !cmp) return null;

  const dCur = daysBetween(cur);
  const dCmp = daysBetween(cmp);

  return (
    <div className="cmp-bar" ref={rootRef}>
      <span className="cmp-bar-label">
        <b>{rangeLabel(cur)}</b>（{dCur}日）と <b>{rangeLabel(cmp)}</b>（{dCmp}日）を比較中
      </span>
      <button className="link-btn" aria-expanded={open} aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}>比較期間を変える ▾</button>
      <button className="link-btn" onClick={() => onChangeCompare({ mode: "off" })}>× 解除</button>
      {dCur !== dCmp && (
        <span className="cmp-bar-warn" title="日数が違う期間の合計値は不利/有利が出ます。平均/本・中央値での比較を推奨">
          ⚠ {dCur}日 vs {dCmp}日 — 平均・中央値で比較推奨
        </span>
      )}
      {open && (
        <div className="cal-pop cmp-pop" role="dialog" aria-label="比較する期間を指定">
          <div className="cal-pop-cols">
            <div className="cal-presets" aria-label="比較先のショートカット">
              <div className="cal-presets-t">ショートカット</div>
              <button className={`cal-preset-chip ${compare.mode === "prev" ? "active" : ""}`}
                onClick={() => { onChangeCompare({ mode: "prev" }); setOpen(false); }}>
                前の期間
              </button>
              <button className={`cal-preset-chip ${compare.mode === "prev_month" ? "active" : ""}`}
                onClick={() => { onChangeCompare({ mode: "prev_month" }); setOpen(false); }}>
                前月同期間
              </button>
              <div className="cal-presets-t" style={{ marginTop: 8 }}>月で選ぶ</div>
              {months.map((m) => {
                const r = monthRange(m.ym);
                const active = compare.mode === "range" && compare.from === r.from && compare.to === r.to;
                return (
                  <button key={m.ym} className={`cal-preset-chip ${active ? "active" : ""}`}
                    onClick={() => { onChangeCompare({ mode: "range", ...r }); setOpen(false); }}>
                    {m.label}
                  </button>
                );
              })}
            </div>
            <RangeCalendar
              value={compare.mode === "range" ? { from: compare.from, to: compare.to } : cmp}
              onSelect={(from, to) => {
                onChangeCompare({ mode: "range", from, to });
                setOpen(false);
              }}
            />
          </div>
          <div className="cal-note">比較先（期間B）をカレンダーまたは月チップで指定します</div>
        </div>
      )}
    </div>
  );
}

/** ポップオーバー共通: 外クリック/Escで閉じる */
function useDismiss(ref: React.RefObject<HTMLDivElement | null>, active: boolean, close: () => void) {
  useEffect(() => {
    if (!active) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [active, ref, close]);
}

/* ===== 自作レンジカレンダー（2ヶ月表示・依存ゼロ） ===== */

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function monthOf(year: number, month: number): { year: number; month: number; cells: (string | null)[] } {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(first.getDay()).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(ymd(new Date(year, month, d)));
  return { year, month, cells };
}

function RangeCalendar({ value, onSelect }: {
  value: { from: string; to: string } | null;
  onSelect: (from: string, to: string) => void;
}) {
  const today = ymd(new Date());
  // 初期表示: 選択済みならその月、なければ今月を右側に
  const initial = value ? new Date(value.from) : new Date();
  const [view, setView] = useState({ year: initial.getFullYear(), month: initial.getMonth() });
  const [draftFrom, setDraftFrom] = useState<string | null>(value?.from ?? null);
  const [draftTo, setDraftTo] = useState<string | null>(value?.to ?? null);
  const [hover, setHover] = useState<string | null>(null);

  const months = useMemo(() => {
    const prev = new Date(view.year, view.month - 1, 1);
    return [monthOf(prev.getFullYear(), prev.getMonth()), monthOf(view.year, view.month)];
  }, [view]);

  const move = (diff: number) => {
    const d = new Date(view.year, view.month + diff, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  const click = (day: string) => {
    if (day > today) return;
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(day);
      setDraftTo(null);
      return;
    }
    // 2クリック目で確定
    const [from, to] = day < draftFrom ? [day, draftFrom] : [draftFrom, day];
    setDraftFrom(from);
    setDraftTo(to);
    onSelect(from, to);
  };

  // 選択中（1クリック目のみ）のときはホバー位置までを仮レンジ表示
  const rangeEnd = draftTo ?? (draftFrom && hover && hover >= draftFrom ? hover : null);
  const inRange = (day: string) =>
    draftFrom != null && rangeEnd != null && draftFrom <= day && day <= rangeEnd;

  return (
    <div>
      <div className="cal-head">
        <button className="cal-nav" onClick={() => move(-1)} aria-label="前の月">‹</button>
        <button className="cal-nav" onClick={() => move(1)} aria-label="次の月">›</button>
      </div>
      <div className="cal-months">
        {months.map((m) => (
          <div className="cal-month" key={`${m.year}-${m.month}`}>
            <div className="cal-month-title">{m.year}年{m.month + 1}月</div>
            <div className="cal-grid">
              {WEEKDAYS.map((w) => <span key={w} className="cal-wd">{w}</span>)}
              {m.cells.map((day, i) =>
                day == null ? (
                  <span key={i} />
                ) : (
                  <button
                    key={day}
                    className={[
                      "cal-day",
                      day > today ? "future" : "",
                      inRange(day) ? "in-range" : "",
                      day === draftFrom || day === draftTo ? "edge" : "",
                      day === today ? "today" : "",
                    ].filter(Boolean).join(" ")}
                    disabled={day > today}
                    onClick={() => click(day)}
                    onMouseEnter={() => setHover(day)}
                  >
                    {Number(day.slice(8, 10))}
                  </button>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="cal-hint">
        {draftFrom && !draftTo ? `開始 ${draftFrom.replaceAll("-", "/")} — 終了日をクリック` : "開始日 → 終了日の順にクリック"}
      </div>
    </div>
  );
}
