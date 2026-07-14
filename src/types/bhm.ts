/** BHM (bazaviy hisoblash miqdori) — GET /api/bhm elementi. */
export interface ApiBhm {
  id: string;
  amount: number;
  /** ISO sana — shu sanadan boshlab amal qiladi */
  effectiveFrom: string;
  note: string | null;
  createdAt: string;
}

/** POST/PATCH /api/bhm tanasi. */
export interface BhmInput {
  amount: number;
  effectiveFrom: string;
  note?: string | null;
}
