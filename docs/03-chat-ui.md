# 聊天页面实现

## 一、消息结构

### 数据模型

```typescript
// types/chat.ts

/** 消息角色 */
export type MessageRole = "user" | "assistant" | "system";

/** Token 使用统计 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** 单条消息 */
export interface Message {
  id: string;
  role: MessageRole;
  content: string;       // 纯文本，不做预处理
  timestamp: number;
}

/** 会话 */
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  tokenUsage: TokenUsage;
}

/** 流式状态 */
export type StreamStatus = "idle" | "streaming" | "error";
```

### 关键设计决定

**存储纯文本，渲染时转 Markdown：**
- 存储层：`content` 存纯文本 → 结构化、可序列化、可搜索
- 渲染层：`MarkdownRenderer` 实时转为 HTML → 用户体验好
- 一条数据，两种用途

### 消息的生命周期

```
用户输入 → addMessage(user) → messages[] 新增
                              ↓
                          流开始 → streamingMessage 临时字段
                              ↓
                        逐块追加 → updateStreamingMessage(chunk)
                              ↓
                          流结束 → addMessage(assistant) → messages[] 新增
                              ↓
                        clearStreamingMessage() → 清空临时字段
```

## 二、Zustand 状态管理

### Store 设计

```typescript
const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // 数据
      conversations: Conversation[],    // 所有会话
      currentConversationId: string|null, // 当前会话
      streamStatus: StreamStatus,       // 流式状态
      streamingMessage: string,         // 流式临时内容
      error: string|null,               // 错误信息

      // Actions
      addConversation, deleteConversation, selectConversation,
      addMessage, updateStreamingMessage, clearStreamingMessage,
      setStreamStatus, updateTokenUsage, setError,
    }),
    { name: "ai-chat-storage" }
  )
);
```

### Persist 策略

```typescript
partialize: (state) => ({
  // 只持久化数据，不持久化运行状态
  conversations: state.conversations,
  currentConversationId: state.currentConversationId,
}),
// streamingMessage、streamStatus、error 每次刷新重置
```

### 精确订阅 vs 全量订阅

```typescript
// 组件级别精确订阅，避免不必要的重渲染

// ChatMessages 组件
const messages = useChatStore(s => s.currentConversation?.messages)
const streamingMessage = useChatStore(s => s.streamingMessage)

// ChatInput 组件 — 只需要知道是否在流式
const streamStatus = useChatStore(s => s.streamStatus)

// Sidebar 组件
const conversations = useChatStore(s => s.conversations)
const currentConversationId = useChatStore(s => s.currentConversationId)
```

## 三、组件拆分

```
<ChatLayout>                    flex h-dvh
  ├── <Sidebar>                 侧边栏
  │   ├── New Chat Button
  │   ├── ConversationList
  │   └── ConversationItem (×N)
  │
  ├── <ChatMessages>            消息列表 (自动滚动)
  │   ├── <EmptyState>          空状态
  │   ├── <ChatMessage> (×N)    消息气泡
  │   │   └── <MarkdownRenderer> Markdown + 代码高亮
  │   └── <ChatMessage streaming> 流式消息
  │       └── <MarkdownRenderer>
  │
  └── <ChatInput>               输入框
```

### 各组件职责

| 组件 | 类型 | 职责 |
|------|------|------|
| `Sidebar` | 客户端 | 会话列表 CRUD |
| `ChatMessages` | 客户端 | 消息列表容器 + 自动滚动 |
| `ChatMessage` | 客户端 | 消息气泡（用户/助手不同样式） |
| `MarkdownRenderer` | 客户端 | react-markdown 渲染 |
| `ChatInput` | 客户端 | 输入框 + Enter 发送 |
| `EmptyState` | 客户端 | 欢迎引导页 |

### ChatMessage 样式

- **用户消息**：右对齐、蓝色背景、用户头像
- **助手消息**：左对齐、灰色背景、Bot 头像、Markdown 渲染
- **流式消息**：助手样式 + 闪烁光标动画
- **空内容**（流式初始）：三个跳动的点（加载指示器）

### MarkdownRenderer 细节

```typescript
function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}         // GFM 支持
      rehypePlugins={[rehypeHighlight]}   // 代码高亮
      components={{
        pre: ({ children }) => <>{children}</>,
        code: CodeBlock,                  // 自定义代码块
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

**CodeBlock 组件：**
- 内联代码：灰色背景 + monospace
- 块级代码：深色背景 + 语言标签 + 复制按钮

## 四、数据流

```
用户输入 → ChatInput.handleSend()
  → store.addMessage({ role: 'user', content })
  → dispatchEvent('chat:send')  ← CustomEvent

useChatStream Hook 收到事件
  → store.setStreamStatus('streaming')
  → fetch POST /api/chat
  → 逐块解析 SSE
  → store.updateStreamingMessage(chunk)

ChatMessages 重渲染 (仅 streamingMessage 变化)
  → <ChatMessage role="assistant" content={streamingMessage} isStreaming>
    → MarkdownRenderer 实时渲染

流结束
  → store.addMessage({ role: 'assistant', content: fullContent })
  → store.clearStreamingMessage()
  → store.setStreamStatus('idle')
```

## 五、ChatInput 键盘交互

```typescript
// Enter 发送，Shift+Enter 换行
const handleKeyDown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
};
```

## 六、自动滚动

```typescript
const messagesEndRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, [messages.length, streamingMessage]);
```
