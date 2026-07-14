<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "@/lib/api";
import type { MarginTierInput } from "@/types/margin";
import BaseIcon from "@/components/shared/BaseIcon.vue";

// Bir qator tahrirlanadigan holat. minPrice saqlanmaydi — u DERIVATSIYA qilinadi:
// har tier minPrice = oldingi tier maxPrice (birinchisi `firstMin`) — yarim-ochiq
// [dan, gacha) oraliq: "gacha" qiymati keyingi bo'limga tegishli. Shu tufayli
// narvon kasr narxlarda ham uzluksiz (backend ham shuni talab qiladi).
interface Row {
  maxPrice: number;
  multiplier: number;
  note: string | null;
}

// Yangi qator qo'shilganda oldingi max ustiga qo'shiladigan default oraliq.
const STEP = 10_000;

const firstMin = ref(0); // birinchi tier quyi chegarasi (odatda 0)
const rows = ref<Row[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const saved = ref(false);

/** Tier minPrice = oldingi tier maxPrice (birinchisi firstMin) — [dan, gacha). */
function minOf(i: number): number {
  return i === 0 ? firstMin.value : rows.value[i - 1].maxPrice;
}

/** Yaroqsiz qatorlar indekslari (max ≤ min yoki multiplier ≤ 0). */
const invalidIdx = computed(() => {
  const bad = new Set<number>();
  rows.value.forEach((r, i) => {
    if (!(r.maxPrice > minOf(i)) || !(r.multiplier > 0)) bad.add(i);
  });
  return bad;
});
const canSave = computed(() => !saving.value && invalidIdx.value.size === 0);

const fmt = (n: number) => n.toLocaleString("ru-RU");

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const { data } = await api.getMarginTiers();
    firstMin.value = data[0]?.minPrice ?? 0;
    rows.value = data.map((t) => ({
      // ochiq (∞) tier'ni UI'da katta songa aylantiramiz (UI faqat son bilan ishlaydi)
      maxPrice: t.maxPrice ?? t.minPrice + STEP,
      multiplier: t.multiplier,
      note: t.note,
    }));
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Yuklab bo'lmadi";
  } finally {
    loading.value = false;
  }
}

function addRow() {
  const i = rows.value.length;
  // Yangi qator min = oldingi max (derived, [dan, gacha)). max = oldingi max + STEP.
  const prevMax = i === 0 ? firstMin.value : rows.value[i - 1].maxPrice;
  rows.value.push({ maxPrice: prevMax + STEP, multiplier: 1.2, note: null });
  saved.value = false;
}

function removeRow(i: number) {
  rows.value.splice(i, 1);
  saved.value = false;
}

async function save() {
  if (!canSave.value) return;
  saving.value = true;
  error.value = null;
  saved.value = false;
  try {
    const tiers: MarginTierInput[] = rows.value.map((r, i) => ({
      minPrice: minOf(i),
      maxPrice: r.maxPrice,
      multiplier: r.multiplier,
      note: r.note,
    }));
    await api.replaceMarginTiers(tiers);
    saved.value = true;
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Saqlab bo'lmadi";
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="set-group marja">
    <div class="fg-head">
      <div class="fg-icon"><BaseIcon name="vector" /></div>
      <div class="fg-title">Marja narvoni</div>
      <span class="fg-badge opt">narx oralig'iga qarab koeffitsient</span>
    </div>

    <p class="marja-hint">
      Har bir oraliq uchun koeffitsient (1.3 = +30% ustama). Oraliqlar
      dan-gacha uzluksiz: keyingi qatorning "Dan" chegarasi oldingisining
      "Gacha" chegarasiga teng (mas. 0–10 000, 10 000–20 000); chegara narx
      keyingi oraliqqa tushadi.
    </p>

    <div v-if="loading" class="marja-empty">Yuklanmoqda…</div>

    <template v-else>
      <div v-if="rows.length" class="marja-grid">
        <div class="marja-hrow">
          <span>Dan (UZS)</span>
          <span />
          <span>Gacha (UZS)</span>
          <span>Koeffitsient</span>
          <span />
        </div>

        <div
          v-for="(row, i) in rows"
          :key="i"
          class="marja-r"
          :class="{ bad: invalidIdx.has(i) }"
        >
          <!-- min: birinchi qator tahrirlanadi, qolganlari oldingi max'dan derived -->
          <input
            v-if="i === 0"
            v-model.number="firstMin"
            type="number"
            min="0"
            class="text-input"
          />
          <div v-else class="marja-derived" title="Oldingi qator 'Gacha' qiymati">
            {{ fmt(minOf(i)) }}
          </div>

          <span class="marja-arrow">→</span>

          <input
            v-model.number="row.maxPrice"
            type="number"
            :min="minOf(i)"
            class="text-input"
          />

          <input
            v-model.number="row.multiplier"
            type="number"
            step="0.01"
            min="0"
            class="text-input"
          />

          <button
            class="act-btn danger"
            title="Qatorni o'chirish"
            @click="removeRow(i)"
          >
            <BaseIcon name="trash" />
          </button>
        </div>
      </div>

      <div v-else class="marja-empty">
        Hali marja oralig'i yo'q — “Qator qo'shish” bilan boshlang.
      </div>

      <p v-if="error" class="form-err">{{ error }}</p>
      <p v-else-if="saved" class="marja-ok">✓ Saqlandi</p>

      <div class="marja-foot">
        <button class="btn btn-ghost" @click="addRow">
          <BaseIcon name="plus" />Qator qo'shish
        </button>
        <div class="sidebar-spacer" />
        <button class="btn btn-ghost" :disabled="loading || saving" @click="load">
          Bekor qilish
        </button>
        <button class="btn btn-accent" :disabled="!canSave" @click="save">
          {{ saving ? "Saqlanmoqda…" : "Saqlash" }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.marja {
  margin-top: 22px;
}
.marja-hint {
  font-size: 12.5px;
  color: var(--ink-3);
  margin: 6px 0 14px;
}
.marja-grid {
  display: grid;
  gap: 8px;
}
.marja-hrow,
.marja-r {
  display: grid;
  grid-template-columns: 1fr 22px 1fr 1fr 38px;
  gap: 10px;
  align-items: center;
}
.marja-hrow {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-3);
  padding: 0 2px 2px;
}
.marja-arrow {
  text-align: center;
  color: var(--ink-4);
}
.marja-derived {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 12px;
  border: 1px dashed var(--border);
  border-radius: 9px;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
  background: var(--surface-3);
}
.marja-r.bad .text-input {
  border-color: var(--danger, #e5484d);
}
.act-btn {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface);
  color: var(--ink-3);
  cursor: pointer;
}
.act-btn.danger:hover {
  color: var(--danger, #e5484d);
  border-color: var(--danger, #e5484d);
}
.marja-empty {
  padding: 20px;
  text-align: center;
  color: var(--ink-3);
  font-size: 13px;
}
.marja-ok {
  color: var(--ok, #30a46c);
  font-size: 13px;
  margin-top: 10px;
}
.marja-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
}
</style>
