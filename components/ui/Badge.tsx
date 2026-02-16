import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "outline" | "secondary" | "destructive" | "success" | "warning";

export function Badge({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  const variants: Record<BadgeVariant, string> = {
    default: "border-transparent bg-gray-900 text-white",
    outline: "bg-transparent text-gray-700 border-gray-300",
    secondary: "border-transparent bg-gray-100 text-gray-900",
    destructive: "border-transparent bg-red-600 text-white",
    success: "border-transparent bg-green-600 text-white",
    warning: "border-transparent bg-yellow-500 text-white",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium leading-none",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
