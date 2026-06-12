/**
 * POST /api/auth/login
 *
 * 用户登录
 *
 * Request:
 * { email: string, password: string }
 *
 * Response 200:
 * { user: User, token: string }
 *
 * Response 401:
 * { error: "邮箱或密码错误" }
 */

import { NextRequest, NextResponse } from "next/server";
import type { LoginRequest } from "@/types/auth";
import {
  verifyPassword,
  signToken,
  setTokenCookie,
} from "@/lib/auth/utils";
import { findUserByEmail, toSafeUser } from "@/lib/auth/store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
    }

    const { email, password } = body as LoginRequest;

    if (!email || !password) {
      return NextResponse.json(
        { error: "请输入邮箱和密码" },
        { status: 400 }
      );
    }

    // 查找用户
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: "邮箱或密码错误" },
        { status: 401 }
      );
    }

    // 验证密码
    const valid = await verifyPassword(password, user.salt, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "邮箱或密码错误" },
        { status: 401 }
      );
    }

    const safeUser = toSafeUser(user);
    const token = await signToken(safeUser);
    const cookie = setTokenCookie(token);

    const response = NextResponse.json({ user: safeUser, token });
    response.headers.set("Set-Cookie", cookie);

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "登录失败";
    console.error("[login] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
