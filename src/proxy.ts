/**
 * Next.js Middleware — 路由保护
 *
 * 保护 /chat、/interview、/playground、/rag、/agent 下的路由，
 * 未登录用户重定向到 /auth/login
 *
 * 公开路由（不需要登录）：
 * - /auth/login
 * - /auth/register
 * - /api/auth/login
 * - /api/auth/register
 * - /_next/* (Next.js 内部)
 * - /favicon.ico
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** 需要登录的路由前缀 */
const PROTECTED_PATHS = ["/chat", "/interview", "/playground", "/rag", "/agent"];

/** 公开 API 路由（不需要登录） */
const PUBLIC_API_PATHS = ["/api/auth/login", "/api/auth/register"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 跳过公开路径
  if (PUBLIC_API_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 检查是否需要保护
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (!isProtected) {
    return NextResponse.next();
  }

  // 从 Cookie 检查 Token
  const token = request.cookies.get("token")?.value;
  if (!token) {
    // 如果是 API 请求，返回 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    // 页面请求，重定向到登录
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // 匹配所有需要保护的路径
    "/chat/:path*",
    "/interview/:path*",
    "/playground/:path*",
    "/rag/:path*",
    "/agent/:path*",
    "/api/interview/:path*",
  ],
};
