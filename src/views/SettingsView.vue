<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCredentialStore } from "@/stores/credentials";
import { useAuthStore } from "@/stores/auth";
import { useI18n } from "@/composables/useI18n";
import { LOCALES } from "@/i18n";
import { api } from "@/lib/api";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import BaseSelect from "@/components/shared/BaseSelect.vue";
import EmptyState from "@/components/shared/EmptyState.vue";
import TopbarSettings from "@/components/layout/TopbarSettings.vue";
import { relativeAgo } from "@/lib/formatters";
import type { ApiCredential, CredentialUpdate } from "@/types/credential";
import type { ApiBhm } from "@/types/bhm";
import type { UsdRate } from "@/types/pc-build";
import MarjaTable from "@/components/settings/marjaTable.vue";

const store = useCredentialStore();
const auth = useAuthStore();
const { t, locale, setLocale } = useI18n();

// --- tab navigatsiyasi (URL bilan: /settings/:tab) ---
type TabKey = "account" | "rate" | "bhm" | "margin" | "entities";
const TABS: { key: TabKey; label: string }[] = [
  { key: "account", label: "settings.tab.account" },
  { key: "rate", label: "settings.tab.rate" },
  { key: "bhm", label: "settings.tab.bhm" },
  { key: "margin", label: "settings.tab.margin" },
  { key: "entities", label: "settings.tab.entities" },
];
const DEFAULT_TAB: TabKey = "account";
const TAB_KEYS = TABS.map((tb) => tb.key) as readonly TabKey[];

const route = useRoute();
const router = useRouter();

/** Faol tab — URL'dagi :tab paramidan (yaroqsiz/yo'q bo'lsa default). */
const active = computed<TabKey>(() => {
  const p = route.params.tab;
  return typeof p === "string" && TAB_KEYS.includes(p as TabKey)
    ? (p as TabKey)
    : DEFAULT_TAB;
});

/** Tab almashtirish — URL path'ini yangilaydi (back/forward va ulashish ishlaydi). */
function setTab(key: TabKey) {
  if (key === active.value) return;
  router.push({ name: "settings", params: { tab: key } });
}

const langSaving = ref(false);

/** Tilni almashtiradi: darhol UI + DB'da per-account saqlanadi. */
async function changeLanguage(l: string) {
  if (l === locale.value || langSaving.value) return;
  setLocale(l);
  langSaving.value = true;
  try {
    await auth.setLanguage(l);
  } finally {
    langSaving.value = false;
  }
}

// ============================================================ USD kurs
const rate = ref<UsdRate | null>(null);
const rateMode = ref<"live" | "override">("live");
const manualRate = ref<number | null>(null);
const rateBusy = ref(false);
const rateError = ref<string | null>(null);

async function loadRate() {
  try {
    const { data } = await api.getUsdRate();
    rate.value = data;
    rateMode.value = data.overridden ? "override" : "live";
    manualRate.value = data.rate;
  } catch (e) {
    rateError.value = e instanceof Error ? e.message : "Kursni yuklab bo'lmadi";
  }
}

const rateSourceLabel = computed(() => {
  if (!rate.value) return "—";
  return rate.value.overridden
    ? t("settings.rate.overridden")
    : rate.value.source;
});

/** Jonli kursga qaytish (null yuboriladi). */
async function setRateLive() {
  if (rateBusy.value) return;
  rateMode.value = "live";
  if (rate.value && !rate.value.overridden) return; // allaqachon jonli
  rateBusy.value = true;
  rateError.value = null;
  try {
    const { data } = await api.setUsdRate(null);
    rate.value = data;
    manualRate.value = data.rate;
  } catch (e) {
    rateError.value = e instanceof Error ? e.message : "Saqlab bo'lmadi";
  } finally {
    rateBusy.value = false;
  }
}

/** Qo'lda override rejimiga o'tish (hali saqlamaydi). */
function pickOverrideMode() {
  rateMode.value = "override";
  if (manualRate.value == null && rate.value) manualRate.value = rate.value.rate;
}

/** Qo'lda kursni saqlaydi. */
async function saveOverride() {
  if (rateBusy.value) return;
  const v = Number(manualRate.value);
  if (!Number.isFinite(v) || v <= 0) {
    rateError.value = "Kurs musbat son bo'lishi kerak";
    return;
  }
  rateBusy.value = true;
  rateError.value = null;
  try {
    const { data } = await api.setUsdRate(v);
    rate.value = data;
    manualRate.value = data.rate;
  } catch (e) {
    rateError.value = e instanceof Error ? e.message : "Saqlab bo'lmadi";
  } finally {
    rateBusy.value = false;
  }
}

// ================================================================= BHM
const bhmList = ref<ApiBhm[]>([]);
const bhmLoading = ref(false);
const bhmError = ref<string | null>(null);

async function loadBhm() {
  bhmLoading.value = true;
  bhmError.value = null;
  try {
    const { data } = await api.getBhmHistory();
    bhmList.value = data;
  } catch (e) {
    bhmError.value = e instanceof Error ? e.message : "BHM yuklab bo'lmadi";
  } finally {
    bhmLoading.value = false;
  }
}

// Joriy BHM = amal muddati o'tgan (effectiveFrom <= hozir) eng yangi qiymat.
// Ro'yxat yangi sana birinchi bo'lgani uchun birinchi mos keluvchi — joriy.
const bhmCurrentId = computed(() => {
  const now = Date.now();
  return (
    bhmList.value.find((b) => new Date(b.effectiveFrom).getTime() <= now)?.id ??
    null
  );
});

// BHM add/edit modal
const bhmModalOpen = ref(false);
const bhmEditTarget = ref<ApiBhm | null>(null);
const bhmForm = reactive({ amount: "" as string | number, effectiveFrom: "", note: "" });
const bhmBusy = ref(false);
const bhmFormError = ref<string | null>(null);

function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}
function toDateInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function openBhmAdd() {
  bhmEditTarget.value = null;
  bhmForm.amount = "";
  bhmForm.effectiveFrom = todayInput();
  bhmForm.note = "";
  bhmFormError.value = null;
  bhmModalOpen.value = true;
}
function openBhmEdit(item: ApiBhm) {
  bhmEditTarget.value = item;
  bhmForm.amount = item.amount;
  bhmForm.effectiveFrom = toDateInput(item.effectiveFrom);
  bhmForm.note = item.note ?? "";
  bhmFormError.value = null;
  bhmModalOpen.value = true;
}

async function saveBhm() {
  if (bhmBusy.value) return;
  const amount = Number(bhmForm.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    bhmFormError.value = "Miqdor musbat son bo'lishi kerak";
    return;
  }
  if (!bhmForm.effectiveFrom) {
    bhmFormError.value = "Amal qilish sanasini tanlang";
    return;
  }
  bhmBusy.value = true;
  bhmFormError.value = null;
  const body = {
    amount,
    effectiveFrom: bhmForm.effectiveFrom,
    note: bhmForm.note.trim() || null,
  };
  try {
    if (bhmEditTarget.value) await api.updateBhm(bhmEditTarget.value.id, body);
    else await api.createBhm(body);
    bhmModalOpen.value = false;
    await loadBhm();
  } catch (e) {
    bhmFormError.value = e instanceof Error ? e.message : "Saqlab bo'lmadi";
  } finally {
    bhmBusy.value = false;
  }
}

const bhmDeleteTarget = ref<ApiBhm | null>(null);
const bhmDeleteBusy = ref(false);
async function handleBhmDelete() {
  if (!bhmDeleteTarget.value || bhmDeleteBusy.value) return;
  bhmDeleteBusy.value = true;
  try {
    await api.deleteBhm(bhmDeleteTarget.value.id);
    bhmDeleteTarget.value = null;
    await loadBhm();
  } catch (e) {
    bhmError.value = e instanceof Error ? e.message : "O'chirib bo'lmadi";
  } finally {
    bhmDeleteBusy.value = false;
  }
}

const fmtMoney = (n: number) => n.toLocaleString("ru-RU");
function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ==================================================== credentials (entities)
// tashkilot shakllari va hududlar (qo'lda forma uchun)
const ORG_FORM_OPTS = ["YaTT", "MChJ", "AJ", "XK", "QK"].map((v) => ({ v, l: v }));
const ORG_FORM_EDIT_OPTS = [{ v: "", l: "—" }, ...ORG_FORM_OPTS];
const REGION_OPTS = [
  { v: "", l: "Viloyatni tanlang" },
  ...[
    "Toshkent sh.",
    "Toshkent vil.",
    "Andijon",
    "Buxoro",
    "Farg'ona",
    "Jizzax",
    "Xorazm",
    "Namangan",
    "Navoiy",
    "Qashqadaryo",
    "Qoraqalpog'iston",
    "Samarqand",
    "Sirdaryo",
    "Surxondaryo",
  ].map((v) => ({ v, l: v })),
];

type AddMode = "manual" | "raw";
const CONNECT_OPTS: { v: boolean; l: string; cls: string }[] = [
  { v: true, l: "Ulangan", cls: "connected" },
  { v: false, l: "Uzish", cls: "disconnected" },
];

const addOpen = ref(false);
const addMode = ref<AddMode>("manual");
const addBusy = ref(false);
const addError = ref<string | null>(null);

const form = reactive({
  name: "",
  orgForm: "YaTT",
  inn: "",
  director: "",
  phone: "",
  region: "",
  connected: true,
  key: "",
  sugar: "",
  apiAgent: "",
  language: "uz",
});

const raw = ref("");

const manualValid = computed(
  () =>
    !!form.name.trim() &&
    !!form.inn.trim() &&
    !!form.region &&
    !!form.key.trim() &&
    !!form.sugar.trim() &&
    !!form.apiAgent.trim(),
);
const canSubmit = computed(() =>
  addMode.value === "manual" ? manualValid.value : !!raw.value.trim(),
);

const editTarget = ref<ApiCredential | null>(null);
const editForm = reactive({
  name: "",
  inn: "",
  orgForm: "",
  connected: true,
  key: "",
  sugar: "",
  apiAgent: "",
  language: "",
});
const editBusy = ref(false);
const editError = ref<string | null>(null);

const reauthBusyId = ref<string | null>(null);

const stats = computed(() => ({
  total: store.count,
  connected: store.connectedCount,
  disconnected: store.count - store.connectedCount,
}));

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resetForm() {
  form.name = "";
  form.orgForm = "YaTT";
  form.inn = "";
  form.director = "";
  form.phone = "";
  form.region = "";
  form.connected = true;
  form.key = "";
  form.sugar = "";
  form.apiAgent = "";
  form.language = "uz";
}

function openAdd() {
  addMode.value = "manual";
  addError.value = null;
  resetForm();
  raw.value = "";
  addOpen.value = true;
}

async function handleAdd() {
  if (!canSubmit.value || addBusy.value) return;
  addBusy.value = true;
  addError.value = null;
  try {
    if (addMode.value === "manual") {
      await store.create({
        key: form.key.trim(),
        sugar: form.sugar.trim(),
        apiAgent: form.apiAgent.trim(),
        language: form.language || undefined,
        name: form.name.trim(),
        inn: form.inn.trim(),
        orgForm: form.orgForm,
        connected: form.connected,
      });
    } else {
      await store.importFromRaw(raw.value);
    }
    addOpen.value = false;
  } catch (e) {
    addError.value = e instanceof Error ? e.message : "Qo'shib bo'lmadi";
  } finally {
    addBusy.value = false;
  }
}

function openEdit(cred: ApiCredential) {
  editTarget.value = cred;
  editForm.name = cred.name ?? "";
  editForm.inn = cred.inn ?? "";
  editForm.orgForm = cred.orgForm ?? "";
  editForm.connected = cred.connected;
  editForm.key = "";
  editForm.sugar = "";
  editForm.apiAgent = "";
  editForm.language = "";
  editError.value = null;
}

const hasEdits = computed(() => {
  const c = editTarget.value;
  if (!c) return false;
  return (
    editForm.name.trim() !== (c.name ?? "") ||
    editForm.inn.trim() !== (c.inn ?? "") ||
    editForm.orgForm !== (c.orgForm ?? "") ||
    editForm.connected !== c.connected ||
    !!editForm.key ||
    !!editForm.sugar ||
    !!editForm.apiAgent ||
    !!editForm.language
  );
});

async function handleSave() {
  const c = editTarget.value;
  if (!c || !hasEdits.value || editBusy.value) return;
  if (!editForm.name.trim()) {
    editError.value = "Tashkilot nomi bo'sh bo'lmasligi kerak";
    return;
  }
  const body: CredentialUpdate = {};
  if (editForm.name.trim() !== (c.name ?? "")) body.name = editForm.name.trim();
  if (editForm.inn.trim() !== (c.inn ?? "")) body.inn = editForm.inn.trim();
  if (editForm.orgForm !== (c.orgForm ?? "")) body.orgForm = editForm.orgForm;
  if (editForm.connected !== c.connected) body.connected = editForm.connected;
  if (editForm.key) body.key = editForm.key;
  if (editForm.sugar) body.sugar = editForm.sugar;
  if (editForm.apiAgent) body.apiAgent = editForm.apiAgent;
  if (editForm.language) body.language = editForm.language;

  editBusy.value = true;
  editError.value = null;
  try {
    await store.update(c.id, body);
    editTarget.value = null;
  } catch (e) {
    editError.value = e instanceof Error ? e.message : "Saqlab bo'lmadi";
  } finally {
    editBusy.value = false;
  }
}

async function handleReauth(cred: ApiCredential) {
  if (reauthBusyId.value) return;
  reauthBusyId.value = cred.id;
  try {
    await store.reauthorize(cred.id);
  } catch (e) {
    store.error = e instanceof Error ? e.message : "Qayta-auth xato";
  } finally {
    reauthBusyId.value = null;
  }
}

const deleteTarget = ref<ApiCredential | null>(null);
const deleteBusy = ref(false);

async function handleDelete() {
  if (!deleteTarget.value || deleteBusy.value) return;
  deleteBusy.value = true;
  try {
    await store.remove(deleteTarget.value.id);
    if (editTarget.value?.id === deleteTarget.value.id) editTarget.value = null;
    deleteTarget.value = null;
  } catch (e) {
    store.error = e instanceof Error ? e.message : "O'chirib bo'lmadi";
  } finally {
    deleteBusy.value = false;
  }
}

onMounted(() => {
  // URL'ni kanonik holatga keltiramiz: /settings yoki yaroqsiz tab → /settings/account
  const p = route.params.tab;
  if (typeof p !== "string" || !TAB_KEYS.includes(p as TabKey)) {
    router.replace({ name: "settings", params: { tab: DEFAULT_TAB } });
  }
  store.ensureLoaded();
  loadRate();
  loadBhm();
});
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div>
        <h1>{{ t("settings.title") }}</h1>
        <div class="crumb-sub">{{ t("settings.subtitle") }}</div>
      </div>
      <div class="topbar-right">
        <TopbarSettings />
      </div>
    </header>

    <div class="page-scroll scroll">
      <div class="page-inner fade-page">
        <div class="set-layout">
          <!-- ===== chap tab navigatsiya ===== -->
          <nav class="set-tabs">
            <button
              v-for="tab in TABS"
              :key="tab.key"
              class="set-tab"
              :class="{ on: active === tab.key }"
              @click="setTab(tab.key)"
            >
              {{ t(tab.label) }}
            </button>
          </nav>

          <!-- ===== o'ng kontent ===== -->
          <div class="set-content">
            <!-- ---------- Hisob va til ---------- -->
            <section v-if="active === 'account'" class="set-panel">
              <div class="sp-head">
                <div class="sp-title">{{ t("settings.tab.account") }}</div>
              </div>

              <div class="acc-row">
                <div class="ent-av lg">
                  {{ auth.user ? initials(auth.user.name) : "?" }}
                </div>
                <div>
                  <div class="acc-name">{{ auth.user?.name }}</div>
                  <div class="acc-handle">
                    @{{ auth.user?.telegramUsername ?? auth.user?.username }}
                  </div>
                </div>
              </div>

              <div class="sp-divider" />

              <div class="fld-label">{{ t("settings.language") }}</div>
              <div class="lang-switch">
                <button
                  v-for="l in LOCALES"
                  :key="l"
                  :class="['lang-opt', { on: locale === l }]"
                  :disabled="langSaving"
                  @click="changeLanguage(l)"
                >
                  {{ t("lang." + l) }}
                </button>
              </div>
            </section>

            <!-- ---------- USD kurs ---------- -->
            <section v-else-if="active === 'rate'" class="set-panel">
              <div class="sp-head">
                <div class="sp-title">{{ t("settings.rate.title") }}</div>
              </div>

              <div class="rate-big">
                {{ rate ? fmtMoney(rate.rate) : "—"
                }}<span class="rate-unit">{{ t("settings.rate.perUsd") }}</span>
              </div>
              <div class="rate-src">
                {{ t("settings.rate.source") }}: {{ rateSourceLabel }}
              </div>

              <div class="fld-label rate-mode-label">
                {{ t("settings.rate.mode") }}
              </div>
              <div class="seg rate-seg">
                <button
                  :class="{ on: rateMode === 'live' }"
                  :disabled="rateBusy"
                  @click="setRateLive"
                >
                  {{ t("settings.rate.live") }}
                </button>
                <button
                  :class="{ on: rateMode === 'override' }"
                  :disabled="rateBusy"
                  @click="pickOverrideMode"
                >
                  {{ t("settings.rate.override") }}
                </button>
              </div>

              <div v-if="rateMode === 'override'" class="rate-manual">
                <label class="fld-label">{{ t("settings.rate.manual") }}</label>
                <div class="rate-manual-row">
                  <input
                    v-model.number="manualRate"
                    class="text-input"
                    type="number"
                    min="0"
                    inputmode="numeric"
                    @keyup.enter="saveOverride"
                  />
                  <button
                    class="btn btn-accent"
                    :disabled="rateBusy"
                    @click="saveOverride"
                  >
                    {{ rateBusy ? "…" : t("settings.common.save") }}
                  </button>
                </div>
              </div>

              <p v-if="rateError" class="form-err">{{ rateError }}</p>
            </section>

            <!-- ---------- BHM ---------- -->
            <section v-else-if="active === 'bhm'" class="set-panel">
              <div class="sp-head">
                <div>
                  <div class="sp-title">{{ t("settings.bhm.title") }}</div>
                  <div class="sp-sub">{{ t("settings.bhm.hint") }}</div>
                </div>
                <button class="btn btn-ghost" @click="openBhmAdd">
                  <BaseIcon name="plus" />{{ t("settings.bhm.add") }}
                </button>
              </div>

              <div v-if="bhmLoading" class="set-loading">Yuklanmoqda…</div>
              <p v-else-if="bhmError" class="form-err">{{ bhmError }}</p>
              <div v-else-if="!bhmList.length" class="set-loading">
                {{ t("settings.bhm.empty") }}
              </div>
              <div v-else class="bhm-list">
                <div v-for="b in bhmList" :key="b.id" class="bhm-row">
                  <span class="bhm-date">{{ fmtDateShort(b.effectiveFrom) }}</span>
                  <span v-if="b.id === bhmCurrentId" class="bhm-cur">
                    {{ t("settings.bhm.current") }}
                  </span>
                  <span class="bhm-amount">
                    {{ fmtMoney(b.amount) }} {{ t("settings.common.unit.sum") }}
                  </span>
                  <button
                    class="act-btn"
                    title="Tahrirlash"
                    @click="openBhmEdit(b)"
                  >
                    <BaseIcon name="arrowRight" />
                  </button>
                  <button
                    class="act-btn danger"
                    title="O'chirish"
                    @click="bhmDeleteTarget = b"
                  >
                    <BaseIcon name="trash" />
                  </button>
                </div>
              </div>
            </section>

            <!-- ---------- Marja narvoni ---------- -->
            <section v-else-if="active === 'margin'" class="set-panel margin-panel">
              <MarjaTable />
            </section>

            <!-- ---------- Yuridik shaxslar ---------- -->
            <section v-else class="set-panel">
              <div class="sp-head">
                <div>
                  <div class="sp-title">{{ t("settings.entities.title") }}</div>
                  <div class="sp-sub">
                    {{ stats.total }} · {{ stats.connected }} ulangan ·
                    {{ stats.disconnected }} ulanmagan
                  </div>
                </div>
                <button class="btn btn-accent" @click="openAdd">
                  <BaseIcon name="plus" />{{ t("settings.entities.add") }}
                </button>
              </div>

              <!-- loading -->
              <div
                v-if="store.loading && !store.loaded"
                class="set-loading"
              >
                Yuklanmoqda…
              </div>

              <!-- error -->
              <div v-else-if="store.error && !store.loaded">
                <EmptyState
                  icon="alert"
                  title="Yuklab bo'lmadi"
                  :description="store.error"
                />
              </div>

              <!-- empty -->
              <div v-else-if="store.count === 0">
                <EmptyState
                  icon="shield"
                  title="Hali credential yo'q"
                  description="“Legal entity qo'shish” yoki E-IMZO extension orqali qo'shing."
                />
              </div>

              <!-- table -->
              <div v-else class="dt-wrap">
                <table class="dt set-dt">
                  <thead>
                    <tr>
                      <th>Yuridik shaxs</th>
                      <th>INN / PNFL</th>
                      <th>Hudud</th>
                      <th>Holat</th>
                      <th>Oxirgi yangilanish</th>
                      <th class="r">Amallar</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="c in store.items"
                      :key="c.id"
                      style="cursor: pointer"
                      @click="openEdit(c)"
                    >
                      <td>
                        <div class="cell-prod">
                          <div class="ent-av">{{ initials(c.name) }}</div>
                          <div style="min-width: 0">
                            <div class="c-title">
                              {{ c.name }}
                              <span v-if="c.orgForm" class="count-pill">{{
                                c.orgForm
                              }}</span>
                            </div>
                            <div class="c-sub">{{ c.username }}</div>
                          </div>
                        </div>
                      </td>
                      <td><span class="num">{{ c.inn ?? "—" }}</span></td>
                      <td><span class="set-dir">{{ c.regionName ?? "—" }}</span></td>
                      <td>
                        <span
                          class="cred-status"
                          :class="c.connected ? 'active' : 'expired'"
                        >
                          <span class="cs-dot" />
                          {{ c.connected ? "Ulangan" : "Ulanmagan" }}
                        </span>
                      </td>
                      <td>
                        <span class="set-sync">
                          <BaseIcon name="clock" />
                          {{
                            c.lastReauthorizedAt
                              ? relativeAgo(c.lastReauthorizedAt)
                              : "—"
                          }}
                        </span>
                      </td>
                      <td @click.stop>
                        <div class="row-actions">
                          <button
                            class="act-btn"
                            title="Hozir qayta-auth qilish"
                            :disabled="reauthBusyId === c.id"
                            @click="handleReauth(c)"
                          >
                            <BaseIcon name="refresh" />
                          </button>
                          <button class="act-btn" title="Tahrirlash" @click="openEdit(c)">
                            <BaseIcon name="arrowRight" />
                          </button>
                          <button
                            class="act-btn danger"
                            title="O'chirish"
                            @click="deleteTarget = c"
                          >
                            <BaseIcon name="trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== BHM add/edit modal ===== -->
    <template v-if="bhmModalOpen">
      <div class="modal-scrim" @click="bhmModalOpen = false">
        <div class="modal sm" @click.stop>
          <div class="modal-top">
            <span class="mt-eyebrow">
              {{ bhmEditTarget ? t("settings.bhm.editTitle") : t("settings.bhm.addTitle") }}
            </span>
            <button class="icon-btn modal-x" @click="bhmModalOpen = false">
              <BaseIcon name="x" />
            </button>
          </div>
          <div class="modal-body scroll">
            <div class="set-fields">
              <div class="fld full">
                <label class="fld-label">{{ t("settings.bhm.amount") }}</label>
                <input
                  v-model="bhmForm.amount"
                  class="text-input"
                  type="number"
                  min="0"
                  inputmode="numeric"
                  placeholder="375000"
                />
              </div>
              <div class="fld full">
                <label class="fld-label">{{ t("settings.bhm.effectiveFrom") }}</label>
                <input v-model="bhmForm.effectiveFrom" class="text-input" type="date" />
              </div>
              <div class="fld full">
                <label class="fld-label">{{ t("settings.bhm.note") }}</label>
                <input v-model="bhmForm.note" class="text-input" />
              </div>
            </div>
            <p v-if="bhmFormError" class="form-err">{{ bhmFormError }}</p>
          </div>
          <div class="drawer-foot">
            <div class="sidebar-spacer" />
            <button class="btn btn-ghost" @click="bhmModalOpen = false">
              {{ t("settings.common.cancel") }}
            </button>
            <button class="btn btn-accent" :disabled="bhmBusy" @click="saveBhm">
              {{ bhmBusy ? "…" : t("settings.common.save") }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- ===== BHM o'chirish tasdiq ===== -->
    <template v-if="bhmDeleteTarget">
      <div class="dialog-scrim" @click="bhmDeleteTarget = null">
        <div class="dialog" @click.stop>
          <div class="dialog-icon"><BaseIcon name="trash" /></div>
          <div class="dialog-title">{{ t("settings.bhm.deleteConfirm") }}</div>
          <div class="dialog-body">
            <b>{{ fmtMoney(bhmDeleteTarget.amount) }} {{ t("settings.common.unit.sum") }}</b>
            ({{ fmtDateShort(bhmDeleteTarget.effectiveFrom) }})
          </div>
          <div class="dialog-actions">
            <button class="btn btn-ghost" @click="bhmDeleteTarget = null">
              {{ t("settings.common.cancel") }}
            </button>
            <button class="btn btn-danger" :disabled="bhmDeleteBusy" @click="handleBhmDelete">
              {{ bhmDeleteBusy ? "…" : t("settings.common.delete") }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- ===== Add drawer (ikki usul: qo'lda / fetch-cURL) ===== -->
    <template v-if="addOpen">
      <div class="modal-scrim" @click="addOpen = false">
        <div class="modal" @click.stop>
          <div class="modal-top">
            <span class="mt-eyebrow">Yangi legal entity</span>
            <button class="icon-btn modal-x" @click="addOpen = false">
              <BaseIcon name="x" />
            </button>
          </div>

          <div class="modal-body scroll">
            <div class="drawer-hero">
              <div class="ent-av lg">
                {{ form.name.trim() ? initials(form.name) : "?" }}
              </div>
              <div>
                <div class="dh-name">{{ form.name.trim() || "Tashkilot nomi" }}</div>
                <div class="dh-sub">
                  {{ form.inn.trim() ? "INN " + form.inn : "INN kiritilmagan" }}
                </div>
              </div>
            </div>

            <div class="seg" style="margin-top: 18px">
              <button :class="{ on: addMode === 'manual' }" @click="addMode = 'manual'">
                Qo'lda
              </button>
              <button :class="{ on: addMode === 'raw' }" @click="addMode = 'raw'">
                Fetch / cURL
              </button>
            </div>

            <template v-if="addMode === 'manual'">
              <div class="set-group">
                <div class="fg-head">
                  <div class="fg-icon"><BaseIcon name="building" /></div>
                  <div class="fg-title">Tashkilot ma'lumotlari</div>
                </div>
                <div class="set-fields">
                  <div class="fld full">
                    <label class="fld-label"
                      >Tashkilot nomi <span class="fg-badge maj">majburiy</span></label
                    >
                    <input
                      v-model="form.name"
                      class="text-input"
                      placeholder="masalan: Aziz Savdo Plyus"
                    />
                  </div>
                  <div class="fld">
                    <label class="fld-label">Tashkilot shakli</label>
                    <BaseSelect v-model="form.orgForm" :options="ORG_FORM_OPTS" />
                  </div>
                  <div class="fld">
                    <label class="fld-label"
                      >INN / PNFL <span class="fg-badge maj">majburiy</span></label
                    >
                    <input
                      v-model="form.inn"
                      class="text-input"
                      inputmode="numeric"
                      placeholder="000 000 000"
                    />
                  </div>
                </div>
              </div>

              <div class="set-group">
                <div class="fg-head">
                  <div class="fg-icon"><BaseIcon name="inbox" /></div>
                  <div class="fg-title">Aloqa</div>
                </div>
                <div class="set-fields">
                  <div class="fld">
                    <label class="fld-label">Direktor / F.I.O.</label>
                    <input v-model="form.director" class="text-input" placeholder="To'liq ism" />
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
                    <label class="fld-label"
                      >Hudud <span class="fg-badge maj">majburiy</span></label
                    >
                    <BaseSelect v-model="form.region" :options="REGION_OPTS" />
                  </div>
                </div>
              </div>

              <div class="set-group">
                <div class="fg-head">
                  <div class="fg-icon"><BaseIcon name="vector" /></div>
                  <div class="fg-title">Integratsiya holati</div>
                </div>
                <div class="status-picker two">
                  <button
                    v-for="o in CONNECT_OPTS"
                    :key="String(o.v)"
                    :class="['status-opt', o.cls, { on: form.connected === o.v }]"
                    @click="form.connected = o.v"
                  >
                    <span class="so-dot" />{{ o.l }}
                  </button>
                </div>
              </div>

              <div class="set-group">
                <div class="fg-head">
                  <div class="fg-icon"><BaseIcon name="shield" /></div>
                  <div class="fg-title">Auth kirishlari</div>
                  <span class="fg-badge maj">majburiy</span>
                </div>
                <div class="set-fields">
                  <div class="fld">
                    <label class="fld-label">key</label>
                    <input
                      v-model="form.key"
                      class="text-input"
                      type="password"
                      placeholder="authorizeV2 key"
                    />
                  </div>
                  <div class="fld">
                    <label class="fld-label">sugar</label>
                    <input
                      v-model="form.sugar"
                      class="text-input"
                      type="password"
                      placeholder="authorizeV2 sugar"
                    />
                  </div>
                  <div class="fld full">
                    <label class="fld-label">api-agent</label>
                    <input
                      v-model="form.apiAgent"
                      class="text-input"
                      placeholder="api-agent header"
                    />
                  </div>
                </div>
                <p style="font-size: 12px; color: var(--ink-4); margin-top: 10px">
                  key/sugar serverda shifrlanadi. Tashkilot nomi, INN va hudud uzex
                  avtorizatsiyasidan keyin tasdiqlanadi.
                </p>
              </div>
            </template>

            <template v-else>
              <div class="set-group">
                <div class="fg-head">
                  <div class="fg-icon"><BaseIcon name="doc" /></div>
                  <div class="fg-title">Brauzerdan ko'chirilgan so'rov</div>
                </div>
                <div class="fld">
                  <label class="fld-label">
                    AuthorizeV2 so'rovi (Copy as fetch / Copy as cURL)
                  </label>
                  <textarea
                    v-model="raw"
                    class="form-textarea"
                    rows="9"
                    placeholder="fetch(&quot;https://idapi.uzex.uz/...&quot;, { ... }) yoki curl '...'"
                  />
                </div>
                <p style="font-size: 12px; color: var(--ink-4); margin-top: 10px">
                  key/sugar serverda shifrlanadi va hech qachon ochiq ko'rsatilmaydi.
                </p>
              </div>
            </template>

            <p v-if="addError" class="form-err">{{ addError }}</p>
          </div>

          <div class="drawer-foot">
            <div class="sidebar-spacer" />
            <button class="btn btn-ghost" @click="addOpen = false">Bekor qilish</button>
            <button class="btn btn-accent" :disabled="!canSubmit || addBusy" @click="handleAdd">
              {{ addBusy ? "Qo'shilmoqda…" : "Qo'shish" }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- ===== Edit drawer ===== -->
    <template v-if="editTarget">
      <div class="modal-scrim" @click="editTarget = null">
        <div class="modal" @click.stop>
          <div class="modal-top">
            <span class="mt-eyebrow">Credential</span>
            <button class="icon-btn modal-x" @click="editTarget = null">
              <BaseIcon name="x" />
            </button>
          </div>
          <div class="modal-body scroll">
            <div class="drawer-hero">
              <div class="ent-av lg">{{ initials(editTarget.name) }}</div>
              <div>
                <div class="dh-name">{{ editTarget.name }}</div>
                <div class="dh-sub">{{ editTarget.username }}</div>
              </div>
            </div>

            <div class="set-group">
              <div class="fg-head">
                <div class="fg-icon"><BaseIcon name="building" /></div>
                <div class="fg-title">Tashkilot ma'lumotlari</div>
              </div>
              <div class="set-fields">
                <div class="fld full">
                  <label class="fld-label">Tashkilot nomi</label>
                  <input v-model="editForm.name" class="text-input" />
                </div>
                <div class="fld">
                  <label class="fld-label">Tashkilot shakli</label>
                  <BaseSelect v-model="editForm.orgForm" :options="ORG_FORM_EDIT_OPTS" />
                </div>
                <div class="fld">
                  <label class="fld-label">INN / PNFL</label>
                  <input v-model="editForm.inn" class="text-input" inputmode="numeric" />
                </div>
              </div>
            </div>

            <div class="set-group">
              <div class="fg-head">
                <div class="fg-icon"><BaseIcon name="vector" /></div>
                <div class="fg-title">Integratsiya holati</div>
              </div>
              <div class="status-picker two">
                <button
                  v-for="o in CONNECT_OPTS"
                  :key="String(o.v)"
                  :class="['status-opt', o.cls, { on: editForm.connected === o.v }]"
                  @click="editForm.connected = o.v"
                >
                  <span class="so-dot" />{{ o.l }}
                </button>
              </div>
              <p style="font-size: 12px; color: var(--ink-4); margin-top: 10px">
                Faqat “Ulangan” credentiallardan lotlar olinadi.
              </p>
            </div>

            <div class="set-group">
              <dl class="kv-grid">
                <div class="kv"><dt>Hudud</dt><dd>{{ editTarget.regionName ?? "—" }}</dd></div>
                <div class="kv">
                  <dt>Token holati</dt>
                  <dd>{{ editTarget.status === "ACTIVE" ? "Faol" : "Eskirgan" }}</dd>
                </div>
                <div class="kv"><dt>Token muddati</dt><dd>{{ fmtDate(editTarget.expiredAt) }}</dd></div>
                <div class="kv">
                  <dt>Oxirgi yangilanish</dt>
                  <dd>{{ fmtDate(editTarget.lastReauthorizedAt) }}</dd>
                </div>
                <div class="kv"><dt>Telefon</dt><dd>{{ editTarget.phone ?? "—" }}</dd></div>
              </dl>
            </div>

            <div class="set-group">
              <div class="fg-head">
                <div class="fg-icon"><BaseIcon name="shield" /></div>
                <div class="fg-title">Auth kirishlarini yangilash</div>
                <span class="fg-badge opt">ixtiyoriy</span>
              </div>
              <div class="set-fields">
                <div class="fld">
                  <label class="fld-label">key</label>
                  <input
                    v-model="editForm.key"
                    class="text-input"
                    type="password"
                    placeholder="o'zgartirmaslik uchun bo'sh qoldiring"
                  />
                </div>
                <div class="fld">
                  <label class="fld-label">sugar</label>
                  <input
                    v-model="editForm.sugar"
                    class="text-input"
                    type="password"
                    placeholder="o'zgartirmaslik uchun bo'sh qoldiring"
                  />
                </div>
                <div class="fld full">
                  <label class="fld-label">api-agent</label>
                  <input
                    v-model="editForm.apiAgent"
                    class="text-input"
                    placeholder="o'zgartirmaslik uchun bo'sh qoldiring"
                  />
                </div>
              </div>
              <p v-if="editError" class="form-err">{{ editError }}</p>
            </div>
          </div>
          <div class="drawer-foot">
            <button
              class="btn btn-ghost"
              :disabled="reauthBusyId === editTarget.id"
              @click="handleReauth(editTarget)"
            >
              <BaseIcon name="refresh" />Hozir qayta-auth
            </button>
            <div class="sidebar-spacer" />
            <button class="btn btn-ghost" @click="editTarget = null">Yopish</button>
            <button class="btn btn-accent" :disabled="!hasEdits || editBusy" @click="handleSave">
              {{ editBusy ? "Saqlanmoqda…" : "Saqlab qayta-auth" }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- ===== Credential o'chirish tasdiq ===== -->
    <template v-if="deleteTarget">
      <div class="dialog-scrim" @click="deleteTarget = null">
        <div class="dialog" @click.stop>
          <div class="dialog-icon"><BaseIcon name="trash" /></div>
          <div class="dialog-title">Credential o'chirilsinmi?</div>
          <div class="dialog-body">
            <b>{{ deleteTarget.name }}</b> ro'yxatdan olib tashlanadi va integratsiya
            to'xtaydi. Yozuv saqlanadi — xohlasangiz keyin qayta ulashingiz mumkin.
          </div>
          <div class="dialog-actions">
            <button class="btn btn-ghost" @click="deleteTarget = null">Bekor</button>
            <button class="btn btn-danger" :disabled="deleteBusy" @click="handleDelete">
              {{ deleteBusy ? "O'chirilmoqda…" : "O'chirish" }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* ===== tabbed layout ===== */
.set-layout {
  display: grid;
  grid-template-columns: 232px 1fr;
  gap: 18px;
  align-items: start;
}
.set-tabs {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  padding: 6px;
  position: sticky;
  top: 0;
}
.set-tab {
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  text-align: left;
  color: var(--ink-2);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}
.set-tab:hover {
  background: var(--surface-3);
  color: var(--ink);
}
.set-tab.on {
  background: var(--accent-soft);
  color: var(--accent-ink);
}
.set-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  padding: 22px 24px;
}
.set-panel.margin-panel {
  padding-top: 8px;
}
.sp-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}
.sp-title {
  font-size: 15px;
  font-weight: 700;
}
.sp-sub {
  font-size: 12.5px;
  color: var(--ink-3);
  margin-top: 3px;
}
.sp-divider {
  height: 1px;
  background: var(--border);
  margin: 20px 0 16px;
}
.set-loading {
  padding: 30px;
  text-align: center;
  color: var(--ink-3);
  font-size: 13px;
}

/* ===== account ===== */
.acc-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.acc-name {
  font-size: 14.5px;
  font-weight: 700;
}
.acc-handle {
  font-size: 12.5px;
  color: var(--ink-3);
  margin-top: 2px;
  font-family: var(--mono);
}
.lang-switch {
  display: inline-flex;
  gap: 3px;
  background: var(--surface-3);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 3px;
  margin-top: 6px;
}
.lang-opt {
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink-3);
  background: none;
  border: none;
  border-radius: 6px;
  padding: 7px 18px;
  cursor: pointer;
}
.lang-opt.on {
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-sm);
}

/* ===== USD kurs ===== */
.rate-big {
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.5px;
  font-variant-numeric: tabular-nums;
}
.rate-unit {
  font-size: 15px;
  font-weight: 500;
  color: var(--ink-3);
  margin-left: 8px;
}
.rate-src {
  font-size: 12.5px;
  color: var(--good-ink);
  margin-top: 6px;
}
.rate-mode-label {
  margin-top: 20px;
}
.rate-seg {
  margin-top: 6px;
}
.rate-manual {
  margin-top: 16px;
}
.rate-manual-row {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}
.rate-manual-row .text-input {
  max-width: 260px;
}

/* ===== BHM ===== */
.bhm-list {
  display: flex;
  flex-direction: column;
}
.bhm-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 4px;
  border-bottom: 1px solid var(--border);
}
.bhm-row:last-child {
  border-bottom: none;
}
.bhm-date {
  font-size: 13.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.bhm-cur {
  font-size: 11px;
  font-weight: 700;
  color: var(--good-ink);
  background: var(--good-soft);
  border: 1px solid var(--good-line);
  border-radius: 20px;
  padding: 2px 9px;
}
.bhm-amount {
  margin-left: auto;
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.act-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface);
  color: var(--ink-3);
  cursor: pointer;
}
.act-btn:hover {
  color: var(--ink);
  border-color: var(--border-2);
}
.act-btn.danger:hover {
  color: var(--bad);
  border-color: var(--bad-line);
}

/* modal kichik varianti (BHM) */
.modal.sm {
  max-width: 440px;
}

@media (max-width: 720px) {
  .set-layout {
    grid-template-columns: 1fr;
  }
  .set-tabs {
    flex-direction: row;
    flex-wrap: wrap;
    position: static;
  }
}
</style>
