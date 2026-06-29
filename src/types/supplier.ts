// Lotex backend (src/modules/api/suppliers.ts → /api/suppliers) javob shakllari.
// Prisma `Supplier` / `SupplierProduct` / `SupplierUpload` modellariga mos keladi;
// JSON orqali kelganda `Date` maydonlar ISO string bo'ladi.

export type CurrencyType = "USD" | "UZS";

/** GET /api/suppliers ro'yxat elementi — tovar/upload sonlari bilan. */
export interface ApiSupplier {
  id: string;
  name: string;
  inn: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    products: number;
    uploads: number;
  };
}

export interface SupplierCreate {
  name: string;
  inn?: string | null;
  phone?: string | null;
  email?: string | null;
  note?: string | null;
}

export interface SupplierUpdate {
  name?: string;
  inn?: string | null;
  phone?: string | null;
  email?: string | null;
  note?: string | null;
  isActive?: boolean;
}

/** GET /api/suppliers/:id/products elementi. */
export interface ApiSupplierProduct {
  id: string;
  supplierId: string;
  name: string;
  model: string | null;
  category: string | null;
  sheet: string | null;
  costPrice: number | null;
  retailPrice: number | null;
  currency: CurrencyType;
  uploadId: string | null;
  normalizedName: string | null;
  createdAt: string;
}

/** GET /api/supplier-products elementi — barcha supplierlar bo'yicha, supplier nomi bilan. */
export interface ApiSupplierProductWithSupplier extends ApiSupplierProduct {
  supplier: { id: string; name: string };
}

// ---------------------------------------------------------------- Excel import
// Bitta gorizontal jadval bloki (ko'p faylda bir sheetda bir nechta blok yonma-yon).
export interface ColumnBlock {
  nameCol: string; // tovar nomi ustuni (majburiy)
  modelCol?: string; // model/kod/artikul
  costCol?: string; // optom / tan narx
  retailCol?: string; // sotuv / chakana narx
  categoryCol?: string; // kategoriya alohida ustunda turganda
  skip?: boolean; // arxiv/eski-narx bloki — o'tkazib yuboriladi
}

export interface SheetMapping {
  sheet: string; // workbookdagi nom bilan aynan mos
  skip?: boolean; // bo'sh / export / arxiv sheet
  dataStartRow: number; // ma'lumot boshlanadigan birinchi qator (1-based)
  blocks: ColumnBlock[];
  categoryFromSheetName?: boolean; // kategoriya sheet nomidan olinsinmi
}

/** propose-mapping taklif qiladi, hodim tasdiqlaydi/tuzatadi, shablon sifatida saqlanadi. */
export interface SupplierMappingSpec {
  currency: CurrencyType;
  sheets: SheetMapping[];
}

/** Bitta sheet preview'i — operator mappingni tekshirishi uchun. */
export interface SheetPreview {
  sheet: string;
  rowCount: number;
  columnCount: number;
  merges: string[];
  rows: string[][]; // dastlabki N qator × M ustun (matn)
}

export interface WorkbookPreview {
  sheets: SheetPreview[];
  fingerprint: string;
}

/** POST /api/suppliers/:id/uploads — fayl saqlangan shablon bilan darhol o'qildi. */
export interface SupplierUploadParsed {
  uploadId: string;
  status: "parsed";
  autoMapped: boolean;
  rowsParsed: number;
  replaced: number;
}

/** POST /api/suppliers/:id/uploads — shablon yo'q, hodim tasdig'i kutilmoqda. */
export interface SupplierUploadPendingMapping {
  uploadId: string;
  status: "pending_mapping";
  autoMapped: false;
  fingerprint: string;
  preview: WorkbookPreview;
  proposedMapping: SupplierMappingSpec;
}

export type SupplierUploadResult =
  | SupplierUploadParsed
  | SupplierUploadPendingMapping;

/** POST /api/suppliers/uploads/:uploadId/confirm javobi. */
export interface SupplierConfirmResult {
  uploadId: string;
  status: "parsed";
  rowsParsed: number;
  replaced: number;
}
