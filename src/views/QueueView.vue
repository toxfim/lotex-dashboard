<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useQueueStore } from "@/stores/queue";
import { useToast } from "@/composables/useToast";
import { useMatchRunner } from "@/composables/useMatchRunner";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import LotCard from "@/components/shared/LotCard.vue";
import LotDetail from "@/components/shared/LotDetail.vue";
import EmptyState from "@/components/shared/EmptyState.vue";
import ServerDownState from "@/components/shared/ServerDownState.vue";
import type { Lot, LotStatus } from "@/types/lot";

const queueStore = useQueueStore();
const { pushToast } = useToast();
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

const SORTS: Record<string, { label: string; fn: (a: Lot, b: Lot) => number }> =
  {
    match: {
      label: "Moslik bo'yicha",
      fn: (a, b) => b.match.overall - a.match.overall,
    },
    deadline: {
      label: "Muddat bo'yicha",
      fn: (a, b) => a.deadlineH - b.deadlineH,
    },
    value: { label: "Summa bo'yicha", fn: (a, b) => b.maxPrice - a.maxPrice },
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
          status === "accepted" ? "Tender qabul qilindi" : "Tender rad etildi",
        sub: lot.title.length > 40 ? lot.title.slice(0, 40) + "…" : lot.title,
        undoId: id,
        source: "queue",
      });
      sel.value = nextId;
    } catch {
      pushToast({
        kind: "rej",
        title: "Qarorni saqlab bo'lmadi",
        sub: "Server bilan bog'lanishda xatolik. Qayta urinib ko'ring.",
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
      title: "Bekor qilib bo'lmadi",
      sub: "Server bilan bog'lanishda xatolik.",
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

const tabMeta: Array<{ id: LotStatus; label: string }> = [
  { id: "pending", label: "Qaror kutilmoqda" },
  { id: "accepted", label: "Qabul qilingan" },
  { id: "rejected", label: "Rad etilgan" },
];

const EMPTY_MAP: Record<LotStatus, { t: string; p: string }> = {
  pending: {
    t: "Navbat bo'sh",
    p: "Qaror kutayotgan lotlar yo'q. AI quvuri yangi mosliklarni topganda ular shu yerda paydo bo'ladi.",
  },
  accepted: {
    t: "Qabul qilingan lotlar yo'q",
    p: "Siz qabul qilgan tenderlar shu bo'limda ko'rinadi.",
  },
  rejected: {
    t: "Rad etilgan lotlar yo'q",
    p: "Rad etilgan tenderlar shu bo'limda ko'rinadi.",
  },
};
</script>

<template>
  <header class="topbar">
    <div>
      <h1>Navbat</h1>
      <div class="crumb-sub">Kompaniyaga mos keluvchi tender lotlari</div>
    </div>
    <div class="topbar-right">
      <div class="search">
        <BaseIcon name="search" />
        <input
          placeholder="Lot, buyurtmachi yoki ID bo'yicha qidirish"
          v-model="query"
        />
      </div>
      <button
        class="btn btn-ghost"
        :disabled="matchBusy"
        title="Yangi (NEW) lotlarni ta'minotchi tovarlariga moslaydi"
        @click="runMatchNow"
      >
        <BaseIcon name="cpu" />{{
          matchBusy ? "Matching ketmoqda…" : "Hozir match qil"
        }}
      </button>
      <button
        class="btn btn-ghost"
        :disabled="matchBusy"
        title="Mos topilmagan (UNMATCHED) lotlarni qayta moslaydi"
        @click="rematchUnmatched"
      >
        <BaseIcon name="refresh" />Qayta match
      </button>
      <button class="icon-btn">
        <BaseIcon name="bell" /><span class="badge-dot" />
      </button>
      <button class="icon-btn"><BaseIcon name="settings" /></button>
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
            v-for="t in tabMeta"
            :key="t.id"
            :class="{ on: tab === t.id }"
            @click="tab = t.id"
          >
            {{ t.label }}<span class="seg-n num">{{ counts[t.id] }}</span>
          </button>
        </div>
      </div>
      <div class="list-meta">
        <span class="lm-count"
          ><b class="num">{{ visible.length }}</b> ta lot{{
            query ? " (filtr)" : ""
          }}</span
        >
        <button
          class="sort-btn"
          @click="sort = sortOrder[(sortOrder.indexOf(sort) + 1) % 3]"
        >
          <BaseIcon name="sort" />{{ SORTS[sort].label }}
        </button>
      </div>
      <div class="list-scroll scroll">
        <EmptyState
          v-if="queueStore.loading && queueStore.items.length === 0"
          icon="inbox"
          title="Yuklanmoqda…"
          description="Navbat serverdan olinmoqda."
        />
        <ServerDownState
          v-else-if="queueStore.error"
          :retry-count="retryCount"
          @retry="retryLoad"
        />
        <EmptyState
          v-else-if="visible.length === 0"
          icon="inbox"
          :title="EMPTY_MAP[tab].t"
          :description="EMPTY_MAP[tab].p"
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
