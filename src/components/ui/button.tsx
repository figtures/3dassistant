import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = {
  default: "btn-gradient text-white border-0",
  destructive:
    "bg-red-500/90 text-white hover:bg-red-500 shadow-sm shadow-red-500/20",
  outline:
    "border border-zinc-700/80 bg-zinc-900/50 text-zinc-200 hover:bg-zinc-800/80 hover:border-zinc-600 backdrop-blur-sm",
  secondary:
    "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 ring-1 ring-zinc-700/50",
  ghost: "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200",
  link: "text-sky-400 underline-offset-4 hover:underline hover:text-sky-300",
};

const buttonSizes = {
  default: "h-10 px-4 py-2",
  sm: "h-8 rounded-lg px-3 text-xs",
  lg: "h-11 rounded-xl px-6 text-sm",
  icon: "h-10 w-10",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:pointer-events-none disabled:opacity-40",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
