import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { SHOP_CATEGORIES } from "@/data/shop";
import { api } from "@/lib/api";
import type { GetShopProductsParams } from "@/lib/api";
import type { ApiShopProduct, ShopProductDraft, ShopStatus } from "@/types/shop";
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

  const count = computed(() => meta.value?.total ?? products.value.length);

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
    body: Partial<Pick<ApiShopProduct, "name" | "brand" | "price" | "entities" | "status" | "specs">>,
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
    fetch,
    addProduct,
    updateProduct,
    deleteProduct,
  };
});
