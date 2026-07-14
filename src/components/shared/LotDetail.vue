<script setup lang="ts">
import { ref, watch } from "vue";
import type { Lot } from "@/types/lot";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import MatchRing from "@/components/shared/MatchRing.vue";
import PipelineBlock from "@/components/shared/PipelineBlock.vue";
import SpecsTable from "@/components/shared/SpecsTable.vue";
import PricingBlock from "@/components/shared/PricingBlock.vue";
import EmptyState from "@/components/shared/EmptyState.vue";
import TenderBidModal from "@/components/shared/TenderBidModal.vue";
import { api } from "@/lib/api";
import { fmtNum, compactSom, deadline } from "@/lib/formatters";
import { useI18n } from "@/composables/useI18n";

const props = defineProps<{
  lot: Lot | null;
}>();

const emit = defineEmits<{
  accept: [id: string];
  reject: [id: string];
  undo: [id: string];
}>();

const { t } = useI18n();

// Rasmsiz lotlarda backend 404 qaytaradi — shu holda rasmni yashiramiz.
// Lot almashganda qayta ko'rsatish uchun tiklaymiz.
const isImageVisible = ref(true);
// Rasmni bosganda kattalashtirilgan ko'rinish (lightbox).
const isZoomOpen = ref(false);
// Tenderga qatnashish modali.
const isBidOpen = ref(false);
watch(
  () => props.lot?.id,
  () => {
    isImageVisible.value = true;
    isZoomOpen.value = false;
    isBidOpen.value = false;
  },
);
</script>

<template>
  <EmptyState
    v-if="!lot"
    icon="arrowRight"
    :title="t('lotDetail.empty.title')"
    :description="t('lotDetail.empty.desc')"
  />

  <div v-else class="detail-pane">
    <div class="detail-scroll scroll">
      <div class="detail-inner" :key="lot.id">
        <div class="d-head">
          <div class="d-head-main">
            <div class="d-eyebrow">
              <span class="chip accent">{{ lot.category }}</span>
              <span class="d-lotno">{{ lot.lotNo }}</span>
              <a
                v-if="lot.buyerLotId"
                class="uzex-link"
                :href="`https://xarid.uzex.uz/shop/lot-details/${lot.buyerLotId}`"
                target="_blank"
                rel="noopener"
                style="
                  display: inline-flex;
                  align-items: center;
                  gap: 4px;
                  font-size: 12px;
                  font-weight: 600;
                  color: var(--accent-ink);
                  text-decoration: none;
                "
              >
                <BaseIcon
                  name="external"
                  :style="{ width: '13px', height: '13px' }"
                />{{ t("common.openInUzex") }}
              </a>
            </div>
            <h1 class="d-title">{{ lot.title }}</h1>
            <div class="d-cust">
              <BaseIcon
                name="building"
                :style="{ width: '15px', height: '15px', opacity: 0.7 }"
              />
              {{ lot.customer }}
              <span class="sep" />
              <BaseIcon
                name="map"
                :style="{ width: '14px', height: '14px', opacity: 0.7 }"
              />
              {{ lot.region }}
            </div>
            <div v-if="lot.legalEntities.length" class="d-cust">
              <BaseIcon
                name="store"
                :style="{ width: '14px', height: '14px', opacity: 0.7 }"
              />
              {{ t("lotDetail.recommendedFor") }}
              <span v-for="e in lot.legalEntities" :key="e.id" class="chip">{{
                e.name
              }}</span>
            </div>
          </div>
          <MatchRing :value="lot.match.overall" :size="62" />
        </div>

        <!-- Mahsulot rasmi (UzEx) — bosilganda lightbox; rasmsiz lotda yashiriladi -->
        <figure
          v-if="isImageVisible"
          class="lot-hero"
          :title="t('common.zoom')"
          @click="isZoomOpen = true"
        >
          <img
            :key="lot.id"
            :src="api.lotImageUrl(lot.id)"
            :alt="lot.title"
            loading="lazy"
            @error="isImageVisible = false"
          />
          <span class="lh-zoom"><BaseIcon name="search" /></span>
          <figcaption>
            <BaseIcon name="package" />
            <span>{{ t("lotDetail.productImage") }}</span>
            <span class="lh-src">{{ lot.match.stock.code }}</span>
          </figcaption>
        </figure>

        <div class="d-meta-row">
          <div class="meta-box">
            <div class="mb-label">
              <BaseIcon name="package" />{{ t("common.quantity") }}
            </div>
            <div class="mb-val num">{{ fmtNum(lot.qty) }}</div>
            <div class="mb-sub">{{ lot.unit }}</div>
          </div>
          <div class="meta-box">
            <div class="mb-label">
              <BaseIcon name="coins" />{{ t("common.maxPrice") }}
            </div>
            <div class="mb-val mono">{{ compactSom(lot.maxPrice) }}</div>
            <div class="mb-sub">{{ t("currency.som") }}</div>
          </div>
          <div
            :class="[
              'meta-box',
              {
                urgent:
                  deadline(lot.deadlineH).urgent &&
                  !deadline(lot.deadlineH).closed,
              },
            ]"
          >
            <div class="mb-label">
              <BaseIcon name="clock" />
              {{
                deadline(lot.deadlineH).closed
                  ? t("lotDetail.status")
                  : t("lotDetail.timeUntilDeadline")
              }}
            </div>
            <div class="mb-val">
              {{
                deadline(lot.deadlineH).closed
                  ? t("time.closed")
                  : deadline(lot.deadlineH).text
              }}
            </div>
            <div class="mb-sub">
              {{
                deadline(lot.deadlineH).closed
                  ? t("lotDetail.tenderClosed")
                  : deadline(lot.deadlineH).urgent
                    ? t("lotDetail.urgent")
                    : t("lotDetail.remaining")
              }}
            </div>
          </div>
        </div>

        <!-- Decided strip -->
        <div
          v-if="lot.status !== 'pending'"
          :class="['decided-strip', lot.status === 'accepted' ? 'acc' : 'rej']"
        >
          <div class="ds-icon">
            <BaseIcon :name="lot.status === 'accepted' ? 'check' : 'x'" />
          </div>
          <div>
            <div class="ds-t">
              {{
                lot.status === "accepted"
                  ? t("queue.tab.accepted")
                  : t("queue.tab.rejected")
              }}
            </div>
            <div class="ds-s">{{ lot.decidedBy }} · {{ lot.decidedAgo }}</div>
          </div>
          <button class="undo-btn" @click="emit('undo', lot.id)">
            {{ t("lotDetail.returnToQueue") }}
          </button>
        </div>

        <!-- Match analysis section -->
        <div class="section">
          <div class="section-head">
            <div
              class="sh-icon"
              style="background: var(--accent-soft); color: var(--accent-ink)"
            >
              <BaseIcon name="sparkle" />
            </div>
            <h2>{{ t("lotDetail.matchAnalysis.title") }}</h2>
            <span class="sh-sub">{{
              t("lotDetail.matchAnalysis.subtitle")
            }}</span>
          </div>
          <PipelineBlock :lot="lot" />
        </div>

        <!-- Specs section -->
        <div class="section">
          <div class="section-head">
            <div
              class="sh-icon"
              style="background: var(--surface-3); color: var(--ink-2)"
            >
              <BaseIcon name="flag" />
            </div>
            <h2>{{ t("lotDetail.specs.title") }}</h2>
            <span class="sh-sub">{{ t("lotDetail.specs.subtitle") }}</span>
          </div>
          <SpecsTable :specs="lot.match.specs" />
        </div>

        <!-- Pricing section -->
        <div class="section">
          <div class="section-head">
            <div
              class="sh-icon"
              style="background: var(--surface-3); color: var(--ink-2)"
            >
              <BaseIcon name="scale" />
            </div>
            <h2>{{ t("lotDetail.pricing.title") }}</h2>
            <span class="sh-sub">{{ t("lotDetail.pricing.subtitle") }}</span>
          </div>
          <PricingBlock :lot="lot" />
        </div>
      </div>
    </div>

    <!-- Action bar: qatnashish (tavsiya qilingan yur.litso bo'lsa) + qaror (pending) -->
    <div
      v-if="lot.status === 'pending' || lot.legalEntities.length"
      class="action-bar"
    >
      <div v-if="lot.status === 'pending'" class="ab-hint">
        <BaseIcon
          name="cpu"
          :style="{ width: '14px', height: '14px', opacity: 0.6 }"
        />
        {{ t("lotDetail.finalDecisionHint") }}
        <span style="margin-left: 8px"
          ><kbd>R</kbd> {{ t("lotDetail.rejectShort") }} · <kbd>A</kbd>
          {{ t("lotDetail.acceptShort") }}</span
        >
      </div>
      <button
        v-if="lot.legalEntities.length"
        class="btn btn-accent btn-lg"
        :style="lot.status !== 'pending' ? 'margin-right:auto' : ''"
        @click="isBidOpen = true"
      >
        <BaseIcon name="flag" /> {{ t("tenderBid.participate") }}
      </button>
      <button
        v-if="lot.status === 'pending'"
        class="btn btn-reject btn-lg"
        @click="emit('reject', lot.id)"
      >
        <BaseIcon name="x" /> {{ t("common.reject") }}
      </button>
      <button
        v-if="lot.status === 'pending'"
        class="btn btn-accept btn-lg"
        @click="emit('accept', lot.id)"
      >
        <BaseIcon name="check" /> {{ t("common.accept") }}
      </button>
    </div>

    <!-- Kattalashtirilgan rasm (lightbox) -->
    <Teleport to="body">
      <div
        v-if="isZoomOpen && isImageVisible"
        class="img-lightbox"
        @click="isZoomOpen = false"
      >
        <button
          class="ilb-close"
          :aria-label="t('common.close')"
          @click="isZoomOpen = false"
        >
          <BaseIcon name="x" />
        </button>
        <figure class="ilb-fig" @click.stop>
          <img :src="api.lotImageUrl(lot.id)" :alt="lot.title" />
          <figcaption>
            <div class="ilb-cap-main">{{ lot.title }}</div>
            <div class="ilb-cap-sub">
              <BaseIcon name="package" />{{ lot.match.stock.code }} ·
              {{ lot.match.stock.name }}
            </div>
          </figcaption>
        </figure>
      </div>
    </Teleport>

    <!-- Tenderga qatnashish modali (drawer transformidan mustaqil bo'lishi uchun Teleport) -->
    <Teleport to="body">
      <TenderBidModal v-if="isBidOpen" :lot="lot" @close="isBidOpen = false" />
    </Teleport>
  </div>
</template>
