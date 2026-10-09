import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * 期間選択の単一ソース。
 * - フィルタ基準は投稿日(posted_at)。「期間内に投稿されたリール」を絞る。
 * - 状態はURLクエリに同期（HashRouter配下: #/account/x?p=7d / ?from=YYYY-MM-DD&to=YYYY-MM-DD）。
 *   定例中のリンク共有・Slack深リンクで同じ表示を再現できる。
 * - アカウント切替（別リンクへの遷移）で期間はリセットされる仕様。
 * - 比較: 任意期間A×B。UIは常に両期間の実日付を表示する（「前の期間」のような
 *   決定論的な言い方だけでは何と何の比較か伝わらない、という運用者フィードバックへの回答）。
 *   URL: cf=YYYY-MM-DD&ct=YYYY-MM-DD（任意期間B）。cmp=prev|prev_month は旧URL互換で解釈する。
 *   全期間には「前」が定義できないため比較は無効。
 */
export type Period =
  | { kind: "all" }
  | { kind: "preset"; days: 7 | 30 | 90 }
  | { kind: "range"; from: string; to: string }; // YYYY-MM-DD（両端含む）

export type Compare =
  | { mode: "off" }
  | { mode: "prev" }        // 直前の同じ長さの期間（ショートカット）
  | { mode: "prev_month" }  // 前月の同じ日付範囲（ショートカット）
  | { mode: "range"; from: string; to: string }; // 任意期間B

export const PRESETS: { days: 7 | 30 | 90; label: string }[] = [
  { days: 7, label: "7日" },
  { days: 30, label: "30日" },
  { days: 90, label: "90日" },
];

/** データ収集の開始月（Graph API遡及取得の起点）。月チップはこれ以降のみ生成する */
export const DATA_START_MONTH = "2026-04";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parsePeriod(params: URLSearchParams): Period {
  const from = params.get("from");
  const to = params.get("to");
  if (from && to && DATE_RE.test(from) && DATE_RE.test(to)) {
    return from <= to ? { kind: "range", from, to } : { kind: "range", from: to, to: from };
  }
  const p = params.get("p");
  if (p === "7d") return { kind: "preset", days: 7 };
  if (p === "30d") return { kind: "preset", days: 30 };
  if (p === "90d") return { kind: "preset", days: 90 };
  return { kind: "all" };
}

export function parseCompare(params: URLSearchParams): Compare {
  const cf = params.get("cf");
  const ct = params.get("ct");
  if (cf && ct && DATE_RE.test(cf) && DATE_RE.test(ct)) {
    return cf <= ct ? { mode: "range", from: cf, to: ct } : { mode: "range", from: ct, to: cf };
  }
  const c = params.get("cmp");
  if (c === "prev" || c === "prev_month") return { mode: c };
  return { mode: "off" };
}

export function periodLabel(period: Period): string {
  if (period.kind === "all") return "全期間";
  if (period.kind === "preset") return `直近${period.days}日`;
  return rangeLabel(period);
}

/** 実日付の短縮表記（8/1–8/17）。比較バーで両期間を並べるときの共通フォーマット */
export function rangeLabel(range: { from: string; to: string }): string {
  const f = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  return `${f(range.from)}–${f(range.to)}`;
}

/* ===== 日付ユーティリティ（依存ゼロ・ローカルタイム基準） ===== */

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function addDays(day: string, delta: number): string {
  const d = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
  d.setDate(d.getDate() + delta);
  return ymd(d);
}

/** 月をずらす。月末クランプ（3/31 → 2/28）付き */
function shiftMonth(day: string, delta: number): string {
  const y = Number(day.slice(0, 4)), m = Number(day.slice(5, 7)) - 1, dd = Number(day.slice(8, 10));
  const lastDay = new Date(y, m + delta + 1, 0).getDate();
  return ymd(new Date(y, m + delta, Math.min(dd, lastDay)));
}

/** 両端含む日数（8/1–8/17 → 17） */
export function daysBetween(range: { from: string; to: string }): number {
  const t = (d: string) => new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))).getTime();
  return Math.round((t(range.to) - t(range.from)) / 86400000) + 1;
}

/** "YYYY-MM" → その月の日付範囲（当月は今日まで） */
export function monthRange(ym: string): { from: string; to: string } {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1;
  const from = ymd(new Date(y, m, 1));
  const end = ymd(new Date(y, m + 1, 0));
  const today = ymd(new Date());
  return { from, to: end < today ? end : today };
}

/** 月チップの選択肢（新しい月が先頭・データ開始月まで） */
export function monthOptions(): { ym: string; label: string }[] {
  const out: { ym: string; label: string }[] = [];
  const now = new Date();
  let y = now.getFullYear(), m = now.getMonth();
  for (let i = 0; i < 24; i++) {
    const ym = `${y}-${String(m + 1).padStart(2, "0")}`;
    if (ym < DATA_START_MONTH) break;
    out.push({ ym, label: `${y}年${m + 1}月` });
    m -= 1;
    if (m < 0) { m = 11; y -= 1; }
  }
  return out;
}

/** 現在の期間を具体的な日付範囲に解決する（presetは「今日を終端とするN日間」） */
export function resolveRange(period: Period): { from: string; to: string } | null {
  if (period.kind === "all") return null;
  if (period.kind === "range") return { from: period.from, to: period.to };
  const to = ymd(new Date());
  return { from: addDays(to, -(period.days - 1)), to };
}

/** 比較対象の期間。全期間や未対応の組み合わせは null（UIは「—」を出す） */
export function compareRange(period: Period, compare: Compare): { from: string; to: string } | null {
  if (compare.mode === "off") return null;
  if (compare.mode === "range") return { from: compare.from, to: compare.to };
  const cur = resolveRange(period);
  if (!cur) return null;
  if (compare.mode === "prev_month") {
    return { from: shiftMonth(cur.from, -1), to: shiftMonth(cur.to, -1) };
  }
  // prev: 直前の同じ長さの期間
  const lengthDays = Math.round((new Date(cur.to).getTime() - new Date(cur.from).getTime()) / 86400000);
  const to = addDays(cur.from, -1);
  return { from: addDays(to, -lengthDays), to };
}

/** KPIカードのサブ行などで使う比較期間の短いラベル。実日付を必ず含める */
export function compareLabel(compare: Compare, range: { from: string; to: string } | null): string {
  if (compare.mode === "off" || !range) return "";
  return `比較（${rangeLabel(range)}）`;
}

export function usePeriod() {
  const [params, setParams] = useSearchParams();
  const period = useMemo(() => parsePeriod(params), [params]);
  const compare = useMemo(() => parseCompare(params), [params]);

  const setPeriod = useCallback(
    (p: Period) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("p");
          next.delete("from");
          next.delete("to");
          if (p.kind === "preset") next.set("p", `${p.days}d`);
          if (p.kind === "range") {
            next.set("from", p.from);
            next.set("to", p.to);
          }
          if (p.kind === "all") { // 全期間に「前」は無いので比較も解除
            next.delete("cmp");
            next.delete("cf");
            next.delete("ct");
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const setCompare = useCallback(
    (c: Compare) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("cmp");
          next.delete("cf");
          next.delete("ct");
          if (c.mode === "prev" || c.mode === "prev_month") next.set("cmp", c.mode);
          if (c.mode === "range") {
            next.set("cf", c.from);
            next.set("ct", c.to);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  // 投稿日ベースのフィルタ関数（ISO日時 or YYYY-MM-DD を受ける）
  const inPeriod = useCallback(
    (iso: string | null | undefined): boolean => {
      if (period.kind === "all") return true;
      if (!iso) return false;
      if (period.kind === "preset") {
        return Date.now() - new Date(iso).getTime() <= period.days * 86400000;
      }
      const day = iso.slice(0, 10);
      return period.from <= day && day <= period.to;
    },
    [period],
  );

  const cmpRange = useMemo(() => compareRange(period, compare), [period, compare]);
  const inCompare = useCallback(
    (iso: string | null | undefined): boolean => {
      if (!cmpRange || !iso) return false;
      const day = iso.slice(0, 10);
      return cmpRange.from <= day && day <= cmpRange.to;
    },
    [cmpRange],
  );

  return {
    period, setPeriod, inPeriod, label: periodLabel(period),
    compare, setCompare, cmpRange, inCompare,
    cmpLabel: compareLabel(compare, cmpRange),
  };
}
