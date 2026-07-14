<script setup lang="ts">
import { computed } from "vue";

// Pul maydoni: yozish paytida minglik guruhlash ("23000" → "23 000").
// Model raqam bo'lib qoladi, formatlash faqat ko'rinishda.
// `decimal` — kasr qismga ruxsat (masalan USD narx "700.5"): usiz nuqta/vergul
// olib tashlanib qiymat 10 barobar oshib ketardi ("700.5" → 7005).
const props = defineProps<{
  modelValue: number | null;
  placeholder?: string;
  decimal?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [v: number | null];
}>();

const group = (digits: string): string =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const display = computed(() => {
  if (props.modelValue == null) return "";
  const [int = "0", frac] = String(props.modelValue).split(".");
  return frac != null && props.decimal ? `${group(int)}.${frac}` : group(int);
});

function onInput(e: Event) {
  const el = e.target as HTMLInputElement;
  // Kursor pozitsiyasi "birlik"larda: raqamlar (+decimal rejimda ayirgichlar).
  const stripRe = props.decimal ? /[^\d.,]/g : /\D/g;
  const unitRe = props.decimal ? /[\d.]/ : /\d/;
  const unitsBeforeCaret = el.value
    .slice(0, el.selectionStart ?? 0)
    .replace(stripRe, "").length;

  let formatted = "";
  let value: number | null = null;

  if (props.decimal) {
    // Vergul ham ayirgich; faqat birinchi ayirgich hisobga olinadi, kasr max 2 xona.
    const raw = el.value.replace(/,/g, ".").replace(/[^\d.]/g, "");
    const sepIdx = raw.indexOf(".");
    const hasSep = sepIdx !== -1;
    const intDigits = hasSep ? raw.slice(0, sepIdx) : raw;
    const fracDigits = hasSep
      ? raw
          .slice(sepIdx + 1)
          .replace(/\./g, "")
          .slice(0, 2)
      : "";
    if (intDigits || hasSep) {
      const intNorm = String(Number(intDigits || "0"));
      formatted = group(intNorm) + (hasSep ? `.${fracDigits}` : "");
      value = Number(intNorm + (fracDigits ? `.${fracDigits}` : ""));
    }
  } else {
    const digits = el.value.replace(/\D/g, "");
    if (digits) {
      formatted = group(String(Number(digits)));
      value = Number(digits);
    }
  }

  emit("update:modelValue", value);

  // Ko'rinishni darhol formatlab, kursorni o'sha birlikdan keyin qoldiramiz.
  el.value = formatted;
  let pos = 0;
  let seen = 0;
  while (pos < formatted.length && seen < unitsBeforeCaret) {
    if (unitRe.test(formatted[pos]!)) seen++;
    pos++;
  }
  el.setSelectionRange(pos, pos);
}
</script>

<template>
  <input
    class="money-input"
    type="text"
    :inputmode="props.decimal ? 'decimal' : 'numeric'"
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
