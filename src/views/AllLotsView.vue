<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useLotStore } from "@/stores/lots";
import { useShopStore } from "@/stores/shop";
import { useToast } from "@/composables/useToast";
import { useI18n } from "@/composables/useI18n";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import BaseSelect from "@/components/shared/BaseSelect.vue";
import LotDetail from "@/components/shared/LotDetail.vue";
import NotificationBell from "@/components/layout/NotificationBell.vue";
import TopbarSettings from "@/components/layout/TopbarSettings.vue";
import { compactSom, deadline } from "@/lib/formatters";
import type { Lot, LotStatus } from "@/types/lot";

const lotStore = useLotStore();
const shopStore = useShopStore();
const { pushToast } = useToast();
const { t } = useI18n();

const status = ref("all");
const cat = ref("all");
const entity = ref("all");
const query = ref("");
const sortKey = ref<"match" | "value" | "deadline" | "title">("match");
const sortDir = ref<"asc" | "desc">("desc");
const openId = ref<string | null>(null);

const PAGE_SIZE = 12;
const page = ref(1);

const STATUS_META: Record<LotStatus, { labelKey: string; cls: string }> = {
  pending: { labelKey: "status.pending", cls: "pending" },
  accepted: { labelKey: "queue.tab.accepted", cls: "accepted" },
  rejected: { labelKey: "queue.tab.rejected", cls: "rejected" },
};

const cats = computed(() => [
  "all",
  ...Array.from(new Set(lotStore.lots.map((l) => l.category))),
]);

const rows = computed(() => {
  const q = query.value.trim().toLowerCase();
  const sk: Record<string, (l: Lot) => number | string> = {
    match: (l) => l.match.overall,
    value: (l) => l.maxPrice,
    deadline: (l) => (l.deadlineH <= 0 ? 1e9 : l.deadlineH),
    title: (l) => l.title.toLowerCase(),
  };
  const accessor = sk[sortKey.value];
  const dir = sortDir.value === "asc" ? 1 : -1;
  return lotStore.lots
    .filter((l) => status.value === "all" || l.status === status.value)
    .filter((l) => cat.value === "all" || l.category === cat.value)
    .filter(
      (l) =>
        entity.value === "all" ||
        l.legalEntities.some((e) => e.id === entity.value),
    )
    .filter(
      (l) =>
        !q ||
        l.title.toLowerCase().includes(q) ||
        l.customer.toLowerCase().includes(q) ||
        l.lotNo.toLowerCase().includes(q),
    )
    .sort((a, b) => {
      const va = accessor(a);
      const vb = accessor(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
});

const totalPages = computed(() =>
  Math.max(1, Math.ceil(rows.value.length / PAGE_SIZE)),
);

const pagedRows = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE;
  return rows.value.slice(start, start + PAGE_SIZE);
});

// Filtr/qidiruv/saralash o'zgarsa birinchi sahifaga qaytamiz; ro'yxat qisqarsa
// joriy sahifani oxirgi mavjud sahifaga klamp qilamiz.
watch([status, cat, entity, query, sortKey, sortDir], () => {
  page.value = 1;
});
watch(totalPages, (max) => {
  if (page.value > max) page.value = max;
});

function goToPage(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value);
}

function toggleSort(k: typeof sortKey.value) {
  if (sortKey.value === k) {
    sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
  } else {
    sortKey.value = k;
    sortDir.value = k === "title" ? "asc" : "desc";
  }
}

function matchColor(v: number) {
  if (v >= 90) return { fg: "var(--good-ink)", solid: "var(--good)" };
  if (v >= 75) return { fg: "var(--accent-ink)", solid: "var(--accent)" };
  if (v >= 55) return { fg: "var(--warn-ink)", solid: "var(--warn)" };
  return { fg: "var(--bad-ink)", solid: "var(--bad)" };
}

function decide(id: string, st: LotStatus) {
  const lot = lotStore.getLot(id);
  if (!lot) return;
  lotStore.decide(id, st);
  pushToast({
    kind: st === "accepted" ? "acc" : "rej",
    title:
      st === "accepted" ? t("queue.toast.accepted") : t("queue.toast.rejected"),
    sub: lot.title.length > 40 ? lot.title.slice(0, 40) + "…" : lot.title,
    undoId: id,
  });
  openId.value = null;
}

const openLot = computed(() =>
  openId.value ? (lotStore.getLot(openId.value) ?? null) : null,
);

onMounted(() => {
  lotStore.ensureLoaded();
  shopStore.ensureLegalEntities();
});
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div>
        <h1>{{ t("lots.title") }}</h1>
        <div class="crumb-sub">{{ t("lots.subtitle") }}</div>
      </div>
      <div class="topbar-right">
        <div class="search">
          <BaseIcon name="search" />
          <input :placeholder="t('lots.search.placeholder')" v-model="query" />
        </div>
        <NotificationBell />
        <TopbarSettings />
      </div>
    </header>

    <div class="page-scroll scroll">
      <div class="page-inner fade-page">
        <div class="filterbar">
          <BaseSelect
            v-model="status"
            :options="[
              { v: 'all', l: t('lots.filter.allStatuses') },
              { v: 'pending', l: t('queue.tab.pending') },
              { v: 'accepted', l: t('queue.tab.accepted') },
              { v: 'rejected', l: t('queue.tab.rejected') },
            ]"
          />
          <BaseSelect
            v-model="cat"
            :options="
              cats.map((c) => ({
                v: c,
                l: c === 'all' ? t('lots.filter.allCategories') : c,
              }))
            "
          />
          <BaseSelect
            v-model="entity"
            :options="[
              { v: 'all', l: t('lots.filter.allEntities') },
              ...shopStore.legalEntities.map((e) => ({ v: e.id, l: e.name })),
            ]"
          />
          <div class="filter-spacer" />
          <span class="result-count"
            ><b class="num">{{ rows.length }}</b> {{ t("common.lots") }}</span
          >
        </div>

        <div class="dt-wrap">
          <table class="dt">
            <thead>
              <tr>
                <th class="sortable" @click="toggleSort('title')">
                  <span class="th-in"
                    >{{ t("lots.col.lot")
                    }}<BaseIcon v-if="sortKey === 'title'" name="sort"
                  /></span>
                </th>
                <th>{{ t("lots.col.customer") }}</th>
                <th>{{ t("lots.col.category") }}</th>
                <th class="sortable" @click="toggleSort('match')">
                  <span class="th-in"
                    >{{ t("lots.col.match")
                    }}<BaseIcon v-if="sortKey === 'match'" name="sort"
                  /></span>
                </th>
                <th class="sortable r" @click="toggleSort('value')">
                  <span class="th-in"
                    >{{ t("common.maxPrice")
                    }}<BaseIcon v-if="sortKey === 'value'" name="sort"
                  /></span>
                </th>
                <th class="sortable" @click="toggleSort('deadline')">
                  <span class="th-in"
                    >{{ t("lots.col.deadline")
                    }}<BaseIcon v-if="sortKey === 'deadline'" name="sort"
                  /></span>
                </th>
                <th>{{ t("lotDetail.status") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="l in pagedRows"
                :key="l.id"
                :class="{ active: l.id === openId }"
                @click="openId = l.id"
              >
                <td>
                  <div class="c-title">{{ l.title }}</div>
                  <div class="c-sub">
                    {{ l.lotNo }}
                    <a
                      v-if="l.buyerLotId"
                      :href="`https://xarid.uzex.uz/shop/lot-details/${l.buyerLotId}`"
                      target="_blank"
                      rel="noopener"
                      :title="t('common.openInUzex')"
                      style="
                        display: inline-flex;
                        vertical-align: middle;
                        margin-left: 5px;
                        color: var(--accent-ink);
                      "
                      @click.stop
                    >
                      <BaseIcon
                        name="external"
                        :style="{ width: '13px', height: '13px' }"
                      />
                    </a>
                  </div>
                </td>
                <td>
                  <div class="c-cust">{{ l.customer }}</div>
                  <div class="c-region">{{ l.region }}</div>
                </td>
                <td>
                  <span class="chip">{{ l.category }}</span>
                </td>
                <td>
                  <div class="c-match">
                    <div class="cm-bar">
                      <span
                        :style="{
                          width: l.match.overall + '%',
                          background: matchColor(l.match.overall).solid,
                        }"
                      />
                    </div>
                    <span
                      class="cm-v"
                      :style="{ color: matchColor(l.match.overall).fg }"
                      >{{ l.match.overall }}</span
                    >
                  </div>
                </td>
                <td class="r c-money mono">{{ compactSom(l.maxPrice) }}</td>
                <td>
                  <span
                    v-if="deadline(l.deadlineH).closed"
                    style="color: var(--ink-4); font-size: 12.5px"
                    >{{ t("time.closed") }}</span
                  >
                  <span
                    v-else
                    :style="{
                      color: deadline(l.deadlineH).urgent
                        ? 'var(--bad-ink)'
                        : 'var(--ink-2)',
                      fontWeight: deadline(l.deadlineH).urgent ? 650 : 400,
                    }"
                  >
                    {{ deadline(l.deadlineH).text }}
                  </span>
                </td>
                <td>
                  <span :class="['status-pill', STATUS_META[l.status].cls]">
                    <span class="sp-dot" />{{
                      t(STATUS_META[l.status].labelKey)
                    }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="lotStore.loading && rows.length === 0" class="page-empty">
            <div class="empty-mark"><BaseIcon name="search" /></div>
            <div>
              <h3>{{ t("common.loading") }}</h3>
              <p>{{ t("lots.loadingDesc") }}</p>
            </div>
          </div>
          <div v-else-if="lotStore.error" class="page-empty">
            <div class="empty-mark"><BaseIcon name="x" /></div>
            <div>
              <h3>{{ t("lots.loadError") }}</h3>
              <p>{{ lotStore.error }}</p>
              <button
                class="icon-btn"
                style="margin-top: 10px; width: auto; padding: 0 14px"
                @click="lotStore.fetchLots()"
              >
                {{ t("common.retry") }}
              </button>
            </div>
          </div>
          <div v-else-if="rows.length === 0" class="page-empty">
            <div class="empty-mark"><BaseIcon name="search" /></div>
            <div>
              <h3>{{ t("lots.notFound.title") }}</h3>
              <p>{{ t("lots.notFound.desc") }}</p>
            </div>
          </div>
        </div>

        <div v-if="rows.length > PAGE_SIZE" class="pager">
          <span class="pager-info">
            <b class="num">{{ (page - 1) * PAGE_SIZE + 1 }}</b
            >–<b class="num">{{ Math.min(page * PAGE_SIZE, rows.length) }}</b> /
            <b class="num">{{ rows.length }}</b>
          </span>
          <div class="pager-ctrls">
            <button
              class="pager-btn"
              :disabled="page <= 1"
              :aria-label="t('common.prevPage')"
              @click="goToPage(page - 1)"
            >
              <BaseIcon name="arrowRight" class="flip" />
            </button>
            <span class="pager-pos"
              ><b class="num">{{ page }}</b> / {{ totalPages }}</span
            >
            <button
              class="pager-btn"
              :disabled="page >= totalPages"
              :aria-label="t('common.nextPage')"
              @click="goToPage(page + 1)"
            >
              <BaseIcon name="arrowRight" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Drawer -->
    <template v-if="openLot">
      <div class="drawer-scrim" @click="openId = null" />
      <div class="drawer">
        <div class="drawer-top">
          <span class="dtt-label">{{ t("lots.drawer.title") }}</span>
          <span class="dtt-sub">{{ openLot.lotNo }}</span>
          <button
            class="icon-btn"
            style="margin-left: auto"
            @click="openId = null"
          >
            <BaseIcon name="x" />
          </button>
        </div>
        <LotDetail
          :lot="openLot"
          @accept="(id) => decide(id, 'accepted')"
          @reject="(id) => decide(id, 'rejected')"
          @undo="(id) => lotStore.undo(id)"
        />
      </div>
    </template>
  </div>
</template>
