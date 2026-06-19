<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLotStore } from '@/stores/lots'
import { useToast } from '@/composables/useToast'
import BaseIcon from '@/components/shared/BaseIcon.vue'
import BaseSelect from '@/components/shared/BaseSelect.vue'
import LotDetail from '@/components/shared/LotDetail.vue'
import { compactSom, deadline } from '@/lib/formatters'
import type { Lot, LotStatus } from '@/types/lot'

const lotStore = useLotStore()
const { pushToast } = useToast()

const status = ref('all')
const cat = ref('all')
const query = ref('')
const sortKey = ref<'match' | 'value' | 'deadline' | 'title'>('match')
const sortDir = ref<'asc' | 'desc'>('desc')
const openId = ref<string | null>(null)

const STATUS_META: Record<LotStatus, { label: string; cls: string }> = {
  pending: { label: 'Kutilmoqda', cls: 'pending' },
  accepted: { label: 'Qabul qilingan', cls: 'accepted' },
  rejected: { label: 'Rad etilgan', cls: 'rejected' },
}

const cats = computed(() => ['all', ...Array.from(new Set(lotStore.lots.map(l => l.category)))])

const rows = computed(() => {
  const q = query.value.trim().toLowerCase()
  const sk: Record<string, (l: Lot) => number | string> = {
    match: (l) => l.match.overall,
    value: (l) => l.maxPrice,
    deadline: (l) => (l.deadlineH <= 0 ? 1e9 : l.deadlineH),
    title: (l) => l.title.toLowerCase(),
  }
  const accessor = sk[sortKey.value]
  const dir = sortDir.value === 'asc' ? 1 : -1
  return lotStore.lots
    .filter(l => status.value === 'all' || l.status === status.value)
    .filter(l => cat.value === 'all' || l.category === cat.value)
    .filter(l => !q || l.title.toLowerCase().includes(q) || l.customer.toLowerCase().includes(q) || l.lotNo.toLowerCase().includes(q))
    .sort((a, b) => {
      const va = accessor(a)
      const vb = accessor(b)
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return 0
    })
})

function toggleSort(k: typeof sortKey.value) {
  if (sortKey.value === k) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = k
    sortDir.value = k === 'title' ? 'asc' : 'desc'
  }
}

function matchColor(v: number) {
  if (v >= 90) return { fg: 'var(--good-ink)', solid: 'var(--good)' }
  if (v >= 75) return { fg: 'var(--accent-ink)', solid: 'var(--accent)' }
  if (v >= 55) return { fg: 'var(--warn-ink)', solid: 'var(--warn)' }
  return { fg: 'var(--bad-ink)', solid: 'var(--bad)' }
}

function decide(id: string, st: LotStatus) {
  const lot = lotStore.getLot(id)
  if (!lot) return
  lotStore.decide(id, st)
  pushToast({
    kind: st === 'accepted' ? 'acc' : 'rej',
    title: st === 'accepted' ? 'Tender qabul qilindi' : 'Tender rad etildi',
    sub: lot.title.length > 40 ? lot.title.slice(0, 40) + '…' : lot.title,
    undoId: id,
  })
  openId.value = null
}

const openLot = computed(() => (openId.value ? lotStore.getLot(openId.value) ?? null : null))
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div>
        <h1>Barcha lotlar</h1>
        <div class="crumb-sub">Tizimga tushgan barcha tenderlar arxivi</div>
      </div>
      <div class="topbar-right">
        <div class="search">
          <BaseIcon name="search" />
          <input placeholder="Lot, buyurtmachi yoki ID qidirish" v-model="query" />
        </div>
        <button class="icon-btn"><BaseIcon name="bell" /><span class="badge-dot" /></button>
      </div>
    </header>

    <div class="page-scroll scroll">
      <div class="page-inner fade-page">
        <div class="filterbar">
          <BaseSelect
            v-model="status"
            :options="[
              { v: 'all', l: 'Barcha holatlar' },
              { v: 'pending', l: 'Qaror kutilmoqda' },
              { v: 'accepted', l: 'Qabul qilingan' },
              { v: 'rejected', l: 'Rad etilgan' },
            ]"
          />
          <BaseSelect
            v-model="cat"
            :options="cats.map(c => ({ v: c, l: c === 'all' ? 'Barcha kategoriyalar' : c }))"
          />
          <div class="filter-spacer" />
          <span class="result-count"><b class="num">{{ rows.length }}</b> ta lot</span>
        </div>

        <div class="dt-wrap">
          <table class="dt">
            <thead>
              <tr>
                <th class="sortable" @click="toggleSort('title')">
                  <span class="th-in">Lot<BaseIcon v-if="sortKey === 'title'" name="sort" /></span>
                </th>
                <th>Buyurtmachi</th>
                <th>Kategoriya</th>
                <th class="sortable" @click="toggleSort('match')">
                  <span class="th-in">Moslik<BaseIcon v-if="sortKey === 'match'" name="sort" /></span>
                </th>
                <th class="sortable r" @click="toggleSort('value')">
                  <span class="th-in">Maksimal narx<BaseIcon v-if="sortKey === 'value'" name="sort" /></span>
                </th>
                <th class="sortable" @click="toggleSort('deadline')">
                  <span class="th-in">Muddat<BaseIcon v-if="sortKey === 'deadline'" name="sort" /></span>
                </th>
                <th>Holat</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="l in rows"
                :key="l.id"
                :class="{ active: l.id === openId }"
                @click="openId = l.id"
              >
                <td>
                  <div class="c-title">{{ l.title }}</div>
                  <div class="c-sub">{{ l.lotNo }}</div>
                </td>
                <td>
                  <div class="c-cust">{{ l.customer }}</div>
                  <div class="c-region">{{ l.region }}</div>
                </td>
                <td><span class="chip">{{ l.category }}</span></td>
                <td>
                  <div class="c-match">
                    <div class="cm-bar"><span :style="{ width: l.match.overall + '%', background: matchColor(l.match.overall).solid }" /></div>
                    <span class="cm-v" :style="{ color: matchColor(l.match.overall).fg }">{{ l.match.overall }}</span>
                  </div>
                </td>
                <td class="r c-money mono">{{ compactSom(l.maxPrice) }}</td>
                <td>
                  <span v-if="deadline(l.deadlineH).closed" style="color: var(--ink-4); font-size: 12.5px">Yopilgan</span>
                  <span v-else :style="{ color: deadline(l.deadlineH).urgent ? 'var(--bad-ink)' : 'var(--ink-2)', fontWeight: deadline(l.deadlineH).urgent ? 650 : 400 }">
                    {{ deadline(l.deadlineH).text }}
                  </span>
                </td>
                <td>
                  <span :class="['status-pill', STATUS_META[l.status].cls]">
                    <span class="sp-dot" />{{ STATUS_META[l.status].label }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="rows.length === 0" class="page-empty">
            <div class="empty-mark"><BaseIcon name="search" /></div>
            <div><h3>Lot topilmadi</h3><p>Filtr yoki qidiruv shartlarini o'zgartiring.</p></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Drawer -->
    <template v-if="openLot">
      <div class="drawer-scrim" @click="openId = null" />
      <div class="drawer">
        <div class="drawer-top">
          <span class="dtt-label">Lot tafsiloti</span>
          <span class="dtt-sub">{{ openLot.lotNo }}</span>
          <button class="icon-btn" style="margin-left: auto" @click="openId = null">
            <BaseIcon name="x" />
          </button>
        </div>
        <LotDetail
          :lot="openLot"
          @accept="id => decide(id, 'accepted')"
          @reject="id => decide(id, 'rejected')"
          @undo="id => lotStore.undo(id)"
        />
      </div>
    </template>
  </div>
</template>
