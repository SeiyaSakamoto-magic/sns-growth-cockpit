import { useEffect, useState } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { fetchSummary, fetchRisk } from "./lib/data";
import type { AccountSummary, RiskFeed } from "./lib/types";
import RiskDrawer, { riskWithin } from "./components/RiskDrawer";

/**
 * 1アカウント用のダッシュボード。
 * データ（summary.json）には複数アカウントを入れられるが、画面は先頭のアカウントだけを扱う。
 * 複数アカウントの切り替えはロードマップ（README参照）。
 */
function usePrimaryAccount() {
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetchSummary()
      .then((s) => setAccount(s.accounts[0] ?? null))
      .catch((e) => setError(String(e)));
  }, []);
  return { account, error };
}

export function HomeRedirect() {
  const { account, error } = usePrimaryAccount();
  if (error) {
    return (
      <main className="content">
        <div className="error-box card card-pad" role="alert">
          <div style={{ fontWeight: 700, fontSize: 16 }}>データがまだありません</div>
          <p className="tiny">`npm run demo-data` で架空のサンプルデータを生成してください。</p>
          <details><summary>技術的な詳細</summary>{error}</details>
        </div>
      </main>
    );
  }
  if (!account) return <main className="content"><div className="loading" role="status" aria-live="polite">読み込み中…</div></main>;
  return <Navigate to={`/account/${account.handle}`} replace />;
}

export default function App() {
  const { account } = usePrimaryAccount();
  const [risk, setRisk] = useState<RiskFeed | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sb-collapsed") === "1"; } catch { return false; }
  });
  const loc = useLocation();

  useEffect(() => { fetchRisk().then(setRisk).catch(() => {}); }, []);
  useEffect(() => {
    try { localStorage.setItem("sb-collapsed", collapsed ? "1" : "0"); } catch { /* 保存できなくても動く */ }
  }, [collapsed]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "b" || e.key === "B")) { e.preventDefault(); setCollapsed((c) => !c); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const riskCount24h = risk ? riskWithin(risk.items, 24).length : 0;
  const base = account ? `/account/${account.handle}` : "/";
  const items = [
    { to: base, icon: "▦", label: "ダッシュボード", active: loc.pathname === base },
    { to: `${base}/analysis`, icon: "🔎", label: "分析", active: loc.pathname === `${base}/analysis` },
    { to: "/weekly", icon: "📝", label: "週次インサイト", active: loc.pathname === "/weekly" },
  ];

  return (
    <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sb-head">
          <Link to="/" className="sb-brand" title="SNS Growth Cockpit">
            <span className="logo">S</span>
            {!collapsed && <span className="sb-title">SNS Growth Cockpit<small>分析と改善のダッシュボード</small></span>}
          </Link>
          <button className="sb-toggle" onClick={() => setCollapsed((c) => !c)} aria-label="サイドバーを開閉" title="開閉 (⌘B)">
            {collapsed ? "»" : "«"}
          </button>
        </div>

        <nav className="sb-nav">
          {items.map((it) => (
            <Link key={it.label} to={{ pathname: it.to, search: loc.search }}
              className={`sb-item ${it.active ? "active" : ""}`} title={it.label}>
              <span className="sb-ic" aria-hidden>{it.icon}</span>{!collapsed && <span>{it.label}</span>}
            </Link>
          ))}
          <button className="sb-item sb-bell" onClick={() => setDrawer(true)} title="要対応コメント（severity 2以上）">
            <span className="sb-ic" aria-hidden>🔔</span>
            {!collapsed && <span>要対応コメント</span>}
            {riskCount24h > 0 && <span className="bell-badge">{riskCount24h}</span>}
          </button>
          {!collapsed && account && (
            <div className="sb-section">@{account.handle}{account.client_name.includes("サンプル") ? "（架空）" : ""}</div>
          )}
        </nav>
      </aside>

      <div className="main"><Outlet /></div>
      {drawer && <RiskDrawer feed={risk} onClose={() => setDrawer(false)} />}
    </div>
  );
}
