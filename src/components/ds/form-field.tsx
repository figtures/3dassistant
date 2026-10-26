"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ds/label";
import { FieldError } from "@/components/ds/field-error";

export type FormFieldProps = {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (fieldProps: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }) => React.ReactNode;
};

export function FormField({
  label,
  description,
  error,
  required,
  className,
  children,
}: FormFieldProps) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div data-slot="form-field" className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {description ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}
