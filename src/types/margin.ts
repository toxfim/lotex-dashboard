// Marja narvoni (tier) — narx oralig'iga qarab koeffitsient (1.3 = +30%).
// Backend: /api/margin-tiers (GET, PUT, GET /for-price).

/** Backend qaytaradigan tier qatori. */
export interface ApiMarginTier {
  id: string;
  minPrice: number;
  /** null = ochiq yuqori tier (undan yuqori barcha narxlar). */
  maxPrice: number | null;
  /** Marja koeffitsienti — 1.3 = +30% ustama. */
  multiplier: number;
  note: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** PUT /api/margin-tiers uchun bitta tier kirishi (butun narvon yuboriladi). */
export interface MarginTierInput {
  minPrice: number;
  maxPrice: number | null;
  multiplier: number;
  note?: string | null;
}
