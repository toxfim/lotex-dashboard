import type { DayDecision, FunnelStage, AnalyticsData } from "@/types/stock";

export const DECISIONS_7D: DayDecision[] = [
  { day: "Du", accepted: 5, rejected: 2 },
  { day: "Se", accepted: 7, rejected: 3 },
  { day: "Ch", accepted: 4, rejected: 4 },
  { day: "Pa", accepted: 8, rejected: 2 },
  { day: "Ju", accepted: 6, rejected: 5 },
  { day: "Sh", accepted: 3, rejected: 1 },
  { day: "Ya", accepted: 2, rejected: 1 },
];

export const FUNNEL: FunnelStage[] = [
  { label: "Skanerlangan lotlar", value: 8642, color: "oklch(0.72 0.04 256)" },
  { label: "Vektor nomzodlari", value: 412, color: "oklch(0.64 0.10 256)" },
  { label: "LLM tasdiqladi", value: 64, color: "var(--accent)" },
  { label: "Ko'rib chiqildi", value: 51, color: "oklch(0.5 0.12 220)" },
  { label: "Qabul qilindi", value: 32, color: "var(--good)" },
];

export const ANALYTICS: AnalyticsData = {
  scannedWeek: 8642,
  scannedDelta: 12.4,
  matchedWeek: 64,
  matchedDelta: 8.0,
  acceptRate: 63,
  acceptDelta: 4.0,
  avgMargin: 18.6,
  marginDelta: -1.3,
};
