# Step 3：JD 分析 + 面试题生成

> **本文覆盖：** 原理 → 架构 → 代码 → 面试考点 → 实际业务场景
> **对应学习计划：** Day57-59（ChatModel、PromptTemplate、Chain）

---

## 一、原理

### 1.1 JD 分析的核心价值

JD 分析不是"把岗位要求读一遍"，而是**找到简历和岗位之间的差距**。

```
JD分析的核心问题：
"候选人已有的能力" vs "岗位需要的能力" → 之间的差距 = 面试重点

        简历技能                  JD要求                 面试重点
  ┌────────────────┐      ┌────────────────┐      ┌────────────────┐
  │ Vue / React    │      │ React / Next.js│      │ Next.js 深度   │
  │ SSE 流式渲染    │ ──── │ SSE 高并发优化  │ ──── │ SSE 心跳/重连   │
  │ JavaScript ES6 │      │ TypeScript     │      │ 类型体操        │
  │ CSS 基础        │      │ CSS-in-JS      │      │ CSS 方案对比    │
  │ 没有 Node.js   │      │ Node.js 经验    │      │ Node.js 基础    │
  └────────────────┘      └────────────────┘      └────────────────┘
```

### 1.2 面试题生成的核心策略

不是随机出题，而是**三优先策略**：

```
优先级 1：简历技术栈深度题（你最可能被问到的）
  简历写了 Vue → 出响应式/依赖收集/diff 算法
  简历写了 SSE 流式渲染 → 出 ReadableStream/断线重连/TextDecoder

优先级 2：JD 有但简历弱的技术（你最需要准备的）
  JD 要求 TypeScript 但简历少 → 出 TS 类型题
  JD 要求 Node.js 但简历没有 → 出 Node 基础题

优先级 3：基础底线题（不超过 30%）
  闭包/Event Loop/CSS 盒模型（但不会多问，因为面经到处都是）
```

---

## 二、架构设计

### 2.1 双 Agent 架构

```
用户粘贴 JD 文本
       │
       ▼
┌──────────────────────────────────────────────┐
│            JDAnalyzer Agent                    │
│                                                │
│  第一阶段：extractJDInfo()                     │
│    输入：JD 纯文本                             │
│    输出：结构化 JD（技能/职责/要求）            │
│    温度：0.1（低温度保证提取准确性）              │
│                                                │
│  第二阶段：analyzeMatch()（如果有简历）         │
│    输入：结构化 JD + 简历信息                  │
│    输出：匹配度/差距/面试重点                   │
│    温度：0.3（分析需要一定灵活性）               │
└──────────────────────┬─────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│        QuestionGenerator Agent                 │
│                                                │
│  输入：简历信息 + JD 分析（可选）               │
│  策略：三优先（深度→差距→基础）                 │
│  输出：结构化面试题数组                         │
│  每道题：题目 + 答案要点 + 追问 + 难度          │
└──────────────────────────────────────────────┘
```

### 2.2 面试题结构设计

```typescript
interface Question {
  id: string
  category: "vue" | "react" | "javascript" | "css" | "browser" 
           | "engineering" | "ai" | "system-design" | "project" | "hr"
  difficulty: "junior" | "mid" | "senior"
  content: string              // 面试题内容
  expectedAnswer: string      // 标准答案要点
  tips: string[]              // 答题技巧
  tags: string[]              // 技术标签
  followUpQuestions?: string[] // 追问（答得好时深挖）
}
```

### 2.3 API 设计

```
POST /api/interview/analyze-jd           ← JD 分析
POST /api/interview/generate-questions    ← 面试题生成

--- JD 分析 ---
POST /api/interview/analyze-jd

Request:
{
  "jdContent": "岗位描述文本...",
  "resume": { ... }           // 可选，客户端传入简历数据
}

Response:
{
  "id": "uuid",
  "jd": {
    "content": "...",
    "company": "xx公司",
    "position": "高级前端工程师",
    "analysis": { ... }
  },
  "analysis": {
    "requiredSkills": ["React", "TypeScript", ...],
    "preferredSkills": ["Node.js", ...],
    "responsibilities": ["负责前端框架搭建", ...],
    "interviewFocus": ["SSE流式渲染原理", ...],
    "matchScore": 72,
    "matchAnalysis": "候选人React和SSE经验匹配..."
  }
}

--- 面试题生成 ---
POST /api/interview/generate-questions

Request:
{
  "resume": { ... },           // 简历完整数据（客户端传入）
  "jdAnalysis": { ... },       // 可选的 JD 分析结果
  "count": 5                    // 生成数量（默认 5）
}

Response:
{
  "questions": [
    {
      "id": "q_1741256689_0",
      "category": "react",
      "difficulty": "senior",
      "content": "你在Legion Zone项目中用了CopilotKit，能讲讲它和直接调DeepSeek API的区别吗？",
      "expectedAnswer": "CopilotKit是封装层...关键得分点：1)...2)...3)...",
      "tips": ["从封装层角度回答", "对比直接调用的优缺点"],
      "tags": ["CopilotKit", "AI集成"]
    }
  ]
}
```

---

## 三、Prompt 工程详解

### 3.1 JD 提取 Prompt

```typescript
export const JD_EXTRACTION_PROMPT = `你是一个专业的 JD 解析器。
请从以下招聘 JD 中提取结构化的岗位信息。

你必须返回 JSON 格式，包含以下字段：
{
  "company": "公司名称（如果能识别）",
  "position": "岗位名称",
  "requiredSkills": ["必备技能1", ...],
  "preferredSkills": ["加分技能1", ...],
  "responsibilities": ["职责1", ...],
  ...
}
注意事项：
- requiredSkills 只包括明确要求的
- preferredSkills 包括"加分项""优先""了解"等描述
- 如果字段找不到，用空字符串或空数组
`;
```

**设计要点：**
| 设计 | 为什么 |
|------|--------|
| `required` vs `preferred` 分开 | 面试官问"必备技能"和"加分项"时答案不同 |
| `temperature: 0.1` | 提取信息要求准确，低温度减少幻觉 |
| JSON Mode | 强制模型输出结构化 JSON |

### 3.2 匹配分析 Prompt

```typescript
export const JD_MATCH_ANALYSIS_PROMPT = `你是一个资深技术面试官 + 招聘专家。
基于以下"候选人简历信息"和"目标岗位 JD 信息"，
分析匹配度，指出差距，给出面试准备建议。

请以 JSON 格式返回分析结果：
{
  "matchScore": 数字（0-100）,
  "matchAnalysis": "强匹配点 + 主要差距",
  "matchedSkills": ["匹配到的技能1", ...],
  "gappedSkills": ["缺少或不足的技能1", ...],
  "interviewFocus": ["面试准备重点1", ...],
  "improvementAdvice": "简历优化建议"
}
`;
```

**为什么分两步？**
- JD 提取（第一阶段）聚焦"理解岗位"
- 匹配分析（第二阶段）聚焦"对比差距"
- 分开后，即使没有简历也能完成 JD 分析

### 3.3 出题策略 Prompt

出题最核心的逻辑在 Prompt 中描述：

```
出题策略（按优先级）：
1. 优先出候选人简历中提到的技术栈的深度题
2. 其次出 JD 中要求但候选人简历中较弱的技能
3. 纯基础题不超过 30%
4. 至少 1 道项目深挖题（STAR 追问）

每题要预设"追问"：
- 答得好 → 继续深入追问
- 答得一般 → 换个角度问
- 答不出 → 换话题
```

---

## 四、实际业务场景

### 场景 1：快速分析一个 JD

```
用户操作：
1. 复制公司 JD → 粘贴到 /interview/jd 的文本框
2. 点击"开始分析"
3. 3-5 秒后看到分析结果

结果展示：
- 岗位信息（公司/岗位/薪资）
- 必备技能标签 + 加分技能标签
- 岗位职责清单
- 如果没有上传简历 → 不展示匹配度
```

### 场景 2：JD + 简历匹配分析

```
用户操作：
1. 先上传简历（简历管理页面）
2. 再粘贴 JD → 点击分析
3. 系统自动关联最新简历

结果展示：
- 匹配度分数 + 进度条
- 匹配上的技能 / 有差距的技能
- 面试准备重点（按被问概率排序）
- 简历优化建议
```

### 场景 3：基于 JD 生成面试题

```
用户操作：
1. 简历已上传 + JD 已分析
2. 点击 "生成面试题"
3. AI 生成 5 道针对性题目

题目示例：
1. [React/高级] "你在 Legion Zone 项目中用了 CopilotKit，
   能讲讲它和直接调 DeepSeek API 的区别吗？"
2. [SSE/中级] "流式渲染中超长响应怎么处理？
   如果用户网络中断怎么恢复？"
3. [TS/中级] "interface 和 type 的区别？什么场景用哪个？"
```

---

## 五、面试常见问题

### Q1: JD 分析和直接用人眼看有什么区别？

> JD 分析的核心不是"读懂 JD"，而是**把 JD 和简历做系统性对比**。
> 人眼看可能漏掉某些技能要求，或者高估自己的匹配度。
> AI 分析会严格对比每个技能点，给出的 matchScore 和 gap 更客观。

### Q2: 生成的面试题会不会太通用？

> 不会。系统使用**三优先策略**：
> 1. 优先深度考察简历中提到的技术
> 2. 优先覆盖 JD 要求的技能
> 3. 基础题不超过 30%
>
> 比如你简历写了 SSE 流式渲染，生成的题不会是
> "什么是 SSE"这种基础题，而是
> "ReadableStream 怎么处理跨 chunk 的 UTF-8 字符？"

### Q3: 多个 JD 之间能对比吗？

> 目前 V1 不支持 JD 间对比。
> V2 计划加入"多 JD 对比"功能，可以比较不同公司岗位的
> 技能要求差异，帮助用户做 offer 选择。

### Q4: matchScore 准吗？

> 基于 DeepSeek 的分析，准确率在 70-80%。
> matchScore 主要作为参考，更重要的是 gappedSkills
> （差距分析）和 interviewFocus（面试重点），
> 这些是真正影响面试通过率的关键信息。

---

## 六、实际优化方案

### 当前 V1 限制

| 限制 | 影响 | V2 改进 |
|------|------|---------|
| 只能分析单一 JD | 无法对比多岗位 | 多 JD 对比功能 |
| 简历匹配需手动关联 | 用户可能忘关联 | 自动检测最新简历 |
| 不支持 JD URL 导入 | 需要手动复制文本 | URL 自动抓取 JD 内容 |
| 面试题无法收藏 | 好题无法保存 | 收藏 + 分类管理系统 |

### 性能数据

```
一次 JD 分析耗时分布：
┌─────────────────────────────────┐
│  DeepSeek JD 提取     ~1500ms   │
│  DeepSeek 匹配分析    ~2000ms   │
│  （若无简历则跳过）               │
│  总计                ~3500ms    │
└─────────────────────────────────┘

一次面试题生成耗时：
┌─────────────────────────────────┐
│  DeepSeek 出题        ~3000ms   │
│  校验+格式化          ~100ms    │
│  总计                ~3100ms    │
└─────────────────────────────────┘
```

---

## 七、核心代码路径

```
JD 分析流程：
用户粘贴 JD → jd/page.tsx (handleAnalyze)
            → fetch POST /api/interview/analyze-jd
            → jd-analyzer.ts (extractJDInfo → DeepSeek)
            → jd-analyzer.ts (analyzeMatch → DeepSeek，如有简历)
            → route.ts (返回 JSON)
            → jd/page.tsx (存入 Store)
            → jd/analysis/page.tsx (展示分析报告)

面试题生成流程：
前端调用（如仪表盘或准备页面）
  → fetch POST /api/interview/generate-questions
  → 传入简历+JD分析
  → question-generator.ts (buildCandidateContext + generateQuestions)
  → DeepSeek API (三优先策略出题)
  → route.ts (返回 Question[])
  → 展示题目列表

前端调用示例代码：
----------------------------------------------------------------
const handleGenerateQuestions = async () => {
  const resume = useInterviewStore.getState().resumes[0];
  const jd = useInterviewStore.getState().jds[0];
  if (!resume) return alert("请先上传简历");

  const response = await fetch("/api/interview/generate-questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resume,
      jdAnalysis: jd?.analysis,
      count: 5,
    }),
  });

  const result = await response.json();
  // result.questions = [{ category, difficulty, content, expectedAnswer, tips }]
  setQuestions(result.questions);
};
----------------------------------------------------------------
```

---

## 八、本次新增/修改文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/lib/interview/prompts/jd-analysis.ts` | 🆕 新增 | JD 提取 + 匹配分析两阶段 Prompt |
| `src/lib/interview/prompts/question-generator.ts` | 🆕 新增 | 面试题生成 + 分阶段出题 Prompt |
| `src/lib/interview/agents/jd-analyzer.ts` | 🆕 新增 | JDAnalyzer Agent（提取+匹配） |
| `src/lib/interview/agents/question-generator.ts` | 🆕 新增 | QuestionGenerator Agent（三优先出题） |
| `src/app/api/interview/analyze-jd/route.ts` | 🆕 新增 | JD 分析 API 路由 |
| `src/app/api/interview/generate-questions/route.ts` | 🆕 新增 | 面试题生成 API 路由 |
| `src/app/interview/jd/page.tsx` | 🔄 修改 | mock → 真实 API 调用 |
| `src/app/interview/jd/analysis/page.tsx` | 🔄 修改 | 占位 → 真实分析报告展示 |

---

> **上一篇:** [Step 2：简历上传与 AI 分析](06-resume-upload.md)
> **下一篇:** [Step 4-5：AI 模拟面试官 + LangGraph 状态机](08-mock-interview.md)
