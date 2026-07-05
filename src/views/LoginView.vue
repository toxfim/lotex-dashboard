<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useI18n } from "@/composables/useI18n";
import BaseIcon from "@/components/shared/BaseIcon.vue";

const router = useRouter();
const auth = useAuthStore();
const { t } = useI18n();

const username = ref("");
const password = ref("");

async function submit() {
  if (!username.value.trim() || !password.value || auth.loading) return;
  const ok = await auth.login(username.value.trim(), password.value);
  if (ok) {
    await auth.fetchMe();
    router.replace("/");
  }
}

type RegState = "idle" | "starting" | "pending" | "completed" | "expired";
const regState = ref<RegState>("idle");
const regToken = ref<string | null>(null);
let pollTimer: ReturnType<typeof setInterval> | null = null;

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollRegisterStatus() {
  if (!regToken.value) return;
  try {
    const status = await auth.registerStatus(regToken.value);
    if (status === "COMPLETED") {
      regState.value = "completed";
      stopPolling();
    } else if (status === "EXPIRED") {
      regState.value = "expired";
      stopPolling();
    }
  } catch {
    // tarmoq xatosi — keyingi urinishda davom etadi
  }
}

async function startTelegramRegister() {
  if (regState.value === "starting" || regState.value === "pending") return;
  stopPolling();
  regState.value = "starting";
  try {
    const { token, deepLink } = await auth.registerStart();
    regToken.value = token;
    window.open(deepLink, "_blank");
    regState.value = "pending";
    pollTimer = setInterval(pollRegisterStatus, 2000);
  } catch {
    regState.value = "idle";
  }
}

const telegramCtaLabel = computed(() => {
  if (regState.value === "starting") return t("common.loading");
  if (regState.value === "pending") return t("login.telegram.ctaAgain");
  return t("login.telegram.cta");
});

onUnmounted(stopPolling);
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-brand">
        <div class="lb-mark"><BaseIcon name="sparkle" /></div>
        <div>
          <div class="lb-name">Lotex</div>
          <div class="lb-sub">{{ t("login.brandSub") }}</div>
        </div>
      </div>

      <h1 class="login-title">{{ t("login.title") }}</h1>
      <p class="login-hint">{{ t("login.hint") }}</p>

      <div class="tg-section">
        <button
          class="btn btn-accent btn-lg login-btn"
          type="button"
          :disabled="regState === 'starting'"
          @click="startTelegramRegister"
        >
          <BaseIcon name="external" />{{ telegramCtaLabel }}
        </button>

        <p v-if="regState === 'pending'" class="reg-hint">
          <BaseIcon name="clock" />{{ t("login.telegram.waiting") }}
        </p>
        <p v-if="regState === 'completed'" class="reg-hint reg-hint-ok">
          <BaseIcon name="check" />{{ t("login.telegram.completed") }}
        </p>
        <p v-if="regState === 'expired'" class="reg-hint reg-hint-err">
          <BaseIcon name="alert" />{{ t("login.telegram.expired") }}
        </p>
      </div>

      <div class="login-divider">
        <span>{{ t("login.divider") }}</span>
      </div>

      <form @submit.prevent="submit">
        <label class="login-field">
          <span>{{ t("login.usernameLabel") }}</span>
          <input
            v-model="username"
            type="text"
            autocomplete="username"
            placeholder="username"
            autofocus
          />
        </label>
        <label class="login-field">
          <span>{{ t("login.passwordLabel") }}</span>
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
          />
        </label>

        <div v-if="auth.error" class="login-err">
          <BaseIcon name="alert" />{{ auth.error }}
        </div>

        <button
          class="btn btn-accent btn-lg login-btn"
          type="submit"
          :disabled="auth.loading"
        >
          {{ auth.loading ? t("login.loggingIn") : t("login.submit") }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: var(--bg, #f4f5f7);
  padding: 24px;
}
.login-card {
  width: 100%;
  max-width: 380px;
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e6e8eb);
  border-radius: 16px;
  padding: 30px 28px;
  box-shadow: var(--shadow-lg);
}
.login-brand {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 26px;
}
.lb-mark {
  width: 40px;
  height: 40px;
  border-radius: 11px;
  background: var(--accent, #1a56db);
  color: #fff;
  display: grid;
  place-items: center;
}
.lb-mark :deep(svg) {
  width: 22px;
  height: 22px;
}
.lb-name {
  font-size: 17px;
  font-weight: 750;
  letter-spacing: -0.02em;
}
.lb-sub {
  font-size: 11.5px;
  color: var(--ink-4, #9aa1a9);
}
.login-title {
  font-size: 21px;
  font-weight: 750;
  letter-spacing: -0.02em;
}
.login-hint {
  font-size: 13px;
  color: var(--ink-3, #6b7280);
  margin: 4px 0 22px;
}
.tg-section {
  margin-bottom: 6px;
}
.reg-hint {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  color: var(--ink-3, #6b7280);
  background: var(--surface-3, #f4f5f7);
  border-radius: 8px;
  padding: 8px 11px;
  margin-top: 10px;
}
.reg-hint :deep(svg) {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}
.reg-hint-ok {
  color: var(--good-ink, #1a7f37);
  background: var(--good-soft, #e6f4ea);
}
.reg-hint-err {
  color: var(--bad-ink, #c5221f);
  background: var(--bad-soft, #fde8e8);
}
.login-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 20px 0 18px;
  font-size: 11.5px;
  color: var(--ink-4, #9aa1a9);
}
.login-divider::before,
.login-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border, #e6e8eb);
}
.login-field {
  display: block;
  margin-bottom: 14px;
}
.login-field span {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-3, #6b7280);
  margin-bottom: 6px;
}
.login-field input {
  width: 100%;
  border: 1px solid var(--border, #e6e8eb);
  border-radius: 9px;
  padding: 10px 12px;
  font: inherit;
  font-size: 14px;
  background: var(--surface, #fff);
}
.login-field input:focus {
  outline: none;
  border-color: var(--accent, #1a56db);
}
.login-err {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  color: var(--bad-ink, #c5221f);
  background: var(--bad-soft, #fde8e8);
  border-radius: 8px;
  padding: 8px 11px;
  margin-bottom: 14px;
}
.login-err :deep(svg) {
  width: 15px;
  height: 15px;
}
.login-btn {
  width: 100%;
  justify-content: center;
  margin-top: 6px;
}
</style>
