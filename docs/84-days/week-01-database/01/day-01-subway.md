# 🚇 地铁 30 分钟 — 为什么需要数据库？

> **阅读场景：** 通勤地铁上，只看不写
> **阅读时间：** 30 分钟
> **目标：** 理解为什么 localStorage 不能上线、为什么需要 PostgreSQL

---

## ① 为什么企业不会使用 localStorage 保存这些数据？

**一句话：localStorage 本质上是"浏览器缓存"而非"数据库"，它所有的设计假设都和"企业级数据存储"相反。**

具体来说有六个不可逾越的硬伤：

### 1. 安全模型是纸糊的
localStorage 的访问规则是**同源策略**——同一域名下的任何 JavaScript 都能读写全部 key。这意味着：
- 你的应用里只要有一个 XSS 漏洞（哪怕是一个第三方 CDN 脚本被攻破），攻击者就能直接 `JSON.parse(localStorage.getItem('ai-interview-storage'))` 拿到用户的简历、面试对话、评分数据、甚至错题本里的公司面经
- 相比 HTTP-only Cookie（JS 不可读），localStorage 对 JS 完全透明，没有 HttpOnly/Secure/SameSite 这类安全标志
- **你现在没有敏感数据？不，用户的简历内容、面试表现评价、错题本里的公司信息，这些都是高度敏感的个人数据**

### 2. 多租户 = 不存在
Zustand store 里没有任何 `userId` 字段。这意味着：
- 当前场景（单用户开发机）勉强能用
- 一旦部署上线，**所有登录用户共用浏览器里的同一份 localStorage**——A 登录后练习面试，B 登入，看到的是 A 的面试记录
- 多台设备、多个浏览器标签页之间互相覆盖数据

### 3. 数据持久性 = 用户说了算
用户清一下浏览器缓存、换台电脑、开个无痕模式，你的全部数据就消失了。企业级产品不能接受"用户的操作记录是否能保留完全取决于用户是否手滑点了清除浏览数据"。

### 4. 容量天花板极低
每个域名 5-10MB。你的面试会话里每条消息都包含完整的 `content`（可能几千字），加上 AI 的评分 `evaluation` 字段——一次深度模拟面试可以轻松产生 20-50 轮对话。10 次面试 session 就可能打爆这个上限。用户不会收到任何警告，只会发现数据写不进去了，静默丢失。

### 5. SSR/SSE 不兼容
你是 Next.js 16 + App Router，大量使用 SSR 和 Server Components。但 `localStorage` **只在浏览器端存在**：
- 服务端渲染时读取不到任何用户数据 → 页面内容无法预填充 → 你被迫全部走客户端渲染（CSR），失去 SSR 的 SEO 和首屏性能优势
- 你用了 LangGraph + SSE 流式输出，服务端生成的面试报告如果想直接推送给用户，无法写回 localStorage

### 6. 完全没有数据管护能力
- **无备份**：没有数据库，没有 dump，用户说"我昨天练习的面试记录不见了"你什么都做不了
- **无审计**：无法追踪数据何时被修改、被谁修改
- **无并发控制**：两人同时在一台机器上操作，最后保存的覆盖前面的——不是乐观锁也不是悲观锁，是"谁最后 commit 谁赢"
- **无热迁移**：你想改数据结构？localStorage 里的旧数据没法做 migration，只能全部丢弃

> **总结：localStorage 的适用场景是"临时偏好设置"和"不重要的 UI 状态"——比如侧边栏折叠状态、字体大小选择。任何"用户会介意丢失"的数据都不应该放在 localStorage 里。**

---

## ② 我的项目哪些数据必须进入数据库？

### 🔴 必须进入数据库（全部业务数据）

| 数据域 | 当前存储位置 | 为什么必须进 DB |
|--------|-------------|----------------|
| **用户账号** | `.rag-data/users.json` | 已经在文件系统了，但 JSON 文件没有索引、没有并发控制、Vercel serverless 下读写抖动严重 |
| **面试 Session**（含完整对话、评分、阶段性评估） | `localStorage` → `ai-interview-storage` | 这是你的核心资产——用户练习的全部记录，也是后续改进模型、生成学习报告的基础 |
| **简历解析与分析结果** | `localStorage` | 简历是用户的核心输入，解析完成后需要跨会话复用 |
| **JD 分析记录** | `localStorage` | 类似简历，是面试准备过程的关键上下文 |
| **错题本** | `localStorage` | 这是用户的"成长曲线"，丢失即失去学习追踪能力 |
| **复盘记录** | `localStorage` | 用户从外部导入的面经复盘，属于长期有价值数据 |
| **聊天历史** | `localStorage` → `ai-chat-storage` | 通用对话历史，用户期望跨设备可见 |
| **Playground 模板与运行记录** | `localStorage` → `playground-storage` | 用户的 Prompt 工程资产，属于创作成果 |

### 🟡 可以留在本地（但注意数据量）
- **RAG 上传的文档列表**：当前是从 server 获取，但文档内容本身存在向量数据库或对象存储中，列表缓存在内存/本地是可接受的
- **SSE 流式输出过程中的临时状态**：一次 AI 生成过程中的中间片段，生成完毕后再写入 DB

### 🟢 可以留在 Zustand（纯 UI 状态）

| 数据 | 说明 |
|------|------|
| 当前选中的 tab / 侧边栏展开状态 | 用户偏好，没了也不影响业务 |
| 表单正在输入但未提交的内容 | 用 `draft` 态管理，提交后清除 |
| 当前面试流的 cursor / phase 指针 | 由 session 状态驱动，不从 localStorage 读 |
| Hydration 状态标记（`_hydrated`） | 纯生命周期标志 |

### 一个简单的判断标准

> 问自己：**如果这个用户换了一台电脑登录，他是否会期望看到这些数据？**
> 如果答案是"是"，就必须进数据库。

---

## ③ 如果以后 100 万用户，会发生什么？

### 当前架构下（localStorage + JSON 文件），100 万用户 = 灾难

#### 场景一：`users.json` 文件系统存储

```
- 100 万用户注册 → users.json 约 200-300MB
- 每次登录请求 → 读取整个 200MB 文件到内存 → JSON.parse → O(n) 扫描找邮箱
- Vercel serverless 函数的冷启动已加载 runtime，再加载 200MB JSON → 内存超限（Vercel serverless 最大 1GB，但只给你 10 秒响应）
- 两个用户同时注册 → 同时读取 users.json → 同时修改内存数组 → 后写的覆盖先写的 → **数据丢失**
- 你无法"分页加载"，因为 JSON 不是可查询的——你想查"一个月内登录过的活跃用户"，只能全文加载后遍历
```

**100 万用户时你的认证系统会先死——不是慢死，是直接炸。**

#### 场景二：localStorage 面试数据

```
- 100 万用户，每人平均 10 次面试 = 1000 万次 session
- 每条 session 平均 200KB（含完整对话 + AI 评分）
- 总数据量 ≈ 2TB
- 这 2TB 数据全部分散在 100 万个浏览器的 5MB 小格子里
- 你无法做任何统计：无法分析"哪些题用户普遍答得差"来优化面试题库
- 你无法做推荐：无法根据"和你有相似错题的用户"推荐练习
- 你无法做产品改进：不知道用户在哪一步流失、哪个功能最受欢迎
```

**你的产品是一个"黑盒"——所有业务数据都在用户的浏览器里，服务器完全不知道用户在干什么。**

#### 场景三：业务扩展

你想增加：
- **团队共享**：一个 HR 团队同时面试候选人？不可能，数据在各自浏览器里
- **学习路径推荐**：根据用户的错题本和面试表现推荐课程？不可能，数据不可分析
- **企业版**：公司购买你的平台给员工用？员工的数据安全、数据隔离、数据备份，一个都做不到

### 目标架构下（PostgreSQL），100 万用户 = 正常的工程挑战

```
- 用户表 100 万行 → PostgreSQL 一个 B-tree index 搞定 O(log n) 查询
- 面试消息表 1 亿行 → 按 userId 分片 + 时间分区 + 覆盖索引
- 读写分离：分析型查询走 read replica，不干扰主库
- 连接池 + 分页 + 游标 → 页面响应 < 50ms
- 备份：pg_dump 定时备份到 S3，15 分钟 RPO
- 扩缩容：读压力大加 read replica，写压力大做 sharding
```

**这时"100 万用户"是一个工程问题，不是一个"能不能跑"的问题。**

---

## ④ 为什么关系数据库（PostgreSQL）适合你的项目？

你不是在做社交网络（图数据库场景），也不是在做内容推荐（向量数据库优先），你的项目有非常清晰的**结构化实体和关系**——这正是关系数据库的设计目标。

### 原因 1：你的数据模型天然是关系型的

看你的实体：
- 一个 **用户** 有多个 **面试 Session**
- 一个 **Session** 关联一个 **简历** 和一个 **JD**
- 一个 **Session** 有多个 **消息** 和 **一个评分**
- 用户有多个 **错题** 和多个 **复盘**

关系数据库的 JOIN、外键约束、事务可以**精确表达这些关系**。你在使用过程中会发现：
- `ON DELETE CASCADE` → 删用户时自动清理所有关联数据
- `UNIQUE (user_id, question)` → 错题本里同一道题不会重复
- `CHECK (mastery BETWEEN 0 AND 5)` → 数据完整性由数据库保证，而不是由代码保证

### 原因 2：你需要的查询模式 PostgreSQL 完美覆盖

| 查询需求 | PostgreSQL 方案 |
|---------|----------------|
| 找某个用户最近 10 次面试 | `WHERE user_id = ? ORDER BY created_at DESC LIMIT 10` → 索引扫描 |
| 找出"得分低于 60 分"的 session | `WHERE score < 60` → 索引过滤 |
| 按标签过滤错题本 | `WHERE user_id = ? AND ARRAY['算法'] && tags` → GIN 索引 |
| 统计上周活跃用户 | `WHERE last_login > now() - interval '7 days'` → 范围索引 |
| 聚合：每个用户的平均面试得分 | `GROUP BY user_id` → 排序 + 哈希聚合 |
| 找出"做了同一套 JD 练习的用户" | `GROUP BY jd_id HAVING count(*) > 1` → 分组过滤 |

上面这些在 MongoDB 里可能需要 aggregate pipeline + $lookup + 多个索引组合，在 PG 里就是几行 SQL。

### 原因 3：ACID 事务——你的业务逻辑需要它

```sql
-- 面试完成时的原子操作：
BEGIN;
  UPDATE interview_sessions SET status = 'completed', score = 85 WHERE id = ?;
  INSERT INTO interview_scores (session_id, overall, dimensions, evaluations) VALUES (...);
  INSERT INTO error_book_entries (user_id, question, correct_answer, user_answer, error_type) ...;
COMMIT;
```

如果第 2 步成功、第 3 步失败，整个操作回滚——用户不会看到"面试完成了但没有记录"的奇怪状态。JSON 文件和 localStorage 都给不了你这个保证。

### 原因 4：Prisma + PostgreSQL 是完美的"中间状态"

你选了 Prisma + PostgreSQL，这是一个很务实的选择：
- Prisma 的 **Schema-first** 方式让你可以在代码里声明数据模型，自动生成 migration
- PostgreSQL 作为生产数据库，有 30 年的生态积累——备份、监控、扩缩容、迁移工具全部成熟
- 你不会在"到底用什么数据库"上浪费决策时间，可以把精力放在业务上

---

## ⑤ ER 图

```mermaid
erDiagram
    User ||--o{ Conversation : "has"
    User ||--o{ Resume : "has"
    User ||--o{ JD : "has"
    User ||--o{ InterviewSession : "practices"
    User ||--o{ InterviewReview : "imports"
    User ||--o{ ErrorBookEntry : "owns"
    User ||--o{ PlaygroundTemplate : "creates"
    User ||--o{ PlaygroundRunRecord : "runs"

    Conversation ||--o{ Message : "contains"

    Resume ||--o{ InterviewSession : "used-in"
    JD ||--o{ InterviewSession : "targets"

    InterviewSession ||--o{ InterviewMessage : "contains"
    InterviewSession ||--o| InterviewScore : "scores"

    InterviewReview ||--o{ ReviewQuestion : "has"

    User {
        string id PK
        string email UK
        string name
        string passwordHash
        string salt
        datetime createdAt
        datetime lastLogin
    }

    Conversation {
        string id PK
        string userId FK
        string title
        json tokenUsage
        datetime createdAt
        datetime updatedAt
    }

    Message {
        string id PK
        string conversationId FK
        enum role "user | assistant | system"
        text content
        datetime timestamp
    }

    Resume {
        string id PK
        string userId FK
        string fileName
        int fileSize
        enum status "uploading | parsed | failed"
        text rawText
        json parsedData
        json analysis
        datetime uploadTime
    }

    JD {
        string id PK
        string userId FK
        text content
        string company
        string position
        json analysis
        datetime createdAt
    }

    InterviewSession {
        string id PK
        string userId FK
        string resumeId FK "nullable"
        string jdId FK "nullable"
        enum status "in_progress | completed | terminated"
        enum mode "tech | hr | mixed"
        enum difficulty "junior | mid | senior"
        int duration
        int currentPhase
        int score "nullable"
        datetime createdAt
        datetime completedAt "nullable"
    }

    InterviewMessage {
        string id PK
        string sessionId FK
        enum role "ai | user"
        text content
        enum type "question | answer | feedback | system"
        string phase
        int score "nullable"
        text evaluation "nullable"
        datetime timestamp
    }

    InterviewScore {
        string id PK
        string sessionId FK UK
        int overallScore
        json dimensions
        text[] strengths
        text[] weaknesses
        text suggestions
        json questionScores
    }

    InterviewReview {
        string id PK
        string userId FK
        string company
        string position
        date interviewDate
        enum result "pass | fail | unknown"
        string[] weakTags
        datetime createdAt
    }

    ReviewQuestion {
        string id PK
        string reviewId FK
        text content
        text answer
        string[] tags
    }

    ErrorBookEntry {
        string id PK
        string userId FK
        text question
        text correctAnswer
        text userAnswer
        string errorType
        string company
        string[] tags
        int mastery "0-5"
        datetime reviewTime
        datetime createdAt
    }

    PlaygroundTemplate {
        string id PK
        string userId FK
        string name
        enum promptType "normal | roleplay | fewshot | cot"
        json variables
        json modelConfig
        datetime createdAt
        datetime updatedAt
    }

    PlaygroundRunRecord {
        string id PK
        string userId FK
        string templateId FK "nullable"
        enum promptType
        text fullPrompt
        json modelConfig
        text response
        json tokenUsage
        datetime timestamp
        int duration
    }
```

### 核心关系解读

```
用户(1) ── 练习 ── 面试 Session(多)
面试 Session(1) ── 包含 ── 面试消息(多)
面试 Session(1) ── 产生 ── 面试评分(1)
面试 Session(多) ── 关联 ── 简历(1)
面试 Session(多) ── 关联 ── JD(1)
用户(1) ── 记录错题 ── 错题本(多)
用户(1) ── 导入复盘 ── 复盘记录(多)
复盘记录(1) ── 包含 ── 复盘问题(多)
用户(1) ── 聊天 ── 对话(多)
对话(1) ── 包含 ── 消息(多)
```

---

## 架构迁移建议（一句话）

> **不要一次性迁移全部数据。先迁认证（把 users.json 换成 DB 表），再迁面试核心数据（session + message + score），最后迁聊天和 playground。每迁一步验证一次，确保你的 Prisma schema 稳定后再铺开。**

---

## 📌 今日通勤核心记忆点

| # | 一句话记住 |
|---|-----------|
| 1 | localStorage 是缓存，不是数据库——用户清浏览器 = 数据消失 |
| 2 | 换设备、多用户、并发写——localStorage 三个场景都做不到 |
| 3 | PostgreSQL 用 30 年证明了它是关系型数据的正确选择 |

**明天见。**
