# Function Calling Agent — 架构设计

## 一、什么是 Function Calling？

### 核心概念

Function Calling（函数调用）是 LLM 的一种能力：**LLM 在生成回答时，不是直接输出文字，而是决定"我需要调用某个工具来获取信息"，然后我们替它执行这个工具，把结果送回给它，它再基于结果生成最终回答。**

```
传统 LLM 调用：
  用户 → "北京天气怎么样？"
  LLM → "抱歉，我无法获取实时天气数据。" ❌

Function Calling 流程：
  用户 → "北京天气怎么样？"
  
  第1步：LLM 分析 → "用户需要天气信息，我可以调用 get_weather 工具"
         ↓ 返回 Tool Call
  [系统] 执行 get_weather(location="北京")
         ↓ 返回 { temperature: 22, condition: "晴" }
  
  第2步：LLM 拿到结果 → "北京当前天气22°C，晴朗。"
         ↓ 返回最终回答
  用户看到带有真实数据的回答 ✅
```

### 为什么需要 Function Calling？

| 场景 | 纯 LLM | Function Calling |
|------|--------|-----------------|
| 实时天气 | ❌ 知识截止，无法获取 | ✅ 调用天气 API |
| 数据库查询 | ❌ 不知道具体数据 | ✅ 执行 SQL 查询 |
| 数学计算 | ❌ 可能算错 | ✅ 调用计算器工具 |
| 发送邮件 | ❌ 无法执行操作 | ✅ 调用邮件 API |
| 文件操作 | ❌ 不能读写文件 | ✅ 调用文件工具 |

### Function Calling 的过程

```
Step 1: LLM 决定调用
  LLM 输出特殊的 Tool Call 格式：
  {
    "function": "get_weather",
    "arguments": { "location": "北京" }
  }
  而不是普通文本。

Step 2: 系统执行工具
  检测到 Tool Call → 调用对应的函数 → 拿到结果

Step 3: LLM 生成最终回答
  将工具结果作为新的消息发给 LLM
  LLM 基于真实数据生成自然语言回答
```

---

## 二、Agent 循环（ReAct 模式）

### 流程图

```
                   用户提问
                      │
                      ▼
              ┌──────────────────┐
              │  消息历史 + 工具   │
              │  定义 → LLM       │
              └────────┬─────────┘
                       │
              ┌────────▼────────┐
              │  LLM 决定做什么  │
              └──┬────────┬─────┘
         Tool Call │        │ 普通文本回答
                  ▼        ▼
         ┌──────────────┐ ┌──────────────────┐
         │ 执行工具      │ │ 返回最终回答给用户 │
         │ 追加结果到    │ └──────────────────┘
         │ 消息历史      │
         └──────┬───────┘
                │ 继续循环
                ▼
         ┌──────────────────┐
         │  再次调用 LLM     │
         └──────────────────┘
```

---

## 三、Tool 设计

```typescript
interface Tool {
  name: string;           // 工具名
  description: string;    // 描述
  parameters: {           // 参数 Schema
    type: "object";
    properties: { ... };
    required: string[];
  };
  execute: (args: any) => Promise<any>; // 执行函数
}
```

本项目实现三个 Tool：

| Tool | 说明 | 参数 |
|------|------|------|
| `get_weather` | 查询天气 | location(城市) |
| `calculate` | 数学计算 | expression(表达式) |
| `get_time` | 获取当前时间 | timezone(时区) |

---

## 四、目录结构

```
src/
├── app/agent/                       # Agent 页面
├── components/agent/                # Agent 组件
│   ├── agent-chat.tsx
│   └── tool-call-card.tsx
├── lib/agent/
│   ├── tools/
│   │   ├── registry.ts              # 注册中心
│   │   ├── weather.ts               # 天气工具
│   │   ├── calculator.ts            # 计算器
│   │   └── time.ts                  # 时间工具
│   ├── agent-loop.ts                # Agent 循环核心
│   └── tool-definitions.ts          # Tool Schema 定义
└── app/api/agent/
    └── chat/route.ts                # Agent API
```

---

## 五、错误处理策略

| 错误类型 | 处理方式 |
|---------|---------|
| Tool 不存在 | 告诉 LLM "工具不存在"，让它重新选择 |
| Tool 执行出错 | 把错误信息发给 LLM |
| 递归深度 | 最多 3 次 Tool Call |
| Token 超限 | 截断最早的历史消息 |
