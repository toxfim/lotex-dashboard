// Tenderga qatnashish (bid) — backend javob turlari (boundary domain types).
// Backend: POST /api/tenders/:lotId/{participation-preview, pledge-preview, bid}.
// Garov/komissiya UZEX serveridan olinadi (lokal formula yo'q); sebestoimost va
// qatnashish narxi backendda TESKARI formula bilan hisoblanadi (5% YaTT soliq va
// komissiya tushumdan olinadi — shuning uchun ÷(1−t), ×(1+t) EMAS).

export interface PledgeMargin {
  /** Kutilayotgan foyda = shartnoma − (tan + dostavka + logistika + komissiya). */
  expectedProfit: number;
  /** Foyda foizi. */
  marginPercent: number;
}

/** POST /tenders/:lotId/pledge-preview javobi (garov/komissiya — uzex). */
export interface PledgePreview {
  pledge: number;
  commission: number;
  contractSum: number;
  margin: PledgeMargin | null;
}

/** POST /tenders/:lotId/participation-preview javobi — asosiy hisob-kitob. */
export interface ParticipationPreview {
  product: {
    /** Kiritilgan tovar narxi (birlik, kiritilgan valyutada). */
    price: number;
    currency: "USD" | "UZS";
    /** UZS'ga o'girilgan birlik narx. */
    priceUzs: number;
    /** USD bo'lsa qo'llangan kurs, UZS bo'lsa null. */
    exchange: { rate: number; source: string } | null;
  };
  margin: {
    /** Marja koeffitsienti (1.3 = +30%) — narx narvonidan. */
    multiplier: number;
    tierId: string;
    minPrice: number;
    maxPrice: number | null;
  };
  entity: {
    orgForm: string | null;
    /** YaTT bo'lsa tushumdan 5% soliq qo'shiladi. */
    isYatt: boolean;
    taxRate: number;
  };
  inputs: {
    quantity: number;
    startUnitPrice: number;
    startTotal: number;
    additionalCosts: number;
  };
  /** uzex ishtirok komissiyasi (fee — haqiqiy xarajat, JAMI). */
  commission: number;
  /** uzex garovi (muzlatiladi, keyin QAYTADI — xarajat emas). */
  pledge: number;
  /** Jami muzlatiladigan summa (= pledge). */
  totalFrozen: number;
  /** Break-even: shu narxda foyda = 0. */
  sebestoimost: { total: number; perUnit: number };
  /** Marjali tavsiya qatnashish narxi. */
  participation: {
    total: number;
    perUnit: number;
    /** Birlik narx YUQORIGA yaxlitlangan (break-even'dan pastga tushmaslik uchun). */
    suggestedBidUnitPrice: number;
  };
  breakdown: {
    baseCostTotal: number;
    marginAmount: number;
    additionalCosts: number;
    commission: number;
    taxAmount: number;
  };
  warnings: string[];
}

/** POST /tenders/:lotId/bid javobi (dryRun yoki haqiqiy). */
export interface TenderBidResult {
  bid: { id: string; status: string; totalFrozen: number };
  /** dryRun bo'lsa true — haqiqiy taklif YUBORILMAGAN. */
  dryRun?: boolean;
  wouldBePayload?: { lot_Id: number; price: number; record_Id: number | null };
  /** Haqiqiy yuborishda true. */
  submitted?: boolean;
}
