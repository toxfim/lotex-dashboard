// Lotex backend (/api/pc-builds) javob shakllari — PC "sborka" (komponentlardan yig'ish).

export type PcComponentType =
  | "CPU"
  | "MOTHERBOARD"
  | "RAM"
  | "STORAGE"
  | "GPU"
  | "PSU"
  | "COOLER"
  | "CASE"
  | "MONITOR"
  | "PERIPHERAL"
  | "OTHER";

/** Komponent uchun bitta variant (dropdown elementi). */
export interface PcAltPart {
  productId: string;
  productName: string;
  supplierName: string;
  priceUsd: number;
  currency: string;
  costUzs: number;
  specNote: string;
  /** Shu variantning lot talabiga moslik foizi (0–100). To'liq mos = 100. */
  accuracyPct: number;
}

/** BOM dagi bitta komponent qatori. */
export interface PcBomItem {
  componentType: PcComponentType;
  requirement: string; // lot talabi (to'liq matn — zaxira)
  /** Toza talab token'lari (chip) — komponent nomi takrorlanmaydi: ["16 ГБ", "DDR4"]. */
  reqSpecs: string[];
  needed: boolean;
  matched: boolean;
  /** Aniqlik foizi (0–100): qondirilgan parametr / jami talab parametri. To'liq mos = 100;
   *  to'liq mos topilmasa — eng yaqin nomzodning foizi (productName ham o'shaniki, matched=false). */
  accuracyPct: number;
  productId: string | null;
  productName: string | null;
  supplierName: string | null;
  priceUsd: number | null;
  currency: string | null;
  costUzs: number | null;
  specNote: string;
  alternatives: PcAltPart[];
}

export interface PcBuildResult {
  isBuildable: boolean;
  items: PcBomItem[];
  quantity: number;
  unitCostUzs: number;
  totalCostUzs: number;
  lotPriceUzs: number;
  marginUzs: number;
  marginPct: number | null;
  coverage: { matched: number; needed: number };
  coreCovered: boolean;
  accuracyPct: number | null;
}

/** GET /api/pc-builds ro'yxat elementi. */
export interface PcBuildSummary {
  lotId: string;
  buyerLotId: number;
  title: string;
  customerName: string | null;
  categoryName: string | null;
  createdAt: string;
  tenderEndDate: string;
  status: "NEW" | "PROCESSING" | "UNMATCHED" | "EXPIRED";
  quantity: number;
  lotPriceUzs: number;
  unitCostUzs: number;
  totalCostUzs: number;
  marginUzs: number;
  marginPct: number | null;
  coverage: { matched: number; needed: number };
  coreCovered: boolean;
  accuracyPct: number | null;
}

export interface PcBuildKpis {
  totalLots: number;
  fullyCovered: number;
  profitable: number;
  avgMarginPct: number | null;
}

/** USD→UZS kurs holati (bank.uz jonli yoki qo'lda override). */
export interface UsdRate {
  rate: number;
  source: "override" | "bank.uz" | "cbu" | "default";
  overridden: boolean;
}

/** GET /api/pc-builds/:lotId — to'liq razbivka. */
export interface PcBuildDetail {
  lot: {
    id: string;
    buyerLotId: number;
    title: string;
    categoryName: string | null;
    price: number;
    customerName: string | null;
    quantity: number | null;
    unit: string | null;
    tenderEndDate: string;
  };
  build: PcBuildResult;
}
