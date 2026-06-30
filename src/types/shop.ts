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
