import type { Status } from "./types";

/** 拡散率の閾値（再生数 / フォロワー数）。凡例・ヒートマップ・色の単一ソース。 */
export const SPREAD = { crit: 0.1, warn: 0.3, strong: 1.0 };
/** 反応率の閾値（(いいね+コメント) / 再生数）。 */
export const ENGAGE = { crit: 0.01, warn: 0.03, strong: 0.06 };

export function num(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("ja-JP");
}

/** 大きな数を 1.2万 / 9.0万 形式に */
export function compact(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}万`;
  return n.toLocaleString("ja-JP");
}

export function pct(r: number | null | undefined, digits = 1): string {
  if (r == null) return "—";
  return `${(r * 100).toFixed(digits)}%`;
}

/** 拡散率は単位を明示（×＝フォロワー数の何倍リーチしたか） */
export function spreadLabel(r: number | null | undefined): string {
  if (r == null) return "—";
  return `${r.toFixed(2)}×`;
}

/** 前日比などの符号付き表示（+1.2万 / -500 / ±0）。null は — */
export function signedCompact(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n > 0) return `+${compact(n)}`;
  if (n < 0) return `-${compact(Math.abs(n))}`;
  return "±0";
}

/** 前日比の意味色（正=緑 / 負=赤 / 0・null=薄灰） */
export function deltaColor(n: number | null | undefined): string {
  if (n == null || n === 0) return "var(--text-3)";
  return n > 0 ? "var(--ok)" : "var(--crit)";
}

/** コメントカテゴリの日本語ラベル */
export const COMMENT_CATEGORY_LABEL: Record<string, string> = {
  anti: "アンチ",
  complaint: "クレーム",
  legal_risk: "法的リスク",
  question: "質問",
  positive: "ポジ",
  neutral: "中立",
};

export function commentCategoryLabel(category: string | null | undefined): string {
  if (!category) return "未分類";
  return COMMENT_CATEGORY_LABEL[category] ?? category;
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function fullDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export function fullDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}時${p(d.getMinutes())}分${p(d.getSeconds())}秒`;
}

export function relativeDays(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return "今日";
  if (days === 1) return "昨日";
  if (days < 7) return `${days}日前`;
  if (days < 30) return `${Math.floor(days / 7)}週間前`;
  return `${Math.floor(days / 30)}ヶ月前`;
}

/** generated_at が古いか（cron停止の一次検知）。時間数を返す。 */
export function hoursSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
}

export const statusLabel: Record<Status, string> = {
  ok: "正常",
  warning: "注意",
  critical: "要対応",
  unknown: "データ待ち",
};

export function initials(name: string): string {
  return name.trim().slice(0, 2);
}

/** ヒートマップ着色: 拡散率の高低（しきい値ベース、連続スケール）。 */
export function spreadHeat(r: number | null | undefined): string {
  if (r == null) return "transparent";
  if (r < SPREAD.crit) return "var(--heat-0)";
  if (r < SPREAD.warn) return "var(--heat-1)";
  if (r < SPREAD.strong) return "var(--heat-2)";
  return "var(--heat-3)";
}

export function engagementHeat(r: number | null | undefined): string {
  if (r == null) return "transparent";
  if (r < ENGAGE.crit) return "var(--heat-0)";
  if (r < ENGAGE.warn) return "var(--heat-1)";
  if (r < ENGAGE.strong) return "var(--heat-2)";
  return "var(--heat-3)";
}

/** 数値に対する意味色（テキスト用）。 */
export function spreadColor(r: number | null | undefined): string {
  if (r == null) return "var(--text-3)";
  if (r < SPREAD.crit) return "var(--crit)";
  if (r < SPREAD.warn) return "var(--warn)";
  return "var(--ok)";
}
