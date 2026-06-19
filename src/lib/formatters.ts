export function fmtSom(n: number): string {
  return Math.round(n).toLocaleString('ru-RU').replace(/\u00A0/g, ' ').replace(/,/g, ' ')
}

export function fmtNum(n: number): string {
  return n.toLocaleString('ru-RU').replace(/\u00A0/g, ' ').replace(/,/g, ' ')
}

export function compactSom(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace('.', ',') + ' mlrd'
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e8 ? 0 : 1).replace('.', ',') + ' mln'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' ming'
  return String(n)
}

export interface DeadlineResult {
  text: string
  sub: string
  urgent: boolean
  closed: boolean
}

export function deadline(h: number): DeadlineResult {
  if (h <= 0) return { text: 'Yopilgan', sub: '', urgent: false, closed: true }
  const d = Math.floor(h / 24)
  const hr = h % 24
  const text = d > 0 ? `${d} kun ${hr} soat` : `${hr} soat`
  return { text, sub: '', urgent: h <= 24, closed: false }
}

export interface PricingResult {
  bidTotal: number
  costTotal: number
  gross: number
  net: number
  netPct: number
  grossPct: number
}

export function computePricing(p: { bidUnit: number; qty: number; unitCost: number; fee: number }): PricingResult {
  const bidTotal = p.bidUnit * p.qty
  const costTotal = p.unitCost * p.qty
  const gross = bidTotal - costTotal
  const net = gross - p.fee
  const netPct = (net / bidTotal) * 100
  const grossPct = (gross / bidTotal) * 100
  return { bidTotal, costTotal, gross, net, netPct, grossPct }
}
