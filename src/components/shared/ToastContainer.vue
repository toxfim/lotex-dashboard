<script setup lang="ts">
import BaseIcon from '@/components/shared/BaseIcon.vue'
import { useToast } from '@/composables/useToast'
import { useLotStore } from '@/stores/lots'

const { toasts, clearToasts } = useToast()
const lotStore = useLotStore()

function handleUndo(undoId: string) {
  lotStore.undo(undoId)
  clearToasts()
}
</script>

<template>
  <div class="toasts">
    <div v-for="t in toasts" :key="t.id" :class="['toast', t.kind]">
      <div class="t-icon"><BaseIcon :name="t.kind === 'acc' ? 'check' : 'x'" /></div>
      <div class="t-body">
        <div class="t-title">{{ t.title }}</div>
        <div class="t-sub">{{ t.sub }}</div>
      </div>
      <button class="t-undo" @click="handleUndo(t.undoId)">Bekor qilish</button>
    </div>
  </div>
</template>
