# 🚇 地铁 30 分钟 — 企业三层架构：Repository / Service / Controller

> **阅读场景：** 通勤地铁上，只看不写
> **阅读时间：** 30 分钟
> **目标：** 理解为什么企业不直接 page → 数据库，三层架构各层的职责

---

## ① 为什么企业不直接 page → 数据库？

**一句话：当你只有一个 API Route 时，直接查 Prisma 看起来很"简单"。当你有 50 个 API Route 时，这种做法会变成灾难。**

### 直观的写法（新手）

```typescript
// src/app/api/users/route.ts
import { prisma } from "@/database/client";

export async function POST(request: Request) {
  const body = await request.json();
  
  // 直接在这里写查询逻辑
  const existingUser = await prisma.user.findUnique({
    where: { email: body.email }
  });
  
  if (existingUser) {
    return Response.json({ error: "邮箱已注册" }, { status: 409 });
  }
  
  const user = await prisma.user.create({
    data: { email: body.email, name: body.name, /* ... */ }
  });
  
  return Response.json({ user });
}
```

**这段代码看起来很简洁。它有什么问题？**

### 问题 1：同样的查询到处复制

```
src/app/api/auth/login/route.ts:
  const user = await prisma.user.findUnique({ where: { email } });
  
src/app/api/auth/register/route.ts:
  const existing = await prisma.user.findUnique({ where: { email } });

src/app/api/admin/users/route.ts:
  // 管理员查用户也要写一遍

src/app/api/profile/route.ts:
  // 个人中心也要写一遍
```

你写了 5 遍 `prisma.user.findUnique({ where: { email } })`，有一天 Prisma API 变了（比如升级版本），你要改 5 个文件。

### 问题 2：业务逻辑散落在各处

```
login route:      检查密码 → 用了 bcrypt.compare
register route:   检查密码 → 用了 bcrypt.hash（又写了一次 bcrypt 逻辑）
                  邮箱转小写 → login route 写了一次，register route 又写了一次

有一天你想改密码算法：
  bcrypt → argon2
  你要找所有涉及密码的文件，逐个修改
  漏掉一个就是 Bug（生产环境登录失败）
```

### 问题 3：没法测试

```
你想测试"注册功能是否正确"。
但测试脚本要：
  1. 启动整个 Next.js 服务器
  2. 发送 HTTP 请求
  3. 检查数据库

这叫做"集成测试"——慢、复杂、不可靠。

如果你把业务逻辑写在 Service 里：
  测试 Service 只需要 mock Repository
  不依赖网络、不依赖 HTTP、不启动服务器
  100ms 跑完 50 个测试用例
```

### 问题 4：改不动

```
今天你用 Prisma + PostgreSQL。
换了 CTO 说："我们要换 MongoDB"。

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

### 结论

| 架构 | 20 个 API 时 | 50 个 API 时 | 100 个 API 时 |
|------|-------------|-------------|--------------|
| 直接 Prisma | 看起来快 | 重复代码多 | 灾难 |
| 三层架构 | 前期多写几行 | 每个新 API 更快 | 维护轻松 |

**不是三层架构"更复杂"。是 50 个 API Route 的时候，不分层才会变得复杂。**

---

## ② Repository 模式的核心思想

### Repository 不是"把 Prisma 的方法换个名字"

```typescript
// ❌ 错误示范：Repository 只是 Prisma 的别名
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

**这没有意义。你在 Prisma 外面包了一层，但什么都没封装。**

### Repository 的正确职责

```typescript
// ✅ 正确的 Repository：封装了"数据访问的细节"
class UserRepository {
  async findByEmail(email: string) {
    // 封装了：邮箱小写化 + 敏感字段过滤
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {  // 明确不返回 passwordHash 和 salt
        id: true, email: true, name: true, 
        createdAt: true, updatedAt: true
      }
    });
  }

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { /* 常规字段，不包含大字段 */ }
    });
  }

  async create(data: CreateUserInput) {
    return prisma.user.create({
      data: {
        ...data,
        email: data.email.toLowerCase(),
      },
      select: { /* 返回安全的字段集 */ }
    });
  }

  async updatePassword(id: string, newHash: string) {
    // 单独的密码更新方法，不暴露整个 update API
    return prisma.user.update({
      where: { id },
      data: { passwordHash: newHash },
      select: { id: true, email: true }
    });
  }
}
```

### Repository 的边界

| ✅ 做 | ❌ 不做 |
|------|--------|
| 封装 Prisma 查询 | 不做业务判断（"密码是否正确"不是 Repository 的事） |
| 字段过滤（不返回密码等敏感字段） | 不做事务控制（事务是 Service 的事） |
| 提供业务友好的接口（`findActiveUsers()` 而非 `find({where: {status: "active"}})`） | 不调外部服务（不发邮件，不写日志） |
| 数据格式转换（DB 模型 → 业务 DTO） | 不处理 HTTP 请求（那不是 Controller 的事） |

**判断标准：** 看方法的命名。

- `findByEmail(email)` → Repository（描述"怎么查"）
- `registerUser(email, password)` → Service（描述"为什么要做"）

---

## ③ Service 层到底"服务"什么？

### Service 是"业务规则的守护者"

```
Controller 说："用户要注册"
Service 说："让我检查这个注册是否合法"

Controller 说："用户要下单"
Service 说："让我检查库存够不够、余额足不足"
```

### 以注册为例的三层协作

```
POST /api/auth/register
  Body: { email: "alice@test.com", password: "123456", name: "Alice" }
```

**Controller（接收请求）**:

```typescript
export async function POST(request: Request) {
  const body = await request.json();
  
  // Controller 只做两件事：
  // 1. 解析输入
  // 2. 调 Service → 返回结果
  const result = await userService.register(body.email, body.password, body.name);
  
  return Response.json(result, { status: 201 });
}
```

**Service（检查规则）**:

```typescript
class UserService {
  async register(email: string, password: string, name: string) {
    // Service 做 4 件事：
    
    // 1. 校验业务规则
    if (password.length < 6) throw new Error("密码至少 6 位");
    if (name.length < 2) throw new Error("姓名至少 2 个字符");
    
    // 2. 检查业务状态（调 Repository）
    const existing = await userRepo.findByEmail(email);
    if (existing) throw new Error("邮箱已注册");
    
    // 3. 处理业务逻辑（密码哈希）
    const salt = await generateSalt();
    const passwordHash = await hashPassword(password, salt);
    
    // 4. 协调多个 Repository（事务控制）
    const user = await userRepo.create({
      email, name, passwordHash, salt
    });
    
    return user;
  }
}
```

**Repository（执行查询）**:

```typescript
class UserRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });
  }

  async create(data: CreateUserInput) {
    return prisma.user.create({
      data: { ...data, email: data.email.toLowerCase() }
    });
  }
}
```

### Service 对 Repository 的依赖关系

```
                  Controller
                      │
                      ▼
                  Service ←── 调多个 Repository
                  │     ↑
                  │     │
                  ▼     │
            Repository ←─ 调 Prisma
                  │
                  ▼
               PostgreSQL
```

**关键约束：**
- **Controller 不能直接调 Repository**
- **Service 不能直接调 Prisma**
- **Repository 不抛业务异常（只抛数据库异常）**
- **Service 抛的异常是有语义的（"邮箱已注册"而非"数据库唯一约束冲突"）**

---

## ④ Controller 只做 API 路由

### Controller 的职责清单

```
✅ 解析 HTTP 请求（表单、JSON、查询参数）
✅ 调用 Service
✅ 格式化 HTTP 响应（JSON、状态码、Header）
✅ 处理认证（解析 JWT、提取用户 ID）
❌ 不写业务逻辑
❌ 不写数据查询
❌ 不处理事务
```

### 好的 Controller vs 坏的 Controller

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
  // 什么都有，什么都不做——这就是 Controller
  return Response.json({ user }, { status: 201 });
}
```

### 一个"薄"Controller 的标准模板

```typescript
export async function POST(request: NextRequest) {
  // 1. 解析请求
  const body = await request.json();
  
  // 2. 调用 Service
  const result = await userService.register(body.email, body.password, body.name);
  
  // 3. 返回响应
  return NextResponse.json(result, { status: 201 });
  //       ^ Controller 的最后一件事是"返回"
}
```

**Controller 越薄，你的代码越容易测试、越容易维护。**

---

## ⑤ 如果不用这套架构，直接用 Prisma Client 会怎样？

假设你的项目有 10 个 API Route。你用"最快的方式"——直接在路由里调 Prisma。

**第 1 周（10 个 API）：** 看起来很好，每个路由 30 行，简单直接。

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

```typescript
// 一个新来的同事问："这个用户是怎么查的？"
// 你要他看 60 个文件才能回答
// 没有一个地方是"查用户的统一入口"
```

### 三层架构带来的"可维护性资产负债表"

| 资产（前期投入） | 负债（后期收益） |
|----------------|----------------|
| 多写 3 个文件（Repository / Service / Types） | 查询逻辑只写一次 |
| 多写几行接口定义 | 换数据库改 1 个文件 |
| 额外的抽象层 | 测试可以 mock，不依赖数据库 |
| 命名规范（findBy / create / update） | 新同事 5 分钟理解数据层 |
| Service 层业务规则集中 | 改业务逻辑找 1 个文件 |

---

## ⑥ 总结：今天通勤记住的三句话

| # | 一句话 |
|---|--------|
| 1 | 不分层 = 每个 API Route 独立重复写查询逻辑。分层 = "查询只写一次，业务只写在一个地方"。 |
| 2 | Repository 封装"怎么查"（Prisma 查询 + 字段过滤）。Service 决定"为什么要查"（业务规则 + 事务）。 |
| 3 | Controller 越薄越好。它只做三件事：解析请求 → 调 Service → 返回响应。 |

**明天见。** 明天理解 Resume 为什么单独建表，为什么不简单用 JSON 字段。

---

[← Day 2 地铁](../02/day-02-subway.md)
