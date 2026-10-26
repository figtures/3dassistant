import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { inputVariants } from "@/components/ds/variants";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  inputSize?: "sm" | "md";
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", inputSize = "md", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(inputVariants({ size: inputSize }), className)}
      {...props}
    />
  )
);
Input.displayName = "Input";
