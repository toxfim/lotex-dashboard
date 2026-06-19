import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Lot, LotStatus } from '@/types/lot'
import { LOTS } from '@/data/lots'

export const useLotStore = defineStore('lots', () => {
  const lots = ref<Lot[]>(LOTS.map(l => ({ ...l })))

  const pending = computed(() => lots.value.filter(l => l.status === 'pending'))
  const accepted = computed(() => lots.value.filter(l => l.status === 'accepted'))
  const rejected = computed(() => lots.value.filter(l => l.status === 'rejected'))
  const pendingCount = computed(() => pending.value.length)

  function decide(id: string, status: LotStatus) {
    const lot = lots.value.find(l => l.id === id)
    if (!lot || lot.status !== 'pending') return
    lot.status = status
    lot.decidedBy = 'Siz'
    lot.decidedAgo = 'hozir'
  }

  function undo(id: string) {
    const lot = lots.value.find(l => l.id === id)
    if (!lot) return
    lot.status = 'pending'
    lot.decidedBy = undefined
    lot.decidedAgo = undefined
  }

  function getLot(id: string): Lot | undefined {
    return lots.value.find(l => l.id === id)
  }

  return { lots, pending, accepted, rejected, pendingCount, decide, undo, getLot }
})
