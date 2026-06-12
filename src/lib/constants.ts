/**
 * 应用常量配置
 */

/** DeepSeek API 基础地址 */
export const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";

/** 默认模型名称 */
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

/** API Key（仅服务端可用） */
export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";

/** 最大请求重试次数 */
export const MAX_RETRIES = 3;

/** 单次请求的最大消息数 */
export const MAX_MESSAGES = 100;

/** 单个消息的最大字符数 */
export const MAX_MESSAGE_LENGTH = 10000;

/** 系统提示词 */
export const SYSTEM_PROMPT = `你是一个智能的AI聊天助手。
请用中文回答用户的问题。
回答应当简洁、准确、有帮助。
支持 Markdown 格式输出，包括代码块、表格、列表等。`;
