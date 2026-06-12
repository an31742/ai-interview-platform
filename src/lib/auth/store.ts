/**
 * 用户存储（文件持久化）
 *
 * 使用 JSON 文件持久化用户数据，解决 Vercel serverless 无状态问题。
 * 数据写入 .rag-data/users.json，和服务重启无关。
 *
 * 计划 V5 迁移到 PostgreSQL。
 */

import type { User, UserWithPassword } from "@/types/auth";
import { generateUserId } from "./utils";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = process.env.VERCEL ? "/tmp/.rag-data" : path.join(process.cwd(), ".rag-data");
const DATA_FILE = path.join(DATA_DIR, "users.json");

// 内存用户缓存
let users: UserWithPassword[] = [];
let loaded = false;

/**
 * 从文件加载用户数据
 */
async function loadUsers(): Promise<void> {
  if (loaded) return;
  try {
    const data = await fs.readFile(DATA_FILE, "utf-8");
    users = JSON.parse(data);
  } catch {
    users = [];
  }
  loaded = true;
}

/**
 * 保存用户数据到文件
 */
async function saveUsers(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.warn("[auth store] 保存用户数据失败:", err);
  }
}

/**
 * 通过邮箱查找用户
 */
export async function findUserByEmail(email: string): Promise<UserWithPassword | undefined> {
  await loadUsers();
  return users.find((u) => u.email === email.toLowerCase());
}

/**
 * 通过 ID 查找用户
 */
export async function findUserById(id: string): Promise<UserWithPassword | undefined> {
  await loadUsers();
  return users.find((u) => u.id === id);
}

/**
 * 创建新用户
 */
export async function createUser(
  email: string,
  name: string,
  passwordHash: string,
  salt: string
): Promise<User> {
  await loadUsers();
  const user: UserWithPassword = {
    id: generateUserId(),
    email: email.toLowerCase(),
    name,
    passwordHash,
    salt,
    createdAt: Date.now(),
  };
  users.push(user);
  await saveUsers();
  return toSafeUser(user);
}

/**
 * 获取用户数量
 */
export async function getUserCount(): Promise<number> {
  await loadUsers();
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
