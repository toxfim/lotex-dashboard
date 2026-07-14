<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import BaseSelect from "@/components/shared/BaseSelect.vue";
import ShopMoneyInput from "@/components/shop/ShopMoneyInput.vue";
import { api } from "@/lib/api";
import { fmtSom } from "@/lib/formatters";
import { useI18n } from "@/composables/useI18n";
import type { Lot } from "@/types/lot";
import type { ParticipationPreview, TenderBidResult } from "@/types/tender";

const props = defineProps<{
  lot: Lot;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();

// --- forma holati ---
const credentialId = ref<string>(props.lot.legalEntities[0]?.id ?? "");
// Tovar (supplier) narxi — sebestoimost shundan hisoblanadi. Match'dan kelgan
// tan narx (UZS) bo'lsa default sifatida qo'yiladi.
const productPrice = ref<number | null>(props.lot.pricing.unitCost || null);
const productCurrency = ref<"USD" | "UZS">("UZS");
const additionalCosts = ref<number | null>(null);
const startUnitPrice = ref<number | null>(props.lot.startUnit || null);
// Taklif narxi — backend tavsiyasidan avto-to'ldiriladi, qo'lda o'zgartirilsa
// keyingi previewlar uni QAYTA YOZMAYDI (prevSuggested bilan solishtiramiz).
const bidUnitPrice = ref<number | null>(null);
const prevSuggested = ref<number | null>(null);

// --- preview / submit holati ---
const preview = ref<ParticipationPreview | null>(null);
const previewError = ref<string | null>(null);
const loadingPreview = ref(false);
const submitting = ref(false);
const submitError = ref<string | null>(null);
const result = ref<TenderBidResult | null>(null);

const quantity = computed(() => props.lot.qty);

const entityOptions = computed(() =>
  props.lot.legalEntities.map((e) => ({ v: e.id, l: e.name })),
);

const currencyOptions = [
  { v: "UZS", l: "UZS (so'm)" },
  { v: "USD", l: "USD ($)" },
];

const canPreview = computed(
  () => !!credentialId.value && !!productPrice.value && productPrice.value > 0,
);

const canSubmit = computed(
  () =>
    !!preview.value &&
    !previewError.value &&
    !loadingPreview.value && // eski raqamlar bilan submit bo'lmasin
    !!bidUnitPrice.value &&
    bidUnitPrice.value > 0 &&
    !submitting.value &&
    !result.value,
);

let debounce: ReturnType<typeof setTimeout> | undefined;
// Kechikkan eski javob yangi natijani bosib qo'ymasligi uchun (race guard).
let previewSeq = 0;

watch(
  [
    credentialId,
    productPrice,
    productCurrency,
    additionalCosts,
    startUnitPrice,
  ],
  () => {
    result.value = null;
    submitError.value = null;
    if (debounce) clearTimeout(debounce);
    previewSeq++; // uchayotgan eski so'rov javobi endi e'tiborsiz qoladi
    if (!canPreview.value) {
      loadingPreview.value = false;
      preview.value = null;
      previewError.value = null;
      return;
    }
    // Debounce oynasida ham submit bloklanadi (canSubmit → !loadingPreview).
    loadingPreview.value = true;
    debounce = setTimeout(runPreview, 400);
  },
  { immediate: true },
);

// Taklif narxi qo'lda o'zgartirilsa, eski natija/xato banneri eskiradi.
watch(bidUnitPrice, () => {
  result.value = null;
  submitError.value = null;
});

onUnmounted(() => {
  if (debounce) clearTimeout(debounce);
});

async function runPreview() {
  if (!canPreview.value) return;
  const seq = ++previewSeq;
  loadingPreview.value = true;
  previewError.value = null;
  try {
    const res = await api.tenderParticipationPreview(props.lot.id, {
      credentialId: credentialId.value,
      productPrice: productPrice.value!,
      productCurrency: productCurrency.value,
      additionalCosts: additionalCosts.value ?? undefined,
      quantity: quantity.value || undefined,
      startUnitPrice: startUnitPrice.value ?? undefined,
    });
    if (seq !== previewSeq) return; // eskirgan javob — e'tiborsiz
    preview.value = res.data;
    // Tavsiya narxni avto-to'ldirish — foydalanuvchi qo'lda o'zgartirmagan bo'lsa.
    const suggested = res.data.participation.suggestedBidUnitPrice;
    if (
      bidUnitPrice.value == null ||
      bidUnitPrice.value === prevSuggested.value
    )
      bidUnitPrice.value = suggested;
    prevSuggested.value = suggested;
  } catch (err) {
    if (seq !== previewSeq) return;
    preview.value = null;
    previewError.value = err instanceof Error ? err.message : String(err);
  } finally {
    if (seq === previewSeq) loadingPreview.value = false;
  }
}

async function submit() {
  if (!canSubmit.value || !preview.value) return;
  submitting.value = true;
  submitError.value = null;
  try {
    // Test bosqichi: dryRun=true — haqiqiy AddBid chaqirilmaydi (pul muzlamaydi).
    const res = await api.tenderPlaceBid(props.lot.id, {
      credentialId: credentialId.value,
      bidUnitPrice: bidUnitPrice.value!,
      startUnitPrice: startUnitPrice.value ?? undefined,
      quantity: quantity.value || undefined,
      // Snapshot: tan narx (UZS, birlik) va qo'shimcha harajatlar (logistika sifatida).
      costPrice: preview.value.product.priceUzs,
      logisticsCost: additionalCosts.value ?? undefined,
      dryRun: true,
    });
    result.value = res.data;
  } catch (err) {
    submitError.value = err instanceof Error ? err.message : String(err);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="modal-scrim" @click="emit('close')">
    <div class="modal" @click.stop>
      <div class="modal-top">
        <div class="mt-eyebrow">{{ lot.category }} · {{ lot.lotNo }}</div>
        <button class="icon-btn modal-x" @click="emit('close')">
          <BaseIcon name="x" />
        </button>
      </div>

      <div class="modal-body scroll">
        <div class="tb-hero">
          <div class="tb-hero-title">{{ lot.title }}</div>
          <div class="tb-hero-sub mono">
            {{ t("tenderBid.field.qty") }}: {{ quantity }} {{ lot.unit }}
          </div>
        </div>

        <!-- Yuridik shaxs -->
        <div class="tb-section">
          <div class="tb-sec-head">
            <BaseIcon name="store" />
            <h3>{{ t("tenderBid.entity.title") }}</h3>
          </div>
          <p class="tb-hint">{{ t("tenderBid.entity.hint") }}</p>
          <BaseSelect v-model="credentialId" :options="entityOptions" />
          <div v-if="preview?.entity.isYatt" class="tb-chip tb-chip-warn">
            {{ t("tenderBid.entity.yatt") }}
          </div>
        </div>

        <!-- Tovar narxi (supplier) -->
        <div class="tb-section">
          <div class="tb-sec-head">
            <BaseIcon name="scale" />
            <h3>{{ t("tenderBid.product.title") }}</h3>
          </div>
          <p class="tb-hint">{{ t("tenderBid.product.hint") }}</p>
          <div class="tb-grid">
            <div class="tb-field">
              <label class="tb-label">
                {{ t("tenderBid.field.productPrice") }}
                <span class="tb-req">*</span>
              </label>
              <ShopMoneyInput v-model="productPrice" decimal placeholder="0" />
            </div>
            <div class="tb-field">
              <label class="tb-label">{{
                t("tenderBid.field.currency")
              }}</label>
              <BaseSelect
                v-model="productCurrency"
                :options="currencyOptions"
              />
            </div>
            <div class="tb-field">
              <label class="tb-label">{{
                t("tenderBid.field.additional")
              }}</label>
              <ShopMoneyInput v-model="additionalCosts" placeholder="0" />
            </div>
            <div class="tb-field">
              <label class="tb-label">{{
                t("tenderBid.field.startPrice")
              }}</label>
              <ShopMoneyInput v-model="startUnitPrice" placeholder="0" />
            </div>
          </div>
        </div>

        <!-- Hisob-kitob (debounce bilan avtomatik) -->
        <div class="tb-section">
          <div class="tb-sec-head">
            <BaseIcon name="cpu" />
            <h3>{{ t("tenderBid.calc.title") }}</h3>
          </div>

          <div v-if="previewError" class="tb-banner tb-banner-bad">
            <BaseIcon name="x" /> {{ previewError }}
          </div>
          <div v-else-if="!canPreview" class="tb-muted">
            {{ t("tenderBid.calc.needInputs") }}
          </div>
          <div v-else-if="loadingPreview && !preview" class="tb-muted">
            {{ t("tenderBid.calc.loading") }}
          </div>

          <div v-if="preview" class="panel tb-calc">
            <!-- Xarajatlar tarkibi -->
            <div class="tb-row">
              <span>{{ t("tenderBid.calc.baseCost") }}</span>
              <span class="mono">{{
                fmtSom(preview.breakdown.baseCostTotal)
              }}</span>
            </div>
            <div v-if="preview.product.exchange" class="tb-row tb-row-muted">
              <span>{{ t("tenderBid.calc.rate") }}</span>
              <span class="mono">
                {{ fmtSom(preview.product.exchange.rate) }}
                ({{ preview.product.exchange.source }})
              </span>
            </div>
            <div class="tb-row">
              <span>
                {{ t("tenderBid.calc.margin") }}
                <span class="tb-x">×{{ preview.margin.multiplier }}</span>
              </span>
              <span class="mono"
                >+{{ fmtSom(preview.breakdown.marginAmount) }}</span
              >
            </div>
            <div v-if="preview.breakdown.additionalCosts" class="tb-row">
              <span>{{ t("tenderBid.calc.additional") }}</span>
              <span class="mono">
                +{{ fmtSom(preview.breakdown.additionalCosts) }}
              </span>
            </div>
            <div class="tb-row">
              <span>{{ t("tenderBid.calc.fee") }}</span>
              <span class="mono">+{{ fmtSom(preview.commission) }}</span>
            </div>
            <div v-if="preview.entity.isYatt" class="tb-row">
              <span>{{ t("tenderBid.calc.tax") }}</span>
              <span class="mono"
                >+{{ fmtSom(preview.breakdown.taxAmount) }}</span
              >
            </div>

            <div class="tb-sep" />

            <!-- Asosiy natijalar -->
            <div class="tb-row">
              <span>{{ t("tenderBid.calc.sebest") }}</span>
              <span class="mono">{{ fmtSom(preview.sebestoimost.total) }}</span>
            </div>
            <div class="tb-row tb-row-muted">
              <span>{{ t("tenderBid.calc.sebestUnit") }}</span>
              <span class="mono">{{
                fmtSom(preview.sebestoimost.perUnit)
              }}</span>
            </div>
            <div class="tb-row tb-row-total">
              <span>{{ t("tenderBid.calc.participation") }}</span>
              <span class="mono">{{
                fmtSom(preview.participation.total)
              }}</span>
            </div>
            <div class="tb-row">
              <span>{{ t("tenderBid.calc.participationUnit") }}</span>
              <span class="mono">
                {{ fmtSom(preview.participation.suggestedBidUnitPrice) }}
              </span>
            </div>
            <div class="tb-row tb-row-profit">
              <span>{{ t("tenderBid.calc.profit") }}</span>
              <span class="mono tb-good">
                +{{ fmtSom(preview.breakdown.marginAmount) }}
              </span>
            </div>

            <div class="tb-sep" />

            <!-- Fee va muzlatish (uzex) -->
            <div class="tb-row tb-row-frozen">
              <span>{{ t("tenderBid.calc.frozen") }}</span>
              <span class="mono">{{ fmtSom(preview.totalFrozen) }}</span>
            </div>
            <div class="tb-row tb-row-muted">
              <span>{{ t("tenderBid.calc.startTotal") }}</span>
              <span class="mono">{{ fmtSom(preview.inputs.startTotal) }}</span>
            </div>
          </div>

          <!-- Ogohlantirishlar (foydasiz / demping) -->
          <div
            v-if="preview?.warnings.length"
            class="tb-banner tb-banner-warn"
            style="margin-top: 10px"
          >
            <BaseIcon name="cpu" />
            <div>
              <div v-for="(w, i) in preview.warnings" :key="i">{{ w }}</div>
            </div>
          </div>
        </div>

        <!-- Taklif -->
        <div class="tb-section">
          <div class="tb-sec-head">
            <BaseIcon name="check" />
            <h3>{{ t("tenderBid.bid.title") }}</h3>
          </div>
          <p class="tb-hint">{{ t("tenderBid.bid.hint") }}</p>
          <div class="tb-grid">
            <div class="tb-field">
              <label class="tb-label">
                {{ t("tenderBid.field.bidPrice") }}
                <span class="tb-req">*</span>
              </label>
              <ShopMoneyInput v-model="bidUnitPrice" placeholder="0" />
            </div>
          </div>
        </div>

        <!-- Natija (dryRun) -->
        <div v-if="result" class="tb-banner tb-banner-good">
          <BaseIcon name="check" />
          <div>
            {{
              result.dryRun
                ? t("tenderBid.result.dryRun")
                : t("tenderBid.result.submitted")
            }}
            <span class="mono" style="display: block; margin-top: 2px">
              {{ t("tenderBid.calc.totalFrozen") }}:
              {{ fmtSom(result.bid.totalFrozen) }} {{ t("currency.som") }}
            </span>
          </div>
        </div>
        <div v-if="submitError" class="tb-banner tb-banner-bad">
          <BaseIcon name="x" /> {{ submitError }}
        </div>
      </div>

      <div class="tb-footer">
        <span class="tb-test-note">
          <BaseIcon name="cpu" /> {{ t("tenderBid.testNote") }}
        </span>
        <button class="btn btn-ghost" @click="emit('close')">
          {{ t("tenderBid.cancel") }}
        </button>
        <button
          class="btn btn-accent btn-lg"
          :class="{ disabled: !canSubmit }"
          :disabled="!canSubmit"
          @click="submit"
        >
          {{ submitting ? t("tenderBid.submitting") : t("tenderBid.submit") }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tb-hero {
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}
.tb-hero-title {
  font-size: 15px;
  font-weight: 650;
  color: var(--ink);
  line-height: 1.35;
}
.tb-hero-sub {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--ink-3);
}
.tb-section {
  margin-bottom: 18px;
}
.tb-sec-head {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 8px;
  color: var(--ink-2);
}
.tb-sec-head h3 {
  font-size: 13px;
  font-weight: 650;
  margin: 0;
}
.tb-sec-head svg {
  width: 15px;
  height: 15px;
  opacity: 0.65;
}
.tb-hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--ink-4);
}
.tb-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 12px;
}
.tb-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.tb-label {
  font-size: 12px;
  font-weight: 550;
  color: var(--ink-3);
}
.tb-req {
  color: var(--bad-ink);
}
.tb-chip {
  display: inline-block;
  margin-top: 8px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
}
.tb-chip-warn {
  background: var(--warn-soft);
  color: var(--warn-ink);
  border: 1px solid var(--warn-line);
}
.tb-x {
  margin-left: 4px;
  font-size: 11.5px;
  color: var(--ink-4);
}
.tb-calc {
  padding: 12px 14px;
}
.tb-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  padding: 5px 0;
  color: var(--ink-2);
}
.tb-row-total {
  font-weight: 700;
  color: var(--ink);
  font-size: 14px;
}
.tb-row-frozen {
  font-weight: 600;
  color: var(--warn-ink);
}
.tb-row-muted {
  color: var(--ink-4);
  font-size: 12.5px;
}
.tb-row-profit {
  font-weight: 600;
}
.tb-good {
  color: var(--good-ink);
}
.tb-bad {
  color: var(--bad-ink);
}
.tb-sep {
  height: 1px;
  background: var(--border);
  margin: 6px 0;
}
.tb-muted {
  font-size: 12.5px;
  color: var(--ink-4);
  padding: 6px 0;
}
.tb-banner {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  padding: 11px 13px;
  border-radius: var(--radius-sm);
  font-size: 12.5px;
  line-height: 1.45;
}
.tb-banner svg {
  width: 16px;
  height: 16px;
  flex: none;
  margin-top: 1px;
}
.tb-banner-warn {
  background: var(--warn-soft);
  color: var(--warn-ink);
  border: 1px solid var(--warn-line);
}
.tb-banner-bad {
  background: var(--bad-soft);
  color: var(--bad-ink);
  border: 1px solid var(--bad-line);
}
.tb-banner-good {
  background: var(--good-soft);
  color: var(--good-ink);
  border: 1px solid var(--good-line);
}
.tb-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  background: var(--surface);
}
.tb-test-note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: auto;
  font-size: 11.5px;
  color: var(--warn-ink);
}
.tb-test-note svg {
  width: 13px;
  height: 13px;
}
</style>
