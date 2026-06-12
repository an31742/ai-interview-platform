import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // pdfjs-dist 需要在原生 Node.js 环境中加载（需要 worker 和系统字体）
  // 让 Next.js 不打包它，直接作为外部模块加载
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
