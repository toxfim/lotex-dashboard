export interface StockItem {
  code: string;
  name: string;
  cat: string;
  avail: number;
  cap: number;
  unit: string;
  cost: number;
  reorder: number;
}

export interface DayDecision {
  day: string;
  accepted: number;
  rejected: number;
}

export interface FunnelStage {
  label: string;
  value: number;
  color: string;
}

export interface AnalyticsData {
  scannedWeek: number;
  scannedDelta: number;
  matchedWeek: number;
  matchedDelta: number;
  acceptRate: number;
  acceptDelta: number;
  avgMargin: number;
  marginDelta: number;
}
