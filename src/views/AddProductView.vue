<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useShopStore } from "@/stores/shop";
import { useToast } from "@/composables/useToast";
import { useI18n } from "@/composables/useI18n";
import { api } from "@/lib/api";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import TopbarSettings from "@/components/layout/TopbarSettings.vue";
import ImagePickerModal from "@/components/shop/ImagePickerModal.vue";
import RegionPicker from "@/components/shop/RegionPicker.vue";
import ShopCombo from "@/components/shop/ShopCombo.vue";
import ShopMoneyInput from "@/components/shop/ShopMoneyInput.vue";
import ShopStepper from "@/components/shop/ShopStepper.vue";
import { fmtSom } from "@/lib/formatters";
import type {
  OfferInput,
  UzexCatalogProduct,
  UzexCategory,
  UzexNamed,
  UzexProductProp,
  UzexRegion,
  UzexUserFile,
  UzexUserRecord,
} from "@/types/shop";

const router = useRouter();
const shopStore = useShopStore();
const { pushToast } = useToast();
const { t, locale } = useI18n();

// ---- katalog (1-bosqich) ----
const categories = ref<UzexCategory[]>([]);
const catId = ref<number | "">("");
const query = ref("");
const productResults = ref<UzexCatalogProduct[]>([]);
const selected = ref<UzexCatalogProduct | null>(null);
const loadingCats = ref(false);
const loadingProducts = ref(false);
const catalogError = ref<string | null>(null);

// ---- ma'lumotnoma (mount'da) ----
const periods = ref<UzexNamed[]>([]);
const countries = ref<UzexNamed[]>([]);
const regions = ref<UzexRegion[]>([]);

// ---- tovar tanlangach ----
const props = ref<UzexProductProp[]>([]);
const propVals = ref<Record<number, string>>({});
const marks = ref<UzexNamed[]>([]);
const manufacturers = ref<UzexNamed[]>([]);
const loadingDetail = ref(false);

// ---- forma maydonlari (real xarid formasiga mos) ----
const displayOnShop = ref(true);
const displayOnNational = ref(false);
const markId = ref<number | "">("");
const markText = ref("");
const manufacturerId = ref<number | "">("");
const manufacturerText = ref("");
const amount = ref<number | null>(null);
const minDelivery = ref<number | null>(1);
const maxDelivery = ref<number | null>(null);
const price = ref<number | null>(null);
const issueYear = ref<number | null>(new Date().getFullYear());
const shelfLife = ref<number | null>(null);
const shelfLifePeriodId = ref<number>(3);
const guaranteePeriod = ref<number | null>(12);
const guaranteePeriodId = ref<number>(2);
const deliveryTerm = ref<number | null>(5);
const deliveryTermPeriodId = ref<number>(1);
const producerCountryId = ref<number | "">("");
const conditions = ref("");
const publishTypeId = ref<number>(1);

// hududlar — tuman darajasida tanlash (viloyat id → tanlangan tuman id'lari)
const pickedDistricts = ref<Record<number, number[]>>({});

// rasm — uzex fayl-menejeridan tanlangan rasmlar (birinchisi asosiy)
const pickedImages = ref<UzexUserFile[]>([]);
const imagePickerOpen = ref(false);

// legal entity'lar
const legalEntities = computed(() => shopStore.legalEntities);
const pickedEntities = ref<string[]>([]);
const allEntities = ref(false);
const entityIds = computed(() =>
  allEntities.value
    ? legalEntities.value.map((e) => e.id)
    : pickedEntities.value,
);

// Har entity'ning moliyaviy hisoblari — e'lon qaysi hisobdan qilinishini tanlash
const entityRecords = ref<Record<string, UzexUserRecord[]>>({});
const pickedRecords = ref<Record<string, number>>({});
const recordsError = ref<Record<string, string>>({});

// O'ng panel qaysi do'konning hisoblarini ko'rsatadi (master-detail fokus)
const activeEntityId = ref<string | null>(null);
const activeEntity = computed(
  () => legalEntities.value.find((e) => e.id === activeEntityId.value) ?? null,
);

function focusEntity(id: string) {
  if (!entityIds.value.includes(id)) toggleEntity(id);
  activeEntityId.value = id;
}

/** Hisob turi badge'i — record_text prefiksidan (20-10 asosiy, 20-30 tranzit). */
function accBadge(recordText: string): string | null {
  if (recordText.startsWith("20-10"))
    return t("addProduct.entities.badge.main");
  if (recordText.startsWith("20-30"))
    return t("addProduct.entities.badge.transit");
  return null;
}

/** Chap ro'yxat uchun tanlangan hisobning oxirgi bo'lagi ("••• 001"). */
function pickedAccTail(id: string): string | null {
  const rid = pickedRecords.value[id];
  const rec = entityRecords.value[id]?.find((r) => r.record_id === rid);
  if (!rec) return null;
  const parts = rec.record_text.split("-");
  return parts[parts.length - 1] ?? null;
}

const pickedRecordsCount = computed(
  () => entityIds.value.filter((id) => pickedRecords.value[id] != null).length,
);

async function loadEntityRecords(id: string) {
  if (entityRecords.value[id]) return;
  try {
    const res = await api.getShopUserRecords(id);
    entityRecords.value = { ...entityRecords.value, [id]: res.data };
    // Standart tanlov — balansi eng katta hisob; foydalanuvchi o'zgartirishi mumkin
    if (res.data.length && pickedRecords.value[id] == null) {
      const richest = res.data.reduce(
        (best, r) => (r.amount > best.amount ? r : best),
        res.data[0],
      );
      pickedRecords.value = {
        ...pickedRecords.value,
        [id]: richest.record_id,
      };
    }
    if (res.error)
      recordsError.value = { ...recordsError.value, [id]: res.error };
  } catch (e) {
    recordsError.value = {
      ...recordsError.value,
      [id]: e instanceof Error ? e.message : t("common.loadError"),
    };
  }
}

watch(entityIds, (ids) => ids.forEach((id) => void loadEntityRecords(id)));

const submitting = ref(false);

const total = computed(() =>
  price.value && amount.value ? price.value * amount.value : 0,
);

// ---- qoralama (draft) — forma localStorage'da saqlanadi, sahifadan chiqib
// qaytilganda tiklanadi. Faqat "Bekor qilish" yoki muvaffaqiyatli "E'lon
// qilish"da tozalanadi.
const DRAFT_KEY = "lotex.addProductDraft.v1";

interface AddProductDraft {
  catId: number | "";
  query: string;
  selected: UzexCatalogProduct | null;
  displayOnShop: boolean;
  displayOnNational: boolean;
  markId: number | "";
  markText: string;
  manufacturerId: number | "";
  manufacturerText: string;
  amount: number | null;
  minDelivery: number | null;
  maxDelivery: number | null;
  price: number | null;
  issueYear: number | null;
  shelfLife: number | null;
  shelfLifePeriodId: number;
  guaranteePeriod: number | null;
  guaranteePeriodId: number;
  deliveryTerm: number | null;
  deliveryTermPeriodId: number;
  producerCountryId: number | "";
  conditions: string;
  publishTypeId: number;
  propVals: Record<number, string>;
  pickedDistricts: Record<number, number[]>;
  pickedEntities: string[];
  allEntities: boolean;
  pickedRecords: Record<string, number>;
  activeEntityId: string | null;
  pickedImages: UzexUserFile[];
}

function draftSnapshot(): AddProductDraft {
  return {
    catId: catId.value,
    query: query.value,
    selected: selected.value,
    displayOnShop: displayOnShop.value,
    displayOnNational: displayOnNational.value,
    markId: markId.value,
    markText: markText.value,
    manufacturerId: manufacturerId.value,
    manufacturerText: manufacturerText.value,
    amount: amount.value,
    minDelivery: minDelivery.value,
    maxDelivery: maxDelivery.value,
    price: price.value,
    issueYear: issueYear.value,
    shelfLife: shelfLife.value,
    shelfLifePeriodId: shelfLifePeriodId.value,
    guaranteePeriod: guaranteePeriod.value,
    guaranteePeriodId: guaranteePeriodId.value,
    deliveryTerm: deliveryTerm.value,
    deliveryTermPeriodId: deliveryTermPeriodId.value,
    producerCountryId: producerCountryId.value,
    conditions: conditions.value,
    publishTypeId: publishTypeId.value,
    propVals: propVals.value,
    pickedDistricts: pickedDistricts.value,
    pickedEntities: pickedEntities.value,
    allEntities: allEntities.value,
    pickedRecords: pickedRecords.value,
    activeEntityId: activeEntityId.value,
    pickedImages: pickedImages.value,
  };
}

function readDraft(): AddProductDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d: unknown = JSON.parse(raw);
    return d && typeof d === "object" ? (d as AddProductDraft) : null;
  } catch {
    return null;
  }
}

function applyDraft(d: AddProductDraft) {
  // pickedRecords AVVAL — entityIds watcher'i default hisob bilan ustidan yozmasin
  pickedRecords.value = d.pickedRecords ?? {};
  catId.value = d.catId ?? "";
  query.value = d.query ?? "";
  selected.value = d.selected ?? null;
  displayOnShop.value = d.displayOnShop ?? true;
  displayOnNational.value = d.displayOnNational ?? false;
  markId.value = d.markId ?? "";
  markText.value = d.markText ?? "";
  manufacturerId.value = d.manufacturerId ?? "";
  manufacturerText.value = d.manufacturerText ?? "";
  amount.value = d.amount ?? null;
  minDelivery.value = d.minDelivery ?? 1;
  maxDelivery.value = d.maxDelivery ?? null;
  price.value = d.price ?? null;
  issueYear.value = d.issueYear ?? new Date().getFullYear();
  shelfLife.value = d.shelfLife ?? null;
  shelfLifePeriodId.value = d.shelfLifePeriodId ?? 3;
  guaranteePeriod.value = d.guaranteePeriod ?? 12;
  guaranteePeriodId.value = d.guaranteePeriodId ?? 2;
  deliveryTerm.value = d.deliveryTerm ?? 5;
  deliveryTermPeriodId.value = d.deliveryTermPeriodId ?? 1;
  producerCountryId.value = d.producerCountryId ?? "";
  conditions.value = d.conditions ?? "";
  publishTypeId.value = d.publishTypeId ?? 1;
  propVals.value = d.propVals ?? {};
  pickedDistricts.value = d.pickedDistricts ?? {};
  pickedImages.value = d.pickedImages ?? [];
  pickedEntities.value = d.pickedEntities ?? [];
  allEntities.value = d.allEntities ?? false;
  activeEntityId.value = d.activeEntityId ?? null;
}

// Tiklash tugagach true — save watcher shundan keyingina yozadi
const draftReady = ref(false);
let draftTimer: ReturnType<typeof setTimeout> | null = null;

watch(draftSnapshot, (snap) => {
  if (!draftReady.value) return;
  if (draftTimer) clearTimeout(draftTimer);
  draftTimer = setTimeout(
    () => localStorage.setItem(DRAFT_KEY, JSON.stringify(snap)),
    300,
  );
});

function clearDraft() {
  draftReady.value = false;
  if (draftTimer) clearTimeout(draftTimer);
  localStorage.removeItem(DRAFT_KEY);
}

/** uzex ma'lumotnomalarini (joriy tilda) yuklaydi — mount va til almashganda. */
async function loadReferences() {
  loadingCats.value = true;
  try {
    const [cats, per, cou, reg] = await Promise.all([
      api.getShopCategories(),
      api.getShopPeriods(),
      api.getShopCountries(),
      api.getShopRegions(),
      shopStore.ensureLegalEntities(),
    ]);
    categories.value = cats.data;
    periods.value = per.data;
    countries.value = cou.data;
    regions.value = reg.data;
    if (cats.error) catalogError.value = cats.error;
  } catch (e) {
    catalogError.value = e instanceof Error ? e.message : t("common.loadError");
  } finally {
    loadingCats.value = false;
  }
}

// Til almashsa dinamik forma (tovar nomlari, texnik parametrlar, davrlar…)
// yangi tilda qayta yuklanadi — tanlovlar id/pnum'da bo'lgani uchun saqlanadi
watch(locale, async () => {
  await loadReferences();
  if (selected.value) void loadProductDetail(selected.value);
  else if (catId.value !== "") void loadProducts();
});

onMounted(async () => {
  const draft = readDraft();
  if (draft) applyDraft(draft);
  await loadReferences();
  // Draft'da tanlangan tovar bo'lsa — props/marka ro'yxatlarini qayta yuklaymiz
  // (tanlovni va kiritilgan qiymatlarni buzmasdan)
  if (selected.value) await loadProductDetail(selected.value);
  else if (catId.value !== "") void loadProducts();
  draftReady.value = true;
});

let searchTimer: ReturnType<typeof setTimeout> | null = null;
async function loadProducts() {
  if (catId.value === "") return;
  loadingProducts.value = true;
  catalogError.value = null;
  try {
    const res = await api.getShopCatalogProducts(
      Number(catId.value),
      query.value.trim() || undefined,
    );
    productResults.value = res.data.slice(0, 60);
    if (res.error) catalogError.value = res.error;
  } catch (e) {
    catalogError.value = e instanceof Error ? e.message : t("common.loadError");
  } finally {
    loadingProducts.value = false;
  }
}

function onCategoryChange(v: string) {
  catId.value = v ? Number(v) : "";
  query.value = "";
  productResults.value = [];
  selected.value = null;
  props.value = [];
  if (catId.value !== "") loadProducts();
}

watch(query, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(loadProducts, 350);
});

/** Tovar ma'lumotnomalarini yuklaydi — tanlov va kiritilgan qiymatlarga tegmaydi
 *  (draft tiklashda ham ishlatiladi). */
async function loadProductDetail(p: UzexCatalogProduct) {
  loadingDetail.value = true;
  try {
    const [pr, mk, mf] = await Promise.all([
      api.getShopProductProps(p.product_code),
      api.getShopMarks(p.product_code),
      api.getShopManufacturers(p.product_code),
    ]);
    props.value = [...pr.data].sort((a, b) => a.pnum - b.pnum);
    marks.value = mk.data;
    manufacturers.value = mf.data;
  } catch (e) {
    catalogError.value = e instanceof Error ? e.message : t("common.loadError");
  } finally {
    loadingDetail.value = false;
  }
}

async function selectProduct(p: UzexCatalogProduct) {
  selected.value = p;
  props.value = [];
  propVals.value = {};
  marks.value = [];
  manufacturers.value = [];
  markId.value = "";
  markText.value = "";
  manufacturerId.value = "";
  manufacturerText.value = "";
  await loadProductDetail(p);
}

/** "X" bosilganda — tanlovni bekor qilib, qayta qidirish imkonini beradi. */
function clearSelectedProduct() {
  selected.value = null;
  props.value = [];
  propVals.value = {};
  if (catId.value !== "") void loadProducts();
}

function setProp(pnum: number, v: string) {
  propVals.value = { ...propVals.value, [pnum]: v };
}

function onImagesPicked(files: UzexUserFile[]) {
  pickedImages.value = files;
  imagePickerOpen.value = false;
}

function removeImage(id: number) {
  pickedImages.value = pickedImages.value.filter((f) => f.id !== id);
}

function toggleEntity(id: string) {
  allEntities.value = false;
  const wasSelected = pickedEntities.value.includes(id);
  pickedEntities.value = wasSelected
    ? pickedEntities.value.filter((x) => x !== id)
    : [...pickedEntities.value, id];
  // Fokus tanlov bilan sinxron: yangi tanlansa fokus, olib tashlansa boshqasiga
  if (!wasSelected) activeEntityId.value = id;
  else if (activeEntityId.value === id)
    activeEntityId.value = pickedEntities.value[0] ?? null;
}
function toggleAllEntities() {
  if (allEntities.value) {
    allEntities.value = false;
    pickedEntities.value = [];
    activeEntityId.value = null;
  } else {
    allEntities.value = true;
    pickedEntities.value = legalEntities.value.map((e) => e.id);
    activeEntityId.value ??= legalEntities.value[0]?.id ?? null;
  }
}

const requiredPropsFilled = computed(() =>
  props.value
    .filter((p) => p.is_required === 1)
    .every((p) => (propVals.value[p.pnum] ?? "") !== ""),
);

const deliveryDistricts = computed(() => {
  const out: { region_Id: number; district_Id: number }[] = [];
  for (const [rid, ids] of Object.entries(pickedDistricts.value))
    for (const did of ids)
      out.push({ region_Id: Number(rid), district_Id: did });
  return out;
});

const canSubmit = computed(
  () =>
    !!selected.value &&
    (markId.value !== "" || !!markText.value.trim()) &&
    !!amount.value &&
    amount.value > 0 &&
    !!minDelivery.value &&
    !!maxDelivery.value &&
    minDelivery.value <= maxDelivery.value &&
    !!price.value &&
    price.value > 0 &&
    conditions.value.trim().length >= 10 &&
    requiredPropsFilled.value &&
    deliveryDistricts.value.length > 0 &&
    (displayOnShop.value || displayOnNational.value) &&
    entityIds.value.length > 0,
);

function buildSpecs(): [string, string][] {
  return props.value
    .map((p): [string, string] => {
      const raw = propVals.value[p.pnum] ?? "";
      if (raw === "") return [p.name, ""];
      const item = p.items.find((i) => String(i.value) === raw);
      return [p.name, item ? item.value_name : raw];
    })
    .filter(([, v]) => v !== "");
}

function buildJsProperties(): {
  property_Num: number;
  property_Value: string;
}[] {
  return props.value
    .filter((p) => (propVals.value[p.pnum] ?? "") !== "")
    .map((p) => ({
      property_Num: p.pnum,
      property_Value: String(propVals.value[p.pnum]),
    }));
}

function markLabel(): { id: number | null; name: string | null } {
  if (markId.value !== "") {
    const m = marks.value.find((x) => x.id === markId.value);
    return { id: m?.id ?? null, name: m?.name ?? null };
  }
  return { id: null, name: markText.value.trim() || null };
}
function mfLabel(): { id: number | null; name: string | null } {
  if (manufacturerId.value !== "") {
    const m = manufacturers.value.find((x) => x.id === manufacturerId.value);
    return { id: m?.id ?? null, name: m?.name ?? null };
  }
  return { id: null, name: manufacturerText.value.trim() || null };
}

function buildOffer(): OfferInput {
  const mk = markLabel();
  const mf = mfLabel();
  return {
    productCode: selected.value!.product_code,
    categoryId: Number(catId.value),
    price: Number(price.value),
    amount: Number(amount.value),
    minDelivery: Number(minDelivery.value),
    maxDelivery: Number(maxDelivery.value),
    guaranteePeriod: Number(guaranteePeriod.value ?? 0),
    guaranteePeriodId: guaranteePeriodId.value,
    deliveryTerm: Number(deliveryTerm.value ?? 5),
    deliveryTermPeriodId: deliveryTermPeriodId.value,
    shelfLife: shelfLife.value ?? null,
    shelfLifePeriodId: shelfLife.value ? shelfLifePeriodId.value : null,
    issueDate: issueYear.value ? `${issueYear.value}-01-01` : null,
    producerCountryId:
      producerCountryId.value === "" ? null : producerCountryId.value,
    markId: mk.id,
    markName: mk.name,
    manufacturerId: mf.id,
    manufacturerName: mf.name,
    mainImageId: pickedImages.value[0]?.id ?? null,
    imageIds: pickedImages.value.map((f) => f.id),
    // To'liq metadata — boshqa entity'ga e'lon qilinganda backend rasmni
    // o'sha akkauntga topadi/nusxalaydi (file_Id akkauntga bog'liq)
    images: pickedImages.value.map((f) => ({
      id: f.id,
      name: f.name,
      path: f.path,
      customName: f.custom_name,
      size: f.file_size,
    })),
    conditions: conditions.value.trim(),
    publishTypeId: publishTypeId.value,
    displayOnShop: displayOnShop.value ? 1 : 0,
    displayOnNational: displayOnNational.value ? 1 : 0,
    jsProperties: buildJsProperties(),
    deliveryDistricts: deliveryDistricts.value,
  };
}

function goBack() {
  router.push("/shop");
}

/** "Bekor qilish" — qoralama o'chib, forma boshlang'ich holatga qaytadi. */
function handleCancel() {
  clearDraft();
  goBack();
}

async function submit() {
  if (!canSubmit.value || !selected.value || submitting.value) return;
  submitting.value = true;
  const mk = markLabel();
  const name = `${selected.value.name}${mk.name ? " " + mk.name : ""}`.trim();
  // Tanlangan hisoblar: { entityId: record_id } — backend shu hisobdan e'lon qiladi
  const records: Record<string, number> = {};
  for (const id of entityIds.value) {
    const rid = pickedRecords.value[id];
    if (rid != null) records[id] = rid;
  }
  try {
    const res = await api.publishOffer({
      entities: [...entityIds.value],
      offer: buildOffer(),
      name,
      brand: mk.name ?? "—",
      specs: buildSpecs(),
      records: Object.keys(records).length ? records : undefined,
    });
    const { published, total: tot, results } = res.data;
    if (published > 0) {
      pushToast({
        kind: "acc",
        title: t("addProduct.toast.published"),
        sub: t("addProduct.toast.publishedSub", {
          published,
          total: tot,
          name,
        }),
        undoId: "",
      });
      clearDraft();
      goBack();
    } else {
      const firstErr =
        results.find((r) => !r.ok)?.error ?? t("common.unknownError");
      pushToast({
        kind: "rej",
        title: t("addProduct.toast.publishFailed"),
        sub: firstErr,
        undoId: "",
      });
    }
  } catch {
    pushToast({
      kind: "rej",
      title: t("common.error"),
      sub: t("addProduct.toast.publishError"),
      undoId: "",
    });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <button class="back-btn" @click="goBack">
        <BaseIcon name="arrowLeft" /> {{ t("common.back") }}
      </button>
      <div class="topbar-sep" />
      <div>
        <h1>{{ t("shop.addProduct.title") }}</h1>
        <div class="crumb-sub">{{ t("shop.addProduct.subtitle") }}</div>
      </div>
      <div class="topbar-right">
        <TopbarSettings />
      </div>
    </header>

    <div class="page-scroll scroll">
      <div class="add-inner fade-page">
        <div
          v-if="catalogError"
          class="import-note err"
          style="margin-bottom: 14px"
        >
          <BaseIcon name="alert" />{{ catalogError }}
        </div>

        <!-- STEP 1 — platforma + kategoriya + tovar -->
        <div class="add-step">
          <div class="step-badge">1</div>
          <div class="step-head">
            <div class="step-title">{{ t("addProduct.step1.title") }}</div>
            <div class="step-sub">
              {{ t("addProduct.step1.sub") }}
            </div>
          </div>
        </div>

        <div class="form-card">
          <div class="fld-label" style="margin-bottom: 8px">
            <span class="fl-t">{{ t("addProduct.platform.label") }}</span>
            <span class="req">{{ t("common.required") }}</span>
          </div>
          <div class="plat-row">
            <label class="plat-opt">
              <input v-model="displayOnShop" type="checkbox" />
              <span>{{ t("addProduct.platform.shop") }}</span>
            </label>
            <label class="plat-opt">
              <input v-model="displayOnNational" type="checkbox" />
              <span>{{ t("addProduct.platform.national") }}</span>
            </label>
          </div>
        </div>

        <div class="big-select-row" style="margin-top: 14px">
          <div class="bs-field">
            <label class="fld-label">
              <span class="fl-t">{{ t("addProduct.category.label") }}</span>
              <span class="req">{{ t("common.required") }}</span>
            </label>
            <div class="big-select">
              <select
                :value="catId"
                :disabled="loadingCats"
                @change="
                  onCategoryChange(($event.target as HTMLSelectElement).value)
                "
              >
                <option value="" disabled>
                  {{
                    loadingCats
                      ? t("common.loading")
                      : t("addProduct.category.placeholder")
                  }}
                </option>
                <option v-for="c in categories" :key="c.id" :value="c.id">
                  {{ c.name }}
                </option>
              </select>
              <BaseIcon name="sort" />
            </div>
          </div>
          <div class="bs-field">
            <label class="fld-label">
              <span class="fl-t">{{ t("addProduct.search.label") }}</span>
              <span class="opt">{{ t("addProduct.search.hint") }}</span>
            </label>
            <div
              :class="[
                'big-select',
                { disabled: catId === '', picked: !!selected },
              ]"
            >
              <input
                :value="selected ? selected.name : query"
                type="text"
                :disabled="catId === ''"
                :readonly="!!selected"
                :placeholder="
                  catId === ''
                    ? t('addProduct.search.selectCategoryFirst')
                    : t('addProduct.search.placeholder')
                "
                style="
                  flex: 1;
                  border: 1px solid var(--border-2);
                  background: white;
                  padding: 14px;
                  border-radius: 12px;
                  font: inherit;
                  outline: none;
                "
                @input="query = ($event.target as HTMLInputElement).value"
              />
              <!-- Tanlangach search "X"ga aylanadi — qayta tanlash uchun -->
              <button
                v-if="selected"
                class="bs-clear"
                type="button"
                :title="t('addProduct.search.clear')"
                @click="clearSelectedProduct"
              >
                <BaseIcon name="x" />
              </button>
              <BaseIcon v-else name="search" />
            </div>
          </div>
        </div>

        <!-- Natijalar faqat tanlov yo'q paytda — tanlangach ro'yxat yopiladi -->
        <div v-if="catId !== '' && !selected" class="product-results">
          <div v-if="loadingProducts" class="pr-empty">
            {{ t("common.loading") }}
          </div>
          <div v-else-if="productResults.length === 0" class="pr-empty">
            {{ t("addProduct.noProductsFound") }}
          </div>
          <button
            v-for="p in productResults"
            :key="p.id"
            class="pr-item"
            @click="selectProduct(p)"
          >
            <span class="pr-radio" />
            <span class="pr-main">
              <span class="pr-name">{{ p.name }}</span>
              <span class="pr-code mono">{{ p.product_code }}</span>
            </span>
          </button>
        </div>

        <!-- STEP 2 — to'liq forma -->
        <div v-if="selected" class="add-form fade-page">
          <div class="add-step" style="margin-top: 30px">
            <div class="step-badge">2</div>
            <div class="step-head">
              <div class="step-title">
                {{ t("addProduct.step2.title", { name: selected.name }) }}
              </div>
              <div class="step-sub">
                {{ t("addProduct.step2.sub") }}
              </div>
            </div>
          </div>

          <!-- marka + ishlab chiqaruvchi -->
          <div class="form-card">
            <div class="field-grid">
              <div class="fld">
                <label class="fld-label">
                  <span class="fl-t">{{ t("addProduct.brand.label") }}</span>
                  <span class="req">{{ t("common.required") }}</span>
                </label>
                <ShopCombo
                  v-model:id="markId"
                  v-model:text="markText"
                  :options="marks"
                  :placeholder="t('addProduct.brand.placeholder')"
                />
              </div>
              <div class="fld">
                <label class="fld-label">
                  <span class="fl-t">{{
                    t("addProduct.manufacturer.label")
                  }}</span>
                  <span class="opt">{{ t("common.optional") }}</span>
                </label>
                <ShopCombo
                  v-model:id="manufacturerId"
                  v-model:text="manufacturerText"
                  :options="manufacturers"
                  :placeholder="t('addProduct.manufacturer.label')"
                />
              </div>
            </div>
          </div>

          <!-- narx + miqdor -->
          <div class="form-card" style="margin-top: 14px">
            <div class="field-grid">
              <div class="fld">
                <label class="fld-label"
                  ><span class="fl-t">{{ t("addProduct.qty.label") }}</span
                  ><span class="req">{{ t("common.required") }}</span></label
                >
                <ShopStepper v-model="amount" :min="1" placeholder="0" />
              </div>
              <div class="fld">
                <label class="fld-label"
                  ><span class="fl-t">{{ t("addProduct.minBatch.label") }}</span
                  ><span class="req">{{ t("common.required") }}</span></label
                >
                <ShopStepper v-model="minDelivery" :min="1" placeholder="1" />
              </div>
              <div class="fld">
                <label class="fld-label"
                  ><span class="fl-t">{{ t("addProduct.maxBatch.label") }}</span
                  ><span class="req">{{ t("common.required") }}</span></label
                >
                <ShopStepper v-model="maxDelivery" :min="1" placeholder="0" />
              </div>
              <div class="fld">
                <label class="fld-label"
                  ><span class="fl-t">{{
                    t("addProduct.unitPrice.label")
                  }}</span
                  ><span class="req">{{ t("common.required") }}</span></label
                >
                <ShopMoneyInput v-model="price" placeholder="0" />
              </div>
              <div class="fld">
                <label class="fld-label"
                  ><span class="fl-t">{{
                    t("addProduct.totalSum.label")
                  }}</span></label
                >
                <input
                  class="form-input"
                  :value="fmtSom(total) + ' ' + t('currency.som')"
                  disabled
                />
              </div>
            </div>
          </div>

          <!-- muddatlar -->
          <div class="form-card" style="margin-top: 14px">
            <div class="fc-head">
              <div class="fc-icon"><BaseIcon name="clock" /></div>
              <div class="fc-title">{{ t("addProduct.terms.title") }}</div>
            </div>
            <div class="field-grid">
              <div class="fld">
                <label class="fld-label"
                  ><span class="fl-t">{{
                    t("addProduct.issueYear.label")
                  }}</span></label
                >
                <input
                  v-model.number="issueYear"
                  class="form-input"
                  type="number"
                  placeholder="2026"
                />
              </div>
              <div class="fld">
                <label class="fld-label"
                  ><span class="fl-t">{{
                    t("addProduct.shelfLife.label")
                  }}</span></label
                >
                <div class="dur-row">
                  <input
                    v-model.number="shelfLife"
                    class="form-input"
                    type="number"
                    min="0"
                    placeholder="—"
                  />
                  <select
                    v-model.number="shelfLifePeriodId"
                    class="form-input dur-sel"
                  >
                    <option v-for="p in periods" :key="p.id" :value="p.id">
                      {{ p.name }}
                    </option>
                  </select>
                </div>
              </div>
              <div class="fld">
                <label class="fld-label"
                  ><span class="fl-t">{{
                    t("addProduct.guarantee.label")
                  }}</span></label
                >
                <div class="dur-row">
                  <input
                    v-model.number="guaranteePeriod"
                    class="form-input"
                    type="number"
                    min="0"
                    placeholder="—"
                  />
                  <select
                    v-model.number="guaranteePeriodId"
                    class="form-input dur-sel"
                  >
                    <option v-for="p in periods" :key="p.id" :value="p.id">
                      {{ p.name }}
                    </option>
                  </select>
                </div>
              </div>
              <div class="fld">
                <label class="fld-label"
                  ><span class="fl-t">{{
                    t("addProduct.deliveryTerm.label")
                  }}</span
                  ><span class="req">{{ t("common.required") }}</span></label
                >
                <div class="dur-row">
                  <input
                    v-model.number="deliveryTerm"
                    class="form-input"
                    type="number"
                    min="5"
                    placeholder="5"
                  />
                  <select
                    v-model.number="deliveryTermPeriodId"
                    class="form-input dur-sel"
                  >
                    <option v-for="p in periods" :key="p.id" :value="p.id">
                      {{ p.name }}
                    </option>
                  </select>
                </div>
              </div>
              <div class="fld">
                <label class="fld-label"
                  ><span class="fl-t">{{
                    t("addProduct.producerCountry.label")
                  }}</span></label
                >
                <div class="big-select sm">
                  <select
                    :value="producerCountryId"
                    @change="
                      producerCountryId =
                        Number(($event.target as HTMLSelectElement).value) || ''
                    "
                  >
                    <option value="">{{ t("common.select") }}</option>
                    <option v-for="co in countries" :key="co.id" :value="co.id">
                      {{ co.name }}
                    </option>
                  </select>
                  <BaseIcon name="sort" />
                </div>
              </div>
            </div>
          </div>

          <!-- texnik parametrlar (dinamik) -->
          <div class="form-card" style="margin-top: 14px">
            <div class="fc-head">
              <div class="fc-icon"><BaseIcon name="flag" /></div>
              <div class="fc-title">{{ t("addProduct.techParams.title") }}</div>
              <div v-if="loadingDetail" class="fc-badge">
                {{ t("common.loading") }}
              </div>
            </div>
            <div v-if="!loadingDetail && props.length === 0" class="pr-empty">
              {{ t("addProduct.noTechParams") }}
            </div>
            <div v-else class="field-grid">
              <div v-for="p in props" :key="p.pnum" class="fld">
                <label class="fld-label">
                  <span class="fl-t">{{ p.name }}</span>
                  <span v-if="p.is_required === 1" class="req">{{
                    t("common.required")
                  }}</span>
                  <span v-else class="opt">{{ t("common.optional") }}</span>
                </label>
                <div v-if="p.items.length" class="big-select sm">
                  <select
                    :value="propVals[p.pnum] ?? ''"
                    @change="
                      setProp(
                        p.pnum,
                        ($event.target as HTMLSelectElement).value,
                      )
                    "
                  >
                    <option value="" disabled>
                      {{ t("common.selectEllipsis") }}
                    </option>
                    <option
                      v-for="it in p.items"
                      :key="it.value"
                      :value="String(it.value)"
                    >
                      {{ it.value_name }}
                    </option>
                  </select>
                  <BaseIcon name="sort" />
                </div>
                <input
                  v-else
                  class="form-input"
                  :value="propVals[p.pnum] ?? ''"
                  :placeholder="t('addProduct.valuePlaceholder')"
                  @input="
                    setProp(p.pnum, ($event.target as HTMLInputElement).value)
                  "
                />
              </div>
            </div>
          </div>

          <!-- yetkazib berish hududlari -->
          <div class="form-card" style="margin-top: 14px">
            <div class="fc-head">
              <div class="fc-icon"><BaseIcon name="map" /></div>
              <div class="fc-title">{{ t("addProduct.regions.title") }}</div>
              <span class="req" style="margin-left: auto">{{
                t("common.required")
              }}</span>
            </div>
            <RegionPicker v-model="pickedDistricts" :regions="regions" />
          </div>

          <!-- rasm(lar) — uzex fayl-menejeridan tanlash yoki yangi yuklash -->
          <div class="form-card" style="margin-top: 14px">
            <div class="fc-head">
              <div class="fc-icon"><BaseIcon name="image" /></div>
              <div class="fc-title">{{ t("addProduct.image.title") }}</div>
              <div v-if="pickedImages.length" class="fc-badge">
                {{
                  t("addProduct.image.selectedOf", {
                    n: pickedImages.length,
                    max: 10,
                  })
                }}
              </div>
            </div>
            <button
              v-if="pickedImages.length === 0"
              class="img-drop"
              type="button"
              @click="imagePickerOpen = true"
            >
              <BaseIcon name="plus" />
              <span>{{ t("addProduct.image.pick") }}</span>
              <small>{{ t("addProduct.image.pickHint", { max: 10 }) }}</small>
            </button>
            <div v-else class="img-row">
              <div
                v-for="(f, i) in pickedImages"
                :key="f.id"
                class="img-thumb"
                :title="f.custom_name"
              >
                <img :src="api.shopFileImageUrl(f)" :alt="f.custom_name" />
                <span v-if="i === 0" class="img-main">{{
                  t("addProduct.image.main")
                }}</span>
                <button
                  class="img-del"
                  type="button"
                  :title="t('common.close')"
                  @click="removeImage(f.id)"
                >
                  <BaseIcon name="x" />
                </button>
              </div>
              <button
                class="img-add"
                type="button"
                :title="t('addProduct.image.pick')"
                @click="imagePickerOpen = true"
              >
                <BaseIcon name="plus" />
              </button>
            </div>
          </div>

          <!-- tavsif + e'lon turi -->
          <div class="form-card" style="margin-top: 14px">
            <div class="fc-head">
              <div class="fc-icon"><BaseIcon name="doc" /></div>
              <div class="fc-title">{{ t("addProduct.notes.title") }}</div>
              <span class="req" style="margin-left: auto">{{
                t("addProduct.notes.minChars")
              }}</span>
            </div>
            <textarea
              v-model="conditions"
              class="form-textarea"
              :placeholder="t('addProduct.notes.placeholder')"
            />
            <div class="fld-label" style="margin-top: 12px">
              <span class="fl-t">{{ t("addProduct.publishType.label") }}</span>
            </div>
            <div class="plat-row">
              <label class="plat-opt"
                ><input
                  v-model.number="publishTypeId"
                  type="radio"
                  :value="1"
                /><span>{{
                  t("addProduct.publishType.afterModeration")
                }}</span></label
              >
              <label class="plat-opt"
                ><input
                  v-model.number="publishTypeId"
                  type="radio"
                  :value="2"
                /><span>{{ t("addProduct.publishType.manual") }}</span></label
              >
            </div>
          </div>

          <!-- STEP 3 — legal entity'lar (sarlavha karta ichida, mock bo'yicha) -->
          <div class="form-card entity-panel" style="margin-top: 30px">
            <div v-if="legalEntities.length === 0" class="pr-empty">
              {{ t("addProduct.entities.none") }}
            </div>
            <div v-else class="ep-wrap">
              <div class="ep-header">
                <span class="ep-step">3</span>
                <div>
                  <div class="ep-h-title">
                    {{ t("addProduct.step3.title") }}
                  </div>
                  <div class="ep-h-sub">{{ t("addProduct.step3.sub") }}</div>
                </div>
              </div>
              <div class="ep-layout">
                <!-- chap: do'konlar ro'yxati -->
                <div class="ep-left">
                  <div class="ep-toggle-row">
                    <button class="ep-toggle" @click="toggleAllEntities">
                      <span :class="['switch', { on: allEntities }]"
                        ><span class="knob"
                      /></span>
                      <span class="ep-toggle-t">{{
                        t("addProduct.entities.allToggle")
                      }}</span>
                    </button>
                    <span class="ep-count"
                      >{{ entityIds.length }} {{ t("common.count") }}</span
                    >
                  </div>
                  <div class="ep-list">
                    <div
                      v-for="e in legalEntities"
                      :key="e.id"
                      :class="[
                        'ep-row',
                        {
                          on: entityIds.includes(e.id),
                          focus: activeEntityId === e.id,
                        },
                      ]"
                      @click="focusEntity(e.id)"
                    >
                      <span
                        :class="['cbox', { on: entityIds.includes(e.id) }]"
                        @click.stop="toggleEntity(e.id)"
                      >
                        <BaseIcon
                          v-if="entityIds.includes(e.id)"
                          name="check"
                        />
                      </span>
                      <span class="ep-av">{{ e.name.slice(0, 1) }}</span>
                      <div class="ep-main">
                        <div class="ep-name">{{ e.name }}</div>
                        <div
                          v-if="entityIds.includes(e.id) && pickedAccTail(e.id)"
                          class="ep-acc mono"
                        >
                          ••• {{ pickedAccTail(e.id) }}
                        </div>
                        <div v-else class="ep-sub">
                          {{ t("supplierModal.inn") }}
                          {{ e.inn ? e.inn : "—" }}
                        </div>
                      </div>
                      <span
                        v-if="
                          entityIds.includes(e.id) &&
                          pickedRecords[e.id] != null
                        "
                        class="ep-dot"
                      />
                    </div>
                  </div>
                </div>

                <!-- o'ng: fokusdagi do'konning hisoblari -->
                <div class="ep-right">
                  <template v-if="activeEntity">
                    <div class="ep-head">
                      <span class="ep-av-lg">{{
                        activeEntity.name.slice(0, 1)
                      }}</span>
                      <div class="ep-head-tx">
                        <div class="ep-title">{{ activeEntity.name }}</div>
                        <div class="ep-inn">
                          {{ t("supplierModal.inn") }}
                          {{ activeEntity.inn ? activeEntity.inn : "—" }}
                        </div>
                      </div>
                    </div>
                    <div class="er-head">
                      <span class="er-label">{{
                        t("addProduct.entities.selectAccount")
                      }}</span>
                      <span
                        v-if="pickedRecords[activeEntity.id] == null"
                        class="er-req"
                        >{{ t("common.required") }}</span
                      >
                    </div>
                    <div
                      v-if="(entityRecords[activeEntity.id]?.length ?? 0) > 0"
                      class="er-list"
                    >
                      <button
                        v-for="r in entityRecords[activeEntity.id]"
                        :key="r.record_id"
                        type="button"
                        :class="[
                          'er-opt',
                          {
                            on: pickedRecords[activeEntity.id] === r.record_id,
                          },
                        ]"
                        @click="pickedRecords[activeEntity.id] = r.record_id"
                      >
                        <span class="er-left">
                          <span class="er-radio">
                            <span
                              v-if="
                                pickedRecords[activeEntity.id] === r.record_id
                              "
                              class="er-radio-dot"
                            />
                          </span>
                          <span class="er-main">
                            <span class="er-text mono">{{
                              r.record_text
                            }}</span>
                            <span class="er-meta">
                              <span
                                v-if="accBadge(r.record_text)"
                                :class="[
                                  'er-badge',
                                  { main: r.record_text.startsWith('20-10') },
                                ]"
                                >{{ accBadge(r.record_text) }}</span
                              >
                              <span class="er-id">ID: {{ r.record_id }}</span>
                            </span>
                          </span>
                        </span>
                        <span class="er-balance">
                          <b class="mono">{{ fmtSom(r.amount) }}</b>
                          <i>{{ t("currency.som") }}</i>
                        </span>
                      </button>
                    </div>
                    <span v-else class="er-loading">{{
                      recordsError[activeEntity.id] ?? t("common.loading")
                    }}</span>
                  </template>
                  <div v-else class="ep-empty">
                    <span class="ep-empty-ic">
                      <svg
                        width="26"
                        height="26"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <rect
                          x="3"
                          y="6"
                          width="18"
                          height="13"
                          rx="2.5"
                          stroke="currentColor"
                          stroke-width="1.8"
                        />
                        <path
                          d="M3 10h18"
                          stroke="currentColor"
                          stroke-width="1.8"
                        />
                        <circle cx="17" cy="14.5" r="1.4" fill="currentColor" />
                      </svg>
                    </span>
                    <div>{{ t("addProduct.entities.pickEntity") }}</div>
                  </div>
                </div>
              </div>
              <div class="ep-footer">
                {{
                  t("addProduct.entities.summary", {
                    n: entityIds.length,
                    m: pickedRecordsCount,
                  })
                }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selected" class="action-bar">
      <div class="ab-hint">
        <template v-if="entityIds.length > 0">
          <BaseIcon name="store" style="width: 15px; height: 15px" />
          {{ t("addProduct.actionBar.willPublish", { n: entityIds.length }) }}
        </template>
        <span v-else style="color: var(--warn-ink)">{{
          t("addProduct.actionBar.selectAtLeastOne")
        }}</span>
      </div>
      <button class="btn btn-ghost" @click="handleCancel">
        {{ t("common.cancel") }}
      </button>
      <button
        :class="['btn btn-accent btn-lg', { disabled: !canSubmit }]"
        :disabled="!canSubmit || submitting"
        @click="submit"
      >
        <BaseIcon name="check" />
        {{ submitting ? t("addProduct.publishing") : t("addProduct.publish") }}
      </button>
    </div>

    <ImagePickerModal
      v-if="imagePickerOpen"
      :initial="pickedImages"
      @close="imagePickerOpen = false"
      @confirm="onImagesPicked"
    />
  </div>
</template>

<style scoped>
.product-results {
  margin-top: 14px;
  max-width: 920px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  overflow: hidden;
  max-height: 320px;
  overflow-y: auto;
}
.pr-empty {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: var(--ink-4);
}
.pr-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  background: var(--surface);
  border: none;
  border-top: 1px solid var(--border);
  padding: 11px 15px;
  cursor: pointer;
  font: inherit;
}
.pr-item:first-child {
  border-top: none;
}
.pr-item:hover {
  background: var(--surface-2);
}
.pr-item.on {
  background: var(--accent-soft);
}
.pr-item > svg {
  width: 16px;
  height: 16px;
  color: var(--accent-ink);
  flex-shrink: 0;
}
.pr-radio {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 99px;
  border: 2px solid var(--border-2);
  position: relative;
}
.pr-item.on .pr-radio {
  border-color: var(--accent);
}
.pr-item.on .pr-radio::after {
  content: "";
  position: absolute;
  inset: 3px;
  border-radius: 99px;
  background: var(--accent);
}
.pr-main {
  flex: 1;
  min-width: 0;
}
.pr-name {
  display: block;
  font-size: 13.5px;
  font-weight: 600;
}
.pr-code {
  display: block;
  font-size: 11px;
  color: var(--ink-4);
  margin-top: 2px;
}
.form-input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
  font-size: 13.5px;
  background: var(--surface);
}
.form-input:focus {
  outline: none;
  border-color: var(--accent);
}
.form-input:disabled {
  background: var(--surface-2);
  color: var(--ink-3);
}
.fc-head {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 13px;
}
.fc-icon {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  background: var(--surface-3);
  color: var(--ink-2);
  flex-shrink: 0;
}
.fc-icon :deep(svg) {
  width: 15px;
  height: 15px;
}
.fc-title {
  font-size: 14px;
  font-weight: 700;
}
.fc-badge {
  margin-left: auto;
  font-size: 11px;
  color: var(--ink-4);
}
.big-select.sm select {
  padding: 8px 10px;
  font-size: 13.5px;
}
.plat-row {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}
.plat-opt {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13.5px;
  cursor: pointer;
}
.dur-row {
  display: flex;
  gap: 8px;
}
.dur-sel {
  width: 90px;
  flex-shrink: 0;
}
.cbox {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 5px;
  border: 1.5px solid var(--border-2);
  display: grid;
  place-items: center;
  color: #fff;
}
.cbox.on {
  background: var(--accent);
  border-color: var(--accent);
}
.cbox :deep(svg) {
  width: 12px;
  height: 12px;
}
/* ---- do'kon + hisob tanlash (master-detail, mock: select-record-form.html) ---- */
.ep-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 24px 26px 20px;
}
.ep-step {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  font-size: 15px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ep-h-title {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.ep-h-sub {
  font-size: 13px;
  color: var(--ink-4);
  margin-top: 2px;
}
.ep-layout {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  border-top: 1px solid var(--border);
}
.ep-left {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  min-width: 0;
}
.ep-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 15px 20px;
  border-bottom: 1px solid var(--border);
}
.ep-toggle {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
}
.ep-toggle-t {
  font-size: 13px;
  font-weight: 700;
}
.ep-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-4);
  white-space: nowrap;
}
.ep-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  flex: 1;
}
.ep-row {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 8px 10px;
  cursor: pointer;
  transition:
    border-color 0.12s,
    background 0.12s;
}
.ep-row:hover {
  background: var(--surface-2);
}
.ep-row.on {
  background: var(--accent-soft);
}
.ep-row.focus {
  border-color: var(--accent);
}
.ep-av {
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent-ink);
  font-size: 13px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ep-main {
  flex: 1;
  min-width: 0;
}
.ep-name {
  font-size: 12.5px;
  font-weight: 700;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ep-sub {
  font-size: 11px;
  color: var(--ink-4);
  margin-top: 2px;
}
.ep-acc {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-ink);
  margin-top: 2px;
  letter-spacing: 0.06em;
}
.ep-dot {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 99px;
  background: var(--good, #2fa36b);
}
.ep-right {
  background: var(--surface-2);
  min-height: 360px;
  padding: 24px 26px;
  min-width: 0;
}
.ep-head {
  display: flex;
  align-items: center;
  gap: 13px;
}
.ep-av-lg {
  flex: none;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 16px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ep-head-tx {
  min-width: 0;
}
.ep-title {
  font-size: 15px;
  font-weight: 800;
  line-height: 1.3;
}
.ep-inn {
  font-size: 12px;
  color: var(--ink-4);
  margin-top: 1px;
}
.er-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 2px 10px;
}
.er-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-4);
}
.er-req {
  font-size: 11px;
  font-weight: 700;
  color: var(--warn-ink);
  background: var(--warn-soft);
  padding: 3px 9px;
  border-radius: 999px;
}
.er-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.er-opt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 13px;
  border: 1.5px solid var(--border);
  border-radius: 13px;
  background: var(--surface);
  padding: 13px 16px;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.12s,
    box-shadow 0.12s;
}
.er-opt:hover {
  border-color: var(--border-2);
}
.er-opt.on {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.er-left {
  display: flex;
  align-items: center;
  gap: 13px;
  min-width: 0;
}
.er-radio {
  width: 20px;
  height: 20px;
  flex: none;
  border-radius: 50%;
  border: 2px solid var(--border-2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.er-opt.on .er-radio {
  border-color: var(--accent);
}
.er-radio-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
}
.er-main {
  min-width: 0;
}
.er-text {
  display: block;
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.er-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 5px;
}
.er-badge {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--surface-3);
  color: var(--ink-3);
}
.er-badge.main {
  background: var(--accent-soft);
  color: var(--accent-ink);
}
.er-id {
  font-size: 11.5px;
  color: var(--ink-4);
}
.er-balance {
  flex: none;
  text-align: right;
}
.er-balance b {
  display: block;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.er-balance i {
  display: block;
  font-style: normal;
  font-size: 11px;
  color: var(--ink-4);
  margin-top: 1px;
}
.er-loading {
  font-size: 11.5px;
  color: var(--ink-4);
}
.ep-empty {
  min-height: 312px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  border: 1.5px dashed var(--border-2);
  border-radius: 16px;
  text-align: center;
  font-size: 13.5px;
  color: var(--ink-4);
}
.ep-empty div {
  max-width: 220px;
  line-height: 1.5;
}
.ep-empty-ic {
  width: 54px;
  height: 54px;
  border-radius: 15px;
  background: var(--accent-soft);
  color: var(--accent-ink);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ep-footer {
  border-top: 1px solid var(--border);
  padding: 15px 26px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-3);
}
@media (max-width: 860px) {
  .ep-layout {
    grid-template-columns: 1fr;
  }
  .ep-left {
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
}
.img-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  border: 1.5px dashed var(--border-2);
  border-radius: 10px;
  padding: 22px;
  cursor: pointer;
  color: var(--ink-3);
  font-size: 13px;
  background: none;
  font-family: inherit;
}
.img-drop:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.img-drop :deep(svg) {
  width: 22px;
  height: 22px;
}
.img-drop small {
  font-size: 11px;
  color: var(--ink-4);
}
/* tanlangan rasmlar qatori */
.img-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.img-thumb {
  position: relative;
  width: 104px;
  height: 104px;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface-2);
}
.img-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.img-main {
  position: absolute;
  left: 6px;
  bottom: 6px;
  font-size: 9.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 6px;
  border-radius: 5px;
  background: var(--accent);
  color: #fff;
}
.img-del {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: oklch(0.25 0.02 262 / 0.55);
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.img-del:hover {
  background: oklch(0.25 0.02 262 / 0.8);
}
.img-del :deep(svg) {
  width: 12px;
  height: 12px;
}
.img-add {
  width: 104px;
  height: 104px;
  border: 1.5px dashed var(--border-2);
  border-radius: 10px;
  background: none;
  color: var(--ink-3);
  display: grid;
  place-items: center;
  cursor: pointer;
}
.img-add:hover {
  border-color: var(--accent);
  color: var(--accent-ink);
  background: var(--accent-soft);
}
.img-add :deep(svg) {
  width: 20px;
  height: 20px;
}
/* tovar tanlangach search o'rnidagi "X" tugmasi */
.bs-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: none;
  color: var(--ink-3);
  display: grid;
  place-items: center;
  cursor: pointer;
  z-index: 1;
}
.bs-clear:hover {
  background: var(--surface-2);
  color: var(--ink);
}
.bs-clear :deep(svg) {
  position: static;
  transform: none;
  width: 15px;
  height: 15px;
  pointer-events: none;
}
/* tanlangan holatda input o'qish uchun — vizual belgi */
.big-select.picked input {
  border-color: var(--accent) !important;
  background: var(--accent-soft) !important;
  font-weight: 650;
}
</style>
