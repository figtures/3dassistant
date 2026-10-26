import { cn } from "@/lib/utils";
import { cardSurfaceVariants } from "@/components/ds/variants";

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  surface?: 1 | 2;
};

export function Card({ className, surface = 1, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(cardSurfaceVariants({ surface }), className)}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex flex-col gap-1.5 p-[var(--density-card-p,20px)] pb-0",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      data-slot="card-title"
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-content"
      className={cn("p-[var(--density-card-p,20px)]", className)}
      {...props}
    />
  );
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center p-[var(--density-card-p,20px)] pt-0",
        className
      )}
      {...props}
    />
  );
}
