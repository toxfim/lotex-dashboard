<script setup lang="ts">
import type { Lot } from '@/types/lot'
import BaseIcon from '@/components/shared/BaseIcon.vue'
import MatchRing from '@/components/shared/MatchRing.vue'
import PipelineBlock from '@/components/shared/PipelineBlock.vue'
import SpecsTable from '@/components/shared/SpecsTable.vue'
import PricingBlock from '@/components/shared/PricingBlock.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import { fmtNum, compactSom, deadline } from '@/lib/formatters'

const props = defineProps<{
  lot: Lot | null
}>()

const emit = defineEmits<{
  accept: [id: string]
  reject: [id: string]
  undo: [id: string]
}>()
</script>

<template>
  <EmptyState
    v-if="!lot"
    icon="arrowRight"
    title="Lot tanlanmagan"
    description="Tahlil, moslik dalillari va narx hisob-kitobini ko'rish uchun chapdagi navbatdan lotni tanlang."
  />

  <div v-else class="detail-pane">
    <div class="detail-scroll scroll">
      <div class="detail-inner" :key="lot.id">
        <div class="d-head">
          <div class="d-head-main">
            <div class="d-eyebrow">
              <span class="chip accent">{{ lot.category }}</span>
              <span class="d-lotno">{{ lot.lotNo }}</span>
            </div>
            <h1 class="d-title">{{ lot.title }}</h1>
            <div class="d-cust">
              <BaseIcon name="building" :style="{ width: '15px', height: '15px', opacity: 0.7 }" />
              {{ lot.customer }}
              <span class="sep" />
              <BaseIcon name="map" :style="{ width: '14px', height: '14px', opacity: 0.7 }" />
              {{ lot.region }}
            </div>
          </div>
          <MatchRing :value="lot.match.overall" :size="62" />
        </div>

        <div class="d-meta-row">
          <div class="meta-box">
            <div class="mb-label"><BaseIcon name="package" />Miqdor</div>
            <div class="mb-val num">{{ fmtNum(lot.qty) }}</div>
            <div class="mb-sub">{{ lot.unit }}</div>
          </div>
          <div class="meta-box">
            <div class="mb-label"><BaseIcon name="coins" />Maksimal narx</div>
            <div class="mb-val mono">{{ compactSom(lot.maxPrice) }}</div>
            <div class="mb-sub">so'm</div>
          </div>
          <div :class="['meta-box', { urgent: deadline(lot.deadlineH).urgent && !deadline(lot.deadlineH).closed }]">
            <div class="mb-label">
              <BaseIcon name="clock" />
              {{ deadline(lot.deadlineH).closed ? 'Holat' : 'Muddat tugashiga' }}
            </div>
            <div class="mb-val">
              {{ deadline(lot.deadlineH).closed ? 'Yopilgan' : deadline(lot.deadlineH).text }}
            </div>
            <div class="mb-sub">
              {{ deadline(lot.deadlineH).closed ? 'tender yopilgan' : deadline(lot.deadlineH).urgent ? 'shoshilinch' : 'qoldi' }}
            </div>
          </div>
        </div>

        <!-- Decided strip -->
        <div
          v-if="lot.status !== 'pending'"
          :class="['decided-strip', lot.status === 'accepted' ? 'acc' : 'rej']"
        >
          <div class="ds-icon">
            <BaseIcon :name="lot.status === 'accepted' ? 'check' : 'x'" />
          </div>
          <div>
            <div class="ds-t">{{ lot.status === 'accepted' ? 'Qabul qilingan' : 'Rad etilgan' }}</div>
            <div class="ds-s">{{ lot.decidedBy }} · {{ lot.decidedAgo }}</div>
          </div>
          <button class="undo-btn" @click="emit('undo', lot.id)">Navbatga qaytarish</button>
        </div>

        <!-- Match analysis section -->
        <div class="section">
          <div class="section-head">
            <div class="sh-icon" style="background: var(--accent-soft); color: var(--accent-ink)">
              <BaseIcon name="sparkle" />
            </div>
            <h2>Moslik tahlili</h2>
            <span class="sh-sub">Ikki bosqichli AI quvuri</span>
          </div>
          <PipelineBlock :lot="lot" />
        </div>

        <!-- Specs section -->
        <div class="section">
          <div class="section-head">
            <div class="sh-icon" style="background: var(--surface-3); color: var(--ink-2)">
              <BaseIcon name="flag" />
            </div>
            <h2>Texnik xususiyatlar</h2>
            <span class="sh-sub">talab ⟷ zaxira</span>
          </div>
          <SpecsTable :specs="lot.match.specs" />
        </div>

        <!-- Pricing section -->
        <div class="section">
          <div class="section-head">
            <div class="sh-icon" style="background: var(--surface-3); color: var(--ink-2)">
              <BaseIcon name="scale" />
            </div>
            <h2>Narx va foydalilik</h2>
            <span class="sh-sub">to'lovlar hisobga olingan</span>
          </div>
          <PricingBlock :lot="lot" />
        </div>
      </div>
    </div>

    <!-- Action bar (only for pending lots) -->
    <div v-if="lot.status === 'pending'" class="action-bar">
      <div class="ab-hint">
        <BaseIcon name="cpu" :style="{ width: '14px', height: '14px', opacity: 0.6 }" />
        Yakuniy qarorni menejer qabul qiladi
        <span style="margin-left: 8px"><kbd>R</kbd> rad · <kbd>A</kbd> qabul</span>
      </div>
      <button class="btn btn-reject btn-lg" @click="emit('reject', lot.id)">
        <BaseIcon name="x" /> Rad etish
      </button>
      <button class="btn btn-accept btn-lg" @click="emit('accept', lot.id)">
        <BaseIcon name="check" /> Qabul qilish
      </button>
    </div>
  </div>
</template>
