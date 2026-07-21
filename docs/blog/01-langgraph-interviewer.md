# 使用 LangGraph + DeepSeek 构建 AI 面试官：状态图设计与实践

> 面试官不是 Chatbot——让 AI 学会"看人下菜碟"

---

## 一、背景：为什么普通 Chat 不够？

传统的 AI 对话是"用户问 → AI 答"的模式，每个请求独立，无状态。

但面试不一样：

```
用户答得好 (得分 >= 7) → 继续深挖追问 → "能具体讲讲怎么实现的吗？"
用户答一般 (得分 4-6) → 换个角度问   → "那你对 XX 有了解吗？"
用户答得差 (得分 < 4)  → 切换话题     → "好的，我们聊聊别的"
```

简单来说，面试官需要**根据用户的回答动态调整**——这是**条件路由**。

如果用普通 API 调用实现，你得自己维护状态机、自己写分支逻辑：

```typescript
// ❌ 普通 API 调用：状态管理靠自己
async function handleAnswer(answer: string) {
  const score = await evaluateAnswer(answer);
  if (score >= 7 && count >= 3) {
    return await switchPhase();
  } else if (score >= 7) {
    return await askDeeper();
  } else if (score >= 4) {
    return await switchTopic();
  } else {
    return await skipPhase();
  }
}
```

状态散落在各个函数里，逻辑越长越难维护。

---

## 二、LangGraph 状态机

### 2.1 什么是 LangGraph？

LangGraph 是 LangChain 团队推出的**状态图框架**，专门做"有状态、多步骤、条件路由"的工作流。

核心概念只有三个：

| 概念 | 类比 | 说明 |
|------|------|------|
| **State** | 全局变量 | 节点之间传递的数据对象 |
| **Node** | 函数 | 处理一个步骤，接收 State → 返回部分 State |
| **Edge** | 连接线 | 决定执行顺序，支持条件路由 |

### 2.2 面试状态定义

```typescript
const InterviewState = Annotation.Root({
  // 对话历史
  messages: Annotation<InterviewMessage[]>({
    reducer: (left, right) => [...(left || []), ...right],
    default: () => [],
  }),
  // 当前阶段：自我介绍 → 项目深挖 → 基础考察 → 系统设计 → 反问
  phase: Annotation<InterviewPhase>({
    reducer: (a, b) => b ?? a,
    default: () => "self-intro",
  }),
  // 本阶段评分列表（用于决策）
  phaseScores: Annotation<number[]>({
    reducer: (a, b) => b ?? a,
    default: () => [],
  }),
  // AI 生成的回复
  aiResponse: Annotation<string>({
    reducer: (a, b) => b ?? a,
    default: () => "",
  }),
  // 简历/JD 上下文
  resumeContext: Annotation<string>({
    reducer: (a, b) => b ?? a,
    default: () => "",
  }),
});
```

### 2.3 三节点状态图

```
每次用户回答后执行一轮：

   START
     │
     ▼
┌─────────────┐
│ evaluateAnswer │  ← 节点 A：评估回答质量，打分
│   (DeepSeek)   │
└──────┬───────┘
       │
       ▼
┌─────────────┐
│  decideNext   │  ← 节点 B：条件路由决策
│   (DeepSeek)  │      继续/深入/换题/切阶段/结束
└──────┬───────┘
       │
       ▼
┌─────────────┐
│generateResponse│ ← 节点 C：生成下一轮提问
│   (DeepSeek)   │
└──────┬───────┘
       │
       ▼
      END
```

代码实现非常简洁：

```typescript
const graph = new StateGraph(InterviewState)
  .addNode("evaluateAnswer", evaluateAnswer)
  .addNode("decideNext", decideNext)
  .addNode("generateResponse", generateResponse)
  .addEdge("__start__", "evaluateAnswer")
  .addEdge("evaluateAnswer", "decideNext")
  .addEdge("decideNext", "generateResponse")
  .addEdge("generateResponse", END);
```

---

## 三、核心节点实现

### 3.1 节点 A：评估回答

```typescript
async function evaluateAnswer(state: State) {
  const lastMsg = state.messages[state.messages.length - 1];
  if (!lastMsg || lastMsg.role !== "user") {
    return { currentEvaluation: null };
  }

  // 调用 DeepSeek 评分（JSON Mode，temperature 0.1）
  const text = await callDeepSeek(
    "你是一个严格的面试评分员",
    ANSWER_EVALUATION_PROMPT + lastMsg.content,
    0.1
  );

  const evaluation = JSON.parse(extractJSON(text));
  return {
    currentEvaluation: evaluation,
    phaseScores: [...state.phaseScores, evaluation.overall],
  };
}
```

用 `temperature: 0.1`（低温度），保证评分稳定，不给幻觉空间。

### 3.2 节点 B：条件路由

```typescript
async function decideNext(state: State) {
  const scores = state.phaseScores;
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  // 让 DeepSeek 做决策，但规则是明确的
  const text = await callDeepSeek(
    "你是面试流程控制器，输出 JSON 决策",
    `当前阶段：${state.phase}
     本阶段平均分：${avgScore}
     回答数：${state.phaseAnswerCount}
     决策规则：评分>=7继续深入，4-6换角度，<4切换阶段`,
    0.1
  );

  const decision = JSON.parse(extractJSON(text));
  return { currentDecision: decision };
}
```

决策规则：

| 条件 | 决策 |
|------|------|
| avgScore >= 7 且 >= 3 题 | → next_phase（切换阶段） |
| avgScore >= 7 且 < 3 题 | → deeper（继续追问） |
| avgScore 4-6 | → switch_topic（换角度） |
| avgScore < 4 | → next_phase（不浪费时间） |

### 3.3 节点 C：生成回复

```typescript
async function generateResponse(state: State) {
  const phase = state.currentDecision === "next_phase"
    ? getNextPhase(state.phase)
    : state.phase;

  // 根据阶段选择不同的 System Prompt
  const phasePrompt = getPhasePrompt(phase);
  // 注入简历+JD 上下文（让 AI 能引用项目细节）
  const context = buildContext(state);

  let instruction = "";
  if (state.currentDecision === "deeper") {
    instruction = "候选人答得不错，继续深入追问";
  } else if (state.currentDecision === "switch_topic") {
    instruction = "候选人答得一般，换个角度问";
  }

  const response = await client.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      { role: "system", content: phasePrompt + context + instruction },
      ...state.messages.slice(-6).map(m => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content,
      })),
    ],
    temperature: 0.7, // 生成回复用高温度，灵活自然
  });

  return {
    aiResponse: response.choices[0]?.message?.content || "",
    phase,
  };
}
```

这里有个关键设计：**评分和路由用低温度（0.1），生成回复用高温度（0.7）**。评分要准，回复要灵活。

---

## 四、面试阶段设计

5 个阶段，每个阶段有不同的角色和出题策略：

```
阶段 1: 自我介绍
  角色：友好面试官 → 不打断，听完整

阶段 2: 项目深挖 ★核心
  角色：技术负责人 → STAR 法则追问（场景→任务→行动→结果）
  每项目追问到第 3 层（技术选型→落地细节→踩坑复盘）

阶段 3: 基础考察
  角色：一线面试官 → 基于简历动态出题
  写 Vue → 出响应式；写 SSE → 出流式渲染

阶段 4: 系统设计
  角色：技术总监 → 架构设计题（权衡+异常）

阶段 5: 反问环节
  角色：面试官 → 解答疑问 → 结束
```

切换逻辑：

```
自我介绍 ←→ 项目深挖 ←→ 基础考察 ←→ 系统设计 ←→ 反问
  │            │            │            │            │
  └─ 3轮或<4分 ─┘ 5轮或<4分 ─┘ 3轮或<4分 ─┘  2轮   ──┘ 1轮后结束
```

---

## 五、SSE 流式输出

面试官的回复需要打字机效果。架构是**后端一次性生成，逐字 SSE 推送**：

```typescript
// 后端
const chars = aiText.split("");
for (let i = 0; i < chars.length; i++) {
  const sseData = JSON.stringify({ type: "chunk", content: chars[i] });
  controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
  // 标点符号后停顿稍长，模拟真人说话节奏
  await sleep(chars[i].match(/[。！？\n]/) ? 50 :
              chars[i].match(/[，、；：]/) ? 30 : 15);
}

// 发送评分事件
controller.enqueue(JSON.stringify({
  type: "evaluation", score: 7, comment: "思路清晰"
}));

// 发送阶段变更事件
controller.enqueue(JSON.stringify({
  type: "phase-change", phase: "project-deep-dive"
}));
```

前端接入：

```typescript
const response = await fetch("/api/interview/chat", { method: "POST" });
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "", fullResponse = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  // 解析 SSE 事件
  for (const line of buffer.split("\n")) {
    if (line.startsWith("data: ")) {
      const event = JSON.parse(line.slice(6));
      if (event.type === "chunk") appendStreamContent(event.content);
    }
  }
}
```

---

## 六、效果对比

同样的简历，AI 面试官的表现：

**没有 LangGraph 状态机（线性流程）：**
```
面试官：请自我介绍。
用户：我做了 Legion Zone AI 项目...
面试官：下一个问题，Vue 响应式原理是什么？
用户：Proxy 依赖收集...
面试官：下一个问题，盒模型是什么？
```

不管用户答得怎么样，固定顺序问完所有题，体验很差。

**有 LangGraph 状态机（条件路由）：**
```
面试官：请自我介绍。
用户：我做了 Legion Zone AI 项目，用了 CopilotKit + SSE 流式渲染...
面试官：能具体讲讲 SSE 流式渲染怎么实现的吗？
（评分 >= 7 → 继续深入追问）
用户：用了 getReader + TextDecoder，增量更新 DOM...
面试官：那 ReadableStream 的 pipeThrough 用过吗？跨 chunk 的 UTF-8 怎么处理？
（评分 >= 7 → 继续深挖）
用户：这个没太深入了解...
面试官：没关系，那我们聊聊别的。你对 React Hooks 的链表机制有了解吗？
（评分 < 4 → 切换话题，不浪费时间）
```

用户体验完全不同：答得好会深入，答得差会换题，面试官像真人。

---

## 七、总结与踩坑

### 7.1 LangGraph 的三个核心心得

1. **State 设计决定一切** — 状态定义是 LangGraph 的起点。把需要在节点间传递的数据都放在 State 里，不够再加，不要省

2. **Node 要职责单一** — 每个节点只做一件事（评分/决策/生成），方便调试和替换

3. **条件路由是真香** — 普通 Chain 只能线性执行，conditional_edges 才是 LangGraph 的核心能力

### 7.2 实际踩坑

- **不要用 LangChain 的 model.invoke()** — 类型定义在 Next.js 下会有兼容问题。直接使用 OpenAI SDK（DeepSeek 兼容 OpenAI 格式）更稳定

- **Prompt 要分阶段** — 不要一个 System Prompt 走天下。每个阶段有不同的角色人设和出题策略

- **评分温度 vs 生成温度** — 评分节点用低温度（0.1），生成节点用高温度（0.7-0.8），各司其职

---

> 项目开源：https://github.com/an31742/ai-interview-platform
> 在线体验：https://ai-sigma-rosy.vercel.app
