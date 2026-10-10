import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-context";

// favicon 交给 app/icon.svg 文件约定自动生成 <link rel="icon">，
// 不用在这里手写 icons（之前指向的 /favicon.ico 并不存在，每次加载都 404）
export const metadata: Metadata = {
  title: "AI Chat",
  description: "基于 DeepSeek API 的 AI 聊天助手",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
