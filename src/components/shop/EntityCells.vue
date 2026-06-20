<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  names: string[];
}>();

const shown = computed(() => props.names.slice(0, 2));
const extra = computed(() => props.names.length - shown.value.length);
</script>

<template>
  <span v-if="names.length === 0" class="matches-zero">—</span>
  <div v-else class="ent-cell">
    <span v-for="(n, i) in shown" :key="i" class="ent-chip">{{ n }}</span>
    <span v-if="extra > 0" class="ent-chip more">+{{ extra }}</span>
  </div>
</template>
