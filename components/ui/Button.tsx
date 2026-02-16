"use client";
import { cn } from "@/lib/utils";

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary"|"secondary"|"ghost"|"destructive" }) {
  const { className, variant = "primary", ...rest } = props;
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none hover:scale-105 active:scale-100";
  const variants: Record<string,string> = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl",
    secondary: "bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 shadow-md",
    ghost: "text-blue-700 hover:bg-blue-50 shadow-none",
    destructive: "bg-red-600 text-white hover:bg-red-700 shadow-lg",
  };
  return <button className={cn(base, variants[variant], className)} {...rest} />;
}
