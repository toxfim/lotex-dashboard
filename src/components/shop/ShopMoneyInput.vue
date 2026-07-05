<script setup lang="ts">
import { computed } from "vue";

// Pul maydoni: yozish paytida minglik guruhlash ("23000" → "23 000").
// Model raqam bo'lib qoladi, formatlash faqat ko'rinishda.
const props = defineProps<{
  modelValue: number | null;
  placeholder?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [v: number | null];
}>();

const group = (digits: string): string =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const display = computed(() =>
  props.modelValue == null ? "" : group(String(props.modelValue)),
);

function onInput(e: Event) {
  const el = e.target as HTMLInputElement;
  const digitsBeforeCaret = el.value
    .slice(0, el.selectionStart ?? 0)
    .replace(/\D/g, "").length;
  const digits = el.value.replace(/\D/g, "");

  emit("update:modelValue", digits ? Number(digits) : null);

  // Ko'rinishni darhol formatlab, kursorni o'sha raqamdan keyin qoldiramiz.
  const formatted = digits ? group(String(Number(digits))) : "";
  el.value = formatted;
  let pos = 0;
  let seen = 0;
  while (pos < formatted.length && seen < digitsBeforeCaret) {
    if (/\d/.test(formatted[pos]!)) seen++;
    pos++;
  }
  el.setSelectionRange(pos, pos);
}
</script>

<template>
  <input
    class="money-input"
    type="text"
    inputmode="numeric"
    :value="display"
    :placeholder="placeholder ?? '0'"
    @input="onInput"
  />
</template>

<style scoped>
.money-input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
  font-size: 13.5px;
  background: var(--surface);
  font-variant-numeric: tabular-nums;
}
.money-input:focus {
  outline: none;
  border-color: var(--accent);
}
</style>
