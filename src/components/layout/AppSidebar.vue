<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQueueStore } from "@/stores/queue";
import { useAuthStore } from "@/stores/auth";
import { usePipelineStatus } from "@/composables/usePipelineStatus";
import { useI18n } from "@/composables/useI18n";
import { fmtNum, relativeAgo } from "@/lib/formatters";
import BaseIcon from "@/components/shared/BaseIcon.vue";

const route = useRoute();
const router = useRouter();
const queueStore = useQueueStore();
const auth = useAuthStore();
const { t } = useI18n();

const { status } = usePipelineStatus();

const NAV = [
  { id: "queue", path: "/queue", key: "nav.queue", icon: "inbox" },
  { id: "lots", path: "/lots", key: "nav.lots", icon: "layers" },
  { id: "shop", path: "/shop", key: "nav.shop", icon: "store" },
  {
    id: "suppliers",
    path: "/suppliers",
    key: "nav.suppliers",
    icon: "package",
  },
  { id: "pc-build", path: "/pc-build", key: "nav.pcBuild", icon: "cpu" },
  { id: "analytics", path: "/analytics", key: "nav.analytics", icon: "chart" },
];

const userInitials = computed(() => {
  const n = auth.user?.name ?? auth.user?.username ?? "?";
  return n
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
});

const showLogoutConfirm = ref(false);

function confirmLogout() {
  showLogoutConfirm.value = false;
  auth.logout();
  router.replace("/login");
}

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
      <div class="nav-label">{{ t("nav.section.work") }}</div>
      <button
        v-for="n in NAV"
        :key="n.id"
        :class="['nav-item', { active: isNavActive(n.id) }]"
        @click="router.push(n.path)"
      >
        <BaseIcon :name="n.icon" />
        {{ t(n.key) }}
        <span
          v-if="n.id === 'queue' && queueStore.pendingCount > 0"
          class="nav-count num"
        >
          {{ queueStore.pendingCount }}
        </span>
      </button>
      <div class="nav-label">{{ t("nav.section.system") }}</div>
      <button
        :class="['nav-item', { active: isNavActive('accounts') }]"
        @click="router.push('/accounts')"
      >
        <BaseIcon name="user" />{{ t("nav.accounts") }}
      </button>
      <button
        :class="['nav-item', { active: isNavActive('settings') }]"
        @click="router.push('/settings')"
      >
        <BaseIcon name="settings" />{{ t("nav.settings") }}
      </button>
    </nav>

    <div class="sidebar-spacer" />

    <div class="pipeline-card">
      <div class="pc-head">
        <span :class="isActive ? 'dot-pulse' : 'dot-idle'" />
        {{ isActive ? t("sidebar.pipeline.active") : t("sidebar.pipeline.idle") }}
      </div>
      <div class="pc-stat">
        <span>{{ t("sidebar.pipeline.scanned") }}</span
        ><b class="num">{{ fmtNum(status?.scanned ?? 0) }}</b>
      </div>
      <div class="pc-stat">
        <span>{{ t("sidebar.pipeline.matched") }}</span
        ><b class="num">{{ fmtNum(status?.matched ?? 0) }}</b>
      </div>
      <div class="pc-stat">
        <span>{{ t("sidebar.pipeline.lastSync") }}</span><b>{{ lastSync }}</b>
      </div>
    </div>

    <div class="user-chip">
      <div class="avatar">{{ userInitials }}</div>
      <div class="user-meta">
        <div class="un">{{ auth.user?.name ?? auth.user?.username }}</div>
        <div class="ur">{{ auth.user?.username }}</div>
      </div>
      <button
        class="logout-btn"
        :title="t('common.logout')"
        @click="showLogoutConfirm = true"
      >
        <BaseIcon name="arrowRight" />
      </button>
    </div>

    <Teleport to="body">
      <div
        v-if="showLogoutConfirm"
        class="logout-scrim"
        @click="showLogoutConfirm = false"
      >
        <div class="dialog" role="dialog" aria-modal="true" @click.stop>
          <div class="dialog-icon"><BaseIcon name="arrowRight" /></div>
          <div class="dialog-title">{{ t("logout.confirm.title") }}</div>
          <div class="dialog-body">{{ t("logout.confirm.body") }}</div>
          <div class="dialog-actions">
            <button class="btn btn-ghost" @click="showLogoutConfirm = false">
              {{ t("common.cancel") }}
            </button>
            <button class="btn btn-danger" @click="confirmLogout">
              {{ t("common.logout") }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </aside>
</template>

<style scoped>
.logout-btn {
  margin-left: auto;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--ink-4);
  display: grid;
  place-items: center;
  cursor: pointer;
}
.logout-btn:hover {
  background: var(--surface-3);
  color: var(--ink-2);
}
.logout-btn :deep(svg) {
  width: 16px;
  height: 16px;
}
.logout-scrim {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgb(23 23 27 / 0.42);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36px;
}
</style>
