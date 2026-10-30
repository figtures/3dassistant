import { cn } from "@/lib/utils";
import { Layers } from "lucide-react";

export function Logo({
  size = "md",
  showText = true,
  className,
}: {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}) {
  const sizes = {
    sm: { box: "h-7 w-7", icon: "h-3.5 w-3.5", text: "text-sm" },
    md: { box: "h-9 w-9", icon: "h-4 w-4", text: "text-base" },
    lg: { box: "h-11 w-11", icon: "h-5 w-5", text: "text-lg" },
  };
  const s = sizes[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/20 ring-1 ring-white/10",
          s.box
        )}
      >
        <Layers className={cn("text-white", s.icon)} strokeWidth={2.25} />
      </div>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={cn("font-semibold tracking-tight text-zinc-100", s.text)}>
            3D Assistant
          </span>
          {size !== "sm" && (
            <span className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-zinc-500">
              3D atölye ERP
            </span>
          )}
        </div>
      )}
    </div>
  );
}
