export interface LotSpec {
  label: string;
  req: string;
  ours: string;
  m: "ok" | "part" | "no";
}

export interface MatchStock {
  code: string;
  name: string;
  avail: number;
  unit: string;
  cost: number;
  /** supplier-based matching: mos topilgan ta'minotchi nomi (mavjud bo'lsa). */
  supplier?: string | null;
  /** ta'minotchi id si — /supplies?supplier=<id> linki uchun (mavjud bo'lsa). */
  supplierId?: string | null;
}

export interface LotMatch {
  overall: number;
  vector: number;
  llm: "verified" | "partial" | "rejected";
  reasoning: string;
  stock: MatchStock;
  specs: LotSpec[];
}

/**
 * "Narx va foydalilik" bloki — TO'LIQ backend hisoblaydi (UZS'da), frontend
 * faqat formatlab ko'rsatadi. `available: false` — mos tovar/narx yo'q,
 * blok raqamlarsiz "tahlil yo'q" holatini ko'rsatadi.
 */
export interface LotPricing {
  available: boolean;
  qty: number;
  /** Start birlik narx (UZS). */
  startUnit: number;
  /** Start JAMI narx (UZS) — kartada/jadvalda ko'rsatiladigan lot qiymati. */
  maxPrice: number;
  /** Tan narx birlik, UZS (USD narx kurs bilan o'girilgan). */
  unitCost: number;
  costTotal: number;
  /** Supplier narxi manba valyutada (masalan 180 — ya'ni $180). */
  unitCostSource: number;
  currency: "USD" | "UZS";
  exchangeRate: number | null;
  /** Tavsiya taklif narxi (birlik/jami, UZS). */
  bidUnit: number;
  bidTotal: number;
  /** uzex komissiyasi bahosi (jami). */
  fee: number;
  taxAmount: number;
  /** Muzlatiladigan summa (garov + demping farqi) — qaytariladi, xarajat emas. */
  totalFrozen: number;
  /** true — taklif startdan 20%+ past: demping, katta summa muzlatiladi. */
  isDumping: boolean;
  /** Komissiya/muzlash manbai: uzex jonli javobi yoki lokal baho (fallback). */
  feesSource: "uzex" | "estimate";
  /** Kutilayotgan sof foyda (jami) va foizi. */
  net: number;
  netPct: number;
  /** Startda (maks. narxda) qatnashilsa bo'ladigan foyda — solishtirish uchun. */
  netAtStart: number;
  /** Taklif start narxdan necha % past. */
  discountPct: number;
  verdict: "good" | "edge" | "bad";
}

export type LotStatus = "pending" | "accepted" | "rejected";

export interface Lot {
  id: string;
  /** Backend Recommendation id — manager qarorini saqlash uchun (mavjud bo'lsa). */
  recommendationId?: string;
  lotNo: string;
  /** uzex lot_id (xarid.uzex.uz havolasi uchun). */
  buyerLotId?: number | null;
  category: string;
  title: string;
  customer: string;
  region: string;
  qty: number;
  unit: string;
  /** Start JAMI narx (birlik × miqdor) — karta/jadval/analitika ko'rsatadi. */
  maxPrice: number;
  /** Start BIRLIK narx (lot.price) — tender taklif formasining kirishi. */
  startUnit: number;
  deadlineH: number;
  addedAgo: string;
  status: LotStatus;
  decidedBy?: string;
  decidedAgo?: string;
  match: LotMatch;
  pricing: LotPricing;
  /** Uzex tomonidan lotni tavsiya qilgan yuridik shaxs(lar) (bir nechta bo'lishi mumkin). */
  legalEntities: { id: string; name: string }[];
}
