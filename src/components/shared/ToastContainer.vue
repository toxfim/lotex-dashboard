<script setup lang="ts">
import BaseIcon from "@/components/shared/BaseIcon.vue";
import { useToast, type Toast } from "@/composables/useToast";
import { useLotStore } from "@/stores/lots";
import { useQueueStore } from "@/stores/queue";
import { useI18n } from "@/composables/useI18n";

const { toasts, clearToasts } = useToast();
const lotStore = useLotStore();
const queueStore = useQueueStore();
const { t } = useI18n();

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
    <div
      v-for="toast in toasts"
      :key="toast.id"
      :class="['toast', toast.kind]"
    >
      <div class="t-icon">
        <BaseIcon :name="toast.kind === 'acc' ? 'check' : 'x'" />
      </div>
      <div class="t-body">
        <div class="t-title">{{ toast.title }}</div>
        <div class="t-sub">{{ toast.sub }}</div>
      </div>
      <button class="t-undo" @click="handleUndo(toast)">
        {{ t("common.cancel") }}
      </button>
    </div>
  </div>
</template>
