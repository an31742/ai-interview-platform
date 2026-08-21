---
name: learning-style
description: Zero-beginner learning full-stack. Teaching style and current progress.
metadata:
  type: user
  project: ai-interview-platform
  day: 5
  date: 2026-08-18
---

## 用户背景

纯新手小白，零数据库和后端基础。在学习 AI 面试训练平台的全栈开发。

## 教学方式（必须遵守）

- 一步一步来，不跳步，不合并多个步骤
- 写代码前先解释"这层是干什么的"
- 餐厅比喻：Controller=服务员, Service=厨师, Repository=采购员
- 让用户自己做决定，引导思考，不直接给答案
- 让用户用自己的话复述概念来确认理解
- 每天学完记录笔记到 `docs/84-days/week-01-database/{天数}/`

## 用户目前的理解水平

- "Prisma是数据库的中介/翻译官"
- "前端通过接口调用后端，后端查数据取数据给前端"
- "数据库就是数据文件，但有特定的存储和查找方法"
- "Controller只调用交给Service → Service处理逻辑交给Repository → Repository处理数据"
- "数据在第3步全部完事就再存，不要有数据就存"
- "三层 Controller 骨架相同：解析请求 → 调 Service → 返回响应"
- "400 是业务规则不通过，500 是服务器内部错误"
- "一对多关系：外键放在'多'的那张表里（Resume.userId, Message.sessionId）"

## 技术栈与配置

| 项目 | 版本/说明 |
|------|-----------|
| Next.js | 16.2.7（App Router，注意这是新版，API 路由在 `src/app/api/`） |
| React | 19.2.4 |
| Prisma | 7.8.0 + `@prisma/adapter-libsql`（SQLite） |
| 数据库 | SQLite（`dev.db`），`DATABASE_URL` 在 `.env` |
| 状态管理 | Zustand 5 + persist（前端 localStorage） |
| AI | LangChain / LangGraph、OpenAI、HuggingFace Inference |
| PDF | pdf-parse |

## 项目结构（关键路径）

```
src/database/client.ts                           — Prisma 单例（Prisma 7 + libsql adapter）
src/database/repositories/user.repository.ts     — User 数据访问
src/database/services/user.service.ts            — User 业务逻辑 + BusinessError
src/database/repositories/resume.repository.ts   — Resume 数据访问
src/database/services/resume.service.ts          — Resume 业务逻辑
src/app/api/auth/register/route.ts               — 注册 Controller
src/app/api/auth/login/route.ts                  — 登录 Controller
src/app/api/auth/me/route.ts                     — 查用户信息 Controller
src/app/api/interview/analyze-resume/route.ts    — 简历上传 Controller
src/app/api/resumes/route.ts                     — 简历列表/创建 Controller
src/app/api/resumes/[id]/route.ts                — 简历详情/删除 Controller
src/app/api/interview/chat/route.ts              — SSE 面试对话（尚未落库）
src/lib/interview/graphs/interview-graph.ts      — LangGraph 面试状态机
src/store/interview-store.ts                     — Zustand（面试数据仍在 localStorage）
src/types/interview.ts                           — 前端类型定义
prisma/schema.prisma                             — 数据模型
prisma.config.ts                                 — Prisma 配置
```

## 已完成（Day 0-4）

### 已跑通走数据库的 API

| API | 状态 |
|-----|------|
| POST /api/auth/register | ✅ 完成 |
| POST /api/auth/login | ✅ 完成 |
| GET /api/auth/me | ✅ 完成 |
| POST /api/interview/analyze-resume | ✅ 完成 |
| GET /api/resumes | ✅ 完成（代码已写，已逐行理解） |
| GET /api/resumes/[id] | ✅ 完成（代码已写，已逐行理解） |
| DELETE /api/resumes/[id] | ✅ 完成（代码已写，已逐行理解） |

### 已理解的概念

- 三层架构：Controller → Service → Repository → Prisma → SQLite
- Controller 三步骨架：解析请求 → 调 Service → 返回响应
- BusinessError（业务错误 400/404）与系统错误（500）分开处理
- JWT Token 验证：extractTokenFromCookie → extractTokenFromHeader → verifyToken → payload.sub
- 一对多关系：外键放在"多"表（Resume.userId）
- Prisma 语法：`字段名 类型 修饰符`、`?` 可选、`@` 修饰符

## 当前进度（Day 5 已完成 ✅）

### 今日目标 — 已全部完成！

面试对话数据从 localStorage 搬进数据库：

```
✅ 理解 Message 为什么单独建表（概念）
✅ prisma/schema.prisma（加 InterviewSession + Message 模型）
✅ interview.repository.ts
✅ interview.service.ts
✅ /api/interview/start（创建面试 Controller）
✅ /api/interviews（面试列表 Controller）
✅ /api/interview/[id]/route.ts（详情 + 完成 + 删除 Controller）
```

### 概念已完成

- ✅ Message 为什么单独建表：JSON 数组无法分页/并发写入会覆盖/全量加载浪费资源
- ✅ 一对多关系：InterviewSession(1) → Message(N)，外键 `sessionId` 在 Message 表
- ✅ InterviewSession 字段设计：id, userId, resumeId?, jdContent?, mode, difficulty, status, duration, score?, createdAt, updatedAt, completedAt?
- ✅ Message 字段设计：id, sessionId, role, content, type, phase?, score?, evaluation?, createdAt

### Schema 修正 12 处错误并通过校验

| # | 错误 | 修正 |
|---|------|------|
| 1 | Resume.id 写成 String @default(autoincrement()) | 改回 Int @default(autoincrement()) |
| 2 | 全篇 string/int 小写 | 改 String/Int 大写 |
| 3 | default(cuid()) 缺 @ | 改 @default(cuid()) |
| 4 | resumeId 重复定义两次 | 删一个，保留 Int? |
| 5 | messages string | 改 messages Message[] 关系声明 |
| 6 | @relation(fuileds:...) | 改 @relation(fields:...) |
| 7 | status @default('preparing') 单引号 | 改双引号 "preparing" |
| 8 | 模型名 messageSession | 改 Message |
| 9 | content 对话的内容 缺类型 | 改 content String |
| 10 | Message 缺 evaluation/createdAt/session 关系 | 补全 |
| 11 | InterviewSession 缺 duration/score/createdAt/updatedAt/resume | 补全 |
| 12 | User 缺 interviewSessions InterviewSession[] 反向关系 | 补上 |

### Day 5 代码全部完成

- [x] 修正 schema 并通过 `npx prisma validate` ✅
- [x] `npx prisma db push` 建表 ✅（InterviewSession + Message 两张新表）
- [x] `npx prisma generate` 更新 Prisma Client ✅
- [x] 写 interview.repository.ts ✅（7 个操作：createSession/findSessionsByUserId/findSessionById/updateSession/deleteSession/createMessage/findMessagesBySessionId）
- [x] 写 interview.service.ts ✅（6 个方法：startInterview/getInterviews/getInterviewById/completeInterview/deleteInterview/appendMessage，全带权限检查）
- [x] 写 API Controller ✅：
  - POST /api/interview/start（创建）
  - GET /api/interviews（列表）
  - GET /api/interview/[id]（详情+消息）
  - PATCH /api/interview/[id]（完成）
  - DELETE /api/interview/[id]（删除）
- [x] `npx tsc --noEmit` TypeScript 0 错误 ✅

### 踩坑记录（Day 5）

1. **Prisma 类型首字母永远大写**：Int/String/DateTime，和有没有 default 无关
2. **一对多关系两边都要声明**：InterviewSession 有 user User → User 必须有 interviewSessions InterviewSession[]，否则 db push 报 P1012
3. **SQLite 不支持 Prisma 级联删除**：删 Session 前必须先手动 `deleteMany` 掉 Message，否则外键约束报错
4. **改完 schema 一定要跑 `prisma generate`**：不跑的话 Prisma Client 里的 TS 类型还是旧的，tsc 会报 interviewSession/message 不存在

## 用户自己做的技术决策

- User id: cuid, Resume id: autoincrement
- score: Int, status: 文字字符串
- email: @unique, 时间戳: 数据库自动维护
- 简历数据在 AI 分析完成后再一次性存库（不存半成品）
- InterviewSession id: cuid（不暴露数量）
- Message 单独建表（不用 JSON 数组嵌套）
