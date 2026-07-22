# 🐣 小白版 Week 1 — 企业级数据库（新手友好版）

> **这是原计划的「小白版」。**
> 原计划假设你有后端基础，你没有，所以这版按你的节奏来。
> 每完成一项就打 ✅，不要跳天。

---

## 📍 你现在的位置

```
你已完成的：                                           待完成的：
┌──────────────────────┐    ┌──────────────────────────┐
│ Day 0 ✅ 后端概念     │    │ Day 3  ⬜ Login/Me 改造   │
│ Day 1 ✅ Schema 设计  │    │ Day 4  ⬜ Resume 持久化   │
│ Day 2 ✅ 三层架构+注册 │    │ Day 5  ⬜ 面试对话落库    │
└──────────────────────┘    └──────────────────────────┘
```

---

## 🗓️ 完整日程

### Day 0 — 理解后端世界（✅ 已完成）

> 你学了三样东西，记在了 `03/` 目录下

| 概念 | 你理解了什么 |
|------|------------|
| **B：后端怎么工作** | 后端 = 等着被敲门 → 处理 → 返回。餐厅比喻：服务员（前端）→ 厨师（后端）→ 冰箱（数据库） |
| **C：前后端怎么连** | 前端用 fetch 发请求，后端处理完返回。前端不直接碰数据库 |
| **A：数据库是什么** | 数据库 = 带管家的仓库。SQLite/PostgreSQL/MySQL 是不同品牌 |

**产出：** `03/小白的学习笔记-理解后端和数据库本质.md`

---

### Day 1 — Prisma Schema 设计（✅ 已完成）

> 你学会了"先画图纸再施工"

| 步骤 | 你做了什么 |
|------|-----------|
| ① 理解表是什么 | 一张表 = 一类东西（User 表管用户、Resume 表管简历） |
| ② 理解表的关系 | 1:N 关系：一个用户 → 多份简历 |
| ③ 学 Prisma 语法 | 4 条规则：`字段名 类型 修饰符`、`?`可选、`@`修饰符、驼峰命名 |
| ④ 设计 User 表 | 6 个字段：id(cuid), email(@unique), name, passwordHash, createdAt, updatedAt |
| ⑤ 设计 Resume 表 | 9 个字段：id(自增), userId, resumeName, resumeContext(Json), size, score, status, createdAt, updatedAt |
| ⑥ 建库 | `npx prisma validate` ✅ → `npx prisma db push` ✅ → dev.db 创建成功 |

**你的决定（不是别人告诉你的）：**
- User id → `cuid()`（不怕暴露数量、不怕合并冲突）
- Resume id → `autoincrement()`（你自己选的）
- score → `Int` 类型
- status → 用文字（"上传中""解析中"），不用数字
- 时间戳 → 数据库自动维护（`@default(now())` / `@updatedAt`）

**产出：**
- `prisma/schema.prisma` ✅
- `dev.db`（SQLite 数据库文件）✅
- `02/` 下的 3 篇学习笔记 ✅

---

### Day 2 — 三层架构 + User 注册跑通（✅ 已完成）

> 你理解了"各司其职"，并亲手写代码验证了

| 你学的东西 | 你的理解 |
|-----------|---------|
| 三层架构 | Controller（服务员）→ Service（厨师）→ Repository（采购员） |
| 各层职责 | Controller只调Service → Service处理逻辑调Repository → Repository处理数据 |
| BusinessError | 业务错误（密码太短）和系统错误（服务器崩溃）分开处理 |
| 其他语言也这样 | Java/Python/Go 思路一样，只是语法不同 |

**你写的代码：**
- `src/database/client.ts` — Prisma Client 单例（装了 adapter）
- `src/database/repositories/user.repository.ts` — findByEmail / findById / create / toSafeUser
- `src/database/services/user.service.ts` — register / login / getProfile
- `src/app/api/auth/register/route.ts` — 从 90 行缩到 30 行的 Controller

**测试结果（都亲手验证了）：**
```
注册新用户 test@example.com → ✅ 201
重复邮箱                   → ✅ 409 "该邮箱已注册"
密码太短                   → ✅ 409 "密码至少 6 位"
返回数据不含密码            → ✅ passwordHash 没返回到前端
```

**花费时间：** 原计划 1 天，你用了 2 天。**这完全正常。** 因为你同时学了"后端是什么""API 是什么""数据库是什么"——这些原计划假设你已经会了。

---

### Day 3 — 改造 Login + Me（⬜ 待办）

> **目标：** 把登录和查用户信息的 API，也从 JSON 文件改成数据库

#### 背景

现在的情况：

```
register（注册）→ ✅ 已走数据库
login（登录）   → ❌ 还在读 .rag-data/users.json（JSON 文件）
me（查用户信息） → ❌ 还在读 JSON 文件
```

#### 要改的文件

| 文件 | 现在的代码 | 改成什么样 |
|------|-----------|-----------|
| `src/app/api/auth/login/route.ts` | 直接调 `findUserByEmail`（JSON） | 调 `userService.login()` |
| `src/app/api/auth/me/route.ts` | 直接调 `findUserById`（JSON） | 调 `userService.getProfile()` |

#### 做完后的效果

```
register → Controller → userService.register() → 数据库 ✅
login    → Controller → userService.login()    → 数据库 ✅  
me       → Controller → userService.getProfile() → 数据库 ✅

可以删掉 src/lib/auth/store.ts（JSON 文件存储）了
```

**预计时间：** 15-20 分钟（因为 Service 已经写好了，只改 Controller）

---

### Day 4 — Resume 数据持久化（⬜ 待办）

> **目标：** 把简历从 localStorage 存到数据库

#### 要做的事

| 步骤 | 做什么 | 时间 |
|------|-------|------|
| ① 先理解 | 为什么 Resume 单独建表？JSON 字段不行吗？ | 5 分钟 |
| ② 写 Repository | ResumeRepository（查+写简历数据） | 10 分钟 |
| ③ 写 Service | ResumeService（上传+校验+分析） | 10 分钟 |
| ④ 写 API | Resume Controller（上传/列表/详情） | 10 分钟 |
| ⑤ 验证 | 上传简历到数据库 | 5 分钟 |

#### 和 Day 2 的模式完全一样

```
Day 2 你写了：                Day 4 你要写：
user.repository.ts    →      resume.repository.ts
user.service.ts       →      resume.service.ts
register/route.ts     →      resume/route.ts
```

**你已经会了，只是换个实体（User → Resume）重复一遍。**

---

### Day 5 — 面试对话落库（⬜ 待办）

> **目标：** 把面试中的聊天记录存进数据库

#### 要做的事

| 步骤 | 做什么 |
|------|-------|
| ① 设计表 | Interview + Message 两个模型 |
| ② 写 Repository | interview.repository + message.repository |
| ③ 写 Service | interview.service（创建面试 + 保存对话） |
| ④ 写 API | 面试相关的 Controller |
| ⑤ 验证 | 跑一次面试，数据存进数据库 |

#### 关键区别

```
Resume（Day 4）：一次上传，多次读取
Interview（Day 5）：边聊边存，每一条消息都要即时存库
```

---

### ☀️ Day 6 — 集成 + 收尾（⬜ 待办）

> **目标：** 检查和修复，确保所有数据都不再从 JSON 文件/localStorage 读取

#### 检查清单

```
□ User 注册 → 走数据库
□ User 登录 → 走数据库
□ 查用户信息 → 走数据库
□ 简历上传/列表/删除 → 走数据库
□ 面试创建 → 走数据库
□ 对话消息 → 走数据库
□ 不再有读 JSON 文件的代码
□ 前端页面确认数据来源是 API 不是 localStorage
```

---

## ⚠️ 和原计划的区别

| 维度 | 原计划 | 小白版 |
|------|-------|-------|
| 天数 | 7 天 | 约 10 天 |
| Day 0 | 无 | ✅ 新增：后端/API/数据库本质概念 |
| Schema 设计 | Day 2 | Day 1（提前了） |
| 三层架构 | 分开学（Day 2 概念 + Day 3 实践） | 合并为一天学+做 |
| Login/Me 改造 | 没有单独列 | ✅ 单独一天 |
| 预期基础 | 懂后端、懂数据库 | 零基础 |
| 学习记录 | 无要求 | ✅ 每天写笔记到 `02/03/` 目录 |

---

## 📁 你的学习笔记目录

```
week-01-database/
├── 01/
│   └── ...（原计划 Day 1 内容）
├── 02/
│   ├── 00-学习进度.md                      ← 你的进度看板
│   ├── 从零设计数据表-小白指南.md            ← 你写的概念笔记
│   ├── 小白的学习笔记-设计第一个数据表.md      ← User 设计记录
│   └── 小白的学习笔记-设计Resume模型.md       ← Resume 设计记录
├── 03/
│   ├── 00-学习进度.md                      ← Day 3 进度
│   ├── 小白的学习笔记-理解后端和数据库本质.md   ← B/C/A 概念
│   ├── 小白的学习笔记-三层架构终于搞懂了.md     ← 三层架构理解
│   └── 小白的学习笔记-三层架构逐行讲解.md       ← 逐行讲解 + 验证
├── 07/
│   └── ...
├── day-01.md ~ day-07-sunday.md           ← 原计划（参考用）
├── README.md                              ← 原计划周概览
├── 小白版-Week1-学习计划.md                 ← 你现在看的这个
└── project-memory.md                      ← 项目记忆
```

---

## 🎯 一句话总结

```
你正在走的是"小白版"路线。
多花 2-3 天学基础概念，但每一步都亲手验证过。
这不是慢，这是扎实。

原计划 + 小白版 都放在 week-01-database/ 目录下，
你每天看小白版执行就行，原计划留着以后参考。
```
