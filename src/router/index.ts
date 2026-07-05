import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      name: "login",
      meta: { public: true },
      component: () => import("@/views/LoginView.vue"),
    },
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
      path: "/pc-build",
      name: "pc-build",
      component: () => import("@/views/PcBuildView.vue"),
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
    {
      path: "/accounts",
      name: "accounts",
      component: () => import("@/views/AccountsView.vue"),
    },
  ],
});

// Account-based guard: token bo'lmasa /login; tokeni borlar /login ga kira olmaydi.
router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (auth.token && !auth.user) await auth.fetchMe();

  if (to.meta.public) {
    if (auth.isAuthenticated) return { path: "/" };
    return true;
  }
  if (!auth.isAuthenticated) return { path: "/login" };
  return true;
});

export default router;
