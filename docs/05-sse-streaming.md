# SSE 流式输出原理与实现

## 一、什么是 SSE？

SSE（Server-Sent Events）是一种服务端向客户端推送数据的技术。与 WebSocket 的对比：

| 特性 | SSE | WebSocket |
|------|-----|-----------|
| 方向 | 服务器→客户端 **单向** | 双向 |
| 协议 | HTTP 原生支持 | 需要升级协议（ws://） |
| 传输格式 | 纯文本（`data: ...\n\n`） | 二进制帧 |
| 自动重连 | ✅ 浏览器内置 | ❌ 需手动 |
| 适用场景 | **流式文本输出** | 实时游戏、协作编辑 |

### SSE 核心格式

每条消息以 `data:` 开头，以两个换行 `\n\n` 结束：

```
data: {"type":"chunk","content":"你好"}\n\n
data: {"type":"chunk","content":"，世界"}\n\n
data: {"type":"done","usage":{"promptTokens":10,"completionTokens":2,"totalTokens":12}}\n\n
```

## 二、三个关键技术概念

### 1. ReadableStream — 流式数据源

`ReadableStream` 是 Web 标准 API，代表一个可被逐块读取的数据源。

```
[数据源] ──→ [ReadableStream] ──→ [消费者逐块读取]

         chunk1 → chunk2 → chunk3 → ... → done
```

**核心方法：**

```typescript
const stream = new ReadableStream({
  async start(controller) {
    // controller.enqueue(data)  — 推入一块数据
    // controller.close()        — 关闭流（发送完毕）
  },
});

// 消费者通过 getReader() 读取
const reader = response.body.getReader();
const { done, value } = await reader.read();
```

**在本项目中的使用（服务端 API Route）：**

```typescript
const readableStream = new ReadableStream({
  async start(controller) {
    for await (const chunk of deepseekStream) {
      const content = chunk.choices?.[0]?.delta?.content || "";
      if (content) {
        const sseData = JSON.stringify({ type: "chunk", content });
        // 编码为 Uint8Array 并推入流
        controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
      }
    }
    // 发送完成事件
    const doneData = JSON.stringify({
      type: "done",
      usage: { promptTokens: 10, completionTokens: 2, totalTokens: 12 },
    });
    controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
    controller.close();
  },
});

// 返回流式 HTTP 响应
return new Response(readableStream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",  // 禁用 nginx 缓冲
  },
});
```

### 2. TextDecoder — 二进制到字符串

`TextDecoder` 将二进制数据（`Uint8Array`）解码为字符串。

```typescript
const decoder = new TextDecoder();
const text = decoder.decode(value, { stream: true });
```

**为什么需要 `{ stream: true }`？**

一个中文字符 UTF-8 编码占 3 个字节。如果这个字符恰好在两个网络包边界被切开：

```
chunk1: \xe4\xbd        ← 不完整的 UTF-8 序列
chunk2: \xa0\xe5\xa5\xbd ← 剩余部分
```

- `{ stream: true }`：保留不完整的字节序列，等下一个 chunk 到达后合并解码
- 不加：解码失败，出现乱码

### 3. 缓冲区设计 — 处理消息边界

收到的网络数据可能是不完整的行，需要缓冲区来拼接：

```typescript
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  // 解码当前块并追加到缓冲区
  buffer += decoder.decode(value, { stream: true });

  // 按换行分割
  const lines = buffer.split("\n");
  buffer = lines.pop() || "";  // 保留未完成行到下一次

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const data = JSON.parse(line.slice(6));
      // 处理 data
    }
  }
}
```

**缓冲区解决什么问题？**

```
网络可能这样分包：
  第1次 read: "data: {"type":"chunk","content":"你好"
  第2次 read: "世界"}\n\ndata: {"type":"chunk","conte"
  第3次 read: "nt":"世界"}\n\n"

buffer 处理流程：
  read1 → buffer = "data: {...}" → 不完整，无换行 → 暂存
  read2 → buffer += "世界}\n\ndata: {"type":"chunk","conte"
         → split("\n") → 解析第一条 → 新 buffer = "data: {"type":"chunk","conte"
  read3 → buffer += "nt":"世界"}\n\n"
         → split("\n") → 解析第二条 → buffer = ""
```

## 三、完整数据流

```
                    服务端 (Next.js API Route)
                    ┌──────────────────────────┐
DeepSeek API stream  │  for await (chunk of      │
     │               │    deepseekStream) {      │
     ▼               │    controller.enqueue(    │
  chunk 1 ──────────→│      `data: ${sse}\n\n`   │
  chunk 2 ──────────→│    }                      │
  chunk 3 ──────────→│    controller.close()     │
     ...             └──────────┬───────────────┘
                                │ HTTP Response
                                │ (ReadableStream)
                                ▼
                    客户端 (Browser)
                    ┌──────────────────────────┐
                    │  fetch POST /api/chat     │
                    │  reader = response.body   │
                    │    .getReader()           │
                    │                           │
                    │  while (true) {           │
                    │    read()                 │
                    │    decode()               │
                    │    parse()                │
                    │    updateStreamingMessage │
                    │  }                        │
                    └──────────────────────────┘
                                │
                                ▼
                    Zustand Store
                    ┌──────────────────────────┐
                    │  streamingMessage += chunk│
                    │  → 触发精确订阅           │
                    └──────────────────────────┘
                                │
                                ▼
                    React 组件重渲染
                    ┌──────────────────────────┐
                    │  ChatMessages 检测到       │
                    │  streamingMessage 变化     │
                    │                           │
                    │  <ChatMessage              │
                    │    role="assistant"        │
                    │    content={streamingMsg}  │
                    │    isStreaming             │
                    │  >                         │
                    │    <MarkdownRenderer       │
                    │      content={...}         │
                    │    />                      │
                    │  </ChatMessage>            │
                    └──────────────────────────┘
```

## 四、关键代码

### 服务端 — SSE 构建（`app/api/chat/route.ts`）

```typescript
export async function POST(request: Request) {
  // 1. 校验请求
  const { messages } = await request.json();

  // 2. 调用 DeepSeek
  const { stream, error } = await createChatCompletionStream(messages);

  // 3. 构建 ReadableStream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of deepseekStream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "chunk", content })}\n\n`)
          );
        }
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", usage })}\n\n`));
      controller.close();
    },
  });

  // 4. 返回 SSE 响应
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
```

### 客户端 — SSE 解析（`hooks/use-chat-stream.ts`）

```typescript
const response = await fetch("/api/chat", {
  method: "POST",
  body: JSON.stringify({ messages }),
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop() || "";

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const data = JSON.parse(line.slice(6));

      if (data.type === "chunk") {
        useChatStore.getState().updateStreamingMessage(data.content);
      } else if (data.type === "done") {
        const fullContent = useChatStore.getState().streamingMessage;
        useChatStore.getState().addMessage({
          role: "assistant",
          content: fullContent,
        });
        useChatStore.getState().clearStreamingMessage();
        useChatStore.getState().setStreamStatus("idle");
      } else if (data.type === "error") {
        useChatStore.getState().setError(data.error);
        useChatStore.getState().setStreamStatus("error");
      }
    }
  }
}
```

## 五、四个关键优化点

### 1. 缓冲区处理跨 chunk 边界
```typescript
const lines = buffer.split("\n");
buffer = lines.pop() || ""; // 关键：保留未完成行
```

### 2. 流式解码防止乱码
```typescript
decoder.decode(value, { stream: true });
```

### 3. 精确的 React 重渲染
```typescript
const streamingMessage = useChatStore(s => s.streamingMessage);
// 只有 streamingMessage 变化时 ChatMessages 才重渲染
```

### 4. 错误恢复（兜底逻辑）
```typescript
// 流中途意外结束但没收到 done 事件
const currentStatus = useChatStore.getState().streamStatus;
if (currentStatus === "streaming") {
  const fullContent = useChatStore.getState().streamingMessage;
  if (fullContent) {
    store.addMessage({ role: "assistant", content: fullContent });
  }
  store.clearStreamingMessage();
  store.setStreamStatus("idle");
}
```

## 六、时序图

```
用户                  ChatInput     Zustand Store     useChatStream     API Route        DeepSeek API
 │                      │               │                  │                │                 │
 │  按下 Enter          │               │                  │                │                 │
 │─────────────────────→│               │                  │                │                 │
 │                      │ addMessage    │                  │                │                 │
 │                      │──────────────→│                  │                │                 │
 │                      │               │ dispatchEvent    │                │                 │
 │                      │               │─────────────────→│                │                 │
 │                      │               │                  │ setStreaming   │                 │
 │                      │               │←─────────────────│                │                 │
 │                      │               │   fetch POST     │                │                 │
 │                      │               │─────────────────────────────────→│                 │
 │                      │               │                  │                │ createStream    │
 │                      │               │                  │                │────────────────→│
 │                      │               │                  │                │←─── chunk 1 ────│
 │                      │               │                  │  SSE chunk 1   │                 │
 │                      │               │←─────────────────────────────────│                 │
 │                      │ updateMsg     │                  │                │                 │
 │                      │←──────────────│                  │                │                 │
 │  页面实时渲染         │               │                  │                │                 │
 │                      │               │                  │  SSE chunk 2   │                 │
 │                      │               │←─────────────────────────────────│                 │
 │                      │               │                  │                │←─── chunk 2 ────│
 │                      │               │    ... 循环 ...  │                │                 │
 │                      │               │                  │  SSE done      │                 │
 │                      │               │←─────────────────────────────────│                 │
 │                      │               │                  │                │                 │
 │                      │  addMessage   │                  │                │                 │
 │                      │←──────────────│                  │                │                 │
 │                      │  clearStream  │                  │                │                 │
 │                      │←──────────────│                  │                │                 │
 │                      │  setStatus    │                  │                │                 │
 │                      │←──────────────│                  │                │                 │
 │                      │               │                  │                │                 │
 │ 可继续输入           │               │                  │                │                 │
 │←─────────────────────│               │                  │                │                 │
```

**核心思想：** 每次收到 chunk 只更新 `streamingMessage`（临时字段），流结束后转为完整的 `Message` 存入 `messages[]`（持久化字段）。整个过程用户无感知，UI 持续更新。
