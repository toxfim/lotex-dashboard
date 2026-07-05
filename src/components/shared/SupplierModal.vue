<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { RouterLink } from "vue-router";

import BaseIcon from "@/components/shared/BaseIcon.vue";
import { useI18n } from "@/composables/useI18n";
import { api } from "@/lib/api";
import { fmtNum, relativeAgo } from "@/lib/formatters";
import type { ApiSupplier } from "@/types/supplier";

const props = defineProps<{
  supplierId: string;
  /** Yuklanayotganda ko'rsatiladigan zaxira nom (badge'dan kelgan). */
  fallbackName?: string | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();

const supplier = ref<ApiSupplier | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const res = await api.getSupplier(props.supplierId);
    supplier.value = res.data;
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("supplierModal.loadError");
  } finally {
    loading.value = false;
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close");
}

onMounted(() => {
  void load();
  window.addEventListener("keydown", onKey);
});
onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <Teleport to="body">
    <div class="smodal-scrim" @click="emit('close')">
      <div
        class="smodal"
        role="dialog"
        aria-modal="true"
        :aria-label="t('supplierModal.ariaLabel')"
        @click.stop
      >
        <div class="modal-top">
          <div class="mt-eyebrow">{{ t("supplierModal.eyebrow") }}</div>
          <button
            class="icon-btn modal-x"
            :aria-label="t('common.close')"
            @click="emit('close')"
          >
            <BaseIcon name="x" />
          </button>
        </div>

        <div class="smodal-body">
          <!-- Yuklanmoqda -->
          <div v-if="loading" class="smodal-state">
            <BaseIcon name="refresh" class="smodal-spin" />
            <span>{{ t("common.loading") }}</span>
          </div>

          <!-- Xato -->
          <div v-else-if="error" class="smodal-state err">
            <BaseIcon name="alert" />
            <span>{{ error }}</span>
            <button class="btn btn-ghost" @click="load">
              {{ t("common.retry") }}
            </button>
          </div>

          <!-- Ma'lumot -->
          <template v-else-if="supplier">
            <div class="sm-hero">
              <div class="sm-av">{{ supplier.name.slice(0, 1).toUpperCase() }}</div>
              <div class="sm-hero-meta">
                <div class="sm-name">{{ supplier.name }}</div>
                <span :class="['chip', supplier.isActive ? 'good' : 'bad']">
                  <BaseIcon :name="supplier.isActive ? 'check' : 'x'" />
                  {{
                    supplier.isActive
                      ? t("supplierModal.active")
                      : t("supplierModal.inactive")
                  }}
                </span>
              </div>
            </div>

            <div class="sm-grid">
              <div class="sm-row">
                <div class="sm-k">{{ t("supplierModal.inn") }}</div>
                <div class="sm-v mono">{{ supplier.inn ?? "—" }}</div>
              </div>
              <div class="sm-row">
                <div class="sm-k">{{ t("supplierModal.phone") }}</div>
                <div class="sm-v">{{ supplier.phone ?? "—" }}</div>
              </div>
              <div class="sm-row">
                <div class="sm-k">Email</div>
                <div class="sm-v">{{ supplier.email ?? "—" }}</div>
              </div>
              <div class="sm-row">
                <div class="sm-k">{{ t("supplierModal.products") }}</div>
                <div class="sm-v">
                  {{ fmtNum(supplier._count.products) }} {{ t("common.count") }}
                </div>
              </div>
              <div class="sm-row">
                <div class="sm-k">{{ t("supplierModal.priceLists") }}</div>
                <div class="sm-v">
                  {{ fmtNum(supplier._count.uploads) }} {{ t("common.count") }}
                </div>
              </div>
              <div class="sm-row">
                <div class="sm-k">{{ t("supplierModal.added") }}</div>
                <div class="sm-v">{{ relativeAgo(supplier.createdAt) }}</div>
              </div>
              <div v-if="supplier.note" class="sm-row col">
                <div class="sm-k">{{ t("supplierModal.note") }}</div>
                <div class="sm-v note">{{ supplier.note }}</div>
              </div>
            </div>
          </template>
        </div>

        <div class="smodal-foot">
          <button class="btn btn-ghost" @click="emit('close')">
            {{ t("common.close") }}
          </button>
          <RouterLink
            class="btn btn-accent"
            :to="{ path: '/supplies', query: { supplier: supplierId } }"
            @click="emit('close')"
          >
            <BaseIcon name="package" />
            {{ t("supplierModal.viewProducts") }}
            <BaseIcon name="arrowRight" />
          </RouterLink>
        </div>
      </div>
    </div>
  </Teleport>
</template>
