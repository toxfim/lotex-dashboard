<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useSupplierStore } from "@/stores/suppliers";
import { useMatchRunner } from "@/composables/useMatchRunner";
import { useI18n } from "@/composables/useI18n";
import { api } from "@/lib/api";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import BaseSelect from "@/components/shared/BaseSelect.vue";
import EmptyState from "@/components/shared/EmptyState.vue";
import TopbarSettings from "@/components/layout/TopbarSettings.vue";
import { fmtNum } from "@/lib/formatters";
import type {
  ApiSupplier,
  ApiSupplierProductWithSupplier,
  CurrencyType,
  SupplierMappingSpec,
  SupplierUploadResult,
  WorkbookPreview,
} from "@/types/supplier";

const store = useSupplierStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const CURRENCY_OPTS = computed(() => [
  { v: "USD", l: "USD ($)" },
  { v: "UZS", l: `UZS (${t("currency.som")})` },
]);

const PRODUCTS_PAGE_SIZE = 50;

// --- tab holati route'dan olinadi: /supplies → tovarlar, /suppliers → ta'minotchilar ---
const tab = computed<"suppliers" | "products">(() =>
  route.path === "/supplies" ? "products" : "suppliers",
);

// --- ta'minotchi qo'shish/tahrirlash modal'i (bitta forma, ikkala rejim uchun) ---
type FormMode = "add" | "edit";
const formOpen = ref(false);
const formMode = ref<FormMode>("add");
const formBusy = ref(false);
const formError = ref<string | null>(null);
const editId = ref<string | null>(null);
const form = reactive({
  name: "",
  inn: "",
  phone: "",
  email: "",
  note: "",
});

// --- Excel yuklash modal'i (bitta supplierga ta'minot biriktirish) ---
const uploadOpen = ref(false);
const uploadTarget = ref<ApiSupplier | null>(null);
const uploadBusy = ref(false);
const dragOver = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const importNote = ref<{ kind: "ok" | "err"; text: string } | null>(null);

// --- mapping tasdiqlash modal'i ---
interface EditBlock {
  nameCol: string;
  modelCol: string;
  costCol: string;
  retailCol: string;
  categoryCol: string;
  skip: boolean;
}
interface EditSheet {
  sheet: string;
  skip: boolean;
  dataStartRow: number;
  categoryFromSheetName: boolean;
  blocks: EditBlock[];
}
const mapping = reactive<{
  uploadId: string;
  currency: CurrencyType;
  sheets: EditSheet[];
}>({ uploadId: "", currency: "USD", sheets: [] });
const mappingOpen = ref(false);
const mappingBusy = ref(false);
const mappingError = ref<string | null>(null);
const mappingPreview = ref<WorkbookPreview | null>(null);

// --- o'chirish tasdiq dialogi ---
const deleteTarget = ref<ApiSupplier | null>(null);
const deleteBusy = ref(false);

// --- "Hozir match qil" / "Qayta match" (umumiy composable) ---
const { matchBusy, matchNote, runMatchNow, rematchUnmatched } =
  useMatchRunner();

// --- "Barcha tovarlar" jadvali (global supplies) ---
const products = ref<ApiSupplierProductWithSupplier[]>([]);
const productsTotal = ref(0);
const productsPage = ref(1);
const productsLoading = ref(false);
const productsError = ref<string | null>(null);
const categories = ref<string[]>([]);

// Filtrlar URL query'dan keladi (manba — route): /supplies?supplier=&category=&q=
const filterSupplierId = computed(() => (route.query.supplier as string) || "");
const filterCategory = computed(() => (route.query.category as string) || "");
const filterSearch = computed(() => (route.query.q as string) || "");
// search input lokal model — yozish paytida URL o'zgartirilmaydi, Enter'da yoziladi
const searchInput = ref("");

const stats = computed(() => ({
  total: store.count,
  products: store.productTotal,
  uploads: store.uploadTotal,
}));

const productsShown = computed(() => products.value.length);
const hasMoreProducts = computed(
  () => productsShown.value < productsTotal.value,
);

const supplierOptions = computed(() => [
  { v: "", l: t("suppliers.filter.all") },
  ...store.items.map((s) => ({ v: s.id, l: s.name })),
]);
const categoryOptions = computed(() => [
  { v: "", l: t("lots.filter.allCategories") },
  ...categories.value.map((c) => ({ v: c, l: c })),
]);

const activeSupplierName = computed(
  () => store.items.find((s) => s.id === filterSupplierId.value)?.name ?? null,
);

const formValid = computed(() => !!form.name.trim());

/** Filtrlarni URL query orqali yangilaydi (manba — route). Bo'sh qiymatlar olib tashlanadi. */
function updateQuery(patch: {
  supplier?: string;
  category?: string;
  q?: string;
}) {
  const next = {
    supplier: patch.supplier ?? filterSupplierId.value,
    category: patch.category ?? filterCategory.value,
    q: patch.q ?? filterSearch.value,
  };
  const query: Record<string, string> = {};
  if (next.supplier) query.supplier = next.supplier;
  if (next.category) query.category = next.category;
  if (next.q) query.q = next.q;
  router.push({ path: "/supplies", query });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}

function fmtPrice(value: number | null, currency: CurrencyType): string {
  if (value === null || value === undefined) return "—";
  return `${fmtNum(value)} ${currency === "USD" ? "$" : t("currency.som")}`;
}

/** Ustun indeksi → harf: 0→A, 25→Z, 26→AA. */
function colLetter(i: number): string {
  let n = i;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

// ----------------------------------------------------- ta'minotchi qo'shish/tahrir
function openAdd() {
  formMode.value = "add";
  editId.value = null;
  formError.value = null;
  form.name = "";
  form.inn = "";
  form.phone = "";
  form.email = "";
  form.note = "";
  formOpen.value = true;
}

function openEdit(s: ApiSupplier) {
  formMode.value = "edit";
  editId.value = s.id;
  formError.value = null;
  form.name = s.name ?? "";
  form.inn = s.inn ?? "";
  form.phone = s.phone ?? "";
  form.email = s.email ?? "";
  form.note = s.note ?? "";
  formOpen.value = true;
}

async function handleFormSubmit() {
  if (!formValid.value || formBusy.value) return;
  formBusy.value = true;
  formError.value = null;
  const payload = {
    name: form.name.trim(),
    inn: form.inn.trim() || null,
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    note: form.note.trim() || null,
  };
  try {
    if (formMode.value === "add") {
      const created = await store.create(payload);
      formOpen.value = false;
      // Yangi qo'shilgan ta'minotchiga darhol Excel yuklashni taklif qilamiz
      openUpload(created);
    } else if (editId.value) {
      await store.update(editId.value, payload);
      formOpen.value = false;
    }
  } catch (e) {
    formError.value = e instanceof Error ? e.message : t("common.saveError");
  } finally {
    formBusy.value = false;
  }
}

// --------------------------------------------------------------- Excel yuklash
function openUpload(s: ApiSupplier) {
  uploadTarget.value = s;
  importNote.value = null;
  uploadOpen.value = true;
}

function pickFile() {
  fileInput.value?.click();
}

function handleFileInput(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) handleUpload(file);
  input.value = "";
}

function handleDrop(e: DragEvent) {
  dragOver.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) handleUpload(file);
}

async function handleUpload(file: File) {
  const target = uploadTarget.value;
  if (!target || uploadBusy.value) return;
  uploadBusy.value = true;
  importNote.value = null;
  try {
    const res = await api.uploadSupplierFile(target.id, file);
    await applyUploadResult(res.data);
  } catch (e) {
    importNote.value = {
      kind: "err",
      text: e instanceof Error ? e.message : t("suppliers.upload.fileError"),
    };
  } finally {
    uploadBusy.value = false;
  }
}

async function applyUploadResult(result: SupplierUploadResult) {
  const target = uploadTarget.value;
  if (result.status === "parsed") {
    importNote.value = {
      kind: "ok",
      text: `${t("suppliers.upload.parsedCount", { n: result.rowsParsed })}${
        result.autoMapped ? t("suppliers.upload.savedTemplate") : ""
      }${
        result.replaced
          ? t("suppliers.upload.replaced", { n: result.replaced })
          : ""
      }.`,
    };
    if (target) await store.refreshOne(target.id);
    await afterProductsChanged();
    return;
  }
  // pending_mapping — operator tasdig'i kerak: yuklash modalini yopib mapping modalini ochamiz
  mapping.uploadId = result.uploadId;
  mapping.currency = result.proposedMapping.currency;
  mapping.sheets = result.proposedMapping.sheets.map((s) => ({
    sheet: s.sheet,
    skip: s.skip ?? false,
    dataStartRow: s.dataStartRow,
    categoryFromSheetName: s.categoryFromSheetName ?? false,
    blocks: (s.blocks ?? []).map((b) => ({
      nameCol: b.nameCol ?? "",
      modelCol: b.modelCol ?? "",
      costCol: b.costCol ?? "",
      retailCol: b.retailCol ?? "",
      categoryCol: b.categoryCol ?? "",
      skip: b.skip ?? false,
    })),
  }));
  mappingPreview.value = result.preview;
  mappingError.value = null;
  uploadOpen.value = false;
  mappingOpen.value = true;
}

function previewForSheet(name: string) {
  return mappingPreview.value?.sheets.find((s) => s.sheet === name) ?? null;
}

function buildSpec(): SupplierMappingSpec {
  const blank = (v: string) => {
    const t = v.trim().toUpperCase();
    return t ? t : undefined;
  };
  return {
    currency: mapping.currency,
    sheets: mapping.sheets.map((s) => ({
      sheet: s.sheet,
      skip: s.skip || undefined,
      dataStartRow: s.dataStartRow,
      categoryFromSheetName: s.categoryFromSheetName || undefined,
      blocks: s.blocks.map((b) => ({
        nameCol: b.nameCol.trim().toUpperCase(),
        modelCol: blank(b.modelCol),
        costCol: blank(b.costCol),
        retailCol: blank(b.retailCol),
        categoryCol: blank(b.categoryCol),
        skip: b.skip || undefined,
      })),
    })),
  };
}

const mappingValid = computed(() =>
  mapping.sheets.some(
    (s) => !s.skip && s.blocks.some((b) => !b.skip && b.nameCol.trim()),
  ),
);

async function handleConfirmMapping() {
  if (!mappingValid.value || mappingBusy.value) return;
  mappingBusy.value = true;
  mappingError.value = null;
  try {
    const res = await api.confirmSupplierMapping(mapping.uploadId, buildSpec());
    mappingOpen.value = false;
    const target = uploadTarget.value;
    importNote.value = {
      kind: "ok",
      text: `${t("suppliers.upload.parsedCount", { n: res.data.rowsParsed })}${
        res.data.replaced
          ? t("suppliers.upload.replaced", { n: res.data.replaced })
          : ""
      }.${t("suppliers.mapping.confirmedSuffix")}`,
    };
    if (target) await store.refreshOne(target.id);
    await afterProductsChanged();
  } catch (e) {
    mappingError.value =
      e instanceof Error ? e.message : t("suppliers.mapping.confirmError");
  } finally {
    mappingBusy.value = false;
  }
}

// ------------------------------------------------------------------ o'chirish
async function handleDelete() {
  if (!deleteTarget.value || deleteBusy.value) return;
  deleteBusy.value = true;
  try {
    const removedId = deleteTarget.value.id;
    await store.remove(removedId);
    // O'chirilgan ta'minotchi filtrda bo'lsa — filtrni tozalaymiz
    if (filterSupplierId.value === removedId) updateQuery({ supplier: "" });
    deleteTarget.value = null;
  } catch (e) {
    store.error = e instanceof Error ? e.message : t("suppliers.deleteError");
  } finally {
    deleteBusy.value = false;
  }
}

// ------------------------------------------------------ "Barcha tovarlar" jadvali
async function loadProducts(reset = false) {
  if (productsLoading.value) return;
  if (reset) productsPage.value = 1;
  productsLoading.value = true;
  productsError.value = null;
  try {
    const res = await api.getAllSupplierProducts({
      page: productsPage.value,
      limit: PRODUCTS_PAGE_SIZE,
      search: filterSearch.value.trim() || undefined,
      supplierId: filterSupplierId.value || undefined,
      category: filterCategory.value || undefined,
    });
    products.value = reset ? res.data : [...products.value, ...res.data];
    productsTotal.value = res.meta.total;
  } catch (e) {
    productsError.value =
      e instanceof Error ? e.message : t("suppliers.products.loadError");
  } finally {
    productsLoading.value = false;
  }
}

function loadMoreProducts() {
  productsPage.value += 1;
  loadProducts(false);
}

// --- tovar yuklangan Excel faylni yuklab olish (auth header bilan blob) ---
const downloadingUploadId = ref<string | null>(null);

async function downloadUploadFile(p: ApiSupplierProductWithSupplier) {
  if (!p.upload || downloadingUploadId.value) return;
  downloadingUploadId.value = p.upload.id;
  try {
    const blob = await api.downloadSupplierUploadFile(p.upload.id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = p.upload.fileName;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    productsError.value =
      e instanceof Error ? e.message : t("suppliers.products.loadError");
  } finally {
    downloadingUploadId.value = null;
  }
}

async function loadCategories() {
  try {
    const res = await api.getSupplierCategories(
      filterSupplierId.value || undefined,
    );
    categories.value = res.data;
    // Joriy kategoriya filtri yangi ro'yxatda yo'q bo'lsa — URL'dan olib tashlaymiz
    if (
      filterCategory.value &&
      !categories.value.includes(filterCategory.value)
    ) {
      updateQuery({ category: "" });
    }
  } catch {
    categories.value = [];
  }
}

/** Upload/parse'dan keyin ko'rinayotgan tovarlar jadvalini va kategoriyalarni yangilash. */
async function afterProductsChanged() {
  if (tab.value === "products") {
    await Promise.all([loadProducts(true), loadCategories()]);
  }
}

/** Ta'minotchilar jadvalida qatorga bosish — /supplies?supplier=<id> ga o'tadi. */
function openSupplierProducts(s: ApiSupplier) {
  router.push({ path: "/supplies", query: { supplier: s.id } });
}

function clearFilters() {
  searchInput.value = "";
  router.push({ path: "/supplies", query: {} });
}

function submitSearch() {
  updateQuery({ q: searchInput.value.trim() });
}

// Route (tab yoki filtr) o'zgarganda tovarlar jadvalini qayta yuklaymiz.
watch(
  () => [route.path, route.query.supplier, route.query.category, route.query.q],
  () => {
    if (tab.value !== "products") return;
    searchInput.value = filterSearch.value; // input'ni URL bilan moslaymiz
    loadCategories();
    loadProducts(true);
  },
  { immediate: true },
);

onMounted(() => {
  store.ensureLoaded();
});
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div>
        <h1>{{ t("suppliers.title") }}</h1>
        <div class="crumb-sub">{{ t("suppliers.subtitle") }}</div>
      </div>
      <div class="topbar-right">
        <button
          class="btn btn-ghost"
          :disabled="matchBusy"
          :title="t('queue.matchNow.title')"
          @click="runMatchNow"
        >
          <BaseIcon name="cpu" />{{
            matchBusy ? t("queue.matching") : t("queue.matchNow")
          }}
        </button>
        <button
          class="btn btn-ghost"
          :disabled="matchBusy"
          :title="t('queue.rematch.title')"
          @click="rematchUnmatched"
        >
          <BaseIcon name="refresh" />{{ t("queue.rematch") }}
        </button>
        <button class="btn btn-add" @click="openAdd">
          <BaseIcon name="plus" />{{ t("suppliers.add") }}
        </button>
        <TopbarSettings />
      </div>
    </header>

    <div class="page-scroll scroll">
      <div class="page-inner fade-page">
        <div class="integ-banner">
          <div class="ib-icon"><BaseIcon name="package" /></div>
          <div class="ib-main">
            <div class="ib-title">{{ t("suppliers.banner.title") }}</div>
            <div class="ib-sub">
              {{ t("suppliers.banner.sub") }}
            </div>
          </div>
          <div class="ib-stats">
            <div class="ibs">
              <b class="num">{{ stats.total }}</b
              ><span>{{ t("supplierModal.eyebrow") }}</span>
            </div>
            <div class="ibs">
              <b class="num">{{ fmtNum(stats.products) }}</b
              ><span>{{ t("shop.col.product") }}</span>
            </div>
            <div class="ibs">
              <b class="num">{{ stats.uploads }}</b
              ><span>{{ t("suppliers.upload.label") }}</span>
            </div>
          </div>
        </div>

        <!-- "Hozir match qil" holati -->
        <div
          v-if="matchNote"
          class="import-note"
          :class="matchNote.kind"
          style="margin-top: 16px"
        >
          <BaseIcon :name="matchNote.kind === 'ok' ? 'cpu' : 'alert'" />
          {{ matchNote.text }}
          <button class="import-x" @click="matchNote = null">
            <BaseIcon name="x" />
          </button>
        </div>

        <!-- Tab almashtirgich (route bilan: /suppliers ↔ /supplies) -->
        <div class="seg" style="margin-top: 22px">
          <button
            class="seg-btn"
            :class="{ on: tab === 'suppliers' }"
            @click="router.push('/suppliers')"
          >
            <BaseIcon name="package" />{{ t("suppliers.tab.suppliers") }}
            <span class="count-pill">{{ stats.total }}</span>
          </button>
          <button
            class="seg-btn"
            :class="{ on: tab === 'products' }"
            @click="router.push('/supplies')"
          >
            <BaseIcon name="box" />{{ t("suppliers.tab.allProducts") }}
            <span class="count-pill">{{ fmtNum(stats.products) }}</span>
          </button>
        </div>

        <!-- ============================ TAB: TA'MINOTCHILAR ============================ -->
        <template v-if="tab === 'suppliers'">
          <div
            v-if="store.loading && !store.loaded"
            class="panel"
            style="
              margin-top: 18px;
              padding: 40px;
              text-align: center;
              color: var(--ink-3);
            "
          >
            {{ t("common.loading") }}
          </div>

          <div
            v-else-if="store.error && !store.loaded"
            style="margin-top: 18px"
          >
            <EmptyState
              icon="alert"
              :title="t('common.loadError')"
              :description="store.error"
            />
          </div>

          <div v-else-if="store.count === 0" style="margin-top: 18px">
            <EmptyState
              icon="package"
              :title="t('suppliers.empty.title')"
              :description="t('suppliers.empty.desc')"
            />
          </div>

          <div v-else class="dt-wrap" style="margin-top: 18px">
            <table class="dt set-dt">
              <thead>
                <tr>
                  <th>Ta'minotchi</th>
                  <th>Aloqa</th>
                  <th class="r">Tovarlar</th>
                  <th class="r">Yuklamalar</th>
                  <th class="r">Amallar</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="s in store.items"
                  :key="s.id"
                  style="cursor: pointer"
                  @click="openSupplierProducts(s)"
                >
                  <td>
                    <div class="cell-prod">
                      <div class="ent-av">{{ initials(s.name) }}</div>
                      <div style="min-width: 0">
                        <div class="c-title">
                          {{ s.name }}
                          <span v-if="s.inn" class="count-pill"
                            >INN {{ s.inn }}</span
                          >
                        </div>
                        <div class="c-sub">{{ s.note || "—" }}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="sup-contact">
                      <span v-if="s.phone"
                        ><BaseIcon name="inbox" />{{ s.phone }}</span
                      >
                      <span v-if="s.email"
                        ><BaseIcon name="doc" />{{ s.email }}</span
                      >
                      <span v-if="!s.phone && !s.email" class="set-dir">—</span>
                    </div>
                  </td>
                  <td class="r">
                    <span class="count-pill num">{{
                      fmtNum(s._count.products)
                    }}</span>
                  </td>
                  <td class="r">
                    <span class="count-pill num">{{ s._count.uploads }}</span>
                  </td>
                  <td class="r" @click.stop>
                    <div class="row-actions">
                      <button
                        class="act-btn"
                        title="Excel narx-ro'yxati yuklash"
                        @click="openUpload(s)"
                      >
                        <BaseIcon name="doc" />
                      </button>
                      <button
                        class="act-btn"
                        title="Tahrirlash"
                        @click="openEdit(s)"
                      >
                        <BaseIcon name="building" />
                      </button>
                      <button
                        class="act-btn danger"
                        title="O'chirish"
                        @click="deleteTarget = s"
                      >
                        <BaseIcon name="trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- ============================ TAB: BARCHA TOVARLAR ============================ -->
        <template v-else>
          <!-- filtrlar -->
          <div class="filters-bar" style="margin-top: 18px">
            <div class="search-box">
              <BaseIcon name="search" />
              <input
                v-model="searchInput"
                class="text-input"
                placeholder="Nom yoki model bo'yicha qidirish… (Enter)"
                @keyup.enter="submitSearch"
              />
            </div>
            <div style="min-width: 220px">
              <BaseSelect
                :model-value="filterSupplierId"
                :options="supplierOptions"
                @update:model-value="(v) => updateQuery({ supplier: v })"
              />
            </div>
            <div style="min-width: 200px">
              <BaseSelect
                :model-value="filterCategory"
                :options="categoryOptions"
                @update:model-value="(v) => updateQuery({ category: v })"
              />
            </div>
            <button
              v-if="filterSupplierId || filterCategory || filterSearch"
              class="btn btn-ghost"
              @click="clearFilters"
            >
              <BaseIcon name="x" />Tozalash
            </button>
          </div>

          <div
            v-if="activeSupplierName"
            class="active-filter-note"
            style="margin-top: 10px"
          >
            <BaseIcon name="package" />
            <b>{{ activeSupplierName }}</b> tovarlari ko'rsatilmoqda
          </div>

          <div
            v-if="productsError"
            class="import-note err"
            style="margin-top: 12px"
          >
            <BaseIcon name="alert" />{{ productsError }}
          </div>

          <!-- jadval -->
          <div
            v-if="productsShown > 0"
            class="dt-wrap"
            style="margin-top: 14px"
          >
            <table class="dt">
              <thead>
                <tr>
                  <th>Nomi</th>
                  <th>Ta'minotchi</th>
                  <th>Model</th>
                  <th>Kategoriya</th>
                  <th>Excel</th>
                  <th class="r">Tan narx</th>
                  <th class="r">Sotuv</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in products" :key="p.id">
                  <td>{{ p.name }}</td>
                  <td>
                    <button
                      class="link-cell"
                      @click="updateQuery({ supplier: p.supplier.id })"
                    >
                      {{ p.supplier.name }}
                    </button>
                  </td>
                  <td>{{ p.model || "—" }}</td>
                  <td>
                    <span v-if="p.category" class="count-pill">{{
                      p.category
                    }}</span>
                    <span v-else>—</span>
                  </td>
                  <td>
                    <button
                      v-if="p.upload"
                      class="xls-chip"
                      :disabled="downloadingUploadId === p.upload.id"
                      :title="`${p.upload.fileName} — yuklab olish`"
                      @click="downloadUploadFile(p)"
                    >
                      <BaseIcon name="download" />
                      {{ p.upload.code ?? p.upload.id.slice(0, 8) }}
                    </button>
                    <span v-else>—</span>
                  </td>
                  <td class="r num">{{ fmtPrice(p.costPrice, p.currency) }}</td>
                  <td class="r num">
                    {{ fmtPrice(p.retailPrice, p.currency) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            v-else-if="productsLoading"
            class="panel"
            style="
              margin-top: 14px;
              padding: 36px;
              text-align: center;
              color: var(--ink-3);
            "
          >
            {{ t("common.loading") }}
          </div>

          <div v-else style="margin-top: 14px">
            <EmptyState
              icon="box"
              title="Tovar topilmadi"
              description="Filtrlarni o'zgartiring yoki ta'minotchiga Excel narx-ro'yxatini yuklang."
            />
          </div>

          <!-- pastki qator: hisob + yana yuklash -->
          <div v-if="productsShown > 0" class="products-foot">
            <span class="foot-count"
              >{{ fmtNum(productsShown) }} /
              {{ fmtNum(productsTotal) }} tovar</span
            >
            <button
              v-if="hasMoreProducts"
              class="btn btn-ghost"
              :disabled="productsLoading"
              @click="loadMoreProducts"
            >
              {{ productsLoading ? "Yuklanmoqda…" : "Yana yuklash" }}
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- ===== Add/Edit ta'minotchi modal ===== -->
    <template v-if="formOpen">
      <div class="modal-scrim" @click="formOpen = false">
        <div class="modal" @click.stop>
          <div class="modal-top">
            <span class="mt-eyebrow">{{
              formMode === "add"
                ? "Yangi ta'minotchi"
                : "Ta'minotchini tahrirlash"
            }}</span>
            <button class="icon-btn modal-x" @click="formOpen = false">
              <BaseIcon name="x" />
            </button>
          </div>
          <div class="modal-body scroll">
            <div class="drawer-hero">
              <div class="ent-av lg">
                {{ form.name.trim() ? initials(form.name) : "?" }}
              </div>
              <div>
                <div class="dh-name">
                  {{ form.name.trim() || "Ta'minotchi nomi" }}
                </div>
                <div class="dh-sub">
                  {{ form.inn.trim() ? "INN " + form.inn : "INN kiritilmagan" }}
                </div>
              </div>
            </div>

            <div class="set-group">
              <div class="fg-head">
                <div class="fg-icon"><BaseIcon name="building" /></div>
                <div class="fg-title">Ta'minotchi ma'lumotlari</div>
              </div>
              <div class="set-fields">
                <div class="fld full">
                  <label class="fld-label"
                    >Nomi <span class="fg-badge req">majburiy</span></label
                  >
                  <input
                    v-model="form.name"
                    class="text-input"
                    placeholder="masalan: Age Distribution"
                  />
                </div>
                <div class="fld">
                  <label class="fld-label">INN</label>
                  <input
                    v-model="form.inn"
                    class="text-input"
                    inputmode="numeric"
                    placeholder="000 000 000"
                  />
                </div>
                <div class="fld">
                  <label class="fld-label">Telefon</label>
                  <input
                    v-model="form.phone"
                    class="text-input"
                    placeholder="+998 90 000 00 00"
                  />
                </div>
                <div class="fld full">
                  <label class="fld-label">Email</label>
                  <input
                    v-model="form.email"
                    class="text-input"
                    placeholder="sales@example.uz"
                  />
                </div>
                <div class="fld full">
                  <label class="fld-label">Izoh</label>
                  <textarea
                    v-model="form.note"
                    class="form-textarea"
                    rows="3"
                    placeholder="Ixtiyoriy eslatma"
                  />
                </div>
              </div>
            </div>

            <p v-if="formError" class="form-err">{{ formError }}</p>
          </div>
          <div class="drawer-foot">
            <div class="sidebar-spacer" />
            <button class="btn btn-ghost" @click="formOpen = false">
              Bekor qilish
            </button>
            <button
              class="btn btn-accent"
              :disabled="!formValid || formBusy"
              @click="handleFormSubmit"
            >
              {{
                formBusy
                  ? "Saqlanmoqda…"
                  : formMode === "add"
                    ? "Qo'shish"
                    : "Saqlash"
              }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- ===== Excel yuklash modal ===== -->
    <template v-if="uploadOpen">
      <div class="modal-scrim" @click="uploadOpen = false">
        <div class="modal" @click.stop>
          <div class="modal-top">
            <span class="mt-eyebrow"
              >Narx-ro'yxati — {{ uploadTarget?.name }}</span
            >
            <button class="icon-btn modal-x" @click="uploadOpen = false">
              <BaseIcon name="x" />
            </button>
          </div>
          <div class="modal-body scroll">
            <input
              ref="fileInput"
              type="file"
              accept=".xlsx,.xls"
              hidden
              @change="handleFileInput"
            />
            <div
              class="excel-bar"
              :class="{ drag: dragOver }"
              @dragover.prevent="dragOver = true"
              @dragleave.prevent="dragOver = false"
              @drop.prevent="handleDrop"
            >
              <div class="excel-bar-main">
                <div class="excel-ic"><BaseIcon name="doc" /></div>
                <div>
                  <div class="excel-title">.xlsx faylni shu yerga tashlang</div>
                  <div class="excel-sub">
                    Bir manbani qayta yuklash o'sha tovarlarni almashtiradi
                  </div>
                </div>
              </div>
              <div class="excel-actions">
                <button
                  class="btn btn-accent"
                  :disabled="uploadBusy"
                  @click="pickFile"
                >
                  {{ uploadBusy ? "Yuklanmoqda…" : "Fayl tanlash" }}
                </button>
              </div>
            </div>

            <div v-if="importNote" class="import-note" :class="importNote.kind">
              <BaseIcon :name="importNote.kind === 'ok' ? 'check' : 'alert'" />
              {{ importNote.text }}
            </div>
          </div>
          <div class="drawer-foot">
            <div class="sidebar-spacer" />
            <button class="btn btn-ghost" @click="uploadOpen = false">
              Yopish
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- ===== Mapping tasdiqlash modal ===== -->
    <template v-if="mappingOpen">
      <div class="modal-scrim" @click="mappingOpen = false">
        <div class="modal wide" @click.stop>
          <div class="modal-top">
            <span class="mt-eyebrow">Tuzilmani tasdiqlash</span>
            <button class="icon-btn modal-x" @click="mappingOpen = false">
              <BaseIcon name="x" />
            </button>
          </div>
          <div class="modal-body scroll">
            <p style="font-size: 13px; color: var(--ink-3); line-height: 1.55">
              AI ustunlarni quyidagicha aniqladi. Tekshiring/tuzating —
              tasdiqlangan tuzilma shablon sifatida saqlanadi va shu strukturali
              keyingi yuklashlar avtomatik o'qiladi. Ustunlar Excel harflari (A,
              B, C…).
            </p>

            <div class="set-group">
              <div class="fg-head">
                <div class="fg-icon"><BaseIcon name="coins" /></div>
                <div class="fg-title">Valyuta</div>
              </div>
              <div style="max-width: 220px">
                <BaseSelect
                  v-model="mapping.currency"
                  :options="CURRENCY_OPTS"
                />
              </div>
            </div>

            <div
              v-for="sheet in mapping.sheets"
              :key="sheet.sheet"
              class="sup-line"
              :class="{ 'is-skip': sheet.skip }"
            >
              <button
                class="sup-active-row"
                :class="{ on: !sheet.skip }"
                @click="sheet.skip = !sheet.skip"
              >
                <span class="cbox" :class="{ on: !sheet.skip }">
                  <BaseIcon v-if="!sheet.skip" name="check" />
                </span>
                <span class="sar-text">{{ sheet.sheet }}</span>
                <span class="sar-hint">{{
                  sheet.skip ? "o'tkazib yuboriladi" : "o'qiladi"
                }}</span>
              </button>

              <template v-if="!sheet.skip">
                <div
                  v-if="previewForSheet(sheet.sheet)"
                  class="dt-wrap"
                  style="margin-top: 12px"
                >
                  <table class="dt preview-dt">
                    <thead>
                      <tr>
                        <th
                          v-for="ci in previewForSheet(sheet.sheet)!
                            .columnCount"
                          :key="ci"
                        >
                          {{ colLetter(ci - 1) }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(row, ri) in previewForSheet(
                          sheet.sheet,
                        )!.rows.slice(0, 6)"
                        :key="ri"
                      >
                        <td
                          v-for="ci in previewForSheet(sheet.sheet)!
                            .columnCount"
                          :key="ci"
                        >
                          {{ row[ci - 1] ?? "" }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div class="set-fields" style="margin-top: 12px">
                  <div class="fld">
                    <label class="fld-label">Ma'lumot boshlanish qatori</label>
                    <input
                      v-model.number="sheet.dataStartRow"
                      class="text-input"
                      type="number"
                      min="1"
                    />
                  </div>
                  <div class="fld">
                    <label class="fld-label">Kategoriya sheet nomidan</label>
                    <button
                      class="sup-active-row"
                      :class="{ on: sheet.categoryFromSheetName }"
                      style="margin-top: 0"
                      @click="
                        sheet.categoryFromSheetName =
                          !sheet.categoryFromSheetName
                      "
                    >
                      <span
                        class="cbox"
                        :class="{ on: sheet.categoryFromSheetName }"
                      >
                        <BaseIcon
                          v-if="sheet.categoryFromSheetName"
                          name="check"
                        />
                      </span>
                      <span class="sar-text">{{
                        sheet.categoryFromSheetName ? "Ha" : "Yo'q"
                      }}</span>
                    </button>
                  </div>
                </div>

                <div
                  v-for="(block, bi) in sheet.blocks"
                  :key="bi"
                  class="block-grid"
                >
                  <div class="block-head">
                    Blok {{ bi + 1 }}
                    <button
                      class="excel-tmpl"
                      @click="block.skip = !block.skip"
                    >
                      {{ block.skip ? "o'tkazib yuborilgan" : "o'qiladi" }}
                    </button>
                  </div>
                  <div v-if="!block.skip" class="set-fields">
                    <div class="fld">
                      <label class="fld-label"
                        >Nomi <span class="fg-badge req">majburiy</span></label
                      >
                      <input
                        v-model="block.nameCol"
                        class="text-input col-input"
                        placeholder="A"
                      />
                    </div>
                    <div class="fld">
                      <label class="fld-label">Model</label>
                      <input
                        v-model="block.modelCol"
                        class="text-input col-input"
                        placeholder="B"
                      />
                    </div>
                    <div class="fld">
                      <label class="fld-label">Tan narx</label>
                      <input
                        v-model="block.costCol"
                        class="text-input col-input"
                        placeholder="C"
                      />
                    </div>
                    <div class="fld">
                      <label class="fld-label">Sotuv narx</label>
                      <input
                        v-model="block.retailCol"
                        class="text-input col-input"
                        placeholder="D"
                      />
                    </div>
                    <div class="fld">
                      <label class="fld-label">Kategoriya ustuni</label>
                      <input
                        v-model="block.categoryCol"
                        class="text-input col-input"
                        placeholder="—"
                      />
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <p v-if="mappingError" class="form-err">{{ mappingError }}</p>
          </div>
          <div class="drawer-foot">
            <div class="sidebar-spacer" />
            <button class="btn btn-ghost" @click="mappingOpen = false">
              Bekor qilish
            </button>
            <button
              class="btn btn-accent"
              :disabled="!mappingValid || mappingBusy"
              @click="handleConfirmMapping"
            >
              {{ mappingBusy ? "Saqlanmoqda…" : "Tasdiqlash va o'qish" }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- ===== O'chirish tasdiq dialogi ===== -->
    <template v-if="deleteTarget">
      <div class="dialog-scrim" @click="deleteTarget = null">
        <div class="dialog" @click.stop>
          <div class="dialog-icon"><BaseIcon name="trash" /></div>
          <div class="dialog-title">Ta'minotchi o'chirilsinmi?</div>
          <div class="dialog-body">
            <b>{{ deleteTarget.name }}</b> ro'yxatdan olib tashlanadi. Yozuv
            saqlanadi — xohlasangiz keyin qayta faollashtirish mumkin.
          </div>
          <div class="dialog-actions">
            <button class="btn btn-ghost" @click="deleteTarget = null">
              Bekor
            </button>
            <button
              class="btn btn-danger"
              :disabled="deleteBusy"
              @click="handleDelete"
            >
              {{ deleteBusy ? "O'chirilmoqda…" : "O'chirish" }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.seg {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  background: var(--surface-2, #f1f3f5);
  border: 1px solid var(--line, #e6e8eb);
  border-radius: 12px;
}
.seg-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-3, #6b7280);
  background: transparent;
  border: none;
  cursor: pointer;
}
.seg-btn.on {
  background: var(--surface, #fff);
  color: var(--ink-1, #111);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.filters-bar {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.search-box {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 220px;
}
.search-box :deep(svg) {
  position: absolute;
  left: 11px;
  width: 15px;
  height: 15px;
  color: var(--ink-4, #9aa1a9);
  pointer-events: none;
}
.search-box .text-input {
  padding-left: 34px;
  width: 100%;
}
.active-filter-note {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: var(--ink-3, #6b7280);
}
.active-filter-note :deep(svg) {
  width: 15px;
  height: 15px;
}
.link-cell {
  background: none;
  border: none;
  padding: 0;
  color: var(--accent-ink, #2563eb);
  font: inherit;
  cursor: pointer;
  text-align: left;
}
.link-cell:hover {
  text-decoration: underline;
}
.products-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  padding: 4px 2px;
}
.foot-count {
  font-size: 13px;
  color: var(--ink-4, #9aa1a9);
}

/* Tovar qaysi Excel'dan kelgani — kod chipi, bosilsa fayl yuklab olinadi */
.xls-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  font-family: var(--mono);
  font-size: 11.5px;
  font-weight: 600;
  color: var(--accent-ink);
  background: var(--accent-soft);
  border: 1px solid var(--accent-line);
  border-radius: 7px;
  padding: 3px 9px;
  cursor: pointer;
  transition:
    background 0.12s,
    border-color 0.12s;
}
.xls-chip:hover {
  border-color: var(--accent);
}
.xls-chip:disabled {
  opacity: 0.55;
  cursor: progress;
}
.xls-chip :deep(svg) {
  width: 13px;
  height: 13px;
}
</style>
