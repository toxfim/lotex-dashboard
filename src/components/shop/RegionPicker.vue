<script setup lang="ts">
import { computed, ref } from "vue";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import { useI18n } from "@/composables/useI18n";
import { matchesQuery } from "@/lib/translit";
import type { UzexDistrict, UzexRegion } from "@/types/shop";

// Hudud tanlagich: viloyat kartalari ochilib tuman darajasida belgilanadi.
// Model: viloyat id → tanlangan tuman id'lari (bo'sh viloyatlar saqlanmaydi).
const props = defineProps<{
  regions: UzexRegion[];
  modelValue: Record<number, number[]>;
}>();

const emit = defineEmits<{
  "update:modelValue": [v: Record<number, number[]>];
}>();

const { t } = useI18n();

const query = ref("");
const expanded = ref<Set<number>>(new Set());

const searching = computed(() => query.value.trim().length > 0);

interface RegionView {
  region: UzexRegion;
  districts: UzexDistrict[];
}

// Qidiruvda viloyat nomi mos kelsa hamma tumani, aks holda faqat mos tumanlar.
const visible = computed<RegionView[]>(() => {
  const q = query.value.trim();
  if (!q)
    return props.regions.map((r) => ({ region: r, districts: r.children }));
  const out: RegionView[] = [];
  for (const r of props.regions) {
    if (matchesQuery(r.name, q)) {
      out.push({ region: r, districts: r.children });
      continue;
    }
    const districts = r.children.filter((d) => matchesQuery(d.name, q));
    if (districts.length) out.push({ region: r, districts });
  }
  return out;
});

const selCount = (regionId: number) => props.modelValue[regionId]?.length ?? 0;

const selRegionsCount = computed(
  () => Object.values(props.modelValue).filter((ids) => ids.length > 0).length,
);
const selDistrictsCount = computed(() =>
  Object.values(props.modelValue).reduce((sum, ids) => sum + ids.length, 0),
);
const totalDistricts = computed(() =>
  props.regions.reduce((sum, r) => sum + r.children.length, 0),
);
const allSelected = computed(
  () =>
    totalDistricts.value > 0 &&
    selDistrictsCount.value === totalDistricts.value,
);

type RegionState = "all" | "part" | "none";

function regionState(r: UzexRegion): RegionState {
  const n = selCount(r.id);
  if (n === 0) return "none";
  return n === r.children.length ? "all" : "part";
}

function patch(regionId: number, ids: number[]) {
  const next = { ...props.modelValue };
  if (ids.length) next[regionId] = ids;
  else delete next[regionId];
  emit("update:modelValue", next);
}

function toggleRegionAll(r: UzexRegion) {
  patch(r.id, regionState(r) === "all" ? [] : r.children.map((d) => d.id));
}

function toggleDistrict(r: UzexRegion, d: UzexDistrict) {
  const cur = props.modelValue[r.id] ?? [];
  patch(
    r.id,
    cur.includes(d.id) ? cur.filter((x) => x !== d.id) : [...cur, d.id],
  );
}

const isChecked = (r: UzexRegion, d: UzexDistrict) =>
  (props.modelValue[r.id] ?? []).includes(d.id);

function toggleExpand(id: number) {
  const s = new Set(expanded.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  expanded.value = s;
}

// Qidiruv paytida mos kartalar ochiq turadi.
const isExpanded = (id: number) => searching.value || expanded.value.has(id);

function toggleMaster() {
  if (allSelected.value) {
    emit("update:modelValue", {});
    return;
  }
  const next: Record<number, number[]> = {};
  for (const r of props.regions) next[r.id] = r.children.map((d) => d.id);
  emit("update:modelValue", next);
}
</script>

<template>
  <div>
    <div class="rp-toolbar">
      <button
        type="button"
        :class="['all-toggle', { on: allSelected }]"
        @click="toggleMaster"
      >
        <span :class="['switch', { on: allSelected }]"
          ><span class="knob"
        /></span>
        <span class="at-text">{{ t("addProduct.regions.allToggle") }}</span>
      </button>
      <div class="rp-search">
        <BaseIcon name="search" />
        <input
          v-model="query"
          type="text"
          :placeholder="t('addProduct.regions.search')"
        />
      </div>
      <span class="rp-total">{{
        t("addProduct.regions.count", { n: regions.length })
      }}</span>
    </div>

    <div class="rp-list scroll">
      <div
        v-for="v in visible"
        :key="v.region.id"
        :class="['rp-card', { sel: regionState(v.region) !== 'none' }]"
      >
        <div class="rp-head" @click="toggleExpand(v.region.id)">
          <button
            type="button"
            :class="['rp-cbx', regionState(v.region)]"
            :aria-label="t('addProduct.regions.selectAllDistricts')"
            @click.stop="toggleRegionAll(v.region)"
          >
            <BaseIcon v-if="regionState(v.region) === 'all'" name="check" />
            <span
              v-else-if="regionState(v.region) === 'part'"
              class="rp-dash"
            />
          </button>
          <span class="rp-name">{{ v.region.name }}</span>
          <span v-if="selCount(v.region.id)" class="rp-badge">
            {{ selCount(v.region.id) }}/{{ v.region.children.length }}
          </span>
          <span class="rp-count">{{
            t("addProduct.districtsCount", { n: v.region.children.length })
          }}</span>
          <BaseIcon
            name="chevronDown"
            :class="['rp-chevron', { open: isExpanded(v.region.id) }]"
          />
        </div>

        <div v-if="isExpanded(v.region.id)" class="rp-panel">
          <div class="rp-panel-head">
            <button
              type="button"
              :class="['rp-cbx', 'sm', regionState(v.region)]"
              :aria-label="t('addProduct.regions.selectAllDistricts')"
              @click="toggleRegionAll(v.region)"
            >
              <BaseIcon v-if="regionState(v.region) === 'all'" name="check" />
              <span
                v-else-if="regionState(v.region) === 'part'"
                class="rp-dash"
              />
            </button>
            <span class="rp-selall" @click="toggleRegionAll(v.region)">{{
              t("addProduct.regions.selectAllDistricts")
            }}</span>
            <span class="rp-count">
              {{ selCount(v.region.id) }}/{{ v.region.children.length }}
            </span>
          </div>
          <div class="rp-grid">
            <button
              v-for="d in v.districts"
              :key="d.id"
              type="button"
              :class="['rp-d', { on: isChecked(v.region, d) }]"
              @click="toggleDistrict(v.region, d)"
            >
              <span :class="['rp-cbx', 'sm', { all: isChecked(v.region, d) }]">
                <BaseIcon v-if="isChecked(v.region, d)" name="check" />
              </span>
              <span class="rp-d-name">{{ d.name }}</span>
            </button>
          </div>
        </div>
      </div>

      <div v-if="visible.length === 0" class="rp-empty">
        {{ t("addProduct.regions.noResults") }}
      </div>
    </div>

    <div class="rp-footer">
      <span class="rp-summary">{{
        t("addProduct.regions.summary", {
          r: selRegionsCount,
          d: selDistrictsCount,
        })
      }}</span>
      <button
        v-if="selDistrictsCount > 0"
        type="button"
        class="rp-clear"
        @click="emit('update:modelValue', {})"
      >
        {{ t("addProduct.regions.clear") }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.rp-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.rp-toolbar .all-toggle {
  margin: 0;
  flex-shrink: 0;
}
.rp-search {
  position: relative;
  flex: 1;
  min-width: 180px;
}
.rp-search :deep(svg) {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  color: var(--ink-4);
  pointer-events: none;
}
.rp-search input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px 8px 32px;
  font: inherit;
  font-size: 13px;
  background: var(--surface);
}
.rp-search input:focus {
  outline: none;
  border-color: var(--accent);
}
.rp-total {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-4);
  white-space: nowrap;
}

.rp-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 420px;
  overflow-y: auto;
}
.rp-card {
  border: 1px solid var(--border);
  border-radius: 11px;
  background: var(--surface);
  flex-shrink: 0;
  transition: border-color 0.15s;
}
.rp-card.sel {
  border-color: var(--accent);
}
.rp-head {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 11px 13px;
  cursor: pointer;
  user-select: none;
}
.rp-name {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rp-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-ink);
  background: var(--accent-soft);
  padding: 2.5px 7px;
  border-radius: 6px;
  white-space: nowrap;
  flex-shrink: 0;
}
.rp-count {
  font-size: 11px;
  color: var(--ink-4);
  white-space: nowrap;
  flex-shrink: 0;
}
.rp-chevron {
  width: 15px;
  height: 15px;
  color: var(--ink-4);
  transition: transform 0.18s;
  flex-shrink: 0;
}
.rp-chevron.open {
  transform: rotate(180deg);
}

.rp-cbx {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 5px;
  border: 1.5px solid var(--border-2);
  background: var(--surface);
  display: grid;
  place-items: center;
  color: #fff;
  cursor: pointer;
  padding: 0;
}
.rp-cbx.all,
.rp-cbx.part {
  background: var(--accent);
  border-color: var(--accent);
}
.rp-cbx.sm {
  width: 16px;
  height: 16px;
  border-radius: 4px;
}
.rp-cbx :deep(svg) {
  width: 12px;
  height: 12px;
}
.rp-cbx.sm :deep(svg) {
  width: 10px;
  height: 10px;
}
.rp-dash {
  width: 9px;
  height: 2.5px;
  border-radius: 2px;
  background: #fff;
}

.rp-panel {
  margin: 0 13px 13px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-2);
  padding: 10px 12px 12px;
}
.rp-panel-head {
  display: flex;
  align-items: center;
  gap: 9px;
  padding-bottom: 9px;
  margin-bottom: 9px;
  border-bottom: 1px dashed var(--border);
}
.rp-selall {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--accent-ink);
  cursor: pointer;
  user-select: none;
}
.rp-panel-head .rp-count {
  margin-left: auto;
}
.rp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 5px;
}
.rp-d {
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: 7px;
  background: none;
  padding: 6px 7px;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.rp-d:hover {
  background: var(--surface-3);
}
.rp-d.on .rp-d-name {
  font-weight: 600;
}
.rp-d-name {
  font-size: 12.5px;
  line-height: 1.25;
  color: var(--ink-2);
  min-width: 0;
}

.rp-empty {
  text-align: center;
  padding: 32px;
  font-size: 13px;
  color: var(--ink-4);
}

.rp-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.rp-summary {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink-3);
}
.rp-clear {
  margin-left: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  padding: 6px 13px;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink-3);
  cursor: pointer;
}
.rp-clear:hover {
  color: var(--ink);
  border-color: var(--border-2);
}
</style>
