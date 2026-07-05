export interface AuthUser {
  id: string;
  username: string;
  name: string;
  telegramUsername: string | null;
  language: string;
  isActive: boolean;
  createdAt: string;
}

export type RegistrationStatus = "PENDING" | "COMPLETED" | "EXPIRED";

export interface RegistrationStart {
  token: string;
  deepLink: string;
  expiresAt: string;
}
