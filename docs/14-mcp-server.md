# MCP Server 开发 — 原理与架构

## 一、什么是 MCP？

### 核心概念

MCP（Model Context Protocol，模型上下文协议）是 Anthropic 提出的**开放标准协议**，用于让 AI 应用（客户端）与外部工具和数据源（服务器）进行标准化通信。

```
┌─────────────────────────────────────────────────────┐
│                  MCP 架构总览                         │
│                                                     │
│  ┌─────────────┐          ┌─────────────────────┐   │
│  │ AI 应用      │   MCP    │  MCP Server          │   │
│  │ (Client)     │◄────────►│  (工具/数据提供方)   │   │
│  │              │ 协议     │                      │   │
│  │ Claude Code  │          │  天气工具            │   │
│  │ 自定义 Agent │          │  时间工具            │   │
│  │ 聊天应用     │          │  数据库查询          │   │
│  └─────────────┘          └─────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**类比理解：**

| 概念 | 类比 | 说明 |
|------|------|------|
| MCP | USB 协议 | 统一标准，设备即插即用 |
| MCP Client | 电脑 | 需要获取外部能力 |
| MCP Server | U 盘/键盘 | 提供特定功能 |
| Tool | 键盘按键 | 具体可调用的功能 |
| Transport | USB 线 | 数据传输通道（stdio/SSE） |

---

## 二、为什么需要 MCP？

### 对比：没有 MCP 的时代

```
没有 MCP：
  App A 要接入天气 → 自己写天气 API 封装
  App B 要接入天气 → 重新写天气 API 封装
  App C 要接入天气 → 再写一遍
  → 每个应用自己定义工具格式，无法复用

有 MCP：
  天气团队写一个 MCP Server  →  任何 MCP Client 都可以直接使用
  时间团队写一个 MCP Server  →  任何 MCP Client 都可以直接使用
  → 一次开发，到处复用
```

### MCP 解决的核心问题

| 问题 | 传统方式 | MCP 方式 |
|------|---------|---------|
| 工具格式 | 每个应用自己定义 | 统一协议标准 |
| 工具发现 | 硬编码在代码中 | Client 自动发现 Server 的能力 |
| 复用性 | 每个项目重写 | 一个 Server 任意 Client 使用 |
| 传输层 | 自行实现 | 标准化（stdio/SSE） |
| 生命周期 | 自行管理 | 协议定义初始化-运行-关闭 |

---

## 三、MCP Client vs MCP Server

### MCP Client

MCP Client 是**发起连接的一方**，通常是 AI 应用：

- **Claude Code** — 内置 MCP Client，直接连接 MCP Server
- **自定义 Agent** — 使用 `@modelcontextprotocol/sdk` 构建 Client
- **聊天应用** — 集成 MCP Client 来调用工具

Client 的职责：
```
1. 启动/连接 MCP Server
2. 获取 Server 的能力列表（list_tools）
3. 当 AI 决定调用工具时，通过 Client 发起 call_tool 请求
4. 将结果返回给 AI
5. 管理 Server 生命周期（启动、关闭）
```

### MCP Server

MCP Server 是**提供能力的一方**，通常是工具/数据提供方：

Server 的职责：
```
1. 注册工具（Tool）
2. 暴露能力列表（哪些工具可用、参数是什么）
3. 接收 call_tool 请求并执行
4. 返回执行结果
5. 通过传输层（stdio/SSE）通信
```

---

## 四、Tool 注册机制

MCP 的 Tool 注册遵循**声明式设计**：

```typescript
// 1. 定义工具 Schema（JSON Schema 格式）
const weatherTool = {
  name: "get_weather",
  description: "查询指定城市的天气",
  inputSchema: {
    type: "object",
    properties: {
      location: { type: "string", description: "城市名称" },
    },
    required: ["location"],
  },
};

// 2. 注册到 Server
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [weatherTool, timeTool],
}));

// 3. 处理调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "get_weather") {
    const result = await getWeather(request.params.arguments);
    return { content: [{ type: "text", text: result }] };
  }
});
```

**关键流程：**

```
Client                                    Server
  │                                         │
  │───── initialize (协议版本协商) ──────────→│
  │←─── initialized ────────────────────────│
  │                                         │
  │───── tools/list (获取工具列表) ──────────→│
  │←─── [weatherTool, timeTool] ────────────│
  │                                         │
  │───── tools/call (调用具体工具) ──────────→│
  │←─── { content: [结果] } ────────────────│
```

---

## 五、MCP vs Function Calling

| 维度 | Function Calling | MCP |
|------|-----------------|-----|
| **本质** | LLM API 的一个参数 | 独立的协议层 |
| **通信方式** | HTTP 请求体内传 JSON | 独立的传输层（stdio/SSE） |
| **工具定义** | OpenAI 格式 `tools` 参数 | MCP 标准 JSON-RPC 格式 |
| **谁定义工具** | 开发者写在 API 调用代码中 | 开发者写在 MCP Server 中 |
| **工具发现** | 开发者手动传入 | Client 自动发现（list_tools） |
| **复用性** | 每个项目复制粘贴代码 | 安装 MCP Server 即用 |
| **生命周期** | 每次 API 调用独立 | 独立的进程生命周期 |
| **适用场景** | 单应用内简单工具调用 | 多应用共享、复杂工具集成 |
| **生态** | 各厂商各自为政 | 统一标准，生态共享 |

### 对比示例

**Function Calling 方式：**
```typescript
// 每次调用都要在代码中定义工具
const response = await openai.chat.completions.create({
  model: "deepseek-chat",
  messages: [...],
  tools: [{                           // ← 工具定义写在请求里
    type: "function",
    function: {
      name: "get_weather",
      parameters: { ... },
    },
  }],
});
```

**MCP 方式：**
```typescript
// 工具在 Server 中定义，Client 自动发现
const client = new Client({ name: "my-app", version: "1.0.0" });
await client.connect(transport);

const tools = await client.listTools();  // ← 自动获取工具列表
const result = await client.callTool({   // ← 调用工具
  name: "get_weather",
  arguments: { location: "北京" },
});
```

---

## 六、本项目 MCP Server 架构

```
┌────────────────────────────────────────────────┐
│              MCP Server (本项目)                  │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │         @modelcontextprotocol/sdk        │   │
│  │   (StdioServerTransport / 请求处理)      │   │
│  └──────────────┬───────────────────────────┘   │
│                 │                                │
│        ┌────────┴────────┐                      │
│        │   Tool 注册表    │                      │
│        └──┬──────────┬───┘                      │
│           ▼          ▼                           │
│  ┌────────────┐ ┌──────────┐                    │
│  │ get_weather│ │ get_time │                    │
│  │  工具      │ │  工具    │                    │
│  └────────────┘ └──────────┘                    │
└────────────────────────────────────────────────┘
          │               传输层 (stdio)
          ▼
┌────────────────────────────────────────────────┐
│              MCP Client (测试/集成)              │
│                                                  │
│  方式1: CLI 测试 (直接连接 Server)               │
│  方式2: 集成到聊天页面 (通过 API)                │
└────────────────────────────────────────────────┘
```

---

## 七、目录结构

```
src/
└── mcp/
    ├── server.ts              # MCP Server 入口
    ├── tools/
    │   ├── index.ts           # Tool 注册
    │   ├── weather.ts         # 天气工具
    │   └── time.ts            # 时间工具
    └── client.ts              # 测试用 Client

mcp-server.json                # MCP Server 配置文件
```

---

## 八、面试常见问题

### Q1: MCP 和 API Gateway 的区别？
MCP 是**协议层**，定义的是 Client 和 Server 之间如何通信。API Gateway 是**架构模式**，用于路由、限流、鉴权。MCP 可以跑在 API Gateway 后面。

### Q2: MCP Server 如何保证安全？
- Tool 调用权限由 Server 控制
- 传输层可以叠加认证（API Key、JWT）
- Stdio 传输天然隔离（不暴露网络端口）
- 每个 Tool 可以独立做参数校验和权限检查

### Q3: 什么时候用 Function Calling，什么时候用 MCP？
- **Function Calling**：单个应用内，工具少且固定，不需要复用
- **MCP**：工具需要跨应用共享，或者工具由不同团队维护

### Q4: MCP 支持流式输出吗？
MCP 协议支持 `streamable` 的 Tool 调用，但目前主流实现还是 request-response 模式。SSE 传输可以实现服务器推送。

### Q5: MCP Server 如何部署？
- **Stdio 传输**：作为子进程启动，适合 Claude Code 等桌面应用
- **SSE 传输**：作为 HTTP 服务部署，适合 Web 应用
