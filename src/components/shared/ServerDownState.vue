<script setup lang="ts">
import { computed } from "vue";
import BaseIcon from "@/components/shared/BaseIcon.vue";

const props = defineProps<{
  /** Foydalanuvchi necha marta urinib ko'rgani — qaysi meme ko'rsatilishini belgilaydi. */
  retryCount: number;
  message?: string;
}>();

const emit = defineEmits<{
  retry: [];
}>();

const MEME_COUNT = 7;

// Har bir urinishda keyingi meme, lekin 7-dan oshmaydi.
const meme = computed(
  () => `/server-down-memes/${Math.min(props.retryCount, MEME_COUNT)}.jpg`,
);
</script>

<template>
  <div class="server-down">
    <div class="sd-memes">
      <img :src="meme" alt="Server ishlamayapti" loading="lazy" />
    </div>
    <div class="sd-text">
      <h3>Serverga bog'lana olmadik</h3>
      <p>
        {{
          message ??
          "Server bilan aloqa yo'q. Internet aloqangizni tekshiring yoki birozdan so'ng qayta urinib ko'ring."
        }}
      </p>
    </div>
    <button class="sd-retry" type="button" @click="emit('retry')">
      <BaseIcon name="refresh" />Qayta urinish
    </button>
  </div>
</template>
