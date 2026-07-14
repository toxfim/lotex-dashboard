import type {
  ApiLot,
  ApiManagerDecision,
  ApiRecommendation,
  ApiRecommendationWithLot,
  Paginated,
} from "@/types/api";
import type { AppNotification } from "@/types/notification";
import type {
  ApiCredential,
  CredentialCreate,
  CredentialUpdate,
} from "@/types/credential";
import type {
  ApiLegalEntity,
  ApiShopProduct,
  CredentialOffers,
  OfferInput,
  OfferStatusMenuItem,
  ShopOfferDetailResponse,
  ShopProductDraft,
  ShopStatus,
  UzexCatalogProduct,
  UzexCategory,
  UzexNamed,
  UzexProductProp,
  UzexRegion,
  UzexUserFile,
  UzexUserRecord,
} from "@/types/shop";
import type {
  ApiSupplier,
  ApiSupplierProduct,
  ApiSupplierProductWithSupplier,
  SupplierConfirmResult,
  SupplierCreate,
  SupplierMappingSpec,
  SupplierUpdate,
  SupplierUploadResult,
} from "@/types/supplier";
import type {
  PcBuildDetail,
  PcBuildKpis,
  PcBuildSummary,
  UsdRate,
} from "@/types/pc-build";
import type {
  AuthUser,
  RegistrationStart,
  RegistrationStatus,
} from "@/types/auth";
import type {
  ParticipationPreview,
  PledgePreview,
  TenderBidResult,
} from "@/types/tender";
import type { ApiMarginTier, MarginTierInput } from "@/types/margin";
import type { ApiBhm, BhmInput } from "@/types/bhm";

// Backendga proxy qilinadigan prefiks (vite.config.ts → server.proxy).
// VITE_API_BASE bilan almashtirish mumkin — masalan static test-data rejimi:
// VITE_API_BASE=/api/staticDatas (backend src/modules/static-datas).
const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";

export interface GetLotsParams {
  page?: number;
  limit?: number;
  status?: "NEW" | "PROCESSING" | "EXPIRED";
  tenderResult?: "UNKNOWN" | "WON" | "LOST";
  search?: string;
  matched?: boolean;
  legalEntityId?: string;
  sortBy?: "createdAt" | "price" | "tenderStartDate" | "tenderEndDate";
  order?: "asc" | "desc";
}

export interface GetRecommendationsParams {
  page?: number;
  limit?: number;
  recommendedStatus?: "RECOMMENDED" | "NEEDS_REVIEW" | "NOT_FOUND";
  managerDecision?: ApiManagerDecision;
  search?: string;
  sortBy?: "createdAt" | "confidence" | "recommendedPrice" | "costPrice";
  order?: "asc" | "desc";
}

export interface GetSuppliersParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sortBy?: "createdAt" | "name" | "updatedAt";
  order?: "asc" | "desc";
}

export interface GetSupplierProductsParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface GetAllSupplierProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  supplierId?: string;
  category?: string;
}

export interface GetShopProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  cat?: string;
  status?: ShopStatus;
  sortBy?: "createdAt" | "name" | "price";
  order?: "asc" | "desc";
}

/** Tender pledge-preview so'rov tanasi (hisob-kitob, saqlamaydi). */
export interface TenderPreviewRequest {
  /** Majburiy — garov/komissiyani uzex hisoblaydi (token kerak). */
  credentialId: string;
  bidUnitPrice: number;
  startUnitPrice?: number;
  quantity?: number;
  costPrice?: number;
  deliveryCost?: number;
  logisticsCost?: number;
}

/** Tender bid (taklif) so'rov tanasi. `dryRun` bo'lsa haqiqiy taklif yuborilmaydi. */
export interface TenderBidRequest extends TenderPreviewRequest {
  recordId?: number;
  dryRun?: boolean;
}

/**
 * Tender participation-preview so'rov tanasi — tovar (supplier) narxidan
 * sebestoimost va tavsiya qatnashish narxi (teskari formula, saqlamaydi).
 */
export interface TenderParticipationRequest {
  credentialId: string;
  /** Tovar birlik narxi (supplier narxi, `productCurrency` valyutasida). */
  productPrice: number;
  productCurrency: "USD" | "UZS";
  /** Jami qo'shimcha harajatlar (logistika va h.k.), ixtiyoriy. */
  additionalCosts?: number;
  quantity?: number;
  startUnitPrice?: number;
}

function buildQuery(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") usp.set(key, String(value));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

/** Saqlangan token bilan Authorization header (account-based auth). */
function authHeaders(): Record<string, string> {
  const t = localStorage.getItem("lotex_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Joriy dashboard tili (useI18n LANG_KEY bilan bir xil kalit) —
 *  uzex ma'lumotnoma so'rovlarida ?lang= sifatida yuboriladi. */
function currentLang(): "uz" | "ru" {
  return localStorage.getItem("lotex_lang") === "ru" ? "ru" : "uz";
}

/** 401 — token yaroqsiz/yo'q: tozalaymiz va login sahifasiga yo'naltiramiz. */
function onUnauthorized(): void {
  localStorage.removeItem("lotex_token");
  if (!location.pathname.startsWith("/login")) location.href = "/login";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...authHeaders(),
        ...init?.headers,
      },
    });
  } catch (cause) {
    // Tarmoq/proxy xatosi — fail loud (CLAUDE.md §1).
    throw new Error(`Lotex API so'rovi muvaffaqiyatsiz (${path})`, { cause });
  }

  if (res.status === 401 && path !== "/auth/login") onUnauthorized();

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : res.statusText;
    throw new Error(`Lotex API ${res.status}: ${message}`);
  }

  return (await res.json()) as T;
}

/** multipart/form-data yuborish — Content-Type'ni brauzer (boundary bilan) o'rnatadi. */
async function upload<T>(path: string, body: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { Accept: "application/json", ...authHeaders() },
      body,
    });
  } catch (cause) {
    throw new Error(`Lotex API yuklash muvaffaqiyatsiz (${path})`, { cause });
  }

  if (res.status === 401) onUnauthorized();

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    const message =
      errBody && typeof errBody === "object" && "error" in errBody
        ? String((errBody as { error: unknown }).error)
        : res.statusText;
    throw new Error(`Lotex API ${res.status}: ${message}`);
  }

  return (await res.json()) as T;
}

export const api = {
  // ------------------------------------------------------------------ auth
  /** POST /api/auth/login — { token, user }. */
  login(
    username: string,
    password: string,
  ): Promise<{ data: { token: string; user: AuthUser } }> {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },
  /** GET /api/auth/me — joriy foydalanuvchi. */
  getMe(): Promise<{ data: AuthUser }> {
    return request("/auth/me");
  },
  /** PATCH /api/auth/me/language — interfeys tilini saqlaydi (DB). */
  setMyLanguage(language: string): Promise<{ data: AuthUser }> {
    return request("/auth/me/language", {
      method: "PATCH",
      body: JSON.stringify({ language }),
    });
  },
  /** GET /api/auth/users — barcha account'lar (faqat ko'rish — rollar yo'q). */
  getUsers(): Promise<{ data: AuthUser[] }> {
    return request("/auth/users");
  },
  /** POST /api/auth/register/start — Telegram orqali ro'yxatdan o'tishni boshlaydi. */
  registerStart(): Promise<{ data: RegistrationStart }> {
    return request("/auth/register/start", { method: "POST" });
  },
  /** GET /api/auth/register/status/:token — registratsiya holati. */
  getRegisterStatus(
    token: string,
  ): Promise<{ data: { status: RegistrationStatus } }> {
    return request(`/auth/register/status/${token}`);
  },

  /** GET /api/lots — paginatsiyalangan lotlar ro'yxati. */
  getLots(params: GetLotsParams = {}): Promise<Paginated<ApiLot>> {
    return request<Paginated<ApiLot>>(`/lots${buildQuery({ ...params })}`);
  },

  /** GET /api/lots/:id — bitta lot (id UUID yoki uzexLotId). */
  getLot(id: string): Promise<{ data: ApiLot }> {
    return request<{ data: ApiLot }>(`/lots/${encodeURIComponent(id)}`);
  },

  /**
   * UzEx mahsulot rasmi URLi (backend `/lots/:id/image` proxy orqali) — `<img :src>` uchun.
   * `size: "average"` — kichik thumbnail (~8KB), default — to'liq o'lcham.
   */
  lotImageUrl(id: string, size: "full" | "average" = "full"): string {
    const qs = size === "average" ? "?size=average" : "";
    return `${BASE}/lots/${encodeURIComponent(id)}/image${qs}`;
  },

  /** GET /api/recommendations — paginatsiyalangan matching natijalari (lot bilan). */
  getRecommendations(
    params: GetRecommendationsParams = {},
  ): Promise<Paginated<ApiRecommendationWithLot>> {
    return request<Paginated<ApiRecommendationWithLot>>(
      `/recommendations${buildQuery({ ...params })}`,
    );
  },

  /** PATCH /api/recommendations/:id — manager qarorini saqlaydi. */
  updateRecommendationDecision(
    id: string,
    managerDecision: ApiManagerDecision,
  ): Promise<{ data: ApiRecommendation }> {
    return request<{ data: ApiRecommendation }>(
      `/recommendations/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify({ managerDecision }) },
    );
  },

  // --------------------------------------------------------------- tenders
  /** GET /api/bhm/current — hozir amal qiladigan BHM (404 → sozlanmagan). */
  getCurrentBhm(): Promise<{
    data: { amount: number; effectiveFrom: string };
  }> {
    return request("/bhm/current");
  },

  /** GET /api/bhm — BHM tarixi (yangi sana birinchi). */
  getBhmHistory(): Promise<{ data: ApiBhm[] }> {
    return request<{ data: ApiBhm[] }>("/bhm");
  },

  /** POST /api/bhm — yangi BHM qiymati qo'shadi. */
  createBhm(body: BhmInput): Promise<{ data: ApiBhm }> {
    return request<{ data: ApiBhm }>("/bhm", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /** PATCH /api/bhm/:id — BHM qiymatini tahrirlaydi. */
  updateBhm(id: string, body: Partial<BhmInput>): Promise<{ data: ApiBhm }> {
    return request<{ data: ApiBhm }>(`/bhm/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  /** DELETE /api/bhm/:id — BHM qiymatini o'chiradi. */
  deleteBhm(id: string): Promise<{ data: ApiBhm }> {
    return request<{ data: ApiBhm }>(`/bhm/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  /**
   * POST /api/tenders/:lotId/pledge-preview — berilgan taklif narxi uchun
   * garov/komissiya (uzex) va marjani hisoblaydi. SAQLAMAYDI, taklif YUBORMAYDI.
   */
  tenderPledgePreview(
    lotId: string,
    body: TenderPreviewRequest,
  ): Promise<{ data: PledgePreview }> {
    return request(`/tenders/${encodeURIComponent(lotId)}/pledge-preview`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /**
   * POST /api/tenders/:lotId/participation-preview — tovar narxidan sebestoimost
   * va tavsiya qatnashish narxini hisoblaydi (marja narvoni + YaTT 5% + uzex
   * komissiyasi, teskari formula). SAQLAMAYDI, taklif YUBORMAYDI.
   */
  tenderParticipationPreview(
    lotId: string,
    body: TenderParticipationRequest,
  ): Promise<{ data: ParticipationPreview }> {
    return request(
      `/tenders/${encodeURIComponent(lotId)}/participation-preview`,
      { method: "POST", body: JSON.stringify(body) },
    );
  },

  /**
   * POST /api/tenders/:lotId/bid — tenderga taklif. `dryRun: true` bo'lsa
   * DRAFT saqlanadi, haqiqiy AddBid CHAQIRILMAYDI (uzex'da pul muzlamaydi).
   */
  tenderPlaceBid(
    lotId: string,
    body: TenderBidRequest,
  ): Promise<{ data: TenderBidResult }> {
    return request(`/tenders/${encodeURIComponent(lotId)}/bid`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  // ----------------------------------------------------------- margin tiers
  /** GET /api/margin-tiers — barcha marja tier'lari (narx bo'yicha o'sish tartibida). */
  getMarginTiers(): Promise<{ data: ApiMarginTier[] }> {
    return request<{ data: ApiMarginTier[] }>("/margin-tiers");
  },

  /** GET /api/margin-tiers/for-price?price=N — N qaysi tier'ga tushadi (yo'q bo'lsa null). */
  getMarginTierForPrice(
    price: number,
  ): Promise<{ data: ApiMarginTier | null }> {
    return request<{ data: ApiMarginTier | null }>(
      `/margin-tiers/for-price${buildQuery({ price })}`,
    );
  },

  /**
   * PUT /api/margin-tiers — BUTUN narvonni atomar almashtiradi (bo'laklab emas).
   * Uzluksizlik buzilsa (bo'shliq/kesishish) backend 400 qaytaradi.
   */
  replaceMarginTiers(
    tiers: MarginTierInput[],
  ): Promise<{ data: ApiMarginTier[] }> {
    return request<{ data: ApiMarginTier[] }>("/margin-tiers", {
      method: "PUT",
      body: JSON.stringify({ tiers }),
    });
  },

  /** GET /api/credentials — magazin credentiallari (maxfiy maydonlar maskalangan). */
  getCredentials(): Promise<{ data: ApiCredential[] }> {
    return request<{ data: ApiCredential[] }>("/credentials");
  },

  /** POST /api/credentials — key/sugar/api-agent'ni qo'lda kiritib credential qo'shadi. */
  createCredential(body: CredentialCreate): Promise<{ data: ApiCredential }> {
    return request<{ data: ApiCredential }>("/credentials", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /** POST /api/credentials/import — raw fetch yoki cURL'dan credential qo'shadi. */
  importCredential(raw: string): Promise<{ data: ApiCredential }> {
    return request<{ data: ApiCredential }>("/credentials/import", {
      method: "POST",
      body: JSON.stringify({ raw }),
    });
  },

  /** PATCH /api/credentials/:id — auth kirishlarini yangilab qayta-auth qiladi. */
  updateCredential(
    id: string,
    body: CredentialUpdate,
  ): Promise<{ data: ApiCredential }> {
    return request<{ data: ApiCredential }>(
      `/credentials/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
  },

  /** Bo'sh PATCH — saqlangan kirishlar bilan tokenni darhol qayta oladi. */
  reauthorizeCredential(id: string): Promise<{ data: ApiCredential }> {
    return request<{ data: ApiCredential }>(
      `/credentials/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify({}) },
    );
  },

  /** DELETE /api/credentials/:id — yumshoq o'chirish (status DELETED). */
  deleteCredential(id: string): Promise<{ data: ApiCredential }> {
    return request<{ data: ApiCredential }>(
      `/credentials/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },

  // ------------------------------------------------------------- ta'minotchilar
  /** GET /api/suppliers — paginatsiyalangan ta'minotchilar (tovar/upload soni bilan). */
  getSuppliers(
    params: GetSuppliersParams = {},
  ): Promise<Paginated<ApiSupplier>> {
    return request<Paginated<ApiSupplier>>(
      `/suppliers${buildQuery({ ...params })}`,
    );
  },

  /** GET /api/suppliers/:id — bitta ta'minotchi. */
  getSupplier(id: string): Promise<{ data: ApiSupplier }> {
    return request<{ data: ApiSupplier }>(
      `/suppliers/${encodeURIComponent(id)}`,
    );
  },

  /** GET /api/suppliers/:id/products — ta'minotchi narx-ro'yxati tovarlari. */
  getSupplierProducts(
    id: string,
    params: GetSupplierProductsParams = {},
  ): Promise<Paginated<ApiSupplierProduct>> {
    return request<Paginated<ApiSupplierProduct>>(
      `/suppliers/${encodeURIComponent(id)}/products${buildQuery({ ...params })}`,
    );
  },

  /** GET /api/supplier-products — barcha ta'minotchilar tovarlari (supplier+kategoriya filtri). */
  getAllSupplierProducts(
    params: GetAllSupplierProductsParams = {},
  ): Promise<Paginated<ApiSupplierProductWithSupplier>> {
    return request<Paginated<ApiSupplierProductWithSupplier>>(
      `/supplier-products${buildQuery({ ...params })}`,
    );
  },

  /** GET /api/supplier-products/categories — filtr uchun mavjud kategoriyalar. */
  getSupplierCategories(supplierId?: string): Promise<{ data: string[] }> {
    return request<{ data: string[] }>(
      `/supplier-products/categories${buildQuery({ supplierId })}`,
    );
  },

  // ------------------------------------------------------------------- matching
  /** POST /api/matching/run — supplier-based matching siklini darhol ishga tushiradi (fon). */
  runMatching(): Promise<{ data: { status: string } }> {
    return request<{ data: { status: string } }>("/matching/run", {
      method: "POST",
    });
  },

  /** POST /api/matching/rematch-unmatched — UNMATCHED lotlarni qayta NEW qilib to'liq matchlaydi. */
  rematchUnmatched(): Promise<{ data: { status: string; reset: number } }> {
    return request<{ data: { status: string; reset: number } }>(
      "/matching/rematch-unmatched",
      { method: "POST" },
    );
  },

  // ------------------------------------------------------------------ PC sborka
  /** GET /api/pc-builds — sborka qilinadigan PC-lotlar ro'yxati + KPI. */
  getPcBuilds(
    params: { page?: number; limit?: number; onlyProfitable?: boolean } = {},
  ): Promise<{
    data: PcBuildSummary[];
    kpis: PcBuildKpis;
    rate: number;
    meta: Paginated<unknown>["meta"];
  }> {
    return request(`/pc-builds${buildQuery({ ...params })}`);
  },

  /** GET /api/pc-builds/:lotId — bitta lot sborkasi (to'liq razbivka). */
  getPcBuild(lotId: string): Promise<{ data: PcBuildDetail }> {
    return request<{ data: PcBuildDetail }>(
      `/pc-builds/${encodeURIComponent(lotId)}`,
    );
  },

  /** GET /api/settings/usd-rate — joriy USD→UZS kurs + manbasi. */
  getUsdRate(): Promise<{ data: UsdRate }> {
    return request<{ data: UsdRate }>("/settings/usd-rate");
  },

  /** PATCH /api/settings/usd-rate — kursni qo'lda o'rnatadi (null = jonli kursga qaytish). */
  setUsdRate(rate: number | null): Promise<{ data: UsdRate }> {
    return request<{ data: UsdRate }>("/settings/usd-rate", {
      method: "PATCH",
      body: JSON.stringify({ rate }),
    });
  },

  /** GET /api/matching/status — qo'lda ishga tushirilgan matching holati. */
  getMatchingStatus(): Promise<{
    data: {
      running: boolean;
      lastResult: { matched: number; notFound: number } | null;
      lastRunAt: string | null;
      lastError: string | null;
    };
  }> {
    return request("/matching/status");
  },

  /** POST /api/suppliers — yangi ta'minotchi. */
  createSupplier(body: SupplierCreate): Promise<{ data: ApiSupplier }> {
    return request<{ data: ApiSupplier }>("/suppliers", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /** PATCH /api/suppliers/:id — tahrirlash / isActive. */
  updateSupplier(
    id: string,
    body: SupplierUpdate,
  ): Promise<{ data: ApiSupplier }> {
    return request<{ data: ApiSupplier }>(
      `/suppliers/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
  },

  /** DELETE /api/suppliers/:id — yumshoq o'chirish (isActive=false). */
  deleteSupplier(id: string): Promise<{ data: ApiSupplier }> {
    return request<{ data: ApiSupplier }>(
      `/suppliers/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },

  /**
   * POST /api/suppliers/:id/uploads — Excel narx-ro'yxatini yuklaydi (multipart).
   * Saqlangan shablon bo'lsa darhol parse qiladi (`status: "parsed"`); aks holda
   * mapping taklifi bilan tasdiq kutadi (`status: "pending_mapping"`).
   */
  uploadSupplierFile(
    id: string,
    file: File,
    sourceLabel?: string,
  ): Promise<{ data: SupplierUploadResult }> {
    const form = new FormData();
    form.set("file", file);
    if (sourceLabel) form.set("sourceLabel", sourceLabel);
    return upload<{ data: SupplierUploadResult }>(
      `/suppliers/${encodeURIComponent(id)}/uploads`,
      form,
    );
  },

  /**
   * GET /api/suppliers/uploads/:uploadId/file — tovar yuklangan Excel faylning
   * o'zini (blob) qaytaradi. :uploadId — UUID yoki qisqa kod (SS1234412).
   * Auth headeri kerakligi uchun oddiy <a href> emas, fetch+blob ishlatiladi.
   */
  async downloadSupplierUploadFile(uploadId: string): Promise<Blob> {
    let res: Response;
    try {
      res = await fetch(
        `${BASE}/suppliers/uploads/${encodeURIComponent(uploadId)}/file`,
        { headers: { ...authHeaders() } },
      );
    } catch (cause) {
      throw new Error(`Lotex API so'rovi muvaffaqiyatsiz (upload file)`, {
        cause,
      });
    }
    if (res.status === 401) onUnauthorized();
    if (!res.ok) throw new Error(`Lotex API ${res.status}: ${res.statusText}`);
    return res.blob();
  },

  /**
   * POST /api/suppliers/uploads/:uploadId/confirm — tasdiqlangan/tuzatilgan
   * mapping bilan tovarlarni o'qib saqlaydi va shablonni saqlaydi.
   */
  confirmSupplierMapping(
    uploadId: string,
    mapping: SupplierMappingSpec,
  ): Promise<{ data: SupplierConfirmResult }> {
    return request<{ data: SupplierConfirmResult }>(
      `/suppliers/uploads/${encodeURIComponent(uploadId)}/confirm`,
      { method: "POST", body: JSON.stringify({ mapping }) },
    );
  },

  // ---------------------------------------------------------- electron shop
  /** GET /api/shop-products — paginatsiyalangan shop tovarlar. */
  getShopProducts(
    params: GetShopProductsParams = {},
  ): Promise<Paginated<ApiShopProduct>> {
    const mapped: Record<string, string | number | boolean | undefined> = {
      ...params,
      status: params.status?.toUpperCase(),
    };
    return request<Paginated<ApiShopProduct>>(
      `/shop-products${buildQuery(mapped)}`,
    );
  },

  /** GET /api/shop-products/:id */
  getShopProduct(id: string): Promise<{ data: ApiShopProduct }> {
    return request<{ data: ApiShopProduct }>(
      `/shop-products/${encodeURIComponent(id)}`,
    );
  },

  /** POST /api/shop-products — yangi tovar. */
  createShopProduct(
    draft: ShopProductDraft,
    entityIds: string[],
  ): Promise<{ data: ApiShopProduct }> {
    return request<{ data: ApiShopProduct }>("/shop-products", {
      method: "POST",
      body: JSON.stringify({ ...draft, entities: entityIds }),
    });
  },

  /** PATCH /api/shop-products/:id — tahrirlash / status. */
  updateShopProduct(
    id: string,
    body: Partial<
      Pick<
        ApiShopProduct,
        "name" | "brand" | "price" | "entities" | "status" | "specs"
      >
    >,
  ): Promise<{ data: ApiShopProduct }> {
    const mapped = {
      ...body,
      status: body.status?.toUpperCase(),
    };
    return request<{ data: ApiShopProduct }>(
      `/shop-products/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(mapped) },
    );
  },

  /** DELETE /api/shop-products/:id */
  deleteShopProduct(id: string): Promise<{ data: { id: string } }> {
    return request<{ data: { id: string } }>(
      `/shop-products/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },

  // ---------------------------------------------- legal entities + uzex katalog
  /** GET /api/legal-entities — yuridik shaxslar (forma + attribution uchun). */
  getLegalEntities(): Promise<{ data: ApiLegalEntity[] }> {
    return request<{ data: ApiLegalEntity[] }>("/legal-entities");
  },

  /** GET /api/shop-catalog/categories — uzex kategoriyalari. */
  getShopCategories(): Promise<{ data: UzexCategory[]; error?: string }> {
    return request<{ data: UzexCategory[]; error?: string }>(
      `/shop-catalog/categories${buildQuery({ lang: currentLang() })}`,
    );
  },

  /** GET /api/shop-catalog/products — kategoriya ichida tovar qidirish. */
  getShopCatalogProducts(
    categoryId: number,
    q?: string,
  ): Promise<{ data: UzexCatalogProduct[]; error?: string }> {
    return request<{ data: UzexCatalogProduct[]; error?: string }>(
      `/shop-catalog/products${buildQuery({ categoryId, q, lang: currentLang() })}`,
    );
  },

  /** GET /api/shop-catalog/product-props/:code — dinamik texnik maydonlar. */
  getShopProductProps(
    productCode: string,
  ): Promise<{ data: UzexProductProp[]; error?: string }> {
    return request<{ data: UzexProductProp[]; error?: string }>(
      `/shop-catalog/product-props/${encodeURIComponent(productCode)}${buildQuery({ lang: currentLang() })}`,
    );
  },

  /** GET /api/shop-catalog/marks/:code */
  getShopMarks(code: string): Promise<{ data: UzexNamed[]; error?: string }> {
    return request(
      `/shop-catalog/marks/${encodeURIComponent(code)}${buildQuery({ lang: currentLang() })}`,
    );
  },
  /** GET /api/shop-catalog/manufacturers/:code */
  getShopManufacturers(
    code: string,
  ): Promise<{ data: UzexNamed[]; error?: string }> {
    return request(
      `/shop-catalog/manufacturers/${encodeURIComponent(code)}${buildQuery({ lang: currentLang() })}`,
    );
  },
  /** GET /api/shop-catalog/regions — viloyat+tuman. */
  getShopRegions(): Promise<{ data: UzexRegion[]; error?: string }> {
    return request(
      `/shop-catalog/regions${buildQuery({ lang: currentLang() })}`,
    );
  },
  /** GET /api/shop-catalog/countries */
  getShopCountries(): Promise<{ data: UzexNamed[]; error?: string }> {
    return request(
      `/shop-catalog/countries${buildQuery({ lang: currentLang() })}`,
    );
  },
  /** GET /api/shop-catalog/periods — Kun/Oy/Yil. */
  getShopPeriods(): Promise<{ data: UzexNamed[]; error?: string }> {
    return request(
      `/shop-catalog/periods${buildQuery({ lang: currentLang() })}`,
    );
  },
  /** GET /api/shop-catalog/user-records — moliyaviy hisoblar. */
  getShopUserRecords(
    entityId?: string,
  ): Promise<{ data: UzexUserRecord[]; error?: string }> {
    return request(`/shop-catalog/user-records${buildQuery({ entityId })}`);
  },

  /** GET /api/shop-catalog/files — uzex'ga oldin yuklangan rasmlar (fayl-menejer). */
  getShopFiles(params: {
    q?: string;
    from?: number;
    to?: number;
  }): Promise<{ data: UzexUserFile[]; error?: string }> {
    return request(`/shop-catalog/files${buildQuery(params)}`);
  },

  /** Yuklangan rasm preview URLi (backend proxy) — `<img :src>` uchun. */
  shopFileImageUrl(f: Pick<UzexUserFile, "path" | "name">): string {
    return `${BASE}/shop-catalog/file/image?path=${encodeURIComponent(f.path)}&name=${encodeURIComponent(f.name)}`;
  },

  /** POST /api/shop-catalog/upload — rasm yuklash; javob { fileId }. */
  async uploadShopImage(
    file: File,
  ): Promise<{ data: { fileId: number | null } }> {
    const form = new FormData();
    form.append("file", file, file.name);
    const res = await fetch(`${BASE}/shop-catalog/upload`, {
      method: "POST",
      headers: { ...authHeaders() },
      body: form,
    });
    if (res.status === 401) onUnauthorized();
    if (!res.ok) throw new Error(`Upload HTTP ${res.status}`);
    return res.json();
  },

  /** POST /api/shop-products/publish — bir nechta entityda offer e'lon qilish. */
  publishOffer(payload: {
    entities: string[];
    offer: OfferInput;
    name: string;
    brand: string;
    specs: [string, string][];
    /** Har entity uchun tanlangan moliyaviy hisob: { [entityId]: record_id } */
    records?: Record<string, number>;
  }): Promise<{
    data: {
      product: ApiShopProduct | null;
      results: {
        entityId: string;
        name: string;
        ok: boolean;
        error?: string;
      }[];
      published: number;
      total: number;
    };
  }> {
    return request("/shop-products/publish", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /** GET /api/shop-offers?statusId= — har entity bo'yicha uzex offerlari. */
  getShopOffers(
    statusId?: number,
  ): Promise<{ data: CredentialOffers[]; meta?: unknown }> {
    return request(`/shop-offers${buildQuery({ statusId })}`);
  },

  /** GET /api/shop-offers/status-menu?entityId= — status menyusi (soni bilan). */
  getShopOffersStatusMenu(
    entityId?: string,
  ): Promise<{ data: OfferStatusMenuItem[]; error?: string }> {
    return request(`/shop-offers/status-menu${buildQuery({ entityId })}`);
  },

  /** GET /api/shop-offers/detail — bitta offer to'liq ma'lumoti + rad sababi (AI/moderator). */
  getShopOfferDetail(
    entityId: string,
    offerId: number,
  ): Promise<{ data: ShopOfferDetailResponse }> {
    return request(`/shop-offers/detail${buildQuery({ entityId, offerId })}`);
  },

  /** GET /api/analytics — dashboard agregat statistikasi (jonli). */
  getAnalytics(): Promise<{ data: unknown }> {
    return request("/analytics");
  },

  /** GET /api/notifications — oxirgi bildirishnomalar + o'qilmaganlar soni. */
  getNotifications(): Promise<{
    data: AppNotification[];
    unreadCount: number;
  }> {
    return request("/notifications");
  },

  /** POST /api/notifications/:id/read — bittasini o'qilgan deb belgilash. */
  markNotificationRead(id: string): Promise<{ data: AppNotification }> {
    return request(`/notifications/${encodeURIComponent(id)}/read`, {
      method: "POST",
    });
  },

  /** POST /api/notifications/read-all — hammasini o'qilgan deb belgilash. */
  markAllNotificationsRead(): Promise<{ data: { count: number } }> {
    return request("/notifications/read-all", { method: "POST" });
  },
};
