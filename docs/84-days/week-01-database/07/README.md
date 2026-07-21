# 第 1 周集成日：数据库架构评审与架构决策记录

> **视角：** Tech Lead 架构评审
> **日期：** 2026-07-19
> **背景：** 第 1 周数据库迁移结束，对所有数据库设计进行架构评审、代码重构、文档合并

---

## 目录

1. [本周构建了什么？](#一本周构建了什么)
2. [5 维度架构评审](#二5-维度架构评审)
3. [架构决策记录（ADR）](#三架构决策记录adr)
4. [统一目录结构](#四统一目录结构)
5. [常见面试追问与回答](#五常见面试追问与回答)
6. [下周展望](#六下周展望)

---

## 一、本周构建了什么？

### 第 1 周结束时你的项目

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
```

### 本周产出总览

| 天 | 主题 | 核心产出 |
|----|------|---------|
| Day 1（周一） | 理解 + 架构 | `docs/15-postgresql.md`、ER 图、架构决策 |
| Day 2（周二） | Schema 设计 | `prisma/schema.prisma`（User + Resume Model）、首次 Migration |
| Day 3（周三） | 用户落库 | `src/database/` 目录（Client / Repository / Service / Types） |
| Day 4（周四） | 简历落库 | `resume.repository.ts`、`resume.service.ts`、简历上传落库 |
| Day 5（周五） | 面试落库 | `interview.repository.ts`、`interview.service.ts`、面试对话落库 |
| 周日 | 集成 | `docs/15-postgresql.md` 最终版、README 更新、最终 Commit |

### 文件结构变更

```
新增：
  prisma/schema.prisma            ← 全部数据模型
  prisma/migrations/              ← 数据库版本记录
  src/database/client.ts          ← Prisma 单例
  src/database/repositories/      ← 数据访问层
  src/database/services/          ← 业务逻辑层
  src/database/types/             ← DTO 类型定义
  docs/15-postgresql.md           ← 架构决策记录（≥3000 字）

修改：
  src/app/api/auth/              ← Controller 重构
  src/app/api/interview/          ← Controller 重构
```

---

## 二、5 维度架构评审

### 维度 1：扩展性（Scalability）

```
✅ 做得好的：
  - UUID 主键，支持分布式生成，未来分片无冲突
  - JSONB 字段（score、analysis）设计合理，结构变化不影响 Schema
  - 软删除（deleted_at），数据可恢复
  - CUID 比 UUID 更适合索引（有序前缀，减少页分裂）

⚠️ 需要关注的：
  - Conversation 表随着用户增长会迅速膨胀（一次面试数百条消息）
  - 建议在第 3 个月后按 userId 做时间分区
  - 简历文件存储策略：当前存路径还是存内容？如果存数据库，大字段是瓶颈

❌ 严重问题：
  无
```

**扩展性的本质：** 扩展性不是在设计时"预测未来"，而是在设计时"为未来的改动留出空间"。UUID、JSONB、软删除——这三个选择就是在留空间。

### 维度 2：性能（Performance）

```
✅ 做得好的：
  - 核心外键都有索引（Prisma 自动创建）
  - @unique 约束自动生成唯一索引
  - 查询粒度精确（select 控制返回字段，不返回大字段）

⚠️ 需要关注的：
  - 没有复合索引（比如 user_id + created_at 组合查询）
  - 没有覆盖索引（Covering Index）
  - Conversation 表的全表搜索场景没有考虑全文索引

❌ 严重问题：
  无（当前数据量下不是问题，但第 2 周就要关注了）
```

**性能的本质：** 不要在 1000 行数据的时候优化 1000 万行的查询。但要确保"索引策略"是正确的——错误的索引比没有索引还糟糕。

### 维度 3：安全（Security）

```
✅ 做得好的：
  - Repository 层统一过滤 passwordHash/salt（不返回给 Controller）
  - 三层架构天然隔离了数据查询接口
  - Prisma 参数化查询，无 SQL 注入风险

⚠️ 需要关注的：
  - API 路由是否有用户权限校验？（userId 是否从 JWT 获取？）
  - 有没有"遍历攻击"风险？（查别人的 resumeId 能查到吗？）

❌ 严重问题：
  需要确认：当前所有 API Route 是否都做了用户身份验证？
```

**安全的本质：** 安全不是"加一个防火墙"，而是"每一层默认不信任"。Controller 不信任请求（校验 JWT），Service 不信任 Controller（校验 userId 归属），Repository 不信任 Service（制定查询范围）。

### 维度 4：一致性（Consistency）

```
✅ 做得好的：
  - 外键约束完整（User → Resume → Interview → Conversation）
  - CASCADE 删除行为正确（删 User 自动删所有关联数据）
  - 软删除统一（全部表都有 deleted_at）

⚠️ 需要关注的：
  - JSONB 字段的一致性由代码保证（数据库不检查 JSONB 内部结构）
  - 需要添加校验逻辑（比如 score.dimensions 的字段完整性）

❌ 严重问题：
  无
```

**一致性的本质：** 数据库层面的约束是"硬一致性"（外键、唯一约束、非空检查），代码层面的约束是"软一致性"（JSONB 结构校验、业务规则检查）。硬一致性用 Migration 保证，软一致性用 Service 层保证。

### 维度 5：维护性（Maintainability）

```
✅ 做得好的：
  - 目录结构清晰（repositories / services / types 分离）
  - 命名规范统一（findBy / create / update / delete）
  - 关注点分离（Controller → Service → Repository）

⚠️ 需要关注的：
  - 方法是否有 JSDoc 注释？
  - 错误处理是否统一？（有没有全局错误处理中间件？）
  - 类型定义是否完善？（CreateInput / UpdateInput / ResponseDTO）

❌ 严重问题：
  无
```

**维护性的本质：** 好的代码不是"别人觉得好懂的代码"，而是"三个月后的自己觉得好懂的代码"。统一命名、清晰注释、单一职责——都是在为三个月后的自己减少"这代码谁写的？哦是我"的尴尬。

---

## 三、架构决策记录（ADR）

### ADR 1：为什么选 PostgreSQL 不选 MySQL？

```
决策：PostgreSQL
理由：
  1. JSONB 支持——面试评分（score）和简历分析（analysis）是动态结构
  2. 全文搜索——tsvector 原生支持，不需要额外的 Elasticsearch
  3. pgvector——未来语义搜索不需要换数据库
  4. 更严格的 SQL 标准——类型安全比 MySQL 更好
代价：
  - 托管成本略高于 MySQL（但差别不大）
  - 中文社区资料少于 MySQL（但文档质量更高）
```

### ADR 2：为什么用 CUID 不用 UUID？

```
决策：CUID（@default(cuid())）
理由：
  1. UUID v4 是完全随机的，B-tree 索引插入时页分裂严重
  2. CUID 有有序前缀，插入性能好于 UUID
  3. CUID 比自增 ID 安全（无法遍历猜测下一个 ID）
代价：
  - 字符数比自增多（25 chars vs 4 bytes）
  - 可读性不如自增（但我不会用 id=42 去调试）
```

### ADR 3：为什么用 JSONB 而不是单独表？

```
决策：JSONB（用于 score、analysis、parsed 等字段）
理由：
  1. 这些字段始终"整体读取、整体写入"——不做部分更新
  2. 结构频繁迭代——单独表意味着经常改 Schema
  3. 不参与 JOIN 查询——不需要单独索引
  4. 查询时整体返回——不需要 JOIN
代价：
  - JSONB 无模式约束（由代码保证一致性）
  - JSONB 查询性能不如关系型（但 99% 场景感知不到）
```

### ADR 4：为什么用三层架构？

```
决策：Repository → Service → Controller
理由：
  1. 业务逻辑集中（改一个业务规则找 Service，不改 N 个 Route）
  2. 可测试（mock Repository 测 Service，不依赖数据库）
  3. 可换存储（改 Repository 换 Prisma → Drizzle，Service 不动）
  4. 新人上手快（看目录结构就知道数据怎么流动）
代价：
  - 每个实体多 3 个文件
  - 简单的 CRUD 也要走三层（但可以在 Controller 直接调 Repository 作为例外）
```

### ADR 5：为什么用软删除？

```
决策：deleted_at 标记删除，而非物理删除
理由：
  1. 数据可恢复——用户手滑删除简历，可以找回
  2. 审计可追溯——知道"这个用户曾经存在过"
  3. 关联数据不丢失——面试对话不会因为"用户删了账号"就消失
代价：
  - 所有查询都要加 WHERE deleted_at IS NULL
  - 数据量增长更快（但 deleted 数据后续可以归档）
  - Repository 层需要封装"自动过滤已删除"的逻辑
```

---

## 四、统一目录结构

### 最终目录

```
src/database/
├── client.ts                        ← Prisma 单例（全局缓存）
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

### 统一命名规范

| 层 | 命名模式 | 示例 |
|----|---------|------|
| **Repository** | `findByXxx` / `create` / `update` / `delete` / `count` | `findByEmail(email)` |
| **Service** | 业务意图命名 | `registerUser(email, password)` 而非 `createUser(data)` |
| **Controller** | RESTful 路由 | `POST /api/auth/register` → 创建，`GET` → 读取，`PATCH` → 更新 |

---

## 五、常见面试追问与回答

### Q1：为什么选 PostgreSQL 不选 MySQL？

**回答：**

```
核心原因有三个：

第一，我的项目有大量动态结构数据——面试评分有 5 个维度、每题评分、表达反馈。
MySQL 的 JSON 类型是"字符串存 JSON"，PG 的 JSONB 是二进制格式，可以建 GIN 索引直接查询内部字段。
虽然我当前是整体读写，但以后如果要做"查所有沟通维度低于 60 分的面试"，JSONB 的查询性能远优于 MySQL 的 JSON。

第二，全文搜索。面试复盘里要搜"这个用户上周答过的所有 JavaScript 题"，
PG 的 tsvector 可以直接在数据库层面做，MySQL 的全文搜索在很多中文场景表现不好。

第三，pgvector。以后如果要做"根据用户错题推荐相似题目"，不需要额外引入向量数据库。

不是 MySQL 不好——MySQL 在读写均衡场景下比 PG 更快。
但我的项目是"结构化数据 + 动态 JSON + 未来语义搜索"，PG 更匹配。
```

### Q2：为什么用 CUID 不用 UUID？

**回答：**

```
UUID v4 是随机生成的，插入 B-tree 索引时会导致频繁的页分裂。
CUID 的前缀是时间戳和计数器——有序的，插入性能好得多。

可以在 pgbench 上测：UUID 的插入性能大约比 CUID 低 20-30%。
而且 CUID 和 UUID 一样是全局唯一的，支持分布式生成。

不用自增 ID 是因为安全——自增 ID 可以遍历，CUID/UUID 不能猜出下一个。
```

### Q3：三层架构的 Service 和 Repository 边界在哪？

**回答：**

```
最简单的判断标准：看方法名描述"怎么查"还是"为什么做"。

Repository 的方法名描述"怎么查"：
  findByEmail、findActiveUsers、create、updatePassword

Service 的方法名描述"为什么做"：
  registerUser、loginUser、updateProfile

具体边界：
  - 权限检查（"这个用户能删这条记录吗"）→ Service
  - 数据查询执行（"DELETE FROM ... WHERE id = ?"）→ Repository
  - 密码加密 → Service（业务逻辑）
  - 存储加密后的密码 → Repository（数据存储）

关键约束：Service 不能直接调 Prisma，Controller 不能直接调 Repository。
```

### Q4：如果 1000 万数据，分页查询怎么优化？

**回答：**

```
不能 OFFSET + LIMIT。OFFSET 在 PostgreSQL 里要走完所有跳过的行。

方案 1：游标分页（Keyset Pagination）
  SELECT * FROM messages
  WHERE created_at < :lastCursor
  ORDER BY created_at DESC
  LIMIT 20
  
  优势：无论翻到第几页，性能不变。
  劣势：不能直接跳到第 N 页。

方案 2：覆盖索引
  CREATE INDEX idx_messages_user_time 
  ON messages(user_id, created_at DESC)
  INCLUDE (content, score)
  
  查询只在索引里走，不需要回表。
  
方案 3：时间分区
  按月份分区，查询自动只扫一个分区。
  
按优先级：游标分页 > 覆盖索引 > 时间分区。
```

### Q5：Migration 回滚怎么处理？

**回答：**

```
Prisma 的 migrate 没有内置 rollback（不像 Laravel 有 migrate:rollback）。

实际做法：
  1. 不要改已提交的 Migration 文件
  2. 回滚 = 写一个新的 Migration 做反向操作
  3. 开发环境：prisma migrate reset 重置到初始

生产环境的回滚策略：
  1. 备份数据库（pg_dump）
  2. 手动写反向 Migration（ALTER TABLE ... DROP COLUMN）
  3. 部署新的 Migration
  4. 验证数据完整性

更安全的做法：先部署 Migration SQL 的 Review，再加字段（而不是改/删字段）。
```

---

## 六、下周展望

### 第 2 周目标：API 与认证体系

```
完善 JWT 认证体系
  1. 所有 API Route 通过 JWT 校验用户身份
  2. 用户角色 / 权限体系

统一 API 模式
  1. 所有 Controller 遵循三层架构
  2. 统一错误处理中间件
  3. 数据验证（Zod / Valibot）

API 文档
  1. OpenAPI / Swagger
  2. 接口规范文档

前端对接
  1. 前端从 localStorage 切换到 API 请求
  2. 认证状态管理
```

### 第 1 周最重要的认知

> **架构师和码农的区别：码农写代码，架构师删代码。**
>
> 第 1 周你写的代码不多，但每一步都是在"删问题"：
> - 删掉了 localStorage 的数据丢失问题
> - 删掉了 JSON 文件的并发写覆盖问题
> - 删掉了"查用户要全量加载"的性能问题
>
> 第 2 周开始，你会写更多的代码，但每次写之前问自己：
> **"这段代码是解决问题，还是制造问题？"**
>

---

## 核心结论

| # | 维度 | 一句话 |
|---|------|--------|
| 1 | 扩展性 | UUID + JSONB + 软删除 = 为未来留空间 |
| 2 | 性能 | 索引策略对了，查询在毫秒级。索引策略错了，DBA 来找你 |
| 3 | 安全 | 默认不信任每一层——JWT 校验、userId 归属、敏感字段过滤 |
| 4 | 一致性 | 数据库保证硬一致（外键、唯一约束），代码保证软一致（JSONB 校验） |
| 5 | 维护性 | 目录结构决定可维护性——命名统一、关注点分离、单一职责 |
