"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useTenantId } from "@/components/workspace/workspace-provider";

export type GlobalSearchCustomer = {
  id: string;
  name: string;
};

export type GlobalSearchJob = {
  id: string;
  title: string | null;
  customer: { name: string } | null;
};

export type GlobalSearchMachine = {
  id: string;
  name: string;
};

export type GlobalSearchCatalogItem = {
  id: string;
  name: string;
  sku: string | null;
};

export type GlobalSearchResults = {
  customers: GlobalSearchCustomer[];
  jobs: GlobalSearchJob[];
  machines: GlobalSearchMachine[];
  catalogItems: GlobalSearchCatalogItem[];
};

function escapeIlike(term: string): string {
  return term.replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

async function fetchGlobalSearch(
  tenantId: string,
  q: string
): Promise<GlobalSearchResults> {
  const supabase = createClient();
  const pattern = `%${escapeIlike(q)}%`;

  const [customers, jobs, machines, catalogItems] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name")
      .eq("user_id", tenantId)
      .ilike("name", pattern)
      .order("name")
      .limit(5),
    supabase
      .from("jobs")
      .select("id, title, customer:customers(name)")
      .eq("user_id", tenantId)
      .ilike("title", pattern)
      .order("job_date", { ascending: false })
      .limit(5),
    supabase
      .from("machines")
      .select("id, name")
      .eq("user_id", tenantId)
      .ilike("name", pattern)
      .order("name")
      .limit(5),
    supabase
      .from("catalog_items")
      .select("id, name, sku")
      .eq("user_id", tenantId)
      .or(`name.ilike."${pattern}",sku.ilike."${pattern}"`)
      .order("name")
      .limit(5),
  ]);

  if (customers.error) throw customers.error;
  if (jobs.error) throw jobs.error;
  if (machines.error) throw machines.error;
  if (catalogItems.error) throw catalogItems.error;

  const jobRows = jobs.data ?? [];
  const normalizedJobs: GlobalSearchJob[] = jobRows.map((row) => {
    const raw = row as {
      id: string;
      title: string | null;
      customer: { name: string } | { name: string }[] | null;
    };
    const customer = Array.isArray(raw.customer)
      ? (raw.customer[0] ?? null)
      : raw.customer;
    return {
      id: raw.id,
      title: raw.title,
      customer,
    };
  });

  return {
    customers: (customers.data ?? []) as GlobalSearchCustomer[],
    jobs: normalizedJobs,
    machines: (machines.data ?? []) as GlobalSearchMachine[],
    catalogItems: (catalogItems.data ?? []) as GlobalSearchCatalogItem[],
  };
}

export function useGlobalSearch(query: string) {
  const tenantId = useTenantId();
  const trimmed = query.trim();
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(trimmed), 200);
    return () => window.clearTimeout(handle);
  }, [trimmed]);

  const searchQuery = useQuery({
    queryKey: ["global-search", tenantId, debounced],
    enabled: debounced.length >= 2,
    queryFn: () => fetchGlobalSearch(tenantId, debounced),
    staleTime: 30_000,
  });

  return {
    debouncedQuery: debounced,
    ...searchQuery,
  };
}

export function countGlobalSearchResults(data: GlobalSearchResults | undefined): number {
  if (!data) return 0;
  return (
    data.customers.length +
    data.jobs.length +
    data.machines.length +
    data.catalogItems.length
  );
}
