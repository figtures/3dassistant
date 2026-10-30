"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { TableUrlSnapshot } from "@/types/database";

export const TABLE_URL_CORE_KEYS = ["q", "sort", "dir", "page", "size"] as const;

export type TableUrlCoreKey = (typeof TABLE_URL_CORE_KEYS)[number];

export type TableUrlPatch = Record<string, string | null>;

export type { TableUrlSnapshot };

export type SerializeTableUrlOptions = {
  /** Bu anahtarlar kayıtlı görünüme dahil edilmez (ör. sheet, modal). */
  excludeKeys?: readonly string[];
};

export type ApplyTableUrlSnapshotOptions = SerializeTableUrlOptions & {
  /** Görünüm uygulanırken korunan mevcut URL anahtarları. */
  preserveKeys?: readonly string[];
};

function normalizeExclude(excludeKeys?: readonly string[]): Set<string> {
  return new Set(excludeKeys ?? []);
}

/** URLSearchParams → düz string haritası (boş değerler atlanır). */
export function serializeTableUrlState(
  params: URLSearchParams,
  options?: SerializeTableUrlOptions
): TableUrlSnapshot {
  const exclude = normalizeExclude(options?.excludeKeys);
  const out: TableUrlSnapshot = {};
  params.forEach((value, key) => {
    if (exclude.has(key) || value === "") return;
    out[key] = value;
  });
  return out;
}

/** Kayıtlı görünümü mevcut URL üzerine uygular; preserveKeys korunur. */
export function applyTableUrlSnapshot(
  current: URLSearchParams,
  snapshot: TableUrlSnapshot,
  options?: ApplyTableUrlSnapshotOptions
): URLSearchParams {
  const exclude = normalizeExclude(options?.excludeKeys);
  const preserve = new Set(options?.preserveKeys ?? []);
  const next = new URLSearchParams();

  current.forEach((value, key) => {
    if (preserve.has(key)) {
      next.set(key, value);
    }
  });

  for (const [key, value] of Object.entries(snapshot)) {
    if (exclude.has(key) || preserve.has(key)) continue;
    if (value === "") continue;
    next.set(key, value);
  }

  return next;
}

export function patchTableSearchParams(
  current: URLSearchParams,
  patch: TableUrlPatch
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value == null || value === "") next.delete(key);
    else next.set(key, value);
  }
  return next;
}

export function tableSearchParamsToQueryString(params: URLSearchParams): string {
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export type UseTableUrlStateOptions = {
  pathname: string;
  excludeFromSnapshot?: readonly string[];
  preserveOnApply?: readonly string[];
};

export function useTableUrlState(options: UseTableUrlStateOptions) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const snapshot = useMemo(
    () =>
      serializeTableUrlState(searchParams, {
        excludeKeys: options.excludeFromSnapshot,
      }),
    [searchParams, options.excludeFromSnapshot]
  );

  const replaceParams = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      router.replace(qs ? `${options.pathname}?${qs}` : options.pathname, {
        scroll: false,
      });
    },
    [router, options.pathname]
  );

  const patch = useCallback(
    (patchValues: TableUrlPatch) => {
      replaceParams(patchTableSearchParams(searchParams, patchValues));
    },
    [replaceParams, searchParams]
  );

  const applySnapshot = useCallback(
    (state: TableUrlSnapshot) => {
      replaceParams(
        applyTableUrlSnapshot(searchParams, state, {
          excludeKeys: options.excludeFromSnapshot,
          preserveKeys: options.preserveOnApply,
        })
      );
    },
    [
      replaceParams,
      searchParams,
      options.excludeFromSnapshot,
      options.preserveOnApply,
    ]
  );

  const get = useCallback(
    (key: string, fallback = "") => searchParams.get(key) ?? fallback,
    [searchParams]
  );

  return {
    searchParams,
    snapshot,
    patch,
    applySnapshot,
    get,
  };
}
