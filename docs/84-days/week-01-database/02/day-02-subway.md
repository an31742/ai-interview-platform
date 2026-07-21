# 🚇 地铁 30 分钟 — Prisma 核心概念：Schema / Migration / ORM

> **阅读场景：** 通勤地铁上，只看不写
> **阅读时间：** 30 分钟
> **目标：** 理解 ORM 为什么存在、Schema 为什么重要、Migration 是什么

---

## ① ORM 为什么出现？它解决了什么痛苦？

**一句话：ORM 解决的是"阻抗不匹配"——数据库是关系模型，JavaScript 是对象模型，两者天然合不到一起。**

### 没有 ORM 的世界

假设你要做一个"查用户"的功能。

**数据库里的样子（关系模型）：**

```
users 表：
  id | email           | name     | password_hash
  1  | a@b.com         | 张三     | $2b$10$...
  2  | c@d.com         | 李四     | $2b$10$...
```

**JavaScript 里的样子（对象模型）：**

```javascript
class User {
  constructor(id, email, name) {
    this.id = id;
    this.email = email;
    this.name = name;
  }

  getDisplayName() {
    return this.name + '(' + this.email + ')';
  }
}
```

**没有 ORM，你要写这样的代码：**

```javascript
// Step 1: 拼 SQL 字符串 —— 容易拼错、SQL 注入
const sql = `SELECT * FROM users WHERE email = '${email}'`;

// Step 2: 执行查询 —— 拿到的是数组，不是对象
const rows = await db.query(sql);
// rows = [ { id: 1, email: 'a@b.com', name: '张三', password_hash: '...' } ]

// Step 3: 手动映射成对象 —— 重复劳动
const user = new User(rows[0].id, rows[0].email, rows[0].name);
// 你还要决定：password_hash 要不要传？要不要过滤掉？

// Step 4: 还要考虑类型转换 —— 数据库返回的 id 是 number 还是 string？
// Step 5: 还要处理关联查询 —— 查用户的同时查他的简历？
// Step 6: 还要处理事务 —— 创建用户 + 创建配置，必须一起成功或一起失败
```

**每写一个查询，你都要重复这 6 步。这就是阻抗不匹配。**

### ORM 做的事

ORM 在这四步中间加了一层自动映射：

```
写代码时：            User.findByEmail('a@b.com')
                       ↓
ORM 自动生成：        SELECT * FROM users WHERE email = 'a@b.com'
                       ↓
数据库返回：          [ { id: 1, email: 'a@b.com', name: '张三', ... } ]
                       ↓
ORM 自动映射：        User { id: 1, email: 'a@b.com', name: '张三' }
                       ↓
你拿到的是：          User 对象，可以调 .getDisplayName()
```

### ORM 的代价

| 维度 | 好处 | 代价 |
|------|------|------|
| **开发速度** | 快 3-5 倍，不用写模板代码 | — |
| **类型安全** | 编译期发现字段名写错 | — |
| **数据库无关** | 换数据库改一行配置 | — |
| **复杂查询** | — | 复杂 JOIN / 聚合不如原生 SQL |
| **性能** | — | 有额外开销（但通常可忽略） |
| **学习曲线** | — | 要理解 ORM 的思维方式 |

**关键认知：ORM 不是银弹。80% 的增删改查用它，20% 的复杂查询用原生 SQL。两项技能都需要。**

---

## ② Prisma 和其他 ORM 有什么本质不同？

### 传统 ORM（TypeORM / Sequelize）的模型

```typescript
// 传统 ORM：Active Record 模式
// 模型 = 数据库表 + 业务方法
class User extends Model {
  static async findByEmail(email: string) {
    return this.findOne({ where: { email } });
  }

  async getDisplayName() {
    return `${this.name} (${this.email})`;
  }
}

// 你用它：
const user = await User.findByEmail('a@b.com');
user.name = '新名字';
await user.save();
```

**问题：模型既是数据访问层，又是业务逻辑层，职责混在一起。**

### Prisma 的模型

```typescript
// Prisma：Data Mapper 模式
// Schema 是纯粹的"数据定义"，没有任何业务逻辑

// schema.prisma（纯声明）
model User {
  id    String @id @default(cuid())
  email String @unique
  name  String
}

// 使用时：Prisma Client 生成类型安全的查询对象
const user = await prisma.user.findUnique({
  where: { email: 'a@b.com' }
});
```

**三个本质区别：**

| 维度 | 传统 ORM | Prisma |
|------|---------|--------|
| **模型定义** | 用类/装饰器，混在代码里 | 用独立 Schema 文件，纯声明式 |
| **查询方式** | Model.find()，模型自带 CRUD | 自动生成 Prisma Client，类型安全 |
| **类型生成** | 需手动定义 TypeScript 类型 | Schema → Prisma Client → 类型自动推导 |

### 为什么 Prisma 的"Schema 优先"是更好的设计？

**传统 ORM 的问题：** 数据定义散落在不同文件的类装饰器里，你想知道 User 有哪些字段，要打开 5 个文件。

**Prisma 的方案：** 一个 `schema.prisma` 文件定义全部数据模型。这是你项目的"数据合约"——所有人看同一个文件就知道数据结构是什么。

**类比：**
```
传统 ORM：       TypeScript 类型定义分散在各文件 → 没有"单一数据视图"
Prisma Schema：  一个文件描述全部数据 → 团队共享的数据契约
```

---

## ③ Schema = 数据合约

### Schema 的本质

> Schema 是数据库的 TypeScript 类型定义。

**没有 Schema：**

```sql
-- 你知道 User 表存在，但不知道有哪些字段
SELECT * FROM users;
-- 返回了一大堆字段，有些是旧的、有些是废弃的
-- createdAt 是 string 还是 Date？不知道，要试
-- id 是 UUID 还是自增？不知道，要猜
```

**有 Schema：**

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

| 信息 | Schema 上看得到 | 裸 SQL 上看不到 |
|------|----------------|----------------|
| 字段类型 | String / Int / DateTime | VARCHAR / INTEGER — 要猜对应关系 |
| 默认值 | @default(now()) | 看建表语句 |
| 唯一约束 | @unique | 看索引定义 |
| 必填/可选 | String vs String? | 看 NOT NULL |
| 关系 | @relation | 看外键定义 |
| 自动更新 | @updatedAt | 看触发器 |

**Schema 是"告诉团队数据长什么样"的单一文件。它不依赖任何代码，不依赖任何运行环境。**

### Schema 和 TypeScript 类型的关系

你以前可能这样写过：

```typescript
// 手工定义类型 —— 需要和数据库保持一致，但经常忘了更新
interface User {
  id: string;
  email: string;
  name: string;
  createdAt: number;
}

// 后来数据库加了 avatarUrl 字段
// 你忘了更新 TypeScript 类型
// 代码里访问 user.avatarUrl → undefined，没有类型错误提醒
```

Prisma Schema + Prisma Client = 自动生成类型：

```prisma
// schema.prisma 改了
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  avatarUrl String?  ← 新增字段
  createdAt DateTime @default(now())
}
```

```bash
npx prisma generate
```

```typescript
// Prisma Client 自动更新的类型
const user: User = await prisma.user.findUnique({ where: { email: 'a@b.com' } });
// user.avatarUrl → string | null，类型安全
```

**Schema 是唯一的真相来源（Single Source of Truth）。改 Schema → 自动生成类型 → 编译期检查错误。不再出现"数据库改了，TypeScript 类型没改"的问题。**

---

## ④ Migration = 数据库的 Git

### Migration 的本质

```
Git                → 代码版本控制
Prisma Migration   → 数据库 Schema 版本控制
```

**没有 Migration 的世界：**

```
你改了 User 表结构：
  ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);

问题 1：开发环境改了，线上环境没改
  部署代码时忘了手动执行这条 SQL → 代码访问 avatar_url 字段 → 数据库报错

问题 2：同事不知道你改了
  他拉了你代码，但不知道要改数据库 → 运行时报错

问题 3：改错了想回退
  ALTER TABLE 没有"撤销"功能 → 你要手动写反向 SQL → 容易出错
```

**有 Migration 的工作流：**

```
你在 schema.prisma 里改了：
  model User {
    ...
    avatarUrl String?
  }

执行：
  npx prisma migrate dev --name add-avatar-url

发生了什么：
  Step 1: Prisma 对比当前数据库和 Schema 的差异
  Step 2: 生成 Migration SQL 文件
    202607140001_add_avatar_url/
      migration.sql:
        ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;

  Step 3: 执行 Migration，更新数据库
  Step 4: Migration 文件留存（提交到 Git）

同事拉代码后：
  npx prisma migrate dev
  → Prisma 检测到有未执行的 Migration
  → 自动执行 ALTER TABLE
  → 同事的数据库和你的完全一致
```

### Migration 的保证

| 场景 | 没有 Migration | 有 Migration |
|------|---------------|-------------|
| 加字段 | 手动执行 SQL，可能忘 | Schema 改了 → 自动生成 SQL |
| 改字段类型 | 手动写 ALTER，可能写错 | Prisma 生成正确的 ALTER |
| 删字段 | 手动删，可能删错 | 生成 DROP COLUMN，可预览 |
| 回滚 | 手动写反向 SQL | `prisma migrate reset` 回到初始 |
| 团队同步 | 靠口头通知 | Migration 文件在 Git 里 |

### 生产环境 Migration

```
开发环境：prisma migrate dev    → 自动创建 + 执行 Migration
测试环境：prisma migrate deploy → 只执行未执行的 Migration
生产环境：prisma migrate deploy → 只执行未执行的 Migration（需 Review SQL）
```

**关键原则：Migration 文件是"只追加"的。不要修改已提交的 Migration 文件，只新增。**

---

## ⑤ 结合项目：为什么 User 表需要一个 Schema 定义？

你的项目现在 User 是这样存的：

```typescript
// src/lib/auth/store.ts
interface UserWithPassword {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
}
```

**当前的问题（没有 Schema）：**

```
问题 1：字段定义在一个 TypeScript 接口里
  → 数据库里没有对应的表结构
  → 查询时"有哪些字段"完全靠代码保证
  → 换一个文件读 User，可能忘记过滤 passwordHash

问题 2：没有约束
  → email 必须唯一？代码里查了，但数据库没有 UNIQUE 约束
  → name 是否必填？代码里可能为空，数据库不检查
  → createdAt 谁维护？靠代码，但可能忘了设置

问题 3：无法高效查询
  → 想查"所有一周内注册的用户"
  → 当前 JSON 文件要全量加载到内存再遍历
  → 有 Schema + 数据库后，一条 SQL 搞定
  → `SELECT * FROM users WHERE createdAt > now() - interval '7 days'`
```

**有了 Schema 的 User：**

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique          ← 数据库保证唯一
  name         String                    ← 数据库保证非空
  passwordHash String                    ← 数据库层面的表，不用代码组织
  salt         String
  avatarUrl    String?                   ← 可选字段，明确标注
  createdAt    DateTime @default(now())   ← 数据库自动设置
  updatedAt    DateTime @updatedAt        ← 数据库自动更新
  lastLoginAt  DateTime?                 ← 以后扩展

  // 关系
  resumes      Resume[]                  ← 一对多关系声明
  sessions     InterviewSession[]

  @@map("users")
}
```

**Schema 带来的改变：**

| 之前（TypeScript 接口） | 之后（Prisma Schema） |
|------------------------|---------------------|
| 字段定义在代码里 | 字段定义在 Schema 里，数据库有真实表 |
| 唯一性靠代码检查 | UNIQUE 约束由数据库保证 |
| 时间戳靠代码设置 | @default(now()) 自动设置 |
| 类型靠 TypeScript | Prisma Client 生成类型，比 TS 更精确 |
| 关系靠注释说明 | @relation 显式声明，外键自动创建 |
| 查询只能全量加载 | 索引 + 条件查询，毫秒级响应 |

---

## ⑥ 总结：今天通勤记住的三句话

| # | 一句话 |
|---|--------|
| 1 | ORM 解决的是"数据库关系模型"和"JS 对象模型"之间的鸿沟。你不是在学 Prisma，是在解决这个不匹配。 |
| 2 | Schema 是数据库的 TypeScript 类型定义。它是团队的数据合约，不是某个框架的配置。 |
| 3 | Migration 是数据库的 Git。它让 Schema 变更可追踪、可回滚、可协作。 |

**明天见。** 明天理解企业为什么用三层架构（Repository / Service / Controller）。

---

[← Day 1 地铁](../01/day-01-subway.md)
