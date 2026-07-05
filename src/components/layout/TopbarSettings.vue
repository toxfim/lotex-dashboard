<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import { useAuthStore } from "@/stores/auth";
import { useI18n } from "@/composables/useI18n";

/**
 * Topbar'dagi tezkor sozlamalar tugmasi: interfeys tilini almashtirish
 * (darhol UI + account'da saqlanadi) va to'liq Sozlamalar sahifasiga o'tish.
 */
const { t, locale, setLocale } = useI18n();
const auth = useAuthStore();

const open = ref(false);
const saving = ref(false);
const root = ref<HTMLElement | null>(null);
const pop = ref<HTMLElement | null>(null);
// Popover body'ga Teleport qilinadi (topbar'ning backdrop-filter stacking
// context'i uni sahifa elementlari ostida qoldirmasin) — pozitsiya tugma
// joylashuvidan hisoblanadi.
const popStyle = ref<Record<string, string>>({});

const LANGS = [
  { code: "uz", label: "O'zbekcha" },
  { code: "ru", label: "Русский" },
] as const;

function toggle() {
  if (!open.value && root.value) {
    const r = root.value.getBoundingClientRect();
    popStyle.value = {
      top: `${r.bottom + 8}px`,
      right: `${Math.max(8, window.innerWidth - r.right)}px`,
    };
  }
  open.value = !open.value;
}

async function changeLanguage(l: string) {
  if (l === locale.value || saving.value) return;
  setLocale(l);
  saving.value = true;
  try {
    await auth.setLanguage(l);
  } finally {
    saving.value = false;
  }
}

function onDocClick(e: MouseEvent) {
  const target = e.target as Node;
  if (
    open.value &&
    !root.value?.contains(target) &&
    !pop.value?.contains(target)
  )
    open.value = false;
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") open.value = false;
}
function onResize() {
  open.value = false;
}

onMounted(() => {
  document.addEventListener("click", onDocClick);
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("resize", onResize);
});
onUnmounted(() => {
  document.removeEventListener("click", onDocClick);
  document.removeEventListener("keydown", onKeydown);
  window.removeEventListener("resize", onResize);
});
</script>

<template>
  <div ref="root" class="tset">
    <button
      :class="['icon-btn', { active: open }]"
      type="button"
      :title="t('nav.settings')"
      @click="toggle"
    >
      <BaseIcon name="settings" />
    </button>
    <Teleport to="body">
      <div v-if="open" ref="pop" class="tset-pop" :style="popStyle">
        <div class="tset-label">{{ t("settings.language") }}</div>
        <div class="tset-langs">
          <button
            v-for="l in LANGS"
            :key="l.code"
            type="button"
            :class="['tset-lang', { on: locale === l.code }]"
            :disabled="saving"
            @click="changeLanguage(l.code)"
          >
            <span class="tset-radio"
              ><span v-if="locale === l.code" class="tset-radio-dot"
            /></span>
            {{ l.label }}
          </button>
        </div>
        <RouterLink class="tset-all" to="/settings" @click="open = false">
          {{ t("nav.settings") }}
          <BaseIcon name="arrowRight" />
        </RouterLink>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.tset {
  position: relative;
}
.icon-btn.active {
  background: var(--surface-3);
}
.tset-pop {
  position: fixed;
  /* body'ga teleport qilingan — modal/scrim'lardan (80) yuqori,
     toast'lardan (100) past */
  z-index: 90;
  width: 210px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  padding: 12px;
  animation: tset-in 0.14s ease;
}
@keyframes tset-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.tset-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-4);
  padding: 0 4px 8px;
}
.tset-langs {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tset-lang {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  border: 1px solid transparent;
  border-radius: 9px;
  background: none;
  padding: 8px 10px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-2);
  text-align: left;
  cursor: pointer;
}
.tset-lang:hover {
  background: var(--surface-2);
}
.tset-lang.on {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-ink);
}
.tset-lang:disabled {
  opacity: 0.6;
  cursor: default;
}
.tset-radio {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1.5px solid var(--border-2);
  display: grid;
  place-items: center;
}
.tset-lang.on .tset-radio {
  border-color: var(--accent);
}
.tset-radio-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
}
.tset-all {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
  padding: 8px 10px;
  border-top: 1px solid var(--border);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink-3);
  text-decoration: none;
  border-radius: 0 0 9px 9px;
}
.tset-all:hover {
  color: var(--ink);
  background: var(--surface-2);
}
.tset-all :deep(svg) {
  width: 14px;
  height: 14px;
}
</style>
