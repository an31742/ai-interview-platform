# ☀️ Day 7（周日）— Tech Lead 集成日（第 1 周）

> **日期：** 2026-07-19（周日）
> **主题：** 不写新功能。本周最后一天是 Tech Lead。
> **金句：** 架构师和码农的区别：码农写代码，架构师删代码。

---

## ✅ 今日验收标准

- [ ] ☀️ 架构评审：5 个维度分析通过
- [ ] ☀️ 代码重构：统一目录/命名/接口
- [ ] ☀️ docs/15-postgresql.md ≥ 3000 字
- [ ] ☀️ README 增加数据库章节
- [ ] ☀️ GitHub 有本周所有 Commit
- [ ] ☀️ ChatGPT 面试模拟 20 分钟（连续追问）
- [ ] ☀️ 明确下周第一天要做什么

---

## ☀️ 上午：架构评审（60 分钟）

### Step 1：Claude Code Review（20 分钟）

打开 Claude Code，输入这个 Prompt：

```
现在模拟项目评审。
请 Review 我本周所有数据库设计。
项目路径：/Users/maxiangan/Desktop/project/ai

Review 范围：
1. prisma/schema.prisma（所有 Model）
2. src/database/（所有 Repository + Service）
3. src/app/api/（被修改的 API Route）

请从以下 5 个维度分析：

① 扩展性（Scalability）
  - 表设计能支持多少用户？
  - 哪些字段会成为瓶颈？
  - 未来需要加字段时，改动大吗？

② 性能（Performance）
  - 索引是否合理？
  - 有没有 N+1 查询？
  - 大字段查询有没有优化？

③ 安全（Security）
  - SQL 注入风险？（Prisma 已参数化，但还有别的问题吗）
  - 用户权限检查是否遗漏？
  - 敏感字段有没有暴露？

④ 一致性（Consistency）
  - 外键约束完整吗？
  - Cascade 行为是否正确？
  - 有没有冗余字段？

⑤ 维护性（Maintainability）
  - 目录结构清晰吗？
  - 命名是否一致？
  - 每个文件的职责是否单一？

对于每个维度，给出：
- ✅ 做得好的
- ⚠️ 需要改的
- ❌ 严重问题（需要立即修）
```

### Step 2：根据 Review 结果修改（20 分钟）

Claude 输出后，**按照优先级处理**：

```
P0（今天必须修）：
  - 安全漏洞
  - 数据一致性问题
  - N+1 查询

P1（最好今天修）：
  - 索引优化
  - 命名不统一
  - 缺少注释

P2（下周有时间再修）：
  - 可预见的扩展问题
  - 性能微优化
  - 代码风格
```

### Step 3：统一目录结构（20 分钟）

检查本周新增的代码，确保目录结构一致：

```
src/database/
├── client.ts                        ← Prisma 单例
├── repositories/
│   ├── user.repository.ts           ← 用户数据访问
│   ├── resume.repository.ts         ← 简历数据访问
│   └── interview.repository.ts      ← 面试数据访问
├── services/
│   ├── user.service.ts              ← 用户业务逻辑
│   ├── resume.service.ts            ← 简历业务逻辑
│   └── interview.service.ts         ← 面试业务逻辑
└── types/
    ├── user.types.ts                ← 用户 DTO
    ├── resume.types.ts              ← 简历 DTO
    └── interview.types.ts           ← 面试 DTO
```

**统一命名规范：**
- Repository 方法名：`findByXxx` / `create` / `update` / `delete` / `count`
- Service 方法名：业务意图命名（`registerUser` 而非 `createUser`）
- Controller 遵循 RESTful：`POST /api/resource` 创建，`GET` 读取，`PATCH` 更新

---

## ☀️ 下午：文档 + Git + 面试模拟（60 分钟）

### Step 1：完成 docs/15-postgresql.md（30 分钟）

今天的目标：**≥ 3000 字**。

将本周的每日笔记合并、润色、结构化：

```markdown
# PostgreSQL 数据库设计

## 一、为什么需要数据库？
（内容来自 Day 1 🚇 理解）

## 二、为什么不是 localStorage？
（内容来自 Day 1 架构分析）

## 三、为什么是 PostgreSQL？
（对比 MySQL / MongoDB 的决策记录）

## 四、项目 ER 图
（Excalidraw 截图 + 关系说明 + 图片保存）

## 五、各实体设计理由
（User / Resume / Interview / Message / Question / Review）

## 六、Schema 设计分析
（UUID vs 自增 ID / JSONB vs 单独表 / 索引策略）

## 七、企业三层架构设计
（Repository / Service / Controller 职责分析）

## 八、Resume 数据设计
（文件存储策略 / JSONB 决策树 / 权限隔离）

## 九、面试对话数据设计
（Message 独立表 / Context 管理 / SSE+DB 配合）

## 十、当前 Schema 源码
（最新 prisma/schema.prisma 粘贴）

## 十一、面试问答（高频考点）
（至少 10 个 QA，面试官常见追问）
```

### Step 2：更新 README.md（10 分钟）

在 `README.md` 中增加：

```markdown
## 数据库

本项目的数据库设计详见：
[docs/15-postgresql.md](./docs/15-postgresql.md)

### 技术选型
- **数据库：** PostgreSQL
- **ORM：** Prisma
- **架构：** Repository → Service → Controller 三层

### 核心实体
| 实体 | 说明 | 状态 |
|------|------|------|
| User | 用户账号 | ✅ 已落库 |
| Resume | 简历 | ✅ 已落库 |
| InterviewSession | 面试会话 | ✅ 已落库 |
| Message | 对话消息 | ✅ 已落库 |
| InterviewReview | 面试复盘 | ✅ 已落库 |
```

### Step 3：最终 Commit + Push（10 分钟）

```bash
# 先看 diff，确保没有意外代码
git diff --stat

# 确认本周所有文件
git log --oneline --since="2026-07-13"

# 如果还没 push
git push origin main
```

### Step 4：🎤 面试模拟 20 分钟（最硬核的环节）

打开 ChatGPT，语音输入：

```
你现在是一位阿里 P8 前端面试官。
针对我本周实现的数据库设计，连续追问 20 分钟。

我的项目是 AI 面试平台，技术栈：
- Next.js 16 + React 19
- PostgreSQL + Prisma
- Repository/Service/Controller 三层架构

面试要求：
1. 不要放水
2. 每轮追问到你答不出来为止
3. 然后告诉我正确答案
4. 记录我答得不好的点

先从我选 PostgreSQL 开始：
① 为什么选 PostgreSQL 不选 MySQL？
② 你的 ER 图为什么这样设计？
③ 为什么 User 和 Resume 是 1:N 而不是 1:1？
④ Prisma Schema 里为什么用 cuid 不用 uuid？
⑤ Repository 和 Service 的边界在哪？
⑥ 如果我要查"所有面试过 React 超过 3 次且评分 80 以上的用户"，SQL 怎么写？
⑦ 你的 Message 表为什么没有全文索引？
⑧ 如果 1000 万数据，你的分页查询怎么优化？
```
**
---

## 📁 本周全部产出总览

### Day 1（周一）— 理解
```
新增：
  docs/15-postgresql.md     ← 架构决策记录
  docs/84-days/README.md    ← 84 天手册目录
  docs/84-days/week-01-database/README.md
  docs/84-days/week-01-database/day-01.md
```

### Day 2（周二）— Schema 设计
```
新增：
  prisma/schema.prisma       ← User + Resume Model
  prisma/migrations/         ← 第一次 Migration
更新：
  docs/15-postgresql.md      ← Schema 分析
```

### Day 3（周三）— 用户落库
```
新增：
  src/database/client.ts
  src/database/repositories/user.repository.ts
  src/database/services/user.service.ts
  src/database/types/user.types.ts
修改：
  src/app/api/auth/register/route.ts
  src/app/api/auth/login/route.ts
  src/app/api/auth/me/route.ts
```

### Day 4（周四）— 简历落库
```
新增：
  src/database/repositories/resume.repository.ts
  src/database/services/resume.service.ts
修改：
  prisma/schema.prisma       ← 新增 Resume Model
  prisma/migrations/         ← add-resume
  src/app/api/interview/analyze-resume/route.ts
```

### Day 5（周五）— 面试落库
```
新增：
  src/database/repositories/interview.repository.ts
  src/database/services/interview.service.ts
修改：
  prisma/schema.prisma       ← Interview/Message/Review Model
  prisma/migrations/         ← add-interview-message
  src/app/api/interview/chat/route.ts
```

### 周日（今天）— 集成
```
修改：
  docs/15-postgresql.md      ← 最终版（≥3000 字）
  README.md                  ← 新增数据库章节
  src/database/              ← 重构/统一
```

---

## 🎯 第 1 周结束后的成就感

**你应该感到骄傲：**

```
第 1 周开始时：
  ❌ 所有数据在浏览器 localStorage
  ❌ 用户关掉浏览器 = 数据丢失
  ❌ 不支持真正多用户
  ❌ 没有数据备份

第 1 周结束时：
  ✅ User / Resume / Interview / Message 全部 PostgreSQL
  ✅ Repository/Service/Controller 三层架构
  ✅ Prisma Migration 可回滚
  ✅ API 全部支持数据库查询
  ✅ docs 记录了所有架构决策
  ✅ 你已经理解了"高级前端 + 数据库"的整套体系
```

**不是每个人都能在 996 的一周内完成这些。你做到了。**

---

## 📌 下周预告：第 2 周 — API 与认证体系

```
下周目标：
  完善 JWT 认证体系
  统一所有 API Route 的 Controller 模式
  错误处理 + 数据验证
  API 文档（OpenAPI / Swagger）
```

**周日结束了。喝杯酒，明天第 2 周开始。**

---

[← Day 5](day-05.md) | [第 2 周 →](../week-02-api-auth/README.md)
