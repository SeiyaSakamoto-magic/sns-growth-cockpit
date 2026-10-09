import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { PieChart, Pie, Cell } from "recharts";
import type { Reel, WeeklyIndex, WeeklyReport, WeeklyAccountInsight, Demographics } from "../lib/types";
import { fetchWeeklyIndex, fetchWeeklyReport } from "../lib/data";
import { compact, pct } from "../lib/format";
import { useAccountData } from "../lib/useAccountData";
import ReelModal from "../components/ReelModal";
import { Section, FoldSection } from "../components/Section";
import {
  AccountHeader, AccountAlertBand, OfficialInsightsSection, AccountInsightsSection, StoriesSection,
  DiagnosisFlow, CommentsSection, FollowerSection, MonthlySection, Qualitative,
} from "./accountSections";

/**
 * 詳細・分析ページ（深掘り面）。運用者の4観点＋事業目的でカテゴライズ:
 * ① 企画の評価と方向性 ② リスク管理 ③ アカウント分析 ④ ストーリー運用効果 ⑤ 事業の目的
 * API未連携アカウントは①②のみ表示し、③④は「連携後に表示されます」に畳む。
 */
export default function AccountAnalysisPage() {
  const { handle } = useParams();
  const [modalReel, setModalReel] = useState<Reel | null>(null);
  const {
    data, error, comments, allReels, allNormal, riskComments,
    period, setPeriod, inPeriod, label: periodLabel,
  } = useAccountData(handle);

  // 直近の週次インサイトから自アカウントの示唆を引用（①のネクストアクション欄）
  const [weekly, setWeekly] = useState<WeeklyAccountInsight | null>(null);
  const [weeklyEnd, setWeeklyEnd] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetchWeeklyIndex()
      .then((idx: WeeklyIndex | null) => {
        const latest = idx?.weeks?.[0];
        if (!latest) return null;
        return fetchWeeklyReport(latest.file).then((rep: WeeklyReport | null) => {
          if (!alive || !rep) return;
          setWeeklyEnd(rep.week_end);
          setWeekly(rep.accounts.find((x) => x.handle === handle) ?? null);
        });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [handle]);

  const hasGraph = useMemo(
    () => allNormal.some((r) => r.insights_source === "graph")
      || (data?.account_insights ?? []).length > 0
      || (data?.stories ?? []).length > 0,
    [allNormal, data],
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
  const fNormal = allNormal.filter((r) => inPeriod(r.posted_at));
  const goal = a.business_goal;

  return (
    <main className="content wrap-gap">
      <AccountHeader a={a} mode="analysis" period={period} onChangePeriod={setPeriod} hasGraphData={hasGraph} />

      {/* ===== ① 企画の評価と方向性（結果→要因→打ち手の順に読める3ステップ） ===== */}
      <FoldSection title="① 企画の評価と方向性" sub="どの企画が伸びたか → なぜか → 次に何を打つか" defaultOpen>
        <DiagnosisFlow d={data.diagnosis ?? null} comments={comments} stats={data.comment_stats ?? null}
          reels={allReels} weekly={weekly} weeklyEnd={weeklyEnd} onOpen={setModalReel} />
      </FoldSection>

      {/* 視聴の深さは「なぜ伸びたか」の材料なので①の直後に置く（graph時のみ） */}
      {allNormal.some((r) => r.insights_source === "graph") && (
        <OfficialInsightsSection reels={fNormal} periodLabel={periodLabel} onOpen={setModalReel} />
      )}

      {/* キャプション分析（企画タグ・示唆の全量。①の深掘り） */}
      {allNormal.length > 0 && (
        <FoldSection title="キャプション分析" sub="企画タグ別の全投稿と示唆">
          <Qualitative reels={allNormal} />
        </FoldSection>
      )}

      {/* ===== ② リスク管理（要対応帯は畳めるセクションの外。隠すと見落とし事故になる） ===== */}
      <AccountAlertBand riskComments={riskComments} alerts={data.alerts} />
      {riskComments.length === 0 && data.alerts.length === 0 && (
        <div className="action-band-empty">✓ 直近7日の要対応コメント・未解決アラートはありません</div>
      )}
      <FoldSection title="② リスク管理"
        sub={`コメント全${comments.length}件${(data.comment_stats?.negative ?? 0) > 0 ? `（ネガ${data.comment_stats!.negative}）` : ""} ・ 炎上/クレームの早期検知`}
        defaultOpen={riskComments.length > 0}>
        <CommentsSection comments={comments} stats={data.comment_stats ?? null} handle={a.handle} />
      </FoldSection>

      {/* ===== ③ アカウント分析（分析レポート型の指標） ===== */}
      {(data.account_insights ?? []).length > 0 ? (
        <FoldSection title="③ アカウント分析" sub={`プロフィールアクセス・男女比など ・ ${periodLabel}`}>
          <AccountInsightsSection days={data.account_insights!} inPeriod={inPeriod} />
          <DemographicsBlock demographics={data.demographics ?? null} />
        </FoldSection>
      ) : (
        <div className="card card-pad tiny muted">③ アカウント分析（プロフィールアクセス・男女比など）は Meta API連携後に表示されます</div>
      )}

      {/* ===== ④ ストーリー運用効果 ===== */}
      {(data.stories ?? []).length > 0 ? (
        <FoldSection title="④ ストーリー運用効果" sub={`${data.stories!.filter((s) => inPeriod(s.posted_at)).length}本 ・ 閲覧率・反応率 ・ ${periodLabel}`}>
          <StoriesSection stories={data.stories!} stats={data.story_stats ?? null} inPeriod={inPeriod}
            periodLabel={periodLabel} followerCount={a.follower_count} />
        </FoldSection>
      ) : (
        <div className="card card-pad tiny muted">④ ストーリー運用効果は Meta API連携後に表示されます</div>
      )}

      {/* ===== ⑤ 事業の目的（事業貢献の器） ===== */}
      <Section title="⑤ 事業の目的" sub="この運用が事業の何に効くか">
        {goal ? (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>🎯 {goal.label}</div>
            {goal.description && <div style={{ marginTop: 4 }}>{goal.description}</div>}
            {(goal.related_metrics ?? []).length > 0 && (
              <div className="tiny" style={{ marginTop: 8 }}>
                先行指標: {goal.related_metrics!.map((m) => GOAL_METRIC_LABEL[m] ?? m).join(" / ")}
                （実数値の自動取り込みは今後拡張。現時点ではアカウント分析の数値を先行指標として見る）
              </div>
            )}
          </div>
        ) : (
          <div className="empty">目的は未設定です（設定すると、LINE追加数・商品購買など案件固有のゴールとIG指標の紐づけがここに表示されます）</div>
        )}
      </Section>

      {/* ===== アカウント全体（俯瞰。クライアントが見たい面なので既定で開いておく） ===== */}
      <FoldSection title="アカウント全体" sub={`フォロワー推移（${periodLabel}）・月次KPI（全期間）`} defaultOpen>
        <FollowerSection followerHistory={data.follower_history} inPeriod={inPeriod} periodLabel={periodLabel} />
        <div style={{ height: 18 }} />
        <MonthlySection monthly={data.monthly} periodReels={allNormal} />
      </FoldSection>

      {modalReel && <ReelModal reel={modalReel} onClose={() => setModalReel(null)} />}
    </main>
  );
}

const GOAL_METRIC_LABEL: Record<string, string> = {
  website_clicks: "リンククリック",
  profile_views: "プロフィールアクセス",
  follows: "フォロー",
};

/* ===== フォロワー属性（男女比・年齢層） ===== */

function DemographicsBlock({ demographics }: { demographics: Demographics | null }) {
  if (!demographics || (!demographics.gender && !demographics.age)) return null;
  const g = demographics.gender ?? {};
  const genderTotal = Object.values(g).reduce((s, v) => s + v, 0);
  const GENDER_LABEL: Record<string, string> = { F: "女性", M: "男性", U: "不明" };
  const GENDER_COLOR: Record<string, string> = { F: "var(--data-1)", M: "var(--data-2)", U: "var(--text-3)" };
  const gEntries = Object.entries(g).filter(([, v]) => v > 0);
  // 中央ラベルは結論を先に言う。Metaは「不明」が半分近くを占めるため、
  // 見出しは判明分（女性/男性）の中の最大にする（「不明 48%」を結論にしない）
  const gKnown = gEntries.filter(([k]) => k === "F" || k === "M");
  const knownTotal = gKnown.reduce((s, [, v]) => s + v, 0);
  const gTop = gKnown.length
    ? [...gKnown].sort((x, y) => y[1] - x[1])[0]
    : (gEntries.length ? [...gEntries].sort((x, y) => y[1] - x[1])[0] : null);
  const gTopShare = gTop ? gTop[1] / (knownTotal > 0 ? knownTotal : genderTotal) : 0;
  const ages = Object.entries(demographics.age ?? {}).sort((x, y) => x[0].localeCompare(y[0]));
  const ageMax = Math.max(1, ...ages.map(([, v]) => v));
  const ageTotal = ages.reduce((s, [, v]) => s + v, 0);

  return (
    <div style={{ marginTop: 18 }}>
      <h3 className="insight-panel-t">フォロワー属性{demographics.as_of && <span className="sec-sub">{demographics.as_of} 時点・Meta概数</span>}</h3>
      <div className="row" style={{ gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
        {genderTotal > 0 && gTop && (
          <div style={{ flex: "0 0 auto" }}>
            <div className="tiny" style={{ fontWeight: 700, marginBottom: 6 }}>男女比</div>
            <div style={{ position: "relative", width: 168, height: 168 }} title="フォロワーの男女比">
              <PieChart width={168} height={168}>
                <Pie data={gEntries.map(([k, v]) => ({ name: GENDER_LABEL[k] ?? k, key: k, value: v }))}
                  dataKey="value" innerRadius={48} outerRadius={72}
                  startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                  {gEntries.map(([k]) => <Cell key={k} fill={GENDER_COLOR[k] ?? "var(--text-3)"} />)}
                </Pie>
              </PieChart>
              <div style={{
                position: "absolute", inset: 0, display: "grid", placeItems: "center",
                pointerEvents: "none", textAlign: "center",
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{GENDER_LABEL[gTop[0]] ?? gTop[0]} {pct(gTopShare, 0)}</div>
                  <div className="tiny">{knownTotal > 0 && knownTotal < genderTotal ? "判明分中" : `${compact(genderTotal)}人`}</div>
                </div>
              </div>
            </div>
            <div className="heat-bar-legend tiny" style={{ marginTop: 8 }}>
              {gEntries.map(([k, v]) => (
                <span key={k}><i style={{ background: GENDER_COLOR[k] ?? "var(--text-3)" }} />{GENDER_LABEL[k] ?? k} {pct(v / genderTotal, 0)}（{compact(v)}）</span>
              ))}
            </div>
          </div>
        )}
        {ages.length > 0 && (
          <div style={{ flex: "1 1 300px" }}>
            <div className="tiny" style={{ fontWeight: 700, marginBottom: 6 }}>年齢層</div>
            {ages.map(([band, v]) => {
              const isTop = v === ageMax; // ボリュームゾーンだけ濃色にして1秒で伝える
              return (
                <div key={band} className="row" style={{ gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <span className="tiny" style={{ width: 52, fontWeight: isTop ? 700 : 500, color: isTop ? "var(--text)" : undefined }}>{band}</span>
                  <div style={{ flex: 1, background: "var(--border)", borderRadius: 4, height: 12 }}>
                    <div style={{ width: `${(v / ageMax) * 100}%`, background: isTop ? "var(--data-1)" : "var(--data-1-soft)", height: "100%", borderRadius: 4 }} />
                  </div>
                  <span className="tiny" style={{ width: 90, textAlign: "right", fontWeight: isTop ? 700 : 500, color: isTop ? "var(--text)" : undefined }}>
                    {ageTotal > 0 ? pct(v / ageTotal, 0) : ""}（{compact(v)}）
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
