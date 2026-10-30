import { NextRequest, NextResponse } from "next/server";
import { buildExportMatrix, filterExportColumns } from "@/lib/export/build-matrix";
import type { ExportFormat, ExportTableId } from "@/lib/export/constants";
import {
  fetchAllCustomersForExport,
  fetchAllOrdersForExport,
  parseOrdersExportSearchParams,
} from "@/lib/export/server/fetch-rows";
import {
  buildCustomersExportColumns,
  type CustomerExportRow,
} from "@/lib/export/tables/customers";
import {
  buildOrdersExportColumns,
  ORDERS_EXPORT_COLUMN_IDS,
} from "@/lib/export/tables/orders";
import { matrixToCsv } from "@/lib/export/to-csv";
import { matrixToXlsxBytes } from "@/lib/export/to-xlsx";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceSession } from "@/lib/workspace/active";
import { canViewFinance } from "@/lib/workspace/permissions";
import { requireRole } from "@/lib/workspace/require-role";
import { buildCustomerStatsMap } from "@/features/customers/customer-utils";
import type { Job } from "@/types/database";

export const dynamic = "force-dynamic";

const ALLOWED: ExportTableId[] = ["orders", "customers"];

function parseFormat(value: string | null): ExportFormat {
  return value === "xlsx" ? "xlsx" : "csv";
}

function parseVisibleColumns(value: string | null): string[] | undefined {
  if (!value?.trim()) return undefined;
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ table: string }> }
) {
  const session = await requireWorkspaceSession();
  if (!session.ok) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: session.status });
  }

  const auth = requireRole(session, "export.data");
  if (!auth.ok) return auth.response;

  const { table } = await context.params;
  if (!ALLOWED.includes(table as ExportTableId)) {
    return NextResponse.json({ error: "Geçersiz tablo" }, { status: 404 });
  }

  const searchParams = request.nextUrl.searchParams;
  const format = parseFormat(searchParams.get("format"));
  const visible = parseVisibleColumns(searchParams.get("columns"));
  const showFinance = canViewFinance(session.role);

  const supabase = await createClient();

  try {
    if (table === "orders") {
      const params = parseOrdersExportSearchParams(searchParams);
      const { rows } = await fetchAllOrdersForExport(
        supabase,
        session.workspaceId,
        params
      );
      let columns = buildOrdersExportColumns({ showFinance });
      columns = filterExportColumns(columns, visible);
      const matrix = buildExportMatrix(rows as Job[], columns);
      return await fileResponse(format, "siparisler", matrix);
    }

    const q = searchParams.get("q") ?? undefined;
    const customers = await fetchAllCustomersForExport(
      supabase,
      session.workspaceId,
      q
    );
    const { data: jobs } = await supabase
      .from("jobs")
      .select("customer_id, revenue_amount, amount_remaining, job_date, payment_status")
      .eq("user_id", session.workspaceId);
    const statsMap = buildCustomerStatsMap((jobs ?? []) as import("@/types/database").Job[]);
    const exportRows: CustomerExportRow[] = customers.map((c) => ({
      ...c,
      stats: statsMap.get(c.id) ?? {
        orderCount: 0,
        totalRevenue: 0,
        pendingCollection: 0,
        lastOrderDate: null,
      },
    }));
    const columns = filterExportColumns(
      buildCustomersExportColumns({ showFinance }),
      visible
    );
    const matrix = buildExportMatrix(exportRows, columns);
    return await fileResponse(format, "musteriler", matrix);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Dışa aktarma başarısız";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function fileResponse(
  format: ExportFormat,
  basename: string,
  matrix: { headers: string[]; rows: string[][] }
) {
  const date = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    const csv = matrixToCsv(matrix);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${basename}_${date}.csv"`,
      },
    });
  }

  const bytes = await matrixToXlsxBytes("Veri", matrix);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${basename}_${date}.xlsx"`,
    },
  });
}
