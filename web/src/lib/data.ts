import type { Summary, AccountDetail, WeeklyIndex, WeeklyReport, RiskFeed } from "./types";

const base = import.meta.env.BASE_URL;

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${base}data/${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} の取得に失敗 (${res.status})`);
  return res.json();
}

export const fetchSummary = () => getJSON<Summary>("summary.json");
export const fetchAccount = (handle: string) => getJSON<AccountDetail>(`account-${handle}.json`);

/** 未生成（404 / SPAフォールバックでHTMLが返る）は null を返す共通ハンドリング */
async function getJSONOrNull<T>(path: string): Promise<T | null> {
  const res = await fetch(`${base}data/${path}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${path} の取得に失敗 (${res.status})`);
  try {
    return (await res.json()) as T;
  } catch {
    return null; // 404がindex.htmlにフォールバックするホスティングでもJSONパース失敗→未生成扱い
  }
}

/** 週次インサイトの週一覧（week_end降順ソート済み）。未生成は null。 */
export const fetchWeeklyIndex = () => getJSONOrNull<WeeklyIndex>("weekly/index.json");

/** 指定週の週次インサイト本体。未生成は null。 */
export const fetchWeeklyReport = (file: string) => getJSONOrNull<WeeklyReport>(`weekly/${file}`);

/** 横断コメントリスクfeed（severity>=2・7日分）。未生成は null。 */
export const fetchRisk = () => getJSONOrNull<RiskFeed>("risk.json");
