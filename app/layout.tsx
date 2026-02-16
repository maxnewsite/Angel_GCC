import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Angels GCC AI - Investment Decisions Powered by AI",
  description: "Angels GCC AI combines artificial intelligence with Bocconi Alumni expertise to streamline startup evaluation and investment decisions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased">{children}</body>
    </html>
  );
}
