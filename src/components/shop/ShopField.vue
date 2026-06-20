<script setup lang="ts">
import { computed } from "vue";
import ShopFieldSelect from "@/components/shop/ShopFieldSelect.vue";
import { REGIONS } from "@/data/shop";
import type { RegionValue, ShopField, ShopFieldValue } from "@/types/shop";

const props = defineProps<{
  field: ShopField;
  value: ShopFieldValue;
}>();

const emit = defineEmits<{
  update: [value: ShopFieldValue];
}>();

const regions = [...REGIONS];

const region = computed<RegionValue>(() =>
  props.value && typeof props.value === "object" ? props.value : {},
);
const strValue = computed(() =>
  typeof props.value === "string" ? props.value : "",
);

function onNumber(raw: string) {
  emit("update", raw.replace(/[^\d]/g, ""));
}
function setRegion(patch: Partial<RegionValue>) {
  emit("update", { ...region.value, ...patch });
}
</script>

<template>
  <div class="fld">
    <label class="fld-label">
      <span class="fl-t">{{ field.label }}</span>
      <span v-if="field.required" class="req">majburiy</span>
      <span v-else class="opt">ixtiyoriy</span>
    </label>

    <ShopFieldSelect
      v-if="field.type === 'select'"
      :model-value="strValue"
      :options="field.options ?? []"
      placeholder="Tanlang"
      @update:model-value="emit('update', $event)"
    />

    <div v-else-if="field.type === 'number'" class="num-input">
      <input
        type="text"
        inputmode="numeric"
        :value="strValue"
        placeholder="0"
        @input="onNumber(($event.target as HTMLInputElement).value)"
      />
      <span v-if="field.unit" class="num-unit">{{ field.unit }}</span>
    </div>

    <div v-else-if="field.type === 'region'" class="region-row">
      <ShopFieldSelect
        :model-value="region.vil ?? ''"
        :options="regions"
        placeholder="Viloyat"
        @update:model-value="setRegion({ vil: $event })"
      />
      <input
        class="region-tuman"
        placeholder="Tuman / shahar"
        :value="region.tuman ?? ''"
        @input="setRegion({ tuman: ($event.target as HTMLInputElement).value })"
      />
    </div>

    <input
      v-else-if="field.type === 'text'"
      class="text-input"
      :value="strValue"
      @input="emit('update', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>
