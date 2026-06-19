import { ref, computed } from "vue";
import { defineStore } from "pinia";
import type { Lot, LotStatus } from "@/types/lot";
import { api } from "@/lib/api";
import { decisionFromStatus, mapRecommendation } from "@/lib/mappers";

/**
 * Navbat (Queue) — backenddagi matching natijalari (`/api/recommendations`).
 * Manager qarorlari shu yerda PATCH orqali backendga saqlanadi.
 */
export const useQueueStore = defineStore("queue", () => {
  const items = ref<Lot[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const loaded = ref(false);

  const pending = computed(() =>
    items.value.filter((l) => l.status === "pending"),
  );
  const accepted = computed(() =>
    items.value.filter((l) => l.status === "accepted"),
  );
  const rejected = computed(() =>
    items.value.filter((l) => l.status === "rejected"),
  );
  const pendingCount = computed(() => pending.value.length);

  async function fetchQueue() {
    loading.value = true;
    error.value = null;
    try {
      // Backend sahifma-sahifa qaytaradi (limit 100 ga kesiladi). Filtr/saralash
      // klient tomonda to'liq ro'yxat ustida ishlashi uchun barcha sahifalarni
      // yig'ib olamiz: 1-sahifadagi meta.totalPages bo'yicha qolganini olamiz.
      const first = await api.getRecommendations({
        page: 1,
        limit: 100,
        order: "desc",
      });
      const pages = [first];
      if (first.meta.totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: first.meta.totalPages - 1 }, (_, i) =>
            api.getRecommendations({ page: i + 2, limit: 100, order: "desc" }),
          ),
        );
        pages.push(...rest);
      }
      items.value = pages.flatMap((res) => res.data.map(mapRecommendation));
      loaded.value = true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Navbatni yuklab bo'lmadi";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /** Birinchi marta kerak bo'lganda yuklaydi (qayta navigatsiyada qayta so'ramaydi). */
  async function ensureLoaded() {
    if (loaded.value || loading.value) return;
    await fetchQueue().catch(() => {});
  }

  /**
   * Qarorni optimistik qo'llaydi va backendga saqlaydi.
   * Xatolik bo'lsa avvalgi holatga qaytaradi va xatoni qayta otadi.
   */
  async function decide(id: string, status: LotStatus) {
    const lot = items.value.find((l) => l.id === id);
    if (!lot?.recommendationId || lot.status !== "pending") return;

    const prev = { status: lot.status, by: lot.decidedBy, ago: lot.decidedAgo };
    lot.status = status;
    lot.decidedBy = "Siz";
    lot.decidedAgo = "hozir";

    try {
      await api.updateRecommendationDecision(
        lot.recommendationId,
        decisionFromStatus(status),
      );
    } catch (e) {
      lot.status = prev.status;
      lot.decidedBy = prev.by;
      lot.decidedAgo = prev.ago;
      throw e;
    }
  }

  async function undo(id: string) {
    const lot = items.value.find((l) => l.id === id);
    if (!lot?.recommendationId) return;

    const prev = { status: lot.status, by: lot.decidedBy, ago: lot.decidedAgo };
    lot.status = "pending";
    lot.decidedBy = undefined;
    lot.decidedAgo = undefined;

    try {
      await api.updateRecommendationDecision(lot.recommendationId, "PENDING");
    } catch (e) {
      lot.status = prev.status;
      lot.decidedBy = prev.by;
      lot.decidedAgo = prev.ago;
      throw e;
    }
  }

  function getLot(id: string): Lot | undefined {
    return items.value.find((l) => l.id === id);
  }

  return {
    items,
    loading,
    error,
    loaded,
    pending,
    accepted,
    rejected,
    pendingCount,
    fetchQueue,
    ensureLoaded,
    decide,
    undo,
    getLot,
  };
});
