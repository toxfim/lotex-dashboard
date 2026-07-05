<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import type { UzexNamed } from "@/types/shop";

// Combobox: erkin matn kiritish + ro'yxatdan tanlash birga ishlaydi.
// Variant tanlansa id+matn o'rnatiladi; matn qo'lda o'zgartirilsa id tozalanadi.
const props = defineProps<{
  id: number | "";
  text: string;
  options: UzexNamed[];
  placeholder?: string;
}>();

const emit = defineEmits<{
  "update:id": [v: number | ""];
  "update:text": [v: string];
}>();

const root = ref<HTMLElement | null>(null);
const open = ref(false);
const hi = ref(0);

const filtered = computed(() => {
  const q = props.text.trim().toLowerCase();
  // Tanlangan variant nomi bilan bir xil bo'lsa filtrlamaymiz —
  // qayta ochilganda to'liq ro'yxat ko'rinsin.
  const isPicked = props.options.some(
    (o) => o.id === props.id && o.name.toLowerCase() === q,
  );
  if (!q || isPicked) return props.options;
  return props.options.filter((o) => o.name.toLowerCase().includes(q));
});

function onInput(v: string) {
  emit("update:text", v);
  if (props.id !== "") emit("update:id", "");
  open.value = true;
  hi.value = 0;
}

function pick(o: UzexNamed) {
  emit("update:id", o.id);
  emit("update:text", o.name);
  open.value = false;
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
    open.value = true;
    return;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    hi.value = Math.min(hi.value + 1, filtered.value.length - 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    hi.value = Math.max(hi.value - 1, 0);
  } else if (e.key === "Enter") {
    const o = filtered.value[hi.value];
    if (open.value && o) {
      e.preventDefault();
      pick(o);
    }
  } else if (e.key === "Escape") {
    open.value = false;
  }
}

function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
}

onMounted(() => document.addEventListener("mousedown", onDocClick));
onBeforeUnmount(() => document.removeEventListener("mousedown", onDocClick));
</script>

<template>
  <div ref="root" class="combo">
    <input
      class="combo-input"
      type="text"
      :value="text"
      :placeholder="placeholder"
      autocomplete="off"
      role="combobox"
      :aria-expanded="open"
      @input="onInput(($event.target as HTMLInputElement).value)"
      @focus="options.length && (open = true)"
      @keydown="onKeydown"
    />
    <BaseIcon
      v-if="options.length"
      name="sort"
      class="combo-caret"
      @mousedown.prevent="open = !open"
    />
    <div v-if="open && filtered.length" class="combo-menu scroll">
      <button
        v-for="(o, i) in filtered"
        :key="o.id"
        type="button"
        :class="['combo-opt', { hi: i === hi, on: o.id === id }]"
        @mousedown.prevent="pick(o)"
        @mousemove="hi = i"
      >
        <span class="co-name">{{ o.name }}</span>
        <BaseIcon v-if="o.id === id" name="check" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.combo {
  position: relative;
}
.combo-input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 30px 8px 10px;
  font: inherit;
  font-size: 13.5px;
  background: var(--surface);
}
.combo-input:focus {
  outline: none;
  border-color: var(--accent);
}
.combo-caret {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%) scaleY(0.8);
  width: 15px;
  height: 15px;
  color: var(--ink-3);
  cursor: pointer;
}
.combo-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 30;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.08);
  padding: 4px;
}
.combo-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  border: none;
  border-radius: 7px;
  background: none;
  padding: 8px 10px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  color: var(--ink);
}
.combo-opt.hi {
  background: var(--surface-2);
}
.combo-opt.on {
  background: var(--accent-soft);
  font-weight: 600;
}
.co-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.combo-opt :deep(svg) {
  width: 14px;
  height: 14px;
  color: var(--accent-ink);
  flex-shrink: 0;
}
</style>
