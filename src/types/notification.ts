// Backend Notification modeli (GET /api/notifications, WS /api/ws/notifications).

export type NotificationKind =
  | "OFFER_REJECTED_AI"
  | "OFFER_REJECTED_MODERATOR"
  | "OFFER_PUBLISHED"
  | "GENERIC";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  meta: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

/** WS /api/ws/notifications payload. */
export interface NotificationWsMessage {
  type: "notification";
  notification: AppNotification;
}
