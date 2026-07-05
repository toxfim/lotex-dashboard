// Electron Shop domeni — katalog, dinamik tovar maydonlari va e'lon holatlari.

export type ShopStatus = "published" | "moderation" | "rejected";

export interface LegalEntity {
  id: string;
  name: string;
  inn: string;
  region: string;
}

export type ShopFieldType =
  | "select"
  | "number"
  | "region"
  | "text"
  | "textarea";

export type ShopFieldGroup =
  | "specs-req"
  | "specs-opt"
  | "price"
  | "delivery"
  | "desc";

/** Hudud maydoni qiymati (viloyat + tuman). */
export interface RegionValue {
  vil?: string;
  tuman?: string;
}

export type ShopFieldValue = string | RegionValue | undefined;

/** Toifa sxemasidagi xom xususiyat (fields generatsiyasi uchun manba). */
export interface ShopSpec {
  key: string;
  label: string;
  required: boolean;
  options: string[];
}

/** Formada render qilinadigan to'liq maydon. */
export interface ShopField {
  key: string;
  label: string;
  type: ShopFieldType;
  required: boolean;
  group: ShopFieldGroup;
  options?: string[];
  unit?: string;
}

export interface ShopSubCategory {
  id: string;
  name: string;
  suppliers: string[];
  specs: ShopSpec[];
  fields: ShopField[];
}

export interface ShopCategory {
  id: string;
  name: string;
  subs: ShopSubCategory[];
}

export interface ShopProduct {
  id: string;
  cat: string;
  sub: string;
  name: string;
  brand: string;
  price: number;
  entities: string[];
  status: ShopStatus;
  specs: [string, string][];
}

export interface ShopStatusMeta {
  label: string;
  cls: string;
}

/** Add-product formidan chiqadigan qoralama (entity'lar alohida uzatiladi). */
export interface ShopProductDraft {
  cat: string;
  sub: string;
  name: string;
  brand: string;
  price: number;
  specs: [string, string][];
}

/** Backend API dan keladigan ShopProduct modeli. */
export interface ApiShopProduct {
  id: string;
  cat: string;
  sub: string;
  name: string;
  brand: string;
  price: number;
  entities: string[];
  status: ShopStatus;
  specs: [string, string][];
  createdAt: string;
  updatedAt: string;
}

/** GET /api/legal-entities — yuridik shaxs (UzexCredential). */
export interface ApiLegalEntity {
  id: string;
  name: string;
  inn: string | null;
  orgForm: string | null;
  region: string | null;
  connected: boolean;
  status: string;
}

/** uzex katalog (BFF) tiplari — dinamik forma uchun. */
export interface UzexCategory {
  id: number;
  name: string;
}

export interface UzexCatalogProduct {
  id: number;
  name: string;
  product_code: string;
  category_id: number;
  type_id: number;
}

export interface UzexPropItem {
  value: number;
  value_name: string;
}

export interface UzexProductProp {
  name: string;
  is_required: number;
  pnum: number;
  items: UzexPropItem[];
  user_value: number | null;
}

export interface UzexNamed {
  id: number;
  name: string;
}

export interface UzexDistrict {
  id: number;
  name: string;
  region_id: number;
}

export interface UzexRegion {
  id: number;
  name: string;
  children: UzexDistrict[];
}

export interface UzexUserRecord {
  record_id: number;
  record_text: string;
  amount: number;
}

/** uzex fayl-menejeridagi yuklangan fayl (GET /api/shop-catalog/files). */
export interface UzexUserFile {
  id: number;
  /** Serverdagi saqlangan nom (GUID.ext) — preview URL uchun. */
  name: string;
  /** Foydalanuvchi yuklagan asl nom. */
  custom_name: string;
  /** Katalog yo'li, masalan: files/user-files/2026/7/4 */
  path: string;
  file_size: number;
  ext: string;
  /** 1=rasm, 2=hujjat, 3=video. */
  ext_type_id: number;
  date_ini: string;
  /** Umumiy fayllar soni (sahifalash uchun) — har elementda takrorlanadi. */
  total_count?: number;
}

/** Add-offer formidan backend /publish ga yuboriladigan offer payload (camelCase). */
export interface OfferInput {
  productCode: string;
  categoryId: number;
  price: number;
  amount: number;
  minDelivery: number;
  maxDelivery: number;
  guaranteePeriod: number;
  guaranteePeriodId: number;
  deliveryTerm: number;
  deliveryTermPeriodId: number;
  shelfLife?: number | null;
  shelfLifePeriodId?: number | null;
  issueDate?: string | null;
  producerCountryId?: number | null;
  markId?: number | null;
  markName?: string | null;
  manufacturerId?: number | null;
  manufacturerName?: string | null;
  mainImageId?: number | null;
  /** Bir nechta rasm (uzex maks 10 ta) — birinchisi asosiy. */
  imageIds?: number[];
  /** Rasm metadatasi — backend boshqa entity'larga nusxalashi uchun
   *  (uzex'da file_Id akkauntga bog'liq). */
  images?: {
    id: number;
    name: string;
    path: string;
    customName?: string;
    size?: number;
  }[];
  conditions: string;
  publishTypeId?: number;
  displayOnShop?: number;
  displayOnNational?: number;
  jsProperties: { property_Num: number; property_Value: string }[];
  deliveryDistricts: { region_Id: number; district_Id: number }[];
}

/** Bitta uzex provider offer (FilterProviderOffers). */
export interface ProviderOffer {
  id: number;
  product_code: string;
  product_name: string;
  price: number;
  amount: number;
  status_name: string;
  status_id: number;
  category_name: string;
  mark_name: string | null;
  manufacturer_name: string | null;
  start_date: string;
  end_date: string;
  display_on_shop: 0 | 1;
  display_on_national: 0 | 1;
}

/** GET /api/shop-offers — bitta credential bo'yicha offerlar. */
export interface CredentialOffers {
  credentialId: string;
  name: string;
  inn: string | null;
  offers: ProviderOffer[];
  error?: string;
}

export interface OfferStatusMenuItem {
  status_id: number;
  status_name: string;
  count: number;
}

/** AI/moderator tahlil mezoni (rad sababi). */
export interface AnalyseCriterion {
  analyze_id?: number;
  criteria_name: string;
  score?: number;
  percentage?: number;
  result_short?: string;
  result?: string;
}

/** GET /api/shop-offers/detail javobi. */
export interface ShopOfferDetailResponse {
  analyse: AnalyseCriterion[] | null;
  offer: Record<string, unknown> | null;
  analyseError?: string;
}
