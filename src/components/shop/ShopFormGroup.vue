<script setup lang="ts">
import BaseIcon from "@/components/shared/BaseIcon.vue";

withDefaults(
  defineProps<{
    title: string;
    icon: string;
    badge?: string;
    badgeCls?: "req" | "opt";
    muted?: boolean;
  }>(),
  { muted: false },
);
</script>

<template>
  <div :class="['form-group', { muted }]">
    <div class="fg-head">
      <div class="fg-icon"><BaseIcon :name="icon" /></div>
      <span class="fg-title">{{ title }}</span>
      <span v-if="badge" :class="['fg-badge', badgeCls]">{{ badge }}</span>
    </div>
    <slot />
  </div>
</template>
