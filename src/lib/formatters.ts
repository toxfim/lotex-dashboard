/** Lotning xarid.uzex.uz dagi sahifasiga havola (buyerLotId = uzex lot_id). */
export function uzexLotUrl(buyerLotId: number | null | undefined): string | null {
  return buyerLotId != null
    ? `https://xarid.uzex.uz/shop/lot-details/${buyerLotId}`
    : null;
}

export function fmtSom(n: number): string {
  return Math.round(n)
    .toLocaleString("ru-RU")
    .replace(/\u00A0/g, " ")
    .replace(/,/g, " ");
}

export function fmtNum(n: number): string {
  return n
    .toLocaleString("ru-RU")
    .replace(/\u00A0/g, " ")
    .replace(/,/g, " ");
}

export function compactSom(n: number): string {
  if (n >= 1e9)
    return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(".", ",") + " mlrd";
  if (n >= 1e6)
    return (n / 1e6).toFixed(n >= 1e8 ? 0 : 1).replace(".", ",") + " mln";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + " ming";
  return String(n);
}

/** ISO sanadan hozirgacha bo'lgan farqni "3 soat oldin" ko'rinishida qaytaradi. */
export function relativeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "hozir";
  if (mins < 60) return `${mins} daqiqa oldin`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} soat oldin`;
  const days = Math.floor(hrs / 24);
  return `${days} kun oldin`;
}

/** ISO sanagacha qolgan vaqt (soatlarda) — o'tib ketgan bo'lsa manfiy. */
export function hoursUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000);
}

export interface DeadlineResult {
  text: string;
  sub: string;
  urgent: boolean;
  closed: boolean;
}

export function deadline(h: number): DeadlineResult {
  if (h <= 0) return { text: "Yopilgan", sub: "", urgent: false, closed: true };
  const d = Math.floor(h / 24);
  const hr = h % 24;
  const text = d > 0 ? `${d} kun ${hr} soat` : `${hr} soat`;
  return { text, sub: "", urgent: h <= 24, closed: false };
}

export interface PricingResult {
  bidTotal: number;
  costTotal: number;
  gross: number;
  net: number;
  netPct: number;
  grossPct: number;
}

export function computePricing(p: {
  bidUnit: number;
  qty: number;
  unitCost: number;
  fee: number;
}): PricingResult {
  const bidTotal = p.bidUnit * p.qty;
  const costTotal = p.unitCost * p.qty;
  const gross = bidTotal - costTotal;
  const net = gross - p.fee;
  const netPct = (net / bidTotal) * 100;
  const grossPct = (gross / bidTotal) * 100;
  return { bidTotal, costTotal, gross, net, netPct, grossPct };
}
