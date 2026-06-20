import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { SHOP_CATEGORIES, SHOP_PRODUCTS } from "@/data/shop";
import type { ShopProduct, ShopProductDraft } from "@/types/shop";

export const useShopStore = defineStore("shop", () => {
  const products = ref<ShopProduct[]>([...SHOP_PRODUCTS]);

  const count = computed(() => products.value.length);

  /** Add-product formidan kelgan qoralamadan moderatsiyadagi tovar yaratadi. */
  function addProduct(
    draft: ShopProductDraft,
    entityIds: string[],
  ): ShopProduct {
    const product: ShopProduct = {
      id: "p" + Math.random().toString(36).slice(2, 7),
      cat: draft.cat,
      sub: draft.sub,
      name: draft.name,
      brand: draft.brand,
      price: draft.price,
      entities: entityIds,
      status: "moderation",
      specs: draft.specs,
    };
    products.value.unshift(product);
    return product;
  }

  return { products, count, categories: SHOP_CATEGORIES, addProduct };
});
