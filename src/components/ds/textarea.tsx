import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { inputVariants } from "@/components/ds/variants";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(
        inputVariants({ size: "md" }),
        "min-h-[80px] resize-y py-2.5",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
