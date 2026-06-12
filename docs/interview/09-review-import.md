# Step 6：面试复盘导入 + 错题本

> **本文覆盖：** 原理 → 架构 → 代码 → 面试考点 → 实际业务场景
> **对应学习计划：** Day60（Tool） + Day61（Memory）

---

## 一、原理

### 1.1 复盘导入的价值

复盘导入是整个系统中**最有差异化**的功能。市面上 AI 面试工具只能帮你"练"，不能帮你"复盘真实面试"。

```
真实面试场景：
  你去面试 → 被问了一堆题 → 答得不好 → 回家复盘
               ↓
  传统方式：自己回忆 + 查资料 ⇒ 容易遗漏，效率低
  这个系统：粘贴记录 ⇒ AI 自动提取错题 ⇒ 加入背诵计划

闭环：
  真实面试 → 复盘导入 → 错题本 → 背诵 → 下次不再犯
```

### 1.2 评分阈值自动提取

```
每个问题 AI 会给出 0-10 的评分：

  评分 >= 7  → 答得不错，只记录在复盘报告中
  评分 <  7  → 答得不好，自动加入错题本

错题自动带：
  - 面试官原题（questionContent）
  - 你的回答（yourAnswer）— 下次对比进步
  - 标准答案（correctAnswer）— 直接背诵
  - 错误类型（mistakeType）— 针对性改进
  - 来源公司（company）— 面试复盘追溯
```

### 1.3 掌握度追踪模型

```
5 级掌握度体系：

  0 未掌握  → 完全答不出，需重新学习
  1 看过一次 → 有印象但说不清
  2 看过两次 → 能说大概但缺细节
  3 基本记住 → 能完整回答但不够流畅
  4 很熟练   → 脱口而出，有深度
  5 脱口而出 → 可以给面试官讲

每点击一次"复习"按钮，掌握度 +1。
已掌握（>=4）的错题在仪表盘计入"掌握率"。
```

---

## 二、架构设计

### 2.1 文件结构

```
src/
├── lib/interview/
│   ├── agents/
│   │   └── review-analyzer.ts      ← ReviewAnalyzer Agent（核心）
│   └── prompts/
│       └── review-analyzer.ts      ← 复盘提取 Prompt
│
├── app/api/interview/
│   └── analyze-review/
│       └── route.ts                ← 复盘分析 API
│
├── app/interview/
│   ├── review/
│   │   └── page.tsx                ← 复盘导入页面
│   └── questions/
│       └── page.tsx                ← 错题本页面
│
└── store/
    └── interview-store.ts          ← addReview / addErrorEntry / 掌握度更新
```

### 2.2 数据流

```
用户粘贴复盘文本（支持任意格式）
       │
       ▼
POST /api/interview/analyze-review
       │
       ▼
┌──────────────────────────────────────────────────┐
│            ReviewAnalyzer Agent                    │
│                                                   │
│  输入：非结构化文本（自由格式）                    │
│                                                   │
│  识别：公司/岗位/日期/结果/每题内容               │
│                                                   │
│  输出（JSON）：                                    │
│  ├─ review: { company, questions[], weaknessTags } │
│  └─ errorEntries: []  ← 自动提取错题             │
│      条件：score < 7 的题目才进错题本              │
└──────────────────────┬───────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ 复盘记录   │ │ 错题本    │ │ 仪表盘    │
    │ Zustand   │ │ Zustand   │ │ refresh  │
    │ persist   │ │ persist   │ │ Stats()  │
    └──────────┘ └──────────┘ └──────────┘
```

### 2.3 核心类型

```typescript
// 复盘记录
interface InterviewReview {
  id: string;
  company: string;           // 公司
  position: string;          // 岗位
  date: string;              // 日期
  result: "pass" | "fail" | "pending";
  questions: ReviewQuestion[]; // 逐题分析
  weaknessTags: string[];      // 短板标签
  summary?: string;            // AI 总结
  actionItems?: string[];      // 改进项
}

// 每题分析
interface ReviewQuestion {
  original: string;           // 面试官原题
  yourAnswer: string;         // 你的回答
  score: number;              // AI 评分 0-10
  correctAnswer: string;      // 标准答案
  mistakeType?: "concept-error" | "expression" | "depth" | "structure";
  prepStructure?: PREPStructure; // PREP 练习模板
}

// 错题本条目
interface ErrorBookEntry {
  id: string;
  questionContent: string;    // 题目
  correctAnswer: string;      // 正确答案
  yourAnswer: string;         // 你的原回答
  mistakeType: MistakeType;   // 错误类型
  company: string;            // 来源公司
  mastery: 0 | 1 | 2 | 3 | 4 | 5;  // 掌握度
  reviewCount: number;        // 复习次数
}
```

### 2.4 API 设计

```
POST /api/interview/analyze-review

Request:
{
  "content": "公司：字节跳动\n岗位：前端开发\n\n面试官问：SSE和WebSocket的区别？\n我答：SSE是单向的..."
}

Response:
{
  "review": {
    "company": "字节跳动",
    "position": "前端开发",
    "date": "2026-06-01",
    "result": "fail",
    "summary": "SSE深度不足，项目主导性表达弱",
    "weaknessTags": ["SSE原理", "项目表达"],
    "questions": [
      {
        "original": "SSE和WebSocket的区别？",
        "yourAnswer": "SSE是单向的...",
        "score": 5,
        "correctAnswer": "...",
        "mistakeType": "depth"
      }
    ],
    "actionItems": ["复习SSE流式渲染全流程"]
  },
  "errorEntries": [
    {
      "questionContent": "SSE和WebSocket的区别？",
      "correctAnswer": "...",
      "yourAnswer": "SSE是单向的...",
      "mistakeType": "depth",
      "company": "字节跳动",
      "mastery": 0
    }
  ]
}
```

---

## 三、代码实现详解

### 3.1 ReviewAnalyzer Agent

```typescript
// src/lib/interview/agents/review-analyzer.ts

export async function analyzeReview(rawText: string): Promise<ReviewAnalysisResult> {
  // 1. 调用 DeepSeek 提取结构化信息
  const response = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages: [
      { role: "system", content: "你是一个专业的面试复盘分析师..." },
      { role: "user", content: REVIEW_EXTRACTION_PROMPT + rawText },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const data = JSON.parse(response.choices[0]?.message?.content || "{}");

  // 2. 构建 Review 对象
  const review = {
    company: data.company || "未知公司",
    questions: extractQuestions(data.questions),
    weaknessTags: data.weaknessTags || [],
    // ...
  };

  // 3. 自动提取错题（评分 < 7 的题目）
  const errorEntries = questions
    .filter(q => q.score < 7 && q.original)
    .map(q => ({
      questionContent: q.original,
      correctAnswer: q.correctAnswer || "待补充",
      mistakeType: q.mistakeType || "depth",
      company: review.company,
      mastery: 0,
    }));

  return { review, errorEntries };
}
```

### 3.2 Prompt 设计

```typescript
export const REVIEW_EXTRACTION_PROMPT = `你是一个专业的面试复盘分析师。
请从以下面试记录中提取结构化的复盘信息。

你可以识别任意格式的面试记录——自由文本、对话形式、结构化问答。
尽力从中提取尽可能多的信息。

必须返回 JSON 格式：
{
  "company": "公司名称",
  "position": "岗位名称",
  "date": "YYYY-MM-DD",
  "result": "pass | fail | pending",
  "summary": "一段话总结",
  "weaknessTags": ["短板1", "短板2"],
  "questions": [
    {
      "original": "面试官原问题",
      "yourAnswer": "你的回答",
      "score": 数字(0-10),
      "correctAnswer": "标准答案",
      "mistakeType": "concept-error|expression|depth|structure"
    }
  ]
}`;
```

### 3.3 前端导入逻辑

```typescript
const handleImport = async () => {
  // 1. API 分析
  const response = await fetch("/api/interview/analyze-review", {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  const result = await response.json();

  // 2. 存储复盘记录
  const reviewId = addReview(result.review);

  // 3. 自动生成错题条目
  for (const entry of result.errorEntries) {
    addErrorEntry(entry);
  }

  // 4. 刷新仪表盘统计
  refreshStats();
};
```

### 3.4 掌握度更新

```typescript
// 点击"复习"按钮 → 掌握度 +1
<Button onClick={() =>
  updateErrorEntry(entry.id, {
    mastery: Math.min(5, entry.mastery + 1) as 0|1|2|3|4|5,
  })
}>
  <RefreshCw />
</Button>

// 掌握度进度条
<div className="h-1.5 rounded-full bg-secondary">
  <div className="h-full rounded-full bg-primary transition-all"
    style={{ width: `${(entry.mastery / 5) * 100}%` }}
  />
</div>
```

---

## 四、实际业务场景

### 场景 1：面试后导入记录

```
面试完回到家：
1. 打开 /interview/review
2. 把面试记录粘贴到文本框（支持任意格式）
3. 点击"导入并分析"

系统自动做三件事：
├─ 识别公司、岗位、日期
├─ 每道题打分、给标准答案、标错误类型
└─ 得分 < 7 的题自动加入错题本（mastery = 0）
```

### 场景 2：复习错题本

```
每天打开 /interview/questions：
├─ 看统计：总数 / 已掌握 / 待复习
├─ 逐条背诵：题 → 想答案 → 展开正确答案对比
├─ 点击刷新图标 → 掌握度 +1
└─ 掌握度到 4 以上 → 计入"已掌握"

目标：把所有错题刷到掌握度 >= 4
```

### 场景 3：用示例数据体验

```
如果还没有真实面试记录，可以用"填入示例"按钮：
- 预填了一段字节跳动的面试记录
- 包含两个典型问题：SSE/WebSocket 对比、项目挑战
- 点击导入后，错题本会自动增加条目
```

---

## 五、常见面试问题

### Q1: 复盘导入和直接记笔记有什么区别？

> 传统记笔记是自己回忆+查资料，效率低且容易遗漏细节。
> 这个系统做三件事：
> 1. **自动结构化** — 自由文本转成逐题分析
> 2. **自动评分** — 每道题 AI 打分，低于 7 分自动进错题本
> 3. **自动给答案** — AI 给出标准答案和 PREP 结构，直接背诵
>
> 相当于把"写笔记+查答案+分析薄弱点"三件事合并成一次粘贴。

### Q2: 错题本的掌握度准确吗？

> 掌握度是基于"复习次数"的简单模型（每次 +1），不是 AI 判断。
> 够用但不完美：有人复习 3 次就真记住了，有人复习 5 次还是记不住。
> V2 计划加入"主动测试"模式——AI 重新出类似的题，答对才算掌握了。

### Q3: 多份复盘之间的关联分析？

> V1 不做关联分析。每份复盘独立。
> V2 计划加入"跨复盘分析"：统计哪些短板在多次面试中出现，
> 自动生成"你的高频薄弱点 TOP5"。

### Q4: 复盘导入支持什么格式？

> **任意格式。** 自由文本、对话式、结构化问答都支持。
> DeepSeek 会智能识别和提取。唯一要求是内容包含面试的问题和回答。
>
> 已测试的格式：
> - `面试官问：xxx\n我答：xxx`（对话式）
> - `问题1：xxx\n回答：xxx`（结构化）
> - 纯文本描述"面试官问了SSE和WS的区别，我说..."（叙述式）

---

## 六、实际优化方案

### 当前 V1 限制

| 限制 | 影响 | V2 改进 |
|------|------|---------|
| 按次数记掌握度 | 不精确 | AI 主动测试验证掌握度 |
| 无跨复盘分析 | 看不到重复短板 | 自动统计高频薄弱点 TOP5 |
| 不支持录音直接导入 | 需要手动转录 | 接入语音转文字（Whisper） |
| 错题无分类筛选 | 只能看全部 | 按公司/错误类型/时间筛选 |

---

## 七、核心代码路径

```
复盘导入：
用户粘贴文本 → review/page.tsx (handleImport)
  → fetch POST /api/interview/analyze-review
  → review-analyzer.ts (analyzeReview → DeepSeek)
  → route.ts (返回 review + errorEntries)
  → review/page.tsx (addReview + addErrorEntry × N)
  → refreshStats()

错题背诵：
用户打开页面 → questions/page.tsx
  → store.errorBook 读取
  → 展示错题列表 + 掌握度进度条
  → 点击复习 → updateErrorEntry(mastery+1)
  → 进度条更新
```

---

## 八、新增文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `lib/interview/prompts/review-analyzer.ts` | 🆕 | 复盘提取 Prompt（支持任意格式） |
| `lib/interview/agents/review-analyzer.ts` | 🆕 | ReviewAnalyzer Agent（提取+自动入错题本） |
| `api/interview/analyze-review/route.ts` | 🆕 | 复盘分析 API |
| `app/interview/review/page.tsx` | 🔄 | mock → 真实 API + 自动生成错题 + 示例数据 |
| `app/interview/questions/page.tsx` | 🔄 | 接入真实错题数据 + 掌握度追踪 |

---

> **上一篇:** [Step 4-5：AI 模拟面试官 + LangGraph 状态图](08-mock-interview.md)
> **下一篇:** [项目包装](10-project-wrap.md)
