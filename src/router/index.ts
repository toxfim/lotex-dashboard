import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: "/queue",
    },
    {
      path: "/queue",
      name: "queue",
      component: () => import("@/views/QueueView.vue"),
    },
    {
      path: "/lots",
      name: "lots",
      component: () => import("@/views/AllLotsView.vue"),
    },
    {
      path: "/stock",
      name: "stock",
      component: () => import("@/views/StockView.vue"),
    },
    {
      path: "/shop",
      name: "shop",
      component: () => import("@/views/ShopView.vue"),
    },
    {
      path: "/shop/add",
      name: "shop-add",
      component: () => import("@/views/AddProductView.vue"),
    },
    {
      path: "/suppliers",
      name: "suppliers",
      component: () => import("@/views/SuppliersView.vue"),
    },
    {
      // Barcha ta'minot tovarlari (supplies). ?supplier=<id> bo'lsa — faqat o'sha
      // ta'minotchi tovarlari. Bir xil komponent (SuppliersView) tab'ni route'dan oladi.
      path: "/supplies",
      name: "suppliers-all",
      component: () => import("@/views/SuppliersView.vue"),
    },
    {
      path: "/analytics",
      name: "analytics",
      component: () => import("@/views/AnalyticsView.vue"),
    },
    {
      path: "/settings",
      name: "settings",
      component: () => import("@/views/SettingsView.vue"),
    },
  ],
});

export default router;
