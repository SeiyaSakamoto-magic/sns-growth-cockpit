import type { Alert } from "./types";
import { SPREAD, spreadLabel } from "./format";

/**
 * 「要対応」の生成をホームと詳細で1箇所に統一する。
 * かつて Summary.tsx がUI側で文言を再生成し、詳細はDBのmessage素通しだったため、
 * 同じ異常でも画面ごとに文言が違い「要対応の意味がわからない」の原因になっていた。
 *
 * scope の区別が設計の芯:
 * - infra = 数字そのものが信用できない警告（収集停止・トークン失効・取得失敗）。テーブルの上に出す
 * - ops   = 運用上の対応（拡散率・コメント・消化ペース）。数字を見た後の補助なのでテーブルの下
 */
export interface ActionItem {
  key: string;
  tone: "crit" | "warn";
  scope: "infra" | "ops";
  kind: string;
  text: string;
  /** なぜ要対応なのか＝判定基準を必ず言葉にする */
  reason: string | null;
  action: string;
  handle?: string;
}

/** 「0.06× < 基準0.10×」形式の判定理由 */
export function reasonLabel(value: number | null | undefined, threshold: number, cmp: "<" | ">=" = "<"): string {
  return `${spreadLabel(value)} ${cmp} 基準${threshold.toFixed(2)}×`;
}

/* ===== アカウント詳細側: DB alerts を同じ語彙に変換 ===== */

const ALERT_KIND_LABEL: Record<string, string> = {
  low_spread_rate: "拡散率",
  negative_comments: "ネガコメ",
};
const ALERT_KIND_ACTION: Record<string, string> = {
  low_spread_rate: "企画・フックの見直し",
  negative_comments: "返信/削除の判断",
};

export function alertKindLabel(kind: string): string {
  return ALERT_KIND_LABEL[kind] ?? kind;
}
export function alertKindAction(kind: string): string {
  return ALERT_KIND_ACTION[kind] ?? "内容確認";
}
/** DB alertsのmessageに判定基準を添える（「拡散率 0.08: …」だけでは基準が読めないため） */
export function alertReason(al: Alert): string | null {
  if (al.kind === "low_spread_rate") {
    return `基準: ${SPREAD.crit.toFixed(2)}×未満=要対応 / ${SPREAD.warn.toFixed(2)}×未満=注意`;
  }
  if (al.kind === "negative_comments") {
    return "基準: 深刻度3、48h内ネガ3件集中、共感拡散のいずれか";
  }
  return null;
}
