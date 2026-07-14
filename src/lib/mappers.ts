import { hoursUntil, relativeAgo } from "@/lib/formatters";
import {
  overallMatchPct,
  specsMatchPct,
  vectorPct,
  type SpecMatchState,
} from "@/lib/match-score";
import type {
  ApiLot,
  ApiLotRequirement,
  ApiManagerDecision,
  ApiRecommendation,
  ApiRecommendationStatus,
  ApiRecommendationWithLot,
} from "@/types/api";
import type {
  Lot,
  LotMatch,
  LotPricing,
  LotSpec,
  LotStatus,
  MatchStock,
} from "@/types/lot";

const DECISION_TO_STATUS: Record<ApiManagerDecision, LotStatus> = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
};

const STATUS_TO_DECISION: Record<LotStatus, ApiManagerDecision> = {
  pending: "PENDING",
  accepted: "ACCEPTED",
  rejected: "REJECTED",
};

/** Frontend qaror holatini backend ManagerDecision ga o'giradi. */
export function decisionFromStatus(status: LotStatus): ApiManagerDecision {
  return STATUS_TO_DECISION[status];
}

const REC_STATUS_TO_LLM: Record<ApiRecommendationStatus, LotMatch["llm"]> = {
  RECOMMENDED: "verified",
  NEEDS_REVIEW: "partial",
  NOT_FOUND: "rejected",
};

/** js_properties (noma'lum JSON) ni texnik talablar jadvaliga aylantiradi. */
function parseSpecs(requirements: unknown): LotSpec[] {
  if (!Array.isArray(requirements)) return [];
  return requirements
    .filter(
      (r): r is ApiLotRequirement =>
        !!r && typeof r === "object" && "property_name" in r,
    )
    .map((r) => ({
      label: String(r.property_name ?? ""),
      req: String(r.user_value ?? "—"),
      // matched_value/match faqat detal endpointida keladi; ro'yxatda yo'q,
      // shu sabab fallback bilan ("—" / "part") himoyalanamiz.
      ours: String(r.matched_value ?? "—"),
      m: r.match ?? "part",
    }));
}

function buildStock(rec: ApiRecommendation, unit: string): MatchStock {
  const snapshot = rec.matchedStock ?? {};
  return {
    code: rec.matchedSku ?? snapshot.sku ?? "—",
    name: rec.matchedStockName || snapshot.title || "Mos tovar",
    // supplier tovarida qoldiq miqdori yo'q — o'rniga ta'minotchi ko'rsatiladi.
    avail: 0,
    unit,
    cost: rec.costPrice ?? snapshot.actualCost ?? 0,
    // top-level supplier* yangi yozuvlarda keladi; eski yozuvlar uchun snapshot fallback.
    supplier: rec.supplierName ?? snapshot.supplierName ?? null,
    supplierId: rec.supplierId ?? snapshot.supplierId ?? null,
  };
}

function buildMatch(lot: ApiLot): LotMatch {
  const specs = parseSpecs(lot.requirements);
  const rec = lot.recommendation;
  if (!rec) {
    return {
      overall: 0,
      vector: 0,
      llm: "rejected",
      reasoning: lot.description ?? "",
      stock: {
        code: "—",
        name: "Mos tovar topilmadi",
        avail: 0,
        unit: lot.unit ?? "dona",
        cost: 0,
      },
      specs,
    };
  }
  // Moslik tahlili: vektor (cosine) 40% + texnik xususiyatlar 60%, null-xavfsiz.
  const sPct = specsMatchPct(specs.map((s) => s.m as SpecMatchState));
  const vPct = vectorPct(rec.vectorScore);
  return {
    overall: overallMatchPct(vPct, sPct),
    // ko'rsatish uchun cosine (0..1). Eski yozuvlarda saqlanmagan — confidence'ga qaytamiz.
    vector: Number((rec.vectorScore ?? rec.confidence / 100).toFixed(2)),
    llm: REC_STATUS_TO_LLM[rec.recommendedStatus],
    reasoning: rec.aiNotes ?? "",
    stock: buildStock(rec, lot.unit ?? "dona"),
    specs,
  };
}

/**
 * Backend hisoblagan pricing payload'ini ko'rsatish shakliga o'giradi.
 * Hisob-kitob YO'Q — hamma qiymatlar serverdan UZS'da tayyor keladi.
 * pricing null (mos tovar/narx yo'q) — blok "tahlil yo'q" holatida.
 */
function buildPricing(lot: ApiLot): LotPricing {
  const p = lot.pricing;
  if (!p) {
    const qty = lot.quantity ?? 1;
    return {
      available: false,
      qty,
      startUnit: lot.price,
      maxPrice: lot.price * (qty || 1),
      unitCost: 0,
      costTotal: 0,
      unitCostSource: 0,
      currency: "UZS",
      exchangeRate: null,
      bidUnit: 0,
      bidTotal: 0,
      fee: 0,
      taxAmount: 0,
      totalFrozen: 0,
      isDumping: false,
      feesSource: "estimate",
      net: 0,
      netPct: 0,
      netAtStart: 0,
      discountPct: 0,
      verdict: "bad",
    };
  }
  return {
    available: true,
    qty: p.quantity,
    startUnit: p.startUnitPrice,
    maxPrice: p.startTotal,
    unitCost: p.unitCost,
    costTotal: p.costTotal,
    unitCostSource: p.unitCostSource,
    currency: p.currency,
    exchangeRate: p.exchangeRate,
    bidUnit: p.bidUnit,
    bidTotal: p.bidTotal,
    fee: p.commission,
    taxAmount: p.taxAmount,
    totalFrozen: p.totalFrozen,
    isDumping: p.isDumping,
    feesSource: p.feesSource,
    net: p.netProfit,
    netPct: p.netPct,
    netAtStart: p.netProfitAtStart,
    discountPct: p.discountPct,
    verdict: p.verdict,
  };
}

/** Backend `ApiLot` ni frontend domeni `Lot` ga aylantiradi (boundary mapping, CLAUDE.md §11). */
export function mapApiLot(lot: ApiLot): Lot {
  const rec = lot.recommendation;
  return {
    id: lot.id,
    recommendationId: rec?.id,
    lotNo: lot.offerNo ?? `LOT-${lot.uzexLotId}`,
    buyerLotId: lot.buyerLotId,
    category: lot.categoryName ?? "Boshqa",
    title: lot.title,
    customer: lot.customerName ?? lot.manufacturerName ?? "—",
    region: "",
    qty: lot.quantity ?? 0,
    unit: lot.unit ?? "dona",
    // lot.price — BIRLIK start narx (uzex saytidagi kabi); jami summalar
    // pricing.startTotal ichida, karta/jadval birlik narxni ko'rsatadi.
    maxPrice: lot.price,
    startUnit: lot.price,
    deadlineH: hoursUntil(lot.tenderEndDate),
    addedAgo: relativeAgo(lot.createdAt),
    status: rec ? DECISION_TO_STATUS[rec.managerDecision] : "pending",
    decidedBy: rec && rec.managerDecision !== "PENDING" ? "Menejer" : undefined,
    decidedAgo:
      rec && rec.managerDecision !== "PENDING"
        ? relativeAgo(rec.createdAt)
        : undefined,
    match: buildMatch(lot),
    pricing: buildPricing(lot),
    legalEntities: lot.legalEntities ?? [],
  };
}

/**
 * GET /api/recommendations elementini (lot ichida) frontend `Lot` ga aylantiradi.
 * `mapApiLot` ni qayta ishlatamiz: lotga o'z recommendation'ini biriktirib beramiz.
 */
export function mapRecommendation(item: ApiRecommendationWithLot): Lot {
  const { lot, ...recommendation } = item;
  return mapApiLot({ ...lot, recommendation });
}
