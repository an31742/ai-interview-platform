/**
 * 认证工具函数
 *
 * 使用 Web Crypto API（PBKDF2）进行密码哈希，
 * jose 库进行 JWT 签发和验证。
 * 零额外 npm 依赖。
 */

import { SignJWT, jwtVerify } from "jose";
import type { User } from "@/types/auth";

// ============================================
// JWT 配置
// ============================================

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "ai-interview-platform-dev-secret-key-2026"
);

const JWT_ISSUER = "ai-interview-platform";
const JWT_AUDIENCE = "ai-interview-users";
const TOKEN_EXPIRY = "7d"; // 7 天过期

// ============================================
// 密码哈希（PBKDF2 + SHA-256）
// ============================================

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 32;
const KEY_LENGTH = 64;

/**
 * 生成随机 salt
 */
export async function generateSalt(): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  return arrayBufferToHex(salt);
}

/**
 * 使用 PBKDF2 哈希密码
 */
export async function hashPassword(
  password: string,
  salt: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_LENGTH * 8
  );

  return arrayBufferToHex(derivedBits);
}

/**
 * 验证密码
 */
export async function verifyPassword(
  password: string,
  salt: string,
  storedHash: string
): Promise<boolean> {
  const hash = await hashPassword(password, salt);
  return hash === storedHash;
}

// ============================================
// JWT 签发与验证
// ============================================

/**
 * 签发 JWT Token
 */
export async function signToken(user: User): Promise<string> {
  return new SignJWT({ sub: user.id, email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

/**
 * 验证 JWT Token，返回 payload
 */
export async function verifyToken(
  token: string
): Promise<{ sub: string; email: string; name: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return {
      sub: payload.sub || "",
      email: (payload.email as string) || "",
      name: (payload.name as string) || "",
    };
  } catch {
    return null;
  }
}

/**
 * 从 Authorization header 提取 Token
 */
export function extractTokenFromHeader(
  request: Request
): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

/**
 * 从 Cookie 提取 Token
 */
export function extractTokenFromCookie(request: Request): string | null {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/token=([^;]+)/);
  return match ? match[1] : null;
}

// ============================================
// 工具函数
// ============================================

function arrayBufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

/**
 * 生成简单用户 ID
 */
export function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 设置 Token Cookie
 */
export function setTokenCookie(token: string): string {
  return `token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`;
}

/**
 * 清除 Token Cookie
 */
export function clearTokenCookie(): string {
  return `token=; Path=/; Max-Age=0; SameSite=Lax`;
}
