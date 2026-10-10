/**
 * Next.js Proxy（Next 16 起 Middleware 改名叫 Proxy）— 路由保护
 *
 * 保护 /chat、/interview、/playground、/rag、/agent 下的路由，
 * 未登录用户重定向到 /auth/login
 *
 * 这里只做「乐观检查」：验签 JWT，确认 Token 是本服务签发的、还没过期。
 * 用户是否真的还在数据库里，由 /api/auth/me 和各业务 API 自己确认
 * （Proxy 跑在 Edge Runtime，连不了 Prisma/SQLite）。
 *
 * 公开路由（不需要登录）：
 * - /auth/login
 * - /auth/register
 * - /api/auth/login
 * - /api/auth/register
 * - /_next/* (Next.js 内部)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth/utils";

/** 需要登录的路由前缀 */
const PROTECTED_PATHS = ["/chat", "/interview", "/playground", "/rag", "/agent"];

/** 公开 API 路由（不需要登录） */
const PUBLIC_API_PATHS = ["/api/auth/login", "/api/auth/register"];

export async function proxy(request: NextRequest) {
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

  // 从 Cookie 读 Token 并验签
  // 只判断「有没有 Cookie」是不够的：过期或伪造的 Token 也会带着 Cookie 过来
  const token = request.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;

  if (!payload?.sub) {
    // 如果是 API 请求，返回 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    // 页面请求，重定向到登录
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);
    // 307 默认可能被浏览器/代理启发式缓存：
    // 缓存后即使登录成功，再访问 /chat 也会被直接弹回登录页
    response.headers.set("Cache-Control", "no-store, must-revalidate");
    return response;
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
