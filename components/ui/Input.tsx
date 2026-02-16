"use client";
import { cn } from "@/lib/utils";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400",
        className
      )}
      {...rest}
    />
  );
}
