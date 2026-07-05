<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute } from "vue-router";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import ToastContainer from "@/components/shared/ToastContainer.vue";
import { useAuthStore } from "@/stores/auth";
import { useLotStore } from "@/stores/lots";
import { useQueueStore } from "@/stores/queue";
import { useI18n } from "@/composables/useI18n";

const route = useRoute();
const auth = useAuthStore();
const lotStore = useLotStore();
const queueStore = useQueueStore();
const { setLocale } = useI18n();

// To'liq (sidebar'li) layout faqat login bo'lganda va login sahifasida emas.
const showApp = computed(() => auth.isAuthenticated && route.name !== "login");

// Auth bo'lgach store'larni yuklaymiz va foydalanuvchi tilini qo'llaymiz.
watch(
  () => auth.isAuthenticated,
  (ok) => {
    if (!ok) return;
    lotStore.ensureLoaded();
    queueStore.ensureLoaded();
    if (auth.user?.language) setLocale(auth.user.language);
  },
  { immediate: true },
);
</script>

<template>
  <div v-if="showApp" class="app">
    <AppSidebar />
    <div class="main">
      <RouterView />
    </div>
    <ToastContainer />
  </div>
  <template v-else>
    <RouterView />
    <ToastContainer />
  </template>
</template>
