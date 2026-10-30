"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  dialogContentSizeVariants,
  type DialogContentSize,
} from "@/components/ds/variants";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-[var(--z-modal)] bg-black/60",
        "motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0",
        "motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0",
        className
      )}
      {...props}
    />
  );
});

export type DialogContentProps = React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> & {
  size?: DialogContentSize;
  showClose?: boolean;
};

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(function DialogContent(
  { className, children, size = "md", showClose = true, ...props },
  ref
) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed z-[var(--z-modal)] flex max-h-[min(880px,calc(100dvh-2rem))] flex-col overflow-hidden",
          "border border-border bg-popover text-popover-foreground shadow-e3 outline-none",
          "max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:max-h-[min(90dvh,880px)] max-sm:w-full max-sm:max-w-none",
          "max-sm:rounded-t-2xl max-sm:rounded-b-none",
          "sm:left-1/2 sm:top-1/2 sm:w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
          dialogContentSizeVariants({ size }),
          "motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0",
          "max-sm:motion-safe:data-[state=open]:slide-in-from-bottom-4",
          "sm:motion-safe:data-[state=open]:zoom-in-95",
          "motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0",
          "max-sm:motion-safe:data-[state=closed]:slide-out-to-bottom-4",
          "sm:motion-safe:data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        {showClose ? (
          <DialogPrimitive.Close
            type="button"
            className={cn(
              "absolute right-3 top-3 flex size-9 items-center justify-center rounded-lg",
              "text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            )}
            aria-label="Kapat"
          >
            <X className="size-4" aria-hidden />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex shrink-0 flex-col gap-1.5 border-b border-border px-5 py-4 pr-14",
        className
      )}
      {...props}
    />
  );
}

export function DialogBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="dialog-body"
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4",
        className
      )}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-popover px-5 py-4 sm:flex-row sm:justify-end",
        "pb-[max(1rem,env(safe-area-inset-bottom))]",
        className
      )}
      {...props}
    />
  );
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
});

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
});
