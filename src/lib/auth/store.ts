/**
 * 用户存储（内存模式）
 *
 * V1 使用内存存储用户数据，服务重启后数据丢失。
 * V4 计划迁移到 PostgreSQL。
 *
 * 使用方式与其他 store（JD Store）一致，
 * 方便将来替换为数据库实现。
 */

import type { User, UserWithPassword } from "@/types/auth";
import { generateUserId } from "./utils";

// 内存用户存储
const users: UserWithPassword[] = [];

/**
 * 通过邮箱查找用户
 */
export function findUserByEmail(email: string): UserWithPassword | undefined {
  return users.find((u) => u.email === email.toLowerCase());
}

/**
 * 通过 ID 查找用户
 */
export function findUserById(id: string): UserWithPassword | undefined {
  return users.find((u) => u.id === id);
}

/**
 * 创建新用户
 */
export function createUser(
  email: string,
  name: string,
  passwordHash: string,
  salt: string
): User {
  const user: UserWithPassword = {
    id: generateUserId(),
    email: email.toLowerCase(),
    name,
    passwordHash,
    salt,
    createdAt: Date.now(),
  };
  users.push(user);
  return toSafeUser(user);
}

/**
 * 获取用户数量
 */
export function getUserCount(): number {
  return users.length;
}

/**
 * 移除敏感字段
 */
export function toSafeUser(user: UserWithPassword): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}
