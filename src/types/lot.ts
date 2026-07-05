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

export interface LotPricing {
  maxPrice: number;
  unitCost: number;
  qty: number;
  bidUnit: number;
  fee: number;
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
  maxPrice: number;
  deadlineH: number;
  addedAgo: string;
  status: LotStatus;
  decidedBy?: string;
  decidedAgo?: string;
  match: LotMatch;
  pricing: LotPricing;
}
