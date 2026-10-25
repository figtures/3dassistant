import { forwardRef } from "react";
import { ChevronDown, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

const fieldBase =
  "flex h-10 w-full rounded-xl border border-zinc-700/80 bg-zinc-900/60 text-sm text-zinc-100 backdrop-blur-sm transition-all duration-200 placeholder:text-zinc-600 focus-visible:border-sky-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        className={cn(
          fieldBase,
          "cursor-pointer appearance-none py-2 pl-3.5 pr-10",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
        strokeWidth={2}
        aria-hidden
      />
    </div>
  )
);
Select.displayName = "Select";

export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1 block text-xs font-medium text-zinc-400",
        className
      )}
      {...props}
    >
      {children}
    </label>
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-[72px] w-full rounded-xl border border-zinc-700/80 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 backdrop-blur-sm transition-all duration-200 focus-visible:border-sky-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function DateInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <input
        type="date"
        className={cn(
          fieldBase,
          "cursor-pointer py-2 pl-3.5 pr-10 [color-scheme:dark]",
          "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0",
          className
        )}
        {...props}
      />
      <CalendarDays
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
        strokeWidth={2}
        aria-hidden
      />
    </div>
  );
}

export function ColorInput({
  className,
  value,
  onChange,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <label className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-zinc-700/80 ring-1 ring-inset ring-white/5">
        <input
          type="color"
          value={value}
          onChange={onChange}
          className="absolute inset-0 h-full w-full cursor-pointer border-0 bg-transparent p-0"
          {...props}
        />
      </label>
      <span className="font-mono text-xs uppercase tracking-wide text-zinc-500">
        {typeof value === "string" ? value : "#3b82f6"}
      </span>
    </div>
  );
}
