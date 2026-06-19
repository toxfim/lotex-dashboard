<script setup lang="ts">
import type { LotSpec } from '@/types/lot'
import BaseIcon from '@/components/shared/BaseIcon.vue'

defineProps<{
  specs: LotSpec[]
}>()

const FLAG: Record<string, { cls: string; icon: string }> = {
  ok: { cls: 'ok', icon: 'check' },
  part: { cls: 'part', icon: 'minus' },
  no: { cls: 'no', icon: 'x' },
}
</script>

<template>
  <div class="panel">
    <table class="specs">
      <thead>
        <tr>
          <th>Xususiyat</th>
          <th>Lot talabi</th>
          <th>Bizning zaxira</th>
          <th style="text-align: center">Moslik</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(s, i) in specs" :key="i">
          <td class="sp-label">{{ s.label }}</td>
          <td class="sp-req">{{ s.req }}</td>
          <td class="sp-ours">{{ s.ours }}</td>
          <td class="sp-flag">
            <span :class="['flag-i', FLAG[s.m].cls]">
              <BaseIcon :name="FLAG[s.m].icon" />
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
