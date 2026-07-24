/**
 * POST /api/auth/register
 *
 * 用户注册 —— Controller
 *
 * Controller 只做三件事：
 *   ① 解析 HTTP 请求
 *   ② 调 Service（业务逻辑全部交给 Service）
 *   ③ 返回 HTTP 响应
 */

import { NextRequest, NextResponse } from "next/server";
import { userService, BusinessError } from "@/database/services/user.service";
import { signToken, setTokenCookie } from "@/lib/auth/utils";

export async function POST(request: NextRequest) {
  try {
    // ① 解析 HTTP 请求
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
    }

    const { email, password, name } = body as {
      email: string;
      password: string;
      name: string;
    };

    // ② 调 Service（校验、查重、哈希密码、创建用户都在里面）
    const user = await userService.register(email, password, name);

    // ③ 签发 Token + 设置 Cookie + 返回响应
    const token = await signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.getTime(),
    });
    const cookie = setTokenCookie(token);

    const response = NextResponse.json({ user, token }, { status: 201 });
    response.headers.set("Set-Cookie", cookie);
    return response;
  } catch (err) {
    // 业务错误（密码太短、邮箱已注册）→ 返回具体错误信息
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }

    // 系统错误 → 返回通用错误信息
    const message = err instanceof Error ? err.message : "注册失败";
    console.error("[register] Error:", message);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
