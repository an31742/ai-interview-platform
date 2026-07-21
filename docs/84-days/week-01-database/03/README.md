# 企业三层架构：Repository / Service / Controller 的本质

> **视角：** 企业级软件架构师  
> **日期：** 2026-07-15
> **背景：** AI 面试训练平台从 localStorage 迁移到 PostgreSQL，引入企业三层架构，告别"直接 page → 数据库"

---

## 目录

1. [为什么企业不直接 page → 数据库？](#一为什么企业不直接-page--数据库)
2. [Repository 模式的核心思想是什么？](#二repository-模式的核心思想是什么)
3. [Service 层到底"服务"什么？](#三service-层到底服务什么)
4. [Controller 只做 API 路由，为什么不把逻辑写里面？](#四controller-只做-api-路由为什么不把逻辑写里面)
5. [不用三层架构，直接用 Prisma Client 会怎样？](#五不用三层架构直接用-prisma-client-会怎样)
6. [结合项目：User 注册流程的三层协作](#六结合项目user-注册流程的三层协作)

---

## 一、为什么企业不直接 page → 数据库？

### 本质：不是"分层更复杂"，而是"不分层在 50 个 API 后必死"

当你只有一个 API Route 时，直接在路由里写 Prisma 查询看起来"简单直接"。但当你有 50 个 API Route 时，这种做法会变成灾难。

#### 4 个企业级痛点

**痛点 1：同样的查询到处复制**

```
login route:       prisma.user.findUnique({ where: { email } })
register route:    prisma.user.findUnique({ where: { email } })
admin route:       prisma.user.findUnique({ where: { email } })
profile route:     prisma.user.findUnique({ where: { email } })
```

写了 5 遍一样的代码。有一天 Prisma API 升级了，`findUnique` 参数变了——你要改 5 个文件。项目经理问"改完了吗"——你说"快了，还有 3 个文件没改"。

**痛点 2：业务逻辑散落在各处**

```
login route:      用了 bcrypt.compare 检查密码
register route:   用了 bcrypt.hash 加密密码（又写了一遍）
                  邮箱转小写 → login 写了一次，register 又写了一次

有一天你要改密码算法：
  bcrypt → argon2
  你要找所有涉及密码的文件，逐个修改
  漏掉一个就是 Bug（生产环境登录失败，用户骂街）
```

**痛点 3：没法测试**

```
你想测试"注册功能是否正确"。
但测试脚本要：
  1. 启动整个 Next.js 服务器
  2. 发送 HTTP 请求
  3. 检查数据库

这叫"集成测试"——慢、复杂、不可靠。

如果你有 Service 层 + Repository 层：
  测试 Service 只需要 mock Repository
  不依赖网络、不依赖 HTTP、不启动服务器
  100ms 跑完 50 个测试用例
```

**痛点 4：换数据库 = 换所有文件**

```
今天你用 Prisma + PostgreSQL。
换了个 CTO 说："我们要换 MongoDB"。

如果你把 Prisma 查询写在每个 API Route 里：
  → 要改 50 个文件
  → 每改一个都要重新测试
  → 改到一半 CTO 说"算了不换了" → 白做

如果你有 Repository 层：
  → 只改 Repository 里的 Prisma 调用
  → Service 层完全不动
  → Controller 层完全不动
  → 换数据库 = 改 3 个文件
```

#### 企业选择的本质

```
API Route 直接查数据库：
  "看起来简单" → 20 个 API 后 → "重复代码真多" → 50 个 API 后 → "改不动了"

三层架构：
  "前期多写几个文件" → 20 个 API 后 → "加 API 好快" → 50 个 API 后 → "维护真轻松"

不是三层架构"更复杂"——是 50 个 API Route 的时候，不分层才会变得复杂。
```

---

## 二、Repository 模式的核心思想是什么？

### 本质：Repository 不是"把 Prisma 的方法换个名字"，而是"让业务代码不知道数据从哪来"

#### 错误示范：Repository = Prisma 的别名

```typescript
// ❌ 这不是 Repository，这是 Prisma 的皮
class UserRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }
  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }
  async create(data: any) {
    return prisma.user.create({ data });
  }
}
```

**这没有意义。** 你在 Prisma 外面包了一层，但什么都没封装。Service 层仍然要自己处理"邮箱转小写"、"过滤密码字段"——你只是把 Prisma 的 import 换成了 Repository 的 import。

#### Repository 的正确职责

Repository 封装的不是"方法名"，而是**数据访问的细节**：

```
✅ 封装的细节：

  1. 字段过滤
    → 默认不返回 passwordHash、salt、deletedAt 等敏感/内部字段
    → Controller 不需要记得"过滤密码"

  2. 数据转换
    → 数据库的 DateTime 转成业务层的 Date
    → Prisma 的枚举类型转成业务的字符串常量

  3. 查询优化
    → 加缓存（Redis 判断，命中返回，不命中再查数据库）
    → 分页封装（封装 cursor / offset 分页逻辑）

  4. 统一过滤
    → 所有查 User 的地方都自动过滤 deleted_at IS NULL（软删除）
    → 不需要每个调用方都写 WHERE deleted_at IS NULL

❌ 不做的：

  1. 不做业务判断
    → "密码是否正确"不是 Repository 的事
    → "邮箱是否已注册"不是 Repository 的事

  2. 不做事务控制
    → 事务是 Service 的事（可能要跨多个 Repository）

  3. 不调外部服务
    → 不发邮件、不写日志、不调用第三方 API
```

#### Repository 的命名规范

```
方法名 = 描述"怎么查"，不是描述"为什么查"

✅ Repository:
    findByEmail(email)           → "用邮箱查用户"
    findActiveUsers(since)       → "查活跃用户"
    create(data)                 → "创建用户"
    updatePassword(id, hash)     → "更新密码"
    softDelete(id)               → "软删除"

❌ 这些不是 Repository:
    registerUser(email, password)  → "注册用户" 是 Service 的事
    loginUser(email, password)     → "登录" 是 Service 的事
    validatePassword(email, pwd)   → "验证密码" 是 Service 的事
```

**判断标准：** 看方法名是否描述了"业务意图"。

```
findByEmail → 描述了"怎么查" → Repository
registerUser → 描述了"为什么做" → Service
```

---

## 三、Service 层到底"服务"什么？

### 本质：Service 是"业务规则的守护者"——Controller 说"用户要注册"，Service 说"让我检查这个注册是否合法"

#### Service 的职责清单

```
✅ 做的：

  1. 校验业务规则
    → 密码长度 >= 6 位
    → 邮箱格式正确
    → 用户名不包含特殊字符

  2. 检查业务状态
    → 调 Repository 查邮箱是否已注册
    → 调 Repository 查用户有没有权限
    → 调 Repository 查资源是否存在

  3. 处理业务逻辑
    → 密码哈希（调工具函数）
    → 生成 JWT Token
    → 计算评分、生成报告

  4. 协调多个 Repository
    → 创建用户 + 创建默认配置（事务控制）
    → 更新简历 + 删除旧版本
    → 跨多个数据源的协调

❌ 不做的：

  1. 不处理 HTTP 请求
    → request.json、NextResponse、cookies 都不是 Service 的事

  2. 不直接操作数据库
    → Service 只能调 Repository，不能调 Prisma

  3. 不抛 HTTP 语义的异常
    → 抛 "邮箱已注册"，不抛 "409 Conflict"
    → 抛 "密码错误"，不抛 "401 Unauthorized"
```

#### Service 对 Repository 的依赖关系

```
          Controller（HTTP 处理）
              │
              ▼
          Service（业务规则）
           │         ↑
           │         │
           ▼         │
    Repository（数据访问）
              │
              ▼
          Prisma / PostgreSQL
```

**两个关键约束：**

```
约束 1：Controller 不能直接调 Repository
  → 业务规则必须在 Service 中执行
  → 绕过 Service = 绕过业务规则 = Bug

约束 2：Service 不能直接调 Prisma
  → 数据访问细节必须在 Repository 中封装
  → 绕过 Repository = 数据访问逻辑散落 = 改不动
```

#### Service 的异常设计

Service 抛的异常和 HTTP 状态码无关。它是"业务语言"：

```
// Service 层
class UserService {
  async register(email: string, password: string) {
    if (password.length < 6) {
      throw new BusinessError('密码长度不能少于 6 位');   // ← 业务语义
    }
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw new BusinessError('该邮箱已被注册');           // ← 业务语义
    }
    // ...
  }
}

// Controller 层把业务异常转成 HTTP 响应
try {
  await userService.register(email, password);
} catch (error) {
  if (error instanceof BusinessError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  return Response.json({ error: '服务器内部错误' }, { status: 500 });
}
```

**目的：** Service 不依赖 HTTP，它可以在任何场景复用（CLI、消息队列、定时任务）。

---

## 四、Controller 只做 API 路由，为什么不把逻辑写里面？

### 本质：Controller 是"翻译官"，不是"决策者"

Controller 把 HTTP 请求翻译成 Service 调用，再把 Service 的结果翻译成 HTTP 响应。它不做任何业务决策。

#### Controller 的职责清单

```
✅ 做的：
  1. 解析 HTTP 请求
    → body.json()、URL 参数、query string、headers
  2. 调用 Service
    → 调 userService.register(email, password, name)
  3. 格式化 HTTP 响应
    → Response.json(result)、状态码、Header
  4. 处理认证
    → 解析 JWT → 提取 userId → 传给 Service

❌ 绝对不做的：
  1. 不写业务逻辑
    → 不校验密码强度、不检查邮箱格式
  2. 不写数据查询
    → 不调 Prisma、不写 SQL
  3. 不处理事务
    → 不开事务、不提交、不回滚
```

#### 坏的 Controller vs 好的 Controller

```typescript
// ❌ 坏的 Controller：把业务逻辑写在路由里
export async function POST(request: Request) {
  const body = await request.json();

  // 业务逻辑混在这里
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await bcrypt.hash(body.password + salt, 10);

  const existing = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase() }
  });

  if (existing) {
    return Response.json({ error: "邮箱已注册" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: { email: body.email, name: body.name, passwordHash: hash, salt }
  });

  return Response.json({ user });
}

// ✅ 好的 Controller：只做编排
export async function POST(request: Request) {
  const body = await request.json();
  const user = await userService.register(
    body.email, body.password, body.name
  );
  return Response.json({ user }, { status: 201 });
  // ↑ Controller 的最后一件事是"返回"
}
```

> **Controller 越薄，你的代码越容易测试、越容易维护。**
>
> 一个 Controller 的理想长度：**不超过 10 行**。超过 10 行说明有些逻辑应该下沉到 Service 或中间件。

---

## 五、不用三层架构，直接用 Prisma Client 会怎样？

### 本质：这是一个时间问题——不是"会不会出问题"，而是"什么时候出问题"

#### 时间线推演

**第 1 周（10 个 API）：**

```
看起来很好。每个路由 30 行，简单直接。
你觉得自己很高效——"什么三层架构，我这样更简单"。
```

**第 3 周（30 个 API）：**

```typescript
// route A: 查用户
const user = await prisma.user.findUnique({ where: { email } });

// route B: 查用户（一样的查询，但忘了加 select）
const user = await prisma.user.findUnique({ where: { email } });
// 返回了 passwordHash → 被不小心返回给前端

// route C: 查用户（又写了一遍，但用了不同的过滤方式）
const existing = await prisma.user.findFirst({ where: { email: email.toLowerCase() } });
// route A 没有 toLowerCase()，route C 有 → 不一致
```

**第 6 周（60 个 API）：**

```
要改密码算法：
  → 搜索所有涉及密码的文件
  → 在 60 个文件里找到 12 个涉及密码的
  → 逐个修改
  → 漏了一个 → 生产环境 Bug

要加缓存：
  → 每个查询都要加 Redis 判断
  → 修改 60 个文件

要换 ORM（Prisma → Drizzle）：
  → 改 60 个文件
  → 祈祷没有遗漏
```

**第 12 周（重构成本高到无法行动）：**

```
一个新来的同事问："这个用户是怎么查的？"
你打开 60 个文件，自己也记不清了。
没有一个地方是"查用户的统一入口"。
```

#### 三层架构的"可维护性资产负债表"

| 资产（前期投入） | 负债（后期收益） |
|----------------|----------------|
| 多写 3 个文件（Repository / Service / Types） | 查询逻辑只写一次 |
| 多写几行接口定义 | 换数据库改 1 个文件 |
| 额外的抽象层 | 测试可以 mock，不依赖数据库 |
| 命名规范（findBy / create / update） | 新同事 5 分钟理解数据层 |
| Service 层业务规则集中 | 改业务逻辑找 1 个文件 |

#### 一个实用原则

> **不需要所有 API 都分层。需要分层的标准是：**
>
> 1. 这个查询会被多处使用吗？→ 是 → 抽 Repository
> 2. 这个逻辑涉及业务规则吗？→ 是 → 抽 Service
> 3. 这个接口需要测试吗？→ 是 → 分层
>
> 如果是一个只在一个地方用、没有任何业务规则、不需要测试的简单查询——写在 Controller 里也可以。
>
> **但要确定"它永远不会变"。在软件工程里，"永远不会变"几乎只在写文档的时候成立。**

---

## 六、结合项目：User 注册流程的三层协作

### 当前项目现状

```
现在你的 User 注册流程：

POST /api/auth/register
  → src/app/api/auth/register/route.ts
    → 直接操作 .rag-data/users.json（JSON 文件读写）
    → 没有类型检查
    → 没有事务
    → 没有密码盐值管理（或者写在代码里）
    → 返回整个 User 对象（包含 passwordHash！）
```

### 引入三层架构后的流程

```
         HTTP Request
              │
              ▼
    ┌─────────────────────┐
    │   Controller        │  ← 解析请求体 JSON
    │   register.route.ts │  ← 调 Service
    │                     │  ← 返回响应
    └──────┬──────────────┘
           │ userService.register(email, password, name)
           ▼
    ┌─────────────────────┐
    │   Service           │  ← 校验密码强度
    │   user.service.ts   │  ← 查邮箱是否重复
    │                     │  ← 哈希密码（调工具函数）
    │                     │  ← 创建用户（调 Repository）
    └──────┬──────────────┘
           │ userRepo.create(data)
           ▼
    ┌─────────────────────┐
    │   Repository        │  ← 执行 Prisma 查询
    │   user.repository   │  ← 过滤敏感字段
    │                     │  ← 邮箱转小写
    └──────┬──────────────┘
           │ prisma.user.create(...)
           ▼
    ┌─────────────────────┐
    │   PostgreSQL        │
    │   users 表          │
    └─────────────────────┘
```

### 每层负责什么

```
Controller（3 行）：解析请求 → 调 Service → 返回响应
  export async function POST(request: Request) {
    const body = await request.json();
    const user = await userService.register(body.email, body.password, body.name);
    return Response.json({ user }, { status: 201 });
  }

Service（15 行）：检查规则 → 哈希密码 → 创建用户
  async register(email: string, password: string, name: string) {
    if (password.length < 6) throw new BusinessError('密码强度不够');
    const existing = await userRepo.findByEmail(email);
    if (existing) throw new BusinessError('邮箱已注册');
    const { hash, salt } = await hashPassword(password);
    return userRepo.create({ email, name, passwordHash: hash, salt });
  }

Repository（5 行）：Prisma 查询
  async create(data: CreateUserInput) {
    return prisma.user.create({
      data: { ...data, email: data.email.toLowerCase() },
      select: { id: true, email: true, name: true, createdAt: true }
    });
  }
```

### 三个核心约束

```
约束 1: Controller → Service → Repository，不能跳层
  → Controller 不调 Repository
  → Service 不调 Prisma

约束 2: 每层只做自己的事
  → Controller 不写业务逻辑
  → Service 不写数据查询
  → Repository 不抛业务异常

约束 3: 异常逐层转换
  Repository → 数据库异常（PrismaError）
  Service    → 业务异常（BusinessError）
  Controller → HTTP 异常（Response.json + status code）
```

---

## 核心结论

| # | 本质 | 一句话 |
|---|------|--------|
| 1 | 为什么分层 | 不分层 = 每个 API Route 独立重复写查询。分层 = "查询只写一次，业务只写在一个地方" |
| 2 | Repository | 封装"怎么查"（查询细节 + 字段过滤），不决定"为什么查" |
| 3 | Service | 业务规则的守护者，协调多个 Repository，控制事务边界 |
| 4 | Controller | 越薄越好——解析请求 → 调 Service → 返回响应，三行代码 |
| 5 | 不分层的代价 | 10 个 API 时看起来很爽，50 个 API 时改不动，100 个 API 时重写 |
| 6 | 项目中的 User | 从 JSON 文件读写 → 三层架构，这是"能用的项目"到"能维护的项目"的分水岭 |
