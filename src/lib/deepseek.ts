import OpenAI from "openai";
import {
  DEEPSEEK_API_KEY,
  DEEPSEEK_BASE_URL,
  DEEPSEEK_MODEL,
  SYSTEM_PROMPT,
  MAX_RETRIES,
} from "./constants";
import type { Message } from "@/types/chat";

/**
 * DeepSeek 客户端实例
 *
 * 使用 OpenAI SDK 但指向 DeepSeek API 地址
 * 因为 DeepSeek API 完全兼容 OpenAI 接口规范
 */
const client = new OpenAI({
  baseURL: DEEPSEEK_BASE_URL,
  apiKey: DEEPSEEK_API_KEY,
  timeout: 60000, // 60s 超时
  maxRetries: MAX_RETRIES,
});

/**
 * 将应用内部 Message 格式转为 OpenAI SDK 格式
 */
function toOpenAIMessages(
  messages: Message[]
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  // 添加系统提示词
  result.push({
    role: "system",
    content: SYSTEM_PROMPT,
  });

  // 转换消息历史
  for (const msg of messages) {
    switch (msg.role) {
      case "user":
        result.push({ role: "user", content: msg.content });
        break;
      case "assistant":
        result.push({ role: "assistant", content: msg.content });
        break;
      case "system":
        result.push({ role: "system", content: msg.content });
        break;
    }
  }

  return result;
}

/**
 * 配置校验
 */
export function validateConfig(): string | null {
  if (!DEEPSEEK_API_KEY) {
    return "DEEPSEEK_API_KEY 未配置，请在 .env.local 文件中设置";
  }
  if (!DEEPSEEK_API_KEY.startsWith("sk-")) {
    return "DEEPSEEK_API_KEY 格式不正确，应以 sk- 开头";
  }
  return null;
}

/**
 * 创建流式聊天完成请求
 *
 * 返回一个 AsyncIterable，外部可以逐块读取
 * 如果配置无效，返回 error 字符串
 */
export async function createChatCompletionStream(
  messages: Message[]
): Promise<{
  stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> | null;
  error: string | null;
}> {
  // 校验配置
  const configError = validateConfig();
  if (configError) {
    return { stream: null, error: configError };
  }

  try {
    const openAIMessages = toOpenAIMessages(messages);

    const stream = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: openAIMessages,
      stream: true,
      temperature: 0.7,
      max_tokens: 4096,
    });

    return { stream, error: null };
  } catch (err) {
    const message = extractErrorMessage(err);
    return { stream: null, error: message };
  }
}

/**
 * 从错误对象中提取可读的错误信息
 */
function extractErrorMessage(err: unknown): string {
  if (err instanceof OpenAI.APIError) {
    // OpenAI SDK 原生错误类型
    switch (err.status) {
      case 401:
        return "API Key 认证失败，请检查 DEEPSEEK_API_KEY 是否正确";
      case 402:
        return "账户余额不足，请充值";
      case 429:
        return "请求过于频繁，请稍后再试";
      case 500:
        return "DeepSeek 服务端错误，请稍后重试";
      case 503:
        return "DeepSeek 服务暂时不可用，请稍后重试";
      default:
        return `API 错误 (${err.status}): ${err.message}`;
    }
  }

  if (err instanceof Error) {
    // 网络错误 / 超时
    if (err.message.includes("timeout") || err.message.includes("Timeout")) {
      return "请求超时，请检查网络连接或稍后重试";
    }
    if (err.message.includes("ECONNREFUSED") || err.message.includes("fetch")) {
      return `无法连接到 DeepSeek API (${DEEPSEEK_BASE_URL})，请检查网络`;
    }
    return err.message;
  }

  return "未知错误，请稍后重试";
}
