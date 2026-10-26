"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(function Command({ className, ...props }, ref) {
  return (
    <CommandPrimitive
      ref={ref}
      className={cn(
        "flex w-full flex-col overflow-hidden text-popover-foreground",
        className
      )}
      {...props}
    />
  );
});

export function CommandInput({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border px-3.5">
      <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <CommandPrimitive.Input
        className={cn(
          "h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground",
          className
        )}
        {...props}
      />
    </div>
  );
}

export function CommandList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    ref.current?.querySelector("[cmdk-list-sizer]")?.setAttribute("role", "presentation");
    ref.current
      ?.querySelectorAll("[cmdk-separator]")
      .forEach((el) => el.setAttribute("role", "none"));
  });
  return (
    <CommandPrimitive.List
      ref={ref}
      className={cn(
        "max-h-[min(360px,60dvh)] overflow-y-auto overscroll-contain p-1.5 max-sm:max-h-[calc(100dvh-8rem)]",
        className
      )}
      {...props}
    />
  );
}

export function CommandEmpty({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      className={cn("px-3 py-8 text-center text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export function CommandGroup({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        "py-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase",
        className
      )}
      {...props}
    />
  );
}

export function CommandSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      className={cn("-mx-1.5 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

export type CommandItemProps = React.ComponentPropsWithoutRef<
  typeof CommandPrimitive.Item
> & {
  icon?: React.ReactNode;
  shortcut?: string;
  hint?: React.ReactNode;
  children?: React.ReactNode;
};

export function CommandItem({
  className,
  icon,
  shortcut,
  hint,
  children,
  ...props
}: CommandItemProps) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none select-none",
        "data-[selected=true]:bg-accent data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {icon}
      <span className="grid min-w-0 flex-1">
        <span className="truncate">{children}</span>
        {hint && (
          <span className="truncate text-xs text-muted-foreground">{hint}</span>
        )}
      </span>
      {shortcut && (
        <span className="hidden gap-1 sm:flex">
          {shortcut.split(" ").map((k: string, i: number) => (
            <kbd
              key={i}
              className="grid h-5 min-w-5 place-items-center rounded-md bg-muted px-1 font-sans text-xs text-foreground/70"
            >
              {k}
            </kbd>
          ))}
        </span>
      )}
    </CommandPrimitive.Item>
  );
}

export interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder?: string;
  emptyText?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  resultsSummary?: string;
  onQueryChange?: (query: string) => void;
}

export function CommandMenu({
  open,
  onOpenChange,
  placeholder = "Sayfa veya eylem ara…",
  emptyText = "Sonuç bulunamadı.",
  footer,
  children,
  resultsSummary,
  onQueryChange,
}: CommandMenuProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[var(--z-command)] bg-black/30 dark:bg-black/60",
            "motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0",
            "motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0"
          )}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-[var(--z-command)] overflow-hidden bg-popover shadow-2xl ring-1 ring-border outline-none",
            "left-1/2 w-[calc(100vw-24px)] max-w-[560px] -translate-x-1/2 rounded-2xl",
            "top-[12dvh] max-sm:inset-0 max-sm:h-dvh max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:rounded-none",
            "motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:zoom-in-95",
            "motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=closed]:zoom-out-95"
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            Komut paleti
          </DialogPrimitive.Title>
          {resultsSummary ? (
            <p className="sr-only" aria-live="polite">
              {resultsSummary}
            </p>
          ) : null}
          <Command loop>
            <CommandInput placeholder={placeholder} onValueChange={onQueryChange} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              {children}
            </CommandList>
            <div className="flex flex-wrap items-center gap-3 border-t border-border px-3.5 py-2 text-xs text-muted-foreground">
              {footer ?? (
                <>
                  <span>
                    <kbd className="font-sans">↑↓</kbd> gezin
                  </span>
                  <span>
                    <kbd className="font-sans">↵</kbd> aç
                  </span>
                  <span>
                    <kbd className="font-sans">esc</kbd> kapat
                  </span>
                </>
              )}
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
