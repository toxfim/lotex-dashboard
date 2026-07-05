import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { api } from "@/lib/api";
import type { AuthUser } from "@/types/auth";

const TOKEN_KEY = "lotex_token";

/** Token'ni o'qish (api.ts ham shu kalitdan o'qiydi). */
export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(getStoredToken());
  const user = ref<AuthUser | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const isAuthenticated = computed(() => !!token.value && !!user.value);

  function setToken(t: string | null) {
    token.value = t;
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }

  async function login(username: string, password: string) {
    loading.value = true;
    error.value = null;
    try {
      const res = await api.login(username, password);
      setToken(res.data.token);
      user.value = res.data.user;
      return true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Login amalga oshmadi";
      return false;
    } finally {
      loading.value = false;
    }
  }

  /** Sahifa yuklanganda token bo'lsa joriy userni oladi (token tekshiriladi). */
  async function fetchMe(): Promise<boolean> {
    if (!token.value) return false;
    try {
      const res = await api.getMe();
      user.value = res.data;
      return true;
    } catch {
      // token yaroqsiz — tozalaymiz
      setToken(null);
      user.value = null;
      return false;
    }
  }

  function logout() {
    setToken(null);
    user.value = null;
  }

  /** Interfeys tilini yangilaydi (DB'da per-account saqlanadi). */
  async function setLanguage(language: string) {
    const res = await api.setMyLanguage(language);
    user.value = res.data;
  }

  /** Telegram orqali ro'yxatdan o'tishni boshlaydi — { token, deepLink }. */
  async function registerStart() {
    const res = await api.registerStart();
    return res.data;
  }

  /** Registratsiya tokeni holatini so'raydi (poll qilish uchun). */
  async function registerStatus(token: string) {
    const res = await api.getRegisterStatus(token);
    return res.data.status;
  }

  return {
    token,
    user,
    loading,
    error,
    isAuthenticated,
    login,
    fetchMe,
    logout,
    setLanguage,
    registerStart,
    registerStatus,
  };
});
