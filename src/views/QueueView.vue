<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useQueueStore } from "@/stores/queue";
import { useToast } from "@/composables/useToast";
import { useMatchRunner } from "@/composables/useMatchRunner";
import { useI18n } from "@/composables/useI18n";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import LotCard from "@/components/shared/LotCard.vue";
import LotDetail from "@/components/shared/LotDetail.vue";
import EmptyState from "@/components/shared/EmptyState.vue";
import ServerDownState from "@/components/shared/ServerDownState.vue";
import NotificationBell from "@/components/layout/NotificationBell.vue";
import TopbarSettings from "@/components/layout/TopbarSettings.vue";
import type { Lot, LotStatus } from "@/types/lot";

const queueStore = useQueueStore();
const { pushToast } = useToast();
const { t } = useI18n();
// "Hozir match qil" — tugagach navbatni qayta yuklaymiz (yangi mosliklar chiqsin)
const { matchBusy, matchNote, runMatchNow, rematchUnmatched } = useMatchRunner(
  () => queueStore.fetchQueue().catch(() => {}),
);

const tab = ref<LotStatus>("pending");
const query = ref("");
const sort = ref<"match" | "deadline" | "value">("match");
const sel = ref<string | null>(null);
const leaving = ref<string | null>(null);
// Birinchi yuklash xato bo'lganda 1 ta meme; har "Qayta urinish"da bittadan ko'payadi.
const retryCount = ref(1);

async function retryLoad() {
  retryCount.value += 1;
  await queueStore.fetchQueue().catch(() => {});
}

const SORTS: Record<
  string,
  { labelKey: string; fn: (a: Lot, b: Lot) => number }
> = {
  match: {
    labelKey: "queue.sort.match",
    fn: (a, b) => b.match.overall - a.match.overall,
  },
  deadline: {
    labelKey: "queue.sort.deadline",
    fn: (a, b) => a.deadlineH - b.deadlineH,
  },
  value: {
    labelKey: "queue.sort.value",
    fn: (a, b) => b.maxPrice - a.maxPrice,
  },
};
const sortOrder: Array<"match" | "deadline" | "value"> = [
  "match",
  "deadline",
  "value",
];

const counts = computed(() => ({
  pending: queueStore.pending.length,
  accepted: queueStore.accepted.length,
  rejected: queueStore.rejected.length,
}));

const visible = computed(() => {
  const q = query.value.trim().toLowerCase();
  return queueStore.items
    .filter((l) => l.status === tab.value)
    .filter(
      (l) =>
        !q ||
        l.title.toLowerCase().includes(q) ||
        l.customer.toLowerCase().includes(q) ||
        l.lotNo.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q),
    )
    .sort(SORTS[sort.value].fn);
});

const selLot = computed(() =>
  sel.value ? (queueStore.getLot(sel.value) ?? null) : null,
);

watch(tab, () => {
  if (sel.value && !visible.value.some((l) => l.id === sel.value)) {
    sel.value = visible.value[0]?.id ?? null;
  }
  if (!sel.value && visible.value.length) {
    sel.value = visible.value[0].id;
  }
});

// Ma'lumot async yuklangani uchun ro'yxat to'lganda birinchi elementni tanlaymiz.
watch(visible, (rows) => {
  if (!sel.value && rows.length) sel.value = rows[0].id;
});

onMounted(() => {
  queueStore.ensureLoaded();
  if (!sel.value && visible.value.length) sel.value = visible.value[0].id;
});

function decide(id: string, status: LotStatus) {
  if (leaving.value) return;
  const lot = queueStore.getLot(id);
  if (!lot || lot.status !== "pending") return;
  const idx = visible.value.findIndex((l) => l.id === id);
  const nextId = (visible.value[idx + 1] || visible.value[idx - 1])?.id ?? null;

  leaving.value = id;

  setTimeout(async () => {
    try {
      await queueStore.decide(id, status);
      pushToast({
        kind: status === "accepted" ? "acc" : "rej",
        title:
          status === "accepted"
            ? t("queue.toast.accepted")
            : t("queue.toast.rejected"),
        sub: lot.title.length > 40 ? lot.title.slice(0, 40) + "…" : lot.title,
        undoId: id,
        source: "queue",
      });
      sel.value = nextId;
    } catch {
      pushToast({
        kind: "rej",
        title: t("queue.toast.decisionError"),
        sub: `${t("common.serverError")} ${t("common.tryAgain")}`,
        undoId: id,
        source: "queue",
      });
    } finally {
      leaving.value = null;
    }
  }, 320);
}

async function localUndo(id: string) {
  try {
    await queueStore.undo(id);
    tab.value = "pending";
    sel.value = id;
  } catch {
    pushToast({
      kind: "rej",
      title: t("queue.toast.undoError"),
      sub: t("common.serverError"),
      undoId: id,
      source: "queue",
    });
  }
}

function onKey(e: KeyboardEvent) {
  if ((e.target as HTMLElement).tagName === "INPUT") return;
  if (!selLot.value || selLot.value.status !== "pending") return;
  if (e.key.toLowerCase() === "a") decide(selLot.value.id, "accepted");
  if (e.key.toLowerCase() === "r") decide(selLot.value.id, "rejected");
}

onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));

const tabMeta: Array<{ id: LotStatus; labelKey: string }> = [
  { id: "pending", labelKey: "queue.tab.pending" },
  { id: "accepted", labelKey: "queue.tab.accepted" },
  { id: "rejected", labelKey: "queue.tab.rejected" },
];

const EMPTY_MAP: Record<LotStatus, { tKey: string; pKey: string }> = {
  pending: {
    tKey: "queue.empty.pending.title",
    pKey: "queue.empty.pending.desc",
  },
  accepted: {
    tKey: "queue.empty.accepted.title",
    pKey: "queue.empty.accepted.desc",
  },
  rejected: {
    tKey: "queue.empty.rejected.title",
    pKey: "queue.empty.rejected.desc",
  },
};
</script>

<template>
  <header class="topbar">
    <div>
      <h1>{{ t("queue.title") }}</h1>
      <div class="crumb-sub">{{ t("queue.subtitle") }}</div>
    </div>
    <div class="topbar-right">
      <div class="search">
        <BaseIcon name="search" />
        <input :placeholder="t('queue.search.placeholder')" v-model="query" />
      </div>
      <button
        class="btn btn-ghost"
        :disabled="matchBusy"
        :title="t('queue.matchNow.title')"
        @click="runMatchNow"
      >
        <BaseIcon name="cpu" />{{
          matchBusy ? t("queue.matching") : t("queue.matchNow")
        }}
      </button>
      <button
        class="btn btn-ghost"
        :disabled="matchBusy"
        :title="t('queue.rematch.title')"
        @click="rematchUnmatched"
      >
        <BaseIcon name="refresh" />{{ t("queue.rematch") }}
      </button>
      <NotificationBell />
      <TopbarSettings />
    </div>
  </header>

  <div
    v-if="matchNote"
    class="import-note"
    :class="matchNote.kind"
    style="margin: 0 22px 0"
  >
    <BaseIcon :name="matchNote.kind === 'ok' ? 'cpu' : 'alert'" />
    {{ matchNote.text }}
    <button class="import-x" @click="matchNote = null">
      <BaseIcon name="x" />
    </button>
  </div>

  <div class="workspace">
    <div class="list-pane">
      <div class="list-head">
        <div class="seg">
          <button
            v-for="tm in tabMeta"
            :key="tm.id"
            :class="{ on: tab === tm.id }"
            @click="tab = tm.id"
          >
            {{ t(tm.labelKey)
            }}<span class="seg-n num">{{ counts[tm.id] }}</span>
          </button>
        </div>
      </div>
      <div class="list-meta">
        <span class="lm-count"
          ><b class="num">{{ visible.length }}</b> {{ t("common.lots")
          }}{{ query ? ` ${t("common.filtered")}` : "" }}</span
        >
        <button
          class="sort-btn"
          @click="sort = sortOrder[(sortOrder.indexOf(sort) + 1) % 3]"
        >
          <BaseIcon name="sort" />{{ t(SORTS[sort].labelKey) }}
        </button>
      </div>
      <div class="list-scroll scroll">
        <EmptyState
          v-if="queueStore.loading && queueStore.items.length === 0"
          icon="inbox"
          :title="t('common.loading')"
          :description="t('queue.loading.desc')"
        />
        <ServerDownState
          v-else-if="queueStore.error"
          :retry-count="retryCount"
          @retry="retryLoad"
        />
        <EmptyState
          v-else-if="visible.length === 0"
          icon="inbox"
          :title="t(EMPTY_MAP[tab].tKey)"
          :description="t(EMPTY_MAP[tab].pKey)"
        />
        <LotCard
          v-for="lot in visible"
          :key="lot.id"
          :lot="lot"
          :selected="lot.id === sel"
          :leaving="lot.id === leaving"
          @click="sel = lot.id"
        />
      </div>
    </div>

    <LotDetail
      :lot="selLot"
      @accept="(id) => decide(id, 'accepted')"
      @reject="(id) => decide(id, 'rejected')"
      @undo="localUndo"
    />
  </div>
</template>
