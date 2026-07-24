/**
 * POST /api/auth/login
 *
 * 用户登录 —— Controller
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

    const { email, password } = body as {
      email: string;
      password: string;
    };

    if (!email || !password) {
      return NextResponse.json(
        { error: "请输入邮箱和密码" },
        { status: 400 }
      );
    }

    // ② 调 Service（查用户、验密码都在里面）
    const user = await userService.login(email, password);

    // ③ 签发 Token + 设置 Cookie + 返回响应
    const token = await signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.getTime(),
    });
    const cookie = setTokenCookie(token);

    const response = NextResponse.json({ user, token });
    response.headers.set("Set-Cookie", cookie);
    return response;
  } catch (err) {
    // 业务错误（邮箱或密码错误）→ 返回具体错误信息
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }

    // 系统错误 → 返回通用错误信息
    const message = err instanceof Error ? err.message : "登录失败";
    console.error("[login] Error:", message);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
