# DeepSeek 接口调用

## 一、架构原理

```
ChatInput → useChatStream Hook → API Route (Server) → DeepSeek API
                                      ↓
                                Node.js Runtime
                                      ↓
                             OpenAI SDK (stream: true)
                                      ↓
                             ReadableStream → SSE Response
```

### 为什么用 OpenAI SDK 调 DeepSeek？

DeepSeek API **完全兼容 OpenAI 的接口规范**，所以可以直接用 `openai` SDK，只需改两行配置：

```typescript
const client = new OpenAI({
  baseURL: "https://api.deepseek.com/v1",  // 指向 DeepSeek
  apiKey: process.env.DEEPSEEK_API_KEY,    // DeepSeek Key
});
```

这意味着我们可以直接使用 OpenAI SDK 的全部特性（streaming、类型提示、错误处理），但实际调用的是 DeepSeek 的 `deepseek-chat` 模型。

## 二、三层设计

### 第1层：常量配置 (`lib/constants.ts`)

```typescript
export const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
export const MAX_MESSAGES = 100;           // 单次请求最大消息数
export const MAX_MESSAGE_LENGTH = 10000;   // 单条消息最大字符
export const SYSTEM_PROMPT = `你是一个智能的AI聊天助手...`;
```

作用：集中管理所有配置，避免散落在各处。

### 第2层：API 客户端封装 (`lib/deepseek.ts`)

| 函数 | 职责 |
|------|------|
| `validateConfig()` | 校验 API Key 是否存在且格式正确 |
| `createChatCompletionStream(messages)` | 发起流式请求，返回 AsyncIterable |
| `toOpenAIMessages(messages)` | 内部 Message → OpenAI 格式 + 注入 system prompt |
| `extractErrorMessage(err)` | 错误转可读中文消息 |

**消息格式转换：**
```typescript
// 内部格式
{ role: "user", content: "你好", id: "xxx", timestamp: 123456 }

// OpenAI SDK 格式
{ role: "user", content: "你好" }  // 不含 id/timestamp

// 注入 system prompt
[
  { role: "system", content: "你是一个智能的AI聊天助手..." },
  { role: "user", content: "你好" },
  { role: "assistant", content: "你好！有什么可以帮助你的？" },
  { role: "user", content: "帮我写代码" },
]
```

**错误处理映射：**
```typescript
401 → "API Key 认证失败，请检查 DEEPSEEK_API_KEY 是否正确"
402 → "账户余额不足，请充值"
429 → "请求过于频繁，请稍后再试"
500 → "DeepSeek 服务端错误"
503 → "DeepSeek 服务暂时不可用"
timeout → "请求超时，请检查网络连接"
ECONNREFUSED → "无法连接到 DeepSeek API"
```

### 第3层：API 路由 (`app/api/chat/route.ts`)

**请求处理流程：**

```
请求到达 POST /api/chat
  ↓
解析 JSON body
  ↓
校验 messages 格式（数组、非空、≤100条）
  ↓
校验每条消息（role 合法、content 为字符串、≤10000字符）
  ↓
校验最后一条是 user
  ↓
调用 createChatCompletionStream()
  ↓
成功 → 构建 ReadableStream → SSE 响应
失败 → 返回 JSON 错误响应
```

## 三、安全设计

| 措施 | 实现 |
|------|------|
| API Key 不暴露到客户端 | 仅在服务端读取 `process.env`，客户端不引用 `deepseek.ts` |
| 请求校验 | 验证格式、长度、角色，防止恶意请求 |
| 错误信息脱敏 | 不返回原始 stack trace，映射为用户友好提示 |
| 超时控制 | OpenAI SDK 设置 `timeout: 60000` |
| 重试机制 | `maxRetries: 3` |

## 四、请求校验细节

```typescript
// 长度限制
messages.length > MAX_MESSAGES (100)     → 400
msg.content.length > MAX_MESSAGE_LENGTH (10000) → 400

// 角色校验
validRoles = ["user", "assistant", "system"]

// 最后一条必须是用户消息
lastMsg.role !== "user" → 400
```

## 五、环境变量配置

```bash
# .env.local
DEEPSEEK_API_KEY=sk-xxx...                # 必填
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1  # 可选，默认值
DEEPSEEK_MODEL=deepseek-chat              # 可选，默认值
```
