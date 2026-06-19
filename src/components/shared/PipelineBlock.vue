<script setup lang="ts">
import type { Lot } from "@/types/lot";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import { fmtNum } from "@/lib/formatters";

const props = defineProps<{
  lot: Lot;
}>();

const LLM_MAP: Record<string, { label: string; cls: string; icon: string }> = {
  verified: { label: "Tasdiqlandi", cls: "good", icon: "check" },
  partial: { label: "Qisman mos", cls: "warn", icon: "alert" },
  rejected: { label: "Rad etildi", cls: "bad", icon: "x" },
};
</script>

<template>
  <div class="panel">
    <div class="pipe">
      <div class="pipe-stage">
        <div class="ps-num">1-BOSQICH</div>
        <div class="ps-name">
          <BaseIcon
            name="vector"
            :style="{ width: '15px', height: '15px', color: 'var(--accent)' }"
          />
          Vektor o'xshashligi
        </div>
        <div class="ps-desc">
          Lot tavsifi embedding bo'yicha ombor pozitsiyalari bilan taqqoslandi.
        </div>
        <div class="pipe-score">
          <span class="psv" style="color: var(--accent-ink)">{{
            lot.match.vector.toFixed(2)
          }}</span>
          <span class="psu"
            >kosinus · {{ Math.round(lot.match.vector * 100) }}%</span
          >
        </div>
        <div class="meter">
          <span
            :style="{
              width: Math.round(lot.match.vector * 100) + '%',
              background: 'var(--accent)',
            }"
          />
        </div>
      </div>
      <div class="pipe-stage">
        <div class="ps-num">2-BOSQICH</div>
        <div class="ps-name">
          <BaseIcon
            name="cpu"
            :style="{ width: '15px', height: '15px', color: 'var(--accent)' }"
          />
          LLM tasdiqlash
        </div>
        <div class="ps-desc">
          Eng yaqin nomzodlar texnik shartlar bo'yicha til modeli orqali
          tekshirildi.
        </div>
        <div style="margin-top: 11px">
          <span
            class="verdict-pill"
            :style="{
              background: `var(--${LLM_MAP[lot.match.llm].cls}-soft)`,
              color: `var(--${LLM_MAP[lot.match.llm].cls}-ink)`,
              border: `1px solid var(--${LLM_MAP[lot.match.llm].cls}-line)`,
            }"
          >
            <BaseIcon :name="LLM_MAP[lot.match.llm].icon" />
            {{ LLM_MAP[lot.match.llm].label }}
          </span>
        </div>
        <div class="meter" style="margin-top: 16px">
          <span
            :style="{
              width: lot.match.overall + '%',
              background: `var(--${LLM_MAP[lot.match.llm].cls})`,
            }"
          />
        </div>
      </div>
    </div>

    <div class="stock-row">
      <div class="stock-ph"><div class="ph-stripe" /></div>
      <div class="stock-info">
        <div class="si-name">{{ lot.match.stock.name }}</div>
        <div class="si-code">{{ lot.match.stock.code }}</div>
      </div>
      <div class="stock-avail">
        <div class="sa-v num">{{ fmtNum(lot.match.stock.avail) }}</div>
        <div class="sa-l">{{ lot.match.stock.unit }} zaxirada</div>
      </div>
    </div>

    <div class="reason">
      <div class="r-mark"><BaseIcon name="sparkle" /></div>
      <div class="r-body">
        <div class="r-head">Sun'iy intellekt xulosasi</div>
        <div class="r-text">{{ lot.match.reasoning }}</div>
      </div>
    </div>
  </div>
</template>
