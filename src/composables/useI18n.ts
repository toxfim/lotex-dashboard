import { computed, ref } from "vue";
import { type Locale, messages } from "@/i18n";

const LANG_KEY = "lotex_lang";

// Global reaktiv locale (barcha komponentlar baham ko'radi).
const stored = localStorage.getItem(LANG_KEY);
const locale = ref<Locale>(stored === "ru" ? "ru" : "uz");

/** Yengil i18n — `t(key, params?)` tarjima, `setLocale` til almashtirish. */
export function useI18n() {
  function setLocale(l: string) {
    if (l === "uz" || l === "ru") {
      locale.value = l;
      localStorage.setItem(LANG_KEY, l);
      document.documentElement.lang = l;
    }
  }

  function t(key: string, params?: Record<string, string | number>): string {
    let msg = messages[locale.value][key] ?? messages.uz[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        msg = msg.replaceAll(`{${k}}`, String(v));
      }
    }
    return msg;
  }

  return { locale: computed(() => locale.value), t, setLocale };
}
