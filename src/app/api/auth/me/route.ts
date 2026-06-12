/**
 * GET /api/auth/me
 *
 * 获取当前登录用户信息
 * 从 Cookie 或 Authorization header 读取 Token
 *
 * Response 200: { user: User }
 * Response 401: { error: "未登录" }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  extractTokenFromCookie,
  extractTokenFromHeader,
  verifyToken,
} from "@/lib/auth/utils";
import { findUserById, toSafeUser } from "@/lib/auth/store";

export async function GET(request: NextRequest) {
  try {
    // 从 Cookie 或 Header 提取 Token
    const token =
      extractTokenFromCookie(request) ||
      extractTokenFromHeader(request);

    if (!token) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    // 验证 Token
    const payload = await verifyToken(token);
    if (!payload || !payload.sub) {
      return NextResponse.json({ error: "Token 无效或已过期" }, { status: 401 });
    }

    // 查找用户
    const user = await findUserById(payload.sub);
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 401 });
    }

    return NextResponse.json({ user: toSafeUser(user) });
  } catch {
    return NextResponse.json({ error: "认证失败" }, { status: 401 });
  }
}

/**
 * POST /api/auth/me — 登出
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.headers.set(
    "Set-Cookie",
    "token=; Path=/; Max-Age=0; SameSite=Lax"
  );
  return response;
}
