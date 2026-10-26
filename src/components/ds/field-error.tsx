import { cn } from "@/lib/utils";

export type FieldErrorProps = React.HTMLAttributes<HTMLParagraphElement> & {
  id?: string;
};

export function FieldError({ className, id, children, ...props }: FieldErrorProps) {
  if (!children) return null;

  return (
    <p
      id={id}
      role="alert"
      data-slot="field-error"
      className={cn("text-xs text-destructive", className)}
      {...props}
    >
      {children}
    </p>
  );
}
