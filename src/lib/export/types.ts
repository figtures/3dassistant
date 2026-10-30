export type ExportCellKind = "text" | "number" | "currency" | "date";

export type ExportColumn<T> = {
  id: string;
  header: string;
  kind?: ExportCellKind;
  getValue: (row: T) => unknown;
};

export type ExportMatrix = {
  headers: string[];
  rows: string[][];
};
