<script setup lang="ts">
import { onMounted } from "vue";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import ToastContainer from "@/components/shared/ToastContainer.vue";
import { useLotStore } from "@/stores/lots";
import { useQueueStore } from "@/stores/queue";

const lotStore = useLotStore();
const queueStore = useQueueStore();

onMounted(() => {
  lotStore.ensureLoaded();
  queueStore.ensureLoaded();
});
</script>

<template>
  <div class="app">
    <AppSidebar />
    <div class="main">
      <RouterView />
    </div>
    <ToastContainer />
  </div>
</template>
