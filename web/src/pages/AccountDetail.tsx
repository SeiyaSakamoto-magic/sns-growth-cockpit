import { useMemo, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import type { Reel } from "../lib/types";
import {
  compact, spreadLabel, spreadColor, signedCompact, deltaColor,
} from "../lib/format";
import { resolveRange } from "../lib/period";
import { useAccountData, median } from "../lib/useAccountData";
import TrendChart from "../components/TrendChart";
import ReelModal from "../components/ReelModal";
import Sparkline from "../components/Sparkline";
import { Section } from "../components/Section";
import {
  AccountHeader, AccountAlertBand, ThresholdBand, PostTable, PostLibraryBasic,
} from "./accountSections";

/**
 * 詳細・基本ページ（クライアントにそのまま見せられる面）。
 * 深掘り系（企画インサイト・コメント・公式インサイト・ストーリー等）は /analysis に分離。
 */
export default function AccountDetailPage() {
  const { handle } = useParams();
  const loc = useLocation();
  const [modalReel, setModalReel] = useState<Reel | null>(null);
  const {
    data, error, comments, allReels, fReels, fNormal, fTrend, riskComments,
    period, setPeriod, inPeriod, label: periodLabel,
    compare, setCompare, cmpRange, inCompare, cmpLabel,
  } = useAccountData(handle);

  // 比較期間の投稿コホート（非ライブのみ・投稿日ベース）
  const cNormal = useMemo(
    () => allReels.filter((r) => !r.is_live && inCompare(r.posted_at)),
    [allReels, inCompare],
  );

  if (error) {
    return (
      <main className="content">
        <div className="error-box card card-pad" role="alert">
          <div style={{ fontWeight: 700, fontSize: 16 }}>データの読み込みに失敗しました</div>
          <Link to="/" className="link-out" style={{ display: "inline-block", marginTop: 10 }}>← ダッシュボードに戻る</Link>
          <details><summary>技術的な詳細</summary>{error}</details>
        </div>
      </main>
    );
  }
  if (!data) return <main className="content"><div className="loading" role="status" aria-live="polite">読み込み中…</div></main>;

  const a = data.account;

  // 期間連動の集計（平均でなく中央値を代表値に）
  const fViews = fNormal.map((r) => r.views).filter((v): v is number => v != null);
  const totalViews = fViews.length ? fViews.reduce((s, v) => s + v, 0) : null;
  const avgViews = fViews.length ? Math.round(fViews.reduce((s, v) => s + v, 0) / fViews.length) : null;
  const medSpread = median(fNormal.map((r) => r.spread_rate));
  const liveCount = fReels.length - fNormal.length;

  // ===== 比較集計（任意期間A×B） =====
  const cViews = cNormal.map((r) => r.views).filter((v): v is number => v != null);
  const cTotalViews = cViews.length ? cViews.reduce((s, v) => s + v, 0) : null;
  const cAvgViews = cViews.length ? Math.round(cViews.reduce((s, v) => s + v, 0) / cViews.length) : null;
  const cMedSpread = median(cNormal.map((r) => r.spread_rate));
  /** 期間内のフォロワー増（follower_historyの範囲内 最初→最後） */
  const fhRangeDelta = (range: { from: string; to: string } | null): number | null => {
    if (!range) return null;
    const pts = data.follower_history.filter((p) => range.from <= p.date && p.date <= range.to && p.followers != null);
    if (pts.length < 2) return null;
    return (pts[pts.length - 1].followers ?? 0) - (pts[0].followers ?? 0);
  };
  const cmpOn = compare.mode !== "off" && cmpRange != null;
  const pctChange = (cur: number | null, prev: number | null): string | null => {
    if (cur == null || prev == null || prev === 0) return null;
    const r = (cur - prev) / Math.abs(prev);
    return `${r >= 0 ? "+" : ""}${(r * 100).toFixed(0)}%`;
  };
  /** 比較サブ行。前期間にデータが無いときは「データ蓄積前」を明示（無言の—は誤読のもと） */
  const CmpLine = ({ prev, cur, format }: { prev: number | null; cur: number | null; format: (n: number | null) => string }) => {
    if (!cmpOn) return null;
    if (prev == null) return <div className="tiny muted">{cmpLabel}: —（データ蓄積前）</div>;
    const chg = pctChange(cur, prev);
    return (
      <div className="tiny" style={{ marginTop: 2 }}>
        {cmpLabel}: {format(prev)}
        {chg && <b style={{ marginLeft: 4, color: deltaColor((cur ?? 0) - prev) }}>{chg}</b>}
      </div>
    );
  };

  // フォロワーΔ7d（follower_historyの日付ベース）
  const fh = data.follower_history;
  const followersDelta7d = (() => {
    if (fh.length < 2) return null;
    const last = fh[fh.length - 1];
    const target = new Date(new Date(last.date).getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const base = [...fh].reverse().find((p) => p.date <= target) ?? fh[0];
    if (last.followers == null || base.followers == null || base.date === last.date) return null;
    return last.followers - base.followers;
  })();
  // 比較ON時の「現期間のフォロワー増」（比較先と同じ物差しで比べるため、期間の実終端で切る）
  const curRange = cmpOn ? resolveRange(period) : null;

  // Sparkline用の日次Δ系列
  const dailyViews = period.kind === "all"
    ? (data.daily_totals ?? []).slice(-30)
    : (data.daily_totals ?? []).filter((d) => inPeriod(d.date)).slice(-90);

  // 「昨日 +N」チップ: 過去レンジ指定（昨日を含まない期間）では時制が破綻するため出さない
  const yest = new Date(Date.now() - 86400000);
  const yestStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, "0")}-${String(yest.getDate()).padStart(2, "0")}`;
  const showYesterdayChip = !(period.kind === "range" && period.to < yestStr);

  const hasGraphData = (data.stories ?? []).length > 0 || (data.account_insights ?? []).length > 0;

  return (
    <main className="content wrap-gap">
      <AccountHeader a={a} mode="basic" period={period} onChangePeriod={setPeriod}
        compare={compare} onChangeCompare={setCompare} hasGraphData={hasGraphData} />

      {/* ===== 比較サマリー（比較の結論を1行で。KPIカードを読み歩かなくて済むように） ===== */}
      {cmpOn && (
        <div className="card cmp-strip" role="note" aria-label="期間比較サマリー">
          {([
            { label: "投稿本数", cur: fNormal.length, prev: cNormal.length, fmt: (n: number | null) => `${n ?? "—"}本` },
            { label: "合計再生", cur: totalViews, prev: cTotalViews, fmt: (n: number | null) => compact(n) },
            { label: "平均再生/本", cur: avgViews, prev: cAvgViews, fmt: (n: number | null) => compact(n) },
            { label: "拡散率中央値", cur: medSpread, prev: cMedSpread, fmt: (n: number | null) => spreadLabel(n) },
          ] as const).map((m) => {
            const chg = pctChange(m.cur, m.prev);
            return (
              <span key={m.label} className="cmp-strip-item">
                <span className="cmp-strip-label">{m.label}</span>
                <b>{m.fmt(m.cur)}</b>
                <span className="cmp-strip-prev">← {m.prev == null ? "—" : m.fmt(m.prev)}</span>
                {chg && <b className="cmp-strip-chg" style={{ color: deltaColor((m.cur ?? 0) - (m.prev ?? 0)) }}>{chg}</b>}
              </span>
            );
          })}
        </div>
      )}

      {/* ===== KPI 4枚（数字が主役。要対応はこの下） ===== */}
      <div className="kpi-grid kpi-4">
        <div className="kpi">
          <div className="label">フォロワー</div>
          <div className="value">{compact(a.follower_count)}</div>
          <div className="sub">
            {a.followers_delta_1d != null && <>昨日比 <b style={{ color: deltaColor(a.followers_delta_1d) }}>{signedCompact(a.followers_delta_1d)}</b></>}
            {followersDelta7d != null && <> ・ 7日 <b style={{ color: deltaColor(followersDelta7d) }}>{signedCompact(followersDelta7d)}</b></>}
          </div>
          <CmpLine prev={fhRangeDelta(cmpRange)} cur={fhRangeDelta(curRange)} format={(n) => `増減 ${signedCompact(n)}`} />
          <Sparkline points={fh.slice(-30).map((p) => p.followers)} color="var(--data-2)" />
        </div>
        <div className="kpi period-linked" key={`posts-${periodLabel}`}>
          <div className="label">投稿本数</div>
          <div className="value">{fNormal.length}<span className="value-unit">本</span></div>
          <div className="sub">
            {periodLabel}{liveCount > 0 ? ` ・ ライブ${liveCount}本を除く` : ""}
          </div>
          <CmpLine prev={cNormal.length} cur={fNormal.length} format={(n) => `${n ?? "—"}本`} />
          {showYesterdayChip && (a.new_posts_1d ?? 0) > 0 && (
            <div className="kpi-chips">
              <span className="delta-chip" style={{ color: deltaColor(1) }}>昨日 +{a.new_posts_1d}本</span>
            </div>
          )}
        </div>
        <div className="kpi period-linked" key={`views-${periodLabel}`}
          title="期間内に投稿されたリールの合計再生数を表示します（投稿日ベース・現在の累計値）。期間中に増えた再生量とは異なります">
          <div className="label">再生数（期間内投稿）</div>
          {fNormal.length === 0 ? (
            <>
              <div className="value">—</div>
              <div className="sub">この期間の投稿はありません</div>
            </>
          ) : (
            <>
              <div className="value">{compact(totalViews)}</div>
              <div className="sub">{periodLabel} ・ 平均 <b>{compact(avgViews)}</b>/本</div>
            </>
          )}
          <CmpLine prev={cTotalViews} cur={totalViews} format={(n) => `${compact(n)}（${cNormal.length}本）`} />
          {showYesterdayChip && a.views_delta_1d != null && (
            <div className="kpi-chips">
              <span className="delta-chip" style={{ color: deltaColor(a.views_delta_1d) }}>
                昨日 {signedCompact(a.views_delta_1d)}
              </span>
            </div>
          )}
          <Sparkline points={dailyViews.map((d) => d.views_delta)} baselineZero color="var(--data-1)" />
          {dailyViews.length >= 2 && <div className="spark-legend">アカウント全体の日次再生増</div>}
        </div>
        <div className="kpi period-linked" key={`spread-${periodLabel}`}>
          <div className="label">拡散率（中央値）</div>
          <div className="value" style={{ color: spreadColor(medSpread) }}>{spreadLabel(medSpread)}</div>
          <div className="sub">{periodLabel}・再生数/フォロワー</div>
          <CmpLine prev={cMedSpread} cur={medSpread} format={(n) => spreadLabel(n)} />
          <ThresholdBand value={medSpread} />
        </div>
      </div>

      {/* ===== 要対応（数字の下・判定理由つき） ===== */}
      <AccountAlertBand riskComments={riskComments} alerts={data.alerts} />

      {/* ===== 昨日動いた投稿（短期変化。累計ランキングは投稿ライブラリの仕事） ===== */}
      <Section title="昨日動いた投稿" sub={`Δ再生順 ・ ${periodLabel} ・ ${fReels.length}本`}>
        {fReels.length === 0
          ? <div className="empty">この期間（{periodLabel}）のリールデータがありません。</div>
          : <PostTable reels={fReels} onOpen={setModalReel} />}
      </Section>

      {/* ===== 投稿別パフォーマンス（期間内の分布をビジュアルで俯瞰） ===== */}
      <Section title="投稿別パフォーマンス" sub={`棒=再生数・線=拡散率 ・ ${periodLabel}`}>
        {fTrend.length === 0
          ? <div className="empty">この期間（{periodLabel}）のデータがありません。</div>
          : <TrendChart trend={fTrend} follower={a.follower_count}
              onOpen={(sc) => { const r = allReels.find((x) => x.shortcode === sc); if (r) setModalReel(r); }} />}
      </Section>

      {/* ===== 投稿ライブラリ（企画チャート/トップ投稿。キャプション分析は分析ページへ） ===== */}
      <PostLibraryBasic fNormal={fNormal} periodLabel={periodLabel} avgViews={avgViews} liveCount={liveCount} onOpen={setModalReel} />

      {/* 深掘りへの導線（重い一覧は分析ページに委ねる） */}
      <div className="card card-pad row between" style={{ flexWrap: "wrap", gap: 8 }}>
        <span className="tiny">
          企画インサイト・コメント全件（{comments.length}）・公式インサイト・ストーリーは分析ページにあります。
        </span>
        <Link className="csv-btn" style={{ textDecoration: "none" }}
          to={{ pathname: `/account/${a.handle}/analysis`, search: loc.search }}>
          分析を見る →
        </Link>
      </div>

      {modalReel && <ReelModal reel={modalReel} onClose={() => setModalReel(null)} />}
    </main>
  );
}
