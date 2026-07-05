import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { SHOP_CATEGORIES } from "@/data/shop";
import { api } from "@/lib/api";
import type { GetShopProductsParams } from "@/lib/api";
import type {
  ApiLegalEntity,
  ApiShopProduct,
  ShopProductDraft,
  ShopStatus,
} from "@/types/shop";
import type { PaginationMeta } from "@/types/api";

/** Backend UPPERCASE enum → frontend lowercase ShopStatus. */
function normalizeProduct(p: ApiShopProduct): ApiShopProduct {
  return {
    ...p,
    status: p.status.toLowerCase() as ShopStatus,
  };
}

export const useShopStore = defineStore("shop", () => {
  const products = ref<ApiShopProduct[]>([]);
  const meta = ref<PaginationMeta | null>(null);
  const loading = ref(false);

  // Legal entity'lar (UzexCredential) — API'dan, forma va attribution uchun
  const legalEntities = ref<ApiLegalEntity[]>([]);
  let legalEntitiesLoaded = false;

  // uzex kategoriyalari — yangi tovarlarning cat (raqamli id) nomini yechish uchun
  const uzexCategories = ref<{ id: number; name: string }[]>([]);
  let uzexCategoriesLoaded = false;

  const count = computed(() => meta.value?.total ?? products.value.length);

  /** uzex kategoriyalarini bir marta yuklaydi (list'da nom yechish uchun). */
  async function ensureShopCategories(force = false) {
    if (uzexCategoriesLoaded && !force) return;
    try {
      const res = await api.getShopCategories();
      uzexCategories.value = res.data;
      uzexCategoriesLoaded = true;
    } catch {
      /* katalog yuklanmasa — cat id raw ko'rsatiladi */
    }
  }

  /** cat qiymati → o'qiladigan nom: avval lokal taksonomiya, so'ng uzex, aks holda raw. */
  function catLabel(cat: string): string {
    const local = SHOP_CATEGORIES.find((c) => c.id === cat);
    if (local) return local.name;
    const uz = uzexCategories.value.find((c) => String(c.id) === cat);
    return uz?.name ?? cat;
  }

  /** Legal entity'larni bir marta yuklab keladi (forma ochilganda/list'da). */
  async function ensureLegalEntities(force = false) {
    if (legalEntitiesLoaded && !force) return;
    const res = await api.getLegalEntities();
    legalEntities.value = res.data;
    legalEntitiesLoaded = true;
  }

  /** Entity id → nom (topilmasa id qaytadi — eski/soxta yozuvlar uchun). */
  function entityName(id: string): string {
    return legalEntities.value.find((e) => e.id === id)?.name ?? id;
  }

  /** Bir nechta id → nomlar ro'yxati. */
  function entityNames(ids: string[]): string[] {
    return ids.map(entityName);
  }

  async function fetch(params: GetShopProductsParams = {}) {
    loading.value = true;
    try {
      const res = await api.getShopProducts(params);
      products.value = res.data.map(normalizeProduct);
      meta.value = res.meta;
    } finally {
      loading.value = false;
    }
  }

  async function addProduct(
    draft: ShopProductDraft,
    entityIds: string[],
  ): Promise<ApiShopProduct> {
    const res = await api.createShopProduct(draft, entityIds);
    const product = normalizeProduct(res.data);
    products.value.unshift(product);
    return product;
  }

  async function updateProduct(
    id: string,
    body: Partial<
      Pick<
        ApiShopProduct,
        "name" | "brand" | "price" | "entities" | "status" | "specs"
      >
    >,
  ): Promise<ApiShopProduct> {
    const res = await api.updateShopProduct(id, body);
    const product = normalizeProduct(res.data);
    const idx = products.value.findIndex((p) => p.id === id);
    if (idx !== -1) products.value[idx] = product;
    return product;
  }

  async function deleteProduct(id: string) {
    await api.deleteShopProduct(id);
    products.value = products.value.filter((p) => p.id !== id);
  }

  return {
    products,
    meta,
    loading,
    count,
    categories: SHOP_CATEGORIES,
    legalEntities,
    uzexCategories,
    ensureLegalEntities,
    ensureShopCategories,
    catLabel,
    entityName,
    entityNames,
    fetch,
    addProduct,
    updateProduct,
    deleteProduct,
  };
});
