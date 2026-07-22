/**
 * UserRepository —— 用户的"数据管家"
 *
 * 这个文件只做一件事：和数据库聊天（查用户、创建用户）
 * 不做业务判断（密码对不对、邮箱重复不重复）
 *
 * 每一行代码都有注释说明"在干什么"
 */

import { prisma } from "@/database/client";

// ============================================
// 类型定义：对外暴露的用户信息（不含密码）
// ============================================

/** 返回给外面的用户信息 —— 没有密码 */
export interface SafeUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/** 创建用户时需要提供的数据 */
export interface CreateUserData {
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
}

// ============================================
// Repository —— 只管查和取
// ============================================

export const userRepository = {
  /**
   * 根据邮箱查找用户
   * 如果找到了返回用户信息（含密码），没找到返回 null
   */
  async findByEmail(email: string) {
    // Prisma 翻译：SELECT * FROM User WHERE email = 'xxx'
    return prisma.user.findUnique({
      where: { email },
    });
  },

  /**
   * 根据 ID 查找用户
   */
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  },

  /**
   * 创建用户
   * 接收创建用户需要的数据，返回创建好的用户（含密码）
   */
  async create(data: CreateUserData) {
    return prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash,
        salt: data.salt,
      },
    });
  },

  /**
   * 把用户对象转成"安全版本"（去掉密码）
   * 返回给前端时用这个
   */
  toSafeUser(user: {
    id: string;
    email: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
  }): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  },
};
