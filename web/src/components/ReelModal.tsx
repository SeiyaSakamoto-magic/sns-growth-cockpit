import { useEffect } from "react";
import type { Reel } from "../lib/types";
import { compact, num, spreadLabel } from "../lib/format";

/** トップ投稿クリックで開くモーダル。
 *  video_url があれば <video> でその場再生（IG遷移なし）。無ければIG公式embedにフォールバック。デモデータ（IG以外のURL）はサムネとキャプションを出す。 */
export default function ReelModal({ reel, onClose }: { reel: Reel; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="リール詳細">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="t">{reel.caption_excerpt || reel.shortcode}</span>
          <button className="x" onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        <div className="modal-body">
          {reel.video_url ? (
            <video className="modal-video" src={reel.video_url} poster={reel.thumbnail_url || undefined}
              controls autoPlay playsInline preload="metadata" />
          ) : !reel.url.includes("instagram.com") ? (
            <div className="modal-demo">
              {reel.thumb && <img src={`${import.meta.env.BASE_URL}${reel.thumb}`} alt="" />}
              <p className="tiny" style={{ whiteSpace: "pre-wrap" }}>{reel.caption}</p>
            </div>
          ) : (
            <iframe className="modal-embed" src={`https://www.instagram.com/reel/${reel.shortcode}/embed/captioned/`}
              title="Instagram reel" allow="autoplay; encrypted-media" allowFullScreen scrolling="no" />
          )}
        </div>
        <div className="modal-foot">
          <span>▶ <b>{compact(reel.views)}</b></span>
          <span>♥ <b>{num(reel.likes)}</b></span>
          <span>💬 <b>{num(reel.comments)}</b></span>
          {reel.insights_source === "graph" && (
            <>
              <span>リーチ <b>{compact(reel.reach)}</b></span>
              <span>保存 <b>{num(reel.saved)}</b></span>
              <span>シェア <b>{num(reel.shares)}</b></span>
              <span>フォロー獲得 <b>{num(reel.follows)}</b></span>
            </>
          )}
          <span className="tiny" style={{ marginLeft: "auto" }}>拡散率 {spreadLabel(reel.spread_rate)}</span>
          {reel.insights_source === "graph" && (
            <span className="tiny">フォロー転換率 {reel.follow_conversion_rate == null ? "—" : `${(reel.follow_conversion_rate * 100).toFixed(2)}%`}</span>
          )}
          {reel.url.includes("instagram.com") && <a className="link-out" href={reel.url} target="_blank" rel="noreferrer">IGで開く ↗</a>}
        </div>
      </div>
    </div>
  );
}
