<script setup lang="ts">
import { ICON_PATHS } from "@/lib/icons";

const props = defineProps<{
  name: string;
}>();

const path = ICON_PATHS[props.name] ?? "";
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    v-html="path"
  />
</template>
