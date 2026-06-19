import type {
  ApiLot,
  ApiManagerDecision,
  ApiRecommendation,
  ApiRecommendationWithLot,
  Paginated,
} from "@/types/api";

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
};
