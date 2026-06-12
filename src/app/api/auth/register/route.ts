/**
 * POST /api/auth/register
 *
 * 用户注册
 *
 * Request:
 * {
 *   email: string
 *   password: string (min 6 chars)
 *   name: string (min 2 chars)
 * }
 *
 * Response 201:
 * { user: User, token: string }
 *
 * Response 400/409:
 * { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import type { RegisterRequest } from "@/types/auth";
import {
  generateSalt,
  hashPassword,
  signToken,
  setTokenCookie,
} from "@/lib/auth/utils";
import { findUserByEmail, createUser } from "@/lib/auth/store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
    }

    const { email, password, name } = body as RegisterRequest;

    // 校验
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "请输入邮箱" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "密码至少 6 位" },
        { status: 400 }
      );
    }
    if (!name || typeof name !== "string" || name.length < 2) {
      return NextResponse.json(
        { error: "姓名至少 2 个字符" },
        { status: 400 }
      );
    }

    // 检查邮箱是否已注册
    const existed = findUserByEmail(email);
    if (existed) {
      return NextResponse.json(
        { error: "该邮箱已注册" },
        { status: 409 }
      );
    }

    // 哈希密码
    const salt = await generateSalt();
    const passwordHash = await hashPassword(password, salt);

    // 创建用户
    const user = createUser(email, name.trim(), passwordHash, salt);

    // 签发 Token
    const token = await signToken(user);

    // 设置 Cookie
    const cookie = setTokenCookie(token);

    const response = NextResponse.json(
      { user, token },
      { status: 201 }
    );
    response.headers.set("Set-Cookie", cookie);

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "注册失败";
    console.error("[register] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
