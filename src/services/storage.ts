/**
 * 本地存储封装
 *
 * 提供类型安全的 localStorage 读写 + 版本控制
 *
 * 当前存储方式：Zustand persist 中间件自动管理
 * 此文件提供以下辅助功能：
 * - 存储版本管理（用于未来的数据迁移）
 * - 存储空间统计
 * - 清理/导出工具
 */

const STORAGE_VERSION = 1;
const STORAGE_KEY = "ai-chat-storage";

/** 存储数据结构（Zustand persist 的包装） */
interface StorageData {
  state: {
    conversations: import("@/types/chat").Conversation[];
    currentConversationId: string | null;
  };
  version: number;
}

/**
 * 获取存储版本号
 * 用于在升级时做数据迁移
 */
export function getStorageVersion(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const data = JSON.parse(raw) as StorageData;
    return data.version ?? 0;
  } catch {
    return 0;
  }
}

/**
 * 获取会话数量统计
 */
export function getConversationCount(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const data = JSON.parse(raw) as StorageData;
    return data.state?.conversations?.length ?? 0;
  } catch {
    return 0;
  }
}

/**
 * 导出所有数据为 JSON 字符串
 * 可用于备份
 */
export function exportData(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw || "{}";
  } catch {
    return "{}";
  }
}

/**
 * 从 JSON 字符串导入数据
 * 可用于恢复备份
 */
export function importData(json: string): boolean {
  try {
    const data = JSON.parse(json) as StorageData;
    if (!data.state?.conversations) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取存储空间使用情况
 */
export function getStorageSize(): { usedBytes: number; usedKB: string } {
  let total = 0;
  for (const key in localStorage) {
    if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
      total += (localStorage[key].length || 0) * 2; // UTF-16
    }
  }
  return {
    usedBytes: total,
    usedKB: (total / 1024).toFixed(1) + " KB",
  };
}

/**
 * 清理所有聊天存储数据
 */
export function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}
