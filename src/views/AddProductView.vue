<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useShopStore } from "@/stores/shop";
import { useToast } from "@/composables/useToast";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import ShopField from "@/components/shop/ShopField.vue";
import ShopFieldSelect from "@/components/shop/ShopFieldSelect.vue";
import ShopFormGroup from "@/components/shop/ShopFormGroup.vue";
import { LEGAL_ENTITIES, SHOP_CATEGORIES } from "@/data/shop";
import type {
  ShopField as ShopFieldType,
  ShopFieldGroup,
  ShopFieldValue,
} from "@/types/shop";

const router = useRouter();
const shopStore = useShopStore();
const { pushToast } = useToast();

const catId = ref("");
const subId = ref("");
const vals = ref<Record<string, ShopFieldValue>>({});
const brand = ref("");
const supplier2 = ref("");
const img = ref(false);
const allEntities = ref(false);
const picked = ref<string[]>([]);

const cat = computed(() =>
  catId.value ? SHOP_CATEGORIES.find((c) => c.id === catId.value) : null,
);
const sub = computed(() =>
  cat.value && subId.value
    ? cat.value.subs.find((s) => s.id === subId.value)
    : null,
);

const entityIds = computed(() =>
  allEntities.value ? LEGAL_ENTITIES.map((e) => e.id) : picked.value,
);

// Maydonlarni guruhlarga ajratish.
const groups = computed(() => {
  const g: Record<ShopFieldGroup, ShopFieldType[]> = {
    "specs-req": [],
    "specs-opt": [],
    price: [],
    delivery: [],
    desc: [],
  };
  sub.value?.fields.forEach((f) => g[f.group].push(f));
  return g;
});

const canSubmit = computed(
  () =>
    !!sub.value &&
    !!brand.value &&
    !!vals.value.price &&
    !!vals.value.stock &&
    entityIds.value.length > 0,
);

function setCategory(v: string) {
  catId.value = v;
  subId.value = "";
  vals.value = {};
  brand.value = "";
  img.value = false;
}
function setSub(v: string) {
  subId.value = v;
  vals.value = {};
  brand.value = "";
  img.value = false;
}
function setVal(k: string, v: ShopFieldValue) {
  vals.value = { ...vals.value, [k]: v };
}

function toggleEntity(id: string) {
  allEntities.value = false;
  picked.value = picked.value.includes(id)
    ? picked.value.filter((x) => x !== id)
    : [...picked.value, id];
}
function toggleAll() {
  if (allEntities.value) {
    allEntities.value = false;
    picked.value = [];
  } else {
    allEntities.value = true;
    picked.value = LEGAL_ENTITIES.map((e) => e.id);
  }
}

function goBack() {
  router.push("/shop");
}

const submitting = ref(false);

async function submit() {
  if (!canSubmit.value || !sub.value || submitting.value) return;
  submitting.value = true;
  const name = `${sub.value.name} ${brand.value}`.trim();
  const specPairs = sub.value.specs
    .map((s): [string, string] => [s.label, String(vals.value[s.key] ?? “”)])
    .filter(([, v]) => v);
  try {
    await shopStore.addProduct(
      {
        cat: catId.value,
        sub: subId.value,
        name,
        brand: brand.value,
        price: Number(vals.value.price),
        specs: specPairs,
      },
      [...entityIds.value],
    );
    pushToast({
      kind: “acc”,
      title: “Tovar qo'shildi”,
      sub: `${entityIds.value.length} ta do'konga “${name}” kiritildi`,
      undoId: “”,
    });
    goBack();
  } catch {
    pushToast({
      kind: “err”,
      title: “Xatolik”,
      sub: “Tovar qo'shishda xatolik yuz berdi”,
      undoId: “”,
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
        <BaseIcon name="arrowLeft" /> Orqaga
      </button>
      <div class="topbar-sep" />
      <div>
        <h1>Tovar qo'shish</h1>
        <div class="crumb-sub">Electron Shop · yangi tovar kiritish</div>
      </div>
    </header>

    <div class="page-scroll scroll">
      <div class="add-inner fade-page">
        <!-- STEP 1 — toifa + sub-toifa -->
        <div class="add-step">
          <div class="step-badge">1</div>
          <div class="step-head">
            <div class="step-title">Tovarni tanlang</div>
            <div class="step-sub">
              Avval toifani, so'ng tovar nomini tanlang
            </div>
          </div>
        </div>
        <div class="big-select-row">
          <div class="bs-field">
            <label class="fld-label">
              <span class="fl-t">Tovar toifasi</span>
              <span class="req">majburiy</span>
            </label>
            <div class="big-select">
              <select
                :value="catId"
                @change="
                  setCategory(($event.target as HTMLSelectElement).value)
                "
              >
                <option value="" disabled>Categories — toifani tanlang</option>
                <option v-for="c in SHOP_CATEGORIES" :key="c.id" :value="c.id">
                  {{ c.name }}
                </option>
              </select>
              <BaseIcon name="sort" />
            </div>
          </div>
          <div class="bs-field">
            <label class="fld-label">
              <span class="fl-t">Tovar nomi</span>
              <span class="req">majburiy</span>
            </label>
            <div :class="['big-select', { disabled: !cat }]">
              <select
                :value="subId"
                :disabled="!cat"
                @change="setSub(($event.target as HTMLSelectElement).value)"
              >
                <option value="" disabled>
                  {{
                    cat
                      ? "Sub-categories — tovarni tanlang"
                      : "Avval toifani tanlang"
                  }}
                </option>
                <option v-for="s in cat?.subs" :key="s.id" :value="s.id">
                  {{ s.name }}
                </option>
              </select>
              <BaseIcon name="sort" />
            </div>
          </div>
        </div>

        <!-- STEP 2 — dinamik forma -->
        <div v-if="sub" class="add-form fade-page">
          <div class="add-step" style="margin-top: 30px">
            <div class="step-badge">2</div>
            <div class="step-head">
              <div class="step-title">{{ sub.name }} ma'lumotlari</div>
              <div class="step-sub">
                Maydonlar tanlangan tovar turiga qarab dinamik shakllanadi
              </div>
            </div>
          </div>

          <!-- rasm + ta'minotchi -->
          <div class="form-card">
            <div class="img-supplier-row">
              <button
                :class="['img-upload', { filled: img }]"
                @click="img = !img"
              >
                <template v-if="img">
                  <div class="ph-stripe" />
                  <BaseIcon name="image" />
                  <span class="iu-replace">Rasmni almashtirish</span>
                </template>
                <template v-else>
                  <BaseIcon name="plus" />
                  <span>Rasm qo'shish</span>
                  <small>PNG / JPG · 2 MB gacha</small>
                </template>
              </button>
              <div class="supplier-fields">
                <div class="fld">
                  <label class="fld-label">
                    <span class="fl-t">Marka / Ishlab chiqaruvchi</span>
                    <span class="req">majburiy</span>
                  </label>
                  <ShopFieldSelect
                    v-model="brand"
                    :options="sub.suppliers"
                    placeholder="Markani tanlang"
                  />
                </div>
                <div class="fld">
                  <label class="fld-label">
                    <span class="fl-t">Yetkazib beruvchi</span>
                    <span class="opt">ixtiyoriy</span>
                  </label>
                  <ShopFieldSelect
                    v-model="supplier2"
                    :options="[
                      'Rasmiy distribyutor',
                      'Mahalliy ta\'minotchi',
                      'Import',
                    ]"
                    placeholder="Manbani tanlang"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- majburiy xususiyatlar -->
          <ShopFormGroup
            title="Texnik xususiyatlar"
            badge="majburiy"
            badge-cls="req"
            icon="flag"
          >
            <div class="field-grid">
              <ShopField
                v-for="f in groups['specs-req']"
                :key="f.key"
                :field="f"
                :value="vals[f.key]"
                @update="setVal(f.key, $event)"
              />
            </div>
          </ShopFormGroup>

          <!-- ixtiyoriy xususiyatlar -->
          <ShopFormGroup
            v-if="groups['specs-opt'].length > 0"
            title="Qo'shimcha xususiyatlar"
            badge="ixtiyoriy"
            badge-cls="opt"
            icon="layers"
            muted
          >
            <div class="field-grid">
              <ShopField
                v-for="f in groups['specs-opt']"
                :key="f.key"
                :field="f"
                :value="vals[f.key]"
                @update="setVal(f.key, $event)"
              />
            </div>
          </ShopFormGroup>

          <!-- narx va miqdor -->
          <ShopFormGroup title="Narx va miqdor" icon="coins">
            <div class="field-grid">
              <ShopField
                v-for="f in groups.price"
                :key="f.key"
                :field="f"
                :value="vals[f.key]"
                @update="setVal(f.key, $event)"
              />
            </div>
          </ShopFormGroup>

          <!-- yetkazib berish -->
          <ShopFormGroup title="Yetkazib berish va kafolat" icon="package">
            <div class="field-grid">
              <ShopField
                v-for="f in groups.delivery"
                :key="f.key"
                :field="f"
                :value="vals[f.key]"
                @update="setVal(f.key, $event)"
              />
            </div>
          </ShopFormGroup>

          <!-- tavsif -->
          <ShopFormGroup
            title="Tavsif va shartlar"
            badge="ixtiyoriy"
            badge-cls="opt"
            icon="doc"
            muted
          >
            <textarea
              class="form-textarea"
              placeholder="Tovar haqida qo'shimcha shartlar, to'plam tarkibi, kafolat shartlari…"
              :value="
                typeof vals.conditions === 'string' ? vals.conditions : ''
              "
              @input="
                setVal(
                  'conditions',
                  ($event.target as HTMLTextAreaElement).value,
                )
              "
            />
          </ShopFormGroup>

          <!-- STEP 3 — legal entity'lar -->
          <div class="add-step" style="margin-top: 30px">
            <div class="step-badge">3</div>
            <div class="step-head">
              <div class="step-title">Qaysi do'konlarga qo'shilsin?</div>
              <div class="step-sub">
                Bir nechta legal entity tanlash mumkin — tovar barchasiga bir
                xil kiritiladi
              </div>
            </div>
          </div>

          <div class="form-card entity-panel">
            <button
              :class="['all-toggle', { on: allEntities }]"
              @click="toggleAll"
            >
              <span :class="['switch', { on: allEntities }]">
                <span class="knob" />
              </span>
              <span class="at-text">Barcha do'konlarga</span>
              <span class="at-count">{{ LEGAL_ENTITIES.length }} ta</span>
            </button>
            <div class="entity-grid">
              <button
                v-for="e in LEGAL_ENTITIES"
                :key="e.id"
                :class="['entity-opt', { on: entityIds.includes(e.id) }]"
                @click="toggleEntity(e.id)"
              >
                <span :class="['cbox', { on: entityIds.includes(e.id) }]">
                  <BaseIcon v-if="entityIds.includes(e.id)" name="check" />
                </span>
                <span class="eo-av">{{ e.name.slice(0, 1) }}</span>
                <span class="eo-main">
                  <span class="eo-name">{{ e.name }}</span>
                  <span class="eo-sub">INN {{ e.inn }} · {{ e.region }}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- sticky action bar -->
    <div v-if="sub" class="action-bar">
      <div class="ab-hint">
        <template v-if="entityIds.length > 0">
          <BaseIcon name="store" style="width: 15px; height: 15px" />
          <b style="color: var(--ink-2)">{{ entityIds.length }}</b> ta do'konga
          kiritiladi
        </template>
        <span v-else style="color: var(--warn-ink)"
          >Kamida bitta do'kon tanlang</span
        >
      </div>
      <button class="btn btn-ghost" @click="goBack">Bekor qilish</button>
      <button
        :class="['btn btn-accent btn-lg', { disabled: !canSubmit }]"
        :disabled="!canSubmit"
        @click="submit"
      >
        <BaseIcon name="check" /> Qo'shish
      </button>
    </div>
  </div>
</template>
