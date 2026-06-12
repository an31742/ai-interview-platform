/**
 * Tool 注册索引
 *
 * 统一管理所有 Tool 的定义和执行。
 * 新增 Tool 只需在这里注册一行。
 */
import { weatherTool, executeWeather } from "./weather";
import { timeTool, executeTime } from "./time";

/** 所有工具定义（用于 tools/list） */
export const TOOLS = [weatherTool, timeTool];

/** 工具名 → 执行函数 映射 */
const EXECUTORS: Record<string, (args: Record<string, unknown>) => Promise<string>> = {
  get_weather: executeWeather,
  get_time: executeTime,
};

/** 按名称调用工具 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const fn = EXECUTORS[name];
  if (!fn) {
    throw new Error(`未知工具: "${name}"，可用工具: ${Object.keys(EXECUTORS).join(", ")}`);
  }
  return fn(args);
}
