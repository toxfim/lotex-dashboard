<script setup lang="ts">
import BaseIcon from "@/components/shared/BaseIcon.vue";
import { useToast, type Toast } from "@/composables/useToast";
import { useLotStore } from "@/stores/lots";
import { useQueueStore } from "@/stores/queue";

const { toasts, clearToasts } = useToast();
const lotStore = useLotStore();
const queueStore = useQueueStore();

function handleUndo(t: Toast) {
  if (t.source === "queue") {
    // Navbat qaroriga PATCH orqali backendga qaytaramiz.
    queueStore.undo(t.undoId).catch(() => {});
  } else {
    lotStore.undo(t.undoId);
  }
  clearToasts();
}
</script>

<template>
  <div class="toasts">
    <div v-for="t in toasts" :key="t.id" :class="['toast', t.kind]">
      <div class="t-icon">
        <BaseIcon :name="t.kind === 'acc' ? 'check' : 'x'" />
      </div>
      <div class="t-body">
        <div class="t-title">{{ t.title }}</div>
        <div class="t-sub">{{ t.sub }}</div>
      </div>
      <button class="t-undo" @click="handleUndo(t)">Bekor qilish</button>
    </div>
  </div>
</template>
