<script setup lang="ts">
import BaseIcon from '@/components/shared/BaseIcon.vue'

defineProps<{
  modelValue: string
  options: { v: string; l: string }[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="select">
    <select
      :value="modelValue"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="o in options" :key="o.v" :value="o.v">{{ o.l }}</option>
    </select>
    <BaseIcon name="sort" />
  </div>
</template>
