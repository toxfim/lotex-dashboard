<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useLotStore } from '@/stores/lots'
import BaseIcon from '@/components/shared/BaseIcon.vue'

const route = useRoute()
const router = useRouter()
const lotStore = useLotStore()

const NAV = [
  { id: 'queue', path: '/queue', label: 'Navbat', icon: 'inbox' },
  { id: 'lots', path: '/lots', label: 'Barcha lotlar', icon: 'layers' },
  { id: 'stock', path: '/stock', label: 'Ombor', icon: 'box' },
  { id: 'analytics', path: '/analytics', label: 'Analitika', icon: 'chart' },
]
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark"><BaseIcon name="vector" /></div>
      <div>
        <div class="brand-name">Lotex</div>
        <div class="brand-sub">Tender Matching</div>
      </div>
    </div>

    <nav class="nav">
      <div class="nav-label">Ish maydoni</div>
      <button
        v-for="n in NAV"
        :key="n.id"
        :class="['nav-item', { active: route.name === n.id }]"
        @click="router.push(n.path)"
      >
        <BaseIcon :name="n.icon" />
        {{ n.label }}
        <span v-if="n.id === 'queue' && lotStore.pendingCount > 0" class="nav-count num">
          {{ lotStore.pendingCount }}
        </span>
      </button>
      <div class="nav-label">Tizim</div>
      <button class="nav-item"><BaseIcon name="settings" />Sozlamalar</button>
    </nav>

    <div class="sidebar-spacer" />

    <div class="pipeline-card">
      <div class="pc-head"><span class="dot-pulse" /> AI quvuri faol</div>
      <div class="pc-stat"><span>Skanerlandi</span><b class="num">1 284</b></div>
      <div class="pc-stat"><span>Mos topildi</span><b class="num">37</b></div>
      <div class="pc-stat"><span>Oxirgi sinx.</span><b>2 daq</b></div>
    </div>

    <div class="user-chip">
      <div class="avatar">DR</div>
      <div class="user-meta">
        <div class="un">Dilshod Rasulov</div>
        <div class="ur">Savdo menejeri</div>
      </div>
    </div>
  </aside>
</template>
