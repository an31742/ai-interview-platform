# Step 4-5：AI 模拟面试官 + LangGraph 状态图

> **本文覆盖：** 原理 → LangGraph 状态机设计 → 评分Agent → 面试问答
> **对应学习计划：** Day64-66（LangGraph StateGraph、节点设计、条件路由） + Day69-70（Scorer Agent）

---

## 一、原理

### 1.1 AI 面试官 vs 普通 Chat 的区别

```
普通 Chat:                          AI 面试官:
用户问 → AI答                       AI问 → 用户答 → AI评估 → AI决定下一步
  无状态                                状态机（阶段/评分/决策）
  一轮对话独立                           多轮对话关联
  被动响应                               主动引导
  不评分                                 逐题评分+最终报告
```

### 1.2 为什么需要状态机？

面试不是"我问你答"那么简单。真实面试官会根据你的回答动态调整：

```
用户答得好 (得分>=7)  →  继续深入追问   →  "能具体讲讲怎么实现的吗？"
用户答一般 (得分4-6)  →  换个角度问     →  "那你对XX有了解吗？"
用户答得差 (得分<4)   →  切换下一话题   →  "好的，我们聊聊别的"
```

这就是**条件路由**——普通 API 调用做不到，需要状态机。

---

## 二、LangGraph 状态机设计

### 2.1 整体架构

```
每次 /api/interview/chat 调用执行一轮面试：

   START
     │
     ▼
┌─────────────┐
│ evaluateAnswer │  ← 节点 A：评估用户最新回答，打分
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
│generateResponse│ ← 节点 C：生成 AI 的下一轮提问
│   (DeepSeek)   │
└──────┬───────┘
       │
       ▼
      END
```

### 2.2 状态定义

```typescript
interface InterviewState {
  messages: InterviewMessage[]        // 对话历史
  phase: InterviewPhase               // 当前阶段
  phaseAnswerCount: number            // 本阶段回答数
  phaseScores: number[]               // 本阶段评分列表
  totalAnswerCount: number            // 总回答数
  currentEvaluation: Evaluation|null  // 最新评估
  currentDecision: Decision|null      // 最新决策
  aiResponse: string                  // AI 生成的回复
  resumeContext: string               // 简历信息
  jdContext: string                   // JD 信息
  error: string|null                  // 错误信息
}
```

### 2.3 条件路由决策逻辑

```
决策规则：
  avgScore >= 7 且 answerCount >= 3  → next_phase（切换阶段）
  avgScore >= 7 且 answerCount < 3   → deeper（继续深入追问）
  avgScore 4-6                        → switch_topic（换角度）
  avgScore < 4                        → next_phase（换阶段，不浪费时间）
  当前是 qa 且已答 1 题               → end_interview（结束）
```

### 2.4 核心代码实现

```typescript
// LangGraph StateGraph 定义
const graph = new StateGraph(InterviewState)
  .addNode("evaluateAnswer", evaluateAnswer)     // 节点A：评分
  .addNode("decideNext", decideNext)             // 节点B：决策
  .addNode("generateResponse", generateResponse) // 节点C：生成回复
  .addEdge("__start__", "evaluateAnswer")
  .addEdge("evaluateAnswer", "decideNext")
  .addEdge("decideNext", "generateResponse")
  .addEdge("generateResponse", END);

export const interviewGraph = graph.compile();
```

**注意：** 实际代码中每个节点的 LLM 调用使用 **OpenAI SDK 直接调用 DeepSeek**，
而非 LangChain 的 `model.invoke()`。原因：LangChain 的模型封装返回类型
在 Node.js 环境下与 Next.js 的类型检查不兼容，改用 OpenAI SDK
（`client.chat.completions.create()`）后类型完全对齐。

```typescript
// 节点内部调用方式（使用 OpenAI SDK）
const response = await client.chat.completions.create({
  model: DEEPSEEK_MODEL,
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ],
  temperature: 0.1,
  response_format: { type: "json_object" },
});
return response.choices[0]?.message?.content || "";
```

---

## 三、面试阶段设计

### 3.1 五阶段流程

```
阶段 1: 自我介绍
  角色：友好面试官
  目标：让候选人放松，了解背景
  时长：2-3轮对话
  → 不打断，听完整

阶段 2: 项目深挖 ★核心
  角色：技术负责人
  目标：用STAR法则验证项目真实性
  时长：5-8轮对话
  → STAR框架（场景→任务→行动→结果）

阶段 3: 基础考察
  角色：一线面试官
  目标：考察技术深度
  时长：3-5轮对话
  → 根据简历动态出题

阶段 4: 系统设计（senior模式）
  角色：技术总监
  目标：考察架构设计能力
  时长：2-3轮对话
  → 关注权衡和异常处理

阶段 5: 反问环节
  角色：面试官
  目标：解答候选人疑问
  时长：1-2轮对话
  → 结束后触发评分
```

### 3.2 阶段切换条件

```
                ┌─────────────────┐
                │  自我介绍         │
                │  (>=3轮 或 评分<4)│
                └────────┬────────┘
                         │
                ┌────────▼────────┐
                │  项目深挖         │
                │  (>=5轮 或 评分<4)│
                └────────┬────────┘
                         │
                ┌────────▼────────┐
                │  基础考察         │
                │  (>=3轮 或 评分<4)│
                └────────┬────────┘
                         │
                ┌────────▼────────┐
                │  系统设计         │
                │  (>=2轮)         │
                └────────┬────────┘
                         │
                ┌────────▼────────┐
                │  反问环节         │
                │  (1轮后结束)      │
                └─────────────────┘
```

---

## 四、Scorer Agent

### 4.1 五维评分模型

```
                     总分
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   基础能力30%    项目深度25%    系统设计20%
   (fundamentals) (projectDepth) (systemDesign)
        │             │             │
   表达沟通15%    AI能力10%
   (expression) (aiCapability)
```

### 4.2 评分 Prompt 设计

```
评分原则：
- 整体要客观，避免虚高或过低
- 优点和缺点都要有具体例子的引用
- 改进建议要可执行
- 表达问题要基于实际对话中的表现

输出格式：JSON
{
  "overall": 0-100,
  "dimensions": { fundamentals, projectDepth, systemDesign, expression, aiCapability },
  "strengths": ["具体优点1", ...],
  "weaknesses": ["具体待改进1", ...],
  "suggestions": ["建议1", ...],
  "expressionIssues": { fillerWords, tensionLevel, advice }
}
```

### 4.3 面试报告生成流程

```
面试结束触发
     │
     ▼
POST /api/interview/generate-report
     │
     ├─ 收集全部对话消息
     ├─ 构建评分 Prompt
     ├─ 调用 DeepSeek 评分
     └─ 返回 InterviewScore
     │
     ▼
前端展示报告（/interview/mock/[id]/report）
     ├─ 总分（圆形进度）
     ├─ 五维度评分（进度条）
     ├─ 优缺点列表
     ├─ 改进建议
     └─ 表达分析
```

---

## 五、SSE 流式设计

### 5.1 协议格式

```
前端 → 后端 (POST /api/interview/chat)
{
  "messages": [...],         // 完整对话历史
  "phase": "self-intro",     // 当前阶段
  "resumeContext": "...",    // 简历上下文摘要
  "resumeId": "uuid",        // 简历 ID（可选，RAG 检索用）
  "jdContext": "...",        // JD 上下文
  "phaseScores": [7, 6],    // 当前阶段历史评分
  "phaseAnswerCount": 2,
  "totalAnswerCount": 5
}

后端 → 前端 (SSE Stream)
data: {"type":"chunk","content":"了"}
data: {"type":"chunk","content":"解"}
data: {"type":"chunk","content":"了"}
data: {"type":"evaluation","score":7,"comment":"思路清晰"}
data: {"type":"phase-change","phase":"project-deep-dive"}
data: {"type":"done"}
```

### 5.2 打字机效果

后端一次性生成完整回复（由 LangGraph 的 generateResponse 节点生成），
然后以 SSE 逐字输出到前端，模拟打字机效果：

```typescript
// 逐字输出
const chars = aiText.split("");
for (let i = 0; i < chars.length; i++) {
  const sseData = JSON.stringify({ type: "chunk", content: chars[i] });
  controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
  // 动态延迟
  await sleep(chars[i].match(/[。！？\n]/) ? 50 : 
              chars[i].match(/[，、；：]/) ? 30 : 15);
}
```

---

### 5.3 RAG 上下文增强（V3 新增）

简历上传后，后端异步将简历内容索引到 ChromaDB。面试时 AI 能检索到简历中的
项目细节，从"介绍你的项目"变成"精确追问技术细节"。

```typescript
// 后端 /api/interview/chat 路由中：
let enhancedResumeContext = resumeContext || "";
if (resumeId && messages.length < 4) {
  // 只在面试早期检索 RAG（节省 Token）
  const ragContext = await retrieveResumeContext(resumeId, lastUserMsg?.content);
  if (ragContext) {
    enhancedResumeContext += "\n\n【简历详细经历】\n" + ragContext;
  }
}

// 之后传给 LangGraph 的 resumeContext
const result = await processInterviewTurn({
  ...,
  resumeContext: enhancedResumeContext,
});
```

效果示例：
- 无 RAG：AI问 → "介绍你的项目"
- 有 RAG：AI问 → "你在 Legion Zone 项目中用 CopilotKit + SSE + getReader
  实现流式对话，能讲讲为什么选这套技术栈吗？"

### 5.4 前端增强

**结束面试按钮：** 面试进行中顶部栏显示"结束面试"按钮。用户可主动终止面试，
系统自动生成评分报告。

```
点击"结束面试" → 确认弹窗 → 确定
  → 添加系统消息"面试已结束，正在生成报告..."
  → 调用 POST /api/interview/generate-report
  → 跳转到报告页
```

**报告手动生成：** 如果报告页分数为 0（报告未生成），显示"生成面试报告"按钮，
点击后调用评分 API 获取真实评分。

## 六、面试常见问题

### Q1: 为什么用 LangGraph 而不是普通 API 调用？

> 普通 API 调用是无状态的"请求-响应"模式。
> 面试需要**状态管理**和**条件路由**：
> - 当前在哪个阶段？
> - 用户答得怎么样？
> - 下一步问什么？
>
> LangGraph 的 StateGraph 提供了**状态定义 + 节点 + 条件边**的完整框架，
> 不需要手写状态机。而且条件路由是 LangGraph 的核心能力——
> 用 `conditional_edges` 就能实现"评分高继续追问、评分低切换话题"。

### Q2: 怎么保证 AI 面试官问得专业？

> 三个层面：
> 1. **分阶段 Prompt** — 每个阶段有独立的角色和出题策略
> 2. **简历 + JD 上下文注入** — AI 知道候选人的技能和岗位要求
> 3. **追问策略** — 答得好深入（5层追问），答得差换题
>
> 不让 AI 自由发挥，而是在框架内引导。

### Q3: 评分准吗？

> 基于 DeepSeek 的评估，准确率在 70-80%。
> 评分主要用于"条件路由"决策（继续还是换题），
> 不需要非常精确。最终的面试报告评分会综合整场表现。

### Q4: 和市面上其他 AI 面试工具比有什么优势？

> 市面上工具的问题：
> - 通用题库，和简历无关
> - 线性流程，没有动态调整
> - 没有评分和追踪
>
> 我的系统解决了这三个问题：
> - **基于简历出题** — 每一题都和你的技术栈相关
> - **动态追问** — 答得好深入，答得差换题
> - **五维评分 + 错题本** — 形成学习闭环

---

## 七、本次新增/修改文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `lib/interview/prompts/interviewer.ts` | 🆕 | 5阶段面试官 Prompt + 评分/路由 Prompt |
| `lib/interview/prompts/scorer.ts` | 🆕 | 面试评分 + 逐题评分 Prompt |
| `lib/interview/graphs/interview-graph.ts` | 🆕 | LangGraph StateGraph（3节点+条件路由） |
| `lib/interview/agents/scorer.ts` | 🆕 | Scorer Agent（五维评分+报告生成） |
| `lib/interview/services/rag-context.ts` | 🆕 | 简历 RAG 索引 + 面试检索增强 |
| `api/interview/chat/route.ts` | 🔄 | 接入 LangGraph + SSE 流式 + RAG 检索 |
| `api/interview/generate-report/route.ts` | 🆕 | 面试报告生成 API |
| `app/interview/mock/[id]/page.tsx` | 🔄 | mock → 真实 SSE API 调用 |

---

> **上一篇:** [Step 3：JD 分析 + 面试题生成](07-jd-analysis.md)
> **下一篇:** [Step 6：面试复盘导入 + 错题本](09-review-import.md)
