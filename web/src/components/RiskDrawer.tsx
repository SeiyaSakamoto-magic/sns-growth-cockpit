import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { RiskFeed, RiskItem } from "../lib/types";
import { commentCategoryLabel, relativeDays, num } from "../lib/format";

/** 推奨アクションの定型ラベル（見て終わりにしない） */
function actionOf(item: RiskItem): string {
  if (item.category === "legal_risk") return "担当者へ共有";
  if (item.severity >= 3) return "担当者へ共有";
  if (item.category === "complaint") return "返信対応";
  return "返信/削除の判断";
}

export function riskWithin(items: RiskItem[], hours: number): RiskItem[] {
  const cutoff = Date.now() - hours * 3600000;
  return items.filter((i) => new Date(i.first_seen_at).getTime() >= cutoff);
}

/**
 * 横断コメントリスクドロワー。sev>=2の「要対応コメント」を先出しする。
 * 対応済み管理は未実装（ロードマップ段階2）。
 */
export default function RiskDrawer({ feed, onClose }: { feed: RiskFeed | null; onClose: () => void }) {
  const [win, setWin] = useState<"24h" | "7d">("24h");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const items = useMemo(() => {
    const all = feed?.items ?? [];
    return win === "24h" ? riskWithin(all, 24) : all;
  }, [feed, win]);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-label="要対応コメント一覧" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <span className="drawer-title">🔔 要対応コメント<span className="tiny" style={{ marginLeft: 8 }}>severity 2以上・横断</span></span>
          <button className="drawer-x" onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        <div className="drawer-controls">
          <div className="segmented">
            <button className={win === "24h" ? "active" : ""} onClick={() => setWin("24h")}>直近24h</button>
            <button className={win === "7d" ? "active" : ""} onClick={() => setWin("7d")}>7日</button>
          </div>
          <span className="tiny">{items.length} 件</span>
        </div>
        <div className="drawer-body">
          {items.length === 0 && <div className="empty" style={{ padding: "40px 0" }}>✓ この期間の要対応コメントはありません</div>}
          {items.map((it) => (
            <div className={`risk-item sev-${it.severity}`} key={it.comment_id}>
              <div className="risk-item-head">
                <span className={`cat-badge cat-${it.category ?? "none"}`}>{commentCategoryLabel(it.category)}</span>
                <span className="risk-sev">sev{it.severity}</span>
                <b className="risk-client">{it.client_name}</b>
                <span className="tiny" style={{ marginLeft: "auto" }}>{relativeDays(it.first_seen_at)}</span>
              </div>
              <div className="risk-text">"{it.text}"</div>
              <div className="risk-meta">
                <span className="tiny">↳ {it.caption_excerpt || it.shortcode} ・ ♥{num(it.like_count)}</span>
              </div>
              <div className="risk-actions">
                <span className="risk-action-label">→ {actionOf(it)}</span>
                <Link className="link-out tiny" to={`/account/${it.handle}`} onClick={onClose}>アカウントを見る</Link>
                <a className="link-out tiny" href={it.reel_url} target="_blank" rel="noreferrer">投稿を開く ↗</a>
              </div>
            </div>
          ))}
        </div>
        <div className="drawer-foot tiny">
          直近7日の要対応コメント（AIが分類）。対応済みの管理と通知はロードマップ段階2で追加予定です
        </div>
      </aside>
    </div>
  );
}
