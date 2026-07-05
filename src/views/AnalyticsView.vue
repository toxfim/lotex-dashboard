<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useLotStore } from "@/stores/lots";
import { useI18n } from "@/composables/useI18n";
import { api } from "@/lib/api";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import NotificationBell from "@/components/layout/NotificationBell.vue";
import TopbarSettings from "@/components/layout/TopbarSettings.vue";
import DecisionsChart from "@/components/charts/DecisionsChart.vue";
import StatusDonut from "@/components/charts/StatusDonut.vue";
import HBars from "@/components/charts/HBars.vue";
import FunnelChart from "@/components/charts/FunnelChart.vue";
import type { DayDecision, FunnelStage } from "@/types/stock";
import { fmtNum, compactSom, computePricing } from "@/lib/formatters";

const lotStore = useLotStore();
const { t } = useI18n();
const period = ref("30");

// Jonli analitika (backend agregat /api/analytics).
interface AnalyticsStats {
  lots: { total: number; byResult: Record<string, number> };
  recommendations: {
    total: number;
    byDecision: Record<string, number>;
    avgConfidence: number;
  };
  funnel: { scanned: number; matched: number; accepted: number; won: number };
  decisions7d: {
    day: string;
    accepted: number;
    rejected: number;
    pending: number;
  }[];
  shop: { products: number };
}
const stats = ref<AnalyticsStats | null>(null);

onMounted(async () => {
  try {
    const res = await api.getAnalytics();
    stats.value = res.data as AnalyticsStats;
  } catch {
    /* yuklanmasa — lotStore'dan qisman ko'rsatamiz */
  }
});

const WEEKDAY = computed(() => [
  t("time.weekday.sun"),
  t("time.weekday.mon"),
  t("time.weekday.tue"),
  t("time.weekday.wed"),
  t("time.weekday.thu"),
  t("time.weekday.fri"),
  t("time.weekday.sat"),
]);
const liveDecisions = computed<DayDecision[]>(
  () =>
    stats.value?.decisions7d.map((d) => ({
      day: WEEKDAY.value[new Date(d.day).getDay()] ?? d.day.slice(5),
      accepted: d.accepted,
      rejected: d.rejected,
    })) ?? [],
);

const liveFunnel = computed<FunnelStage[]>(() => {
  const f = stats.value?.funnel;
  if (!f) return [];
  return [
    {
      label: t("analytics.funnel.scanned"),
      value: f.scanned,
      color: "#b9bee8",
    },
    {
      label: t("analytics.funnel.matched"),
      value: f.matched,
      color: "var(--accent)",
    },
    {
      label: t("analytics.funnel.accepted"),
      value: f.accepted,
      color: "var(--good)",
    },
    {
      label: t("analytics.funnel.won"),
      value: f.won,
      color: "#12a150",
    },
  ];
});

const CAT_COLORS = [
  "var(--accent)",
  "#2743e0",
  "#12a150",
  "#d98a06",
  "#7c5cd6",
  "#c05a3e",
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

const acceptRate = computed(() => {
  const d = stats.value?.recommendations.byDecision;
  if (!d) return 0;
  const reviewed = (d.ACCEPTED ?? 0) + (d.REJECTED ?? 0);
  return reviewed ? Math.round(((d.ACCEPTED ?? 0) / reviewed) * 100) : 0;
});

const kpis = computed(() => [
  {
    label: t("analytics.funnel.scanned"),
    val: fmtNum(stats.value?.funnel.scanned ?? lotStore.lots.length),
    sub: t("analytics.kpi.scanned.sub"),
    delta: null as number | null,
    icon: "vector",
    tint: "accent" as const,
  },
  {
    label: t("analytics.kpi.matched.label"),
    val: fmtNum(stats.value?.funnel.matched ?? 0),
    sub: t("analytics.kpi.matched.sub"),
    delta: null as number | null,
    icon: "sparkle",
    tint: "accent" as const,
  },
  {
    label: t("analytics.kpi.acceptRate.label"),
    val: acceptRate.value + "%",
    sub: t("analytics.kpi.acceptRate.sub"),
    delta: null as number | null,
    icon: "check",
    tint: "good" as const,
  },
  {
    label: t("analytics.kpi.wonValue.label"),
    val: compactSom(wonValue.value) + " " + t("currency.som"),
    sub: t("analytics.kpi.wonValue.sub"),
    delta: null as number | null,
    icon: "coins",
    tint: "good" as const,
  },
  {
    label: t("analytics.kpi.avgConfidence.label"),
    val: Math.round(stats.value?.recommendations.avgConfidence ?? 0) + "%",
    sub: t("analytics.kpi.avgConfidence.sub"),
    delta: null as number | null,
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
        <h1>{{ t("analytics.title") }}</h1>
        <div class="crumb-sub">{{ t("analytics.subtitle") }}</div>
      </div>
      <div class="topbar-right">
        <div class="seg" style="width: 210px">
          <button
            v-for="[v, l] in [
              ['7', t('analytics.period.7d')],
              ['30', t('analytics.period.30d')],
              ['365', t('analytics.period.year')],
            ]"
            :key="v"
            :class="{ on: period === v }"
            @click="period = v"
          >
            {{ l }}
          </button>
        </div>
        <NotificationBell />
        <TopbarSettings />
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
                <div class="card-title">
                  {{ t("analytics.decisionsVolume.title") }}
                </div>
                <div class="card-sub">
                  {{ t("analytics.decisionsVolume.sub") }}
                </div>
              </div>
            </div>
            <DecisionsChart :data="liveDecisions" />
          </div>
          <div class="card">
            <div class="card-head">
              <div>
                <div class="card-title">
                  {{ t("analytics.statusDist.title") }}
                </div>
                <div class="card-sub">{{ t("analytics.statusDist.sub") }}</div>
              </div>
            </div>
            <StatusDonut :counts="counts" />
          </div>
        </div>

        <div class="an-grid" style="margin-top: 14px">
          <div class="card">
            <div class="card-head">
              <div>
                <div class="card-title">
                  {{ t("analytics.catValue.title") }}
                </div>
                <div class="card-sub">{{ t("analytics.catValue.sub") }}</div>
              </div>
            </div>
            <HBars :data="valueByCat" />
          </div>
          <div class="card">
            <div class="card-head">
              <div>
                <div class="card-title">
                  {{ t("analytics.aiPipeline.title") }}
                </div>
                <div class="card-sub">{{ t("analytics.aiPipeline.sub") }}</div>
              </div>
            </div>
            <FunnelChart :data="liveFunnel" />
          </div>
        </div>

        <div class="card" style="margin-top: 14px">
          <div class="card-head">
            <div>
              <div class="card-title">
                {{ t("analytics.recentDecisions.title") }}
              </div>
              <div class="card-sub">
                {{ t("analytics.recentDecisions.sub") }}
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
                    ? compactSom(computePricing(l.pricing).bidTotal) +
                      " " +
                      t("currency.som")
                    : "—"
                }}
              </div>
            </div>
            <div
              v-if="recent.length === 0"
              style="padding: 20px 0; color: var(--ink-4); font-size: 13px"
            >
              {{ t("analytics.noDecisionsYet") }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
