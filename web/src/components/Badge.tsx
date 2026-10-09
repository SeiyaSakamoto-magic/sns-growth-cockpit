import type { Status } from "../lib/types";
import { statusLabel } from "../lib/format";

export default function Badge({ status }: { status: Status }) {
  return (
    <span className={`badge ${status}`}>
      <span className="dot" />
      {statusLabel[status]}
    </span>
  );
}
