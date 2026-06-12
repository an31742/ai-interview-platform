# AI 智能面试训练平台

> **上传简历 → AI 分析 → 模拟面试 → 复盘提升，一站式面试准备**
> 简历核心项目 · 全栈 + AI 应用开发

---

## 📋 项目简介

AI 智能面试训练平台是一个面向求职者的面试准备工具。它利用 AI 技术，从简历分析到模拟面试再到错题追踪，形成完整的面试准备闭环。

**核心功能链：**

```
上传简历 → AI 分析短板 → 输入 JD → 匹配度分析 → AI 模拟面试 → 逐题评分 → 生成报告 → 错题本追踪
```

---

## ✨ 功能特性

### 📄 简历管理
- 拖拽上传 PDF 简历
- AI 自动提取结构化信息（技能/项目/经历）
- AI 分析优劣势、面试重点、技能缺失

### 📋 JD 分析
- 粘贴岗位描述自动提取技能要求
- 与简历做匹配度分析（匹配/差距）
- 生成面试准备重点清单

### 🎙️ AI 模拟面试
- **LangGraph 状态机驱动** — 5阶段面试流程（自我介绍→项目深挖→基础考察→系统设计→反问）
- **条件路由** — 答得好深入追问，答得差切换话题
- **SSE 流式输出** — 打字机效果实时对话
- **简历 RAG 增强** — AI 面试官能引用简历细节追问

### 📊 面试报告
- 五维评分（基础/项目深度/系统设计/表达/AI能力）
- 逐题分析 + 标准答案示范
- 优缺点和改进建议
- 表达分析（口头禅/紧张度）

### 🔄 面试复盘
- 导入面试记录/录音转写
- AI 自动提取错题到错题本
- 5 级掌握度追踪

---

## 🏗️ 技术栈

| 层级 | 技术 |
|------|------|
| **前端框架** | Next.js 16 (App Router) + React 19 |
| **类型系统** | TypeScript 5 |
| **样式** | TailwindCSS v4 + CSS Variables |
| **UI 组件** | shadcn/ui (Radix UI) |
| **状态管理** | Zustand 5 + persist |
| **AI 模型** | DeepSeek API (deepseek-chat) |
| **AI 框架** | LangChain.js + LangGraph (状态图) |
| **RAG 向量库** | ChromaDB (本地) |
| **流式传输** | SSE (Server-Sent Events) |
| **数据持久化** | localStorage (V1) → PostgreSQL (V4) |

---

## 🚀 快速开始

### 前置条件

- Node.js 18+
- DeepSeek API Key

### 安装

```bash
# 1. 克隆
git clone <repo-url>
cd project/ai

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.local.example .env.local
# 编辑 .env.local，填入你的 DEEPSEEK_API_KEY

# 4. 启动开发服务器
npm run dev
```

### 配置

在 `.env.local` 中：

```env
DEEPSEEK_API_KEY=sk-xxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
```

---

## 📁 项目结构

```
src/
├── app/
│   ├── interview/          ← 🆕 面试平台（核心）
│   │   ├── page.tsx           仪表盘
│   │   ├── resume/            简历管理
│   │   ├── jd/                JD 分析
│   │   ├── mock/              模拟面试 ★
│   │   ├── questions/         错题本
│   │   └── review/            复盘导入
│   ├── chat/               ← 🟢 原聊天功能
│   ├── playground/         ← 🟢 AI Playground
│   └── rag/                ← 🟢 RAG 知识库
│
├── lib/
│   └── interview/
│       ├── agents/         ← AI Agent 实现
│       ├── prompts/        ← Prompt 模板
│       ├── graphs/         ← LangGraph 状态图
│       └── services/       ← RAG 上下文服务
│
├── components/
│   └── interview/          ← 面试组件
│
├── store/
│   └── interview-store.ts  ← 面试状态管理
│
└── types/
    └── interview.ts        ← 类型定义
```

---

## 🧠 核心架构

### AI Agent 体系

```
ResumeAnalyzer Agent
  └─ PDF解析 → 结构化提取 → 优劣势分析

JDAnalyzer Agent
  └─ JD提取 → 简历匹配 → 面试重点

Interviewer Agent (LangGraph)
  └─ 状态图：evaluateAnswer → decideNext → generateResponse
  └─ 条件路由：答得好→深入，答得差→换题

Scorer Agent
  └─ 五维评分 → 逐题分析 → 改进建议

ReviewAnalyzer Agent
  └─ 复盘分析 → 错题提取 → 掌握度追踪
```

### 数据流

```
用户上传PDF → pdfjs-dist解析 → DeepSeek提取 → Zustand存储 → 展示分析
用户粘贴JD  → DeepSeek提取技能 → 简历匹配 → 面试重点
开始面试    → LangGraph状态机 → SSE流式输出 → 逐轮对话
面试结束    → Scorer评分 → 报告生成 → 错题本更新
导入复盘    → DeepSeek分析 → 错题自动加入 → 掌握度追踪
```

---

## 📖 文档

完整文档在 `docs/interview/`：

| 文档 | 说明 |
|------|------|
| [01-architecture.md](docs/interview/01-architecture.md) | 整体架构设计 + 路由 + 数据模型 |
| [02-data-flow.md](docs/interview/02-data-flow.md) | 数据流转 + SSE 协议 + 状态管理 |
| [03-architecture-diagram.md](docs/interview/03-architecture-diagram.md) | ASCII 架构图 + 组件树 + 部署图 |
| [04-interview-prep.md](docs/interview/04-interview-prep.md) | 面试准备话术 + STAR 故事 + 技术选型问答 |
| [05-ai-learning-plan.md](docs/interview/05-ai-learning-plan.md) | 第8-12周 AI 学习计划 |
| [06-resume-upload.md](docs/interview/06-resume-upload.md) | Step 2: 简历上传 + PDF 解析 + RAG 索引 |
| [07-jd-analysis.md](docs/interview/07-jd-analysis.md) | Step 3: JD 分析 + 面试题生成 |
| [08-mock-interview.md](docs/interview/08-mock-interview.md) | Step 4-5: AI 模拟面试官 + LangGraph 状态机 |
| [09-review-import.md](docs/interview/09-review-import.md) | Step 6: 复盘导入 + 错题本 |
| [10-project-wrap.md](docs/interview/10-project-wrap.md) | Step 7: 项目包装 + 面试准备 |
| [11-auth-system.md](docs/interview/11-auth-system.md) | Step 8: 用户认证系统 |
| [12-interview-prep.md](docs/interview/12-interview-prep.md) | Step 9: 面试准备 — 一键出题 |

---

## 🗺️ 开发路线

| 版本 | 功能 | 状态 |
|------|------|------|
| **V1** | 项目骨架 + 简历管理 + 基础面试对话 | ✅ |
| **V2** | 简历分析 Agent + JD 分析 + 面试题生成 | ✅ |
| **V3** | LangGraph 状态机 + SSE + Scorer + 复盘导入 | ✅ |
| **V4** | 用户认证系统 + 路由保护 | ✅ |
| **V5** | PostgreSQL + Redis + 多用户 | 📅 计划中 |

---

## 🎯 面试亮点

这个项目面试时你可以说的亮点：

1. **LangGraph 状态机** — 用 StateGraph 实现条件路由，不是简单的 API 调用
2. **SSE 流式渲染** — 打字机效果 + 增量 DOM + 滚动锚点
3. **RAG 知识库** — ChromaDB 向量检索，AI 面试官记住简历细节
4. **五维评分模型** — 不只看答对没答对，多维度评估
5. **复盘导入** — AI 自动提取错题，形成学习闭环
6. **全栈能力** — 前端 UI + 后端 API + AI Prompt + 数据持久化

---

## 📄 许可

MIT
