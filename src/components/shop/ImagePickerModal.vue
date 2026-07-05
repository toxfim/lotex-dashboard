<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { api } from "@/lib/api";
import { useToast } from "@/composables/useToast";
import { useI18n } from "@/composables/useI18n";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import type { UzexUserFile } from "@/types/shop";

/**
 * uzex uslubidagi rasm tanlash modali: akkauntga oldin yuklangan rasmlardan
 * tanlash (qidiruv + sahifalash) yoki yangi rasm(lar) yuklash. Tanlov tartibi
 * saqlanadi — birinchi tanlangan rasm asosiy bo'ladi. Maks 10 ta (uzex limiti).
 */
const props = defineProps<{
  initial: UzexUserFile[];
}>();

const emit = defineEmits<{
  close: [];
  confirm: [files: UzexUserFile[]];
}>();

const { pushToast } = useToast();
const { t } = useI18n();

const MAX_SELECT = 10;
const PAGE = 24;

const files = ref<UzexUserFile[]>([]);
const total = ref(0);
const loading = ref(false);
const loadError = ref<string | null>(null);
const keyword = ref("");
const picked = ref<UzexUserFile[]>([...props.initial]);
const uploading = ref(false);
const uploadDone = ref(0);
const uploadTotal = ref(0);

const isPicked = (id: number) => picked.value.some((p) => p.id === id);

async function load(reset: boolean) {
  loading.value = true;
  loadError.value = null;
  try {
    const from = reset ? 1 : files.value.length + 1;
    const res = await api.getShopFiles({
      q: keyword.value.trim() || undefined,
      from,
      to: from + PAGE - 1,
    });
    files.value = reset ? res.data : [...files.value, ...res.data];
    if (res.data[0]?.total_count != null) total.value = res.data[0].total_count;
    else if (reset) total.value = res.data.length;
    if (res.error) loadError.value = res.error;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : t("common.loadError");
  } finally {
    loading.value = false;
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;
// onUpload keyword'ni dasturiy tozalaganda watcher takroriy yuklamasin
let suppressSearch = false;
watch(keyword, () => {
  if (suppressSearch) return;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => load(true), 300);
});

function toggle(f: UzexUserFile) {
  if (isPicked(f.id)) {
    picked.value = picked.value.filter((p) => p.id !== f.id);
    return;
  }
  if (picked.value.length >= MAX_SELECT) {
    pushToast({
      kind: "rej",
      title: t("addProduct.image.title"),
      sub: t("addProduct.image.limitReached", { max: MAX_SELECT }),
      undoId: "",
    });
    return;
  }
  picked.value = [...picked.value, f];
}

async function onUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  const list = Array.from(input.files ?? []);
  input.value = "";
  if (!list.length || uploading.value) return;
  uploading.value = true;
  uploadTotal.value = list.length;
  uploadDone.value = 0;
  const newIds: number[] = [];
  for (const file of list) {
    try {
      const res = await api.uploadShopImage(file);
      if (res.data.fileId) newIds.push(res.data.fileId);
      else throw new Error("fileId yo'q");
    } catch {
      pushToast({
        kind: "rej",
        title: file.name,
        sub: t("addProduct.uploadError"),
        undoId: "",
      });
    }
    uploadDone.value++;
  }
  // Yangi fayllar ro'yxat boshida (sana bo'yicha) — qidiruvni tozalab yangilaymiz
  if (searchTimer) clearTimeout(searchTimer);
  suppressSearch = true;
  keyword.value = "";
  await load(true);
  suppressSearch = false;
  // Yuklanganlarni avtomatik tanlaymiz (limit doirasida)
  for (const id of newIds) {
    const f = files.value.find((x) => x.id === id);
    if (f && !isPicked(id) && picked.value.length < MAX_SELECT)
      picked.value = [...picked.value, f];
  }
  uploading.value = false;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close");
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  void load(true);
});
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="ipm-scrim" @click="emit('close')">
    <div class="ipm" @click.stop>
      <div class="ipm-head">
        <div class="ipm-icon"><BaseIcon name="image" /></div>
        <div>
          <div class="ipm-title">{{ t("addProduct.image.modalTitle") }}</div>
          <div class="ipm-sub">
            {{ t("addProduct.image.modalSub", { max: MAX_SELECT }) }}
          </div>
        </div>
        <button class="ipm-x" type="button" @click="emit('close')">
          <BaseIcon name="x" />
        </button>
      </div>

      <div class="ipm-toolbar">
        <div class="ipm-search">
          <BaseIcon name="search" />
          <input
            v-model="keyword"
            type="text"
            :placeholder="t('addProduct.image.searchPlaceholder')"
          />
        </div>
        <label :class="['ipm-upload', { busy: uploading }]">
          <input
            type="file"
            accept="image/*"
            multiple
            style="display: none"
            :disabled="uploading"
            @change="onUpload"
          />
          <BaseIcon :name="uploading ? 'refresh' : 'plus'" />
          {{
            uploading
              ? t("addProduct.image.uploading", {
                  done: uploadDone,
                  total: uploadTotal,
                })
              : t("addProduct.image.uploadNew")
          }}
        </label>
      </div>

      <div class="ipm-body scroll">
        <div v-if="loadError" class="ipm-empty err">{{ loadError }}</div>
        <div v-else-if="loading && files.length === 0" class="ipm-empty">
          {{ t("common.loading") }}
        </div>
        <div v-else-if="files.length === 0" class="ipm-empty">
          {{ t("addProduct.image.empty") }}
        </div>
        <template v-else>
          <div class="ipm-grid">
            <button
              v-for="f in files"
              :key="f.id"
              type="button"
              :class="['ipm-item', { on: isPicked(f.id) }]"
              @click="toggle(f)"
            >
              <span class="ipm-check">
                <BaseIcon v-if="isPicked(f.id)" name="check" />
              </span>
              <span
                v-if="isPicked(f.id) && picked[0]?.id === f.id"
                class="ipm-main-badge"
                >{{ t("addProduct.image.main") }}</span
              >
              <img
                :src="api.shopFileImageUrl(f)"
                :alt="f.custom_name"
                loading="lazy"
              />
              <span class="ipm-name" :title="f.custom_name">{{
                f.custom_name
              }}</span>
              <span class="ipm-meta"
                >{{ Math.max(1, Math.round(f.file_size / 1024)) }} kb ·
                {{ f.ext.toUpperCase() }}</span
              >
            </button>
          </div>
          <button
            v-if="files.length < total"
            class="ipm-more"
            type="button"
            :disabled="loading"
            @click="load(false)"
          >
            {{ loading ? t("common.loading") : t("addProduct.image.loadMore") }}
          </button>
        </template>
      </div>

      <div class="ipm-foot">
        <span :class="['ipm-count', { full: picked.length >= MAX_SELECT }]">{{
          t("addProduct.image.selectedOf", {
            n: picked.length,
            max: MAX_SELECT,
          })
        }}</span>
        <button class="btn btn-ghost" type="button" @click="emit('close')">
          {{ t("common.cancel") }}
        </button>
        <button
          class="btn btn-accent"
          type="button"
          @click="emit('confirm', [...picked])"
        >
          <BaseIcon name="check" />
          {{ t("addProduct.image.confirm") }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ipm-scrim {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgb(23 23 27 / 0.45);
  backdrop-filter: blur(2px);
  display: grid;
  place-items: center;
  animation: scrim-in 0.18s ease;
}
.ipm {
  width: min(860px, 94vw);
  max-height: min(720px, 92vh);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
.ipm-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
}
.ipm-icon {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: var(--accent-soft);
  color: var(--accent-ink);
}
.ipm-icon :deep(svg) {
  width: 17px;
  height: 17px;
}
.ipm-title {
  font-size: 15px;
  font-weight: 700;
}
.ipm-sub {
  font-size: 12px;
  color: var(--ink-4);
  margin-top: 1px;
}
.ipm-x {
  margin-left: auto;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: none;
  border-radius: 8px;
  background: none;
  color: var(--ink-3);
  display: grid;
  place-items: center;
  cursor: pointer;
}
.ipm-x:hover {
  background: var(--surface-2);
}
.ipm-x :deep(svg) {
  width: 16px;
  height: 16px;
}
.ipm-toolbar {
  display: flex;
  gap: 10px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--border);
}
.ipm-search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0 12px;
  background: var(--surface);
}
.ipm-search:focus-within {
  border-color: var(--accent);
}
.ipm-search :deep(svg) {
  width: 15px;
  height: 15px;
  color: var(--ink-4);
  flex-shrink: 0;
}
.ipm-search input {
  flex: 1;
  border: none;
  outline: none;
  background: none;
  font: inherit;
  font-size: 13.5px;
  padding: 9px 0;
}
.ipm-upload {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1.5px dashed var(--border-2);
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 700;
  color: var(--accent-ink);
  cursor: pointer;
  white-space: nowrap;
}
.ipm-upload:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.ipm-upload.busy {
  cursor: progress;
  color: var(--ink-3);
}
.ipm-upload :deep(svg) {
  width: 15px;
  height: 15px;
}
.ipm-body {
  flex: 1;
  min-height: 260px;
  overflow-y: auto;
  padding: 16px 18px;
}
.ipm-empty {
  min-height: 220px;
  display: grid;
  place-items: center;
  font-size: 13px;
  color: var(--ink-4);
}
.ipm-empty.err {
  color: var(--warn-ink);
}
.ipm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 12px;
}
.ipm-item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  padding: 8px;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.12s,
    box-shadow 0.12s;
}
.ipm-item:hover {
  border-color: var(--border-2);
}
.ipm-item.on {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.ipm-item img {
  width: 100%;
  height: 96px;
  object-fit: contain;
  border-radius: 8px;
  background: var(--surface-2);
}
.ipm-check {
  position: absolute;
  top: 14px;
  left: 14px;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 1.5px solid var(--border-2);
  background: var(--surface);
  display: grid;
  place-items: center;
  color: #fff;
  z-index: 1;
}
.ipm-item.on .ipm-check {
  background: var(--accent);
  border-color: var(--accent);
}
.ipm-check :deep(svg) {
  width: 13px;
  height: 13px;
}
.ipm-main-badge {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 1;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
}
.ipm-name {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ipm-meta {
  font-size: 10.5px;
  color: var(--ink-4);
}
.ipm-more {
  display: block;
  margin: 16px auto 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  padding: 8px 20px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-2);
  cursor: pointer;
}
.ipm-more:hover {
  background: var(--surface-2);
}
.ipm-more:disabled {
  opacity: 0.6;
  cursor: default;
}
.ipm-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 18px;
  border-top: 1px solid var(--border);
}
.ipm-count {
  margin-right: auto;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--ink-3);
}
.ipm-count.full {
  color: var(--warn-ink);
}
</style>
