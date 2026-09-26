import type { Metadata } from "next";
import { BrandMark } from "@/components/ui/BrandMark";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { callbackUrl } = await searchParams;
  // Auth.js passes an absolute URL; keep only the path so the action can validate it.
  let path = "/";
  if (typeof callbackUrl === "string") {
    try {
      const u = new URL(callbackUrl, "http://local");
      path = u.pathname + u.search;
    } catch {}
  }

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="flex flex-col justify-between gap-12 bg-ink p-8 text-white">
        <div className="flex items-center gap-2.5 text-[15px] font-semibold tracking-[0.02em]">
          <BrandMark inverted />
          FPV Procurement Hub
        </div>
        <h1 className="max-w-[12ch] text-[clamp(40px,5.6vw,84px)] leading-none tracking-[-0.03em] text-balance">
          One place to know exactly where every purchase stands.
        </h1>
        <div className="hidden grid-cols-3 gap-4 border-t border-white/25 pt-3 text-[13px] md:grid">
          <span>Purchase orders, payments and production</span>
          <span>Shipments, customs and incoming stock</span>
          <span>Supplier and brand budgets</span>
        </div>
      </div>
      <div className="flex items-center p-8">
        <LoginForm callbackUrl={path} />
      </div>
    </div>
  );
}
