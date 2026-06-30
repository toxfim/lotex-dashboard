<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useShopStore } from "@/stores/shop";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import BaseSelect from "@/components/shared/BaseSelect.vue";
import EntityCells from "@/components/shop/EntityCells.vue";
import ProductModal from "@/components/shop/ProductModal.vue";
import {
  SHOP_CATEGORIES,
  STATUS_SHOP,
  entityNames,
  shopCatName,
  shopSub,
} from "@/data/shop";
import { fmtSom } from "@/lib/formatters";

const router = useRouter();
const shopStore = useShopStore();

const query = ref("");
const cat = ref("all");
const openId = ref<string | null>(null);

const catOpts = computed(() => [
  { v: "all", l: "Barcha kategoriyalar" },
  ...SHOP_CATEGORIES.map((c) => ({ v: c.id, l: c.name })),
]);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return shopStore.products
    .filter((p) => cat.value === "all" || p.cat === cat.value)
    .filter((p) => {
      if (!q) return true;
      const subName = shopSub(p.cat, p.sub)?.name ?? "";
      return (
        p.name.toLowerCase().includes(q) ||
        (shopCatName(p.cat) + " " + subName).toLowerCase().includes(q)
      );
    });
});

const groups = computed(() =>
  SHOP_CATEGORIES.map((c) => ({
    cat: c,
    items: filtered.value.filter((p) => p.cat === c.id),
  })).filter((g) => g.items.length > 0),
);

const openProduct = computed(() =>
  openId.value ? shopStore.products.find((p) => p.id === openId.value) : null,
);

function goAdd() {
  router.push("/shop/add");
}

onMounted(() => {
  shopStore.fetch({ limit: 200 });
});
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div>
        <h1>Electron Shop</h1>
        <div class="crumb-sub">
          Tovarlarni boshqarish — xarid.uzex.uz uchun katalog
        </div>
      </div>
      <div class="topbar-right">
        <button class="icon-btn">
          <BaseIcon name="bell" /><span class="badge-dot" />
        </button>
        <button class="btn btn-add btn-lg" @click="goAdd">
          <BaseIcon name="plus" /> Tovar qo'shish
        </button>
      </div>
    </header>

    <div class="page-scroll scroll">
      <div class="page-inner fade-page" style="max-width: 1180px">
        <div class="filterbar">
          <BaseSelect v-model="cat" :options="catOpts" />
          <div class="search" style="width: 280px">
            <BaseIcon name="search" />
            <input placeholder="Tovar nomi bo'yicha qidirish" v-model="query" />
          </div>
          <div class="filter-spacer" />
          <span class="result-count"
            ><b class="num">{{ filtered.length }}</b> ta tovar</span
          >
        </div>

        <div
          v-if="shopStore.loading"
          class="page-empty"
          style="padding: 60px 0"
        >
          <div class="empty-mark" style="opacity: 0.4">
            <BaseIcon name="store" />
          </div>
          <p>Yuklanmoqda…</p>
        </div>

        <div v-else-if="groups.length === 0" class="page-empty">
          <div class="empty-mark"><BaseIcon name="store" /></div>
          <h3>Hali tovar qo'shilmagan</h3>
          <p style="max-width: 320px">
            {{
              query || cat !== "all"
                ? "Filtrlarga mos tovar topilmadi. Filtrlarni tozalab ko'ring."
                : "\"+ Tovar qo'shish\" orqali birinchi tovaringizni katalogga kiriting."
            }}
          </p>
          <button
            v-if="!query && cat === 'all'"
            class="btn btn-add"
            style="margin-top: 4px"
            @click="goAdd"
          >
            <BaseIcon name="plus" /> Tovar qo'shish
          </button>
        </div>

        <section
          v-for="g in groups"
          v-else
          :key="g.cat.id"
          style="margin-top: 26px"
        >
          <div class="section-title">
            {{ g.cat.name }}
            <span class="st-sub">{{ g.items.length }} ta tovar</span>
          </div>
          <div class="dt-wrap">
            <table class="dt shop-dt">
              <thead>
                <tr>
                  <th>Tovar nomi</th>
                  <th>Toifa</th>
                  <th>Do'konlar</th>
                  <th class="r">Narx</th>
                  <th>Holat</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in g.items" :key="p.id" @click="openId = p.id">
                  <td>
                    <div class="cell-prod">
                      <div class="stock-thumb"><div class="ph-stripe" /></div>
                      <div style="min-width: 0">
                        <div class="c-title">{{ p.name }}</div>
                        <div
                          class="c-sub"
                          style="font-family: var(--font); color: var(--ink-4)"
                        >
                          {{ p.brand }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="chip">{{ shopSub(p.cat, p.sub)?.name }}</span>
                  </td>
                  <td><EntityCells :names="entityNames(p.entities)" /></td>
                  <td class="r c-money mono">
                    {{ fmtSom(p.price) }}
                    <span style="color: var(--ink-4); font-weight: 400"
                      >so'm</span
                    >
                  </td>
                  <td>
                    <span :class="['status-pill', STATUS_SHOP[p.status].cls]">
                      <span class="sp-dot" />{{ STATUS_SHOP[p.status].label }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>

    <ProductModal
      v-if="openProduct"
      :product="openProduct"
      @close="openId = null"
    />
  </div>
</template>
