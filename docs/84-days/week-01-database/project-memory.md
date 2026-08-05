---
name: learning-style
description: Zero-beginner learning full-stack. Teaching style and current progress.
metadata:
  type: user
  project: ai-interview-platform
  day: 4
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

## 当前进度（Day 4 进行中，2026-07-22）

### 已完成的 API（全部走数据库）

| API | 文件 | 状态 |
|-----|------|------|
| POST /api/auth/register | src/app/api/auth/register/route.ts | ✅ 完成 |
| POST /api/auth/login | src/app/api/auth/login/route.ts | ✅ 完成 |
| GET /api/auth/me | src/app/api/auth/me/route.ts | ✅ 完成 |
| POST /api/interview/analyze-resume | src/app/api/interview/analyze-resume/route.ts | ✅ 完成 |

### 已写好的数据层

- `src/database/client.ts` — Prisma Client 单例（Prisma 7 + libsql adapter）
- `src/database/repositories/user.repository.ts` — findByEmail, findById, create, toSafeUser
- `src/database/services/user.service.ts` — register, login, getProfile + BusinessError
- `src/database/repositories/resume.repository.ts` — createResume, findByUserId, findById, delete
- `src/database/services/resume.service.ts` — uploadAndAnalyze, getResumes, getResumeById, deleteResume

### Day 4 待完成

- [ ] 写 GET /api/resumes 的 Controller（`src/app/api/resumes/route.ts`）
- [ ] 写 DELETE /api/resumes/[id] 的 Controller（`src/app/api/resumes/[id]/route.ts`）
- 提示：Service 已经写好了（resumeService.getResumes, resumeService.deleteResume），只需要写 Controller

### Schema（prisma/schema.prisma）

User: id(cuid), email(@unique), name, passwordHash, salt, createdAt, updatedAt, resumes[]
Resume: id(autoincrement), userId, resumeName, resumeContext(Json?), size, rawText(String?), analysis(Json?), score(Int?), status(@default"上传中"), createdAt, updatedAt, user(@relation), @@index([userId])

## 用户自己做的技术决策

- User id: cuid, Resume id: autoincrement
- score: Int, status: 文字字符串
- email: @unique, 时间戳: 数据库自动维护
- 简历数据在 AI 分析完成后再一次性存库（不存半成品）

## 关键文件速查

```
src/database/client.ts                           — Prisma 单例
src/database/repositories/user.repository.ts     — User 数据访问
src/database/services/user.service.ts            — User 业务逻辑 + BusinessError
src/database/repositories/resume.repository.ts   — Resume 数据访问
src/database/services/resume.service.ts          — Resume 业务逻辑
src/app/api/auth/register/route.ts               — User 注册 Controller
src/app/api/auth/login/route.ts                  — User 登录 Controller
src/app/api/auth/me/route.ts                     — 查用户信息 Controller
src/app/api/interview/analyze-resume/route.ts    — 简历上传 Controller
prisma/schema.prisma                             — User + Resume 模型
prisma.config.ts                                 — Prisma 7 配置
.env                                             — DATABASE_URL
dev.db                                           — SQLite 数据库文件
```

## 下次开启新对话时这样说

"我是纯新手小白，正在做 AI 面试平台的 Week 1 Day 4 学习。今天是继续写 GET /api/resumes 接口。我理解三层架构（Controller→Service→Repository），需要引导式教学，不要直接给代码，先解释再让我自己动手。"

或者直接把这整段粘贴给我。
