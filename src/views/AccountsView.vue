<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "@/lib/api";
import { useI18n } from "@/composables/useI18n";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import TopbarSettings from "@/components/layout/TopbarSettings.vue";
import type { AuthUser } from "@/types/auth";

const { t } = useI18n();

const users = ref<AuthUser[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const res = await api.getUsers();
    users.value = res.data;
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("accounts.loadError");
  } finally {
    loading.value = false;
  }
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

onMounted(load);
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div>
        <h1>{{ t("accounts.title") }}</h1>
        <div class="crumb-sub">{{ t("accounts.subtitle") }}</div>
      </div>
      <div class="topbar-right">
        <TopbarSettings />
      </div>
    </header>

    <div class="page-scroll scroll">
      <div class="page-inner fade-page" style="max-width: 900px">
        <div v-if="error" class="import-note err">
          <BaseIcon name="alert" />{{ error }}
        </div>

        <div class="dt-wrap">
          <table class="dt">
            <thead>
              <tr>
                <th>{{ t("accounts.username") }}</th>
                <th>{{ t("accounts.name") }}</th>
                <th>{{ t("accounts.telegram") }}</th>
                <th>{{ t("accounts.language") }}</th>
                <th>{{ t("accounts.createdAt") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.id">
                <td class="mono">{{ u.username }}</td>
                <td>{{ u.name }}</td>
                <td>
                  <span v-if="u.telegramUsername"
                    >@{{ u.telegramUsername }}</span
                  >
                  <span v-else>—</span>
                </td>
                <td>{{ u.language.toUpperCase() }}</td>
                <td>{{ fmtDate(u.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
