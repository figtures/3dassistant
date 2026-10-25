import * as XLSX from "xlsx";

export interface CustomerImportRow {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
}

const TEMPLATE_HEADERS = ["Ad Soyad", "E-posta", "Telefon", "Firma", "Notlar"];

export function downloadCustomerTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    ["Ahmet Yılmaz", "ahmet@example.com", "05551234567", "ABC Ltd.", "VIP müşteri"],
    ["Ayşe Demir", "ayse@example.com", "05559876543", "", ""],
  ]);

  ws["!cols"] = [{ wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 30 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Müşteriler");
  XLSX.writeFile(wb, "musteri_sablonu.xlsx");
}

export function parseCustomerExcel(file: File): Promise<CustomerImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

        const parsed: CustomerImportRow[] = rows
          .map((row) => ({
            name: row["Ad Soyad"] || row["name"] || row["Name"] || "",
            email: row["E-posta"] || row["email"] || row["Email"] || undefined,
            phone: row["Telefon"] || row["phone"] || row["Phone"] || undefined,
            company: row["Firma"] || row["company"] || row["Company"] || undefined,
            notes: row["Notlar"] || row["notes"] || row["Notes"] || undefined,
          }))
          .filter((r) => r.name.trim());

        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function exportCustomersToExcel(
  customers: { name: string; email?: string | null; phone?: string | null; company?: string | null; notes?: string | null }[]
) {
  const rows = customers.map((c) => [
    c.name,
    c.email ?? "",
    c.phone ?? "",
    c.company ?? "",
    c.notes ?? "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Müşteriler");
  XLSX.writeFile(wb, `musteriler_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
