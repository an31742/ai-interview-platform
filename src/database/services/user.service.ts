/**
 * UserService —— 用户的"业务管家"
 *
 * 这个文件负责：检查业务规则 + 协调 Repository
 * 不处理 HTTP 请求（那是 Controller 的事）
 * 不直接查数据库（那是 Repository 的事）
 */

import { userRepository } from "@/database/repositories/user.repository";
import { generateSalt, hashPassword, verifyPassword } from "@/lib/auth/utils";
import type { SafeUser } from "@/database/repositories/user.repository";

// ============================================
// 自定义错误类型
// ============================================

/** 业务错误 —— 不是系统崩溃，是业务规则不允许 */
export class BusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessError";
  }
}

// ============================================
// Service —— 专门管业务规则
// ============================================

export const userService = {
  /**
   * 用户注册
   *
   * 步骤：
   * ① 检查密码长度（业务规则）
   * ② 查邮箱是否已注册（调 Repository）
   * ③ 如果已注册 → 抛 BusinessError
   * ④ 如果没注册 → 哈希密码 → 创建用户 → 返回安全用户信息
   */
  async register(
    email: string,
    password: string,
    name: string
  ): Promise<SafeUser> {
    // ① 检查密码长度（业务规则）
    if (!password || password.length < 6) {
      throw new BusinessError("密码至少 6 位");
    }

    // ② 检查邮箱是否已注册（调 Repository 查数据库）
    const existed = await userRepository.findByEmail(email);
    if (existed) {
      throw new BusinessError("该邮箱已注册");
    }

    // ③ 哈希密码（业务处理）
    const salt = await generateSalt();
    const passwordHash = await hashPassword(password, salt);

    // ④ 创建用户（调 Repository 写数据库）
    const user = await userRepository.create({
      email: email.toLowerCase().trim(),
      name: name.trim(),
      passwordHash,
      salt,
    });

    // ⑤ 返回安全版本（不含密码）
    return userRepository.toSafeUser(user);
  },

  /**
   * 用户登录
   *
   * 步骤：
   * ① 查邮箱是否存在（调 Repository）
   * ② 验证密码是否正确（业务规则）
   * ③ 返回安全用户信息
   */
  async login(email: string, password: string): Promise<SafeUser> {
    // ① 查用户
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new BusinessError("邮箱或密码错误");
    }

    // ② 验证密码
    const valid = await verifyPassword(password, user.salt, user.passwordHash);
    if (!valid) {
      throw new BusinessError("邮箱或密码错误");
    }

    // ③ 返回安全版本
    return userRepository.toSafeUser(user);
  },

  /**
   * 获取用户信息
   */
  async getProfile(userId: string): Promise<SafeUser | null> {
    const user = await userRepository.findById(userId);
    if (!user) return null;
    return userRepository.toSafeUser(user);
  },
};
