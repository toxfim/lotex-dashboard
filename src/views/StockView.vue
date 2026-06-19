<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLotStore } from '@/stores/lots'
import BaseIcon from '@/components/shared/BaseIcon.vue'
import BaseSelect from '@/components/shared/BaseSelect.vue'
import { STOCK } from '@/data/stock'
import { fmtNum, fmtSom, compactSom } from '@/lib/formatters'

const lotStore = useLotStore()

const query = ref('')
const cat = ref('all')
const sortKey = ref<'name' | 'avail' | 'cost' | 'value' | 'matches'>('value')
const sortDir = ref<'asc' | 'desc'>('desc')

const cats = computed(() => ['all', ...Array.from(new Set(STOCK.map(s => s.cat)))])

const matchesByCode = computed(() => {
  const m: Record<string, number> = {}
  lotStore.pending.forEach(l => {
    const c = l.match.stock.code
    m[c] = (m[c] || 0) + 1
  })
  return m
})

const totals = computed(() => {
  const value = STOCK.reduce((s, i) => s + i.avail * i.cost, 0)
  const low = STOCK.filter(i => i.avail <= i.reorder).length
  const active = Object.values(matchesByCode.value).reduce((a, b) => a + b, 0)
  return { skus: STOCK.length, value, low, active }
})

const rows = computed(() => {
  const q = query.value.trim().toLowerCase()
  const sk: Record<string, (i: typeof STOCK[0]) => number | string> = {
    name: (i) => i.name.toLowerCase(),
    avail: (i) => i.avail,
    cost: (i) => i.cost,
    value: (i) => i.avail * i.cost,
    matches: (i) => matchesByCode.value[i.code] || 0,
  }
  const accessor = sk[sortKey.value]
  const dir = sortDir.value === 'asc' ? 1 : -1
  return STOCK
    .filter(i => cat.value === 'all' || i.cat === cat.value)
    .filter(i => !q || i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q))
    .sort((a, b) => {
      const va = accessor(a)
      const vb = accessor(b)
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return 0
    })
})

function toggleSort(k: typeof sortKey.value) {
  if (sortKey.value === k) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else { sortKey.value = k; sortDir.value = k === 'name' ? 'asc' : 'desc' }
}

const kpis = computed(() => [
  { label: 'Ombor pozitsiyalari', val: fmtNum(totals.value.skus), sub: 'faol SKU', icon: 'box', tint: 'accent' as const },
  { label: 'Umumiy zaxira qiymati', val: compactSom(totals.value.value) + " so'm", sub: 'tannarxda', icon: 'coins', tint: 'good' as const },
  { label: 'Faol mosliklar', val: fmtNum(totals.value.active), sub: 'navbatdagi lotlar', icon: 'sparkle', tint: 'accent' as const },
  { label: 'Kam qolgan', val: fmtNum(totals.value.low), sub: "to'ldirish zarur", icon: 'alert', tint: 'warn' as const },
])

const tint: Record<string, [string, string]> = {
  accent: ['var(--accent-soft)', 'var(--accent-ink)'],
  good: ['var(--good-soft)', 'var(--good-ink)'],
  warn: ['var(--warn-soft)', 'var(--warn-ink)'],
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div>
        <h1>Ombor</h1>
        <div class="crumb-sub">Ichki zaxira inventari — moslik manbai</div>
      </div>
      <div class="topbar-right">
        <div class="search">
          <BaseIcon name="search" />
          <input placeholder="Mahsulot yoki kod qidirish" v-model="query" />
        </div>
        <button class="icon-btn"><BaseIcon name="bell" /><span class="badge-dot" /></button>
      </div>
    </header>

    <div class="page-scroll scroll">
      <div class="page-inner fade-page">
        <div class="kpi-grid">
          <div v-for="k in kpis" :key="k.label" class="kpi">
            <div class="kpi-top">
              <div class="kpi-icon" :style="{ background: tint[k.tint][0], color: tint[k.tint][1] }">
                <BaseIcon :name="k.icon" />
              </div>
            </div>
            <div class="kpi-label">{{ k.label }}</div>
            <div class="kpi-val mono">{{ k.val }}</div>
            <div class="kpi-sub">{{ k.sub }}</div>
          </div>
        </div>

        <div class="filterbar" style="margin-top: 22px">
          <BaseSelect
            v-model="cat"
            :options="cats.map(c => ({ v: c, l: c === 'all' ? 'Barcha kategoriyalar' : c }))"
          />
          <div class="filter-spacer" />
          <span class="result-count"><b class="num">{{ rows.length }}</b> ta pozitsiya</span>
        </div>

        <div class="dt-wrap">
          <table class="dt">
            <thead>
              <tr>
                <th class="sortable" @click="toggleSort('name')">
                  <span class="th-in">Mahsulot<BaseIcon v-if="sortKey === 'name'" name="sort" /></span>
                </th>
                <th>Kategoriya</th>
                <th class="sortable" @click="toggleSort('avail')">
                  <span class="th-in">Zaxira<BaseIcon v-if="sortKey === 'avail'" name="sort" /></span>
                </th>
                <th class="sortable r" @click="toggleSort('cost')">
                  <span class="th-in">Birlik narxi<BaseIcon v-if="sortKey === 'cost'" name="sort" /></span>
                </th>
                <th class="sortable r" @click="toggleSort('value')">
                  <span class="th-in">Qiymati<BaseIcon v-if="sortKey === 'value'" name="sort" /></span>
                </th>
                <th class="sortable" @click="toggleSort('matches')">
                  <span class="th-in">Faol lotlar<BaseIcon v-if="sortKey === 'matches'" name="sort" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="i in rows" :key="i.code" style="cursor: default">
                <td>
                  <div class="cell-prod">
                    <div class="stock-thumb"><div class="ph-stripe" /></div>
                    <div style="min-width: 0">
                      <div class="c-title">{{ i.name }}</div>
                      <div class="c-sub">{{ i.code }}</div>
                    </div>
                  </div>
                </td>
                <td><span class="chip">{{ i.cat }}</span></td>
                <td>
                  <div style="font-weight: 650" class="num">
                    {{ fmtNum(i.avail) }}
                    <span style="color: var(--ink-4); font-weight: 400; font-size: 12px">{{ i.unit }}</span>
                    <span v-if="i.avail <= i.reorder" class="low-badge">
                      <BaseIcon name="alert" :style="{ width: '11px', height: '11px' }" />kam
                    </span>
                  </div>
                  <div class="avail-bar">
                    <span :style="{ width: Math.min(100, (i.avail / i.cap) * 100) + '%', background: i.avail <= i.reorder ? 'var(--warn)' : 'var(--good)' }" />
                  </div>
                </td>
                <td class="r c-money mono">{{ fmtSom(i.cost) }}</td>
                <td class="r c-money mono">{{ compactSom(i.avail * i.cost) }}</td>
                <td>
                  <span v-if="(matchesByCode[i.code] || 0) > 0" class="matches-link">
                    <BaseIcon name="sparkle" />{{ matchesByCode[i.code] }} ta lot
                  </span>
                  <span v-else class="matches-zero">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
