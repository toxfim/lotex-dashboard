<script setup lang="ts">
import type { LotSpec } from "@/types/lot";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import { useI18n } from "@/composables/useI18n";

defineProps<{
  specs: LotSpec[];
}>();

const { t } = useI18n();

const FLAG: Record<string, { cls: string; icon: string }> = {
  ok: { cls: "ok", icon: "check" },
  part: { cls: "part", icon: "minus" },
  no: { cls: "no", icon: "x" },
};
</script>

<template>
  <div class="panel">
    <table class="specs">
      <thead>
        <tr>
          <th>{{ t("specsTable.property") }}</th>
          <th>{{ t("specsTable.required") }}</th>
          <th>{{ t("specsTable.ours") }}</th>
          <th style="text-align: center">{{ t("specsTable.match") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(s, i) in specs" :key="i">
          <td class="sp-label">{{ s.label }}</td>
          <td class="sp-req">{{ s.req }}</td>
          <td class="sp-ours">{{ s.ours }}</td>
          <td class="sp-flag">
            <span :class="['flag-i', FLAG[s.m].cls]">
              <BaseIcon :name="FLAG[s.m].icon" />
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
