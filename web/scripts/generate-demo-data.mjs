#!/usr/bin/env node
/**
 * 架空アカウントのデモデータを web/public/data/ に生成する。
 * 実在のアカウント・顧客の情報は一切含まない。乱数は固定シードなので毎回同じ内容になる
 * （日付だけは実行日を起点にずらし、いつ見ても「最新の運用」に見えるようにする）。
 *
 *   node scripts/generate-demo-data.mjs              # 生成（上書き）
 *   node scripts/generate-demo-data.mjs --if-missing # 既にあれば何もしない（npm run dev / build の前処理）
 */
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "data");
if (process.argv.includes("--if-missing") && existsSync(join(OUT, "summary.json"))) process.exit(0);

// ---------- 乱数（mulberry32・固定シード） ----------
let seed = 20261009;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (a, b) => a + (b - a) * rand();
const int = (a, b) => Math.round(between(a, b));
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
const logNormal = (median, spread) => median * Math.exp(spread * (rand() + rand() + rand() - 1.5));

// ---------- 日付 ----------
const DAY = 86400000;
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const iso = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${ymd(d)}T${p(d.getHours())}:${p(d.getMinutes())}:00+09:00`;
};
const daysAgo = (n, h = 12, m = 0) => new Date(today.getTime() - n * DAY + h * 3600000 + m * 60000);
const asOf = daysAgo(0, 9, 5);

// ---------- 架空アカウント ----------
const HANDLE = "sample_roastery_demo";
const ACCOUNT = {
  client_name: "サンプル焙煎所",
  display_name: "Sample Roastery（架空のデモアカウント）",
  handle: HANDLE,
  url: "https://example.com/sample_roastery_demo",
};
const BUSINESS_GOAL = {
  label: "オンラインストアへの送客",
  description: "SNSで認知 → プロフィール → リンククリック → 定期便の購入、のファネル前段を担う",
  related_metrics: ["website_clicks", "profile_views"],
  source: "manual",
};
const SPREAD_CRITICAL = 0.1;
const SPREAD_WARNING = 0.3;

// ---------- 企画の型（フック）とテーマ ----------
const HOOKS = [
  { name: "数字で言い切る", power: 1.6, color: ["#e08a5f", "#c4452f"] },
  { name: "ビフォーアフター", power: 1.35, color: ["#7b6ef6", "#b85bd6"] },
  { name: "あるある共感", power: 1.1, color: ["#3f8f5f", "#2f7a6e"] },
  { name: "ハウツー", power: 0.85, color: ["#d98a3a", "#c4612f"] },
  { name: "お店の裏側", power: 0.6, color: ["#5b8fd6", "#4a47c4"] },
];
const TOPICS = [
  { tag: "抽出", captions: ["ハンドドリップの湯温を3℃変えるだけで味が変わる話", "ペーパーフィルターを湯通しする理由", "蒸らし30秒を守るとこうなる", "アイスコーヒーが薄くならない淹れ方"] },
  { tag: "豆知識", captions: ["浅煎りと深煎り、カフェインが多いのはどっち？", "コーヒー豆は冷凍保存でいい？", "産地で味はここまで変わる", "スペシャルティコーヒーの定義を30秒で"] },
  { tag: "焙煎", captions: ["焙煎1分の差で別物になる", "焙煎機の中で豆に起きていること", "ハゼの音を聞いてください", "焙煎したての豆はすぐ飲まない方がいい理由"] },
  { tag: "店舗裏側", captions: ["開店前の1時間に密着", "検品で弾く豆の割合", "新人スタッフのカッピング練習", "定休日にやっていること"] },
  { tag: "新商品", captions: ["秋限定ブレンドができるまで", "定期便のおすすめ3種", "ギフトセットの中身を全部見せます", "デカフェでも香りが立つ理由"] },
];

// ---------- フォロワー推移 ----------
const HISTORY_DAYS = 120;
const followerHistory = [];
let followers = 11800;
for (let i = HISTORY_DAYS; i >= 0; i--) {
  const trend = i < 45 ? between(4, 22) : between(-3, 12); // 直近1.5か月で企画を変えて伸び始めた設定
  followers += Math.round(trend);
  followerHistory.push({ date: ymd(daysAgo(i)), followers });
}
const followerAt = (date) => (followerHistory.find((p) => p.date >= date) ?? followerHistory.at(-1)).followers;
const currentFollowers = followerHistory.at(-1).followers;

// ---------- リール ----------
const reels = [];
let n = 0;
for (let d = HISTORY_DAYS; d >= 1; d -= int(2, 4)) {
  n++;
  const recent = d < 45;
  // 直近は「数字で言い切る」「ビフォーアフター」に寄せた＝改善ループが効いた、という筋書き
  const hook = recent && rand() < 0.6 ? pick(HOOKS.slice(0, 2)) : pick(HOOKS);
  const topic = pick(TOPICS);
  const caption = pick(topic.captions);
  const posted = daysAgo(d, int(18, 21), pick([0, 15, 30]));
  const f = followerAt(ymd(posted));
  const age = Math.max(1, d);
  const maturity = Math.min(1, 0.35 + Math.log10(age + 1) / 1.6);
  const views = Math.round(logNormal(f * 0.42 * hook.power * (recent ? 1.25 : 1), 1.1) * maturity);
  const likes = Math.round(views * between(0.025, 0.06));
  const comments = Math.max(0, Math.round(views * between(0.0015, 0.005)));
  const reach = Math.round(views * between(0.72, 0.88));
  const duration = int(18, 58);
  const avgWatch = Math.round(duration * between(0.28, 0.62) * 10) / 10;
  const sc = `DEMO${String(n).padStart(3, "0")}`;
  reels.push({
    shortcode: sc,
    url: `https://example.com/reels/${sc}`,
    caption: `${caption}\n\n#${topic.tag} #コーヒーのある暮らし #サンプル焙煎所`,
    caption_excerpt: caption,
    posted_at: iso(posted),
    posted_month: ymd(posted).slice(0, 7),
    thumbnail_url: null,
    thumb: `data/thumbs/${sc}.svg`,
    video_url: null,
    video_duration: duration,
    is_live: false,
    views,
    likes,
    comments,
    spread_rate: views / f,
    engagement_rate: views ? (likes + comments) / views : null,
    analysis: {
      hook_type: hook.name,
      topic_tags: [topic.tag],
      insight: views / f >= 1
        ? "冒頭1秒で結論の数字を出し、最後まで見る理由を作れている"
        : views / f < SPREAD_WARNING
          ? "冒頭が説明から入っており、スクロールを止める要素が弱い"
          : "保存はされているが、シェアされる一言が足りない",
      trend_note: null,
      transcript_summary: `${caption}を、${hook.name}の構成で${duration}秒にまとめた動画`,
    },
    views_delta_1d: d <= 14 ? Math.round(views * between(0.01, 0.12) * (d <= 3 ? 4 : 1)) : int(0, 40),
    likes_delta_1d: d <= 14 ? int(1, 60) : int(0, 3),
    comments_delta_1d: d <= 14 ? int(0, 6) : 0,
    insights_source: "graph",
    insights_as_of: iso(asOf),
    reach,
    saved: Math.round(views * between(0.004, 0.02) * (topic.tag === "抽出" || topic.tag === "豆知識" ? 1.8 : 1)),
    shares: Math.round(views * between(0.002, 0.01) * hook.power),
    follows: null,
    follow_conversion_rate: null,
    avg_watch_time_sec: avgWatch,
    total_watch_time_sec: Math.round(avgWatch * views),
    _hook: hook,
  });
}
reels.sort((a, b) => b.posted_at.localeCompare(a.posted_at));

// ---------- コメント（分類済み） ----------
const COMMENT_TEMPLATES = [
  { category: "positive", severity: 0, sentiment: "positive", texts: ["今日さっそく試しました！全然違う", "わかりやすすぎる…保存しました", "この豆、定期便で頼んでます", "店舗の雰囲気が好きです"] },
  { category: "question", severity: 1, sentiment: "neutral", texts: ["フレンチプレスでも同じですか？", "おすすめのミルはありますか？", "ギフトの配送日指定はできますか？", "デカフェはオンラインでも買えますか？"] },
  { category: "neutral", severity: 0, sentiment: "neutral", texts: ["なるほど", "へー知らなかった", "☕️☕️", "週末行ってみます"] },
  { category: "complaint", severity: 2, sentiment: "negative", texts: ["前回の定期便、届くのが3日遅れました。連絡もなかったです", "送料がもう少し安ければ…", "注文した豆と違うものが届きました"] },
  { category: "anti", severity: 2, sentiment: "negative", texts: ["結局どこも同じ味でしょ", "宣伝ばっかりでつまらない"] },
  { category: "legal_risk", severity: 3, sentiment: "negative", texts: ["『カフェインで脂肪が燃える』って根拠あるんですか？誇大広告では？"] },
];
const comments = [];
let cid = 0;
for (const r of reels.slice(0, 24)) {
  const k = Math.min(r.comments, int(2, 6));
  for (let i = 0; i < k; i++) {
    const roll = rand();
    const tpl = roll < 0.45 ? COMMENT_TEMPLATES[0] : roll < 0.75 ? COMMENT_TEMPLATES[1] : roll < 0.93 ? COMMENT_TEMPLATES[2] : roll < 0.98 ? COMMENT_TEMPLATES[3] : COMMENT_TEMPLATES[4];
    const postedAt = new Date(new Date(r.posted_at).getTime() + between(0.1, 3) * DAY);
    comments.push(makeComment(r, tpl, pick(tpl.texts), postedAt));
  }
}
// デモで必ず見せたい「要対応」：直近のクレーム・薬機法/景表法リスク
const fresh = reels.filter((r) => Date.now() - new Date(r.posted_at).getTime() < 6 * DAY);
const target = fresh[0] ?? reels[0];
comments.push(makeComment(target, COMMENT_TEMPLATES[5], COMMENT_TEMPLATES[5].texts[0], new Date(Date.now() - 5 * 3600000)));
comments.push(makeComment(target, COMMENT_TEMPLATES[3], COMMENT_TEMPLATES[3].texts[0], new Date(Date.now() - 20 * 3600000)));
comments.push(makeComment(fresh[1] ?? reels[1], COMMENT_TEMPLATES[4], COMMENT_TEMPLATES[4].texts[1], new Date(Date.now() - 2 * DAY)));
comments.sort((a, b) => b.first_seen_at.localeCompare(a.first_seen_at));

function makeComment(r, tpl, text, postedAt) {
  cid++;
  return {
    comment_id: `demo-c${cid}`,
    shortcode: r.shortcode,
    reel_url: r.url,
    caption_excerpt: r.caption_excerpt,
    author: `demo_user_${String(cid).padStart(3, "0")}`,
    text,
    like_count: int(0, 12),
    posted_at: iso(postedAt),
    first_seen_at: iso(postedAt),
    category: tpl.category,
    severity: tpl.severity,
    sentiment: tpl.sentiment,
  };
}
const byCategory = {};
for (const c of comments) byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
const commentStats = { total: comments.length, negative: comments.filter((c) => c.sentiment === "negative").length, by_category: byCategory };

// ---------- 日次（アカウント全体） ----------
const dailyTotals = [];
const accountInsights = [];
for (let i = 90; i >= 1; i--) {
  const date = ymd(daysAgo(i));
  const lift = i < 45 ? 1.35 : 1;
  const views = Math.round(between(2500, 9000) * lift);
  dailyTotals.push({
    date,
    views_delta: views,
    likes_delta: Math.round(views * between(0.03, 0.05)),
    comments_delta: int(2, 18),
    negative_comments: rand() < 0.15 ? 1 : 0,
  });
  const reach = Math.round(views * between(0.6, 0.8));
  accountInsights.push({
    date,
    profile_views: Math.round(reach * between(0.04, 0.07)),
    website_clicks: Math.round(reach * between(0.004, 0.012) * lift),
    reach,
    accounts_engaged: Math.round(reach * between(0.03, 0.06)),
    views,
    total_interactions: Math.round(views * between(0.035, 0.06)),
    follows: int(8, 30),
    unfollows: int(2, 10),
  });
}

// ---------- ストーリー ----------
const stories = [];
for (let i = 13; i >= 0; i--) {
  const k = int(0, 3);
  for (let j = 0; j < k; j++) {
    const v = Math.round(currentFollowers * between(0.05, 0.11));
    stories.push({
      story_id: `demo-s${i}-${j}`,
      media_type: pick(["IMAGE", "VIDEO"]),
      permalink: null,
      posted_at: iso(daysAgo(i, int(8, 21))),
      views: v,
      reach: Math.round(v * 0.92),
      replies: int(0, 4),
      navigation: Math.round(v * between(0.6, 1.1)),
      thumb: null,
    });
  }
}
stories.sort((a, b) => b.posted_at.localeCompare(a.posted_at));
const stories7d = stories.filter((s) => Date.now() - new Date(s.posted_at).getTime() <= 7 * DAY);
const medianOf = (xs) => {
  const v = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

// ---------- 集計・診断 ----------
const statusOf = (s) => (s == null ? "unknown" : s < SPREAD_CRITICAL ? "critical" : s < SPREAD_WARNING ? "warning" : "ok");
const recent30 = reels.filter((r) => Date.now() - new Date(r.posted_at).getTime() <= 30 * DAY);
const medianSpread = medianOf(recent30.map((r) => r.spread_rate));
const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const diagReel = (r) => ({ caption_excerpt: r.caption_excerpt, shortcode: r.shortcode, url: r.url, spread_rate: r.spread_rate, views: r.views, hook_type: r.analysis.hook_type });
const sortedBySpread = [...recent30].sort((a, b) => b.spread_rate - a.spread_rate);
const hookStats = HOOKS.map((h) => {
  const rs = reels.filter((r) => r._hook === h);
  return { name: h.name, avg_spread: avg(rs.map((r) => r.spread_rate)) ?? 0, count: rs.length };
}).filter((h) => h.count > 0).sort((a, b) => b.avg_spread - a.avg_spread);
const diagnosis = {
  headline: `直近30日は「${hookStats[0].name}」型が拡散率トップ。「${hookStats.at(-1).name}」型は伸びにくく、本数を減らす余地あり`,
  stats: {
    total: recent30.length,
    crit: recent30.filter((r) => r.spread_rate < SPREAD_CRITICAL).length,
    warn: recent30.filter((r) => r.spread_rate >= SPREAD_CRITICAL && r.spread_rate < SPREAD_WARNING).length,
    ok: recent30.filter((r) => r.spread_rate >= SPREAD_WARNING).length,
    avg_spread: avg(recent30.map((r) => r.spread_rate)) ?? 0,
    avg_engagement: avg(recent30.map((r) => r.engagement_rate ?? 0)),
  },
  best: diagReel(sortedBySpread[0]),
  worst: diagReel(sortedBySpread.at(-1)),
  hooks: hookStats,
  direction: { label: "攻め継続", detail: "新規リーチは伸びている。保存されやすい抽出・豆知識テーマを、強いフックで出し続ける" },
  recommendations: [
    `「${hookStats[0].name}」の冒頭で、抽出・豆知識テーマを週2本つくる`,
    "「お店の裏側」はストーリーに回し、リールの枠を空ける",
    "保存率の高い投稿の最後に、オンラインストアへの一言導線を足す",
  ],
};
const alerts = recent30
  .filter((r) => r.spread_rate < SPREAD_CRITICAL)
  .slice(0, 3)
  .map((r, i) => ({
    severity: "critical",
    kind: "low_spread_rate",
    message: `拡散率 ${(r.spread_rate * 100).toFixed(1)}%：「${r.caption_excerpt}」がフォロワー外に届いていません`,
    collected_at: iso(asOf),
    reel_id: i + 1,
  }));

const monthly = [];
for (const month of [...new Set(reels.map((r) => r.posted_month))].sort()) {
  const rs = reels.filter((r) => r.posted_month === month);
  const total = rs.reduce((s, r) => s + r.views, 0);
  monthly.push({ month, posts: rs.length, total_views: total, avg_views: Math.round(total / rs.length), avg_spread: avg(rs.map((r) => r.spread_rate)) });
}

const thisMonth = ymd(today).slice(0, 7);
const lowSpread = recent30.filter((r) => r.spread_rate < SPREAD_CRITICAL);
const fh = followerHistory;
const accountSummary = {
  ...ACCOUNT,
  profile_pic_url: null,
  data_as_of: iso(asOf),
  data_stale: false,
  awaiting_permission: false,
  follower_count: currentFollowers,
  reel_count: reels.length,
  live_count: 0,
  avg_spread_rate: avg(reels.map((r) => r.spread_rate)),
  avg_engagement_rate: avg(reels.map((r) => r.engagement_rate ?? 0)),
  latest_post_at: reels[0].posted_at,
  status: statusOf(medianSpread),
  followers_delta_1d: fh.at(-1).followers - fh.at(-2).followers,
  views_delta_1d: reels.reduce((s, r) => s + (r.views_delta_1d ?? 0), 0),
  likes_delta_1d: reels.reduce((s, r) => s + (r.likes_delta_1d ?? 0), 0),
  comments_delta_1d: reels.reduce((s, r) => s + (r.comments_delta_1d ?? 0), 0),
  new_posts_1d: reels.filter((r) => Date.now() - new Date(r.posted_at).getTime() <= DAY).length,
  negative_comments_1d: comments.filter((c) => c.sentiment === "negative" && Date.now() - new Date(c.first_seen_at).getTime() <= DAY).length,
  median_spread_rate: medianSpread,
  pace_ratio: null,
  contract_reels_per_month: null,
  posts_this_month: reels.filter((r) => r.posted_month === thisMonth).length,
  low_spread_posts: lowSpread.length ? { count: lowSpread.length, worst: Math.min(...lowSpread.map((r) => r.spread_rate)) } : null,
  business_goal: BUSINESS_GOAL,
};

const cleanReels = reels.map(({ _hook, ...r }) => r);
const accountDetail = {
  account: accountSummary,
  reels: cleanReels,
  trend: [...cleanReels].reverse().map((r) => ({ posted_at: r.posted_at, shortcode: r.shortcode, caption_excerpt: r.caption_excerpt, views: r.views, spread_rate: r.spread_rate, engagement_rate: r.engagement_rate })),
  alerts,
  diagnosis,
  monthly,
  follower_history: followerHistory,
  daily_totals: dailyTotals,
  comments,
  comment_stats: commentStats,
  stories,
  story_stats: { count_7d: stories7d.length, median_views_7d: medianOf(stories7d.map((s) => s.views)), replies_7d: stories7d.reduce((s, x) => s + (x.replies ?? 0), 0) },
  account_insights: accountInsights,
  demographics: { as_of: ymd(today), gender: { F: Math.round(currentFollowers * 0.64), M: Math.round(currentFollowers * 0.33), U: Math.round(currentFollowers * 0.03) }, age: { "18-24": 1400, "25-34": 4700, "35-44": 3900, "45-54": 2100, "55-64": 700, "65+": 200 } },
};

const summary = {
  generated_at: iso(asOf),
  totals: {
    accounts: 1,
    clients: 1,
    total_followers: currentFollowers,
    avg_engagement_rate: accountSummary.avg_engagement_rate,
    followers_delta_1d: accountSummary.followers_delta_1d,
    views_delta_1d: accountSummary.views_delta_1d,
    new_posts_1d: accountSummary.new_posts_1d,
    negative_comments_1d: accountSummary.negative_comments_1d,
  },
  thresholds: { spread_critical: SPREAD_CRITICAL, spread_warning: SPREAD_WARNING },
  accounts: [accountSummary],
};

const risk = {
  generated_at: iso(asOf),
  items: comments
    .filter((c) => (c.severity ?? 0) >= 2 && Date.now() - new Date(c.first_seen_at).getTime() <= 7 * DAY)
    .map((c) => ({ handle: HANDLE, client_name: ACCOUNT.client_name, comment_id: c.comment_id, author: c.author, text: c.text, like_count: c.like_count, posted_at: c.posted_at, first_seen_at: c.first_seen_at, category: c.category, severity: c.severity, shortcode: c.shortcode, reel_url: c.reel_url, caption_excerpt: c.caption_excerpt })),
};

// ---------- 週次インサイト（AIが毎週書く想定のレポート） ----------
const weekEnd = daysAgo((today.getDay() + 6) % 7 + 1); // 直近の日曜
const weekStart = new Date(weekEnd.getTime() - 6 * DAY);
const inWeek = (d, off = 0) => {
  const t = new Date(d).getTime();
  return t >= weekStart.getTime() - off * DAY && t < weekEnd.getTime() + DAY - off * DAY;
};
const weekViews = dailyTotals.filter((d) => inWeek(`${d.date}T12:00:00+09:00`)).reduce((s, d) => s + d.views_delta, 0);
const prevWeekViews = dailyTotals.filter((d) => inWeek(`${d.date}T12:00:00+09:00`, 7)).reduce((s, d) => s + d.views_delta, 0);
const weekReels = cleanReels.filter((r) => inWeek(r.posted_at));
const topReel = [...weekReels].sort((a, b) => b.views - a.views)[0] ?? cleanReels[0];
const weeklyFile = `${ymd(weekEnd)}.json`;
const weekInsights = accountInsights.filter((d) => inWeek(`${d.date}T12:00:00+09:00`));
const sumOf = (xs, k) => xs.reduce((s, x) => s + (x[k] ?? 0), 0);
const weekly = {
  generated_at: iso(daysAgo((today.getDay() + 6) % 7, 8, 0)),
  week_start: ymd(weekStart),
  week_end: ymd(weekEnd),
  model: "demo（実運用ではLLMが生成）",
  purpose: "SNSの数字を、事業の目的（オンラインストアへの送客）に効いているかで読み、来週の企画を決める",
  overall: {
    headline: `再生は前週比 ${prevWeekViews ? `${weekViews >= prevWeekViews ? "+" : ""}${Math.round(((weekViews - prevWeekViews) / prevWeekViews) * 100)}%` : "—"}。「数字で言い切る」型が引き続き新規リーチを稼いだ`,
    bullets: [
      "保存率が高いのは抽出・豆知識テーマ。教育系の企画は資産になっている",
      "リンククリックはプロフィール閲覧の約1割。投稿末尾の導線を統一すると伸ばせる余地あり",
      "定期便の配送遅延に関するクレームが1件。運用ではなく物流側の論点として共有が必要",
    ],
  },
  accounts: [{
    handle: HANDLE,
    client: ACCOUNT.client_name,
    verdict: weekViews >= prevWeekViews ? "up" : "flat",
    followers: currentFollowers,
    followers_delta_7d: fh.at(-1).followers - fh.at(-8).followers,
    week_views: weekViews,
    prev_week_views: prevWeekViews,
    views_wow_pct: prevWeekViews ? Math.round(((weekViews - prevWeekViews) / prevWeekViews) * 1000) / 10 : null,
    posts_7d: weekReels.length,
    negative_comments_7d: comments.filter((c) => c.sentiment === "negative" && inWeek(c.first_seen_at)).length,
    top_reel: { shortcode: topReel.shortcode, url: topReel.url, caption_excerpt: topReel.caption_excerpt, week_views_delta: Math.round(topReel.views * 0.4) },
    insight: "冒頭1秒で数字を言い切る型が、フォロワー外への到達を押し上げている",
    action: "同じ型で『抽出』テーマを2本。最後に定期便への一言導線を入れて送客を測る",
    stories_7d: stories7d.length,
    stories_prev_7d: Math.max(0, stories7d.length - 2),
    story_views_median_7d: medianOf(stories7d.map((s) => s.views)),
    story_replies_7d: stories7d.reduce((s, x) => s + (x.replies ?? 0), 0),
    profile_views_7d: sumOf(weekInsights, "profile_views"),
    profile_views_prev_7d: Math.round(sumOf(weekInsights, "profile_views") * 0.88),
    website_clicks_7d: sumOf(weekInsights, "website_clicks"),
    insight_follows_7d: sumOf(weekInsights, "follows"),
    insight_unfollows_7d: sumOf(weekInsights, "unfollows"),
    saved_7d: weekReels.reduce((s, r) => s + (r.saved ?? 0), 0),
    shares_7d: weekReels.reduce((s, r) => s + (r.shares ?? 0), 0),
    reel_follows_7d: null,
  }],
  risks: [
    { handle: HANDLE, client: ACCOUNT.client_name, note: "効能をうたう表現への指摘コメントあり。投稿文に断定表現がないか確認する", source: "comments" },
    { handle: HANDLE, client: ACCOUNT.client_name, note: "「お店の裏側」型の拡散率が2週連続で注意水準", source: "metrics" },
  ],
  next_actions: [
    { target: HANDLE, title: "次回企画：『湯温3℃で味が変わる』の続編", detail: "数字で言い切る型 × 抽出テーマ。冒頭に温度計のアップ、30秒以内" },
    { target: HANDLE, title: "台本の型を固定する", detail: "フック（数字）→ 実演 → 比較 → 保存を促す一言 → ストアへの導線" },
    { target: HANDLE, title: "競合チェック", detail: "同じ地域の新規焙煎所アカウントが増加。企画の重なりを確認する" },
  ],
};

// ---------- 書き出し ----------
rmSync(OUT, { recursive: true, force: true });
const write = (rel, body) => {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2));
};
write("summary.json", summary);
write(`account-${HANDLE}.json`, accountDetail);
write("risk.json", risk);
write("weekly/index.json", { weeks: [{ week_start: weekly.week_start, week_end: weekly.week_end, file: weeklyFile, generated_at: weekly.generated_at }] });
write(`weekly/${weeklyFile}`, weekly);

// サムネイル（9:16のプレースホルダー。フックの型ごとに色を変える）
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
for (const r of reels) {
  const [a, b] = r._hook.color;
  const words = r.caption_excerpt.match(/.{1,9}/g) ?? [];
  const lines = words.slice(0, 4).map((w, i) => `<text x="27" y="${70 + i * 22}" font-size="17" font-weight="700" fill="#fff">${esc(w)}</text>`).join("");
  write(`thumbs/${r.shortcode}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="270" height="480" viewBox="0 0 270 480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="270" height="480" fill="url(#g)"/><text x="27" y="40" font-size="13" fill="#ffffffcc">${esc(r._hook.name)}</text>${lines}<text x="27" y="450" font-size="12" fill="#ffffffaa">DEMO</text></svg>`);
}

// CSV（ダウンロードメニュー用）
const csv = (rows) => {
  const cols = Object.keys(rows[0] ?? {});
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
};
write(`csv/${HANDLE}-posts.csv`, csv(cleanReels.map((r) => ({ posted_at: r.posted_at, caption: r.caption_excerpt, hook: r.analysis.hook_type, views: r.views, likes: r.likes, comments: r.comments, saved: r.saved, shares: r.shares, spread_rate: r.spread_rate.toFixed(4) }))));
write(`csv/${HANDLE}-daily.csv`, csv(dailyTotals));
write(`csv/${HANDLE}-comments.csv`, csv(comments.map(({ reel_url, ...c }) => c)));
write(`csv/${HANDLE}-stories.csv`, csv(stories));
write(`csv/${HANDLE}-account-insights.csv`, csv(accountInsights));

console.log(`demo data → ${OUT}（リール${reels.length}本・コメント${comments.length}件）`);
