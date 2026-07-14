import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { api } from "@/lib/api";
import { getStoredToken } from "@/stores/auth";
import { useToast } from "@/composables/useToast";
import type {
  AppNotification,
  NotificationWsMessage,
} from "@/types/notification";

/**
 * Bildirishnomalar: REST'dan boshlang'ich ro'yxat, WS'dan real-time push.
 * Yangi bildirishnoma kelganda header qo'ng'irog'i, in-app toast va (ruxsat
 * berilgan bo'lsa) brauzer web-push notification ko'rsatiladi.
 */
export const useNotificationsStore = defineStore("notifications", () => {
  const { pushToast } = useToast();

  const items = ref<AppNotification[]>([]);
  const unreadCount = ref(0);
  const connected = ref(false);

  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let attempts = 0;
  let started = false;

  const hasUnread = computed(() => unreadCount.value > 0);

  async function fetchAll() {
    const res = await api.getNotifications();
    items.value = res.data;
    unreadCount.value = res.unreadCount;
  }

  /** Brauzer push ruxsatini so'raydi (bir marta; rad etilsa indamay o'tadi). */
  async function ensurePushPermission(): Promise<boolean> {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    try {
      return (await Notification.requestPermission()) === "granted";
    } catch {
      return false;
    }
  }

  function showBrowserPush(n: AppNotification) {
    if (!("Notification" in window) || Notification.permission !== "granted")
      return;
    try {
      const push = new Notification(n.title, {
        body: n.body,
        tag: n.id,
        icon: "/vite.svg",
      });
      push.onclick = () => window.focus();
    } catch (cause) {
      console.error("Web-push ko'rsatib bo'lmadi", cause);
    }
  }

  function onIncoming(n: AppNotification) {
    items.value = [n, ...items.value].slice(0, 100);
    unreadCount.value += 1;
    pushToast({
      kind: n.kind === "OFFER_PUBLISHED" ? "acc" : "rej",
      title: n.title,
      sub: n.body,
      undoId: "",
    });
    showBrowserPush(n);
  }

  function wsUrl(): string {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    // WS upgrade Authorization header yubora olmaydi — backend `wsAuth` tokenni
    // query-param'dan o'qiydi. Token bo'lmasa backend 401 qaytaradi.
    const token = getStoredToken();
    const query = token ? `?token=${encodeURIComponent(token)}` : "";
    return `${proto}//${location.host}/api/ws/notifications${query}`;
  }

  function connect() {
    socket = new WebSocket(wsUrl());
    socket.onopen = () => {
      connected.value = true;
      attempts = 0;
    };
    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as NotificationWsMessage;
        if (msg.type === "notification") onIncoming(msg.notification);
      } catch (cause) {
        console.error("Notification payload'ini o'qib bo'lmadi", cause);
      }
    };
    socket.onclose = () => {
      connected.value = false;
      socket = null;
      attempts += 1;
      const delay = Math.min(1000 * 2 ** (attempts - 1), 15_000);
      reconnectTimer = setTimeout(connect, delay);
    };
    socket.onerror = () => socket?.close();
  }

  /** App boot'da bir marta: ro'yxatni yuklaydi, WS'ga ulanadi, push ruxsatini so'raydi. */
  async function start() {
    if (started) return;
    started = true;
    connect();
    void ensurePushPermission();
    await fetchAll().catch((e) =>
      console.error("Bildirishnomalarni yuklab bo'lmadi", e),
    );
  }

  function stop() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.close();
    socket = null;
    started = false;
  }

  async function markRead(id: string) {
    const n = items.value.find((x) => x.id === id);
    if (!n || n.readAt) return;
    n.readAt = new Date().toISOString();
    unreadCount.value = Math.max(0, unreadCount.value - 1);
    await api
      .markNotificationRead(id)
      .catch((e) => console.error("O'qilgan deb belgilab bo'lmadi", e));
  }

  async function markAllRead() {
    items.value = items.value.map((n) => ({
      ...n,
      readAt: n.readAt ?? new Date().toISOString(),
    }));
    unreadCount.value = 0;
    await api
      .markAllNotificationsRead()
      .catch((e) => console.error("Hammasini belgilab bo'lmadi", e));
  }

  return {
    items,
    unreadCount,
    hasUnread,
    connected,
    start,
    stop,
    fetchAll,
    markRead,
    markAllRead,
  };
});
