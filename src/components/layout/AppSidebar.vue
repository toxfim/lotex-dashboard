<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQueueStore } from "@/stores/queue";
import { usePipelineStatus } from "@/composables/usePipelineStatus";
import { fmtNum, relativeAgo } from "@/lib/formatters";
import BaseIcon from "@/components/shared/BaseIcon.vue";

const route = useRoute();
const router = useRouter();
const queueStore = useQueueStore();
const { status } = usePipelineStatus();

const NAV = [
  { id: "queue", path: "/queue", label: "Navbat", icon: "inbox" },
  { id: "lots", path: "/lots", label: "Barcha lotlar", icon: "layers" },
  { id: "stock", path: "/stock", label: "Ombor", icon: "box" },
  { id: "shop", path: "/shop", label: "Electron Shop", icon: "store" },
  { id: "analytics", path: "/analytics", label: "Analitika", icon: "chart" },
];

// "Oxirgi sinx." nisbiy vaqti sinxlar orasida ham yangilanib tursin.
const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  ticker = setInterval(() => (now.value = Date.now()), 60_000);
});
onUnmounted(() => {
  if (ticker) clearInterval(ticker);
});

// Sub-route'lar (masalan /shop/add) ona bo'limni faol ko'rsatsin.
function isNavActive(id: string): boolean {
  const name = route.name?.toString() ?? "";
  return name === id || name.startsWith(id + "-");
}

const isActive = computed(() => status.value?.active ?? false);
const lastSync = computed(() => {
  void now.value; // har daqiqada qayta hisoblanishi uchun bog'lanish
  const iso = status.value?.lastSyncAt;
  return iso ? relativeAgo(iso) : "—";
});
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark"><BaseIcon name="vector" /></div>
      <div>
        <div class="brand-name">Lotex</div>
        <div class="brand-sub">Tender Matching</div>
      </div>
    </div>

    <nav class="nav">
      <div class="nav-label">Ish maydoni</div>
      <button
        v-for="n in NAV"
        :key="n.id"
        :class="['nav-item', { active: isNavActive(n.id) }]"
        @click="router.push(n.path)"
      >
        <BaseIcon :name="n.icon" />
        {{ n.label }}
        <span
          v-if="n.id === 'queue' && queueStore.pendingCount > 0"
          class="nav-count num"
        >
          {{ queueStore.pendingCount }}
        </span>
      </button>
      <div class="nav-label">Tizim</div>
      <button
        :class="['nav-item', { active: isNavActive('settings') }]"
        @click="router.push('/settings')"
      >
        <BaseIcon name="settings" />Sozlamalar
      </button>
    </nav>

    <div class="sidebar-spacer" />

    <div class="pipeline-card">
      <div class="pc-head">
        <span :class="isActive ? 'dot-pulse' : 'dot-idle'" />
        {{ isActive ? "AI quvuri faol" : "AI quvuri kutilmoqda" }}
      </div>
      <div class="pc-stat">
        <span>Skanerlandi</span
        ><b class="num">{{ fmtNum(status?.scanned ?? 0) }}</b>
      </div>
      <div class="pc-stat">
        <span>Mos topildi</span
        ><b class="num">{{ fmtNum(status?.matched ?? 0) }}</b>
      </div>
      <div class="pc-stat">
        <span>Oxirgi sinx.</span><b>{{ lastSync }}</b>
      </div>
    </div>

    <div class="user-chip">
      <div class="avatar">DR</div>
      <div class="user-meta">
        <div class="un">Dilshod Rasulov</div>
        <div class="ur">Savdo menejeri</div>
      </div>
    </div>
  </aside>
</template>
