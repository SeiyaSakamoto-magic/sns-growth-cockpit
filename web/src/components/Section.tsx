import { useState } from "react";
import type { ReactNode } from "react";

/* AccountDetail内ローカル部品だったものを共通化（ホーム/基本/分析の3ページで使うため）。挙動は不変 */

export function Section({ title, sub, right, children }: { title: string; sub?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="card card-pad">
      <div className="row between" style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <h2 className="sec-h" style={{ margin: 0 }}>{title}{sub && <span className="sec-sub">{sub}</span>}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

/**
 * 折り畳みセクション。開くまで中身をマウントしない（recharts×N + コメント500行の同時描画回避）。
 * defaultOpen時は <details open> と mounted の両方を初期化する（片方だけだと開いても中身が空になる）。
 */
export function FoldSection({ title, sub, defaultOpen = false, children }: {
  title: string; sub?: string; defaultOpen?: boolean; children: ReactNode;
}) {
  const [mounted, setMounted] = useState(defaultOpen);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <details className="card fold-sec" open={defaultOpen}
      onToggle={(e) => {
        const open = (e.target as HTMLDetailsElement).open;
        setIsOpen(open);
        if (open) setMounted(true);
      }}>
      <summary>
        <h2 className="sec-h" style={{ margin: 0 }}>{title}{sub && <span className="sec-sub">{sub}</span>}</h2>
        <span className="fold-hint" aria-hidden>{isOpen ? "閉じる ▴" : "詳細を見る ▾"}</span>
      </summary>
      <div className="fold-body">{mounted && children}</div>
    </details>
  );
}
