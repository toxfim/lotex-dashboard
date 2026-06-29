import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { api } from "@/lib/api";
import type {
  ApiSupplier,
  SupplierCreate,
  SupplierUpdate,
} from "@/types/supplier";

export const useSupplierStore = defineStore("suppliers", () => {
  const items = ref<ApiSupplier[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const loaded = ref(false);

  const count = computed(() => items.value.length);
  const productTotal = computed(() =>
    items.value.reduce((sum, s) => sum + s._count.products, 0),
  );
  const uploadTotal = computed(() =>
    items.value.reduce((sum, s) => sum + s._count.uploads, 0),
  );

  async function fetch() {
    loading.value = true;
    error.value = null;
    try {
      // Faol ta'minotchilar; backend defaulti 20 — dashboard uchun ko'proq olamiz.
      const res = await api.getSuppliers({ limit: 100, isActive: true });
      items.value = res.data;
      loaded.value = true;
    } catch (e) {
      error.value =
        e instanceof Error ? e.message : "Ta'minotchilarni yuklab bo'lmadi";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /** Birinchi marta kerak bo'lganda yuklaydi. */
  async function ensureLoaded() {
    if (loaded.value || loading.value) return;
    await fetch().catch(() => {});
  }

  /** Yangilangan ta'minotchini ro'yxatga joylaydi (id bo'yicha almashtiradi yoki qo'shadi). */
  function upsertLocal(supplier: ApiSupplier) {
    const idx = items.value.findIndex((s) => s.id === supplier.id);
    if (idx >= 0) items.value[idx] = supplier;
    else items.value.unshift(supplier);
  }

  async function create(body: SupplierCreate): Promise<ApiSupplier> {
    const res = await api.createSupplier(body);
    upsertLocal(res.data);
    return res.data;
  }

  async function update(
    id: string,
    body: SupplierUpdate,
  ): Promise<ApiSupplier> {
    const res = await api.updateSupplier(id, body);
    upsertLocal(res.data);
    return res.data;
  }

  /** Yumshoq o'chiradi (isActive=false) va ro'yxatdan olib tashlaydi. */
  async function remove(id: string): Promise<void> {
    await api.deleteSupplier(id);
    items.value = items.value.filter((s) => s.id !== id);
  }

  /** Upload/parse'dan keyin tovar/upload sonlarini yangilash uchun. */
  async function refreshOne(id: string): Promise<void> {
    const res = await api.getSupplier(id);
    upsertLocal(res.data);
  }

  return {
    items,
    loading,
    error,
    loaded,
    count,
    productTotal,
    uploadTotal,
    fetch,
    ensureLoaded,
    create,
    update,
    remove,
    refreshOne,
  };
});
