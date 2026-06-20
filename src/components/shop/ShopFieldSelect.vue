<script setup lang="ts">
import BaseIcon from "@/components/shared/BaseIcon.vue";

withDefaults(
  defineProps<{
    modelValue: string;
    options: string[];
    placeholder?: string;
    disabled?: boolean;
  }>(),
  { placeholder: "Tanlang", disabled: false },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>

<template>
  <div :class="['field-select', { disabled }]">
    <select
      :value="modelValue"
      :disabled="disabled"
      @change="
        emit('update:modelValue', ($event.target as HTMLSelectElement).value)
      "
    >
      <option value="" disabled>{{ placeholder }}</option>
      <option v-for="o in options" :key="o" :value="o">{{ o }}</option>
    </select>
    <BaseIcon name="sort" />
  </div>
</template>
