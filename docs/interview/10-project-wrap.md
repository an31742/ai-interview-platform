# Step 7：项目包装 + 面试准备

> **本文覆盖：** 项目介绍话术 → 架构图 → 博客输出 → 简历亮点
> **对应学习计划：** Day78-84（项目包装 + 面试准备）

---

## 一、项目介绍（面试用）

### 1.1 一句话介绍

> **"这是一个基于 Next.js + DeepSeek 的 AI 智能面试训练平台。
> 上传简历后，AI 自动分析技术短板，然后进行多轮模拟面试，
> 结束后生成评分报告和错题本，形成面试准备的完整闭环。"**

### 1.2 PREP 结构（30秒版）

| 步骤 | 内容 |
|------|------|
| **P**oint | 我独立开发了一个 AI 面试训练平台，解决求职者面试准备效率低的问题 |
| **R**eason | 市面上没有免费的、针对个人简历定制化出题的面试工具 |
| **E**xample | 上传简历 → AI 分析 → 模拟面试 → 评分 → 错题追踪 |
| **P**oint | 核心价值：让每一道面试题都跟你的简历有关，不做无用功 |

### 1.3 完整话术（1分钟版）

> **🎤 面试逐字稿：**
>
> "这个项目叫 AI 智能面试训练平台，是我为**简历核心项目**开发的。
>
> 核心流程是：用户上传 PDF 简历 → pdfjs-dist 解析文本 →
> DeepSeek 提取结构化信息（技术栈、项目经历、工作年限）→
> AI 分析出技术短板 → 进入模拟面试环节。
>
> 模拟面试用 **LangGraph 状态图**管理面试流程。
> AI 面试官根据回答动态决定继续追问还是切换话题。
> 面试结束后从五个维度评分，生成详细报告。
>
> 还有一个**复盘导入**功能：把真实面试记录粘贴进去，
> AI 自动提取错题到错题本，追踪掌握度。
>
> 技术栈：Next.js 16 + React 19 + TypeScript，
> AI 部分用 LangChain + LangGraph，RAG 用 ChromaDB，
> 状态管理用 Zustand。当前 V1 数据存在 localStorage，
> 后续计划接入 PostgreSQL 和 Redis。"

---

## 二、技术选型问答

### Q1: 为什么用 Next.js 而不是纯 React SPA？

```
┌───────────────────────────────────────────────────────────┐
│  SPA (Create React App)      vs     Next.js App Router    │
├───────────────────────────────────────────────────────────┤
│  需要独立后端 (Express)            一体化的前后端           │
│  手动管理路由                      文件即路由              │
│  API 需要独立部署                  API Routes 同项目部署   │
│  SSR 需要额外配置                  原生支持 SSR/SSG        │
│  Streaming 需要手写                SSE 流式输出原生友好    │
│  部署到 Vercel 需要适配             一键部署 Vercel         │
└───────────────────────────────────────────────────────────┘
```

**面试回答：**
> "选 Next.js 是因为需要同时管理前端页面和 AI API 路由。
> App Router 让我把 /interview/mock 和 /api/interview/chat
> 放在同一个项目里，部署也只需要一个平台。
> 而且 SSE 流式输出在 Next.js 的 Streaming 支持下很方便。"

### Q2: 为什么用 DeepSeek 而不是 GPT-4/Claude？

| 模型 | 价格 (1M Token) | 中文能力 |
|------|----------------|---------|
| DeepSeek | ¥1 输入 / ¥2 输出 | ✅✅ 最强中文模型之一 |
| GPT-4o | $2.5 输入 / $10 输出 | ✅ 好 |
| Claude Sonnet | $3 输入 / $15 输出 | ✅ 好 |

**面试回答：**
> "三个原因：
> 1. **成本** — 价格是 GPT-4o 的 1/10，个人项目成本可控
> 2. **中文能力** — 面试场景需要中文问答，DeepSeek 表现好
> 3. **兼容 OpenAI SDK** — 换 Claude/GPT 只需改 baseUrl"

### Q3: 为什么用 Zustand 而不是 Redux/Context？

```typescript
// Zustand 精确订阅，流式场景零额外重渲染
const content = useInterviewStore(s => s.streamingContent)
// 只有 streamingContent 变化才重渲染

// ❌ Context: 任何状态变化都重渲染整个子树
// ❌ Redux: 样板代码太多，不适合这个规模
```

### Q4: 为什么用 LangGraph 而不是手写状态机？

> "模拟面试不像普通聊天，AI 需要根据回答动态决定下一步。
> LangGraph 的 StateGraph 提供了**条件路由**机制：
> - Node（阶段）：自我介绍 → 项目深挖 → 基础考察 → ...
> - Edge（条件）：评分 >= 7 → 继续追问；评分 < 4 → 切换阶段
>
> 没有 LangGraph，需要手写状态机——代码会变得很复杂。"

---

## 三、项目架构图

### 3.1 整体架构

```
┌═══════════════════════════════════════════════════════════┐
║                    🖥️  表示层                              ║
║  Next.js App Router | React 19 | TailwindCSS | shadcn/ui │
║  页面: 仪表盘 / 简历 / JD / 模拟面试 / 错题本 / 复盘       │
╚═══════════════════════════════════════════════════════════╝
                           │
                           ▼
┌═══════════════════════════════════════════════════════════┐
║                   🧠  AI 编排层                            ║
║  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  ║
║  │Resume    │ │JD        │ │Interview │ │Review     │  ║
║  │Analyzer  │ │Analyzer  │ │Agent     │ │Analyzer   │  ║
║  │Agent     │ │Agent     │ │(LangGraph│ │Agent      │  ║
║  │          │ │          │ │ 状态图)  │ │           │  ║
║  └──────────┘ └──────────┘ └──────────┘ └───────────┘  ║
║                     ↕  DeepSeek API                      ║
╚═══════════════════════════════════════════════════════════╝
                           │
                           ▼
┌═══════════════════════════════════════════════════════════┐
║                   💾  数据层                               ║
║  Zustand + persist (localStorage) | ChromaDB (RAG 向量库) │
╚═══════════════════════════════════════════════════════════╝
```

### 3.2 Agent 体系

```
5 个 AI Agent，各司其职：

ResumeAnalyzer   负责：PDF解析 → 结构化提取 → 优劣势分析
JDAnalyzer      负责：JD提取 → 简历匹配 → 面试重点
Interviewer     负责：状态机 → 条件路由 → 动态追问（LangGraph）
Scorer          负责：五维评分 → 逐题分析 → 改进建议
ReviewAnalyzer  负责：复盘分析 → 错题提取 → 掌握度追踪
```

### 3.3 LangGraph 状态图

```
每轮对话执行：

START
  │
  ▼
evaluateAnswer  ← 评估用户回答，打分（DeepSeek）
  │
  ▼
decideNext      ← 条件路由：继续/深入/换题/切阶段/结束
  │
  ▼
generateResponse ← 生成 AI 的下一轮提问（SSE 流式）
  │
  END

条件路由逻辑：
  评分 >= 7 且 >= 3 题 → 切下一阶段
  评分 >= 7 且 < 3 题  → 继续深入追问
  评分 4-6              → 换个角度
  评分 < 4              → 切阶段（不浪费时间）
```

---

## 四、核心功能清单

| 功能 | 技术实现 | 面试亮点 |
|------|---------|---------|
| **简历上传** | pdfjs-dist + DeepSeek JSON Mode | PDF 解析排错经验 |
| **AI 分析** | 两阶段 Agent + Prompt 工程 | 温度控制 + 两步优于一次 |
| **JD 匹配** | 技能提取 + 余弦匹配 | 面试重点排序 |
| **模拟面试** | LangGraph 状态机 | 条件路由 |
| **SSE 流式** | ReadableStream + 逐字输出 | 打字机效果 + rAF 节流 |
| **评分报告** | 五维模型 + Scorer Agent | 多维度评估 |
| **复盘导入** | 自由文本识别 + 自动入错题 | 差异化功能 |
| **错题本** | 5 级掌握度 + progress bar | 可视化追踪 |
| **用户认证** | JWT + PBKDF2 + Proxy 路由保护 | 项目完整性 |
| **仪表盘** | 真实数据统计 + 最近活动 | 全局概览 |

---

## 五、面试亮点 STAR 故事

### 故事 1：SSE 流式渲染（展示性能优化能力）

```
S（背景）：模拟面试需要 AI 逐字输出，持续 SSE 推送频繁更新 DOM
T（任务）：保证 60fps 流畅渲染
A（行动）：
  1. requestAnimationFrame 合并渲染周期
  2. 增量 DOM diff，只更新变化部分
  3. ScrollAnchor：AI 输出时自动滚动，用户翻看时不强制
R（结果）：低端设备也不卡顿
```

### 故事 2：LangGraph 条件路由（展示架构能力）

```
S（背景）：初期面试是固定顺序问完所有题
T（任务）：让 AI 像真人一样动态调整
A（行动）：引入 LangGraph StateGraph
  - 5 个 Node + conditional_edges
  - 评分驱动：答得好深入，答得差换题
R（结果）：面试体验大幅提升，不再是流水线
```

### 故事 3：复盘导入（展示产品思维）

```
S（背景）：市面 AI 面试工具只能"练"不能"复盘真实面试"
T（任务）：把真实面试记录转化为学习材料
A（行动）：
  - AI 从自由文本提取结构化信息
  - 低于 7 分的题自动进错题本
  - 5 级掌握度追踪
R（结果）：形成"真实面试 → 复盘 → 不再犯"的闭环
```

---

## 六、博客输出计划

对应 12 周计划的 Day80-82：

| 博客 | 主题 | 目标平台 |
|------|------|---------|
| 博客 1 | 《从 React Fiber 到 Vue 响应式：两大框架的更新机制对比》 | 掘金 |
| 博客 2 | 《使用 LangGraph + DeepSeek 构建 AI 面试官：状态图设计与实践》 | 掘金 |
| 博客 3 | 《LangGraph 条件路由实战：让 AI 面试官学会"看人下菜碟"》 | 掘金 |

**面试时被问"你怎么学习"的回答：**
> "三层学习法：
> 1. **广度** — 官方文档系统过（Next.js / LangChain / LangGraph）
> 2. **深度** — 手写 Demo，从原生 API 到框架封装都写过
> 3. **输出** — 技术博客 + 项目文档，现在你看到的这些就是我输出的"

---

## 七、项目开发时间线

```
V1（第 8 周）:  项目骨架 + 简历管理 + 基础面试对话
                React源码 + Vue响应式基础
                Prompt工程 / Token机制 / Embedding

V2（第 9 周）:  简历分析Agent + JD分析 + 面试题生成
                LangChain ChatModel / Chain / Tool

V3（第 10 周）:  LangGraph状态机 + SSE流式 + 评分 + 复盘导入
                LangGraph StateGraph / MCP概念

V4（第 11 周）:  用户认证系统 + 仪表盘增强 + 体验优化
                 Web Crypto API / JWT / Proxy 路由保护

V5（计划中）:    PostgreSQL + Redis + 多用户 + BFF层
```

---

## 八、简历写入

### 项目描述（建议写入简历）

```
AI 智能面试训练平台 | Next.js + LangChain + DeepSeek

- 独立开发全栈 AI 面试训练平台，核心功能：简历分析 → JD匹配 → 模拟面试 → 评分报告
- 使用 LangGraph StateGraph 实现面试官状态机，支持条件路由（答得好深入、答得差换题）
- SSE 流式实现打字机效果，优化渲染性能保证 60fps 流畅体验
- 简历 RAG 入库 ChromaDB，面试时检索增强让 AI 精确引用项目细节追问
- 面试复盘 AI 自动提取错题，5 级掌握度追踪形成学习闭环
- 技术栈：Next.js 16 / React 19 / TypeScript / LangChain / ChromaDB / DeepSeek
```

### 技术标签

```
Next.js | React | TypeScript | LangChain | LangGraph | ChromaDB | 
SSE | Zustand | TailwindCSS | shadcn/ui | DeepSeek API | Prompt Engineering
```

---

## 九、README 快速索引

完整的 README 在项目根目录。用 `npm run dev` 启动后访问：

| 页面 | 地址 | 功能 |
|------|------|------|
| 仪表盘 | `/interview` | 统计卡片 + 快捷入口 |
| 简历管理 | `/interview/resume` | 上传 PDF → AI 分析 |
| JD 分析 | `/interview/jd` | 粘贴 JD → 匹配度分析 |
| 模拟面试 | `/interview/mock` | 开始面试对话 |
| 错题本 | `/interview/questions` | 掌握度追踪 |
| 复盘导入 | `/interview/review` | 导入记录 → 自动入错题 |

---

## 十、面试铁律速查

来源：13 场真实面试复盘结论。

### 绝不能说 ❌

| 原话 | 改成 |
|------|------|
| "没有挑战" | 准备 3 个 STAR 故事 |
| "我看别人的逻辑" | "虽然不是我最初写的，但通过 XX 深入理解了原理" |
| "难点不多" | 说 2-3 个具体技术挑战 |
| "在学习"（空洞） | "我最近做了 AI 面试项目，实现了 LangGraph 状态机" |
| "掘金和GPT" | "三层学习法：广度（文档）+ 深度（手写）+ 输出（博客）" |

### 必须做到 ✅

| 行为 | 原因 |
|------|------|
| 回答前**停顿 2 秒** | 想 PREP 结构，避免啰嗦 |
| 先说结论再展开 | 面试官没耐心听你绕 |
| 每个项目带 **STAR + 量化** | 证明是你做的 |
| 技术方案提 **trade-off** | 展现架构思维 |

---

## 十一、全部文档索引

```
docs/interview/
├── 01-architecture.md          ← 整体架构设计
├── 02-data-flow.md             ← 数据流文档
├── 03-architecture-diagram.md  ← 架构图 + 组件树
├── 04-interview-prep.md        ← 面试准备（话术/STAR/技术选型）
├── 05-ai-learning-plan.md      ← 8-12周AI学习计划
├── 06-resume-upload.md         ← Step 2: 简历上传+PDF解析
├── 07-jd-analysis.md           ← Step 3: JD分析+面试题生成
├── 08-mock-interview.md        ← Step 4-5: AI模拟面试官+LangGraph
├── 09-review-import.md         ← Step 6: 复盘导入+错题本
├── 10-project-wrap.md          ← Step 7: 项目包装（本文）
├── 11-auth-system.md           ← Step 8: 用户认证系统
└── 12-interview-prep.md        ← Step 9: 面试准备 — 一键出题
```

---

> **上一篇:** [复盘导入+错题本](09-review-import.md)
> **回到开头:** [架构设计](01-architecture.md)
