import { ref, onMounted, onUnmounted } from "vue";
import { getStoredToken } from "@/stores/auth";
import type { ApiPipelineStatus } from "@/types/api";

/**
 * /api/ws/status WebSocket'iga ulanib pipeline holatini real-time kuzatadi.
 * Komponent mount bo'lganda ulanadi, unmount'da uziladi; kutilmagan uzilishda
 * eksponensial backoff bilan qayta urinadi.
 */
export function usePipelineStatus() {
  const status = ref<ApiPipelineStatus | null>(null);
  const connected = ref(false);

  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let attempts = 0;
  let disposed = false;

  function wsUrl(): string {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    // WS upgrade Authorization header yubora olmaydi — backend `wsAuth` tokenni
    // query-param'dan o'qiydi. Token bo'lmasa backend 401 qaytaradi.
    const token = getStoredToken();
    const query = token ? `?token=${encodeURIComponent(token)}` : "";
    return `${proto}//${location.host}/api/ws/status${query}`;
  }

  function connect() {
    socket = new WebSocket(wsUrl());

    socket.onopen = () => {
      connected.value = true;
      attempts = 0;
    };

    socket.onmessage = (event) => {
      try {
        status.value = JSON.parse(event.data) as ApiPipelineStatus;
      } catch (cause) {
        // Buzilgan payload — fail loud (CLAUDE.md §1), lekin ulanishni yiqitmaymiz.
        console.error("Pipeline status payload'ini o'qib bo'lmadi", cause);
      }
    };

    socket.onclose = () => {
      connected.value = false;
      socket = null;
      if (!disposed) scheduleReconnect();
    };

    // Xato bo'lsa close ham keladi — qayta ulanish o'sha yerda boshqariladi.
    socket.onerror = () => socket?.close();
  }

  function scheduleReconnect() {
    attempts += 1;
    const delay = Math.min(1000 * 2 ** (attempts - 1), 15_000);
    reconnectTimer = setTimeout(connect, delay);
  }

  onMounted(connect);

  onUnmounted(() => {
    disposed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.close();
  });

  return { status, connected };
}
