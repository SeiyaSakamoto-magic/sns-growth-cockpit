/**
 * アカウント詳細系ページ（基本 AccountDetail / 分析 AccountAnalysis）で共有するセクション部品。
 * 2026-08-16のページ分割時に AccountDetail.tsx から移設。ロジックは移動のみで挙動不変
 * （変更点は StoriesSection の閲覧率/反応率KPI追加と AccountAlertBand の判定理由表示のみ）。
 */
import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { AccountDetail, Reel, Diagnosis, MonthlyStat, ReelComment, CommentStats, Story, AccountInsightDay, StoryStats } from "../lib/types";
import {
  ResponsiveContainer as RC2, BarChart as BC2, Bar as B2, XAxis as XA2, YAxis as YA2, CartesianGrid as CG2, Tooltip as TT2,
  LineChart as LC2, Line as L2,
} from "recharts";
import {
  compact, num, pct, spreadLabel, spreadColor, fullDate, fullDateTime, spreadHeat,
  signedCompact, deltaColor, commentCategoryLabel, COMMENT_CATEGORY_LABEL, SPREAD,
} from "../lib/format";
import type { Compare, Period } from "../lib/period";
import { median } from "../lib/useAccountData";
import { alertKindLabel, alertKindAction, alertReason } from "../lib/actionItems";
import Avatar from "../components/Avatar";
import Badge from "../components/Badge";
import PeriodPicker, { CompareBar } from "../components/PeriodPicker";
import PostBarChart from "../components/PostBarChart";
import { FoldSection } from "../components/Section";

const NEG_CATS = new Set(["anti", "complaint", "legal_risk"]);

/* ===== 共通ヘッダー（基本⇄分析で期間クエリを引き継ぐ） ===== */

export function AccountHeader({ a, mode, period, onChangePeriod, compare, onChangeCompare, hasGraphData }: {
  a: AccountDetail["account"];
  mode: "basic" | "analysis";
  period: Period;
  onChangePeriod: (p: Period) => void;
  compare?: Compare;
  onChangeCompare?: (c: Compare) => void;
  hasGraphData: boolean;
}) {
  const loc = useLocation();
  return (
    <div>
      {mode === "analysis" && (
        <Link to={{ pathname: `/account/${a.handle}`, search: loc.search }} className="back-link">← ダッシュボードに戻る</Link>
      )}
      <div className="row between" style={{ flexWrap: "wrap", gap: 16 }}>
        <div className="detail-head">
          <Avatar name={a.client_name} seed={a.handle} img={a.profile_pic_url} big />
          <div>
            <h1>{a.client_name}{mode === "analysis" && <span className="sec-sub" style={{ fontSize: 15 }}>分析</span>}</h1>
            <div className="sub">
              {a.display_name ? `${a.display_name} ・ ` : ""}
              <a className="link-out" href={a.url} target="_blank" rel="noreferrer">@{a.handle} ↗</a>
              {" ・ "}更新 {fullDateTime(a.data_as_of)}
              {a.awaiting_permission ? (
                <span className="stale-chip" title="Meta Business Suite での権限共有がまだ完了していません">
                  🔒 ※データ更新は {fullDate(a.data_as_of)} から止まっています（Meta APIの権限待ち）
                </span>
              ) : a.data_stale && (
                <span className="stale-chip" title="Graph API収集が通らず、前回取得した値を表示しています">
                  ⚠ 取得失敗・前回値表示中
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Badge status={a.status} />
          <PeriodPicker period={period} onChange={onChangePeriod} compare={compare} onChangeCompare={onChangeCompare} />
          {mode === "basic" && (
            <>
              <CsvMenu handle={a.handle} hasGraphData={hasGraphData} />
              <Link className="btn-primary" style={{ textDecoration: "none" }}
                to={{ pathname: `/account/${a.handle}/analysis`, search: loc.search }}>
                分析を見る →
              </Link>
            </>
          )}
        </div>
      </div>
      {compare && onChangeCompare && (
        <CompareBar period={period} compare={compare} onChangeCompare={onChangeCompare} />
      )}
    </div>
  );
}

/* ===== Meta公式インサイト（視聴の深さ） ===== */

export function OfficialInsightsSection({ reels, periodLabel, onOpen }: {
  reels: Reel[]; periodLabel: string; onOpen: (r: Reel) => void;
}) {
  const official = reels.filter((r) => r.insights_source === "graph");
  const withWatch = official.filter((r) => r.avg_watch_time_sec != null);
  const medianWatch = median(withWatch.map((r) => r.avg_watch_time_sec ?? null));
  const totalWatchSec = withWatch.reduce((sum, r) => sum + (r.total_watch_time_sec ?? 0), 0);
  const savedTotal = official.reduce((sum, r) => sum + (r.saved ?? 0), 0);
  const reachTotal = official.reduce((sum, r) => sum + (r.reach ?? 0), 0);
  // 視聴時間が長い順。同値なら保存数で割る（保存は「後で見返す価値」の代理指標）
  const top = [...withWatch]
    .sort((a, b) => (b.avg_watch_time_sec ?? -1) - (a.avg_watch_time_sec ?? -1)
      || (b.saved ?? -1) - (a.saved ?? -1))
    .slice(0, 5);
  const withFollows = official.filter((r) => r.follows != null);
  const latestAsOf = official.map((r) => r.insights_as_of).filter((v): v is string => Boolean(v)).sort().at(-1) ?? null;

  return (
    <FoldSection title="視聴の深さ" sub={`Meta公式インサイト ・ ${periodLabel}`}>
      {official.length === 0 ? (
        <div className="empty">この期間にGraph公式データ付きのリールがありません。</div>
      ) : (
        <>
          <div className="kpi-grid kpi-4" style={{ marginBottom: 14 }}>
            <div className="kpi">
              <div className="label">平均視聴時間（中央値）</div>
              <div className="value">{medianWatch != null ? `${medianWatch.toFixed(1)}秒` : "—"}</div>
              <div className="sub">1再生あたり・{withWatch.length}本の中央値</div>
            </div>
            <div className="kpi">
              <div className="label">総視聴時間</div>
              <div className="value">{withWatch.length ? formatWatchHours(totalWatchSec) : "—"}</div>
              <div className="sub">期間内投稿の累計</div>
            </div>
            <div className="kpi">
              <div className="label">保存 / リーチ</div>
              <div className="value">{compact(savedTotal)}<span style={{ fontSize: 16 }}> / {compact(reachTotal)}</span></div>
              <div className="sub">保存率 {pct(reachTotal > 0 ? savedTotal / reachTotal : null, 2)}</div>
            </div>
            <div className="kpi">
              <div className="label">公式指標のデータ時点</div>
              <div className="value" style={{ fontSize: 22 }}>{latestAsOf ? fullDate(latestAsOf) : "—"}</div>
              <div className="sub">Meta Graph API ・ {official.length}/{reels.length}本</div>
            </div>
          </div>
          <div className="tiny" style={{ marginBottom: 12 }}
            title={"平均視聴時間は「最後まで見られたか」を測る指標。再生数が多くても平均視聴が短ければ、冒頭で興味を引けているだけで中身が刺さっていない、と読めます。"
              + (withFollows.length === 0 ? " なおリール単位のフォロー獲得数はMetaが提供を終了したため非表示（アカウント日次のフォロー数はアカウント分析にあります）。" : "")}>
            ※ 平均視聴時間 = 中身が刺さったかの指標（カーソルを乗せると読み方の解説）
          </div>
          {top.length > 0 ? (
            <div className="table-wrap">
              <table className="grid dense">
                <thead><tr><th>視聴時間Top</th><th>投稿日</th><th className="num">再生</th><th className="num">リーチ</th><th className="num">平均視聴</th><th className="num">保存</th><th /></tr></thead>
                <tbody>{top.map((r, i) => (
                  <tr key={r.shortcode} onClick={() => onOpen(r)}>
                    <td><b>#{i + 1}</b> {r.caption_excerpt || r.shortcode}</td>
                    <td className="muted">{fullDate(r.posted_at)}</td>
                    <td className="num">{compact(r.views)}</td>
                    <td className="num">{compact(r.reach)}</td>
                    <td className="num"><b>{r.avg_watch_time_sec?.toFixed(1)}秒</b></td>
                    <td className="num">{num(r.saved)}</td>
                    <td><span className="link-out">▶</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <div className="empty">Metaから視聴時間の指標が返却されたリールはありません。</div>}
        </>
      )}
    </FoldSection>
  );
}

/** 総視聴時間は秒だと桁が読めないので時間/分に丸める */
export function formatWatchHours(sec: number): string {
  if (sec >= 3600) return `${compact(Math.round(sec / 3600))}時間`;
  if (sec >= 60) return `${Math.round(sec / 60)}分`;
  return `${Math.round(sec)}秒`;
}

/* ===== アカウントインサイト（日次） ===== */

export function AccountInsightsSection({ days, inPeriod }: {
  days: AccountInsightDay[]; inPeriod: (d: string | null) => boolean;
}) {
  const filtered = useMemo(() => {
    const inRange = days.filter((d) => inPeriod(d.date));
    return inRange.length === days.length ? days.slice(-30) : inRange;
  }, [days, inPeriod]);

  const sum = (pick: (d: AccountInsightDay) => number | null): number | null => {
    const vs = filtered.map(pick).filter((v): v is number => v != null);
    return vs.length ? vs.reduce((s, v) => s + v, 0) : null;
  };
  const last7 = days.slice(-7);
  const prev7 = days.slice(-14, -7);
  const sumOf = (arr: AccountInsightDay[], pick: (d: AccountInsightDay) => number | null): number | null => {
    const vs = arr.map(pick).filter((v): v is number => v != null);
    return vs.length ? vs.reduce((s, v) => s + v, 0) : null;
  };
  const pv7 = sumOf(last7, (d) => d.profile_views);
  const pvPrev7 = sumOf(prev7, (d) => d.profile_views);
  const pvDelta = pv7 != null && pvPrev7 != null ? pv7 - pvPrev7 : null;
  const clicks = sum((d) => d.website_clicks);
  const follows = sum((d) => d.follows);
  const unfollows = sum((d) => d.unfollows);
  const netFollows = follows != null ? follows - (unfollows ?? 0) : null;
  const reaches = filtered.map((d) => d.reach).filter((v): v is number => v != null);
  const avgReach = reaches.length ? Math.round(reaches.reduce((s, v) => s + v, 0) / reaches.length) : null;

  const pts = filtered.map((d) => ({
    date: d.date.slice(5), full: d.date,
    プロフィール閲覧: d.profile_views, リンククリック: d.website_clicks,
  }));

  return (
    <div>
      <div className="kpi-grid kpi-4" style={{ marginBottom: 14 }}>
        <div className="kpi">
          <div className="label">プロフィール閲覧（7日）</div>
          <div className="value">{compact(pv7)}</div>
          <div className="sub">
            {pvDelta != null && <>前7日比 <b style={{ color: deltaColor(pvDelta) }}>{signedCompact(pvDelta)}</b></>}
          </div>
        </div>
        <div className="kpi">
          <div className="label">リンククリック（期間内）</div>
          <div className="value">{compact(clicks)}</div>
          <div className="sub">プロフィールのリンク（アカウント日次・投稿別CTRではない）</div>
        </div>
        <div className="kpi">
          <div className="label">フォロー純増（期間内）</div>
          <div className="value" style={{ color: netFollows != null && netFollows < 0 ? "var(--crit)" : undefined }}>
            {netFollows == null ? "—" : (netFollows >= 0 ? "+" : "") + compact(netFollows)}
          </div>
          <div className="sub">
            {follows != null && <>+{num(follows)}</>}
            {unfollows != null && <> / 解除 −{num(unfollows)}</>}
          </div>
        </div>
        <div className="kpi">
          <div className="label">日次リーチ（平均）</div>
          <div className="value">{compact(avgReach)}</div>
          <div className="sub">アカウント全体の1日あたりリーチ</div>
        </div>
      </div>
      {pts.length >= 2 && (
        <div style={{ width: "100%", height: 240 }}>
          <RC2>
            <LC2 data={pts} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
              <CG2 stroke="var(--border)" vertical={false} />
              <XA2 dataKey="date" tick={{ fontSize: 12, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
              <YA2 tick={{ fontSize: 12, fill: "var(--text-3)" }} axisLine={false} tickLine={false} tickFormatter={(v) => compact(v)} />
              <TT2 contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 13 }} />
              <L2 type="monotone" dataKey="プロフィール閲覧" stroke="var(--data-1)" strokeWidth={2.5} dot={{ r: 2 }} />
              <L2 type="monotone" dataKey="リンククリック" stroke="var(--data-2)" strokeWidth={2} dot={{ r: 2 }} />
            </LC2>
          </RC2>
        </div>
      )}
      <div className="tiny" style={{ marginTop: 8 }}
        title="どこで落ちているかが伸びしろの在り処">
        ※ ファネル: リール再生 → プロフィール閲覧 → リンククリック/フォロー
      </div>
      {/* 「なぜこの日から？」を毎回聞かれるので、開始日の理由を画面に焼き込む */}
      {days.length > 0 && (
        <div className="tiny muted" style={{ marginTop: 2 }}>
          ※ 日次の公式データは <b>{fullDate(days[0].date)}</b> から蓄積。Meta APIが過去約28日までしか返さないため、
          収集開始時点でこの日まで遡って取得済み（これより前は取得できません）
        </div>
      )}
    </div>
  );
}

/* ===== ストーリー（閲覧率・反応率をフォロワー対比で） ===== */

/** ストーリーのクリエイティブ（9:16）。収集当日に保存できた分だけ画像が出る */
function StoryThumb({ story }: { story: Story }) {
  const [src, setSrc] = useState(story.thumb ? `${import.meta.env.BASE_URL}${story.thumb}` : null);
  if (!src) return <span className="story-thumb-ph" title="このストーリーは画像の保存前に消えています" aria-hidden>—</span>;
  return <img className="story-thumb" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setSrc(null)} />;
}

export function StoriesSection({ stories, stats, inPeriod, periodLabel, followerCount }: {
  stories: Story[]; stats: StoryStats | null; inPeriod: (d: string | null) => boolean; periodLabel: string;
  followerCount: number | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const filtered = useMemo(() => stories.filter((s) => inPeriod(s.posted_at)), [stories, inPeriod]);
  const medViews = median(filtered.map((s) => s.views));
  const replies = filtered.reduce((sum, s) => sum + (s.replies ?? 0), 0);
  const viewsTotal = filtered.reduce((sum, s) => sum + (s.views ?? 0), 0);
  // 閲覧率 = 中央値閲覧 ÷ フォロワー（ストーリーがどれだけ届いているか）
  const viewRate = medViews != null && followerCount ? medViews / followerCount : null;
  // 反応率 = 返信合計 ÷ 閲覧合計（見た人がどれだけ動いたか）
  const replyRate = viewsTotal > 0 ? replies / viewsTotal : null;
  const CAP = 10;
  const shown = showAll ? filtered : filtered.slice(0, CAP);

  return (
    <div>
      <div className="kpi-grid kpi-4" style={{ marginBottom: 14 }}>
        <div className="kpi">
          <div className="label">投稿本数（期間内）</div>
          <div className="value">{filtered.length}</div>
          <div className="sub">{stats && `直近7日 ${stats.count_7d}本`}</div>
        </div>
        <div className="kpi">
          <div className="label">閲覧率（対フォロワー）</div>
          <div className="value">{pct(viewRate)}</div>
          <div className="sub">中央値閲覧 {compact(medViews)} ÷ フォロワー {compact(followerCount)}</div>
        </div>
        <div className="kpi">
          <div className="label">反応率（返信÷閲覧）</div>
          <div className="value">{pct(replyRate, 2)}</div>
          <div className="sub">返信 {num(replies)} / 閲覧 {compact(viewsTotal)}</div>
        </div>
        <div className="kpi">
          <div className="label">返信合計</div>
          <div className="value">{num(replies)}</div>
          <div className="sub">熱量の高い反応{stats != null && stats.replies_7d > 0 ? ` ・ 直近7日 ${stats.replies_7d}` : ""}</div>
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="empty">この期間（{periodLabel}）のストーリーはありません。</div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="grid dense">
              <thead>
                <tr>
                  <th />
                  <th>投稿日時</th><th>種別</th><th className="num">閲覧</th><th className="num">リーチ</th>
                  <th className="num">返信</th><th className="num">ナビゲーション</th><th />
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.story_id} style={{ cursor: "default" }}>
                    <td><StoryThumb story={s} /></td>
                    <td className="muted">{fullDateTime(s.posted_at)}</td>
                    <td>{s.media_type === "VIDEO" ? "動画" : s.media_type === "IMAGE" ? "画像" : s.media_type ?? "—"}</td>
                    <td className="num">{compact(s.views)}</td>
                    <td className="num">{compact(s.reach)}</td>
                    <td className="num">{s.replies == null ? <span className="muted">—</span> : <b>{num(s.replies)}</b>}</td>
                    <td className="num" title="タップ送り/戻り/離脱などの操作合計">{compact(s.navigation)}</td>
                    <td>{s.permalink && <a className="link-out tiny" href={s.permalink} target="_blank" rel="noreferrer">↗</a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > CAP && (
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button className="link-btn" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "上位のみ表示" : `全 ${filtered.length} 本を表示`}
              </button>
            </div>
          )}
          <div className="tiny muted" style={{ marginTop: 8 }}
            title="ストーリーは24時間で消えるため毎朝の回収分のみ蓄積。ナビゲーションはタップ送り/戻り/離脱の操作合計で、少ないほど完読に近い">
            ※ ストーリーは24時間で消えるため、毎朝の回収時に画像ごと保存しています（回収前に消えた分は「—」）
          </div>
        </>
      )}
    </div>
  );
}

/* ===== アカウントのアラート帯（文言・判定基準はactionItems.tsで共通化） ===== */

/** 「6/3」形式（ISO日付の先頭10文字から。ゼロ埋めを外して読みやすく） */
const shortDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const [, m, d] = iso.slice(0, 10).split("-");
  return m && d ? `${Number(m)}/${Number(d)}` : "—";
};

export function AccountAlertBand({ riskComments, alerts }: { riskComments: ReelComment[]; alerts: AccountDetail["alerts"] }) {
  const [showAll, setShowAll] = useState(false);
  const [openKind, setOpenKind] = useState<string | null>(null);
  if (riskComments.length + alerts.length === 0) return null;

  const CAP = 3;
  const shownComments = showAll ? riskComments : riskComments.slice(0, CAP);

  // kind別に1行へ畳む。運用アラートは解決するまで無期限に積み上がるため（2026-08-17実測:
  // 57件中53件が低拡散率）、素の全行表示だと急ぎのコメント数件が数十行に埋もれる
  const groups: { kind: string; items: AccountDetail["alerts"] }[] = [];
  for (const al of alerts) {
    const g = groups.find((x) => x.kind === al.kind);
    if (g) g.items.push(al); else groups.push({ kind: al.kind, items: [al] });
  }

  return (
    <div className="card action-band">
      <div className="action-band-head">
        <span className="sec-h" style={{ margin: 0 }}>このアカウントの要対応</span>
        <span className="band-chips">
          {/* 窓もスコープも違うものを足し算しない（合算値が「KPIは0なのに59件」の混乱の元だった） */}
          <span className="band-chip">要対応コメント <b>{riskComments.length}</b>件 <span className="muted">直近7日</span></span>
          <span className="band-chip">運用アラート <b>{alerts.length}</b>件 <span className="muted">未解決・累計</span></span>
        </span>
        {riskComments.length > CAP && (
          <button className="link-btn" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "折りたたむ" : `コメントを全部見る（${riskComments.length}）`}
          </button>
        )}
      </div>
      {shownComments.map((c) => (
        <div key={c.comment_id} className={`action-row ${(c.severity ?? 0) >= 3 || c.category === "legal_risk" ? "crit" : "warn"}`}>
          <span className="action-dot" aria-hidden>{(c.severity ?? 0) >= 3 || c.category === "legal_risk" ? "🔴" : "🟡"}</span>
          <span className="action-kind">{commentCategoryLabel(c.category)} sev{c.severity}</span>
          <span className="action-text">「{(c.text ?? "").slice(0, 60)}{(c.text ?? "").length > 60 ? "…" : ""}」→ {c.caption_excerpt || c.shortcode}</span>
          <span className="action-do">
            → {c.category === "legal_risk" || (c.severity ?? 0) >= 3 ? "担当者へ共有" : "返信/削除の判断"}
            <a className="link-out tiny" style={{ marginLeft: 8 }} href={c.reel_url} target="_blank" rel="noreferrer">投稿 ↗</a>
          </span>
        </div>
      ))}
      {groups.map((g) => {
        const crit = g.items.some((al) => al.severity === "critical");
        const days = g.items.map((al) => al.collected_at).filter(Boolean).sort();
        const span = days.length ? `${shortDate(days[0])}〜${shortDate(days[days.length - 1])}` : null;
        const open = openKind === g.kind;
        return (
          <div key={g.kind}>
            <div className={`action-row ${crit ? "crit" : "warn"}`}>
              <span className="action-dot" aria-hidden>{crit ? "🔴" : "🟡"}</span>
              <span className="action-kind">{alertKindLabel(g.kind)}</span>
              <span className="action-text">
                {g.kind === "low_spread_rate"
                  ? <>基準未満の投稿が <b>{g.items.length}本</b>{span && <> <span className="muted">（{span}）</span></>}</>
                  : <>検知 <b>{g.items.length}件</b>{span && <> <span className="muted">（{span}）</span></>}</>}
                {alertReason(g.items[0]) && <span className="tiny muted" style={{ display: "block" }}>{alertReason(g.items[0])}</span>}
              </span>
              <span className="action-do">
                → {alertKindAction(g.kind)}
                <button className="link-btn tiny" style={{ marginLeft: 8 }} onClick={() => setOpenKind(open ? null : g.kind)}>
                  {open ? "閉じる ▴" : "内訳を見る ▾"}
                </button>
              </span>
            </div>
            {open && (
              <div className="alert-detail">
                {g.items.map((al, i) => (
                  <div key={`al-${g.kind}-${i}`} className="tiny alert-detail-row">
                    <span className="muted">{shortDate(al.collected_at)}</span> {al.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ===== 拡散率の閾値帯インジケータ ===== */

export function ThresholdBand({ value }: { value: number | null }) {
  if (value == null) return null;
  const stops = [0, SPREAD.crit, SPREAD.warn, SPREAD.strong, SPREAD.strong * 2];
  let seg = stops.length - 2;
  for (let i = 0; i < stops.length - 1; i++) {
    if (value < stops[i + 1]) { seg = i; break; }
  }
  const within = Math.min(1, (value - stops[seg]) / (stops[seg + 1] - stops[seg]));
  const pos = ((seg + within) / 4) * 100;
  return (
    <div className="thr-band" title={`要対応 <${SPREAD.crit} / 注意 <${SPREAD.warn} / 標準 <${SPREAD.strong} / 好調 ≥${SPREAD.strong}`}>
      <div className="thr-track">
        <i style={{ background: "var(--heat-0)" }} /><i style={{ background: "var(--heat-1)" }} />
        <i style={{ background: "var(--heat-2)" }} /><i style={{ background: "var(--heat-3)" }} />
        <span className="thr-marker" style={{ left: `${pos}%` }} />
      </div>
      <div className="thr-labels tiny"><span>要対応</span><span>注意</span><span>標準</span><span>好調</span></div>
    </div>
  );
}

/* ===== CSVメニュー ===== */

const CSV_KINDS = [
  { label: "投稿一覧", suffix: "posts" },
  { label: "日次推移", suffix: "daily" },
  { label: "コメント", suffix: "comments" },
] as const;

const CSV_KINDS_GRAPH = [
  { label: "ストーリー", suffix: "stories" },
  { label: "アカウントインサイト", suffix: "account-insights" },
] as const;

export function CsvMenu({ handle, hasGraphData }: { handle: string; hasGraphData?: boolean }) {
  const kinds = hasGraphData ? [...CSV_KINDS, ...CSV_KINDS_GRAPH] : [...CSV_KINDS];
  const csvUrl = (suffix: string) => `${import.meta.env.BASE_URL}data/csv/${handle}-${suffix}.csv`;
  const downloadAll = () => {
    kinds.forEach((k, i) => {
      setTimeout(() => {
        const el = document.createElement("a");
        el.href = csvUrl(k.suffix);
        el.download = `${handle}-${k.suffix}.csv`;
        document.body.appendChild(el);
        el.click();
        el.remove();
      }, i * 350);
    });
  };
  return (
    <details className="csv-menu">
      <summary className="csv-btn">⬇ CSV</summary>
      <div className="csv-menu-pop">
        {kinds.map((k) => (
          <a key={k.suffix} href={csvUrl(k.suffix)} download={`${handle}-${k.suffix}.csv`}>{k.label}</a>
        ))}
        <button onClick={downloadAll}>一括ダウンロード</button>
      </div>
    </details>
  );
}

/* ===== フォロワー推移（期間フィルタ連動・時間軸） =====
 * X軸は epoch の数値軸にする。カテゴリ軸だと収集が止まった日が詰めて描画され、
 * 3週間の欠測が「隣の日」に見える（＝視覚的な嘘になる）ため。 */

export function FollowerSection({ followerHistory, inPeriod, periodLabel }: {
  followerHistory: { date: string; followers: number | null }[];
  inPeriod: (d: string | null) => boolean;
  periodLabel: string;
}) {
  const pts = useMemo(
    () => followerHistory
      .filter((p) => inPeriod(p.date))
      .map((p) => ({ ts: new Date(`${p.date}T00:00:00`).getTime(), full: p.date, followers: p.followers ?? 0 })),
    [followerHistory, inPeriod],
  );
  const first = pts.length ? pts[0].followers : null;
  const last = pts.length ? pts[pts.length - 1].followers : null;
  const net = first != null && last != null ? last - first : null;
  const gapped = pts.length >= 2
    && (pts[pts.length - 1].ts - pts[0].ts) / 86400000 + 1 > pts.length; // 欠測日がある

  return (
    <div className="wrap-gap">
      <div className="row" style={{ gap: 20, flexWrap: "wrap" }}>
        <div className="kpi" style={{ flex: "1 1 160px" }}><div className="label">フォロワー</div><div className="value">{compact(last)}</div><div className="sub">{pts.length ? `${fullDate(pts[pts.length - 1].full)} 時点` : "—"}</div></div>
        <div className="kpi" style={{ flex: "1 1 160px" }}><div className="label">純増（{periodLabel}）</div><div className="value" style={{ color: net != null && net < 0 ? "var(--crit)" : "var(--ok)" }}>{net == null ? "—" : (net >= 0 ? "+" : "") + compact(net)}</div><div className="sub">{pts.length >= 2 ? `${fullDate(pts[0].full)} → ${fullDate(pts[pts.length - 1].full)}` : "2日分から算出"}</div></div>
        <div className="kpi" style={{ flex: "1 1 160px" }}><div className="label">記録日数</div><div className="value">{pts.length}<span className="value-unit">日</span></div><div className="sub">{periodLabel}のうち実測できた日数</div></div>
      </div>
      <div>
        <h2 className="sec-h">フォロワー推移<span className="sec-sub">{periodLabel}</span></h2>
        {pts.length >= 2 ? (
          <>
            <div style={{ width: "100%", height: 280 }}>
              <RC2>
                <LC2 data={pts} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
                  <CG2 stroke="var(--border)" vertical={false} />
                  <XA2 dataKey="ts" type="number" scale="time" domain={["dataMin", "dataMax"]}
                    tick={{ fontSize: 12, fill: "var(--text-3)" }} axisLine={false} tickLine={false}
                    tickFormatter={(t: number) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; }} />
                  <YA2 domain={["dataMin", "dataMax"]} tick={{ fontSize: 12, fill: "var(--text-3)" }} axisLine={false} tickLine={false} tickFormatter={(v) => compact(v)} />
                  <TT2 contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 13 }}
                    labelFormatter={(t: number) => fullDate(new Date(t).toISOString().slice(0, 10))}
                    formatter={(v: number) => compact(v)} />
                  <L2 type="monotone" dataKey="followers" name="フォロワー" stroke="var(--data-2)" strokeWidth={2.5} dot={{ r: 3 }} />
                </LC2>
              </RC2>
            </div>
            {gapped && <div className="tiny muted">※ 点=実測した日。点と点の間は収集が動いていない期間で、線はその間を直線でつないだ推定です</div>}
          </>
        ) : (
          <div className="empty" style={{ padding: "32px 0" }}>
            {followerHistory.length >= 2
              ? <>この期間（{periodLabel}）に記録された日が {pts.length} 日しかありません。期間を広げると推移が表示されます。</>
              : <>フォロワー数は過去分を遡れないため、<b>今日から毎日記録</b>しています。<br />推移グラフは<b>2日分たまると表示</b>されます（現在 {pts.length} 日分）。</>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== 月次KPI（アカウント全体・全期間固定） ===== */

export function MonthlySection({ monthly, periodReels }: { monthly: MonthlyStat[]; periodReels: Reel[] }) {
  const pv = periodReels.map((r) => r.views).filter((v): v is number => v != null);
  const periodTotal = pv.reduce((s, v) => s + v, 0);
  const periodAvg = pv.length ? Math.round(periodTotal / pv.length) : null;
  const chart = [...monthly].reverse().map((m) => ({ month: m.month.replace(/^\d{4}-/, "") + "月", 合計再生: m.total_views }));

  return (
    <div className="wrap-gap">
      <div>
        <h2 className="sec-h">全期間サマリー</h2>
        <div className="kpi-grid">
          <div className="kpi"><div className="label">リール本数</div><div className="value">{periodReels.length}</div><div className="sub">リール</div></div>
          <div className="kpi"><div className="label">合計再生数</div><div className="value">{compact(periodTotal)}</div><div className="sub">リール合計</div></div>
          <div className="kpi"><div className="label">平均再生数</div><div className="value">{compact(periodAvg)}</div><div className="sub">リール1本あたり</div></div>
          <div className="kpi"><div className="label">対象月数</div><div className="value">{monthly.length}<span className="value-unit">ヶ月</span></div><div className="sub">投稿の記録がある月</div></div>
        </div>
      </div>
      {chart.length > 0 && (
        <div>
          <h2 className="sec-h">月別 合計再生数</h2>
          <div style={{ width: "100%", height: 220 }}>
            <RC2>
              <BC2 data={chart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CG2 stroke="var(--border)" vertical={false} />
                <XA2 dataKey="month" tick={{ fontSize: 12, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                <YA2 tick={{ fontSize: 12, fill: "var(--text-3)" }} axisLine={false} tickLine={false} tickFormatter={(v) => compact(v)} />
                <TT2 contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 13 }} formatter={(v: number) => compact(v)} />
                <B2 dataKey="合計再生" fill="var(--data-1)" radius={[4, 4, 0, 0]} barSize={34} />
              </BC2>
            </RC2>
          </div>
        </div>
      )}
      <div>
        <h2 className="sec-h">月次KPI</h2>
        <div className="table-wrap">
          <table className="grid">
            <thead><tr><th>月</th><th className="num">リール本数</th><th className="num">合計再生数</th><th className="num">平均再生数</th><th className="num">平均拡散率</th></tr></thead>
            <tbody>
              {monthly.length === 0 && <tr><td colSpan={5} className="muted">データがありません</td></tr>}
              {monthly.map((m) => (
                <tr key={m.month} style={{ cursor: "default" }}>
                  <td style={{ fontWeight: 700 }}>{m.month.replace("-", "年") + "月"}</td>
                  <td className="num">{m.posts}</td>
                  <td className="num">{compact(m.total_views)}</td>
                  <td className="num">{compact(m.avg_views)}</td>
                  <td className="num">{m.avg_spread != null ? m.avg_spread + "×" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ===== 企画インサイト: 結果 → 要因 → 打ち手の3ステップ =====
 * かつては「数値診断」「コメントが語る次ネタ」「週次引用」が並列に置かれ、
 * 何を読み取って何をすればいいのかが読者側の再構成任せだった（運用者の指摘）。
 * 分析の順序そのものをレイアウトにして、左から右に読めば結論に着くようにする。 */

const StepHead = ({ n, title, sub }: { n: number; title: string; sub: string }) => (
  <div className="diag-step-h">
    <span className="diag-step-n" aria-hidden>{n}</span>
    <span className="diag-step-t">{title}</span>
    <span className="sec-sub">{sub}</span>
  </div>
);

export function DiagnosisFlow({ d, comments, stats, reels, weekly, weeklyEnd, onOpen }: {
  d: Diagnosis | null;
  comments: ReelComment[];
  stats: CommentStats | null;
  reels: Reel[];
  weekly: { insight: string; action: string } | null;
  weeklyEnd: string | null;
  onOpen: (r: Reel) => void;
}) {
  const open = (sc: string) => { const f = reels.find((r) => r.shortcode === sc); if (f) onOpen(f); };
  const findReel = (sc: string) => reels.find((r) => r.shortcode === sc);

  /* --- 1 結果: 好調/不調の投稿カード（サムネ付き。キャプション文より画像1枚の方が速い） --- */
  const DiagPost = ({ label, r, tone }: { label: string; r: Diagnosis["best"]; tone: "good" | "bad" }) => {
    const reel = findReel(r.shortcode);
    return (
      <div className={`diag-post ${tone}`} role="button" tabIndex={0} onClick={() => open(r.shortcode)}
        onKeyDown={(e) => { if (e.key === "Enter") open(r.shortcode); }}>
        {reel ? <PostThumb reel={reel} /> : <span className="post-thumb-ph" aria-hidden>▶</span>}
        <div className="diag-post-body">
          <div className="diag-post-label">{label}</div>
          <div className="diag-post-cap">{r.caption_excerpt}</div>
          <div className="diag-post-meta">
            {r.hook_type && <span className="tag neutral">{r.hook_type}</span>}
            <b style={{ color: tone === "good" ? "var(--ok)" : "var(--crit)" }}>{r.spread_rate?.toFixed(2)}×</b>
            <span className="tiny">▶{compact(r.views)}</span>
          </div>
        </div>
      </div>
    );
  };

  /* --- 2 要因: コメントの熱量構成 --- */
  const cat = stats?.by_category ?? {};
  const heat = [
    { key: "positive", label: "ポジ", n: cat.positive ?? 0, color: "var(--ok)" },
    { key: "question", label: "質問", n: cat.question ?? 0, color: "#2b6cb0" },
    { key: "neutral", label: "中立", n: cat.neutral ?? 0, color: "var(--text-3)" },
    { key: "negative", label: "ネガ", n: (cat.anti ?? 0) + (cat.complaint ?? 0) + (cat.legal_risk ?? 0), color: "var(--crit)" },
  ];
  const heatTotal = heat.reduce((s, h) => s + h.n, 0);
  const hooks = d?.hooks ?? [];
  const hookMax = Math.max(0.01, ...hooks.map((h) => h.avg_spread ?? 0));

  /* --- 3 打ち手: 質問が集まった投稿（需要が顕在化しているネタ） --- */
  const byPost = new Map<string, { count: number; caption: string }>();
  for (const c of comments) {
    if (c.category !== "question") continue;
    const cur = byPost.get(c.shortcode) ?? { count: 0, caption: c.caption_excerpt };
    cur.count += 1;
    byPost.set(c.shortcode, cur);
  }
  const topQuestions = [...byPost.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 3);

  if (!d) return <div className="empty">診断できる投稿データがまだありません。</div>;

  return (
    <div className="diag-flow">
      <section className="diag-step">
        <StepHead n={1} title="結果" sub="何が伸びたか" />
        <div className="diag-headline">{d.headline}</div>
        <div className="diag-stats">
          <span className="diag-pill crit">要対応 {d.stats.crit}</span>
          <span className="diag-pill warn">注意 {d.stats.warn}</span>
          <span className="diag-pill ok">標準以上 {d.stats.ok}</span>
          {d.direction && <span className="diag-dir">{d.direction.label}</span>}
        </div>
        <DiagPost label="好調な企画" r={d.best} tone="good" />
        <DiagPost label="弱い企画" r={d.worst} tone="bad" />
      </section>

      <section className="diag-step">
        <StepHead n={2} title="要因" sub="なぜ当たったか" />
        {hooks.length > 0 ? (
          <>
            <div className="diag-row-t">フック（切り口）別の平均拡散率</div>
            {[...hooks].sort((a, b) => (b.avg_spread ?? 0) - (a.avg_spread ?? 0)).map((h) => {
              const isTop = (h.avg_spread ?? 0) >= hookMax;
              return (
                <div key={h.name} className="hook-row">
                  <span className="hook-name" style={{ fontWeight: isTop ? 700 : 500 }}>{h.name}</span>
                  <span className="hook-track">
                    <i style={{ width: `${((h.avg_spread ?? 0) / hookMax) * 100}%`, background: isTop ? "var(--data-1)" : "var(--data-1-soft)" }} />
                  </span>
                  <span className="hook-val" style={{ fontWeight: isTop ? 700 : 500 }}>
                    {(h.avg_spread ?? 0).toFixed(2)}×
                    {/* N=1の平均を確定事実に見せない */}
                    <span className="muted"> {h.count}本{h.count === 1 ? "※" : ""}</span>
                  </span>
                </div>
              );
            })}
            {hooks.some((h) => h.count === 1) && <div className="tiny muted">※ 1本しかない切り口は平均の信頼度が低い</div>}
          </>
        ) : <div className="tiny muted">フック（切り口）の分類がまだありません。</div>}
        {heatTotal > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="diag-row-t">コメントの熱量（{num(heatTotal)}件）</div>
            <div className="heat-bar" title="コメントの熱量構成">
              {heat.filter((h) => h.n > 0).map((h) => (
                <i key={h.key} style={{ width: `${(h.n / heatTotal) * 100}%`, background: h.color }} />
              ))}
            </div>
            <div className="heat-bar-legend tiny">
              {heat.filter((h) => h.n > 0).map((h) => (
                <span key={h.key}><i style={{ background: h.color }} />{h.label} {Math.round((h.n / heatTotal) * 100)}%</span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="diag-step">
        <StepHead n={3} title="打ち手" sub="次に何を打つか" />
        <div className="diag-recs">
          <ul>{d.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
        {topQuestions.length > 0 && (
          <div className="q-list">
            <div className="diag-row-t">❓ 質問が集まった投稿 = 需要が見えているネタ</div>
            {topQuestions.map(([sc, v]) => {
              const r = findReel(sc);
              return (
                <div key={sc} className="q-row">
                  <span className="q-count">{v.count}件</span>
                  <span className="q-cap">{v.caption || sc}</span>
                  {r && <a className="link-out tiny" href={r.url} target="_blank" rel="noreferrer">↗</a>}
                </div>
              );
            })}
            <div className="tiny muted">→ 回答企画は次の動画の有力候補（質問文は②リスク管理のコメント一覧で確認）</div>
          </div>
        )}
        {weekly && (
          <div className="diag-weekly">
            <div className="diag-row-t">週次インサイト（{weeklyEnd} 週・<Link className="link-out" to="/weekly">全文 ↗</Link>）</div>
            <div>{weekly.insight}</div>
            <div style={{ marginTop: 4 }}><b>打ち手:</b> {weekly.action}</div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ===== 投稿ライブラリ（基本ページ版: 企画チャート/トップ投稿のみ） ===== */

export function PostLibraryBasic({ fNormal, periodLabel, avgViews, liveCount, onOpen }: {
  fNormal: Reel[]; periodLabel: string; avgViews: number | null; liveCount: number; onOpen: (r: Reel) => void;
}) {
  const [view, setView] = useState<"chart" | "top">("chart");
  const topReels = useMemo(() => [...fNormal].sort((x, y) => (y.views ?? 0) - (x.views ?? 0)).slice(0, 3), [fNormal]);
  const maxViews = fNormal.length ? Math.max(...fNormal.map((r) => r.views ?? 0)) : null;
  return (
    <div className="card card-pad">
      <div className="row between" style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <h2 className="sec-h" style={{ margin: 0 }}>
          投稿ライブラリ
          <span className="sec-sub">
            {view === "top"
              ? `${periodLabel}の累計再生数Top3`
              : `${periodLabel} ${fNormal.length}本${liveCount > 0 ? `（ライブ${liveCount}除外）` : ""} ・ 平均 ${compact(avgViews)} ・ 最高 ${compact(maxViews)}`}
          </span>
        </h2>
        <div className="segmented">
          <button className={view === "chart" ? "active" : ""} onClick={() => setView("chart")}>企画チャート</button>
          <button className={view === "top" ? "active" : ""} onClick={() => setView("top")}>トップ投稿（再生数順）</button>
        </div>
      </div>
      {view === "chart" ? (
        fNormal.length === 0 ? <div className="empty">この期間のリールデータがありません。</div> : <PostBarChart reels={fNormal} onOpen={onOpen} />
      ) : (
        fNormal.length === 0 ? <div className="empty">この期間のリールデータがありません。</div> : (
          <div className="posts-grid">{topReels.map((r, i) => <TopPostCard key={r.shortcode} reel={r} rank={i + 1} onOpen={onOpen} />)}</div>
        )
      )}
    </div>
  );
}

/** サムネイルのパス解決: ローカル保存分（失効しない）を最優先し、CDN URL（約4日で失効）は次点 */
function thumbSrc(reel: Reel): string | null {
  if (reel.thumb) return `${import.meta.env.BASE_URL}${reel.thumb}`;
  return reel.thumbnail_url;
}

export function TopPostCard({ reel, rank, onOpen }: { reel: Reel; rank: number; onOpen: (r: Reel) => void }) {
  const [img, setImg] = useState(thumbSrc(reel));
  return (
    <div className="card post-card" role="button" tabIndex={0}
      aria-label={`${reel.caption_excerpt || reel.shortcode} を再生`}
      onClick={() => onOpen(reel)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(reel); } }}>
      <div className={`post-hero ${img ? "" : "no-img"}`}>
        <span className={`rank-tag rk-${rank}`}>#{rank}</span>
        {img && <img className="post-hero-bg" src={img} alt={reel.caption_excerpt} referrerPolicy="no-referrer" onError={() => setImg(null)} />}
        <div className="post-hero-num"><span className="lead">{compact(reel.views)}</span><span className="unit">再生</span></div>
        <span className="play-badge" aria-hidden>▶</span>
      </div>
      <div className="body">
        <div className="post-cap">{reel.caption_excerpt || "（キャプションなし）"}</div>
        <div className="post-metrics">
          <span><i className="mi">♥</i><b>{num(reel.likes)}</b></span>
          <span><i className="mi">💬</i><b>{num(reel.comments)}</b></span>
          <span className="sep" />
          <span className="post-rate">拡散 <b style={{ color: spreadColor(reel.spread_rate) }}>{spreadLabel(reel.spread_rate)}</b></span>
        </div>
        <div className="tiny">{fullDate(reel.posted_at)} 投稿</div>
      </div>
    </div>
  );
}

/* ===== 昨日動いた投稿テーブル =====
 * 既定はサムネ+再生数+Δ再生+拡散率+反応率の5列（テキストだらけ対策で列を厳選）。
 * Δいいね・Δコメント・graph公式3列は「詳細列」トグルで展開する。
 * ヒート背景は拡散率のみ・色付きΔはΔ再生のみ（見るべき列を一意にする）。 */

type PostSort = "delta" | "views" | "engagement" | "watch" | "date";
const POST_SORTS: { key: PostSort; label: string }[] = [
  { key: "delta", label: "Δ再生順" },
  { key: "views", label: "再生順" },
  { key: "engagement", label: "反応率順" },
  { key: "date", label: "投稿日順" },
];

const POST_TABLE_CAP = 10;

/** 行内サムネ。ローカル保存分優先・読めない時は静かなグレー＋▶ */
function PostThumb({ reel }: { reel: Reel }) {
  const [src, setSrc] = useState(thumbSrc(reel));
  if (!src) return <span className="post-thumb-ph" aria-hidden>▶</span>;
  return <img className="post-thumb" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setSrc(null)} />;
}

export function PostTable({ reels, onOpen }: { reels: Reel[]; onOpen: (r: Reel) => void }) {
  const [sort, setSort] = useState<PostSort>("delta");
  const [ptype, setPtype] = useState<"reel" | "live" | "all">("reel");
  const [showAll, setShowAll] = useState(false);
  const [detail, setDetail] = useState(false);
  const liveCount = reels.filter((r) => r.is_live).length;
  const hasOfficial = reels.some((r) => r.insights_source === "graph");
  const showGraphCols = detail && hasOfficial;
  const filtered = useMemo(() => {
    const arr = reels.filter((r) => (ptype === "all" ? true : ptype === "live" ? r.is_live : !r.is_live));
    if (sort === "delta") arr.sort((a, b) => (b.views_delta_1d ?? Number.NEGATIVE_INFINITY) - (a.views_delta_1d ?? Number.NEGATIVE_INFINITY));
    else if (sort === "views") arr.sort((a, b) => (b.views ?? -1) - (a.views ?? -1));
    else if (sort === "engagement") arr.sort((a, b) => (b.engagement_rate ?? -1) - (a.engagement_rate ?? -1));
    else if (sort === "watch") arr.sort((a, b) => (b.avg_watch_time_sec ?? -1) - (a.avg_watch_time_sec ?? -1));
    else arr.sort((a, b) => (b.posted_at || "").localeCompare(a.posted_at || ""));
    return arr;
  }, [reels, sort, ptype]);
  const sorted = showAll ? filtered : filtered.slice(0, POST_TABLE_CAP);

  const maxDelta = Math.max(1, ...sorted.map((r) => Math.abs(r.views_delta_1d ?? 0)));
  const colCount = 5 + (detail ? 2 : 0) + (showGraphCols ? 3 : 0);

  return (
    <div>
      <div className="row between" style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div className="segmented">
          <button className={ptype === "reel" ? "active" : ""} onClick={() => setPtype("reel")}>リール</button>
          <button className={ptype === "live" ? "active" : ""} onClick={() => setPtype("live")}>ライブ{liveCount > 0 ? ` ${liveCount}` : ""}</button>
          <button className={ptype === "all" ? "active" : ""} onClick={() => setPtype("all")}>すべて</button>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <div className="segmented">
            {POST_SORTS.map((s) => (
              <button key={s.key} className={sort === s.key ? "active" : ""} onClick={() => setSort(s.key)}>{s.label}</button>
            ))}
            {showGraphCols && <button className={sort === "watch" ? "active" : ""} onClick={() => setSort("watch")}>平均視聴順</button>}
          </div>
          <button className={`toggle-btn detail-cols-btn ${detail ? "active" : ""}`} aria-pressed={detail}
            title="Δいいね・Δコメントと、Meta公式のリーチ・平均視聴・保存の列を表示します"
            onClick={() => { if (detail && sort === "watch") setSort("delta"); setDetail(!detail); }}>
            詳細列{detail ? " ▴" : " ▾"}
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="grid dense">
          <thead>
            <tr>
              <th>投稿</th><th className="num">再生数</th>
              <th className="num">Δ再生(昨日)</th>
              {detail && <><th className="num">Δいいね</th><th className="num">Δコメント</th></>}
              {showGraphCols && <><th className="num">リーチ</th><th className="num">平均視聴</th><th className="num">保存</th></>}
              <th className="num">拡散率</th><th className="num">反応率</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={colCount} className="muted">この期間のデータがありません</td></tr>}
            {sorted.map((r) => (
              <tr key={r.shortcode} onClick={() => onOpen(r)} title="クリックで動画を再生">
                <td style={{ maxWidth: 360 }}>
                  <div className="post-cell">
                    <PostThumb reel={r} />
                    <div className="post-cell-main">
                      <div className="post-cell-cap">
                        {r.is_live && <span className="tag neutral" style={{ marginRight: 6 }}>ライブ</span>}
                        {r.caption_excerpt || r.shortcode}
                      </div>
                      <div className="post-cell-date">{fullDate(r.posted_at)}</div>
                    </div>
                  </div>
                </td>
                <td className="num">{compact(r.views)}</td>
                <td className="num delta-cell">
                  {r.views_delta_1d == null ? <span className="muted">—</span> : (
                    <>
                      <i className="delta-bar" style={{ width: `${Math.min(100, (Math.abs(r.views_delta_1d) / maxDelta) * 100)}%`,
                        background: r.views_delta_1d >= 0 ? "var(--data-1-soft)" : "var(--crit-soft)" }} />
                      <b style={{ color: deltaColor(r.views_delta_1d), position: "relative" }}>{signedCompact(r.views_delta_1d)}</b>
                    </>
                  )}
                </td>
                {detail && <>
                  <td className="num">
                    {r.likes_delta_1d == null ? <span className="muted">—</span> : <span>{signedCompact(r.likes_delta_1d)}</span>}
                  </td>
                  <td className="num">
                    {r.comments_delta_1d == null ? <span className="muted">—</span>
                      : <span title="コメント増はネガ増を含む場合があるため中立表示">{signedCompact(r.comments_delta_1d)}</span>}
                  </td>
                </>}
                {showGraphCols && <>
                  <td className="num">{compact(r.reach)}</td>
                  <td className="num">{r.avg_watch_time_sec == null ? <span className="muted">—</span> : <b>{r.avg_watch_time_sec.toFixed(1)}秒</b>}</td>
                  <td className="num">{num(r.saved)}</td>
                </>}
                <td className="num"><span className="cell-heat" style={{ background: spreadHeat(r.spread_rate) }}>{spreadLabel(r.spread_rate)}</span></td>
                <td className="num">{pct(r.engagement_rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > POST_TABLE_CAP && (
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <button className="link-btn" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "上位のみ表示" : `全 ${filtered.length} 本を表示`}
          </button>
        </div>
      )}
    </div>
  );
}

/* ===== キャプション分析 ===== */

export function Qualitative({ reels }: { reels: Reel[] }) {
  const [hook, setHook] = useState<string | null>(null);
  const hooks = useMemo(() => {
    const m = new Map<string, number>();
    reels.forEach((r) => { const h = r.analysis.hook_type; if (h) m.set(h, (m.get(h) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [reels]);
  const shown = hook ? reels.filter((r) => r.analysis.hook_type === hook) : reels;

  return (
    <div>
      {hooks.length > 0 && (
        <div className="qual-summary">
          <span className={`chip ${hook === null ? "active" : ""}`} onClick={() => setHook(null)} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") setHook(null); }}>すべて {reels.length}</span>
          {hooks.map(([h, n]) => (
            <span key={h} className={`chip ${hook === h ? "active" : ""}`} onClick={() => setHook(h)} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") setHook(h); }}>{h} {n}</span>
          ))}
        </div>
      )}
      {shown.map((r) => {
        const an = r.analysis;
        return (
          <div className="qual-item" key={r.shortcode}>
            <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              {an.hook_type && <span className="tag">{an.hook_type}</span>}
              {an.topic_tags.slice(0, 4).map((t) => <span className="tag neutral" key={t}>#{t}</span>)}
              <span className="tiny" style={{ marginLeft: "auto" }}>{fullDate(r.posted_at)} ・ ▶{compact(r.views)} ・ 拡散率{spreadLabel(r.spread_rate)}</span>
            </div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{r.caption_excerpt || r.shortcode}</div>
            {an.transcript_summary && <div className="insight">🎙️ {an.transcript_summary}</div>}
            {an.insight && <div className="insight">{an.insight}</div>}
            {an.trend_note && <div className="trend-note">{an.trend_note}</div>}
            <div style={{ marginTop: 6 }}><a className="link-out tiny" href={r.url} target="_blank" rel="noreferrer">リールを開く ↗</a></div>
          </div>
        );
      })}
    </div>
  );
}

/* ===== コメント一覧 ===== */

const CAT_ORDER = ["anti", "complaint", "legal_risk", "question", "positive", "neutral"];
const isNegativeComment = (c: ReelComment) =>
  c.sentiment === "negative" || (c.category != null && NEG_CATS.has(c.category));

function CatBadge({ category }: { category: string | null }) {
  return <span className={`cat-badge cat-${category ?? "none"}`}>{commentCategoryLabel(category)}</span>;
}

export function CommentsSection({ comments, stats, handle }: { comments: ReelComment[] | undefined; stats: CommentStats | null; handle: string }) {
  const [cat, setCat] = useState<string>("all");
  const [negOnly, setNegOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const all = useMemo(() => comments ?? [], [comments]);

  const filtered = useMemo(() => all.filter((c) => {
    if (cat === "none") { if (c.category != null) return false; }
    else if (cat !== "all" && c.category !== cat) return false;
    if (negOnly && !isNegativeComment(c)) return false;
    return true;
  }), [all, cat, negOnly]);
  // 最大500行を常時DOMに出すとスクロールが破綻するため既定20行（CSVは常に全件）
  const COMMENT_CAP = 20;
  const shown = showAll ? filtered : filtered.slice(0, COMMENT_CAP);

  if (all.length === 0) {
    return <div className="empty">コメントデータ未収集（API連携後に表示されます）</div>;
  }

  const exportCSV = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["日時", "投稿", "投稿URL", "投稿者", "本文", "いいね", "カテゴリ", "センチメント", "重大度"];
    const lines = filtered.map((c) => [
      c.posted_at || c.first_seen_at,
      c.caption_excerpt,
      c.reel_url,
      c.author ?? "",
      c.text ?? "",
      c.like_count,
      commentCategoryLabel(c.category),
      c.sentiment ?? "",
      c.severity ?? "",
    ].map(esc).join(","));
    // BOM付きUTF-8（Excelで文字化けさせないため）
    const csv = "\uFEFF" + [header.map(esc).join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = `comments-${handle}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.csv`;
    document.body.appendChild(el);
    el.click();
    el.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {stats && (
        <div className="comment-stats">
          <span>総コメント <b>{num(stats.total)}</b></span>
          <span>ネガティブ <b style={{ color: stats.negative > 0 ? "var(--crit)" : "var(--text)" }}>{num(stats.negative)}</b></span>
          {CAT_ORDER.filter((k) => (stats.by_category?.[k] ?? 0) > 0).map((k) => (
            <span key={k} className={`cat-badge cat-${k}`}>{COMMENT_CATEGORY_LABEL[k]} {stats.by_category[k]}</span>
          ))}
        </div>
      )}
      <div className="row between" style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <label className="visually-hidden" htmlFor="comment-cat">カテゴリで絞り込み</label>
          <select id="comment-cat" className="period-select" value={cat}
            onChange={(e) => { setCat(e.target.value); setShowAll(false); }}>
            <option value="all">全カテゴリ</option>
            {CAT_ORDER.map((k) => <option key={k} value={k}>{COMMENT_CATEGORY_LABEL[k]}</option>)}
            <option value="none">未分類</option>
          </select>
          <button className={`toggle-btn ${negOnly ? "active" : ""}`} aria-pressed={negOnly}
            onClick={() => { setNegOnly((v) => !v); setShowAll(false); }}>ネガのみ</button>
          <span className="tiny">{filtered.length} / {all.length} 件</span>
        </div>
        <button className="csv-btn" onClick={exportCSV}>CSVエクスポート</button>
      </div>
      <div className="table-wrap">
        <table className="grid comments-table dense">
          <thead>
            <tr>
              <th>日時</th><th>投稿</th><th>投稿者</th><th>本文</th>
              <th className="num">いいね</th><th>カテゴリ</th><th className="num">重大度</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} className="muted">条件に合うコメントがありません</td></tr>}
            {shown.map((c) => (
              <tr key={c.comment_id}>
                <td className="muted">{fullDate(c.posted_at || c.first_seen_at)}</td>
                <td>
                  <a className="link-out reel-link" href={c.reel_url} target="_blank" rel="noreferrer" title={c.caption_excerpt}>
                    {c.caption_excerpt || c.shortcode} ↗
                  </a>
                </td>
                <td className="muted">{c.author ?? "—"}</td>
                <td className="comment-text">{c.text ?? "—"}</td>
                <td className="num">{num(c.like_count)}</td>
                <td><CatBadge category={c.category} /></td>
                <td className="num">
                  {c.severity == null ? <span className="muted">—</span>
                    : c.severity >= 2 ? <span className="sev-hi" title="重大度2以上">{c.severity}</span>
                    : c.severity}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > COMMENT_CAP && (
        <button className="link-btn" style={{ marginTop: 8 }} onClick={() => setShowAll((v) => !v)}>
          {showAll ? "先頭20件に折りたたむ ▴" : `全 ${filtered.length} 件を表示 ▾`}
        </button>
      )}
    </div>
  );
}
