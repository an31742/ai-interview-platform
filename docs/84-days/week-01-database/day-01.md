# Day 1 — 为什么需要数据库？（第 1 周）

> **日期：** 2026-07-13（周一）
> **主题：** 理解为什么 localStorage 不能上线，为什么需要 PostgreSQL
> **金句：** 今天不写一行代码。今天只思考。

---

## ✅ 今日验收标准

- [ ] 🚇 理解了 3 个 localStorage 不能上线的致命理由
- [ ] 🚇 理解了为什么关系数据库适合本项目
- [ ] 🌙 完成了项目数据库架构设计（纸上/Excalidraw）
- [ ] 📝 完成了 docs/15-postgresql.md（含 ER 图 + 架构分析）
- [ ] 🎤 睡前回答了 5 个面试追问

---

## 🚇 地铁 30 分钟（只看不写）

> 绝对不要打开 IDE。绝对不要打开项目。

### 打开 ChatGPT，输入以下 Prompt

```
你是一位 Google Staff Engineer。
我有一个 AI 智能面试平台。
目前：
  - Next.js 16 + React 19
  - LangGraph + SSE + RAG + MCP
  - 所有用户数据保存在 localStorage（Zustand persist）
  - 用户认证用 JSON 文件兜底

我准备增加：
  - Prisma
  - PostgreSQL

请不要教我 Prisma API。
我要理解：
① 为什么企业不会使用 localStorage 保存这些数据？
② 我的项目哪些数据必须进入数据库？
③ 如果以后 100 万用户，会发生什么？
④ 为什么关系数据库适合这个项目？
⑤ 请画一张 ER 图。

要求：不要讲代码，全部讲架构思想。
```

### 你必须在 30 分钟内理解清楚 3 个核心问题：

**Q1：localStorage 的 3 个致命缺陷**
```
① 容量限制：5-10MB。你一份 PDF 简历解析后 2-3MB，面试对话可能数万 tokens
② 无法共享：换设备、清缓存、开隐身 → 数据全丢。服务端不可见
③ 无并发控制：两个 Tab 同时写入 → 静默覆盖，没有事务
```

**Q2：你的项目有哪些数据必须进数据库？**
```
User       → 多用户认证、权限、配置
Resume     → 用户上传的简历
Interview  → 面试会话记录
Message    → AI 对话（上下文连续性）
Question   → 面试题库
Review     → 面试评价
```

**Q3：为什么 PostgreSQL 不是 MySQL 不是 MongoDB？**

```
PostgreSQL 胜出的原因：
  → 你的数据天然有 Schema（User → Interview → Message → Score）
  → JSONB 支持面试评分的动态维度
  → tsvector 原生全文搜索
  → pgvector 支持未来的语义搜索
  → ACID 事务保障
```

---

## 🌙 晚上 40 分钟（用 Claude Code）

### 第一步：架构分析（10 分钟）

不要直接问"怎么写代码"。

打开 Claude Code（当前会话就是），用这个 Prompt：

```
你是一位 Google Staff Engineer。
请分析我的项目 /Users/maxiangan/Desktop/project/ai。

要求：
1. 阅读 src/types/interview.ts 和 src/store/interview-store.ts
2. 阅读 src/services/storage.ts 和 src/lib/auth/store.ts
3. 阅读 src/app/api/ 下的所有 route
4. 分析出当前项目在数据持久化方面的所有问题
5. 设计一个完整的 PostgreSQL 数据库架构

不要写 Prisma Schema。
先画 ER 图。
包括：User / Resume / Interview / Conversation / Question / Review / ErrorBook
告诉我每个实体：为什么需要、关系是什么、以后会怎么扩展。
```

### 第二步：理解输出（10 分钟）

Claude 输出后，做三件事：

1. **打开 Excalidraw / 拿起纸和 iPad**
2. **画出完整的 ER 图**（实体 + 关系 + 关键字段）
3. **回答自己 3 个问题**：
   - 如果我现在上线，最大的风险是什么？
   - 数据库解决了我什么痛苦？
   - 哪张表是核心中的核心？

### 第三步：写 docs（20 分钟）

创建 `/Users/maxiangan/Desktop/project/ai/docs/15-postgresql.md`

要求：
- 不是 Prisma 教程
- 是"架构决策记录"（Architecture Decision Record）
- 包含以下 5 个章节：

```markdown
# PostgreSQL 数据库设计

## 一、为什么需要数据库？
（对比 localStorage 的 3 个致命缺陷，各 200 字分析）

## 二、为什么不是 localStorage？
（容量、安全、架构三个维度深入分析）

## 三、为什么是 PostgreSQL？
（对比 MySQL / MongoDB，结合项目特点）

## 四、项目 ER 图
（Excalidraw 截图 + 关系说明）

## 五、各实体设计理由
（每个实体为什么单独建表，以后如何扩展）

## 六、如果现在 100 万用户
（数据库如何扩展：读写分离、连接池、分片策略）
```

---

## 📝 睡前 10 分钟

### 回答 3 个问题（写进 docs 末尾）

```
Q1：今天我理解的最重要的本质是什么？
A1：localStorage 不是持久化存储，是临时缓存。
    企业不会把它当数据库用，就像不会把塑料袋当行李箱用。

Q2：这个知识和我项目的关系是什么？
A2：我的面试平台所有数据在 localStorage 里，
    这意味着它不是"能上线的产品"，而是"本地 Demo"。
    多用户、数据持久、数据安全，这些都是空谈。

Q3：如果面试官问我"为什么选 PostgreSQL"，我怎么回答？
A3：（写下你的回答，不少于 5 句话）
```

### 🎤 面试模拟（睡前闭眼回答）

打开 ChatGPT，语音输入：

```
你是一位阿里 P8 前端面试官。
追问以下问题，每个都要我解释清楚：
① 为什么用户数据不能用 localStorage？
② 如果用户量大了，数据库怎么扩展？
③ PostgreSQL 和 MongoDB 怎么选？
④ 为什么需要 ER 图？设计数据库的第一步是什么？
⑤ 什么是事务？为什么你的项目需要事务？

不要放水。每个问题至少追问 3 轮。
```

---

## 📁 今日产出

```
新增：
  docs/15-postgresql.md    ← 你的架构决策记录（≥2000 字）
  docs/84-days/README.md   ← 84 天手册总目录
  docs/84-days/week-01-database/README.md  ← 第 1 周概览

新增（可选）：
  docs/84-days/week-01-database/er-diagram.png  ← ER 图截图
```

**今天不 Commit。今天只理解。**

---

## ⚠️ 常见陷阱

| 陷阱 | 正确做法 |
|------|---------|
| 想写代码 | 今天就是不能写。理解不透彻写出来也是错的 |
| 觉得"这些我都知道" | 知道 ≠ 能讲清楚。试着用 3 句话解释给 5 岁小孩 |
| 跳过 ER 图直接想 Schema | ER 图是架构，Schema 是实现。先有架构 |
| 觉得 3000 字太多 | 你不是在写作文，是在为自己记录决策理由 |

---

## 📌 明天的预告

Day 2 — Prisma 核心概念

```
🚇 理解：Schema、Migration、ORM 为什么存在？
🌙 设计：User + Resume 的 Prisma Model
📝 产出：schema.prisma 第一个版本
```

**今天下班了。你比昨天更接近高级工程师一步。**

---

[← 返回第 1 周](README.md) | [Day 2 →](day-02.md)
