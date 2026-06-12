# 项目架构设计

## 一、整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                       客户端 (Browser)                        │
│                                                             │
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │    Chat Layout      │  │      Sidebar                  │  │
│  │  ┌───────────────┐  │  │  ┌────────────────────────┐  │  │
│  │  │ ChatMessages   │  │  │  │ ConversationList       │  │  │
│  │  │  ┌─────────┐  │  │  │  │ - 会话1               │  │  │
│  │  │  │ Message │  │  │  │  │ - 会话2               │  │  │
│  │  │  │ - Markdown│  │  │  │  │ - 会话3               │  │  │
│  │  │  │ - CodeHL │  │  │  │  └────────────────────────┘  │  │
│  │  │  └─────────┘  │  │  │  ┌────────────────────────┐  │  │
│  │  └───────────────┘  │  │  │  New Chat Button       │  │  │
│  │  ┌───────────────┐  │  │  └────────────────────────┘  │  │
│  │  │  ChatInput    │  │  └──────────────────────────────┘  │
│  │  └───────────────┘  │                                     │
│  └─────────────────────┘                                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Zustand Store                           │    │
│  │  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐  │    │
│  │  │conversa- │ │messages  │ │stream  │ │token    │  │    │
│  │  │tions     │ │          │ │state   │ │stats    │  │    │
│  │  └──────────┘ └──────────┘ └────────┘ └─────────┘  │    │
│  │              ↕ persist (localStorage)                │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │ SSE Stream (POST /api/chat)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Server                            │
│                                                             │
│  ┌──────────────────┐  ┌────────────────────────────────┐   │
│  │  POST /api/chat  │  │  DeepSeek API Proxy            │   │
│  │                  │  │  - 流式转发                    │   │
│  │  - 接收消息      │  │  - 错误处理                    │   │
│  │  - 调用DeepSeek  │  │  - 重试逻辑                    │   │
│  │  - SSE流式响应  │  └────────────────────────────────┘   │
│  └──────────────────┘                                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Edge Runtime / Node.js Runtime                      │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   DeepSeek API  │
              │  api.deepseek.com│
              └─────────────────┘
```

## 二、目录结构

```
ai-chat/
├── .env.local                        # 环境变量 (DEEPSEEK_API_KEY)
├── next.config.ts                    # Next.js 配置
├── tailwind.config.ts                # TailwindCSS 配置
├── tsconfig.json                     # TypeScript 配置
├── components.json                   # shadcn/ui 配置
├── package.json
│
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # 根布局
│   ├── page.tsx                      # / → /chat
│   ├── globals.css                   # 全局样式
│   │
│   ├── chat/                         # 聊天路由组
│   │   ├── layout.tsx                # 聊天布局
│   │   ├── page.tsx                  # /chat 空状态
│   │   └── c/
│   │       └── [id]/
│   │           └── page.tsx          # /chat/c/[id]
│   │
│   └── api/
│       └── chat/
│           └── route.ts              # POST /api/chat
│
├── components/
│   ├── ui/                           # shadcn/ui 组件
│   └── chat/                         # 聊天组件
│       ├── chat-layout.tsx
│       ├── sidebar.tsx
│       ├── chat-messages.tsx
│       ├── chat-message.tsx
│       ├── chat-input.tsx
│       ├── markdown-renderer.tsx
│       └── empty-state.tsx
│
├── hooks/
│   ├── use-chat-store.ts
│   └── use-chat-stream.ts
│
├── lib/
│   ├── utils.ts                      # cn() 工具
│   ├── constants.ts                  # 常量
│   └── deepseek.ts                   # DeepSeek 封装
│
├── store/
│   └── chat-store.ts                 # Zustand Store
│
├── types/
│   └── chat.ts                       # 类型定义
│
├── services/
│   └── storage.ts                    # 存储封装
│
└── docs/                             # 本文档目录
```

## 三、页面路由

| 路由 | 说明 |
|------|------|
| `/` | → 重定向到 /chat |
| `/chat` | 空状态欢迎页 |
| `/chat/c/[id]` | 具体会话页面，id = "new" 或 UUID |

URL 即状态：会话 ID 放在 URL 中而非纯内存，支持刷新恢复。

## 四、API 结构

**POST /api/chat**

Request:
```json
{
  "messages": [{ "role": "user", "content": "你好" }],
  "conversationId": "uuid"
}
```

Response: SSE Stream (`text/event-stream`)
```
data: {"type":"chunk","content":"你"}
data: {"type":"chunk","content":"好"}
data: {"type":"done","usage":{"promptTokens":10,"completionTokens":2,"totalTokens":12}}
data: {"type":"error","error":"错误信息"}
```

## 五、为什么选择 Zustand

| 方案 | 缺点 |
|------|------|
| Redux | 样板代码过多，不适合中小项目 |
| Context + useReducer | 流式场景下每秒更新多次，整个组件树重渲染 |
| **Zustand** | ✅ 零 Provider、精确 selector、persist 中间件、极简 API |

**精确订阅示例：**
```typescript
// ✅ 正确：只有 streamingMessage 变化才重渲染
const streamingMessage = useChatStore(s => s.streamingMessage)

// ❌ 错误：任何状态变化都重渲染
const store = useChatStore()
```

## 六、核心技术栈

| 技术 | 用途 |
|------|------|
| Next.js App Router | SSR + API Routes 一体化 |
| React 19 | Server Components + 新 Hooks |
| TypeScript | 类型安全 |
| TailwindCSS v4 | 原子化 CSS |
| shadcn/ui | 可定制的 UI 组件 |
| Zustand | 轻量状态管理 + persist |
| OpenAI SDK | 兼容 DeepSeek API |
| react-markdown | Markdown 渲染 |
| rehype-highlight | 代码高亮 |
