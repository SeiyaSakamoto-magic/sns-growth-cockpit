export type Status = "ok" | "warning" | "critical" | "unknown";

export interface AccountSummary {
  client_name: string;
  display_name: string | null;
  profile_pic_url: string | null;
  data_as_of: string | null;
  data_stale?: boolean;
  /** Meta権限が未取得でGraph収集に乗っていない＝収集失敗ではなく依頼待ち */
  awaiting_permission?: boolean;
  handle: string;
  url: string;
  follower_count: number | null;
  reel_count: number;
  live_count?: number;
  avg_spread_rate: number | null;
  avg_engagement_rate: number | null;
  latest_post_at: string | null;
  status: Status;
  /** 前日比（欠損可・過去データには無い） */
  followers_delta_1d?: number | null;
  views_delta_1d?: number | null;
  likes_delta_1d?: number | null;
  comments_delta_1d?: number | null;
  new_posts_1d?: number;
  negative_comments_1d?: number | null;
  /** 拡散率の中央値（平均は1本のバズに引きずられるため代表値はこちら） */
  median_spread_rate?: number | null;
  /** 当月の投稿消化ペース（実投稿 ÷ 契約本数日割り）。契約本数が明示された案件のみ・月初等はnull */
  pace_ratio?: number | null;
  contract_reels_per_month?: number | null;
  /** 当月に投稿されたリール本数（ライブ/180秒超は除外） */
  posts_this_month?: number;
  /** 要対応水準（0.10×未満）の投稿の件数と最悪値。バッジ=中央値と役割分担する事故検知 */
  low_spread_posts?: { count: number; worst: number } | null;
  /** クライアントの事業目的（accounts.jsonのbusiness_goal。未設定はnull） */
  business_goal?: BusinessGoal | null;
}

/** クライアントの事業目的（分析ページ⑤の器。実数値の取り込みはsource経由で将来拡張） */
export interface BusinessGoal {
  label: string;
  description?: string;
  /** 先行指標として紐づけるIG指標名（例: website_clicks, profile_views） */
  related_metrics?: string[];
  /** 実数値の供給元（manual / lstep / ec など。未実装の間はドキュメント的な意味のみ） */
  source?: string;
}

export interface Summary {
  generated_at: string;
  totals: {
    accounts: number;
    clients: number;
    total_followers: number;
    avg_engagement_rate: number | null;
    /** 前日比（欠損可・過去データには無い） */
    followers_delta_1d?: number | null;
    views_delta_1d?: number | null;
    new_posts_1d?: number;
    negative_comments_1d?: number | null;
  };
  thresholds: { spread_critical: number; spread_warning: number };
  accounts: AccountSummary[];
}

/** 横断コメントリスクfeed（data/risk.json、severity>=2・7日分） */
export interface RiskItem {
  handle: string;
  client_name: string;
  comment_id: string;
  author: string | null;
  text: string | null;
  like_count: number;
  posted_at: string | null;
  first_seen_at: string;
  category: string | null;
  severity: number;
  shortcode: string;
  reel_url: string;
  caption_excerpt: string;
}

export interface RiskFeed {
  generated_at: string;
  items: RiskItem[];
}

/** アカウントの日次Δ系列（累計ではない。収集窓の影響を受けないΔのみ） */
export interface DailyTotal {
  date: string;
  views_delta: number;
  likes_delta: number;
  comments_delta: number;
  negative_comments: number;
}

export interface ReelAnalysis {
  hook_type: string | null;
  topic_tags: string[];
  insight: string | null;
  trend_note: string | null;
  transcript_summary: string | null;
}

export interface Reel {
  shortcode: string;
  url: string;
  caption: string;
  caption_excerpt: string;
  posted_at: string | null;
  posted_month: string | null;
  thumbnail_url: string | null;
  /** ローカル保存済みサムネイルの相対パス（data/thumbs/...）。CDN URLは約4日で失効するためこちらを優先 */
  thumb?: string | null;
  video_url: string | null;
  video_duration: number | null;
  is_live: boolean;
  views: number | null;
  likes: number;
  comments: number;
  spread_rate: number | null;
  engagement_rate: number | null;
  analysis: ReelAnalysis;
  /** 前日比（欠損可・過去データには無い） */
  views_delta_1d?: number | null;
  likes_delta_1d?: number | null;
  comments_delta_1d?: number | null;
  /** Meta Graph API公式インサイト（未連携/Meta非返却はnull） */
  insights_source?: "graph" | null;
  insights_as_of?: string | null;
  reach?: number | null;
  saved?: number | null;
  shares?: number | null;
  /** v23.0時点のMetaはREELSでこの指標を返さない。将来復活したときのために型は残す */
  follows?: number | null;
  /** follows / reach。0除算・欠損はnull */
  follow_conversion_rate?: number | null;
  /** 1再生あたりの平均視聴秒数（Metaはミリ秒で返すのでexport側で秒に換算済み） */
  avg_watch_time_sec?: number | null;
  /** 累計の総視聴秒数 */
  total_watch_time_sec?: number | null;
}

export interface TrendPoint {
  posted_at: string | null;
  shortcode: string;
  caption_excerpt: string;
  views: number | null;
  spread_rate: number | null;
  engagement_rate: number | null;
}

export interface Alert {
  severity: string;
  kind: string;
  message: string;
  collected_at: string;
  reel_id: number | null;
}

export interface DiagReel {
  caption_excerpt: string;
  shortcode: string;
  url: string;
  spread_rate: number | null;
  views: number | null;
  hook_type: string | null;
}

export interface Diagnosis {
  headline: string;
  stats: { total: number; crit: number; warn: number; ok: number; avg_spread: number; avg_engagement: number | null };
  best: DiagReel;
  worst: DiagReel;
  hooks: { name: string; avg_spread: number; count: number }[];
  direction: { label: string; detail: string } | null;
  recommendations: string[];
}

export interface MonthlyStat {
  month: string;
  posts: number;
  total_views: number;
  avg_views: number | null;
  avg_spread: number | null;
}

/* ===== 週次インサイト（構造化レポート・毎週月曜朝に自動生成） ===== */

/** data/weekly/index.json の1エントリ（week_end降順ソート済み） */
export interface WeeklyIndexEntry {
  week_start: string;
  week_end: string;
  file: string;
  generated_at: string;
}

export interface WeeklyIndex {
  weeks: WeeklyIndexEntry[];
}

export type WeeklyVerdict = "up" | "flat" | "down" | "risk";

export interface WeeklyTopReel {
  shortcode: string;
  url: string;
  caption_excerpt: string;
  week_views_delta: number | null;
}

export interface WeeklyAccountInsight {
  handle: string;
  client: string;
  verdict: WeeklyVerdict;
  followers: number | null;
  followers_delta_7d: number | null;
  week_views: number | null;
  prev_week_views: number | null;
  views_wow_pct: number | null;
  posts_7d: number | null;
  negative_comments_7d: number | null;
  top_reel: WeeklyTopReel | null;
  /** 90字以内の要因仮説 */
  insight: string;
  /** 90字以内の打ち手 */
  action: string;
  /** ---- Meta公式インサイト週次（Graph移行済みアカウントのみ。未移行はnull/undefined） ---- */
  stories_7d?: number | null;
  stories_prev_7d?: number | null;
  story_views_median_7d?: number | null;
  story_replies_7d?: number | null;
  profile_views_7d?: number | null;
  profile_views_prev_7d?: number | null;
  website_clicks_7d?: number | null;
  insight_follows_7d?: number | null;
  insight_unfollows_7d?: number | null;
  saved_7d?: number | null;
  shares_7d?: number | null;
  reel_follows_7d?: number | null;
}

export interface WeeklyRisk {
  handle: string;
  client: string;
  note: string;
  source: "comments" | "metrics";
}

export interface WeeklyNextAction {
  target: string;
  title: string;
  detail: string;
}

/** data/weekly/<week_end>.json 本体 */
export interface WeeklyReport {
  generated_at: string;
  week_start: string;
  week_end: string;
  model: string;
  purpose: string;
  overall: { headline: string; bullets: string[] };
  accounts: WeeklyAccountInsight[];
  risks: WeeklyRisk[];
  next_actions: WeeklyNextAction[];
}

/** リールに付いたコメント（Phase 2: コメント収集・分類。欠損可） */
export interface ReelComment {
  comment_id: string;
  shortcode: string;
  reel_url: string;
  caption_excerpt: string;
  author: string | null;
  text: string | null;
  like_count: number;
  posted_at: string | null;
  first_seen_at: string;
  category: string | null; // anti / complaint / legal_risk / question / positive / neutral
  severity: number | null; // 0-3
  sentiment: string | null; // negative / neutral / positive
}

export interface CommentStats {
  total: number;
  negative: number;
  by_category: Record<string, number>;
}

/** ストーリー（Graph移行済みアカウントのみ。stories テーブル由来） */
export interface Story {
  story_id: string;
  media_type: string | null;
  permalink: string | null;
  posted_at: string | null;
  views: number | null;
  reach: number | null;
  replies: number | null;
  navigation: number | null;
  /** ローカル保存したクリエイティブ（data/thumbs/stories/<handle>/<story_id>.jpg）。
   * ストーリーは24hで消えCDN URLも失効するため、収集当日に落とせた分だけ入る */
  thumb?: string | null;
}

export interface StoryStats {
  count_7d: number;
  median_views_7d: number | null;
  replies_7d: number;
}

/** アカウント日次インサイト（Graph移行済みアカウントのみ。account_insights_daily 由来） */
export interface AccountInsightDay {
  date: string;
  profile_views: number | null;
  website_clicks: number | null;
  reach: number | null;
  accounts_engaged: number | null;
  views: number | null;
  total_interactions: number | null;
  follows: number | null;
  unfollows: number | null;
}

/** フォロワー属性（follower_demographics。graph連携アカウントのみ・Metaは実数でなく概数を返す） */
export interface Demographics {
  as_of: string | null;
  /** 例 {"F": 8210, "M": 950, "U": 320} */
  gender?: Record<string, number> | null;
  /** 例 {"25-34": 4100, "35-44": 2800, ...} */
  age?: Record<string, number> | null;
}

export interface AccountDetail {
  account: AccountSummary;
  reels: Reel[];
  trend: TrendPoint[];
  alerts: Alert[];
  diagnosis: Diagnosis | null;
  monthly: MonthlyStat[];
  follower_history: { date: string; followers: number | null }[];
  daily_totals?: DailyTotal[];
  comments?: ReelComment[];
  comment_stats?: CommentStats | null;
  stories?: Story[];
  story_stats?: StoryStats | null;
  account_insights?: AccountInsightDay[];
  demographics?: Demographics | null;
}
