/**
 * 面试数据存储封装
 *
 * 提供面试平台的数据管理辅助功能：
 * - 数据导出/导入（备份）
 * - 存储统计
 * - 数据迁移
 */

const STORAGE_KEY = "ai-interview-storage";

/**
 * 导出所有面试数据
 */
export function exportInterviewData(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw || "{}";
  } catch {
    return "{}";
  }
}

/**
 * 导入面试数据
 */
export function importInterviewData(json: string): boolean {
  try {
    const data = JSON.parse(json);
    if (!data.state) return false;
    localStorage.setItem(STORAGE_KEY, json);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取存储空间使用情况
 */
export function getInterviewStorageSize(): {
  usedBytes: number;
  usedKB: string;
} {
  let total = 0;
  for (const key in localStorage) {
    if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
      total += (localStorage[key].length || 0) * 2;
    }
  }
  return {
    usedBytes: total,
    usedKB: (total / 1024).toFixed(1) + " KB",
  };
}

/**
 * 清除所有面试数据
 */
export function clearInterviewStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}
