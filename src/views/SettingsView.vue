<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useCredentialStore } from "@/stores/credentials";
import { useAuthStore } from "@/stores/auth";
import { useI18n } from "@/composables/useI18n";
import { LOCALES } from "@/i18n";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import BaseSelect from "@/components/shared/BaseSelect.vue";
import EmptyState from "@/components/shared/EmptyState.vue";
import TopbarSettings from "@/components/layout/TopbarSettings.vue";
import { relativeAgo } from "@/lib/formatters";
import type { ApiCredential, CredentialUpdate } from "@/types/credential";

const store = useCredentialStore();
const auth = useAuthStore();
const { t, locale, setLocale } = useI18n();

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

// tashkilot shakllari va hududlar (qo'lda forma uchun)
const ORG_FORM_OPTS = ["YaTT", "MChJ", "AJ", "XK", "QK"].map((v) => ({
  v,
  l: v,
}));
// tahrirlashda bo'sh (tanlanmagan) holatni ko'rsatish uchun
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
// Integratsiya holati — qo'lda boshqariladigan ulanish flagi (pipeline faqat
// "Ulangan"lardan lot oladi).
const CONNECT_OPTS: { v: boolean; l: string; cls: string }[] = [
  { v: true, l: "Ulangan", cls: "connected" },
  { v: false, l: "Ulanmagan", cls: "disconnected" },
];

// --- qo'shish drawer'i (ikki usul: qo'lda / fetch-cURL) ---
const addOpen = ref(false);
const addMode = ref<AddMode>("manual");
const addBusy = ref(false);
const addError = ref<string | null>(null);

// qo'lda forma. Biznes maydonlari rasmga mos ko'rsatiladi; credential aslida
// auth kirishlaridan (key/sugar/api-agent) yaratiladi — profil uzex'dan keladi.
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

// fetch / cURL matni
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

// --- edit drawer ---
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

// id-ma'lum qayta-auth holati (jadval qatoridagi tugma uchun)
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
  const t = editTarget.value;
  if (!t) return false;
  return (
    editForm.name.trim() !== (t.name ?? "") ||
    editForm.inn.trim() !== (t.inn ?? "") ||
    editForm.orgForm !== (t.orgForm ?? "") ||
    editForm.connected !== t.connected ||
    !!editForm.key ||
    !!editForm.sugar ||
    !!editForm.apiAgent ||
    !!editForm.language
  );
});

async function handleSave() {
  const t = editTarget.value;
  if (!t || !hasEdits.value || editBusy.value) return;
  if (!editForm.name.trim()) {
    editError.value = "Tashkilot nomi bo'sh bo'lmasligi kerak";
    return;
  }
  const body: CredentialUpdate = {};
  // qo'lda profil — faqat o'zgargan bo'lsa
  if (editForm.name.trim() !== (t.name ?? "")) body.name = editForm.name.trim();
  if (editForm.inn.trim() !== (t.inn ?? "")) body.inn = editForm.inn.trim();
  if (editForm.orgForm !== (t.orgForm ?? "")) body.orgForm = editForm.orgForm;
  if (editForm.connected !== t.connected) body.connected = editForm.connected;
  // auth — kiritilgan bo'lsa
  if (editForm.key) body.key = editForm.key;
  if (editForm.sugar) body.sugar = editForm.sugar;
  if (editForm.apiAgent) body.apiAgent = editForm.apiAgent;
  if (editForm.language) body.language = editForm.language;

  editBusy.value = true;
  editError.value = null;
  try {
    await store.update(t.id, body);
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

// --- o'chirish tasdiq dialogi ---
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
  store.ensureLoaded();
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
        <button class="btn btn-add" @click="openAdd">
          <BaseIcon name="plus" />Legal entity qo'shish
        </button>
        <TopbarSettings />
      </div>
    </header>

    <div class="page-scroll scroll">
      <div class="page-inner fade-page">
        <!-- account + interfeys tili -->
        <div class="set-card">
          <div class="set-row">
            <div class="sr-ic"><BaseIcon name="user" /></div>
            <div class="sr-main">
              <div class="sr-title">{{ t("settings.account") }}</div>
              <div class="sr-sub">
                {{ auth.user?.name }} · {{ auth.user?.username }}
                <template v-if="auth.user?.telegramUsername">
                  · @{{ auth.user.telegramUsername }}
                </template>
              </div>
            </div>
          </div>
          <div class="set-divider" />
          <div class="set-row">
            <div class="sr-ic"><BaseIcon name="map" /></div>
            <div class="sr-main">
              <div class="sr-title">{{ t("settings.language") }}</div>
              <div class="sr-sub">{{ t("settings.language.hint") }}</div>
            </div>
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
          </div>
        </div>

        <div class="integ-banner">
          <div class="ib-icon"><BaseIcon name="shield" /></div>
          <div class="ib-main">
            <div class="ib-title">uzex.uz integratsiyasi</div>
            <div class="ib-sub">
              Har bir yuridik shaxs (magazin) tokeni avtomatik (har 5 soatda)
              yangilanadi
            </div>
          </div>
          <div class="ib-stats">
            <div class="ibs">
              <b class="num">{{ stats.total }}</b
              ><span>Jami</span>
            </div>
            <div class="ibs">
              <b class="num">{{ stats.connected }}</b
              ><span>Ulangan</span>
            </div>
            <div class="ibs">
              <b class="num">{{ stats.disconnected }}</b
              ><span>Ulanmagan</span>
            </div>
          </div>
        </div>

        <!-- loading -->
        <div
          v-if="store.loading && !store.loaded"
          class="panel"
          style="
            margin-top: 22px;
            padding: 40px;
            text-align: center;
            color: var(--ink-3);
          "
        >
          Yuklanmoqda…
        </div>

        <!-- error -->
        <div v-else-if="store.error && !store.loaded" style="margin-top: 22px">
          <EmptyState
            icon="alert"
            title="Yuklab bo'lmadi"
            :description="store.error"
          />
        </div>

        <!-- empty -->
        <div v-else-if="store.count === 0" style="margin-top: 22px">
          <EmptyState
            icon="shield"
            title="Hali credential yo'q"
            description="“Credential ulash” orqali brauzerdan ko'chirgan fetch yoki cURL'ni joylang."
          />
        </div>

        <!-- table -->
        <div v-else class="dt-wrap" style="margin-top: 22px">
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
                <td>
                  <span class="num">{{ c.inn ?? "—" }}</span>
                </td>
                <td>
                  <span class="set-dir">{{ c.regionName ?? "—" }}</span>
                </td>
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
                    <button
                      class="act-btn"
                      title="Tahrirlash"
                      @click="openEdit(c)"
                    >
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
      </div>
    </div>

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
            <!-- hero -->
            <div class="drawer-hero">
              <div class="ent-av lg">
                {{ form.name.trim() ? initials(form.name) : "?" }}
              </div>
              <div>
                <div class="dh-name">
                  {{ form.name.trim() || "Tashkilot nomi" }}
                </div>
                <div class="dh-sub">
                  {{ form.inn.trim() ? "INN " + form.inn : "INN kiritilmagan" }}
                </div>
              </div>
            </div>

            <!-- usul tanlovi -->
            <div class="seg" style="margin-top: 18px">
              <button
                :class="{ on: addMode === 'manual' }"
                @click="addMode = 'manual'"
              >
                Qo'lda
              </button>
              <button
                :class="{ on: addMode === 'raw' }"
                @click="addMode = 'raw'"
              >
                Fetch / cURL
              </button>
            </div>

            <!-- ===== Qo'lda ===== -->
            <template v-if="addMode === 'manual'">
              <div class="set-group">
                <div class="fg-head">
                  <div class="fg-icon"><BaseIcon name="building" /></div>
                  <div class="fg-title">Tashkilot ma'lumotlari</div>
                </div>
                <div class="set-fields">
                  <div class="fld full">
                    <label class="fld-label"
                      >Tashkilot nomi
                      <span class="fg-badge maj">majburiy</span></label
                    >
                    <input
                      v-model="form.name"
                      class="text-input"
                      placeholder="masalan: Aziz Savdo Plyus"
                    />
                  </div>
                  <div class="fld">
                    <label class="fld-label">Tashkilot shakli</label>
                    <BaseSelect
                      v-model="form.orgForm"
                      :options="ORG_FORM_OPTS"
                    />
                  </div>
                  <div class="fld">
                    <label class="fld-label"
                      >INN / PNFL
                      <span class="fg-badge maj">majburiy</span></label
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
                    <input
                      v-model="form.director"
                      class="text-input"
                      placeholder="To'liq ism"
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
                    :class="[
                      'status-opt',
                      o.cls,
                      { on: form.connected === o.v },
                    ]"
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
                <p
                  style="font-size: 12px; color: var(--ink-4); margin-top: 10px"
                >
                  key/sugar serverda shifrlanadi. Tashkilot nomi, INN va hudud
                  uzex avtorizatsiyasidan keyin tasdiqlanadi.
                </p>
              </div>
            </template>

            <!-- ===== Fetch / cURL ===== -->
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
                <p
                  style="font-size: 12px; color: var(--ink-4); margin-top: 10px"
                >
                  key/sugar serverda shifrlanadi va hech qachon ochiq
                  ko'rsatilmaydi.
                </p>
              </div>
            </template>

            <p v-if="addError" class="form-err">{{ addError }}</p>
          </div>

          <div class="drawer-foot">
            <div class="sidebar-spacer" />
            <button class="btn btn-ghost" @click="addOpen = false">
              Bekor qilish
            </button>
            <button
              class="btn btn-accent"
              :disabled="!canSubmit || addBusy"
              @click="handleAdd"
            >
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
                  <BaseSelect
                    v-model="editForm.orgForm"
                    :options="ORG_FORM_EDIT_OPTS"
                  />
                </div>
                <div class="fld">
                  <label class="fld-label">INN / PNFL</label>
                  <input
                    v-model="editForm.inn"
                    class="text-input"
                    inputmode="numeric"
                  />
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
                  :class="[
                    'status-opt',
                    o.cls,
                    { on: editForm.connected === o.v },
                  ]"
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
                <div class="kv">
                  <dt>Hudud</dt>
                  <dd>{{ editTarget.regionName ?? "—" }}</dd>
                </div>
                <div class="kv">
                  <dt>Token holati</dt>
                  <dd>
                    {{ editTarget.status === "ACTIVE" ? "Faol" : "Eskirgan" }}
                  </dd>
                </div>
                <div class="kv">
                  <dt>Token muddati</dt>
                  <dd>{{ fmtDate(editTarget.expiredAt) }}</dd>
                </div>
                <div class="kv">
                  <dt>Oxirgi yangilanish</dt>
                  <dd>{{ fmtDate(editTarget.lastReauthorizedAt) }}</dd>
                </div>
                <div class="kv">
                  <dt>Telefon</dt>
                  <dd>{{ editTarget.phone ?? "—" }}</dd>
                </div>
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
            <button class="btn btn-ghost" @click="editTarget = null">
              Yopish
            </button>
            <button
              class="btn btn-accent"
              :disabled="!hasEdits || editBusy"
              @click="handleSave"
            >
              {{ editBusy ? "Saqlanmoqda…" : "Saqlab qayta-auth" }}
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
          <div class="dialog-title">Credential o'chirilsinmi?</div>
          <div class="dialog-body">
            <b>{{ deleteTarget.name }}</b> ro'yxatdan olib tashlanadi va
            integratsiya to'xtaydi. Yozuv saqlanadi — xohlasangiz keyin qayta
            ulashingiz mumkin.
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
.set-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  padding: 6px 16px;
  margin-bottom: 16px;
}
.set-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
}
.sr-ic {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: var(--surface-3);
  color: var(--ink-2);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.sr-ic :deep(svg) {
  width: 17px;
  height: 17px;
}
.sr-main {
  flex: 1;
  min-width: 0;
}
.sr-title {
  font-size: 14px;
  font-weight: 650;
}
.sr-sub {
  font-size: 12.5px;
  color: var(--ink-3);
  margin-top: 2px;
}
.set-divider {
  height: 1px;
  background: var(--border);
}
.lang-switch {
  display: flex;
  gap: 3px;
  background: var(--surface-3);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 3px;
  flex-shrink: 0;
}
.lang-opt {
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink-3);
  background: none;
  border: none;
  border-radius: 6px;
  padding: 6px 13px;
  cursor: pointer;
}
.lang-opt.on {
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-sm);
}
</style>
