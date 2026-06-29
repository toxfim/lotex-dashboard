import { onUnmounted, ref } from "vue";
import { api } from "@/lib/api";

/**
 * "Hozir match qil" — supplier-based matching siklini qo'lda ishga tushiradi va
 * tugaguncha holatni poll qiladi. Bir nechta sahifada (Navbat, Ta'minot) ishlatiladi.
 *
 * @param onDone matching tugagach chaqiriladi (mas. ro'yxatni yangilash uchun).
 */
export function useMatchRunner(onDone?: () => void) {
  const matchBusy = ref(false);
  const matchNote = ref<{ kind: "ok" | "err"; text: string } | null>(null);

  let timer: ReturnType<typeof setInterval> | null = null;

  function clearTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function poll() {
    clearTimer();
    timer = setInterval(async () => {
      try {
        const { data } = await api.getMatchingStatus();
        if (data.running) return;
        clearTimer();
        matchBusy.value = false;
        if (data.lastError) {
          matchNote.value = {
            kind: "err",
            text: `Matching xatosi: ${data.lastError}`,
          };
        } else if (data.lastResult) {
          matchNote.value = {
            kind: "ok",
            text: `Matching tugadi: ${data.lastResult.matched} mos topildi, ${data.lastResult.notFound} topilmadi.`,
          };
        } else {
          matchNote.value = { kind: "ok", text: "Matching tugadi." };
        }
        onDone?.();
      } catch {
        // tarmoq uzilishi — keyingi pollda qayta urinamiz
      }
    }, 4000);
  }

  async function runMatchNow() {
    if (matchBusy.value) return;
    matchBusy.value = true;
    matchNote.value = {
      kind: "ok",
      text: "Matching ishga tushirildi… (lotlar ta'minotchi tovarlariga moslanmoqda)",
    };
    try {
      await api.runMatching();
      poll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("409")) {
        // allaqachon ishlamoqda — baribir tugashini kuzatamiz
        matchNote.value = { kind: "ok", text: "Matching allaqachon ishlamoqda…" };
        poll();
      } else {
        matchBusy.value = false;
        matchNote.value = { kind: "err", text: msg || "Ishga tushirib bo'lmadi" };
      }
    }
  }

  onUnmounted(clearTimer);

  return { matchBusy, matchNote, runMatchNow };
}
