import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Quotations, invoices and receipts are uploaded through server actions (20 MB per file).
      bodySizeLimit: "45mb",
    },
  },
};

export default nextConfig;
