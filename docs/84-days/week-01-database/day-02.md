# Day 2 — Prisma 核心概念：Schema、Migration、ORM（第 1 周）

> **日期：** 2026-07-14（周二）
> **主题：** 理解 Prisma 为什么存在、ORM 解决什么问题、Schema 为什么重要
> **金句：** 不懂 Schema 就不要写数据库代码。

---

## ✅ 今日验收标准

- [ ] 🚇 理解了 ORM 的三个本质问题：为什么出现、解决什么、代价是什么
- [ ] 🚇 理解了 Schema = 数据合约、Migration = 数据版本控制
- [ ] 🌙 完成了 User + Resume 的 Prisma Model 设计
- [ ] 🌙 `schema.prisma` 创建完成，通过 `npx prisma validate`
- [ ] 📝 docs/15-postgresql.md 更新了 Schema 分析章节

---

## 🚇 地铁 30 分钟（只看不写）

> 话题：今天理解 ORM 和 Schema 的本质，而不是 Prisma API。

### 打开 ChatGPT，输入这个 Prompt

```
你是一位 Prisma Contributor / ORM 专家。
不要教我 Prisma 的 API。

请用本质解释以下概念，结合我的 AI 面试平台项目：
① ORM 为什么出现？它到底解决了什么痛苦？
② 为什么企业不用裸 SQL 写业务？
③ Prisma 和其他 ORM（TypeORM、Drizzle）有什么本质不同？
④ Schema 为什么是"数据合约"？它和 TypeScript 类型是什么关系？
⑤ Migration 是什么？为什么企业不直接改数据库表？
⑥ 结合我的项目：为什么 User 表需要一个 Schema 定义？

要求：
- 每一个概念先给本质，再给例子
- 不要写代码
- 必须解释"为什么"
```

### 你必须在 30 分钟内理解 3 个核心概念

**本质 1：ORM 解决的是"阻抗不匹配"**

```
数据库是关系模型（表 + 行 + 外键）
JavaScript 是对象模型（类 + 属性 + 引用）

阻抗不匹配 = 你写 SQL 查出 User，还要手动 map 成 User 对象
ORM = 自动帮你完成这个映射

但不是免费的：
  ✅ 开发速度快 3-5 倍
  ✅ 类型安全（编译期发现错误）
  ✅ 数据库无关（换数据库改一行配置）
  ❌ 复杂查询性能不如原生 SQL
  ❌ 学习曲线（要理解 ORM 的思维）
```

**本质 2：Schema 是"数据合约"**

```
Schema = 数据库的 TypeScript 类型定义

没有 Schema 的数据库：
  你知道 User 有字段，但不知道有哪些
  你不知道哪些字段是必须的
  你不知道 id 是 UUID 还是自增
  你不知道 createdAt 谁维护

有 Schema 的数据库：
  所有字段、类型、约束写在一个地方
  Prisma Client 自动生成类型安全的 Client
  改 Schema → 自动 Migration → 团队所有人都同步

一句话：Schema 是数据库的"接口定义"。
```

**本质 3：Migration = 数据库的 Git**

```
Git                → 代码版本控制
Prisma Migration   → 数据库 Schema 版本控制

为什么需要 Migration？
  你改 schema.prisma（新增一个字段 emailVerified）
  ↓
  prisma migrate dev
  ↓
  生成 SQL 文件：ALTER TABLE User ADD COLUMN emailVerified
  ↓
  这个 SQL 文件提交到 Git
  ↓
  同事 git pull → prisma migrate dev → 数据库自动更新

Migration 的目标：所有人的数据库结构保持一致。
Migration 的保证：可以回滚（理论上）。
```

---

## 🌙 晚上 40 分钟（开始用项目实践）

### 第一步：安装 Prisma（5 分钟）

```bash
cd /Users/maxiangan/Desktop/project/ai

# 安装 Prisma
npm install prisma @prisma/client
npm install -D prisma

# 初始化 Prisma
npx prisma init
```

这会创建两个文件：
```
prisma/
  schema.prisma    ← Schema 定义
.env               ← 数据库连接字符串
```

### 第二步：配置数据库连接（2 分钟）

编辑 `.env`：
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai-interview"
```

> **如果你本地没有 PostgreSQL：**
> 今天先用 SQLite 代替，后续再迁移到 PostgreSQL。
> ```env
> DATABASE_URL="file:./dev.db"
> ```
> 在 `schema.prisma` 中改 provider：
> ```prisma
> datasource db {
>   provider = "sqlite"    // 先写 sqlite，第 1 周结束时切到 postgresql
>   url      = env("DATABASE_URL")
> }
> ```

### 第三步：设计 Prisma Schema（20 分钟）

打开 `prisma/schema.prisma`，**自己先设计 User 和 Resume**。

> **重要：** 不要直接问 Claude "帮我写 schema"。
> 先思考，再用 Claude 验证你的设计。

**先自己思考：**
```
User 需要哪些字段？
  - id: 什么类型？（UUID vs 自增 vs CUID）
  - email: 唯一吗？
  - 密码存在哪？
  - 时间戳谁维护？

Resume 需要哪些字段？
  - 和 User 什么关系？（1:N）
  - 文件存在哪？（数据库存路径还是内容？）
  - 结构化数据（解析结果）放哪？（JSON 还是单独表？）
```

**思考 5 分钟后**，再用 Claude 这个 Prompt：

```markdown
根据我的项目需求，分析以下 Prisma Schema 设计：

User：
- id, email, name, passwordHash, salt, createdAt, updatedAt

Resume：
- id, userId, fileName, fileSize, status, rawText, parsed (JSON), analysis (JSON), createdAt, updatedAt

问题：
① id 应该用 UUID 还是自增？为什么？
② passwordHash 和 salt 放 User 表还是单独表？
③ Resume 的 parsed 和 analysis 用 JSON 类型还是单独表？为什么？
④ createdAt/updatedAt 用 Prisma 的 @default(now()) 还是代码维护？
⑤ 索引应该怎么建？
⑥ 以后可能的扩展字段有哪些？
```

### 第四步：根据讨论完善 Schema，然后 validate（5 分钟）

```bash
npx prisma validate
```

如果验证通过，你会看到：
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
✔ Your Prisma schema is valid!
```

### 第五步：第一次 Migration（5 分钟，可选）

```bash
npx prisma migrate dev --name init
```

> 如果报错说 PostgreSQL 连不上，说明你本地没装 PostgreSQL。
> **解决方案：** 今天先用 SQLite（改 provider 为 sqlite），把 Schema 设计搞对。
> 周日集成日统一解决数据库连接问题。

---

## 📝 睡前 10 分钟

### 更新 docs/15-postgresql.md

在文档中新增章节：

```markdown
## 七、Prisma Schema 设计分析

### 7.1 User 模型设计
（解释每个字段为什么存在、类型选择理由、索引策略）

### 7.2 Resume 模型设计
（解释为什么 JSON 类型存储 parsed/analysis、1:N 关系设计）

### 7.3 Schema 设计原则
（为什么用 UUID、为什么 createdAt/updatedAt 用 Prisma 维护）
```

### 回答 3 个问题

```
Q1：ORM 的"阻抗不匹配"具体指什么？我的项目哪里有这个不匹配？
A1：（写你的理解）

Q2：如果不用 ORM，用裸 SQL 写我的项目有什么问题？
A2：（写出至少 3 个痛点）

Q3：Schema 为什么重要？不写 Schema 直接建表行不行？
A3：（从团队协作、类型安全、数据一致性三个角度回答）
```

### 🎤 面试模拟

打开 ChatGPT 语音输入：

```
我是阿里 P7 面试官。
针对 Prisma 和 ORM，追问：
① ORM 的优缺点分别是什么？什么场景不适合 ORM？
② Prisma Schema 和 TypeScript 类型的关系是什么？
③ 什么是 N+1 问题？Prisma 怎么解决？
④ Migration 回滚怎么处理？
⑤ 如果我的表有 1000 万数据，Migration 会锁表吗？怎么处理？
```

---

## 📁 今日产出

```
修改：
  prisma/schema.prisma    ← User + Resume Model

新增：
  prisma/migrations/       ← 第一次 Migration（如果 PostgreSQL 可用）

更新：
  docs/15-postgresql.md    ← 新增 Schema 分析章节

新增（可选）：
  prisma/dev.db            ← SQLite 本地数据库
```

---

## ⚠️ 常见陷阱

| 陷阱 | 正确做法 |
|------|---------|
| 想让 Claude 直接生成完整 Schema | 自己先设计，再用 Claude 验证。否则你永远不理解 |
| 想一口气设计所有 Model | 今天只看 User + Resume。贪多嚼不烂 |
| 纠结 PostgreSQL 连不上 | 今天先用 SQLite，Schema 设计是通用的 |
| 看了 Prisma 文档一整天 | 30 分钟理解本质，40 分钟动手。不要陷入文档陷阱 |

---

## 📌 明天预告

Day 3 — 企业架构模式

```
🚇 理解：为什么企业不直接 page → 数据库？
        为什么要 Repository → Service → Controller？
🌙 动手：接入 Prisma，完成 User CRUD API
📝 产出：第一个真正的 Commit
```

---

[← Day 1](day-01.md) | [Day 3 →](day-03.md)
