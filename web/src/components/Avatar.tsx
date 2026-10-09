import { useState } from "react";
import { initials } from "../lib/format";

const GRADIENTS = [
  ["#e08a5f", "#c4452f"],
  ["#7b6ef6", "#b85bd6"],
  ["#3f8f5f", "#2f7a6e"],
  ["#d98a3a", "#c4612f"],
  ["#5b8fd6", "#4a47c4"],
  ["#c95b8f", "#9c3b6e"],
];

function pick(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length] as [string, string];
}

export default function Avatar({ name, seed, img, big }: { name: string; seed?: string; img?: string | null; big?: boolean }) {
  const [broken, setBroken] = useState(false);
  const cls = big ? "avatar big-avatar" : "avatar";
  const src = img ? (/^https?:/.test(img) ? img : import.meta.env.BASE_URL + img) : null;
  if (src && !broken) {
    return <img className={cls} src={src} alt={name} referrerPolicy="no-referrer" onError={() => setBroken(true)} style={{ objectFit: "cover" }} />;
  }
  const [a, b] = pick(seed || name);
  return (
    <div className={cls} style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
      {initials(name)}
    </div>
  );
}
