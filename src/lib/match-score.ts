// Recommendation "moslik tahlili" foizini hisoblash — matematik aniq va null-xavfsiz.
//
// Yakuniy foiz ikki omildan: 1-bosqich vektorli (cosine) o'xshashlik (vector%) va
// texnik xususiyatlar mosligi (specs%). Vazn: vector 40% + specs 60%.
// Biror omil mavjud bo'lmasa (null/NaN), u qoldiriladi va qolgan(lar)i qayta
// normallashtiriladi — shu tariqa null qiymatlar manfiy yoki 100%+ natija bermaydi.

export type SpecMatchState = "ok" | "part" | "no";

/** Har xususiyat hissasi: aniq mos → 1, mos emas → 0, ahamiyatsiz/aniqlab bo'lmaydi → 0.5. */
const SPEC_WEIGHT: Record<SpecMatchState, number> = { ok: 1, no: 0, part: 0.5 };

/** Yakuniy formuladagi vazn ulushlari. */
export const VECTOR_WEIGHT = 0.4;
export const SPECS_WEIGHT = 0.6;

/** Qiymatni [0, 100] oralig'iga qisadi; cheksiz/NaN bo'lsa 0. */
export function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

/**
 * Texnik xususiyatlar moslik foizi (0..100) — holatlar o'rtacha vazni × 100.
 * Xususiyat bo'lmasa null qaytaradi (yakuniy hisobda e'tiborga olinmaydi).
 */
export function specsMatchPct(states: SpecMatchState[]): number | null {
  if (!states.length) return null;
  const sum = states.reduce((acc, s) => acc + (SPEC_WEIGHT[s] ?? 0.5), 0);
  return clampPct((sum / states.length) * 100);
}

/** Cosine (0..1, null bo'lishi mumkin) → foiz (0..100) yoki null. */
export function vectorPct(cosine: number | null | undefined): number | null {
  if (cosine == null || !Number.isFinite(cosine)) return null;
  return clampPct(cosine * 100);
}

/**
 * Yakuniy moslik foizi (0..100, butun son): vector 40% + specs 60%.
 * Mavjud omillar bo'yicha vaznli o'rtacha; biror omil null bo'lsa, qolganlari
 * vaznlari yig'indisiga qayta normallashtiriladi. Ikkalasi ham null → 0.
 */
export function overallMatchPct(
  vPct: number | null,
  sPct: number | null,
): number {
  const parts: Array<{ w: number; v: number }> = [];
  if (vPct != null && Number.isFinite(vPct))
    parts.push({ w: VECTOR_WEIGHT, v: clampPct(vPct) });
  if (sPct != null && Number.isFinite(sPct))
    parts.push({ w: SPECS_WEIGHT, v: clampPct(sPct) });

  if (parts.length === 0) return 0;

  const weightSum = parts.reduce((acc, p) => acc + p.w, 0);
  if (weightSum <= 0) return 0;
  const weighted = parts.reduce((acc, p) => acc + p.w * p.v, 0);
  return Math.round(clampPct(weighted / weightSum));
}
