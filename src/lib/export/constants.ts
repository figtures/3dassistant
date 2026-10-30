/** Sunucu tarafı dışa aktarma eşiği (filtrelenmiş satır sayısı). */
export const SERVER_EXPORT_ROW_THRESHOLD = 5000;

export type ExportTableId = "orders" | "customers";

export type ExportFormat = "csv" | "xlsx";
