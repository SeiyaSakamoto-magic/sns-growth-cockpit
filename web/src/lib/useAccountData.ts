import { useEffect, useMemo, useState } from "react";
import { fetchAccount } from "./data";
import type { AccountDetail } from "./types";
import { usePeriod } from "./period";

/**
 * アカウント詳細系ページ（基本/分析）で共有するデータ取得＋期間フィルタ＋派生集計。
 * fetchは静的JSONなのでページ間の二重fetchはHTTPキャッシュに任せる（ローダー共有はしない実装最小方針）。
 */
export function useAccountData(handle: string | undefined) {
  const [data, setData] = useState<AccountDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const periodApi = usePeriod();
  const { inPeriod } = periodApi;

  useEffect(() => {
    if (!handle) return;
    setData(null);
    fetchAccount(handle).then(setData).catch((e) => setError(String(e)));
  }, [handle]);

  const allReels = useMemo(() => (data ? data.reels : []), [data]);
  const allNormal = useMemo(() => allReels.filter((r) => !r.is_live), [allReels]);
  const fReels = useMemo(() => allReels.filter((r) => inPeriod(r.posted_at)), [allReels, inPeriod]);
  const fNormal = useMemo(() => fReels.filter((r) => !r.is_live), [fReels]);
  const fTrend = useMemo(() => (data ? data.trend.filter((p) => inPeriod(p.posted_at)) : []), [data, inPeriod]);
  const comments = useMemo(() => data?.comments ?? [], [data]);

  // アラート帯: 要対応コメント(severity2以上・直近7日)
  // 24h窓は収集頻度と噛み合わず全アカウントで常時0になったため廃止（2026-08-17）
  const riskComments = useMemo(() => {
    const cutoff7d = Date.now() - 7 * 86400000;
    return comments.filter((c) => (c.severity ?? 0) >= 2 && new Date(c.first_seen_at).getTime() >= cutoff7d);
  }, [comments]);

  return { data, error, comments, allReels, allNormal, fReels, fNormal, fTrend, riskComments, ...periodApi };
}

export const median = (xs: (number | null | undefined)[]): number | null => {
  const v = xs.filter((x): x is number => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};
