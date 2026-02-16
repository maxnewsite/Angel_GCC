// components/ui/Badge.tsx
import * as React from "react";

type BadgeVariant = "default" | "outline" | "secondary" | "destructive";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

function cx(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(" ");
}

const base =
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium leading-none";

const variants: Record<BadgeVariant, string> = {
  default: "border-transparent bg-gray-900 text-white",
  outline: "bg-transparent text-gray-700 border-gray-300",
  secondary: "border-transparent bg-gray-100 text-gray-900",
  destructive: "border-transparent bg-red-600 text-white",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cx(base, variants[variant], className)}
      {...props}
    />
  );
}
