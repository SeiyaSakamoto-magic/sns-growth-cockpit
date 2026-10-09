/**
 * KPIカード用インラインSVGスパークライン（依存ゼロ）。
 * rechartsのResponsiveContainerはカードグリッドに複数置くと重いため使わない。
 */
export default function Sparkline({ points, width = 130, height = 28, color = "var(--data-1)", baselineZero = false }: {
  points: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
  /** Δ系列など0起点が意味を持つ場合にtrue（min/max正規化でなく0を含めてスケール） */
  baselineZero?: boolean;
}) {
  const vals = points.filter((p): p is number => p != null);
  if (vals.length < 2) return null;

  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (baselineZero) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const pad = 2;
  const h = height - pad * 2;

  const coords = points
    .map((v, i) => (v == null ? null : `${(i * step).toFixed(1)},${(pad + h - ((v - min) / span) * h).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");

  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {baselineZero && min < 0 && (
        <line x1={0} x2={width} y1={pad + h - ((0 - min) / span) * h} y2={pad + h - ((0 - min) / span) * h}
          stroke="var(--border-strong)" strokeDasharray="2 3" strokeWidth={1} />
      )}
      <polyline points={coords} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
