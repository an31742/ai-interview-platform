# Prompt Playground — 第二步：实现 Playground 基础

## 一、架构概述

Playground 采用**三栏布局**，每个面板各司其职：

```
┌─────────────────────┬─────────────────┬─────────────────────┐
│  左侧: Prompt 编辑器  │  中间: 模型配置   │  右侧: 输出面板      │
│                     │                 │                     │
│  • 类型选择 (4种)    │  • 模型选择      │  • 响应展示 (MD)    │
│  • 模板变量编辑      │  • Temperature  │  • Token 统计       │
│  • 实时预览          │  • Max Tokens   │  • 运行历史         │
│                     │  • Top P        │                     │
│                     │  • 发送按钮      │                     │
└─────────────────────┴─────────────────┴─────────────────────┘
```

---

## 二、新增文件清单

```
src/
├── app/
│   └── playground/
│       ├── layout.tsx          # 布局容器 (h-dvh flex)
│       └── page.tsx            # 三栏主页
│
├── components/playground/
│   ├── editor/
│   │   ├── prompt-editor.tsx         # 编辑器主容器
│   │   └── prompt-type-selector.tsx   # 类型选择器 (2×2 网格)
│   ├── templates/
│   │   ├── plain-template.tsx         # 普通 Prompt
│   │   ├── role-template.tsx          # 角色 Prompt
│   │   ├── few-shot-template.tsx      # Few Shot Prompt
│   │   └── cot-template.tsx          # Chain of Thought
│   ├── config/
│   │   └── model-config-panel.tsx     # 模型参数面板 + 滑块
│   └── output/
│       └── output-panel.tsx           # 输出面板 (响应+历史)
│
├── hooks/
│   └── use-playground-send.ts         # SSE 发送逻辑
│
├── store/
│   └── playground-store.ts            # Zustand 状态管理
│
└── types/
    └── playground.ts                  # 类型定义
```

---

## 三、四种 Prompt 模板详解

### 1. 普通 Prompt (`PlainTemplate`)

```
模板：{userInput}

UI 字段：一个大的 textarea
适用场景：简单问答、翻译、信息提取
```

**业务场景示例：**
```
输入：用 Python 实现一个快速排序算法
→ AI 直接给出代码
```

### 2. 角色 Prompt (`RoleTemplate`)

```
模板：
你是一名{role}。
请完成以下任务：
{task}

{additionalContext}

UI 字段：角色 (input) + 任务 (textarea) + 上下文 (textarea)
适用场景：专业咨询、客服、合同审查
```

**业务场景示例：**
```
角色：资深合同律师
任务：审查以下租赁合同，指出潜在风险点
上下文：合同来自北京，适用中国法律
→ AI 以律师身份逐条分析合同风险
```

### 3. Few Shot Prompt (`FewShotTemplate`)

```
模板：
以下是一些示例：
{examples}

现在请处理以下输入：
{fewShotInput}

UI 字段：示例 (textarea) + 输入 (textarea) + 额外指令 (textarea)
适用场景：分类、格式转换、情感分析
```

**业务场景示例：**
```
示例：
输入: 今天天气真好
情感: 正面

输入: 这部电影太无聊了
情感: 负面

输入: 这个产品非常好用
→ AI 输出: 正面
```

### 4. Chain of Thought (`CoTTemplate`)

```
模板：
问题：{question}

让我们一步一步思考：
{steps}

请逐步推理并给出最终答案。

UI 字段：问题 (textarea) + 步骤引导 (textarea) + 上下文 (textarea)
适用场景：数学题、逻辑推理、复杂决策
```

**业务场景示例：**
```
问题：一个池塘里有120条鱼。每天早上卖掉1/3，晚上又补充20条。
      3天后池塘里有多少条鱼？

步骤引导：
1. 计算第一天结束时的鱼数量
2. 计算第二天结束时的鱼数量
3. 计算第三天结束时的鱼数量
→ AI 分步计算，最后给出答案
```

---

## 四、状态管理设计

```typescript
// store/playground-store.ts

interface PlaygroundState {
  // === Prompt 编辑 ===
  promptType: PromptType;          // 当前选中的类型
  variables: PromptVariables;       // 各模板的变量值

  // === 模型配置 ===
  modelConfig: ModelConfig;         // 温度/长度/采样参数

  // === 输出 ===
  response: string;                 // AI 响应内容
  isStreaming: boolean;             // 是否正在输出
  error: string | null;             // 错误信息

  // === 历史 ===
  history: RunRecord[];             // 运行历史（最多50条）
}
```

**关键设计决定：**

1. **各模板变量独立存储** — 切换类型时不会丢失已输入的内容
2. **不持久化到 localStorage** — Playground 是临时测试工具，刷新页面重置状态
3. **历史记录保存最新 50 条** — 避免内存占用过多

---

## 五、发送流程

```
用户点击"发送测试"
  → usePlaygroundSend Hook
    → 1. 取消上一次请求（如果还在流式）
    → 2. 根据 promptType 组装完整 prompt
    → 3. setStreaming(true)
    → 4. fetch POST /api/chat
    → 5. 逐块解析 SSE
    → 6. appendResponse(chunk) ← 实时渲染
    → 7. 收到 done → setStreaming(false) + saveToHistory
    → 8. 出错 → setError(message) + setStreaming(false)
```

**复用了现有 API 路由：** `POST /api/chat` 是聊天系统已有的接口，Playground 直接调用。

---

## 六、UI 交互细节

| 交互 | 实现 |
|------|------|
| 类型切换 | 2×2 网格按钮，选中高亮 |
| 参数调节 | 自定义滑块组件，实时显示数值和标签 |
| 响应渲染 | 复用 `MarkdownRenderer` 组件 |
| 流式状态 | 发送按钮显示旋转动画 + "输出中..." |
| 错误提示 | 红色 alert 条，可关闭 |
| 历史记录 | 按时间倒序，显示类型/耗时/Token数/内容预览 |

---

## 七、路由

| 路由 | 说明 |
|------|------|
| `/playground` | Playground 三栏主页面 |

与聊天页面 `/chat` 并列，共享后端 API。
