import { ref, computed } from "vue";
import { defineStore } from "pinia";
import type { Lot, LotStatus } from "@/types/lot";
import { api } from "@/lib/api";
import { mapApiLot } from "@/lib/mappers";

export const useLotStore = defineStore("lots", () => {
  const lots = ref<Lot[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const loaded = ref(false);

  const pending = computed(() =>
    lots.value.filter((l) => l.status === "pending"),
  );
  const accepted = computed(() =>
    lots.value.filter((l) => l.status === "accepted"),
  );
  const rejected = computed(() =>
    lots.value.filter((l) => l.status === "rejected"),
  );
  const pendingCount = computed(() => pending.value.length);

  async function fetchLots() {
    loading.value = true;
    error.value = null;
    try {
      // Backend sahifma-sahifa qaytaradi (limit 100 ga kesiladi). Filtr/saralash
      // klient tomonda to'liq ro'yxat ustida ishlashi uchun barcha sahifalarni
      // yig'ib olamiz: 1-sahifadagi meta.totalPages bo'yicha qolganini olamiz.
      const first = await api.getLots({ page: 1, limit: 100, order: "desc" });
      const pages = [first];
      if (first.meta.totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: first.meta.totalPages - 1 }, (_, i) =>
            api.getLots({ page: i + 2, limit: 100, order: "desc" }),
          ),
        );
        pages.push(...rest);
      }
      lots.value = pages.flatMap((res) => res.data.map(mapApiLot));
      loaded.value = true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Lotlarni yuklab bo'lmadi";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /** Birinchi marta kerak bo'lganda yuklaydi (qayta navigatsiyada qayta so'ramaydi). */
  async function ensureLoaded() {
    if (loaded.value || loading.value) return;
    await fetchLots().catch(() => {});
  }

  function decide(id: string, status: LotStatus) {
    const lot = lots.value.find((l) => l.id === id);
    if (!lot || lot.status !== "pending") return;
    lot.status = status;
    lot.decidedBy = "Siz";
    lot.decidedAgo = "hozir";
  }

  function undo(id: string) {
    const lot = lots.value.find((l) => l.id === id);
    if (!lot) return;
    lot.status = "pending";
    lot.decidedBy = undefined;
    lot.decidedAgo = undefined;
  }

  function getLot(id: string): Lot | undefined {
    return lots.value.find((l) => l.id === id);
  }

  return {
    lots,
    loading,
    error,
    loaded,
    pending,
    accepted,
    rejected,
    pendingCount,
    fetchLots,
    ensureLoaded,
    decide,
    undo,
    getLot,
  };
});
