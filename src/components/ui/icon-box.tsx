import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const toneStyles = {
  default: "bg-zinc-800/80 text-zinc-400 ring-zinc-700/50",
  primary: "bg-sky-500/10 text-sky-400 ring-sky-500/20",
  success: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  danger: "bg-red-500/10 text-red-400 ring-red-500/20",
  info: "bg-indigo-500/10 text-indigo-400 ring-indigo-500/20",
};

const sizeStyles = {
  sm: "h-8 w-8 [&_svg]:h-3.5 [&_svg]:w-3.5",
  md: "h-10 w-10 [&_svg]:h-4 [&_svg]:w-4",
  lg: "h-12 w-12 [&_svg]:h-5 [&_svg]:w-5",
  xl: "h-14 w-14 [&_svg]:h-6 [&_svg]:w-6",
};

export function IconBox({
  icon: Icon,
  tone = "default",
  size = "md",
  className,
}: {
  icon: LucideIcon;
  tone?: keyof typeof toneStyles;
  size?: keyof typeof sizeStyles;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
        toneStyles[tone],
        sizeStyles[size],
        className
      )}
    >
      <Icon strokeWidth={2} />
    </div>
  );
}

export function FeatureIcon({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800/80 ring-1 ring-zinc-700/50 transition-colors group-hover:bg-sky-500/10 group-hover:ring-sky-500/20",
        className
      )}
    >
      <Icon
        className="h-5 w-5 text-zinc-400 transition-colors group-hover:text-sky-400"
        strokeWidth={1.75}
      />
    </div>
  );
}
