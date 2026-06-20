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
      path: "/analytics",
      name: "analytics",
      component: () => import("@/views/AnalyticsView.vue"),
    },
  ],
});

export default router;
