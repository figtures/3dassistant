"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ds";
import type { Customer } from "@/types/database";
import { cn } from "@/lib/utils";

export type CustomerComboboxProps = {
  customers: Customer[];
  value: string;
  pendingName: string;
  onChange: (customerId: string) => void;
  onPendingName: (name: string) => void;
  onClearPending: () => void;
  id?: string;
};

export function CustomerCombobox({
  customers,
  value,
  pendingName,
  onChange,
  onPendingName,
  onClearPending,
  id,
}: CustomerComboboxProps) {
  const [query, setQuery] = useState("");
  const selected = customers.find((c) => c.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [customers, query]);

  const showCreate =
    query.trim().length > 0 &&
    !customers.some(
      (c) => c.name.toLowerCase() === query.trim().toLowerCase()
    );

  return (
    <div className="space-y-2">
      <Input
        id={id}
        value={selected ? selected.name : query || pendingName}
        onChange={(e) => {
          onClearPending();
          onChange("");
          setQuery(e.target.value);
        }}
        placeholder="Müşteri ara…"
        autoComplete="off"
      />
      {(query.trim() || (!value && !pendingName)) && (
        <ul
          className="max-h-40 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-sm shadow-e2"
          role="listbox"
        >
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                className={cn(
                  "flex w-full rounded-md px-2 py-1.5 text-left hover:bg-accent",
                  value === c.id && "bg-accent"
                )}
                onClick={() => {
                  onChange(c.id);
                  onClearPending();
                  setQuery("");
                }}
              >
                {c.name}
              </button>
            </li>
          ))}
          {showCreate ? (
            <li>
              <button
                type="button"
                className="flex w-full rounded-md px-2 py-1.5 text-left text-primary hover:bg-accent"
                onClick={() => {
                  onPendingName(query.trim());
                  onChange("");
                  setQuery("");
                }}
              >
                Yeni müşteri: {query.trim()}
              </button>
            </li>
          ) : null}
          {!filtered.length && !showCreate ? (
            <li className="px-2 py-1.5 text-muted-foreground">Sonuç yok</li>
          ) : null}
        </ul>
      )}
      {pendingName && !value ? (
        <p className="text-xs text-muted-foreground">
          Yeni müşteri kaydedilecek: {pendingName}
        </p>
      ) : null}
    </div>
  );
}
