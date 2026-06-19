import { ref } from "vue";

export interface Toast {
  id: string;
  kind: "acc" | "rej";
  title: string;
  sub: string;
  undoId: string;
  /** Bekor qilish qaysi store'ga yo'naltirilishi. Default: "lots". */
  source?: "queue" | "lots";
}

const toasts = ref<Toast[]>([]);

export function useToast() {
  function pushToast(t: Omit<Toast, "id">) {
    const id = Math.random().toString(36).slice(2);
    toasts.value.push({ ...t, id });
    setTimeout(() => {
      toasts.value = toasts.value.filter((x) => x.id !== id);
    }, 5200);
  }

  function clearToasts() {
    toasts.value = [];
  }

  return { toasts, pushToast, clearToasts };
}
