/**
 * Forge design system (ds) — v2 UI primitifleri.
 *
 * Kullanım (P1-01 ve sonrası v2 ekranlar):
 *   import { Button, Input, Card, Badge, EmptyState } from "@/components/ds";
 *
 * Kurallar:
 * - Yalnızca semantik token sınıfları (bg-surface-*, text-muted-foreground, bg-primary, …).
 * - Legacy `src/components/ui/*` dosyalarına dokunmayın; v2 doğrudan ds kullanır.
 * - Makine durumu rozetleri: `<Badge machineState="printing" />` veya `tone` ile semantik rozet.
 */

export { Button, type ButtonProps } from "@/components/ds/button";
export { Input, type InputProps } from "@/components/ds/input";
export { Textarea, type TextareaProps } from "@/components/ds/textarea";
export { Label, type LabelProps } from "@/components/ds/label";
export { FieldError, type FieldErrorProps } from "@/components/ds/field-error";
export { FormField, type FormFieldProps } from "@/components/ds/form-field";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  type CardProps,
} from "@/components/ds/card";
export { Badge, type BadgeProps, type BadgeTone } from "@/components/ds/badge";
export { Skeleton } from "@/components/ds/skeleton";
export { EmptyState, type EmptyStateProps } from "@/components/ds/empty-state";
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  type DialogContentProps,
} from "@/components/ds/dialog";
export {
  ConfirmDialog,
  type ConfirmDialogProps,
  type ConfirmDialogTone,
} from "@/components/ds/confirm-dialog";

export {
  buttonVariants,
  badgeToneVariants,
  machineStateBadgeVariants,
  MACHINE_STATE_LABELS,
} from "@/components/ds/variants";
