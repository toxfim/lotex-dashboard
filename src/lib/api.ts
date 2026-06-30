import type {
  ApiLot,
  ApiManagerDecision,
  ApiRecommendation,
  ApiRecommendationWithLot,
  Paginated,
} from "@/types/api";
import type {
  ApiCredential,
  CredentialCreate,
  CredentialUpdate,
} from "@/types/credential";
import type { ApiShopProduct, ShopProductDraft, ShopStatus } from "@/types/shop";
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

// Backendga proxy qilinadigan prefiks (vite.config.ts → server.proxy).
const BASE = "/api";

export interface GetLotsParams {
  page?: number;
  limit?: number;
  status?: "NEW" | "PROCESSING" | "EXPIRED";
  tenderResult?: "UNKNOWN" | "WON" | "LOST";
  search?: string;
  matched?: boolean;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch (cause) {
    // Tarmoq/proxy xatosi — fail loud (CLAUDE.md §1).
    throw new Error(`Lotex API so'rovi muvaffaqiyatsiz (${path})`, { cause });
  }

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
      headers: { Accept: "application/json" },
      body,
    });
  } catch (cause) {
    throw new Error(`Lotex API yuklash muvaffaqiyatsiz (${path})`, { cause });
  }

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
  /** GET /api/lots — paginatsiyalangan lotlar ro'yxati. */
  getLots(params: GetLotsParams = {}): Promise<Paginated<ApiLot>> {
    return request<Paginated<ApiLot>>(`/lots${buildQuery({ ...params })}`);
  },

  /** GET /api/lots/:id — bitta lot (id UUID yoki uzexLotId). */
  getLot(id: string): Promise<{ data: ApiLot }> {
    return request<{ data: ApiLot }>(`/lots/${encodeURIComponent(id)}`);
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
    body: Partial<Pick<ApiShopProduct, "name" | "brand" | "price" | "entities" | "status" | "specs">>,
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
};
