<script setup lang="ts">
import { computed } from "vue";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import { useI18n } from "@/composables/useI18n";

const props = withDefaults(
  defineProps<{
    modelValue: number | null;
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
  }>(),
  { min: 0, max: Number.MAX_SAFE_INTEGER, step: 1, placeholder: "0" },
);

const emit = defineEmits<{
  "update:modelValue": [v: number | null];
}>();

const { t } = useI18n();

const canDec = computed(
  () => props.modelValue == null || props.modelValue > props.min,
);
const canInc = computed(
  () => props.modelValue == null || props.modelValue < props.max,
);

function clamp(v: number): number {
  return Math.min(props.max, Math.max(props.min, v));
}

function nudge(dir: 1 | -1) {
  const base = props.modelValue ?? props.min;
  // Bo'sh maydonda "+" birinchi bosishda min'dan boshlaydi, keyin qadamlaydi.
  const next =
    props.modelValue == null ? clamp(base) : clamp(base + dir * props.step);
  emit("update:modelValue", next);
}

function onInput(raw: string) {
  const digits = raw.replace(/[^\d]/g, "");
  emit("update:modelValue", digits ? clamp(Number(digits)) : null);
}
</script>

<template>
  <div class="stepper">
    <button
      type="button"
      class="step-btn"
      :disabled="!canDec"
      :aria-label="t('common.decrease')"
      @click="nudge(-1)"
    >
      <BaseIcon name="minus" />
    </button>
    <input
      class="step-input"
      type="text"
      inputmode="numeric"
      :value="modelValue ?? ''"
      :placeholder="placeholder"
      @input="onInput(($event.target as HTMLInputElement).value)"
    />
    <button
      type="button"
      class="step-btn"
      :disabled="!canInc"
      :aria-label="t('common.increase')"
      @click="nudge(1)"
    >
      <BaseIcon name="plus" />
    </button>
  </div>
</template>

<style scoped>
.stepper {
  display: flex;
  align-items: stretch;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  overflow: hidden;
}
.stepper:focus-within {
  border-color: var(--accent);
}
.step-btn {
  width: 34px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border: none;
  background: var(--surface-2);
  color: var(--ink-2);
  cursor: pointer;
  transition: background 0.12s;
}
.step-btn:first-child {
  border-right: 1px solid var(--border);
}
.step-btn:last-child {
  border-left: 1px solid var(--border);
}
.step-btn:hover:not(:disabled) {
  background: var(--surface-3);
  color: var(--ink);
}
.step-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.step-btn :deep(svg) {
  width: 14px;
  height: 14px;
}
.step-input {
  flex: 1;
  min-width: 0;
  border: none;
  padding: 8px 10px;
  font: inherit;
  font-size: 13.5px;
  text-align: center;
  background: none;
  outline: none;
}
</style>
