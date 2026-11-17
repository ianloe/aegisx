import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "danger" | "info" | "outline";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-blue-300",
  secondary: "bg-surface-muted text-muted-foreground border-border",
  success: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  warning: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  danger: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
  info: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
  outline: "bg-transparent text-foreground border-border",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  );
}
