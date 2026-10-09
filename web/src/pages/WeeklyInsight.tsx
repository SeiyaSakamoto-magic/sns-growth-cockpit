import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchWeeklyIndex, fetchWeeklyReport } from "../lib/data";
import type { WeeklyIndexEntry, WeeklyReport, WeeklyAccountInsight, WeeklyVerdict } from "../lib/types";
import { compact, signedCompact, deltaColor, shortDate, fullDateTime } from "../lib/format";

/* ===== verdict（判定）の表示定義。--ok/--warn/--crit 系パレットに対応 ===== */
const VERDICT: Record<WeeklyVerdict, { label: string; cls: string }> = {
  up: { label: "伸び", cls: "up" },
  flat: { label: "横ばい", cls: "flat" },
  down: { label: "失速", cls: "down" },
  risk: { label: "要注意", cls: "risk" },
};
/** 並び順: 要注意を先頭に */
const VERDICT_ORDER: Record<WeeklyVerdict, number> = { risk: 0, down: 1, up: 2, flat: 3 };

/** 前週比 +62% / -30% 表示（nullは非表示側で処理） */
function wowLabel(p: number | null | undefined): string {
  if (p == null) return "—";
  const v = Math.abs(p) >= 10 ? Math.round(p).toString() : p.toFixed(1).replace(/\.0$/, "");
  return `${p > 0 ? "+" : ""}${v}%`;
}

type IndexState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error"; message: string }
  | { status: "ok"; weeks: WeeklyIndexEntry[] };

type ReportState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error"; message: string }
  | { status: "ok"; data: WeeklyReport };

export default function WeeklyInsightPage() {
  const [index, setIndex] = useState<IndexState>({ status: "loading" });
  const [selected, setSelected] = useState<string>(""); // 週ファイル名
  const [report, setReport] = useState<ReportState>({ status: "loading" });

  // 1段目: index.json（週一覧）
  useEffect(() => {
    fetchWeeklyIndex()
      .then((idx) => {
        if (!idx || !Array.isArray(idx.weeks) || idx.weeks.length === 0) {
          setIndex({ status: "missing" });
          return;
        }
        setIndex({ status: "ok", weeks: idx.weeks });
        setSelected(idx.weeks[0].file); // week_end降順ソート済み → 先頭が最新週
      })
      .catch((e) => setIndex({ status: "error", message: String(e) }));
  }, []);

  // 2段目: 選択週の本体
  useEffect(() => {
    if (!selected) return;
    setReport({ status: "loading" });
    fetchWeeklyReport(selected)
      .then((d) => setReport(d ? { status: "ok", data: d } : { status: "missing" }))
      .catch((e) => setReport({ status: "error", message: String(e) }));
  }, [selected]);

  if (index.status === "loading") {
    return <main className="content"><div className="loading" role="status" aria-live="polite">読み込み中…</div></main>;
  }

  if (index.status === "error") {
    return (
      <main className="content">
        <div className="error-box card card-pad" role="alert">
          <div style={{ fontWeight: 700, fontSize: 16 }}>データの読み込みに失敗しました</div>
          <Link to="/" className="link-out" style={{ display: "inline-block", marginTop: 10 }}>← ダッシュボードに戻る</Link>
          <details><summary>技術的な詳細</summary>{index.message}</details>
        </div>
      </main>
    );
  }

  if (index.status === "missing") {
    return (
      <main className="content wrap-gap">
        <div>
          <Link to="/" className="back-link">← ダッシュボードに戻る</Link>
          <h1 style={{ margin: "0 0 4px", fontSize: 24, letterSpacing: "-0.02em" }}>週次インサイト</h1>
        </div>
        <div className="card card-pad">
          <div className="empty">週次レポート未生成（毎週月曜朝に自動生成されます）</div>
        </div>
      </main>
    );
  }

  const weeks = index.weeks;
  const d = report.status === "ok" ? report.data : null;

  return (
    <main className="content wrap-gap">
      {/* ===== ヘッダ: タイトル + 週セレクタ + 生成情報 ===== */}
      <div>
        <Link to="/" className="back-link">← ダッシュボードに戻る</Link>
        <div className="row between" style={{ flexWrap: "wrap", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 24, letterSpacing: "-0.02em" }}>週次インサイト</h1>
          <div className="row" style={{ gap: 8 }}>
            <label className="visually-hidden" htmlFor="week-select">週を選択</label>
            <select id="week-select" className="period-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
              {weeks.map((w) => (
                <option key={w.file} value={w.file}>{shortDate(w.week_start)}〜{shortDate(w.week_end)}</option>
              ))}
            </select>
          </div>
        </div>
        {/* 目的の常設表示（「これは何？」に画面が答える） */}
        {d?.purpose && <p className="weekly-purpose">{d.purpose}</p>}
        {d && (
          <div className="tiny">
            対象週 {shortDate(d.week_start)}〜{shortDate(d.week_end)} ・ 生成日時 {fullDateTime(d.generated_at)}
            {d.model && <span className="tag neutral" style={{ marginLeft: 8 }}>{d.model}</span>}
          </div>
        )}
      </div>

      {report.status === "loading" && <div className="loading" role="status" aria-live="polite">読み込み中…</div>}

      {report.status === "missing" && (
        <div className="card card-pad">
          <div className="empty">週次レポート未生成（毎週月曜朝に自動生成されます）</div>
        </div>
      )}

      {report.status === "error" && (
        <div className="error-box card card-pad" role="alert">
          <div style={{ fontWeight: 700, fontSize: 16 }}>データの読み込みに失敗しました</div>
          <details><summary>技術的な詳細</summary>{report.message}</details>
        </div>
      )}

      {d && <ReportBody d={d} />}
    </main>
  );
}

function ReportBody({ d }: { d: WeeklyReport }) {
  const accounts = [...(d.accounts ?? [])].sort(
    (a, b) => (VERDICT_ORDER[a.verdict] ?? 9) - (VERDICT_ORDER[b.verdict] ?? 9),
  );
  const risks = d.risks ?? [];
  const nextActions = d.next_actions ?? [];

  return (
    <>
      {/* ===== 全体サマリー ===== */}
      <div className="card card-pad weekly-summary">
        <h2 className="sec-h">全体サマリー</h2>
        <div className="weekly-headline">{d.overall?.headline ?? "—"}</div>
        {(d.overall?.bullets ?? []).length > 0 && (
          <ul className="weekly-bullets">
            {d.overall.bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        )}
      </div>

      {/* ===== アカウント別カード（risk → down → up → flat） ===== */}
      {accounts.length > 0 && (
        <div>
          <h2 className="sec-h" style={{ margin: "4px 0 12px" }}>アカウント別</h2>
          <div className="weekly-grid">
            {accounts.map((a) => <AccountCard key={a.handle} a={a} />)}
          </div>
        </div>
      )}

      {/* ===== リスク ===== */}
      <div className="card card-pad">
        <h2 className="sec-h">リスク</h2>
        {risks.length === 0 ? (
          <div className="tiny" style={{ padding: "4px 0" }}>今週の重大リスクなし</div>
        ) : (
          <div className="weekly-risk-list">
            {risks.map((r, i) => (
              <div className="weekly-risk" key={i}>
                <span className="weekly-risk-icon" aria-hidden title={r.source === "comments" ? "コメント由来" : "数値由来"}>
                  {r.source === "comments" ? "💬" : "📉"}
                </span>
                <div>
                  <b>{r.client}</b> <span className="tiny">@{r.handle}</span>
                  <div className="weekly-risk-note">{r.note}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== 来週の打ち手 ===== */}
      {nextActions.length > 0 && (
        <div className="card card-pad">
          <h2 className="sec-h">来週の打ち手</h2>
          <div className="weekly-next-list">
            {nextActions.map((na, i) => (
              <div className="weekly-next-item" key={i}>
                <span className="weekly-check" aria-hidden>☐</span>
                <span className="tag neutral weekly-target">{na.target}</span>
                <div>
                  <b>{na.title}</b>
                  {na.detail && <div className="tiny" style={{ marginTop: 2 }}>{na.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function AccountCard({ a }: { a: WeeklyAccountInsight }) {
  const v = VERDICT[a.verdict] ?? VERDICT.flat;
  const wow = a.views_wow_pct;
  const neg = a.negative_comments_7d;
  return (
    <div className="card card-pad weekly-acct">
      {/* ヘッダ行: client + @handle + verdictチップ */}
      <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}>
        <div className="weekly-acct-name">
          <b>{a.client}</b>
          <Link className="tiny weekly-handle" to={`/account/${a.handle}`}>@{a.handle}</Link>
        </div>
        <span className={`verdict-chip ${v.cls}`}>{v.label}</span>
      </div>

      {/* 数値行（決定論データ） */}
      <div className="weekly-nums">
        <span>週間再生 <b>{compact(a.week_views)}</b></span>
        <span>前週比 <b style={{ color: wow == null || wow === 0 ? "var(--text-3)" : wow > 0 ? "var(--ok)" : "var(--crit)" }}>{wowLabel(wow)}</b></span>
        <span>フォロワー <b style={{ color: deltaColor(a.followers_delta_7d) }}>{signedCompact(a.followers_delta_7d)}</b></span>
        <span>投稿 <b>{a.posts_7d == null ? "—" : `${a.posts_7d}本`}</b></span>
        <span>ネガコメ <b style={{ color: neg != null && neg > 0 ? "var(--crit)" : "var(--text)" }}>{neg ?? "—"}</b></span>
      </div>

      {/* Meta公式インサイト行（Graph移行済みアカウントのみ・値がある項目だけ出す） */}
      {(a.profile_views_7d != null || a.saved_7d != null || a.stories_7d != null) && (
        <div className="weekly-nums" title="Meta公式インサイト（Graph API連携済みアカウントのみ）">
          {a.profile_views_7d != null && (
            <span>プロフ閲覧 <b>{compact(a.profile_views_7d)}</b>
              {a.profile_views_prev_7d != null && a.profile_views_prev_7d > 0 && (
                <span className="tiny" style={{ color: deltaColor(a.profile_views_7d - a.profile_views_prev_7d) }}>
                  {" "}({signedCompact(a.profile_views_7d - a.profile_views_prev_7d)})
                </span>
              )}
            </span>
          )}
          {a.website_clicks_7d != null && <span>リンク <b>{compact(a.website_clicks_7d)}</b></span>}
          {a.saved_7d != null && <span>保存 <b>{compact(a.saved_7d)}</b></span>}
          {a.shares_7d != null && <span>シェア <b>{compact(a.shares_7d)}</b></span>}
          {a.stories_7d != null && (
            <span>ストーリー <b>{a.stories_7d}本</b>{(a.story_replies_7d ?? 0) > 0 && <span className="tiny"> 返信{a.story_replies_7d}</span>}</span>
          )}
        </div>
      )}

      {/* トップリール */}
      {a.top_reel && (
        <div className="weekly-top-reel">
          <span aria-hidden>🎬</span>
          <a className="link-out" href={a.top_reel.url} target="_blank" rel="noreferrer">
            {a.top_reel.caption_excerpt || a.top_reel.shortcode} ↗
          </a>
          {a.top_reel.week_views_delta != null && (
            <b className="weekly-reel-delta">{signedCompact(a.top_reel.week_views_delta)}(週)</b>
          )}
        </div>
      )}

      {/* 要因仮説 → 打ち手 */}
      {a.insight && <div className="weekly-insight-line">{a.insight}</div>}
      {a.action && <div className="weekly-action-line">→ {a.action}</div>}
    </div>
  );
}
