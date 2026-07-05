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
    <!-- Chap hero panel — dizayn: qora fon, pastga yopishgan sarlavha + statlar -->
    <aside class="login-hero">
      <div class="lh-brand">
        <div class="lh-mark">L</div>
        <div class="lh-name">Lotex</div>
      </div>
      <div class="lh-bottom">
        <h2 class="lh-title">{{ t("login.hero.title") }}</h2>
        <p class="lh-desc">{{ t("login.hero.desc") }}</p>
        <div class="lh-stats">
          <div class="lh-stat">
            <span class="lh-val">71%</span>
            <span class="lh-lbl">{{ t("login.hero.winRate") }}</span>
          </div>
          <div class="lh-stat">
            <span class="lh-val">148</span>
            <span class="lh-lbl">{{ t("login.hero.watching") }}</span>
          </div>
          <div class="lh-stat">
            <span class="lh-val">1.8 <small>mlrd</small></span>
            <span class="lh-lbl">{{ t("login.hero.revenue") }}</span>
          </div>
        </div>
      </div>
    </aside>

    <!-- O'ng panel — markazlashgan forma -->
    <main class="login-side">
      <div class="login-card">
        <h1 class="login-title">{{ t("login.title") }}</h1>
        <p class="login-hint">{{ t("login.hint") }}</p>

        <form @submit.prevent="submit">
          <label class="login-field">
            <span class="lf-label">{{ t("login.usernameLabel") }}</span>
            <input
              v-model="username"
              type="text"
              autocomplete="username"
              placeholder="username"
              autofocus
            />
          </label>
          <label class="login-field">
            <span class="lf-row">
              <span class="lf-label">{{ t("login.passwordLabel") }}</span>
            </span>
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

        <div class="login-divider">
          <span>{{ t("login.divider") }}</span>
        </div>

        <button
          class="btn btn-ghost btn-lg login-btn"
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
    </main>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  min-height: 100vh;
  background: var(--surface);
}

/* ---------------------------------------------------------------- hero */
.login-hero {
  flex: 0 0 44%;
  background: var(--ink);
  color: #fff;
  padding: 52px 48px;
  display: flex;
  flex-direction: column;
}
.lh-brand {
  display: flex;
  align-items: center;
  gap: 11px;
}
.lh-mark {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: #fff;
  color: var(--ink);
  display: grid;
  place-items: center;
  font-family: var(--mono);
  font-weight: 700;
  font-size: 18px;
}
.lh-name {
  font-weight: 700;
  font-size: 19px;
}
.lh-bottom {
  margin-top: auto;
}
.lh-title {
  font-size: 34px;
  font-weight: 700;
  line-height: 1.18;
  letter-spacing: -0.02em;
  max-width: 400px;
}
.lh-desc {
  font-size: 14px;
  color: #a9a9b0;
  margin-top: 18px;
  line-height: 1.55;
  max-width: 380px;
}
.lh-stats {
  display: flex;
  gap: 34px;
  margin-top: 38px;
}
.lh-val {
  display: block;
  font-size: 26px;
  font-weight: 700;
  font-family: var(--mono);
}
.lh-val small {
  font-size: 14px;
}
.lh-lbl {
  display: block;
  font-size: 12px;
  color: #a9a9b0;
  margin-top: 2px;
}

/* ---------------------------------------------------------------- forma */
.login-side {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}
.login-card {
  width: 340px;
}
.login-title {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.login-hint {
  font-size: 13.5px;
  color: var(--ink-3);
  margin: 6px 0 28px;
}
.login-field {
  display: block;
  margin-bottom: 16px;
}
.lf-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.lf-label {
  display: block;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink-2);
}
.login-field input {
  width: 100%;
  margin-top: 7px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 11px 13px;
  font: inherit;
  font-size: 13.5px;
  color: var(--ink);
  background: var(--surface);
}
.login-field input:focus {
  outline: none;
  border-color: var(--accent);
}
.login-err {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  color: var(--bad-ink);
  background: var(--bad-soft);
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
  margin-top: 8px;
}
.login-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 20px 0 12px;
  font-size: 11.5px;
  color: var(--ink-4);
}
.login-divider::before,
.login-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border);
}
.reg-hint {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  color: var(--ink-3);
  background: var(--surface-3);
  border-radius: 8px;
  padding: 8px 11px;
  margin-top: 12px;
}
.reg-hint :deep(svg) {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}
.reg-hint-ok {
  color: var(--good-ink);
  background: var(--good-soft);
}
.reg-hint-err {
  color: var(--bad-ink);
  background: var(--bad-soft);
}

/* Tor ekranda hero yashirinadi — forma markazda qoladi */
@media (max-width: 900px) {
  .login-hero {
    display: none;
  }
  .login-page {
    background: var(--bg);
  }
}
</style>
