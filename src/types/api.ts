// Lotex backend (hono-app.ts → /api) javob shakllari.
// Prisma `Lot` / `Recommendation` modellariga mos keladi; JSON orqali kelganda
// `Date` maydonlar ISO string bo'ladi.

export type ApiLotStatus = "NEW" | "PROCESSING" | "EXPIRED";
export type ApiTenderResult = "UNKNOWN" | "WON" | "LOST";
export type ApiRecommendationStatus =
  | "RECOMMENDED"
  | "NEEDS_REVIEW"
  | "NOT_FOUND";
export type ApiManagerDecision = "PENDING" | "ACCEPTED" | "REJECTED";

/** Recommendation.matchedStock ichidagi supplier-tovar snapshotining ishlatadigan qismi. */
export interface ApiMatchedStock {
  title?: string | null;
  sku?: string | null;
  actualCost?: number | null;
  recommendedPrice?: number | null;
  // supplier-based matching: mos topilgan ta'minotchi (mavjud bo'lsa)
  supplierName?: string | null;
  supplierId?: string | null;
}

/** Lot.requirements (js_properties) elementi — texnik talab. */
export interface ApiLotRequirement {
  property_name: string;
  user_value: string;
  user_value_id?: number;
  pnum?: number;
  // Quyidagilar faqat detal endpointida (/api/lots/:id) keladi, ro'yxatda emas.
  matched_value?: string | null; // BIZNING ZAXIRA qiymati (yo'q bo'lsa null)
  match?: "ok" | "part" | "no"; // MOSLIK holati
}

export interface ApiRecommendation {
  id: string;
  lotId: string;
  matchedStockName: string;
  matchedSku: string | null;
  // mos topilgan ta'minotchi top-level (badge/link uchun). Eski yozuvlarda null bo'lishi
  // mumkin — bunda matchedStock.supplierName/supplierId fallback ishlatiladi.
  supplierId: string | null;
  supplierName: string | null;
  matchedStock: ApiMatchedStock | null;
  costPrice: number;
  recommendedPrice: number;
  tenderFee: number | null;
  confidence: number;
  /** 1-bosqich vektorli (cosine) o'xshashligi 0..1. Eski yozuvlarda null. */
  vectorScore: number | null;
  aiNotes: string | null;
  recommendedStatus: ApiRecommendationStatus;
  managerDecision: ApiManagerDecision;
  createdAt: string;
}

/** Lotning o'zi (recommendation relyatsiyasisiz). */
export interface ApiLotBase {
  id: string;
  uzexLotId: number;
  buyerLotId: number | null;
  offerNo: string | null;
  title: string;
  price: number;
  tenderStartDate: string;
  tenderEndDate: string;
  productCode: string | null;
  categoryName: string | null;
  quantity: number | null;
  unit: string | null;
  regionId: number | null;
  customerName: string | null;
  createdByUserId: number | null;
  producerCountry: string | null;
  markName: string | null;
  manufacturerName: string | null;
  requirements: unknown | null;
  description: string | null;
  tenderResult: ApiTenderResult;
  status: ApiLotStatus;
  createdAt: string;
}

/** GET /api/lots javobidagi lot — recommendation bilan birga (null bo'lishi mumkin). */
export interface ApiLot extends ApiLotBase {
  recommendation: ApiRecommendation | null;
}

/** GET /api/recommendations javobidagi element — lot bilan birga. */
export interface ApiRecommendationWithLot extends ApiRecommendation {
  lot: ApiLotBase;
}

/** WS /api/ws/status payload — sidebar pipeline-card real-time holati. */
export interface ApiPipelineStatus {
  active: boolean; // oxirgi sikl muvaffaqiyatli — "AI quvuri faol"
  scanned: number; // jami ingest qilingan lotlar — "Skanerlandi"
  matched: number; // stok tovariga mos topilgan lotlar — "Mos topildi"
  lastSyncAt: string | null; // oxirgi muvaffaqiyatli sinx (ISO) — "Oxirgi sinx."
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}
