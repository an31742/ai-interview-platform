# Day 3 — 企业架构模式：Repository / Service / Controller（第 1 周）

> **日期：** 2026-07-15（周三）
> **主题：** 理解企业为什么用三层架构，完成 User 模块真正落库
> **金句：** 今天开始，你的项目不再"直接 page → 数据库"。

---

## ✅ 今日验收标准

- [ ] 🚇 理解了为什么分层架构是必需品而不是装饰品
- [ ] 🌙 创建了 `src/database/` 目录结构
- [ ] 🌙 实现了 UserRepository（Prisma 封装）
- [ ] 🌙 实现了 UserService（业务逻辑）
- [ ] 🌙 重构了 User API Route（Controller）
- [ ] 🌙 所有前端页面从 localStorage 切换到数据库
- [ ] 📝 Git Commit
- [ ] 🎤 睡前面试模拟

---

## 🚇 地铁 30 分钟（只看不写）

### 打开 ChatGPT，输入这个 Prompt

```
你是一位企业级软件架构师。
我在重构一个 AI 面试平台，从 localStorage 迁移到 PostgreSQL。

请解释以下架构模式，结合我的项目：

① 为什么企业不直接 page → 数据库？
② Repository 模式的核心思想是什么？
③ Service 层到底"服务"什么？
④ Controller 只做 API 路由，为什么不把逻辑写里面？
⑤ 如果我不用这套架构，直接用 Prisma Client 在 API Route 里查询，会有什么问题？

要求：
- 不要写代码
- 每层用"职责+不做什么"定义
- 用我的项目的"User注册"流程举例
```

### 30 分钟理解这 3 个本质

**本质 1：分层不是装饰品，是必需品**

```
没有分层：
  API Route → Prisma Client → 数据库
  看起来更简单，但：
  - 同样的查询到处复制（findUserByEmail 在 login 写一次，在 admin 写一次）
  - 业务逻辑散落各地（密码加密在 login route，也在 register route）
  - 没法测（没法 mock 数据库）
  - 改不动（换数据库类型要改所有 route）

有分层：
  Controller（路由 + HTTP 处理）
     ↓
  Service（业务逻辑 + 事务）
     ↓
  Repository（数据访问 + 查询封装）
     ↓
  Prisma Client（ORM）
     ↓
  数据库

  每一层只做一件事，只依赖下一层。
```

**本质 2：Repository ≠ 简单的 Prisma 封装**

```
Repository 不是"把 Prisma 的方法名改个名字"。

Repository 的职责：
  ✅ 封装所有数据查询逻辑
  ✅ 提供业务友好的查询接口（findActiveUsers() 而不是 find({where: {status: "active"}})
  ✅ 做数据转换（DB 模型 → 业务模型）
  ❌ 不做业务判断（"密码是否正确"是 Service 的职责）
  ❌ 不做事务控制（事务是 Service 的职责）

好的 Repository 接口：
  findByEmail(email: string): Promise<User | null>
  findById(id: string): Promise<User | null>
  create(data: CreateUserInput): Promise<User>
  update(id: string, data: Partial<User>): Promise<User>
  delete(id: string): Promise<void>

注意：findByEmail 不是直接暴露 Prisma 的 findUnique。
它封装了 email 小写化、敏感字段过滤等逻辑。
```

**本质 3：Service 是"业务规则的守护者"**

```
Controller 说："用户要注册"
Service 说："让我检查这个注册是否合法"

Service 的职责：
  ✅ 校验业务规则（邮箱是否重复、密码强度够不够）
  ✅ 协调多个 Repository（创建用户 + 创建默认配置）
  ✅ 事务控制（要么全部成功，要么全部回滚）
  ✅ 调用外部服务（发送欢迎邮件、记录审计日志）
  ❌ 不处理 HTTP 请求（那是 Controller 的事）
  ❌ 不直接操作数据库（那是 Repository 的事）

以注册为例：
  Controller: POST /api/auth/register → 解析 body → 调 Service
  Service:    检查邮箱是否已注册 → 哈希密码 → 创建用户 → 返回
  Repository: 执行 Prisma 查询
```

---

## 🌙 晚上 40 分钟（动手写代码）

### 第一步：创建企业目录结构（5 分钟）

```bash
mkdir -p src/database
mkdir -p src/database/repositories
mkdir -p src/database/services
mkdir -p src/database/types
```

```
src/database/
├── client.ts              ← Prisma Client 单例
├── repositories/
│   └── user.repository.ts ← User 数据访问层
├── services/
│   └── user.service.ts    ← User 业务逻辑层
└── types/
    └── user.types.ts      ← 数据 DTO 类型
```

### 第二步：创建 Prisma Client 单例（3 分钟）

**`src/database/client.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

/**
 * Prisma Client 全局单例
 *
 * 为什么是单例？
 * - Next.js 开发模式下热重载会创建多个连接
 * - Serverless 环境每个请求都创建连接会耗尽连接池
 * - 全局缓存规避这个限制
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
```

### 第三步：创建 UserRepository（10 分钟）

**`src/database/repositories/user.repository.ts`**

用 Claude 生成骨架代码，Prompt：

```
帮我生成 User Repository。
项目路径：/Users/maxiangan/Desktop/project/ai
技术栈：Prisma + TypeScript

要求：
1. 文件路径 src/database/repositories/user.repository.ts
2. Prisma Client 从 src/database/client.ts 引入
3. Repository 只做数据查询，不做业务逻辑
4. 方法包括：
   - findByEmail(email: string)
   - findById(id: string)
   - create(data: CreateUserInput)
   - update(id: string, data: Partial<User>)
   - delete(id: string)
5. 不要直接暴露 Prisma 类型，定义 Data Transfer Types
6. 排除密码等敏感字段（默认不返回 passwordHash 和 salt）
7. 包含 JSDoc 注释
```

**关键点：**
- 理解为什么 Repository 返回的 User 不包含 passwordHash/salt
- 理解为什么 CreateUserInput 是单独定义的 DTO 而不是 Prisma 类型
- 理解为什么用 Partial<> 而不是直接暴露 Prisma 的更新方法

### 第四步：创建 UserService（10 分钟）

**`src/database/services/user.service.ts`**

Prompt：

```
在 /Users/maxiangan/Desktop/project/ai 项目下，
生成 User Service 层。

文件路径：src/database/services/user.service.ts

要求：
1. 依赖 UserRepository，不依赖 Prisma
2. 依赖 src/lib/auth/utils.ts 中的密码哈希函数
3. 方法：
   - register(email, password, name) → 创建用户、返回 User（不含密码）
   - login(email, password) → 验证密码、返回 User
   - getProfile(userId) → 获取用户信息
   - updateProfile(userId, data) → 更新基本信息
4. 业务规则：
   - 注册时检查邮箱是否已存在
   - 密码由 Service 层哈希（不是 Repository）
   - 只返回 User 公开信息（不含密码）
5. 异常处理：抛出自定义业务异常
```

### 第五步：重构 API Route（5 分钟）

修改 `src/app/api/auth/register/route.ts`：
- 注入 UserService
- 删除直接操作用户存储的逻辑
- Controller 只做：解析请求 → 调 Service → 返回响应

修改 `src/app/api/auth/login/route.ts`：
- 同样用 UserService
- 保持 JWT 生成逻辑

### 第六步：前端从 localStorage 切换到数据库（5 分钟）

回顾 `src/store/chat-store.ts` 和 `src/store/interview-store.ts`：

**今天的目标：User 相关的数据不再从 localStorage 读取。**

修改 `src/lib/auth/store.ts`：
- 保留现有文件持久化作为 fallback
- 优先从数据库读取用户信息
- 前端通过 `GET /api/auth/me` 获取当前用户

### 第七步：验证 + Commit（2 分钟）

```bash
npm run build    # 确保没有类型错误
git add -A
git commit -m "feat: 接入 Prisma + User 企业三层架构

- 创建 database/ 目录（Client / Repository / Service）
- 实现 UserRepository（数据访问封装）
- 实现 UserService（业务逻辑层）
- 重构 auth API Route（Controller 层）
- 前端用户数据切换到数据库查询

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 📝 睡前 10 分钟

### 更新 docs/15-postgresql.md

新增章节：

```markdown
## 八、企业三层架构设计

### 8.1 为什么分层？
（对比不分层的 4 个问题：重复、散落、难测、难改）

### 8.2 Repository 层
（接口定义、职责边界、数据转换）

### 8.3 Service 层
（业务规则守护者、事务边界协调者）

### 8.4 Controller 层
（纯路由职责、无业务逻辑）

### 8.5 目录结构图
  src/database/
  ├── client.ts
  ├── repositories/
  ├── services/
  └── types/
```

### 回答 3 个问题

```
Q1：为什么不能把 Prisma 查询直接写在 API Route 里？
A1：（从测试、复用、维护三个角度回答）

Q2：Service 层和 Repository 层的边界怎么划？
A2：（什么算业务逻辑、什么算数据访问）

Q3：如果以后从 Prisma 换到 Drizzle，需要改哪些文件？
A3：（只有 Repository 层，Service 和 Controller 不动）
```

### 🎤 面试模拟

```
我是阿里 P7+ 面试官。
追问企业架构：
① 你用过哪些设计模式？Repository 和 DAO 有什么区别？
② 如果不用依赖注入，Service 怎么测试？
③ 三层架构每层都 throw error，前端怎么区分？
④ 一个接口先查 User 再查 Order，事务怎么控制？
⑤ 表结构改了，Repository 和 Service 都要改，分层有意义吗？
```

---

## 📁 今日产出

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
  src/lib/auth/store.ts

更新：
  docs/15-postgresql.md ← 新增三层架构章节
```

---

## ⚠️ 常见陷阱

| 陷阱 | 正确做法 |
|------|---------|
| 想直接跳过 Repository 写 Service | Repository 必须先写，Service 依赖它 |
| 把 Prisma 类型直接暴露出去 | 定义自己的 DTO，不暴露数据库结构 |
| Service 里直接调 Prisma | Service 只能调 Repository，不能调 Prisma |
| 一个文件写 200 行 | Repository 和 Service 分开文件 |

---

## 📌 明天预告

Day 4 — Resume 数据持久化

```
🚇 理解：为什么简历数据要单独建表？JSON 字段不行吗？
🌙 动手：ResumeRepository + ResumeService + Upload API
📝 产出：简历上传 → 解析 → 分析 → 落库 完整链路
```

---

[← Day 2](day-02.md) | [Day 4 →](day-04.md)
