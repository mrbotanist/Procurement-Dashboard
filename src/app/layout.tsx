import type { Metadata } from "next";
import "@fontsource-variable/hanken-grotesk";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FPV Procurement Hub", template: "%s · FPV Procurement Hub" },
  description: "One place to know exactly where every purchase stands.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
