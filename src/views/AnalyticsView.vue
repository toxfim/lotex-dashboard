<script setup lang="ts">
import { ref, computed } from "vue";
import { useLotStore } from "@/stores/lots";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import DecisionsChart from "@/components/charts/DecisionsChart.vue";
import StatusDonut from "@/components/charts/StatusDonut.vue";
import HBars from "@/components/charts/HBars.vue";
import FunnelChart from "@/components/charts/FunnelChart.vue";
import { DECISIONS_7D, FUNNEL, ANALYTICS } from "@/data/stock";
import { fmtNum, compactSom, computePricing } from "@/lib/formatters";

const lotStore = useLotStore();
const period = ref("30");

const CAT_COLORS = [
  "var(--accent)",
  "oklch(0.6 0.13 200)",
  "oklch(0.62 0.13 156)",
  "oklch(0.7 0.13 72)",
  "oklch(0.6 0.13 300)",
  "oklch(0.62 0.12 30)",
];

const counts = computed(() => ({
  pending: lotStore.pending.length,
  accepted: lotStore.accepted.length,
  rejected: lotStore.rejected.length,
}));

const wonValue = computed(() =>
  lotStore.accepted.reduce((s, l) => s + computePricing(l.pricing).bidTotal, 0),
);

const valueByCat = computed(() => {
  const m: Record<string, number> = {};
  lotStore.lots.forEach((l) => {
    m[l.category] = (m[l.category] || 0) + l.maxPrice;
  });
  return Object.entries(m)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .map((d, i) => ({ ...d, color: CAT_COLORS[i % CAT_COLORS.length] }));
});

const recent = computed(() =>
  lotStore.lots.filter((l) => l.status !== "pending"),
);

const kpis = computed(() => [
  {
    label: "Skanerlangan lotlar",
    val: fmtNum(ANALYTICS.scannedWeek),
    sub: "shu hafta",
    delta: ANALYTICS.scannedDelta,
    icon: "vector",
    tint: "accent" as const,
  },
  {
    label: "Mos kelgan lotlar",
    val: fmtNum(ANALYTICS.matchedWeek),
    sub: "AI tomonidan",
    delta: ANALYTICS.matchedDelta,
    icon: "sparkle",
    tint: "accent" as const,
  },
  {
    label: "Qabul darajasi",
    val: ANALYTICS.acceptRate + "%",
    sub: "ko'rib chiqilganlardan",
    delta: ANALYTICS.acceptDelta,
    icon: "check",
    tint: "good" as const,
  },
  {
    label: "Yutilgan qiymat",
    val: compactSom(wonValue.value) + " so'm",
    sub: "qabul qilingan takliflar",
    delta: null as number | null,
    icon: "coins",
    tint: "good" as const,
  },
  {
    label: "O'rtacha marja",
    val: ANALYTICS.avgMargin + "%",
    sub: "sof foyda",
    delta: ANALYTICS.marginDelta,
    icon: "scale",
    tint: "warn" as const,
  },
]);

const tint: Record<string, [string, string]> = {
  accent: ["var(--accent-soft)", "var(--accent-ink)"],
  good: ["var(--good-soft)", "var(--good-ink)"],
  warn: ["var(--warn-soft)", "var(--warn-ink)"],
};
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div>
        <h1>Analitika</h1>
        <div class="crumb-sub">Tender quvuri va qaror ko'rsatkichlari</div>
      </div>
      <div class="topbar-right">
        <div class="seg" style="width: 210px">
          <button
            v-for="[v, l] in [
              ['7', '7 kun'],
              ['30', '30 kun'],
              ['365', 'Yil'],
            ]"
            :key="v"
            :class="{ on: period === v }"
            @click="period = v"
          >
            {{ l }}
          </button>
        </div>
        <button class="icon-btn">
          <BaseIcon name="bell" /><span class="badge-dot" />
        </button>
      </div>
    </header>

    <div class="page-scroll scroll">
      <div class="page-inner fade-page">
        <div class="kpi-grid">
          <div v-for="k in kpis" :key="k.label" class="kpi">
            <div class="kpi-top">
              <div
                class="kpi-icon"
                :style="{ background: tint[k.tint][0], color: tint[k.tint][1] }"
              >
                <BaseIcon :name="k.icon" />
              </div>
              <span
                v-if="k.delta !== null"
                :class="[
                  'kpi-delta',
                  k.delta > 0 ? 'up' : k.delta < 0 ? 'down' : 'flat',
                ]"
              >
                <BaseIcon
                  name="trendUp"
                  :style="k.delta < 0 ? { transform: 'scaleY(-1)' } : undefined"
                />
                {{ k.delta > 0 ? "+" : "" }}{{ k.delta }}%
              </span>
            </div>
            <div class="kpi-label">{{ k.label }}</div>
            <div class="kpi-val mono">{{ k.val }}</div>
            <div class="kpi-sub">{{ k.sub }}</div>
          </div>
        </div>

        <div class="an-grid" style="margin-top: 14px">
          <div class="card">
            <div class="card-head">
              <div>
                <div class="card-title">Qarorlar hajmi</div>
                <div class="card-sub">Oxirgi 7 kun · menejer triaji</div>
              </div>
            </div>
            <DecisionsChart :data="DECISIONS_7D" />
          </div>
          <div class="card">
            <div class="card-head">
              <div>
                <div class="card-title">Holatlar taqsimoti</div>
                <div class="card-sub">Joriy lotlar bo'yicha</div>
              </div>
            </div>
            <StatusDonut :counts="counts" />
          </div>
        </div>

        <div class="an-grid" style="margin-top: 14px">
          <div class="card">
            <div class="card-head">
              <div>
                <div class="card-title">Kategoriya bo'yicha qiymat</div>
                <div class="card-sub">Lotlarning umumiy maksimal narxi</div>
              </div>
            </div>
            <HBars :data="valueByCat" />
          </div>
          <div class="card">
            <div class="card-head">
              <div>
                <div class="card-title">AI moslik quvuri</div>
                <div class="card-sub">Skanerdan qabulgacha · shu hafta</div>
              </div>
            </div>
            <FunnelChart :data="FUNNEL" />
          </div>
        </div>

        <div class="card" style="margin-top: 14px">
          <div class="card-head">
            <div>
              <div class="card-title">So'nggi qarorlar</div>
              <div class="card-sub">
                Menejerlar tomonidan ko'rib chiqilgan lotlar
              </div>
            </div>
          </div>
          <div class="recent">
            <div v-for="l in recent" :key="l.id" class="recent-row">
              <div
                :class="['recent-ic', l.status === 'accepted' ? 'acc' : 'rej']"
              >
                <BaseIcon :name="l.status === 'accepted' ? 'check' : 'x'" />
              </div>
              <div class="recent-main">
                <div class="rm-t">{{ l.title }}</div>
                <div class="rm-s">
                  {{ l.customer }} · {{ l.decidedBy }} · {{ l.decidedAgo }}
                </div>
              </div>
              <div
                class="recent-money mono"
                :style="{
                  color:
                    l.status === 'accepted'
                      ? 'var(--good-ink)'
                      : 'var(--ink-4)',
                }"
              >
                {{
                  l.status === "accepted"
                    ? compactSom(computePricing(l.pricing).bidTotal) + " so'm"
                    : "—"
                }}
              </div>
            </div>
            <div
              v-if="recent.length === 0"
              style="padding: 20px 0; color: var(--ink-4); font-size: 13px"
            >
              Hali qaror qabul qilinmagan.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
