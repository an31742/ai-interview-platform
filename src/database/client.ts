/**
 * Prisma Client 全局单例
 *
 * 在 Prisma 7 中，PrismaClient 需要传入一个"适配器（adapter）"来连接数据库。
 * 我们用的是 SQLite，所以安装 @prisma/adapter-libsql 来充当这个适配器。
 */

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// 创建适配器，连接 SQLite 数据库
const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db",
});

// 全局单例
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
