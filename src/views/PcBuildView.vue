<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { api } from "@/lib/api";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import EmptyState from "@/components/shared/EmptyState.vue";
import MatchRing from "@/components/shared/MatchRing.vue";
import TopbarSettings from "@/components/layout/TopbarSettings.vue";
import { useToast } from "@/composables/useToast";
import { useI18n } from "@/composables/useI18n";
import {
  compactSom,
  deadline,
  fmtNum,
  fmtSom,
  hoursUntil,
} from "@/lib/formatters";
import type {
  PcAltPart,
  PcBomItem,
  PcBuildDetail,
  PcBuildKpis,
  PcBuildSummary,
} from "@/types/pc-build";

const PAGE_SIZE = 20;

const { pushToast } = useToast();
const { t } = useI18n();

// ---- ro'yxat holati ----
const items = ref<PcBuildSummary[]>([]);
const kpis = ref<PcBuildKpis | null>(null);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const error = ref<string | null>(null);
const onlyProfitable = ref(false);

// ---- lot ochilish uslubi (panel / modal), localStorage'da saqlanadi ----
type OpenMode = "drawer" | "modal";
const mode = ref<OpenMode>(
  (localStorage.getItem("sb_mode") as OpenMode) || "drawer",
);
function setMode(m: OpenMode) {
  mode.value = m;
  localStorage.setItem("sb_mode", m);
}

// ---- drawer/modal (lot konfiguratsiyasi) ----
const selectedLotId = ref<string | null>(null);
const detail = ref<PcBuildDetail | null>(null);
const detailLoading = ref(false);
const closing = ref(false);
let closeTimer: ReturnType<typeof setTimeout> | null = null;
// har komponent (item indeksi) uchun tanlangan variant indeksi (default 0 = arzon)
const altSel = ref<Record<number, number>>({});
// rasmi yo'q (404) lotlar — jadval thumbnaillarini yashirish uchun
const failedImg = ref(new Set<string>());
// drawer sarlavhasidagi katta rasm ko'rinishi (lot almashganda tiklanadi)
const isDrawerImageVisible = ref(true);

// ---- USD→UZS kurs (bank.uz jonli yoki qo'lda override) ----
const rateState = ref<{
  rate: number;
  source: string;
  overridden: boolean;
} | null>(null);
const rateInput = ref<number | null>(null);
const rateSaving = ref(false);

const COMPONENT_LABEL_KEYS: Record<string, string> = {
  CPU: "pcBuild.comp.CPU",
  MOTHERBOARD: "pcBuild.comp.MOTHERBOARD",
  RAM: "pcBuild.comp.RAM",
  STORAGE: "pcBuild.comp.STORAGE",
  GPU: "pcBuild.comp.GPU",
  PSU: "pcBuild.comp.PSU",
  COOLER: "pcBuild.comp.COOLER",
  CASE: "pcBuild.comp.CASE",
  MONITOR: "pcBuild.comp.MONITOR",
  PERIPHERAL: "pcBuild.comp.PERIPHERAL",
  OTHER: "pcBuild.comp.OTHER",
};
const compLabel = (compType: string): string =>
  COMPONENT_LABEL_KEYS[compType] ? t(COMPONENT_LABEL_KEYS[compType]) : compType;

const COMPONENT_ICON: Record<string, string> = {
  CPU: "cpu",
  MOTHERBOARD: "vector",
  RAM: "memory",
  STORAGE: "drive",
  GPU: "gpu",
  PSU: "power",
  COOLER: "fan",
  CASE: "tower",
  MONITOR: "image",
  PERIPHERAL: "box",
  OTHER: "box",
};
const compIcon = (t: string): string => COMPONENT_ICON[t] || "box";

const shown = computed(() => items.value.length);
const hasMore = computed(() => shown.value < total.value);

/** Moslik foizi rangi (jadval pill'i). */
function matchColorVars(v: number): { fg: string; bg: string; line: string } {
  if (v >= 90)
    return {
      fg: "var(--good-ink)",
      bg: "var(--good-soft)",
      line: "var(--good-line)",
    };
  if (v >= 75)
    return {
      fg: "var(--accent-ink)",
      bg: "var(--accent-soft)",
      line: "var(--accent-line)",
    };
  if (v >= 55)
    return {
      fg: "var(--warn-ink)",
      bg: "var(--warn-soft)",
      line: "var(--warn-line)",
    };
  return {
    fg: "var(--bad-ink)",
    bg: "var(--bad-soft)",
    line: "var(--bad-line)",
  };
}
function pillStyle(v: number) {
  const cv = matchColorVars(v);
  return { color: cv.fg, background: cv.bg, borderColor: cv.line };
}

type MatchCls = "ok" | "part" | "no";
interface StatusInfo {
  cls: MatchCls;
  label: string;
  icon: string;
}

/** Coverage + accuracy'dan jadval qatori / xulosa uchun moslik holati. */
function buildStatus(
  cov: { matched: number; needed: number },
  accuracyPct: number | null,
): StatusInfo {
  const unmatched = cov.needed - cov.matched;
  if (cov.needed === 0)
    return { cls: "ok", label: t("pcBuild.status.fullMatch"), icon: "check" };
  if (unmatched > 0)
    return {
      cls: "no",
      label: t("pcBuild.status.mismatchCount", { n: unmatched }),
      icon: "x",
    };
  if (accuracyPct != null && accuracyPct < 100)
    return { cls: "part", label: t("pcBuild.status.partial"), icon: "alert" };
  return { cls: "ok", label: t("pcBuild.status.fullMatch"), icon: "check" };
}
const rowStatus = (s: PcBuildSummary): StatusInfo =>
  buildStatus(s.coverage, s.accuracyPct);

/** Bitta komponent uchun moslik bayrog'i. */
function compFlag(it: PcBomItem): StatusInfo {
  if (!it.needed)
    return { cls: "ok", label: t("pcBuild.status.match"), icon: "check" };
  if (!it.matched)
    return { cls: "no", label: t("pcBuild.status.mismatch"), icon: "x" };
  if (it.accuracyPct != null && it.accuracyPct < 100)
    return { cls: "part", label: t("pcBuild.status.partial"), icon: "minus" };
  return { cls: "ok", label: t("pcBuild.status.match"), icon: "check" };
}
const compCardClass = (it: PcBomItem): string => {
  const f = compFlag(it).cls;
  return f === "no" ? "bad" : f === "part" ? "warn" : "";
};

/** Bitta variant (alternativa) uchun moslik darajasi. */
function altCls(pct: number): MatchCls {
  if (pct >= 100) return "ok";
  if (pct >= 50) return "part";
  return "no";
}
const altIcon = (pct: number): string =>
  pct >= 100 ? "check" : pct >= 50 ? "minus" : "x";

function reqText(it: PcBomItem): string {
  if (it.reqSpecs.length) return it.reqSpecs.join(", ");
  return it.requirement || "—";
}

async function load(reset = false) {
  if (loading.value) return;
  if (reset) {
    page.value = 1;
    items.value = [];
  }
  loading.value = true;
  error.value = null;
  try {
    const res = await api.getPcBuilds({
      page: page.value,
      limit: PAGE_SIZE,
      onlyProfitable: onlyProfitable.value || undefined,
    });
    items.value = reset ? res.data : [...items.value, ...res.data];
    kpis.value = res.kpis;
    total.value = res.meta.total;
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("common.loadError");
  } finally {
    loading.value = false;
  }
}

function loadMore() {
  page.value += 1;
  load(false);
}

function toggleProfitable() {
  onlyProfitable.value = !onlyProfitable.value;
  load(true);
}

async function openLot(lotId: string) {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  closing.value = false;
  selectedLotId.value = lotId;
  detail.value = null;
  altSel.value = {};
  isDrawerImageVisible.value = true;
  detailLoading.value = true;
  try {
    const res = await api.getPcBuild(lotId);
    detail.value = res.data;
    const sel: Record<number, number> = {};
    res.data.build.items.forEach((_, i) => (sel[i] = 0));
    altSel.value = sel;
  } catch {
    selectedLotId.value = null;
  } finally {
    detailLoading.value = false;
  }
}

function closeDrawer() {
  if (!selectedLotId.value || closing.value) return;
  closing.value = true;
  closeTimer = setTimeout(() => {
    selectedLotId.value = null;
    detail.value = null;
    closing.value = false;
    closeTimer = null;
  }, 220);
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") closeDrawer();
}

const buildItems = computed(() => detail.value?.build.items ?? []);

/** Komponent uchun tanlangan variant (dropdown / radio). */
function chosenAlt(idx: number, it: PcBomItem): PcAltPart | null {
  if (!it.needed || it.alternatives.length === 0) return null;
  const i = altSel.value[idx] ?? 0;
  return it.alternatives[i] ?? it.alternatives[0];
}

/** Tanlangan variantlar bo'yicha 1 dona sborka tannarxi.
 *  Faqat mos (matched) komponentlar tannarxga kiradi — near-miss variantlar
 *  ko'rsatiladi-yu, lekin backend hisobiga mos ravishda tannarxga qo'shilmaydi. */
const unitCost = computed(() =>
  buildItems.value.reduce(
    (sum, it, i) => sum + (it.matched ? (chosenAlt(i, it)?.costUzs ?? 0) : 0),
    0,
  ),
);

const drawerQty = computed(() => detail.value?.build.quantity ?? 1);
const drawerTotalCost = computed(() => unitCost.value * drawerQty.value);
const lotPrice = computed(() => detail.value?.lot.price ?? 0);
const maxUnit = computed(() =>
  drawerQty.value > 0 ? lotPrice.value / drawerQty.value : 0,
);
const usePctRaw = computed(() =>
  maxUnit.value > 0 ? (unitCost.value / maxUnit.value) * 100 : 0,
);
const usePctBar = computed(() => Math.min(100, usePctRaw.value));

const net = computed(() => lotPrice.value - drawerTotalCost.value);
const netPct = computed(() =>
  lotPrice.value > 0 ? (net.value / lotPrice.value) * 100 : 0,
);
const viability = computed<{
  cls: "good" | "edge" | "bad";
  label: string;
  icon: string;
}>(() => {
  if (net.value <= 0)
    return { cls: "bad", label: t("lotCard.viab.bad"), icon: "x" };
  if (netPct.value < 6)
    return { cls: "edge", label: t("lotCard.viab.edge"), icon: "alert" };
  return { cls: "good", label: t("lotCard.viab.good"), icon: "trendUp" };
});

const coverage = computed(
  () => detail.value?.build.coverage ?? { matched: 0, needed: 0 },
);
const compat = computed<StatusInfo>(() =>
  buildStatus(coverage.value, detail.value?.build.accuracyPct ?? null),
);
const compatClass = computed(() =>
  compat.value.cls === "no"
    ? "bad"
    : compat.value.cls === "part"
      ? "warn"
      : "ok",
);

const drawerAccuracy = computed(() =>
  Math.round(detail.value?.build.accuracyPct ?? 0),
);

function deadlineText(iso: string): string {
  return deadline(hoursUntil(iso)).text;
}

/** Jadval qatori uchun tender muddati + ochiq/yopiq holati. */
function endInfo(s: PcBuildSummary): {
  text: string;
  urgent: boolean;
  open: boolean;
} {
  const d = deadline(hoursUntil(s.tenderEndDate));
  const open = !d.closed && s.status !== "EXPIRED";
  return { text: open ? d.text : "—", urgent: open && d.urgent, open };
}

function resetPicks() {
  const sel: Record<number, number> = {};
  buildItems.value.forEach((_, i) => (sel[i] = 0));
  altSel.value = sel;
}

function savePicks() {
  const unmatched = coverage.value.needed - coverage.value.matched;
  if (unmatched > 0) {
    pushToast({
      kind: "rej",
      title: t("pcBuild.toast.notReady"),
      sub: t("pcBuild.toast.notReadySub", { n: unmatched }),
      undoId: "",
    });
    return;
  }
  pushToast({
    kind: "acc",
    title: t("pcBuild.toast.saved"),
    sub: `${fmtNum(drawerQty.value)} ${t("common.count")} · ${compactSom(drawerTotalCost.value)} ${t("currency.som")}`,
    undoId: "",
  });
  closeDrawer();
}

async function loadRate() {
  try {
    const { data } = await api.getUsdRate();
    rateState.value = data;
    rateInput.value = data.rate;
  } catch {
    /* kursni olib bo'lmadi — jadval baribir ishlaydi */
  }
}

async function saveRate() {
  if (rateInput.value == null || rateInput.value <= 0 || rateSaving.value)
    return;
  rateSaving.value = true;
  try {
    const { data } = await api.setUsdRate(rateInput.value);
    rateState.value = data;
    rateInput.value = data.rate;
    await load(true); // narxlar yangi kurs bilan qayta hisoblanadi
  } finally {
    rateSaving.value = false;
  }
}

async function resetRate() {
  if (rateSaving.value) return;
  rateSaving.value = true;
  try {
    const { data } = await api.setUsdRate(null); // jonli (bank.uz) kursga qaytish
    rateState.value = data;
    rateInput.value = data.rate;
    await load(true);
  } finally {
    rateSaving.value = false;
  }
}

onMounted(() => {
  load(true);
  loadRate();
  window.addEventListener("keydown", onKey);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
  if (closeTimer) clearTimeout(closeTimer);
});
</script>

<template>
  <div class="page pc-page">
    <header class="topbar">
      <div>
        <h1>{{ t("pcBuild.title") }}</h1>
        <div class="crumb-sub">{{ t("pcBuild.subtitle") }}</div>
      </div>
      <div class="topbar-right">
        <div class="rate-box" :title="t('pcBuild.rate.title')">
          <span class="rate-lab">1$ =</span>
          <input
            v-model.number="rateInput"
            type="number"
            class="rate-input"
            @keyup.enter="saveRate"
          />
          <span class="rate-lab">{{ t("currency.som") }}</span>
          <button
            class="rate-save"
            :disabled="rateSaving || rateInput === rateState?.rate"
            @click="saveRate"
          >
            {{ t("common.save") }}
          </button>
          <span class="rate-src">{{
            rateState?.overridden
              ? t("pcBuild.rate.manual")
              : (rateState?.source ?? "…")
          }}</span>
          <button
            v-if="rateState?.overridden"
            class="rate-reset"
            :title="t('pcBuild.rate.resetToLive')"
            @click="resetRate"
          >
            <BaseIcon name="refresh" />
          </button>
        </div>
        <button
          class="btn btn-ghost"
          :class="{ 'on-toggle': onlyProfitable }"
          @click="toggleProfitable"
        >
          <BaseIcon name="check" />{{ t("pcBuild.onlyProfitable") }}
        </button>
        <div class="sb-mode" :title="t('pcBuild.openModeTitle')">
          <button :class="{ on: mode === 'drawer' }" @click="setMode('drawer')">
            <BaseIcon name="layers" />{{ t("pcBuild.mode.panel") }}
          </button>
          <button :class="{ on: mode === 'modal' }" @click="setMode('modal')">
            <BaseIcon name="box" />{{ t("pcBuild.mode.modal") }}
          </button>
        </div>
        <TopbarSettings />
      </div>
    </header>

    <div class="page-scroll scroll">
      <div class="page-inner fade-page">
        <!-- KPI -->
        <div class="kpi-grid">
          <div class="kpi">
            <div
              class="kpi-icon"
              style="background: var(--accent-soft); color: var(--accent-ink)"
            >
              <BaseIcon name="cpu" />
            </div>
            <div class="kpi-label">{{ t("pcBuild.kpi.totalLots.label") }}</div>
            <div class="kpi-val mono">{{ fmtNum(kpis?.totalLots ?? 0) }}</div>
            <div class="kpi-sub">{{ t("pcBuild.kpi.totalLots.sub") }}</div>
          </div>
          <div class="kpi">
            <div
              class="kpi-icon"
              style="background: var(--good-soft); color: var(--good-ink)"
            >
              <BaseIcon name="check" />
            </div>
            <div class="kpi-label">
              {{ t("pcBuild.kpi.fullyCovered.label") }}
            </div>
            <div class="kpi-val mono">
              {{ fmtNum(kpis?.fullyCovered ?? 0) }}
            </div>
            <div class="kpi-sub">{{ t("pcBuild.kpi.fullyCovered.sub") }}</div>
          </div>
          <div class="kpi">
            <div
              class="kpi-icon"
              style="background: var(--good-soft); color: var(--good-ink)"
            >
              <BaseIcon name="coins" />
            </div>
            <div class="kpi-label">{{ t("lotCard.viab.good") }}</div>
            <div class="kpi-val mono">{{ fmtNum(kpis?.profitable ?? 0) }}</div>
            <div class="kpi-sub">{{ t("pcBuild.kpi.profitable.sub") }}</div>
          </div>
          <div class="kpi">
            <div
              class="kpi-icon"
              style="background: var(--warn-soft); color: var(--warn-ink)"
            >
              <BaseIcon name="scale" />
            </div>
            <div class="kpi-label">{{ t("pcBuild.kpi.avgMargin.label") }}</div>
            <div class="kpi-val mono">
              {{
                kpis?.avgMarginPct != null
                  ? kpis.avgMarginPct.toFixed(0) + "%"
                  : "—"
              }}
            </div>
            <div class="kpi-sub">{{ t("pcBuild.kpi.avgMargin.sub") }}</div>
          </div>
        </div>

        <div v-if="error" class="import-note err" style="margin-top: 14px">
          <BaseIcon name="alert" />{{ error }}
        </div>

        <div
          v-else-if="loading && shown === 0"
          class="panel"
          style="
            margin-top: 14px;
            padding: 40px;
            text-align: center;
            color: var(--ink-3);
          "
        >
          {{ t("common.loading") }}
        </div>

        <div v-else-if="shown === 0" style="margin-top: 14px">
          <EmptyState
            icon="cpu"
            :title="t('pcBuild.empty.title')"
            :description="t('pcBuild.empty.desc')"
          />
        </div>

        <!-- ===== jadval (dizayn: sb-table) ===== -->
        <div v-else class="sb-table-wrap" style="margin-top: 14px">
          <div class="sb-th">
            <span class="sb-th-img" />
            <span class="sb-th-lot">{{ t("lots.col.lot") }}</span>
            <span class="sb-th-qty">{{ t("common.quantity") }}</span>
            <span class="sb-th-price">{{ t("pcBuild.col.price") }}</span>
            <span class="sb-th-cost">{{ t("pcBuild.col.costPerUnit") }}</span>
            <span class="sb-th-end">{{ t("lots.col.deadline") }}</span>
            <span class="sb-th-match">{{ t("lots.col.match") }}</span>
            <span class="sb-th-go" />
          </div>
          <button
            v-for="s in items"
            :key="s.lotId"
            type="button"
            class="sb-row"
            @click="openLot(s.lotId)"
          >
            <span class="sb-row-img">
              <img
                v-if="!failedImg.has(s.lotId)"
                :src="api.lotImageUrl(s.lotId, 'average')"
                alt=""
                loading="lazy"
                @error="failedImg.add(s.lotId)"
              />
            </span>
            <span class="sb-row-lot">
              <span class="sb-row-title">{{ s.title }}</span>
              <span class="sb-row-meta">
                <span class="sb-row-no mono">№{{ s.buyerLotId }}</span>
                <span class="sb-row-cust">
                  <BaseIcon name="building" />{{ s.customerName || "—" }}
                </span>
              </span>
            </span>
            <span class="sb-row-qty"
              ><b class="num">{{ fmtNum(s.quantity) }}</b
              ><i>{{ t("common.count") }}</i></span
            >
            <span class="sb-row-price"
              ><b class="mono">{{ compactSom(s.lotPriceUzs) }}</b
              ><i>{{ t("currency.som") }}</i></span
            >
            <span class="sb-row-cost"
              ><b class="mono">{{ fmtSom(s.unitCostUzs) }}</b
              ><i>{{ t("currency.som") }}</i></span
            >
            <span class="sb-row-end">
              <b :class="['sb-end-t', { urgent: endInfo(s).urgent }]">{{
                endInfo(s).text
              }}</b>
              <span
                :class="['sb-end-chip', endInfo(s).open ? 'open' : 'closed']"
              >
                {{ endInfo(s).open ? t("status.open") : t("status.closed") }}
              </span>
            </span>
            <span class="sb-row-match">
              <span class="sb-pct" :style="pillStyle(s.accuracyPct ?? 0)"
                >{{ s.accuracyPct ?? 0 }}%</span
              >
              <span class="sb-stat" :class="rowStatus(s).cls">
                <BaseIcon :name="rowStatus(s).icon" />{{ rowStatus(s).label }}
              </span>
            </span>
            <span class="sb-row-go"><BaseIcon name="arrowRight" /></span>
          </button>
        </div>

        <div v-if="shown > 0" class="products-foot">
          <span class="foot-count"
            >{{ fmtNum(shown) }} / {{ fmtNum(total) }}</span
          >
          <button
            v-if="hasMore"
            class="btn btn-ghost"
            :disabled="loading"
            @click="loadMore"
          >
            {{ loading ? t("common.loading") : t("pcBuild.loadMore") }}
          </button>
        </div>
      </div>
    </div>

    <!-- ===== overlay: lot konfiguratsiyasi (panel yoki modal) ===== -->
    <template v-if="selectedLotId">
      <div
        class="sb-overlay"
        :class="['sb-mode-' + mode, { closing }]"
        @click="closeDrawer"
      >
        <div class="sb-panel" :class="'sb-panel-' + mode" @click.stop>
          <div class="sb-panel-head">
            <div class="sb-ph-tx">
              <div class="sb-ph-ey">{{ t("pcBuild.panel.eyebrow") }}</div>
              <div class="sb-ph-title">
                {{ detail?.lot.title ?? t("common.loading") }}
              </div>
            </div>
            <button
              class="sb-ph-close"
              :aria-label="t('common.close')"
              @click="closeDrawer"
            >
              <BaseIcon name="x" />
            </button>
          </div>

          <div class="sb-panel-body scroll">
            <div
              v-if="detailLoading"
              style="padding: 40px; text-align: center; color: var(--ink-3)"
            >
              {{ t("common.loading") }}
            </div>

            <div v-else-if="detail" class="sb-cfg-layout">
              <div class="sb-cfg-main">
                <!-- lot sarlavhasi -->
                <div class="sb-lot">
                  <div v-if="isDrawerImageVisible" class="sb-lot-img">
                    <img
                      :src="api.lotImageUrl(detail.lot.id)"
                      :alt="detail.lot.title"
                      loading="lazy"
                      @error="isDrawerImageVisible = false"
                    />
                  </div>
                  <div class="sb-lot-body">
                    <div class="d-eyebrow">
                      <span
                        v-if="detail.lot.categoryName"
                        class="chip accent"
                        >{{ detail.lot.categoryName }}</span
                      >
                      <span class="d-lotno">№{{ detail.lot.buyerLotId }}</span>
                    </div>
                    <h2 class="sb-lot-title">{{ detail.lot.title }}</h2>
                    <div class="d-cust">
                      <BaseIcon
                        name="building"
                        style="width: 15px; height: 15px; opacity: 0.7"
                      />{{ detail.lot.customerName || "—" }}
                      <a
                        class="uzex-link"
                        :href="`https://xarid.uzex.uz/shop/lot-details/${detail.lot.buyerLotId}`"
                        target="_blank"
                        rel="noopener"
                      >
                        <BaseIcon name="external" />{{ t("common.openInUzex") }}
                      </a>
                    </div>
                    <div class="sb-lot-meta">
                      <div class="sb-mm">
                        <span class="sb-mm-l">{{ t("common.quantity") }}</span>
                        <span class="sb-mm-v num"
                          >{{ fmtNum(detail.lot.quantity ?? drawerQty) }}
                          <i>{{
                            detail.lot.unit || t("common.count")
                          }}</i></span
                        >
                      </div>
                      <div class="sb-mm">
                        <span class="sb-mm-l">{{ t("common.maxPrice") }}</span>
                        <span class="sb-mm-v mono"
                          >{{ compactSom(lotPrice) }}
                          <i>{{ t("currency.som") }}</i></span
                        >
                      </div>
                      <div class="sb-mm">
                        <span class="sb-mm-l">{{
                          t("pcBuild.unitPrice.label")
                        }}</span>
                        <span class="sb-mm-v mono"
                          >{{ fmtSom(maxUnit) }}
                          <i>{{ t("currency.som") }}</i></span
                        >
                      </div>
                      <div class="sb-mm">
                        <span class="sb-mm-l">{{
                          t("lots.col.deadline")
                        }}</span>
                        <span class="sb-mm-v">{{
                          deadlineText(detail.lot.tenderEndDate)
                        }}</span>
                      </div>
                    </div>
                  </div>
                  <MatchRing :value="drawerAccuracy" :size="56" />
                </div>

                <!-- lot talablari -->
                <div class="sb-section">
                  <div class="sb-section-head">
                    <div
                      class="sh-icon"
                      style="background: var(--surface-3); color: var(--ink-2)"
                    >
                      <BaseIcon name="flag" />
                    </div>
                    <h2>{{ t("pcBuild.requirements.title") }}</h2>
                    <span class="sh-sub">{{
                      t("pcBuild.requirements.subtitle")
                    }}</span>
                  </div>
                  <div class="sb-req-grid">
                    <div
                      v-for="(it, i) in buildItems"
                      :key="'req' + i"
                      class="sb-req"
                      :class="{ opt: !it.needed }"
                    >
                      <div class="sb-req-ic">
                        <BaseIcon :name="compIcon(it.componentType)" />
                      </div>
                      <div class="sb-req-tx">
                        <div class="sb-req-cat">
                          {{ compLabel(it.componentType)
                          }}<span v-if="!it.needed" class="sb-opt-tag">{{
                            t("common.optional")
                          }}</span>
                        </div>
                        <div class="sb-req-val">{{ reqText(it) }}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- komponentlar — moslik tahlili -->
                <div class="sb-section">
                  <div class="sb-section-head">
                    <div
                      class="sh-icon"
                      style="
                        background: var(--accent-soft);
                        color: var(--accent-ink);
                      "
                    >
                      <BaseIcon name="cpu" />
                    </div>
                    <h2>{{ t("pcBuild.components.title") }}</h2>
                    <span class="sh-sub">{{
                      t("pcBuild.components.subtitle")
                    }}</span>
                  </div>
                  <div class="sb-comp-list">
                    <div
                      v-for="(it, i) in buildItems"
                      :key="'comp' + i"
                      class="sb-comp"
                      :class="compCardClass(it)"
                    >
                      <div class="sb-comp-head">
                        <div class="sb-ci">
                          <BaseIcon :name="compIcon(it.componentType)" />
                        </div>
                        <div class="sb-ch-main">
                          <div class="sb-ch-label">
                            {{ compLabel(it.componentType)
                            }}<span v-if="!it.needed" class="sb-opt-tag">{{
                              t("common.optional")
                            }}</span>
                          </div>
                          <div class="sb-ch-req">
                            <span>{{ t("pcBuild.lotRequirement") }}</span>
                            {{ reqText(it) }}
                          </div>
                        </div>
                        <span class="sb-match" :class="compFlag(it).cls">
                          <BaseIcon :name="compFlag(it).icon" />{{
                            compFlag(it).label
                          }}
                        </span>
                      </div>
                      <div
                        v-if="it.needed && it.alternatives.length"
                        class="sb-opts"
                      >
                        <button
                          v-for="(a, ai) in it.alternatives"
                          :key="ai"
                          type="button"
                          class="sb-opt-row"
                          :class="{
                            on: (altSel[i] ?? 0) === ai,
                            'is-bad': altCls(a.accuracyPct) === 'no',
                          }"
                          @click.stop="altSel[i] = ai"
                        >
                          <span class="sb-radio" />
                          <div class="sb-opt-main">
                            <div class="sb-opt-name">{{ a.productName }}</div>
                            <div v-if="a.specNote" class="sb-opt-note">
                              {{ a.specNote }}
                            </div>
                          </div>
                          <div class="sb-opt-side">
                            <div class="sb-opt-price mono">
                              {{
                                a.costUzs
                                  ? fmtSom(a.costUzs) + " " + t("currency.som")
                                  : t("pcBuild.free")
                              }}
                            </div>
                            <div class="sb-opt-stock">
                              {{ a.accuracyPct }}% · {{ a.supplierName }}
                            </div>
                          </div>
                          <span class="sb-mflag" :class="altCls(a.accuracyPct)"
                            ><BaseIcon :name="altIcon(a.accuracyPct)"
                          /></span>
                        </button>
                      </div>
                      <div v-else class="sb-comp-empty">
                        <template v-if="!it.needed">{{
                          t("pcBuild.integrated")
                        }}</template>
                        <template v-else-if="it.productName">{{
                          t("pcBuild.closestMismatch", { name: it.productName })
                        }}</template>
                        <template v-else>{{
                          t("pcBuild.noMatchFound")
                        }}</template>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- xulosa -->
              <aside class="sb-side">
                <div class="sb-sum">
                  <div class="sb-sum-head">
                    <BaseIcon name="tower" />
                    <div>
                      <div class="ssh-t">{{ t("pcBuild.summary.title") }}</div>
                      <div class="ssh-s">
                        {{
                          t("pcBuild.summary.systemUnits", {
                            n: fmtNum(drawerQty),
                          })
                        }}
                      </div>
                    </div>
                  </div>
                  <div class="sb-compat" :class="compatClass">
                    <BaseIcon :name="compat.icon" />{{ compat.label }}
                  </div>
                  <div class="sb-sum-list">
                    <div
                      v-for="(it, i) in buildItems"
                      :key="'sl' + i"
                      class="sb-sl-row"
                    >
                      <span class="sb-sl-dot" :class="compFlag(it).cls" />
                      <span class="sb-sl-cat">{{
                        compLabel(it.componentType)
                      }}</span>
                      <span class="sb-sl-price mono">{{
                        it.matched && chosenAlt(i, it)
                          ? fmtSom(chosenAlt(i, it)!.costUzs)
                          : "—"
                      }}</span>
                    </div>
                  </div>
                  <div class="sb-sum-cost">
                    <div class="sb-cost-row">
                      <span>{{ t("pcBuild.summary.unitCost") }}</span
                      ><span class="mono"
                        >{{ fmtSom(unitCost) }} {{ t("currency.som") }}</span
                      >
                    </div>
                    <div class="sb-cost-row total">
                      <span>{{
                        t("pcBuild.summary.total", { n: fmtNum(drawerQty) })
                      }}</span
                      ><span class="mono"
                        >{{ fmtSom(drawerTotalCost) }}
                        {{ t("currency.som") }}</span
                      >
                    </div>
                  </div>
                  <div class="sb-meter-wrap">
                    <div class="sb-meter-top">
                      <span>{{ t("pcBuild.summary.usageOfUnitPrice") }}</span
                      ><b :class="{ over: usePctRaw > 100 }"
                        >{{ usePctRaw.toFixed(0) }}%</b
                      >
                    </div>
                    <div class="sb-meter">
                      <span
                        :class="{ hot: usePctRaw > 92 }"
                        :style="{ width: usePctBar + '%' }"
                      />
                    </div>
                    <div class="sb-meter-cap">
                      {{ t("pcBuild.summary.shipLabel") }} {{ fmtSom(maxUnit) }}
                      {{ t("currency.som") }} / {{ t("common.count") }}
                    </div>
                  </div>
                  <div class="sb-viab" :class="viability.cls">
                    <div class="sb-viab-ic">
                      <BaseIcon :name="viability.icon" />
                    </div>
                    <div class="sb-viab-tx">
                      <div class="sb-viab-t">{{ viability.label }}</div>
                      <div class="sb-viab-s">
                        {{ t("pricing.netProfitLabel") }}
                        <b class="mono"
                          >{{ net >= 0 ? "+" : "−" }}{{ fmtSom(Math.abs(net)) }}
                          {{ t("currency.som") }}</b
                        >
                        ({{ netPct.toFixed(1) }}%)
                      </div>
                    </div>
                  </div>
                  <div class="sb-cfg-btns">
                    <button class="btn btn-ghost" @click="resetPicks">
                      <BaseIcon name="refresh" /> {{ t("common.reset") }}
                    </button>
                    <button class="btn btn-accept sb-cta" @click="savePicks">
                      <BaseIcon name="check" /> {{ t("common.save") }}
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.pc-page {
  position: relative;
}

/* ---- topbar: ochilish uslubi toggle ---- */
.sb-mode {
  display: flex;
  gap: 2px;
  background: var(--surface-3);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 3px;
}
.sb-mode button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink-3);
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px 11px;
  border-radius: 6px;
  transition: color 0.12s;
}
.sb-mode button svg {
  width: 14px;
  height: 14px;
}
.sb-mode button.on {
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-sm);
}
.sb-mode button:hover:not(.on) {
  color: var(--ink);
}

/* ---- topbar: kurs + filtr ---- */
.rate-box {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 13px;
  background: var(--surface);
}
.rate-lab {
  color: var(--ink-3);
}
.rate-input {
  width: 72px;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 3px 6px;
  font: inherit;
  text-align: right;
}
.rate-save {
  border: none;
  background: var(--accent-soft);
  color: var(--accent-ink);
  border-radius: 6px;
  padding: 4px 9px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.rate-save:disabled {
  opacity: 0.5;
  cursor: default;
}
.rate-src {
  color: var(--ink-4);
  font-size: 12px;
}
.rate-reset {
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--ink-3);
  display: inline-flex;
}
.rate-reset svg {
  width: 14px;
  height: 14px;
}
.on-toggle {
  background: var(--accent-soft);
  color: var(--accent-ink);
}

/* ---- jadval ---- */
.sb-table-wrap {
  max-width: 1240px;
  margin: 14px auto 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}
.sb-th,
.sb-row {
  display: grid;
  align-items: center;
  grid-template-columns: 64px minmax(0, 1fr) 90px 116px 130px 108px 188px 34px;
  gap: 16px;
  padding: 0 18px;
}
.sb-th {
  height: 42px;
  background: var(--surface-2);
  border-bottom: 1px solid var(--border);
}
.sb-th > span {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-4);
}
.sb-th-qty,
.sb-th-price,
.sb-th-cost {
  text-align: right;
}
.sb-row {
  min-height: 84px;
  width: 100%;
  border: none;
  border-top: 1px solid var(--border);
  background: var(--surface);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s;
}
.sb-row:first-of-type {
  border-top: none;
}
.sb-row:hover {
  background: var(--surface-2);
}
.sb-row-img {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--surface-3);
}
.sb-row-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.sb-row-lot {
  min-width: 0;
}
.sb-row-title {
  display: -webkit-box;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.sb-row-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}
.sb-row-no {
  font-size: 11px;
  color: var(--ink-4);
  flex-shrink: 0;
}
.sb-row-cust {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--ink-3);
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.sb-row-cust svg {
  width: 13px;
  height: 13px;
  opacity: 0.6;
  flex-shrink: 0;
}
.sb-row-qty,
.sb-row-price,
.sb-row-cost {
  text-align: right;
}
.sb-row-qty b,
.sb-row-price b,
.sb-row-cost b {
  display: block;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.sb-row-qty i,
.sb-row-price i,
.sb-row-cost i {
  font-style: normal;
  font-size: 10.5px;
  color: var(--ink-4);
}
.sb-row-end {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
}
.sb-end-t {
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.sb-end-t.urgent {
  color: var(--warn-ink);
}
.sb-end-chip {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 1.5px 7px;
  border-radius: 99px;
  border: 1px solid;
}
.sb-end-chip.open {
  color: var(--good-ink);
  background: var(--good-soft);
  border-color: var(--good-line);
}
.sb-end-chip.closed {
  color: var(--ink-4);
  background: var(--surface-3);
  border-color: var(--border);
}
.sb-row-match {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
}
.sb-pct {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.01em;
  padding: 2px 9px;
  border-radius: 99px;
  border: 1px solid;
  font-variant-numeric: tabular-nums;
}
.sb-stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
}
.sb-stat svg {
  width: 12px;
  height: 12px;
}
.sb-stat.ok {
  color: var(--good-ink);
}
.sb-stat.part {
  color: var(--warn-ink);
}
.sb-stat.no {
  color: var(--bad-ink);
}
.sb-row-go {
  display: grid;
  place-items: center;
  color: var(--ink-4);
  transition:
    transform 0.14s,
    color 0.12s;
}
.sb-row-go svg {
  width: 18px;
  height: 18px;
}
.sb-row:hover .sb-row-go {
  color: var(--accent);
  transform: translateX(3px);
}

.products-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 14px auto 0;
  max-width: 1240px;
  padding: 4px 2px;
}
.foot-count {
  font-size: 13px;
  color: var(--ink-4);
}

/* ---- overlay + panel ---- */
.sb-overlay {
  position: absolute;
  inset: 0;
  z-index: 60;
  background: rgb(16 16 20 / 0.42);
  backdrop-filter: blur(2px);
  animation: sb-scrim-in 0.18s ease;
}
.sb-overlay.sb-mode-modal {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 34px;
}
.sb-overlay.closing {
  animation: sb-scrim-out 0.2s ease forwards;
}
.sb-panel {
  background: var(--bg);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.sb-panel-drawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(940px, 94%);
  border-left: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  animation: sb-drawer-in 0.24s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.sb-overlay.closing .sb-panel-drawer {
  animation: sb-drawer-out 0.22s ease forwards;
}
.sb-panel-modal {
  width: min(1100px, 100%);
  max-height: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  animation: sb-modal-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.sb-overlay.closing .sb-panel-modal {
  animation: sb-scrim-out 0.18s ease forwards;
}
.sb-panel-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 15px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.sb-ph-tx {
  flex: 1;
  min-width: 0;
}
.sb-ph-ey {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--accent-ink);
}
.sb-ph-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sb-ph-close {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--surface);
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--ink-2);
  transition: background 0.12s;
}
.sb-ph-close:hover {
  background: var(--surface-3);
}
.sb-ph-close svg {
  width: 18px;
  height: 18px;
}
.sb-panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

@keyframes sb-scrim-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes sb-scrim-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
@keyframes sb-drawer-in {
  from {
    transform: translateX(40px);
    opacity: 0.5;
  }
  to {
    transform: none;
    opacity: 1;
  }
}
@keyframes sb-drawer-out {
  from {
    transform: none;
    opacity: 1;
  }
  to {
    transform: translateX(40px);
    opacity: 0;
  }
}
@keyframes sb-modal-in {
  from {
    transform: scale(0.98);
    opacity: 0.5;
  }
  to {
    transform: none;
    opacity: 1;
  }
}

/* ---- konfigurator layout ---- */
.sb-cfg-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 22px;
  align-items: start;
  padding: 22px 22px 48px;
}
.sb-cfg-main {
  min-width: 0;
}

/* ---- lot sarlavhasi ---- */
.sb-lot {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  padding: 18px;
  box-shadow: var(--shadow-sm);
}
.sb-lot-img {
  width: 132px;
  height: 132px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--surface-3);
}
.sb-lot-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.sb-lot-body {
  flex: 1;
  min-width: 0;
}
.sb-lot-title {
  font-size: 21px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  margin: 9px 0 8px;
  text-wrap: pretty;
}
.sb-lot-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 26px;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--border);
}
.sb-mm {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sb-mm-l {
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ink-4);
}
.sb-mm-v {
  font-size: 15.5px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.sb-mm-v i {
  font-style: normal;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ink-3);
}
.d-eyebrow {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}
/* uzun kategoriya nomi MatchRing ustiga chiqib ketmasligi uchun matnni o'raymiz */
.d-eyebrow .chip {
  max-width: 100%;
  white-space: normal;
  text-align: left;
  line-height: 1.35;
  border-radius: 8px;
}
/* MatchRing siqilib qolmasin / chip bilan to'qnashmasin */
.sb-lot :deep(.match-ring) {
  flex-shrink: 0;
}
.d-lotno {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--ink-3);
  letter-spacing: -0.01em;
}
.d-cust {
  font-size: 13.5px;
  color: var(--ink-2);
  margin-top: 9px;
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}
.uzex-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-ink);
  text-decoration: none;
}
.uzex-link svg {
  width: 13px;
  height: 13px;
}

/* ---- section ---- */
.sb-section {
  margin-top: 26px;
}
.sb-section-head {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 13px;
}
.sb-section-head .sh-icon {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.sb-section-head .sh-icon svg {
  width: 15px;
  height: 15px;
}
.sb-section-head h2 {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  white-space: nowrap;
}
.sb-section-head .sh-sub {
  font-size: 12px;
  color: var(--ink-4);
  margin-left: auto;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

/* ---- talablar grid ---- */
.sb-req-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(232px, 1fr));
  gap: 10px;
}
.sb-req {
  display: flex;
  gap: 11px;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  padding: 11px 13px;
}
.sb-req.opt {
  background: var(--surface-2);
  border-style: dashed;
}
.sb-req-ic {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 9px;
  background: var(--surface-3);
  border: 1px solid var(--border);
  display: grid;
  place-items: center;
  color: var(--ink-2);
}
.sb-req-ic svg {
  width: 17px;
  height: 17px;
}
.sb-req-tx {
  min-width: 0;
}
.sb-req-cat {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--ink-4);
  display: flex;
  align-items: center;
  gap: 6px;
}
.sb-req-val {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink);
  margin-top: 2px;
  text-wrap: pretty;
}
.sb-opt-tag {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--ink-4);
  background: var(--surface-3);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 0 5px;
}

/* ---- komponent kartalari ---- */
.sb-comp-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sb-comp {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  overflow: hidden;
}
.sb-comp.warn {
  border-color: var(--warn-line);
}
.sb-comp.bad {
  border-color: var(--bad-line);
}
.sb-comp-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 15px;
  border-bottom: 1px solid var(--border);
}
.sb-ci {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent-ink);
  display: grid;
  place-items: center;
}
.sb-ci svg {
  width: 19px;
  height: 19px;
}
.sb-ch-main {
  flex: 1;
  min-width: 0;
}
.sb-ch-label {
  font-size: 14.5px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sb-ch-req {
  font-size: 12px;
  color: var(--ink-3);
  margin-top: 2px;
}
.sb-ch-req span {
  color: var(--ink-4);
  font-weight: 600;
}
.sb-match {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 99px;
  white-space: nowrap;
  flex-shrink: 0;
}
.sb-match svg {
  width: 13px;
  height: 13px;
}
.sb-match.ok {
  background: var(--good-soft);
  color: var(--good-ink);
  border: 1px solid var(--good-line);
}
.sb-match.part {
  background: var(--warn-soft);
  color: var(--warn-ink);
  border: 1px solid var(--warn-line);
}
.sb-match.no {
  background: var(--bad-soft);
  color: var(--bad-ink);
  border: 1px solid var(--bad-line);
}

/* ---- variant qatorlari ---- */
.sb-opts {
  display: flex;
  flex-direction: column;
}
.sb-opt-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  background: var(--surface);
  border: none;
  border-top: 1px solid var(--border);
  padding: 11px 15px;
  cursor: pointer;
  font: inherit;
  transition: background 0.12s;
}
.sb-opt-row:first-child {
  border-top: none;
}
.sb-opt-row:hover {
  background: var(--surface-2);
}
.sb-opt-row.on {
  background: var(--accent-soft);
}
.sb-opt-row.is-bad .sb-opt-name {
  color: var(--ink-3);
}
.sb-radio {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  border-radius: 99px;
  border: 2px solid var(--border-2);
  background: var(--surface);
  position: relative;
  transition: border-color 0.12s;
}
.sb-opt-row.on .sb-radio {
  border-color: var(--accent);
}
.sb-opt-row.on .sb-radio::after {
  content: "";
  position: absolute;
  inset: 3px;
  border-radius: 99px;
  background: var(--accent);
}
.sb-opt-main {
  flex: 1;
  min-width: 0;
}
.sb-opt-name {
  font-size: 13.5px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.sb-opt-note {
  font-size: 12px;
  color: var(--ink-3);
  margin-top: 2px;
}
.sb-opt-side {
  text-align: right;
  flex-shrink: 0;
}
.sb-opt-price {
  font-size: 13.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.sb-opt-stock {
  font-size: 11px;
  color: var(--ink-4);
  margin-top: 1px;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sb-mflag {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 7px;
  display: grid;
  place-items: center;
}
.sb-mflag svg {
  width: 14px;
  height: 14px;
}
.sb-mflag.ok {
  background: var(--good-soft);
  color: var(--good-ink);
}
.sb-mflag.part {
  background: var(--warn-soft);
  color: var(--warn-ink);
}
.sb-mflag.no {
  background: var(--bad-soft);
  color: var(--bad-ink);
}
.sb-comp-empty {
  padding: 13px 15px;
  font-size: 13px;
  color: var(--ink-4);
}

/* ---- xulosa paneli ---- */
.sb-side {
  position: sticky;
  top: 22px;
}
.sb-sum {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  padding: 16px;
  box-shadow: var(--shadow-sm);
}
.sb-sum-head {
  display: flex;
  align-items: center;
  gap: 11px;
}
.sb-sum-head > svg {
  width: 22px;
  height: 22px;
  color: var(--accent);
  flex-shrink: 0;
}
.ssh-t {
  font-size: 14px;
  font-weight: 700;
}
.ssh-s {
  font-size: 12px;
  color: var(--ink-3);
  margin-top: 1px;
}
.sb-compat {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  font-weight: 700;
  padding: 8px 11px;
  border-radius: var(--radius-sm);
  margin-top: 13px;
}
.sb-compat svg {
  width: 15px;
  height: 15px;
}
.sb-compat.ok {
  background: var(--good-soft);
  color: var(--good-ink);
}
.sb-compat.warn {
  background: var(--warn-soft);
  color: var(--warn-ink);
}
.sb-compat.bad {
  background: var(--bad-soft);
  color: var(--bad-ink);
}
.sb-sum-list {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.sb-sl-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 5px 0;
}
.sb-sl-dot {
  width: 8px;
  height: 8px;
  border-radius: 99px;
  flex-shrink: 0;
}
.sb-sl-dot.ok {
  background: var(--good);
}
.sb-sl-dot.part {
  background: var(--warn);
}
.sb-sl-dot.no {
  background: var(--bad);
}
.sb-sl-cat {
  font-size: 12.5px;
  color: var(--ink-2);
  font-weight: 500;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sb-sl-price {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink);
  flex-shrink: 0;
}
.sb-sum-cost {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
.sb-cost-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 13px;
  color: var(--ink-2);
  font-weight: 600;
}
.sb-cost-row + .sb-cost-row {
  margin-top: 7px;
}
.sb-cost-row.total {
  font-size: 15.5px;
  font-weight: 700;
  color: var(--ink);
}
.sb-cost-row.total span:last-child {
  color: var(--accent-ink);
}
.sb-meter-wrap {
  margin-top: 15px;
}
.sb-meter-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ink-3);
}
.sb-meter-top b {
  font-size: 13px;
  color: var(--ink);
}
.sb-meter-top b.over {
  color: var(--bad-ink);
}
.sb-meter {
  height: 7px;
  border-radius: 99px;
  background: var(--surface-3);
  overflow: hidden;
  margin: 6px 0 5px;
}
.sb-meter > span {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: var(--accent);
  transition: width 0.35s ease;
}
.sb-meter > span.hot {
  background: var(--warn);
}
.sb-meter-cap {
  font-size: 11px;
  color: var(--ink-4);
}
.sb-viab {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 11px 12px;
  border-radius: var(--radius-sm);
  margin-top: 15px;
  border: 1px solid;
}
.sb-viab.good {
  background: var(--good-soft);
  border-color: var(--good-line);
}
.sb-viab.edge {
  background: var(--warn-soft);
  border-color: var(--warn-line);
}
.sb-viab.bad {
  background: var(--bad-soft);
  border-color: var(--bad-line);
}
.sb-viab-ic {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 8px;
  display: grid;
  place-items: center;
}
.sb-viab-ic svg {
  width: 16px;
  height: 16px;
}
.sb-viab.good .sb-viab-ic {
  background: var(--good);
  color: #fff;
}
.sb-viab.edge .sb-viab-ic {
  background: var(--warn);
  color: #fff;
}
.sb-viab.bad .sb-viab-ic {
  background: var(--bad);
  color: #fff;
}
.sb-viab-t {
  font-size: 13.5px;
  font-weight: 700;
}
.sb-viab.good .sb-viab-t {
  color: var(--good-ink);
}
.sb-viab.edge .sb-viab-t {
  color: var(--warn-ink);
}
.sb-viab.bad .sb-viab-t {
  color: var(--bad-ink);
}
.sb-viab-s {
  font-size: 11.5px;
  color: var(--ink-2);
  margin-top: 2px;
}
.sb-viab-s b {
  font-weight: 700;
}
.sb-cfg-btns {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}
.sb-cfg-btns .btn {
  flex: 1;
  padding: 10px 14px;
  font-size: 13.5px;
}
.sb-cfg-btns .btn-ghost {
  flex: 0 0 auto;
}

/* ---- responsiv ---- */
@media (max-width: 980px) {
  .sb-cfg-layout {
    grid-template-columns: 1fr;
  }
  .sb-side {
    position: static;
  }
  .sb-th,
  .sb-row {
    grid-template-columns: 56px minmax(0, 1fr) 150px 34px;
  }
  .sb-th-qty,
  .sb-th-price,
  .sb-th-cost,
  .sb-th-end,
  .sb-row-qty,
  .sb-row-price,
  .sb-row-cost,
  .sb-row-end {
    display: none;
  }
}
</style>
