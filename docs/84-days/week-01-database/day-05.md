# Day 5 — 面试对话落库：Conversation + Message（第 1 周）

> **日期：** 2026-07-17（周五）
> **主题：** AI 面试对话数据真正存进数据库，前端从 localStorage 切换到 API
> **金句：** 用户关掉浏览器再打开，面试记录还在，这才叫产品。

---

## ✅ 今日验收标准

- [ ] 🚇 理解了为什么 AI 聊天数据必须持久化
- [ ] 🚇 理解了 Context 管理和 Token 边界
- [ ] 🌙 创建了 InterviewSession Model（之前设计的完善）
- [ ] 🌙 创建了 Message Model
- [ ] 🌙 实现了 InterviewRepository + InterviewService
- [ ] 🌙 面试聊天 API 切换到数据库
- [ ] 🌙 面试报告从数据库读取数据
- [ ] 📝 Git Commit
- [ ] 🎤 睡前面试模拟

---

## 🚇 地铁 30 分钟（只看不写）

### 打开 ChatGPT，输入这个 Prompt

```
你是一位 AI 应用架构师。
我有一个 AI 面试平台，用户进行模拟面试。
每次面试会产生多轮对话（Message），并最终生成评分报告。

问题：
① 为什么 AI 聊天数据必须持久化？有哪些场景需要回看历史面试？
② 如果以后上下文越来越长（一次面试 50 轮），Token 怎么管理？
③ 为什么不能把 50 轮对话全部发给 AI？Token 限制怎么办？
④ Conversation 和 Message 为什么是两个表？不能把 Message 嵌在 Conversation 里？
⑤ 每个 Message 还有 score/evaluation/phase 等字段（面试专用），怎么设计表？
⑥ 面试评分数据结构很复杂（维度评分 + 面试题评分 + 表达反馈），放哪里？

要求：不要写代码，不要讲 API，讲设计和本质原因。
```

### 30 分钟理解 3 个核心问题

**本质 1：为什么 Message 必须单独表？**

```
错误做法：
  InterviewSession 里有一个 messages: Message[] 字段（数组）
  问题：
  - 面试 50 轮 → 整个数组 50 条 → 每次查 Session 都加载全部
  - 想只查最近 5 条 → 也得全加载再 slice
  - 并发写入 → 整个数组覆盖

正确做法：
  InterviewSession (1) ──→ Message (N)
  每个 Message 独立行
  查询只加载需要的（分页查询）
  并发写入各自互不影响
```

**本质 2：Context 管理策略**

```
你的面试流程现在：
  第 1 轮：AI问 → 用户答
  第 2 轮：AI评 → AI问 → 用户答
  ...
  第 50 轮：全部历史 + 最新消息发给 AI

Token 消耗分析：
  每次发全部历史 → Prompt Tokens 线性增长
  第 1 轮：~500 tokens
  第 10 轮：~5000 tokens
  第 50 轮：~25000 tokens
  第 50 轮时，仅历史就 25000+ tokens → 成本很高

企业策略：
  短期记忆（最近 N 轮）：发给 AI 做当前判断
  中期记忆（关键事实摘要）：每 5 轮生成一次，只传摘要
  长期记忆（全文存储）：数据库原始记录，不回传给 AI

你的项目实施：
  Phase 1（现在）：全量历史发给 AI（简单，但成本高）
  Phase 2（第 5 周后）：滑动窗口 + 摘要策略
```

**本质 3：评分数据放哪里？**

```
面试评分结构（你的 InterviewScore）：
  {
    overall: number,              // 总分
    dimensions: {                  // 维度分（5 个维度）
      fundamentals, projectDepth, systemDesign, expression, aiCapability
    },
    strengths: string[],          // 长处列表
    weaknesses: string[],         // 不足列表
    suggestions: string[],        // 改进建议
    questionScores: QuestionScoreItem[],  // 每题评分（数组）
    expressionIssues: ExpressionFeedback // 表达反馈
  }

方案 A：InterviewSession 表加一个 score JSONB 字段
  ✅ 简单直观
  ✅ PostgreSQL JSONB 可查询
  ❌ 如果 score 结构经常变 → 改 JSONB 比改表容易
  ✅ 推荐初期使用

方案 B：单独 Score 表
  ✅ 更规范化
  ❌ questionScores（数组）还是需要 JSON
  ❌ 过度设计

决策：JSONB 字段。等评分系统复杂到需要单独查询时再拆表。
```

---

## 🌙 晚上 40 分钟（动手写代码）

### 第一步：更新 Prisma Schema（5 分钟）

在 `prisma/schema.prisma` 中增加 Interview + Message Model：

```prisma
enum InterviewStatus {
  preparing
  in_progress
  completed
  cancelled
}

enum InterviewMode {
  tech
  hr
  mixed
}

enum QuestionDifficulty {
  junior
  mid
  senior
}

model InterviewSession {
  id         String           @id @default(cuid())
  userId     String
  resumeId   String?
  jdContent  String?
  mode       InterviewMode
  difficulty QuestionDifficulty
  status     InterviewStatus  @default(preparing)
  duration   Int              // 分钟
  score      Json?            // InterviewScore（JSONB）
  createdAt  DateTime         @default(now())
  completedAt DateTime?

  user       User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  resume     Resume?          @relation(fields: [resumeId], references: [id], onDelete: SetNull)
  messages   Message[]
  reviews    InterviewReview[]

  @@index([userId])
  @@index([userId, status])
  @@map("interview_sessions")
}

model Message {
  id          String   @id @default(cuid())
  sessionId   String
  role        String   // "ai" | "user"
  content     String
  type        String   // "question" | "answer" | "feedback" | "system"
  phase       String?  // InterviewPhase: self-intro | project-deep-dive | ...
  score       Int?     // 单题评分
  evaluation  String?  // AI 评价
  tokenCount  Int?     // 该消息消耗的 tokens
  createdAt   DateTime @default(now())

  session InterviewSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
  @@index([sessionId, createdAt])
  @@map("messages")
}

model InterviewReview {
  id          String   @id @default(cuid())
  sessionId   String
  company     String
  position    String
  date        String
  result      String   // "pass" | "fail" | "pending"
  source      String?
  questions   Json?    // ReviewQuestion[]（JSONB）
  weaknessTags String[]
  summary     String?
  actionItems String[]
  createdAt   DateTime @default(now())

  session InterviewSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
  @@map("interview_reviews")
}
```

Migration：
```bash
npx prisma migrate dev --name add-interview-message
```

### 第二步：创建 InterviewRepository（10 分钟）

**`src/database/repositories/interview.repository.ts`**

Prompt：

```
帮我生成 Interview Repository。
项目路径：/Users/maxiangan/Desktop/project/ai

要求：
1. 文件路径 src/database/repositories/interview.repository.ts
2. 方法：
   - createSession(data) → 创建面试会话
   - findSessionsByUserId(userId, options?) → 用户面试列表（分页）
   - findSessionById(id) → 面试详情（不包含 messages）
   - findMessagesBySessionId(sessionId, options?) → 消息列表（分页）
   - addMessage(sessionId, messageData) → 添加消息
   - updateSession(id, data) → 更新状态/评分
   - completeSession(id, score) → 完成面试
   - deleteSession(id) → 删除面试及所有消息
3. 列表查询排除大字段
4. 定义 DTO 类型
```

### 第三步：创建 InterviewService（10 分钟）

**`src/database/services/interview.service.ts`**

Prompt：

```
帮我生成 Interview Service。
项目路径：/Users/maxiangan/Desktop/project/ai

要求：
1. 文件路径 src/database/services/interview.service.ts
2. 依赖 InterviewRepository
3. 方法：
   - startInterview(userId, config) → 创建新面试
   - getInterviews(userId) → 面试列表
   - getInterviewDetail(userId, sessionId) → 面试详情 + 最近消息
   - addUserAnswer(userId, sessionId, content) → 添加用户回答
   - addAIResponse(userId, sessionId, content, type, phase, score?) → 添加 AI 回复
   - completeInterview(userId, sessionId, score) → 完成并评分
   - deleteInterview(userId, sessionId) → 删除
4. 关键业务逻辑（对比之前 Repository 的纯数据操作）：
   - Service 检查面试状态（只能对 "in-progress" 添加消息）
   - Service 检查用户权限（只能操作自己的面试）
   - Service 控制事务
```

### 第四步：重构 SSE Chat API（10 分钟）

修改 `src/app/api/interview/chat/route.ts`：

```
Controller 职责：
  POST /api/interview/chat
  {
    sessionId: string,
    message: string,     // 用户最新回答
  }

  1. 解析请求
  2. 调 InterviewService.addUserAnswer() → 存用户消息到 DB
  3. LangGraph 执行面试流程
  4. AI 生成回复 → SSE 流式返回
  5. 流结束后 → 调 InterviewService.addAIResponse() → 存 AI 回复到 DB
  6. 如果是最后一条 → 自动生成报告 → 调 InterviewService.completeInterview()
```

### 第五步：更新前端（3 分钟）

修改 `src/app/interview/mock/[id]/page.tsx`：

```
之前：
  面试数据从 useInterviewStore 读取（localStorage）
  消息通过 store.addMessage() 保存

之后：
  初始加载 → GET /api/interviews/:id
  新消息 → POST /api/interview/chat → SSE 流
  面试完成 → POST /api/interview/complete
  页面刷新 → 从数据库重新加载
```

### 第六步：验证 + Commit（2 分钟）

```bash
npm run build
git add -A
git commit -m "feat: 面试对话数据库持久化

- 新增 InterviewSession / Message / InterviewReview Prisma Model
- 实现 InterviewRepository（数据访问层）
- 实现 InterviewService（面试流程业务逻辑）
- 重构 SSE Chat API（消息落库）
- 前端面试页面切换到数据库查询

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 📝 睡前 10 分钟

### 更新 docs/15-postgresql.md

新增章节：

```markdown
## 十、面试对话数据设计

### 10.1 Message 为什么单独表
（数组嵌套的三个问题）

### 10.2 Context 管理策略
（滑动窗口 + 摘要 + 全文存储三层结构）

### 10.3 评分数据存储
（InterviewScore JSONB vs 单独表决策）

### 10.4 SSE + 数据库的配合
（流式写入：AI 回复分块到达，如何逐块写入数据库）
```

### 回答 3 个问题

```
Q1：面试 100 轮时，Message 表有多少数据？查询性能怎么样？
A1：（假设每轮 2 条消息 × 100 轮 = 200 条 × 200 字 = ~100KB/面试，加索引后毫秒级）

Q2：SSE 流式输出时，AI 回复还没完，要不要提前写数据库？
A2：（正在流式的不写，complete 后再写。写了一半用户刷新页面怎么办？）

Q3：如果用户同时进行 3 场面试，事务怎么控制并发？
A3：（数据库行锁 + 乐观锁 + 唯一约束三种策略分析）
```

### 🎤 面试模拟

```
我是 AI 应用架构师。
追问消息存储：
① 为什么 Message 和 Session 分开表？什么场景需要只查 Message 不查 Session？
② SSE 流式场景，数据库写入时机怎么设计？
③ 如果我要做"面试回放"功能（逐条重放），数据库怎么设计？
④ 每轮面试的 Token 消耗怎么统计到数据库？
⑤ 如果你的面试平台有 10 万用户同时面试，数据库扛得住吗？
```

---

## 📁 今日产出

```
新增：
  src/database/repositories/interview.repository.ts
  src/database/services/interview.service.ts

修改：
  prisma/schema.prisma                  ← 新增 Interview/Message/Review Model
  prisma/migrations/                     ← add-interview-message Migration
  src/app/api/interview/chat/route.ts   ← Controller 重构
  src/app/interview/mock/[id]/page.tsx  ← 前端切换

更新：
  docs/15-postgresql.md                 ← 新增面试对话章节
```

---

## ⚠️ 常见陷阱

| 陷阱 | 正确做法 |
|------|---------|
| SSE 流式没结束时写数据库 | 等 complete 事件再写，半成品数据有害 |
| Message 不分页直接全加载 | 面试 50 轮就 100 条 Message，一定要分页 |
| 面试状态没检查就加消息 | 已完成的面试不能再加消息（Service 层校验） |
| 没记 Token 消耗 | 每个 Message 记 tokenCount，以后优化成本 |
| 所有数据一股脑放 Session | Message 独立表 + 索引，Session 只存元数据 |

---

## 📌 周末预告

☀️ **周日（Day 7）— Tech Lead 集成日**

不是写新功能。是做四件事：
1. **架构评审**：Claude 复审本周所有设计
2. **重构**：统一目录/命名/接口
3. **文档**：完成 docs/15-postgresql.md（≥3000 字）
4. **面试模拟**：ChatGPT 连续追问 20 分钟

---

[← Day 4](day-04.md) | [周日 →](day-07-sunday.md)
