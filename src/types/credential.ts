// Lotex backend /api/credentials javob shakli (UzexCredential, maskalangan).
// Maxfiy maydonlar (authKey, authSugar, bearerToken) serverda "*********" yoki
// null bo'lib keladi — frontda hech qachon ochiq qiymat ko'rinmaydi.

export type ApiCredentialStatus = "ACTIVE" | "EXPIRED" | "DELETED";

export interface ApiCredential {
  id: string;
  inn: string | null;
  orgForm: string | null;
  username: string;
  name: string;
  email: string | null;
  accreditedDate: string | null;
  phone: string | null;
  regionName: string | null;
  districtName: string | null;
  street: string | null;
  zip: string | null;
  // maskalangan ("*********") yoki null
  authKey: string | null;
  authSugar: string | null;
  bearerToken: string | null;
  // ochiq
  apiAgent: string | null;
  expiredAt: string;
  status: ApiCredentialStatus;
  // qo'lda boshqariladigan ulanish flagi (Ulangan/Ulanmagan)
  connected: boolean;
  lastReauthorizedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * POST /api/credentials tanasi — qo'lda credential qo'shish.
 * key/sugar/api-agent — majburiy (auth). name/inn/orgForm — ixtiyoriy qo'lda
 * profil; berilsa uzex qiymatidan ustun turadi, bo'lmasa uzex'dan to'ldiriladi.
 */
export interface CredentialCreate {
  key: string;
  sugar: string;
  apiAgent: string;
  language?: string;
  name?: string;
  inn?: string;
  orgForm?: string;
  connected?: boolean;
}

/** PATCH /api/credentials/:id tanasi — barcha maydonlar ixtiyoriy. */
export interface CredentialUpdate {
  key?: string;
  sugar?: string;
  apiAgent?: string;
  language?: string;
  name?: string;
  inn?: string;
  orgForm?: string;
  connected?: boolean;
}
