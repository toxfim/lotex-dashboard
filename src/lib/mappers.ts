import { hoursUntil, relativeAgo } from "@/lib/formatters";
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

const REC_STATUS_TO_VERDICT: Record<
  ApiRecommendationStatus,
  LotPricing["verdict"]
> = {
  RECOMMENDED: "good",
  NEEDS_REVIEW: "edge",
  NOT_FOUND: "bad",
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
    supplier: snapshot.supplierName ?? null,
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
  return {
    overall: Math.round(rec.confidence),
    vector: Number((rec.confidence / 100).toFixed(2)),
    llm: REC_STATUS_TO_LLM[rec.recommendedStatus],
    reasoning: rec.aiNotes ?? "",
    stock: buildStock(rec, lot.unit ?? "dona"),
    specs,
  };
}

function buildPricing(lot: ApiLot): LotPricing {
  const rec = lot.recommendation;
  const qty = lot.quantity ?? 0;
  if (!rec) {
    return {
      maxPrice: lot.price,
      unitCost: 0,
      qty,
      bidUnit: 0,
      fee: 0,
      verdict: "bad",
    };
  }
  return {
    maxPrice: lot.price,
    unitCost: rec.costPrice,
    qty,
    bidUnit: rec.recommendedPrice,
    fee: rec.tenderFee ?? 0,
    verdict: REC_STATUS_TO_VERDICT[rec.recommendedStatus],
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
    maxPrice: lot.price,
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
