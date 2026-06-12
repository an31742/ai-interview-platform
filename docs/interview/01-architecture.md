# AI智能面试训练平台 · 整体架构设计

> **Step 1/8** | 目的：先画蓝图再动手，每一步都有据可依
>
> 面试官常问：*"这个项目的架构你是怎么设计的？为什么这么分层？"*
> 读完这篇，你能给出有深度的回答。

---

## 一、原理：面试平台的本质

### 1.1 业务本质

面试训练平台不是"聊天机器人"，它的核心是 **三个闭环**：

```
┌─────────────────────────────────────────────────────────────┐
│                    面试能力提升闭环                            │
│                                                             │
│  输入层                    处理层                    输出层   │
│  ┌──────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │简历  │───→│ AI分析短板        │───→│ 生成专属面试题    │  │
│  └──────┘    └──────────────────┘    └──────────────────┘  │
│                                         │                   │
│  ┌──────┐    ┌──────────────────┐       │                   │
│  │JD    │───→│ AI匹配考点       │───→模拟面试 ←────────────┘  │
│  └──────┘    └──────────────────┘       │                   │
│                                         ▼                   │
│  ┌──────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │复盘  │───→│ AI提取错题       │───→│ 错题集 + 背诵计划 │  │
│  └──────┘    └──────────────────┘    └──────────────────┘  │
│                                         │                   │
│                                         └──────再练─────────┘
└─────────────────────────────────────────────────────────────┘
```

### 1.2 技术本质

从技术上，这是一个 **RAG + Multi-Agent + 流式渲染** 的组合：

| 组件 | 技术 | 解决什么问题 |
|------|------|------------|
| **RAG** | ChromaDB + Embeddings | 让AI"记住"你的简历和复盘内容 |
| **Multi-Agent** | LangGraph + StateGraph | 不同角色（面试官/评分员/出题人）协作 |
| **流式渲染** | SSE + ReadableStream | 模拟面试实时对话，逐字输出 |

### 1.3 和普通Chat的区别

| 维度 | 普通Chat | 面试训练平台 |
|------|---------|------------|
| 对话驱动 | 用户问AI答 | AI主导追问，有预设流程 |
| 上下文 | 当前对话 | 简历+JD+历史面试记录+RAG知识库 |
| 状态管理 | 无状态 | 多轮面试状态机（Node间条件路由） |
| 输出结构 | 自由文本 | 结构化评分+报告 |
| 多角色 | 单一AI | 面试官、出题人、评分员、复盘分析师 |

---

## 二、架构设计

### 2.1 导航架构

```
┌─────────────────────────────────────────────────────────────────────┐
│  顶部导航栏 (Navbar)                                                 │
│  [聊天] [Playground] [RAG知识库] [Agent] [面试]                      │
│  ── 全局统一导航，所有模块共用 ──                                     │
├──────────┬──────────────────────────────────────────────────────────┤
│          │                                                          │
│  左侧菜单  │  内容区                                                  │
│  (220px)  │                                                          │
│          │                                                          │
│  [仪表盘]  │                                                          │
│  [简历管理] │                                                          │
│  [JD分析]  │                                                          │
│  [模拟面试]  │                                                          │
│  [错题本]   │                                                          │
│  [复盘导入] │                                                          │
│          │                                                          │
└──────────┴──────────────────────────────────────────────────────────┘
```

**为什么这么设计？**
- 保持与 Chat/Playground/RAG/Agent 一致的导航体验
- 面试模块内部子页面多（6个），用二级tab栏替代侧边栏，视觉更轻量
- 和原项目融为一体，面试官看到知道是同一个项目的扩展

### 2.2 四层架构

```
┌─────────────────────────────────────────────────────────────────┐
│  🖥️ 表示层 (Presentation Layer)                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Next.js App Router（8个核心页面）                          │  │
│  │ 首页 → 简历管理 → AI模拟面试 → 复盘导入 → 错题集 → 报告   │  │
│  └──────────────────────────────────────────────────────────┘  │
│  Server Components + Client Components 混合渲染                 │
├─────────────────────────────────────────────────────────────────┤
│  🧠 AI编排层 (Orchestration Layer)                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │简历分析  │ │面试出题  │ │模拟面试官│ │复盘分析          │  │
│  │Agent     │ │Agent     │ │Agent     │ │Agent             │  │
│  │(分析短板)│ │(生成考题)│ │(追问评分)│ │(提取错题)        │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
│         ↕ LangGraph StateGraph + Tool Calling                   │
├─────────────────────────────────────────────────────────────────┤
│  💾 数据层 (Data Layer)                                         │
│  ┌────────────────┐ ┌────────────────┐ ┌──────────────────┐  │
│  │ ChromaDB (RAG)  │ │ Zustand Store  │ │ localStorage/    │  │
│  │ 简历知识库      │ │ 面试会话状态   │ │ IndexedDB        │  │
│  │ 复盘知识库      │ │ 用户设置       │ │ 离线缓存         │  │
│  └────────────────┘ └────────────────┘ └──────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  🔧 基础设施层 (Infrastructure Layer)                            │
│  ┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │ DeepSeek API     │ │ MCP Server   │ │ SSE Streaming    │  │
│  │ (通义千问备选)   │ │ (工具扩展)    │ │ (流式传输)       │  │
│  └──────────────────┘ └──────────────┘ └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 为什么这么分层？

**单层职责原则：**

| 层 | 如果删掉这层会怎样？ |
|------|------------------|
| 表示层 | 用户看不到界面，但API和AI还能跑 |
| AI编排层 | 系统变成哑巴——有数据但不会分析、不会追问、不会评分 |
| 数据层 | AI没有记忆，每次都是全新对话，不知道你简历写了什么 |
| 基础设施层 | 没有模型调用能力，没有流式输出，没有外部工具 |

面试官追问 *"为什么不分两层或五层？"* → **因为每层的变更原因不同**：
- UI变化（改样式）→ 只动表示层
- AI逻辑变化（改面试流程）→ 只动编排层
- 数据源变化（从文件换数据库）→ 只动数据层
- 模型变化（DeepSeek换Claude）→ 只动基础设施层

---

## 三、路由设计

### 3.1 页面路由表

| 路由 | 页面 | 类型 | 说明 |
|------|------|------|------|
| `/` | 首页 | Server | 平台介绍 + 快捷入口 |
| `/interview` | 面试平台首页 | Server | 仪表盘：最近面试/待练题目/学习进度 |
| `/interview/resume` | 简历管理 | Client | 上传/查看/删除简历 |
| `/interview/resume/analysis` | 简历分析报告 | Client | AI分析结果展示 |
| `/interview/jd` | JD管理 | Client | 输入/粘贴JD |
| `/interview/jd/analysis` | JD分析报告 | Client | 岗位匹配度分析 |
| `/interview/mock` | 模拟面试 | Client | AI模拟面试对话页（核心） |
| `/interview/mock/[id]/report` | 面试报告 | Client | 评分 + 逐题分析 |
| `/interview/questions` | 面试题库 | Mixed | 历史面试题列表 |
| `/interview/review` | 复盘导入 | Client | 导入复盘文档/录音文件 |
| `/interview/review/error-collection` | 错题集 | Client | 错题 + 标准答案 + 背诵 |

### 3.2 路由设计原则

```
路由 = 资源路径
/interview/resume          → 简历资源
/interview/resume/analysis → 简历的分析结果（子资源）
/interview/mock/[id]       → 某次模拟面试
/interview/mock/[id]/report→ 某次面试的报告
```

**为什么不用 query 参数？** 比如 `/interview?page=mock&id=xxx`
- ❌ 不利于SEO（但不是核心问题）
- ✅ 关键是：URL即状态。刷新页面/分享链接都能恢复位置
- ✅ 便于Next.js的layout嵌套缓存

### 3.3 导航结构

面试平台采用 **两级导航**，与其他模块一致：

```
┌──────────────────────────────────────────────────────────────┐
│  顶部 Navbar (全局模块切换)                                   │
│  [聊天] [Playground] [RAG 知识库] [Agent] [面试]              │
├──────────┬───────────────────────────────────────────────────┤
│          │  内容区                                            │
│  左侧菜单 │  [当前子页面内容]                                   │
│  (220px)  │                                                    │
│          │                                                    │
│  [仪表盘] │                                                    │
│  [简历]   │                                                    │
│  [JD]    │                                                    │
│  [模拟面试]│                                                    │
│  [错题本] │                                                    │
│  [复盘]   │                                                    │
│          │                                                    │
└──────────┴───────────────────────────────────────────────────┘
```

**为什么用左侧菜单而不是水平tab？**

| 方案 | 问题 |
|------|------|
| 水平tab栏 | 和 Chat 模块的布局不一致（Chat左侧是会话列表） |
| **左侧菜单** | 与 Chat/RAG/Playground 布局模式一致，视觉统一 |

路由结构：
```
app/
├── layout.tsx               ← 全局Layout
├── page.tsx                 ← / → 重定向到 /chat
│
├── interview/               ← 🆕 面试平台
│   ├── layout.tsx           ← Navbar + Sidebar + children
│   ├── page.tsx             ← 仪表盘
│   ├── resume/ ...
│   ├── jd/ ...
│   ├── mock/ ...
│   ├── questions/
│   └── review/ ...
│
├── chat/                    ← 🟢 原有
├── playground/              ← 🟢 原有
├── rag/                     ← 🟢 原有
└── agent/                   ← 🟢 原有
```

---

## 四、核心数据模型

### 4.1 简历 (Resume)

```typescript
interface Resume {
  id: string
  fileName: string
  uploadTime: number
  status: 'uploading' | 'analyzing' | 'ready' | 'error'
  
  // 解析后结构化数据
  parsed?: {
    name: string
    title: string          // 求职岗位
    yearsOfExperience: number
    skills: string[]       // 技术栈列表
    experience: Array<{
      company: string
      role: string
      period: string
      description: string
      highlights: string[] // 项目亮点
    }>
    education: string[]
    projects: Array<{
      name: string
      techStack: string[]
      description: string
    }>
  }
  
  // AI 分析结果
  analysis?: {
    strengths: string[]
    weaknesses: string[]
    suggestedFocus: string[] // 面试准备重点
    confidence: number      // 匹配度
  }
}
```

### 4.2 模拟面试 (InterviewSession)

```typescript
interface InterviewSession {
  id: string
  status: 'preparing' | 'in-progress' | 'completed' | 'cancelled'
  
  // 关联数据
  resumeId?: string
  jdContent?: string        // 岗位描述
  
  // 面试配置
  mode: 'tech' | 'hr' | 'mixed'
  difficulty: 'junior' | 'mid' | 'senior'
  duration: number          // 预计时长（分钟）
  
  // 面试过程
  messages: InterviewMessage[]
  currentPhase: 'self-intro' | 'project-deep-dive' | 'fundamentals' | 'system-design' | 'qa'
  
  // 评分结果
  score?: InterviewScore
  createdAt: number
  completedAt?: number
}

interface InterviewMessage {
  id: string
  role: 'ai' | 'user'
  content: string
  type: 'question' | 'answer' | 'feedback' | 'system'
  phase?: string            // 所属阶段
  score?: number            // AI对该回答的即时评分
  evaluation?: string       // 评语
}
```

### 4.3 面试评分 (InterviewScore)

```typescript
interface InterviewScore {
  overall: number              // 总分 0-100
  dimensions: {
    fundamentals: number       // 基础 30%
    projectDepth: number       // 项目深度 25%
    systemDesign: number       // 系统设计 20%
    expression: number         // 表达 15%
    aiCapability: number       // AI能力 10%
  }
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]        // 改进建议
  // 逐题分析
  questionScores: Array<{
    questionId: string
    score: number
    comment: string
    goodPoint: string
    badPoint: string
    sampleAnswer: string       // 标准答案示范
  }>
  expressionIssues?: {
    fillerWords: string[]     // 出现过的口头禅
    tensionLevel: 'calm' | 'moderate' | 'nervous'
    advice: string
  }
}
```

### 4.4 复盘数据 (InterviewReview)

```typescript
interface InterviewReview {
  id: string
  company: string
  position: string
  date: string
  result: 'pass' | 'fail' | 'pending'
  
  // 从复盘数据提取
  questions: ReviewQuestion[]
  weaknessTags: string[]      // 暴露的短板标签
  
  // AI 分析
  summary?: string
  actionItems?: string[]
}

interface ReviewQuestion {
  original: string            // 面试官原题
  yourAnswer: string          // 你的回答（录音转写）
  score: number               // 评分
  correctAnswer: string       // 正确答案
  mistakeType: 'concept-error' | 'expression' | 'depth' | 'structure'
  prepStructure?: {           // PREP 练习
    point: string
    reason: string
    example: string
    restate: string
  }
}
```

---

## 五、Agent 架构设计

### 5.1 多Agent协作图

```
┌──────────────────────────────────────────────────────────────────┐
│                       用户请求进入                                  │
└──────┬───────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Router Agent（路由调度）                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ 简历分析请求  │ │ 模拟面试请求  │ │ 复盘导入请求  │             │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘             │
│         │                │                │                      │
│         ▼                ▼                ▼                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ResumeAnalyzer│ │ Interviewer  │ │ReviewAnalyzer│             │
│  │   Agent      │ │   Agent      │ │   Agent      │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
│                           │                                     │
│                           ▼                                     │
│                    ┌──────────────┐                              │
│                    │   Scorer     │                              │
│                    │   Agent      │                              │
│                    └──────────────┘                              │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Interviewer Agent（核心）状态图

这是模拟面试官的核心流程，使用 LangGraph StateGraph：

```
                  ┌──────────┐
                  │  START   │
                  └────┬─────┘
                       │
                       ▼
              ┌────────────────┐
              │  自我介绍阶段    │
              │  (不打断,听完)  │
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │  项目深挖阶段    │
              │  追问2-3个项目  │ ◄──── 条件路由：追问逻辑
              │  层层递进       │
              └───────┬────────┘       追问完 → 下一阶段
                      │                答不上 → 换话题
                      ▼                 表现好 → 继续深挖
              ┌────────────────┐
              │  基础考察阶段    │
              │  Vue/React/JS  │ ◄──── 根据简历技术栈动态出题
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │  系统设计阶段    │
              │  (senior模式)   │
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │  反问环节       │
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │  评分总结       │
              │  Scorer Agent  │
              └────────────────┘
```

### 5.3 为什么用 LangGraph 而不是普通 Chain？

| 方式 | 问题 |
|------|------|
| 普通Chain | 线性执行，不能根据回答动态决定下一步 |
| LangGraph StateGraph | **条件路由**：答得好继续追问，答不上换方向 |

**实战场景：**
> 用户回答"Vue响应式原理"很好 → 继续追问依赖收集
> 用户回答CSS盒模型很差 → 不继续追问，切换话题
> **LangGraph 的 condition 函数** 根据评分动态路由

---

## 六、整体数据流

### 简历分析流程

```
用户上传PDF
     │
     ▼
PDF解析 (pdf-parse) → 提取文本
     │
     ▼
文本分段 (TextSplitter) → 嵌入向量 (Embeddings)
     │                    └─→ 存入 ChromaDB (简历知识库)
     ▼
ResumeAnalyzer Agent 调用 DeepSeek
     │
     ├─ 提取结构化信息 (姓名/技能/项目/经历)
     ├─ 分析优劣势
     └─ 生成面试重点建议
     │
     ▼
结构化结果 → 存入 Zustand → 展示分析报告
```

### 模拟面试数据流

```
用户点击"开始面试"
     │
     ▼
创建 InterviewSession
     │
     ├─ 加载简历分析结果 → 构建 System Prompt
     ├─ 加载JD (如果有)  → 构建考点列表
     └─ 初始化 LangGraph StateGraph
     │
     ▼
一轮对话:
    用户回答 → 提交 /api/interview/chat
         │
         ▼
    Agent 评估回答 → 更新 State
         │
         ├─ 评分 (Scorer Tool)
         ├─ 决定下一步 (条件路由)
         │   ├─ 追问 → 生成下一题 → SSE流式返回
         │   ├─ 切换阶段 → 生成阶段过渡语
         │   └─ 结束面试 → 调用 Report Generator
         │
         ▼
    SSE流式返回 → 前端逐字渲染
```

---

## 七、目录结构（实际代码）

```
src/
├── app/
│   ├── layout.tsx                          ← 全局Layout
│   ├── page.tsx                            ← 首页 → 引导到 /interview
│   │
│   ├── interview/                          ← 🆕 面试平台
│   │   ├── layout.tsx                      ← 面试Layout（侧边导航）
│   │   ├── page.tsx                        ← 仪表盘
│   │   │
│   │   ├── resume/
│   │   │   ├── page.tsx                    ← 简历管理
│   │   │   └── analysis/
│   │   │       └── page.tsx                ← 分析报告
│   │   │
│   │   ├── jd/
│   │   │   ├── page.tsx                    ← JD输入
│   │   │   └── analysis/
│   │   │       └── page.tsx                ← JD匹配分析
│   │   │
│   │   ├── mock/
│   │   │   ├── page.tsx                    ← 新建模拟面试配置
│   │   │   └── [id]/
│   │   │       ├── page.tsx                ← 面试对话页 ★核心
│   │   │       └── report/
│   │   │           └── page.tsx            ← 面试报告
│   │   │
│   │   ├── questions/
│   │   │   └── page.tsx                    ← 面试题库
│   │   │
│   │   └── review/
│   │       └── page.tsx                    ← 复盘导入
│   │
│   ├── chat/                               ← 🟢 原有不动
│   ├── api/
│   │   ├── chat/route.ts                   ← 🟢 原有不动
│   │   │
│   │   └── interview/                      ← 🆕 面试API
│   │       ├── chat/route.ts               ← 模拟面试对话API (SSE)
│   │       ├── analyze-resume/route.ts     ← 简历分析API
│   │       ├── analyze-jd/route.ts         ← JD分析API
│   │       └── generate-report/route.ts    ← 面试报告API
│
├── components/
│   ├── ui/                                 ← 🟢 shadcn/ui组件
│   │
│   └── interview/                          ← 🆕 面试组件
│       ├── layout/
│       │   ├── interview-sidebar.tsx        ← 侧边导航
│       │   └── interview-header.tsx         ← 顶部导航
│       ├── resume/
│       │   ├── resume-uploader.tsx          ← 文件上传
│       │   ├── resume-card.tsx              ← 简历卡片
│       │   └── resume-analysis-view.tsx     ← 分析报告展示
│       ├── mock/
│       │   ├── interview-chat.tsx           ← 面试对话
│       │   ├── interview-message.tsx        ← 单条消息
│       │   ├── interview-timer.tsx          ← 计时器
│       │   ├── phase-indicator.tsx          ← 阶段指示器
│       │   └── typing-indicator.tsx         ← AI打字指示
│       └── report/
│           ├── score-radar.tsx              ← 雷达图
│           ├── score-overview.tsx           ← 总分概览
│           └── question-analysis.tsx        ← 逐题分析
│
├── lib/
│   ├── interview/                          ← 🆕 面试AI逻辑
│   │   ├── agents/
│   │   │   ├── resume-analyzer.ts          ← 简历分析Agent
│   │   │   ├── interviewer.ts              ← 面试官Agent (LangGraph)
│   │   │   ├── question-generator.ts       ← 出题Agent
│   │   │   └── scorer.ts                   ← 评分Agent
│   │   ├── prompts/
│   │   │   ├── resume-analysis.ts          ← 简历分析提示词
│   │   │   ├── interviewer.ts              ← 面试官提示词
│   │   │   └── scorer.ts                   ← 评分提示词
│   │   └── graphs/
│   │       └── interview-graph.ts           ← LangGraph 状态图
│   │
│   ├── deepseek.ts                         ← 🟢 原有 (改造成支持多Agent)
│   └── utils.ts                            ← 🟢 原有
│
├── store/
│   ├── chat-store.ts                       ← 🟢 原有
│   └── interview-store.ts                  ← 🆕 面试状态管理
│
├── types/
│   ├── chat.ts                             ← 🟢 原有
│   └── interview.ts                        ← 🆕 面试类型
│
└── services/
    ├── storage.ts                          ← 🟢 原有
    └── interview-storage.ts                ← 🆕 面试数据持久化
```

---

## 八、技术选型问答（面试用）

### Q1: 为什么用 LangGraph 而不是普通 API 调用？

**深度回答：**
> 普通 API 调用是"请求-响应"模式，适合单次问答。但模拟面试需要**状态管理**和**条件路由**。
>
> LangGraph 的 StateGraph 维护了一个面试状态机，包含当前阶段、已问问题、用户表现评分。
> 核心是 condition 函数：当用户回答正确时，路由到"深入追问"节点；回答错误时，路由到"换题"节点。
>
> 如果不用 LangGraph，我得自己维护状态机，那就是在重复造轮子——而且面试官期待你提到 LangGraph。

### Q2: 为什么不用 WebSocket 而用 SSE？

> 模拟面试是"AI → 用户"的单向流式输出为主（AI在说话），SSE 天然适合。
> 用户回答是一次性提交（不是流式的），不需要全双工。
> SSE 更轻量、兼容性好、自带断线重连。

### Q3: 简历分析为什么要用 RAG？

> RAG 解决两个问题：
> 1. **长期记忆** — 下次面试时 AI 还记得你的简历内容，不用重复上传
> 2. **检索增强** — 面试官 Agent 可以从知识库中检索相关经历来追问
>
> 没有 RAG，AI 在面试过程中"失忆"——这是面试训练平台不能接受的。

### Q4: 这个架构如果让你重来一次，哪里会改？

> 如果重来，我会在**第一天就把 Agent 抽象层设计好**。目前 ResumeAnalyzer、Interviewer、Scorer 三个 Agent 有部分代码重复（调用DeepSeek、解析JSON输出），可以提取一个 BaseAgent 抽象类。
>
> 但这不影响功能，属于"v2 重构项"。

---

## 九、现在开始搭建（Step 1 产出物）

按照本文架构，第一步的实际产出：

1. ✅ **本文档** — 架构设计原理
2. ✅ **目录结构** — 已设计完
3. 👉 **创建实际目录和文件** — 下一步执行
4. **路由配置** — 安装 Next.js 路由
5. **类型定义** — 核心数据模型代码化

---

> **下一篇:** [02-简历上传与解析](02-resume-upload.md)
>
> 将覆盖：PDF解析原理 → 文件上传组件 → RAG入库 → 简历列表管理
