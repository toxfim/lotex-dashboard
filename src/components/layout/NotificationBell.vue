<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import { useNotificationsStore } from "@/stores/notifications";
import { useI18n } from "@/composables/useI18n";
import { relativeAgo } from "@/lib/formatters";
import type { AppNotification } from "@/types/notification";

// Header qo'ng'irog'i: o'qilmaganlar soni + real-time dropdown ro'yxat.
const store = useNotificationsStore();
const { t } = useI18n();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);
// Panel body'ga Teleport qilinadi — topbar'ning backdrop-filter stacking
// context'i uni jadval/sticky elementlar ostida qoldirmasin (TopbarSettings kabi).
const panelStyle = ref<Record<string, string>>({});

const KIND_ICON: Record<AppNotification["kind"], string> = {
  OFFER_REJECTED_AI: "cpu",
  OFFER_REJECTED_MODERATOR: "x",
  OFFER_PUBLISHED: "check",
  GENERIC: "bell",
};

function toggle() {
  if (!open.value && root.value) {
    const r = root.value.getBoundingClientRect();
    panelStyle.value = {
      top: `${r.bottom + 8}px`,
      right: `${Math.max(8, window.innerWidth - r.right)}px`,
    };
  }
  open.value = !open.value;
}

function onItemClick(n: AppNotification) {
  void store.markRead(n.id);
}

function onDocClick(e: MouseEvent) {
  const target = e.target as Node;
  if (!root.value?.contains(target) && !panel.value?.contains(target))
    open.value = false;
}
function onResize() {
  open.value = false;
}

onMounted(() => {
  void store.start();
  document.addEventListener("mousedown", onDocClick);
  window.addEventListener("resize", onResize);
});
onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onDocClick);
  window.removeEventListener("resize", onResize);
});
</script>

<template>
  <div ref="root" class="nb">
    <button
      class="icon-btn"
      :aria-label="t('notifications.title')"
      @click="toggle"
    >
      <BaseIcon name="bell" />
      <span v-if="store.unreadCount > 0" class="nb-count">{{
        store.unreadCount > 99 ? "99+" : store.unreadCount
      }}</span>
    </button>

    <Teleport to="body">
      <div v-if="open" ref="panel" class="nb-panel" :style="panelStyle">
        <div class="nb-head">
          <span class="nb-title">{{ t("notifications.title") }}</span>
          <button
            v-if="store.hasUnread"
            class="nb-readall"
            @click="store.markAllRead()"
          >
            {{ t("notifications.readAll") }}
          </button>
        </div>
        <div class="nb-list scroll">
          <div v-if="store.items.length === 0" class="nb-empty">
            {{ t("notifications.empty") }}
          </div>
          <button
            v-for="n in store.items"
            :key="n.id"
            :class="['nb-item', { unread: !n.readAt }]"
            @click="onItemClick(n)"
          >
            <span :class="['nb-ic', n.kind.toLowerCase()]">
              <BaseIcon :name="KIND_ICON[n.kind] ?? 'bell'" />
            </span>
            <span class="nb-main">
              <span class="nb-item-title">{{ n.title }}</span>
              <span class="nb-item-body">{{ n.body }}</span>
              <span class="nb-item-time">{{ relativeAgo(n.createdAt) }}</span>
            </span>
            <span v-if="!n.readAt" class="nb-dot" />
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.nb {
  position: relative;
}
.nb-count {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 99px;
  background: var(--bad-ink, #d33);
  color: #fff;
  font-size: 9.5px;
  font-weight: 700;
  display: grid;
  place-items: center;
  line-height: 1;
}
.nb-panel {
  position: fixed;
  /* body'ga teleport qilingan — modal/scrim'lardan (80) yuqori,
     toast'lardan (100) past */
  z-index: 90;
  width: 340px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: 0 14px 40px rgb(0 0 0 / 0.12);
  overflow: hidden;
}
.nb-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--border);
}
.nb-title {
  font-size: 13px;
  font-weight: 700;
  flex: 1;
}
.nb-readall {
  border: none;
  background: none;
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--accent-ink);
  cursor: pointer;
  padding: 0;
}
.nb-list {
  max-height: 380px;
  overflow-y: auto;
}
.nb-empty {
  padding: 28px;
  text-align: center;
  font-size: 12.5px;
  color: var(--ink-4);
}
.nb-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  text-align: left;
  border: none;
  border-top: 1px solid var(--border);
  background: var(--surface);
  padding: 11px 14px;
  font: inherit;
  cursor: pointer;
}
.nb-item:first-child {
  border-top: none;
}
.nb-item:hover {
  background: var(--surface-2);
}
.nb-item.unread {
  background: var(--accent-soft);
}
.nb-ic {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: var(--surface-3);
  color: var(--ink-2);
}
.nb-ic.offer_rejected_ai,
.nb-ic.offer_rejected_moderator {
  background: var(--bad-soft);
  color: var(--bad-ink);
}
.nb-ic.offer_published {
  background: var(--good-soft);
  color: var(--good-ink);
}
.nb-ic :deep(svg) {
  width: 14px;
  height: 14px;
}
.nb-main {
  flex: 1;
  min-width: 0;
}
.nb-item-title {
  display: block;
  font-size: 12.5px;
  font-weight: 700;
}
.nb-item-body {
  display: block;
  font-size: 12px;
  color: var(--ink-3);
  margin-top: 2px;
  line-height: 1.35;
}
.nb-item-time {
  display: block;
  font-size: 10.5px;
  color: var(--ink-4);
  margin-top: 4px;
}
.nb-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 99px;
  background: var(--accent);
  margin-top: 4px;
}
</style>
