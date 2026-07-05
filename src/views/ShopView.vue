<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useShopStore } from "@/stores/shop";
import { useI18n } from "@/composables/useI18n";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import TopbarSettings from "@/components/layout/TopbarSettings.vue";
import { fmtSom } from "@/lib/formatters";
import { api } from "@/lib/api";
import type {
  CredentialOffers,
  OfferStatusMenuItem,
  ProviderOffer,
  ShopOfferDetailResponse,
} from "@/types/shop";

const router = useRouter();
const shopStore = useShopStore();
const { t } = useI18n();

// Birlashtirilgan ro'yxat — uzex e'lonlari (= bizning katalog). Status bo'yicha bo'limlar.
const statusMenu = ref<OfferStatusMenuItem[]>([]);
const activeStatus = ref<number>(5); // 5 = Опубликован
const credOffers = ref<CredentialOffers[]>([]);
const loadingOffers = ref(false);
const offersError = ref<string | null>(null);

const offersTotal = computed(() =>
  credOffers.value.reduce((s, c) => s + c.offers.length, 0),
);

// Опубликован (5) + status menyusi (rad/muammoli statuslar, soni bilan).
const statusTabs = computed<
  { status_id: number; status_name: string; count: number | null }[]
>(() => {
  const has5 = statusMenu.value.some((s) => s.status_id === 5);
  const base = has5
    ? []
    : [{ status_id: 5, status_name: "Опубликован", count: null }];
  return [...base, ...statusMenu.value];
});

async function loadOffers() {
  loadingOffers.value = true;
  offersError.value = null;
  try {
    const [menu, offers] = await Promise.all([
      api.getShopOffersStatusMenu(),
      api.getShopOffers(activeStatus.value),
    ]);
    statusMenu.value = menu.data;
    credOffers.value = offers.data;
  } catch (e) {
    offersError.value = e instanceof Error ? e.message : t("common.loadError");
  } finally {
    loadingOffers.value = false;
  }
}

function setStatus(id: number) {
  activeStatus.value = id;
  loadOffers();
}

// ----- o'ng detal panel -----
const selected = ref<{
  entityId: string;
  entityName: string;
  offer: ProviderOffer;
} | null>(null);
const detail = ref<ShopOfferDetailResponse | null>(null);
const detailLoading = ref(false);

async function openOffer(c: CredentialOffers, offer: ProviderOffer) {
  selected.value = { entityId: c.credentialId, entityName: c.name, offer };
  detail.value = null;
  detailLoading.value = true;
  try {
    const res = await api.getShopOfferDetail(c.credentialId, offer.id);
    detail.value = res.data;
  } catch {
    detail.value = { analyse: null, offer: null };
  } finally {
    detailLoading.value = false;
  }
}
function closeOffer() {
  selected.value = null;
  detail.value = null;
}

/** Rad sababi statuslari (AI/moderator) — bu statuslarda analiz sabablari ko'rsatiladi. */
const REJECT_STATUSES = new Set([3, 7, 8, 44, 45, 46]);
const isRejectStatus = computed(() => REJECT_STATUSES.has(activeStatus.value));

const offerField = (key: string): string => {
  const v = detail.value?.offer?.[key];
  return v == null ? "—" : String(v);
};

/** Detal offer'dan sana (yyyy-mm-dd) yoki "—". */
const offerDate = (key: string): string => {
  const v =
    detail.value?.offer?.[key] ??
    selected.value?.offer?.[key as keyof ProviderOffer];
  return v ? String(v).slice(0, 10) : "—";
};

function goAdd() {
  router.push("/shop/add");
}

onMounted(() => {
  loadOffers();
  shopStore.ensureLegalEntities();
});
</script>

<template>
  <div class="page pc-page">
    <header class="topbar">
      <div>
        <h1>{{ t("shop.title") }}</h1>
        <div class="crumb-sub">{{ t("shop.subtitle") }}</div>
      </div>
      <div class="topbar-right">
        <button class="btn btn-add btn-lg" @click="goAdd">
          <BaseIcon name="plus" /> {{ t("shop.addProduct.title") }}
        </button>
        <TopbarSettings />
      </div>
    </header>

    <div class="page-scroll scroll">
      <div class="page-inner fade-page" style="max-width: 1180px">
        <!-- status bo'limlari -->
        <div class="offer-status-bar">
          <button
            v-for="s in statusTabs"
            :key="s.status_id"
            :class="['ost-chip', { on: activeStatus === s.status_id }]"
            @click="setStatus(s.status_id)"
          >
            {{ s.status_name
            }}<span v-if="s.count != null" class="ost-count">{{
              s.count
            }}</span>
          </button>
        </div>

        <div
          v-if="offersError"
          class="import-note err"
          style="margin-top: 14px"
        >
          <BaseIcon name="alert" />{{ offersError }}
        </div>
        <div
          v-else-if="loadingOffers"
          class="page-empty"
          style="padding: 50px 0"
        >
          <p>{{ t("common.loading") }}</p>
        </div>
        <div
          v-else-if="credOffers.length === 0"
          class="page-empty"
          style="padding: 50px 0"
        >
          <div class="empty-mark"><BaseIcon name="store" /></div>
          <h3>{{ t("shop.noActiveEntity") }}</h3>
        </div>

        <template v-else>
          <div class="offers-meta">
            {{
              t("shop.offersMeta", {
                entities: credOffers.length,
                offers: offersTotal,
              })
            }}
          </div>
          <section
            v-for="c in credOffers"
            :key="c.credentialId"
            style="margin-top: 22px"
          >
            <div class="section-title">
              {{ c.name }}
              <span class="st-sub">{{
                t("shop.section.offersCount", {
                  n: c.offers.length,
                  inn: c.inn || "—",
                })
              }}</span>
            </div>
            <div v-if="c.error" class="import-note err">
              <BaseIcon name="alert" />{{ c.error }}
            </div>
            <div v-else-if="c.offers.length === 0" class="pr-empty">
              {{ t("shop.noOffersInStatus") }}
            </div>
            <div v-else class="dt-wrap">
              <table class="dt shop-dt">
                <thead>
                  <tr>
                    <th>{{ t("shop.col.product") }}</th>
                    <th>{{ t("lots.col.category") }}</th>
                    <th class="r">{{ t("shop.col.price") }}</th>
                    <th class="r">{{ t("shop.col.qty") }}</th>
                    <th>{{ t("shop.col.platform") }}</th>
                    <th>{{ t("lotDetail.status") }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="o in c.offers"
                    :key="o.id"
                    style="cursor: pointer"
                    @click="openOffer(c, o)"
                  >
                    <td>
                      <div class="c-title">{{ o.product_name }}</div>
                      <div class="c-sub" style="color: var(--ink-4)">
                        {{
                          o.mark_name || o.manufacturer_name || o.product_code
                        }}
                      </div>
                    </td>
                    <td>{{ o.category_name }}</td>
                    <td class="r mono">{{ fmtSom(o.price) }}</td>
                    <td class="r num">{{ o.amount }}</td>
                    <td>
                      <span v-if="o.display_on_shop" class="chip">{{
                        t("shop.platform.electronic")
                      }}</span>
                      <span v-if="o.display_on_national" class="chip">{{
                        t("shop.platform.national")
                      }}</span>
                    </td>
                    <td>
                      <span class="chip">{{ o.status_name }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
      </div>
    </div>

    <!-- ===== o'ng detal panel ===== -->
    <template v-if="selected">
      <div class="modal-scrim" @click="closeOffer">
        <div class="modal wide" @click.stop>
          <div class="modal-top">
            <span class="mt-eyebrow"
              >{{ t("shop.offerEyebrow") }} {{ selected.entityName }}</span
            >
            <button class="icon-btn modal-x" @click="closeOffer">
              <BaseIcon name="x" />
            </button>
          </div>

          <div class="modal-body scroll">
            <div class="od-title">{{ selected.offer.product_name }}</div>
            <div class="od-sub">
              <span class="chip">{{ selected.offer.status_name }}</span>
              <span class="mono" style="color: var(--ink-4)">
                {{ selected.offer.product_code }}</span
              >
            </div>

            <!-- rad sababi (AI/moderator) -->
            <div v-if="detailLoading" class="pr-empty">
              {{ t("shop.detailLoading") }}
            </div>
            <template v-else>
              <div
                v-if="isRejectStatus && detail?.analyse?.length"
                class="reject-box"
              >
                <div class="rb-head">
                  <BaseIcon name="alert" /> {{ t("shop.rejectReason") }}
                </div>
                <div
                  v-for="(a, i) in detail.analyse"
                  :key="i"
                  class="rb-item"
                  :class="{ bad: (a.score ?? 0) === 0 }"
                >
                  <div class="rb-crit">
                    {{ a.criteria_name }}
                    <span v-if="a.result_short" class="rb-short">{{
                      a.result_short
                    }}</span>
                    <span v-if="a.percentage != null" class="rb-pct"
                      >{{ a.percentage }}%</span
                    >
                  </div>
                  <div v-if="a.result" class="rb-text">{{ a.result }}</div>
                </div>
              </div>

              <!-- to'liq ma'lumot -->
              <div class="od-grid">
                <div class="od-cell">
                  <span class="od-lab">{{ t("lots.col.category") }}</span
                  ><span class="od-val">{{
                    detail?.offer?.category_name ?? selected.offer.category_name
                  }}</span>
                </div>
                <div class="od-cell">
                  <span class="od-lab">{{ t("shop.col.price") }}</span
                  ><span class="od-val mono"
                    >{{ fmtSom(selected.offer.price) }}
                    {{ t("currency.som") }}</span
                  >
                </div>
                <div class="od-cell">
                  <span class="od-lab">{{ t("shop.col.qty") }}</span
                  ><span class="od-val">{{ selected.offer.amount }}</span>
                </div>
                <div class="od-cell">
                  <span class="od-lab">{{ t("shop.delivery") }}</span
                  ><span class="od-val"
                    >{{ offerField("min_delivery_amount") }} –
                    {{ offerField("max_delivery_amount") }}</span
                  >
                </div>
                <div class="od-cell">
                  <span class="od-lab">{{ t("shop.manufacturerCountry") }}</span
                  ><span class="od-val">{{
                    offerField("producer_country_name")
                  }}</span>
                </div>
                <div class="od-cell">
                  <span class="od-lab">{{ t("shop.col.platform") }}</span
                  ><span class="od-val">
                    <span v-if="selected.offer.display_on_shop" class="chip">{{
                      t("shop.platform.electronic")
                    }}</span>
                    <span
                      v-if="selected.offer.display_on_national"
                      class="chip"
                      >{{ t("shop.platform.national") }}</span
                    >
                  </span>
                </div>
                <div class="od-cell">
                  <span class="od-lab">{{ t("shop.startDate") }}</span
                  ><span class="od-val">{{ offerDate("start_date") }}</span>
                </div>
                <div class="od-cell">
                  <span class="od-lab">{{ t("shop.endDate") }}</span
                  ><span class="od-val">{{ offerDate("end_date") }}</span>
                </div>
              </div>

              <!-- texnik xususiyatlar -->
              <div v-if="selected.offer.product_name" class="od-section-title">
                {{ t("common.techSpecs") }}
              </div>
              <a
                class="uzex-link"
                :href="`https://xarid.uzex.uz/provider/shop/offers`"
                target="_blank"
                rel="noopener"
              >
                <BaseIcon name="external" />{{ t("shop.viewOnUzex") }}
              </a>
            </template>
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
.offer-status-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.ost-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink-2);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 99px;
  padding: 6px 13px;
  cursor: pointer;
}
.ost-chip.on {
  background: var(--accent-soft);
  border-color: var(--accent-line);
  color: var(--accent-ink);
}
.ost-count {
  font-size: 11px;
  font-weight: 700;
  background: var(--surface);
  border-radius: 99px;
  padding: 0 6px;
  min-width: 18px;
  text-align: center;
}
.ost-chip.on .ost-count {
  background: var(--accent);
  color: #fff;
}
.offers-meta {
  font-size: 13px;
  color: var(--ink-3);
  margin-top: 14px;
}
.pr-empty {
  padding: 16px;
  font-size: 13px;
  color: var(--ink-4);
}
.od-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.od-sub {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 7px 0 18px;
  font-size: 12px;
}
.reject-box {
  border: 1px solid var(--bad-line);
  background: var(--bad-soft);
  border-radius: var(--radius);
  padding: 14px 16px;
  margin-bottom: 18px;
}
.rb-head {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--bad-ink);
  margin-bottom: 10px;
}
.rb-head :deep(svg) {
  width: 16px;
  height: 16px;
}
.rb-item + .rb-item {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--bad-line);
}
.rb-crit {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 13px;
  font-weight: 600;
}
.rb-short {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--bad-ink);
  background: var(--surface);
  border-radius: 5px;
  padding: 1px 7px;
}
.rb-pct {
  font-size: 11px;
  color: var(--ink-4);
}
.rb-text {
  font-size: 12.5px;
  color: var(--ink-2);
  margin-top: 4px;
  line-height: 1.5;
  white-space: pre-wrap;
}
.od-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
}
.od-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.od-lab {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ink-4);
}
.od-val {
  font-size: 14px;
  font-weight: 600;
}
.od-section-title {
  font-size: 14px;
  font-weight: 700;
  margin: 20px 0 10px;
}
.uzex-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 14px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--accent-ink);
  text-decoration: none;
}
.uzex-link :deep(svg) {
  width: 14px;
  height: 14px;
}
</style>
