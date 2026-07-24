/**
 * GET /api/auth/me
 *
 * 获取当前登录用户信息 —— Controller
 * 从 Cookie 或 Authorization header 读取 Token
 *
 * Controller 只做三件事：
 *   ① 解析 HTTP 请求（提取 Token）
 *   ② 调 Service（查用户信息）
 *   ③ 返回 HTTP 响应
 */

import { NextRequest, NextResponse } from "next/server";
import {
  extractTokenFromCookie,
  extractTokenFromHeader,
  verifyToken,
} from "@/lib/auth/utils";
import { userService } from "@/database/services/user.service";

export async function GET(request: NextRequest) {
  try {
    // ① 从 Cookie 或 Header 提取 Token
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

    // ② 调 Service 查用户（走数据库，不走 JSON 文件）
    const user = await userService.getProfile(payload.sub);
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 401 });
    }

    // ③ 返回响应（getProfile 已自动去掉密码）
    return NextResponse.json({ user });
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
