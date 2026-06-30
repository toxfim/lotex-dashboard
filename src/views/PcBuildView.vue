<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "@/lib/api";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import EmptyState from "@/components/shared/EmptyState.vue";
import { compactSom, fmtNum, relativeAgo } from "@/lib/formatters";
import type {
  PcBomItem,
  PcBuildDetail,
  PcBuildKpis,
  PcBuildSummary,
} from "@/types/pc-build";

const PAGE_SIZE = 20;

const items = ref<PcBuildSummary[]>([]);
const kpis = ref<PcBuildKpis | null>(null);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const error = ref<string | null>(null);
const onlyProfitable = ref(false);

// o'ng drawer (lot razbivkasi)
const selectedLotId = ref<string | null>(null);
const detail = ref<PcBuildDetail | null>(null);
const detailLoading = ref(false);
// har komponent (item indeksi) uchun tanlangan variant indeksi (default 0 = arzon)
const altSel = ref<Record<number, number>>({});

// USD→UZS kurs (bank.uz jonli yoki qo'lda override)
const rateState = ref<{
  rate: number;
  source: string;
  overridden: boolean;
} | null>(null);
const rateInput = ref<number | null>(null);
const rateSaving = ref(false);

const COMPONENT_LABEL: Record<string, string> = {
  CPU: "Процессор",
  MOTHERBOARD: "Мат. плата",
  RAM: "Память",
  STORAGE: "Накопитель",
  GPU: "Видеокарта",
  PSU: "Блок питания",
  COOLER: "Охлаждение",
  CASE: "Корпус",
  MONITOR: "Монитор",
  PERIPHERAL: "Периферия",
  OTHER: "Прочее",
};

const COMPONENT_ICON: Record<string, string> = {
  CPU: "cpu",
  GPU: "vector",
  MOTHERBOARD: "layers",
  PSU: "coins",
  MONITOR: "image",
  CASE: "package",
};
const compIcon = (type: string): string => COMPONENT_ICON[type] || "box";

const shown = computed(() => items.value.length);
const hasMore = computed(() => shown.value < total.value);

function marginClass(pct: number | null): string {
  if (pct == null) return "";
  return pct >= 0 ? "pos" : "neg";
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
    error.value = e instanceof Error ? e.message : "Yuklab bo'lmadi";
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
  selectedLotId.value = lotId;
  detail.value = null;
  altSel.value = {};
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
  selectedLotId.value = null;
  detail.value = null;
}

const buildItems = computed(() => detail.value?.build.items ?? []);

/** Komponent uchun tanlangan variant (dropdown). */
function chosenAlt(idx: number, it: PcBomItem) {
  if (!it.needed || it.alternatives.length === 0) return null;
  const i = altSel.value[idx] ?? 0;
  return it.alternatives[i] ?? it.alternatives[0];
}

/** Tanlangan variantlar bo'yicha 1 dona sborka себести. */
const unitCost = computed(() =>
  buildItems.value.reduce((sum, it, i) => sum + (chosenAlt(i, it)?.costUzs ?? 0), 0),
);

const drawerQty = computed(() => detail.value?.build.quantity ?? 1);
const drawerTotalCost = computed(() => unitCost.value * drawerQty.value);
const drawerMarginPct = computed(() => {
  const price = detail.value?.lot.price ?? 0;
  return price > 0 ? ((price - drawerTotalCost.value) / price) * 100 : null;
});
const drawerCoverageFull = computed(() => {
  const cov = detail.value?.build.coverage;
  return !!cov && cov.needed > 0 && cov.matched === cov.needed;
});

function deadlineText(iso: string): string {
  const h = Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000);
  if (h <= 0) return "Yopilgan";
  const d = Math.floor(h / 24);
  return d > 0 ? `${d} kun ${h % 24} soat` : `${h} soat`;
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
  if (rateInput.value == null || rateInput.value <= 0 || rateSaving.value) return;
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
});
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div>
        <h1>Сборка ПК</h1>
        <div class="crumb-sub">
          ПК-лот → запчасти от поставщиков → себестоимость → маржа (eng arzon mos
          qism, КЕШ через ИП ÷0.95)
        </div>
      </div>
      <div class="topbar-right">
        <div class="rate-box" title="USD→UZS kurs (себест hisobi uchun)">
          <span class="rate-lab">1$ =</span>
          <input
            v-model.number="rateInput"
            type="number"
            class="rate-input"
            @keyup.enter="saveRate"
          />
          <span class="rate-lab">so'm</span>
          <button
            class="rate-save"
            :disabled="rateSaving || rateInput === rateState?.rate"
            @click="saveRate"
          >
            Saqlash
          </button>
          <span class="rate-src">{{
            rateState?.overridden ? "qo'lda" : (rateState?.source ?? "…")
          }}</span>
          <button
            v-if="rateState?.overridden"
            class="rate-reset"
            title="Jonli (bank.uz) kursga qaytish"
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
          <BaseIcon name="check" />Faqat foydali
        </button>
      </div>
    </header>

    <div class="page-scroll scroll">
      <div class="page-inner fade-page">
        <!-- KPI -->
        <div class="kpi-grid">
          <div class="kpi">
            <div class="kpi-icon" style="background: var(--accent-soft); color: var(--accent-ink)">
              <BaseIcon name="cpu" />
            </div>
            <div class="kpi-label">ПК-лотлар</div>
            <div class="kpi-val mono">{{ fmtNum(kpis?.totalLots ?? 0) }}</div>
            <div class="kpi-sub">sborka qilinadigan</div>
          </div>
          <div class="kpi">
            <div class="kpi-icon" style="background: var(--good-soft); color: var(--good-ink)">
              <BaseIcon name="check" />
            </div>
            <div class="kpi-label">100% yig'ilgan</div>
            <div class="kpi-val mono">{{ fmtNum(kpis?.fullyCovered ?? 0) }}</div>
            <div class="kpi-sub">barcha qismlar topildi</div>
          </div>
          <div class="kpi">
            <div class="kpi-icon" style="background: var(--good-soft); color: var(--good-ink)">
              <BaseIcon name="coins" />
            </div>
            <div class="kpi-label">Foydali</div>
            <div class="kpi-val mono">{{ fmtNum(kpis?.profitable ?? 0) }}</div>
            <div class="kpi-sub">marja &gt; 0</div>
          </div>
          <div class="kpi">
            <div class="kpi-icon" style="background: var(--warn-soft); color: var(--warn-ink)">
              <BaseIcon name="scale" />
            </div>
            <div class="kpi-label">O'rtacha marja</div>
            <div class="kpi-val mono">
              {{ kpis?.avgMarginPct != null ? kpis.avgMarginPct.toFixed(0) + "%" : "—" }}
            </div>
            <div class="kpi-sub">sof foyda</div>
          </div>
        </div>

        <div v-if="error" class="import-note err" style="margin-top: 14px">
          <BaseIcon name="alert" />{{ error }}
        </div>

        <div
          v-else-if="loading && shown === 0"
          class="panel"
          style="margin-top: 14px; padding: 40px; text-align: center; color: var(--ink-3)"
        >
          Yuklanmoqda…
        </div>

        <div v-else-if="shown === 0" style="margin-top: 14px">
          <EmptyState
            icon="cpu"
            title="PC-lot topilmadi"
            description="Sborka qilinadigan kompyuter lotlari yo'q yoki filtrга mos kelmadi."
          />
        </div>

        <!-- jadval -->
        <div v-else class="dt-wrap" style="margin-top: 14px">
          <table class="dt">
            <thead>
              <tr>
                <th>Лот · спецификация</th>
                <th>Заказчик</th>
                <th class="r">Макс. нарх</th>
                <th class="r">Себест.</th>
                <th class="r">Маржа</th>
                <th class="r">Покрытие</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="s in items"
                :key="s.lotId"
                style="cursor: pointer"
                @click="openLot(s.lotId)"
              >
                <td>
                  <div class="c-title">
                    <BaseIcon name="arrowRight" style="width: 13px; height: 13px" />
                    {{ s.title }}
                  </div>
                  <div class="c-sub">
                    №{{ s.buyerLotId }} · {{ s.quantity }} dona ·
                    {{ relativeAgo(s.createdAt) }}
                  </div>
                </td>
                <td>{{ s.customerName || "—" }}</td>
                <td class="r num">{{ compactSom(s.lotPriceUzs) }}</td>
                <td class="r num">{{ compactSom(s.totalCostUzs) }}</td>
                <td class="r num">
                  <span class="margin-pill" :class="marginClass(s.marginPct)">
                    {{ s.marginPct != null ? s.marginPct.toFixed(0) + "%" : "—" }}
                  </span>
                </td>
                <td class="r">
                  <span
                    class="count-pill"
                    :class="{
                      full:
                        s.coverage.needed > 0 &&
                        s.coverage.matched === s.coverage.needed,
                    }"
                  >
                    {{ s.coverage.matched }}/{{ s.coverage.needed }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="shown > 0" class="products-foot">
          <span class="foot-count">{{ fmtNum(shown) }} / {{ fmtNum(total) }}</span>
          <button v-if="hasMore" class="btn btn-ghost" :disabled="loading" @click="loadMore">
            {{ loading ? "Yuklanmoqda…" : "Yana yuklash" }}
          </button>
        </div>
      </div>
    </div>

    <!-- ===== O'ng drawer: lot sborkasi ===== -->
    <template v-if="selectedLotId">
      <div class="modal-scrim" @click="closeDrawer">
        <div class="modal wide" @click.stop>
          <div class="modal-top">
            <span class="mt-eyebrow">Сборка ПК · komponentlar</span>
            <button class="icon-btn modal-x" @click="closeDrawer">
              <BaseIcon name="x" />
            </button>
          </div>

          <div
            v-if="detailLoading"
            class="modal-body scroll"
            style="padding: 40px; text-align: center; color: var(--ink-3)"
          >
            Yuklanmoqda…
          </div>

          <div v-else-if="detail" class="modal-body scroll">
            <div class="dh-name" style="font-size: 18px">
              {{ detail.lot.title }}
            </div>
            <div class="dh-sub">
              №{{ detail.lot.buyerLotId }} · {{ detail.lot.customerName || "—" }}
              <a
                class="uzex-link"
                :href="`https://xarid.uzex.uz/shop/lot-details/${detail.lot.buyerLotId}`"
                target="_blank"
                rel="noopener"
              >
                <BaseIcon name="external" />Uzex'da ochish
              </a>
            </div>

            <!-- kartalar -->
            <div class="pcd-cards">
              <div class="pcd-card">
                <div class="pcd-lab">Miqdor</div>
                <div class="pcd-val">{{ fmtNum(detail.lot.quantity ?? 1) }}</div>
                <div class="pcd-sub">{{ detail.lot.unit || "dona" }}</div>
              </div>
              <div class="pcd-card">
                <div class="pcd-lab">Maksimal narx</div>
                <div class="pcd-val">{{ compactSom(detail.lot.price) }}</div>
                <div class="pcd-sub">so'm</div>
              </div>
              <div class="pcd-card">
                <div class="pcd-lab">Muddat tugashiga</div>
                <div class="pcd-val">{{ deadlineText(detail.lot.tenderEndDate) }}</div>
                <div class="pcd-sub">qoldi</div>
              </div>
            </div>

            <!-- summary -->
            <div class="pcd-summary">
              <div>
                <div class="pcd-lab">Yig'iladigan kompyuter</div>
                <div class="pcd-sval">{{ fmtNum(drawerQty) }} dona</div>
              </div>
              <div>
                <div class="pcd-lab">1 dona tannarxi</div>
                <div class="pcd-sval">{{ compactSom(unitCost) }} so'm</div>
              </div>
              <div>
                <div class="pcd-lab">Konfiguratsiya</div>
                <div
                  class="pcd-sval"
                  :class="drawerCoverageFull ? 'cfg-ok' : 'cfg-part'"
                >
                  {{
                    drawerCoverageFull
                      ? "To'liq mos"
                      : detail.build.coverage.matched +
                        "/" +
                        detail.build.coverage.needed
                  }}
                </div>
              </div>
            </div>

            <!-- komponentlar -->
            <div v-for="(it, i) in buildItems" :key="i" class="pcd-comp">
              <div class="pcd-cic"><BaseIcon :name="compIcon(it.componentType)" /></div>
              <div class="pcd-cmain">
                <div class="pcd-cname">
                  {{ COMPONENT_LABEL[it.componentType] || it.componentType }}
                  <span v-if="!it.needed" class="fg-badge opt">ixtiyoriy</span>
                  <span class="pcd-req">talab: {{ it.requirement }}</span>
                </div>
                <select
                  v-if="it.needed && it.alternatives.length"
                  v-model.number="altSel[i]"
                  class="pcd-select"
                  @click.stop
                >
                  <option v-for="(a, ai) in it.alternatives" :key="ai" :value="ai">
                    {{ a.productName }} · {{ compactSom(a.costUzs) }} so'm
                  </option>
                </select>
                <div v-else class="pcd-nomatch">
                  {{
                    it.needed
                      ? "— mos qism topilmadi —"
                      : "Integratsiyalangan (sotib olish shart emas)"
                  }}
                </div>
                <div v-if="chosenAlt(i, it)" class="pcd-cnote">
                  {{ chosenAlt(i, it)?.specNote }} ·
                  {{ chosenAlt(i, it)?.supplierName }}
                </div>
              </div>
              <div class="pcd-cright">
                <div class="pcd-cprice">
                  {{
                    chosenAlt(i, it)
                      ? compactSom(chosenAlt(i, it)?.costUzs ?? 0)
                      : it.needed
                        ? "—"
                        : "0"
                  }}
                </div>
                <span class="pcd-check" :class="{ on: it.matched }">
                  <BaseIcon name="check" />
                </span>
              </div>
            </div>
          </div>

          <div class="drawer-foot">
            <div class="pcd-foot-cost">
              Jami себест: <b>{{ compactSom(drawerTotalCost) }}</b> so'm ·
              marja
              <span class="margin-pill" :class="marginClass(drawerMarginPct)">
                {{ drawerMarginPct != null ? drawerMarginPct.toFixed(0) + "%" : "—" }}
              </span>
            </div>
            <div class="sidebar-spacer" />
            <button class="btn btn-ghost" @click="closeDrawer">Yopish</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.margin-pill {
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
}
.margin-pill.pos {
  background: var(--good-soft, #e7f6ec);
  color: var(--good-ink, #137333);
}
.margin-pill.neg {
  background: var(--bad-soft, #fde8e8);
  color: var(--bad-ink, #c5221f);
}
.count-pill.full {
  background: var(--good-soft, #e7f6ec);
  color: var(--good-ink, #137333);
}
/* ---- o'ng drawer (sborka) ---- */
.pcd-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 16px 0;
}
.pcd-card {
  border: 1px solid var(--line, #e6e8eb);
  border-radius: 10px;
  padding: 12px;
}
.pcd-lab {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ink-4, #9aa1a9);
}
.pcd-val {
  font-size: 19px;
  font-weight: 700;
  margin-top: 4px;
}
.pcd-sub {
  font-size: 11px;
  color: var(--ink-4, #9aa1a9);
}
.pcd-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--line, #e6e8eb);
  border-radius: 10px;
  margin-bottom: 14px;
  background: var(--surface-2, #f7f8fa);
}
.pcd-sval {
  font-size: 15px;
  font-weight: 700;
  margin-top: 3px;
}
.cfg-ok {
  color: var(--good-ink, #137333);
}
.cfg-part {
  color: var(--warn-ink, #92660a);
}
.pcd-comp {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--line, #e6e8eb);
}
.pcd-cic {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: var(--accent-soft, #e8f0fe);
  color: var(--accent-ink, #1a56db);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}
.pcd-cic :deep(svg) {
  width: 17px;
  height: 17px;
}
.pcd-cmain {
  flex: 1;
  min-width: 0;
}
.pcd-cname {
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}
.pcd-req {
  font-weight: 400;
  font-size: 12px;
  color: var(--ink-4, #9aa1a9);
}
.pcd-select {
  margin-top: 7px;
  width: 100%;
  border: 1px solid var(--line, #e6e8eb);
  border-radius: 8px;
  padding: 7px 9px;
  font: inherit;
  font-size: 13px;
  background: var(--surface, #fff);
}
.pcd-nomatch {
  margin-top: 7px;
  font-size: 13px;
  color: var(--ink-4, #9aa1a9);
}
.pcd-cnote {
  margin-top: 5px;
  font-size: 12px;
  color: var(--ink-3, #6b7280);
}
.pcd-cright {
  text-align: right;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
}
.pcd-cprice {
  font-weight: 700;
  font-size: 14px;
}
.pcd-check {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2, #eef0f2);
  color: var(--ink-4, #9aa1a9);
}
.pcd-check.on {
  background: var(--good-soft, #e7f6ec);
  color: var(--good-ink, #137333);
}
.pcd-check :deep(svg) {
  width: 13px;
  height: 13px;
}
.pcd-foot-cost {
  font-size: 13px;
  color: var(--ink-2, #374151);
}
.uzex-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-ink, #1a56db);
  text-decoration: none;
}
.uzex-link :deep(svg) {
  width: 13px;
  height: 13px;
}
.on-toggle {
  background: var(--accent-soft, #e8f0fe);
  color: var(--accent-ink, #1a56db);
}
.rate-box {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid var(--line, #e6e8eb);
  border-radius: 10px;
  font-size: 13px;
  background: var(--surface, #fff);
}
.rate-lab {
  color: var(--ink-3, #6b7280);
}
.rate-input {
  width: 72px;
  border: 1px solid var(--line, #e6e8eb);
  border-radius: 6px;
  padding: 3px 6px;
  font: inherit;
  text-align: right;
}
.rate-save {
  border: none;
  background: var(--accent-soft, #e8f0fe);
  color: var(--accent-ink, #1a56db);
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
  color: var(--ink-4, #9aa1a9);
  font-size: 12px;
}
.rate-reset {
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--ink-3, #6b7280);
  display: inline-flex;
}
.rate-reset :deep(svg) {
  width: 14px;
  height: 14px;
}
.products-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  padding: 4px 2px;
}
.foot-count {
  font-size: 13px;
  color: var(--ink-4, #9aa1a9);
}
.c-title {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
