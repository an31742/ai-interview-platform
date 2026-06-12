import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并 TailwindCSS 类名，处理冲突
 * shadcn/ui 的标准工具函数
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 生成类 UUID 的会话/消息 ID
 * 使用 crypto.randomUUID 或 fallback
 */
export function v4Id(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: Math.random 生成 32 位十六进制串
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * 获取当前时间戳 (毫秒)
 */
export function getCurrentTimestamp(): number {
  return Date.now();
}
