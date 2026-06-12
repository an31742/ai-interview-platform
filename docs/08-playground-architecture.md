# Prompt Playground — 架构设计

## 一、什么是 Prompt Engineering？

Prompt Engineering（提示词工程）是通过设计和优化输入给 AI 的指令，来引导模型输出期望结果的技术。

### 四种核心 Prompt 模式

| 类型 | 核心思想 | 适用场景 | 示例 |
|------|---------|---------|------|
| **Plain Prompt** | 直接提问，最基础形式 | 简单问答、信息查询 | "Python 列表如何去重？" |
| **Role Prompt** | 给 AI 分配角色，约束回答风格 | 专业咨询、客服、创作 | "你是一名资深Python架构师..." |
| **Few Shot Prompt** | 给几个示例，让 AI 模仿模式 | 分类、翻译、格式化输出 | "将以下句子翻译为英文：\n中文：你好\n英文：Hello\n中文：谢谢\n英文：" |
| **Chain of Thought** | 引导 AI 逐步推理 | 数学题、逻辑推理、复杂分析 | "让我们一步一步思考..." |

### 为什么需要 Playground？

```
业务场景：你是一个 AI 产品的提示词工程师

你今天要完成的任务：
1. 设计一个客服 prompt → 需要测试 Role + Few Shot 组合效果
2. 调温度参数 → 同一个 prompt，temperature=0 和 0.8 结果不同
3. 对比不同 prompt 的回复质量 → 需要 A/B 测试

没有 Playground：
  改代码 → 重启 → 测试 → 改代码 → 重启... ❌

有 Playground：
  左侧编辑 prompt → 中间调参数 → 右侧看结果 → 实时迭代 ✅
```

### Prompt 参数详解

| 参数 | 范围 | 作用 | 经验值 |
|------|------|------|--------|
| **Temperature** | 0~2 | 控制输出的随机性。0 最确定，2 最随机 | 创意任务 0.7~0.9，精确任务 0~0.3 |
| **Max Tokens** | 1~4096 | 限制回复的最大长度 | 根据任务预估，不宜过大浪费 Token |
| **Top P** | 0~1 | 核采样，控制候选词范围的累积概率 | 通常 0.9~1，与 temperature 二选一调整 |

---

## 二、架构设计

### 页面布局

```
┌──────────────────────────────────────────────────────────────┐
│                       Header (标题栏)                         │
├───────────────────┬───────────────────┬──────────────────────┤
│   左侧: Editor    │   中间: Config    │   右侧: Output       │
│                   │                   │                      │
│  ┌─────────────┐  │  ┌─────────────┐  │  ┌──────────────┐   │
│  │ Prompt Type │  │  │ Model       │  │  │ Response     │   │
│  │ 选择器       │  │  │ 选择        │  │  │ 实时显示     │   │
│  ├─────────────┤  │  ├─────────────┤  │  ├──────────────┤   │
│  │ 模板编辑器   │  │  │ Temperature │  │  │ Token 统计   │   │
│  │             │  │  │ Max Tokens  │  │  ├──────────────┤   │
│  │             │  │  │ Top P       │  │  │ 历史记录     │   │
│  └─────────────┘  │  └─────────────┘  │  └──────────────┘   │
│                   │                   │                      │
└───────────────────┴───────────────────┴──────────────────────┘
```

### 组件层级

```
<PlaygroundLayout>                  三栏 grid 布局
  ├── <PromptEditor>                左侧：编辑器容器
  │   ├── <PromptTypeSelector>      类型下拉选择
  │   ├── <PlainTemplate>           普通 prompt
  │   ├── <RoleTemplate>            角色 prompt (切换显示)
  │   ├── <FewShotTemplate>         Few Shot (切换显示)
  │   └── <CoTTemplate>             CoT (切换显示)
  │
  ├── <ModelConfig>                 中间：模型参数
  │   ├── Model 选择
  │   ├── Temperature 滑块
  │   ├── Max Tokens 滑块
  │   └── Top P 滑块
  │
  └── <OutputPanel>                 右侧：输出面板
      ├── <ResponseViewer>          Markdown 响应展示
      ├── <TokenStats>              Token 统计数据
      └── <RunHistory>              运行历史列表
```

### 数据流

```
用户在编辑器输入 prompt
  → store.updatePrompt(text)
  → 选择模板类型 → store.setPromptType(type)
  → 模板自动填充占位符

用户调整模型参数
  → store.setTemperature(0.7)
  → store.setMaxTokens(2048)

用户点击"发送"
  → 组装完整的 request body
  → fetch POST /api/chat
  → SSE 流式接收
  → store.updateResponse(chunk)
  → 右侧面板实时渲染

用户切换 prompt 类型
  → 保留用户输入内容
  → 自动切换模板格式
  → 不中断当前流式输出
```

---

## 三、数据结构设计

```typescript
/** Prompt 类型 */
export type PromptType = "plain" | "role" | "few-shot" | "cot";

/** 模型参数 */
export interface ModelConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
}

/** Prompt 模板变量（按类型分组） */
export interface PromptVariables {
  // Plain
  userInput?: string;
  
  // Role
  role?: string;
  task?: string;
  
  // Few Shot
  examples?: string;
  fewShotInput?: string;
  
  // Chain of Thought
  question?: string;
  steps?: string;
  
  // 公共
  additionalContext?: string;
}

/** 运行历史记录 */
export interface RunRecord {
  id: string;
  promptType: PromptType;
  promptContent: string;        // 最终发送的完整 prompt
  modelConfig: ModelConfig;
  response: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  timestamp: number;
  duration: number;             // 耗时 (ms)
}
```

---

## 四、四种 Prompt 模板设计

### 1. 普通 Prompt (Plain)
```
{userInput}
```

### 2. 角色 Prompt (Role)
```
你是一名{role}。
请完成以下任务：
{task}

{additionalContext}
```

### 3. Few Shot Prompt
```
以下是一些示例：

{examples}

现在请处理以下输入：
{fewShotInput}
```

### 4. Chain of Thought Prompt
```
问题：{question}

让我们一步一步思考：
{steps}

请逐步推理并给出最终答案。
```

---

## 五、状态管理

```typescript
interface PlaygroundState {
  // Prompt 编辑
  promptType: PromptType;
  variables: PromptVariables;
  
  // 模型配置
  modelConfig: ModelConfig;
  
  // 输出
  response: string;
  isStreaming: boolean;
  
  // 历史
  history: RunRecord[];
  
  // Actions
  setPromptType, updateVariable, setModelConfig,
  sendRequest, updateResponse, clearResponse,
  saveToHistory, clearHistory,
}
```

---

## 六、路由设计

| 路由 | 说明 |
|------|------|
| `/playground` | Playground 主页面，三栏布局 |

在现有项目基础上新增，与 `/chat` 路由并列，共享同样的 API 后端（`POST /api/chat`）。

---

## 七、复用的技术

Playground 复用了现有项目的以下能力：

| 已有能力 | 复用方式 |
|---------|---------|
| `POST /api/chat` | 直接调用，无需新建 API |
| `useChatStream` | 改造为通用 Hook 或新建 playground 版本 |
| `MarkdownRenderer` | 右侧输出面板直接使用 |
| `Zustand` | 同样使用 Zustand 管理状态 |
| `shadcn/ui` | 使用 Button、Input、Slider、Select 等 |
