# Step 9：面试准备 — 一键生成面试题

> **本文覆盖：** 原理 → 架构 → 代码 → 面试考点 → 实际业务场景
> **对应学习计划：** Day57（ChatModel）、Day59（Chain）、Day60（Tool）

---

## 一、原理

### 1.1 为什么需要"面试准备"页面？

之前的系统各功能是分离的：

```
简历分析 → 单独页面
JD 分析  → 单独页面
模拟面试 → 单独页面
错题本   → 单独页面

问题：用户想看"针对我的简历和意向岗位，我应该准备什么题？"
需要打开多个页面，体验不连贯。
```

面试准备页面将**简历 + JD + 出题**三者整合到一个流程中：

```
┌──────────────────────────────────────────────────────────┐
│                  面试准备（一站式）                          │
│                                                           │
│  📄 简历状态 + 📋 JD 状态 → 🎯 一键出题 → 📝 逐题练习     │
│                                                           │
│  用户只看一个页面，完成：                                    │
│  1. 确认简历已上传 ✅                                       │
│  2. 确认 JD 已分析 ✅                                       │
│  3. 点击按钮 → 5 道针对性面试题                             │
│  4. 展开看答案 → 收藏到错题本                              │
│  5. 不满意点"换一批"                                       │
└──────────────────────────────────────────────────────────┘
```

### 1.2 三优先出题策略（重申）

```
优先级 1：简历技术栈深度题
  简历写 Vue → 出响应式原理/依赖收集/diff 算法
  简历写 SSE → 出流式渲染/ReadableStream/断线重连

优先级 2：JD 有但简历弱的技术
  JD 要求 T ypeScript 但简历少 → 出 TS 类型题
  JD 要求 Node.js 但简历没有 → 出 Node 基础题

优先级 3：基础底线题（不超过 30%）
  闭包/Event Loop/CSS 盒模型
```

### 1.3 和模拟面试的区别

```
模拟面试（/interview/mock）：
  AI 主动提问 → 用户实时回答 → 逐轮对话 → 完整评分
  耗时 10-20 分钟，模拟真实场景

面试准备（/interview/prep）：
  一键生成题目列表 → 自测 → 收藏错题
  耗时 3-5 分钟，快速摸底
```

---

## 二、架构设计

### 2.1 页面结构

```
/interview/prep
│
├── 状态概览（3 卡片）
│   ├── 简历状态（已上传？技能数？）
│   ├── JD 状态（已分析？匹配度？）
│   └── 已收藏数
│
├── 生成按钮
│   └── 调用 POST /api/interview/generate-questions
│
└── 题目列表（可展开）
    ├── 题目头（难度 + 分类 + 标签）
    ├── 标准答案 ✅
    ├── 答题技巧 💡
    └── 操作按钮 → 加入错题本
```

### 2.2 数据流

```
用户点击"一键生成面试题"
       │
       ▼
前端从 store 取 resume + jdAnalysis
       │
       ▼
POST /api/interview/generate-questions
{
  "resume": { ... },        // 简历完整数据
  "jdAnalysis": { ... },    // JD 分析结果
  "count": 5                // 生成 5 道
}
       │
       ▼
question-generator.ts (buildCandidateContext)
  → 拼接简历信息 + JD 信息 + AI 分析结果
  → 构建出题 Prompt
  → 调用 DeepSeek（三优先策略）
       │
       ▼
返回 Question[]（题目 + 答案 + 技巧 + 标签）
       │
       ▼
前端展示 → 用户展开看答案 → 收藏到错题本
```

### 2.3 收藏到错题本

用户点击"加入错题本"时，调用 `addErrorEntry()`：

```typescript
addErrorEntry({
  questionContent: q.content,
  correctAnswer: q.expectedAnswer,
  yourAnswer: "",
  mistakeType: "depth",
  company: jd?.company || "AI 出题",
  tags: q.tags,
  mastery: 0,
  reviewCount: 0,
});
```

自动进入错题体系，和复盘导入的错题在同一套掌握度追踪中。

---

## 三、代码实现详解

### 3.1 前端页面

```typescript
// src/app/interview/prep/page.tsx

// 核心状态
const [questions, setQuestions] = useState<Question[]>([]);
const [generating, setGenerating] = useState(false);
const [expandedId, setExpandedId] = useState<string | null>(null);
const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

// 生成面试题
const handleGenerate = async () => {
  const response = await fetch("/api/interview/generate-questions", {
    method: "POST",
    body: JSON.stringify({
      resume,           // 从 store 取
      jdAnalysis: jd?.analysis,  // 从 store 取
      count: 5,
    }),
  });
  const result = await response.json();
  setQuestions(result.questions || []);
};

// 收藏到错题本
const handleSaveToErrorBook = (q: Question) => {
  addErrorEntry({
    questionContent: q.content,
    correctAnswer: q.expectedAnswer,
    tags: q.tags,
    mastery: 0,
    reviewCount: 0,
    // ...
  });
  savedIds.add(q.id);  // 标记已收藏
};
```

### 3.2 题目展开/收起

每道题默认收起，点击展开：

```
┌──────────────────────────────────────────┐
│  #1  🔴高级  React                        │
│  你在 Legion Zone 项目中用了 CopilotKit， │
│  能讲讲它和直接调 DeepSeek API 的区别吗？ │
│  [标签1] [标签2]                          │
├──────────────────────────────────────────┤
│  (展开后)                                 │
│  ✅ 标准答案要点                          │
│  CopilotKit 是封装层...                   │
│                                          │
│  💡 答题技巧                             │
│  · 从封装层角度回答                      │
│  · 对比直接调用的优缺点                  │
│                                          │
│  [📌 加入错题本]  ✅ 已添加到错题本      │
└──────────────────────────────────────────┘
```

---

## 四、实际业务场景

### 场景 1：刚上传简历，快速摸底

```
用户操作：
1. 上传简历 → JD 还没分析
2. 去"面试准备"页面
3. 看到状态：简历已上传  ✅  JD 未分析
4. 点击"一键生成面试题"
5. AI 基于简历技能直接出 5 道题
6. 发现 2 道不会 → 展开看答案 → 收藏到错题本
```

### 场景 2：准备某家公司面试

```
用户操作：
1. 已上传简历
2. 去 JD 分析页面粘贴目标公司 JD
3. 去"面试准备"页面
4. 状态：简历 ✅  JD ✅（匹配度 72%）
5. 点击生成 → 5 道题包含：
   - 2 道简历深度题（SSE 流式、React Hooks）
   - 2 道 JD 差距题（Node.js、TypeScript）
   - 1 道基础题
6. 不会的收藏 → 背完 → 换一批再测
```

### 场景 3：面试前快速复习

```
用户操作：
1. 明天面试，晚上打开系统
2. 去"面试准备"→ 点击"换一批"
3. 刷 3 批共 15 道题
4. 不会的临阵收藏
5. 去"错题本"再过一遍
```

---

## 五、面试常见问题

### Q1: 生成的面试题含金量高吗？

> 取决于简历和 JD 的质量。简历越详细、JD 越完整，生成的题越精准。
> 系统使用**三优先策略**：优先考察简历中提到的技术深度，
> 其次覆盖 JD 要求的技能，基础题不超过 30%。
> 
> 实测：一份写了"SSE 流式渲染"的简历，生成的题不会是
> "什么是 SSE"，而是"ReadableStream 怎么处理跨 chunk 的 UTF-8 字符？"

### Q2: 和市面上刷题 App 有什么区别？

> 市面刷题 App 是"通用题库"——所有人刷一样的题。
> 这个系统是**基于你的简历出题**：
> - 你写 Vue → 出 Vue 响应式
> - 你写 SSE → 出 SSE 流式
> - 你想面某家公司 → 贴 JD → AI 针对岗位出题
>
> 每一道题都跟你有关，不做无用功。

### Q3: 错题本和复盘导入的错题是同一套吗？

> 是的。错题本只有一个数据源。
> 无论来自"面试准备"收藏，还是来自"复盘导入"自动提取，
> 都进入同一套掌握度追踪体系。
> 
> 你可以在错题本中统一查看所有错题、统一管理掌握度。

---

## 六、新增文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/app/interview/prep/page.tsx` | 🆕 新增 | 面试准备页面（一键出题 + 展开答案 + 收藏） |
| `src/components/interview/layout/interview-sidebar.tsx` | 🔄 修改 | 新增「面试准备」菜单项 |

---

> **上一篇:** [用户认证系统](11-auth-system.md)
> **回到开头:** [架构设计](01-architecture.md)
