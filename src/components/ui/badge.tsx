import { cn } from "@/lib/utils";

const variants = {
  default: "bg-zinc-800 text-zinc-300 ring-zinc-700",
  primary: "bg-sky-500/15 text-sky-400 ring-sky-500/20",
  success: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/20",
  warning: "bg-amber-500/15 text-amber-400 ring-amber-500/20",
  danger: "bg-red-500/15 text-red-400 ring-red-500/20",
  purple: "bg-violet-500/15 text-violet-400 ring-violet-500/20",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
