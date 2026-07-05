<script setup lang="ts">
import { computed } from "vue";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import { useShopStore } from "@/stores/shop";
import { STATUS_SHOP } from "@/data/shop";
import { fmtSom } from "@/lib/formatters";
import type { ApiShopProduct } from "@/types/shop";

const props = defineProps<{
  product: ApiShopProduct;
}>();

const emit = defineEmits<{
  close: [];
}>();

const shopStore = useShopStore();

const catName = computed(() => shopStore.catLabel(props.product.cat));
const st = computed(() => STATUS_SHOP[props.product.status]);
const names = computed(() => shopStore.entityNames(props.product.entities));

function entitySub(name: string): string {
  const e = shopStore.legalEntities.find((x) => x.name === name);
  if (!e) return "";
  return [e.inn ? `INN ${e.inn}` : null, e.region].filter(Boolean).join(" · ");
}
</script>

<template>
  <div class="modal-scrim" @click="emit('close')">
    <div class="modal" @click.stop>
      <div class="modal-top">
        <div class="mt-eyebrow">{{ catName }} · {{ product.sub }}</div>
        <button class="icon-btn modal-x" @click="emit('close')">
          <BaseIcon name="x" />
        </button>
      </div>

      <div class="modal-body scroll">
        <div class="modal-hero">
          <div class="modal-img">
            <div class="ph-stripe" />
            <BaseIcon name="image" />
          </div>
          <div class="modal-hero-meta">
            <div class="mh-title">{{ product.name }}</div>
            <div class="mh-brand">
              <BaseIcon name="tag" /> {{ product.brand }}
            </div>
            <div class="mh-price mono">
              {{ fmtSom(product.price) }} <span>so'm</span>
            </div>
            <span :class="['status-pill', st.cls]" style="margin-top: 4px">
              <span class="sp-dot" />{{ st.label }}
            </span>
          </div>
        </div>

        <div class="section" style="margin-top: 22px">
          <div class="section-head">
            <div
              class="sh-icon"
              style="background: var(--accent-soft); color: var(--accent-ink)"
            >
              <BaseIcon name="flag" />
            </div>
            <h2>Texnik xususiyatlar</h2>
          </div>
          <div class="panel">
            <table class="specs">
              <tbody>
                <tr v-for="([k, v], i) in product.specs" :key="i">
                  <td class="sp-label" style="width: 52%">{{ k }}</td>
                  <td class="sp-ours">{{ v }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="section" style="margin-top: 22px">
          <div class="section-head">
            <div
              class="sh-icon"
              style="background: var(--good-soft); color: var(--good-ink)"
            >
              <BaseIcon name="store" />
            </div>
            <h2>Qo'shilgan do'konlar</h2>
            <span class="sh-sub">{{ names.length }} ta legal entity</span>
          </div>
          <div class="panel ent-list-panel">
            <div v-for="(n, i) in names" :key="i" class="ent-row">
              <div class="ent-av">{{ n.slice(0, 1) }}</div>
              <div class="ent-row-main">
                <div class="ern-name">{{ n }}</div>
                <div class="ern-sub">{{ entitySub(n) }}</div>
              </div>
              <span class="chip good"><BaseIcon name="check" /> Faol</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
