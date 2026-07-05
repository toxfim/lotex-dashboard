<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "@/composables/useI18n";
import BaseIcon from "@/components/shared/BaseIcon.vue";

const props = defineProps<{
  /** Foydalanuvchi necha marta urinib ko'rgani — qaysi meme ko'rsatilishini belgilaydi. */
  retryCount: number;
  message?: string;
}>();

const emit = defineEmits<{
  retry: [];
}>();

const { t } = useI18n();

const MEME_COUNT = 7;

// Har bir urinishda keyingi meme, lekin 7-dan oshmaydi.
const meme = computed(
  () => `/server-down-memes/${Math.min(props.retryCount, MEME_COUNT)}.jpg`,
);
</script>

<template>
  <div class="server-down">
    <div class="sd-memes">
      <img :src="meme" :alt="t('serverDown.imgAlt')" loading="lazy" />
    </div>
    <div class="sd-text">
      <h3>{{ t("serverDown.title") }}</h3>
      <p>{{ message ?? t("serverDown.message") }}</p>
    </div>
    <button class="sd-retry" type="button" @click="emit('retry')">
      <BaseIcon name="refresh" />{{ t("common.retry") }}
    </button>
  </div>
</template>
