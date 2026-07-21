# 🚇 地铁 30 分钟 — 第 1 周集成日：数据库架构总结

> **阅读场景：** 通勤地铁上，只看不写
> **阅读时间：** 30 分钟
> **目标：** 回顾第 1 周数据库架构设计，理解 5 个评审维度，准备面试追问

---

## ① 本周你做了什么？

```
第 1 周开始时：
  ❌ 所有数据在浏览器 localStorage（清缓存 = 丢数据）
  ❌ 用户认证用 JSON 文件（并发写冲突）
  ❌ 不支持真正多用户

第 1 周结束时：
  ✅ User / Resume / Interview / Message 全部进 PostgreSQL
  ✅ Repository → Service → Controller 三层架构
  ✅ Prisma Migration 可追踪可回滚
  ✅ docs/15-postgresql.md 记录了所有架构决策
```

### 一周产出速览

| 天 | 做了什么 |
|----|---------|
| 周一 | 理解 localStorage 缺陷、画 ER 图、写 ADR 文档 |
| 周二 | 设计 Prisma Schema（User + Resume）、首次 Migration |
| 周三 | 创建 database/ 目录结构、实现 User Repository/Service |
| 周四 | 简历数据落库、Resume Repository/Service |
| 周五 | 面试对话落库、Interview Repository/Service |
| 周日 | 架构评审、文档合并、Git Commit |

---

## ② 5 个架构评审维度

### 维度 1：扩展性

**当前设计能否支撑未来增长？**

```
✅ 做得好：
  - UUID 主键 → 未来分片无冲突
  - JSONB 字段 → 结构变化不影响 Schema
  - 软删除 → 数据可恢复

⚠️ 注意：
  - Conversation 表会迅速膨胀（一次面试数百条消息）
  - 第 3 个月后建议按 userId 做时间分区
```

**一句话：** 扩展性不是预测未来，而是为未来的改动留出空间。

---

### 维度 2：性能

**查询效率能不能接受？**

```
✅ 做得好：
  - 核心外键有索引（Prisma 自动创建）
  - @unique 生成唯一索引
  - 查询用 select 控制返回字段

⚠️ 注意：
  - 缺少复合索引（如 user_id + created_at）
  - 没有覆盖索引
```

**一句话：** 不在 1000 行的时候优化 1000 万行的查询。但要确保索引方向正确。

---

### 维度 3：安全

**数据是否被保护？**

```
✅ 做得好：
  - Repository 统一过滤 passwordHash/salt
  - Prisma 参数化查询，无 SQL 注入

⚠️ 注意：
  - API 路由是否都做了 JWT 校验？
  - 有没有"遍历攻击"风险？
```

**一句话：** 安全是"每层默认不信任"——Controller 校验 JWT，Service 校验 userId 归属，Repository 限定查询范围。

---

### 维度 4：一致性

**数据之间的关系是否可靠？**

```
✅ 做得好：
  - 外键约束完整
  - CASCADE 删除行为正确
  - 所有表统一软删除

⚠️ 注意：
  - JSONB 内部结构的完整性由代码保证
```

**一句话：** 数据库保"硬一致"（外键、@unique），代码保"软一致"（JSONB 结构校验）。

---

### 维度 5：维护性

**三个月后的自己还能看懂吗？**

```
✅ 做得好：
  - 目录结构清晰（repositories / services / types）
  - 命名统一（findBy / create / update / delete）
  - 关注点分离

⚠️ 注意：
  - 方法有没有 JSDoc 注释？
  - 错误处理是否统一？
```

**一句话：** 好代码是"三个月后的自己觉得好懂的代码"。

---

## ③ 架构决策快问快答

### Q：为什么选 PostgreSQL 不选 MySQL？

```
三个核心原因：
  1. JSONB → 面试评分、简历分析是动态结构，PG 的 JSONB 可以建索引
  2. 全文搜索 → tsvector 原生支持中文全文搜
  3. pgvector → 未来语义搜索不需要换数据库

不是 MySQL 不好。是 PG 更匹配"结构化数据 + 动态 JSON + 未来语义搜索"的需求。
```

### Q：为什么用 CUID 不用 UUID？

```
UUID v4 是随机生成的，插入 B-tree 索引时频繁页分裂。
CUID 有序，插入性能高 20-30%。

不用自增 ID：安全（不能遍历猜测下一个 ID）。
```

### Q：为什么用 JSONB 而不是单独表？

```
这些字段的特点：整体读取、整体写入、不参与 JOIN、结构频繁迭代。
单独表 = 经常改 Schema、每次查都要 JOIN。
JSONB = 一次读写、结构随便改。

代价：代码保证 JSONB 内部结构正确。
```

### Q：三层架构的 Service 和 Repository 边界在哪？

```
最简单判断方法：看方法名。

  findByEmail(email)  → 描述"怎么查" → Repository
  registerUser(email) → 描述"为什么做" → Service

关键约束：
  - Controller 不能直接调 Repository
  - Service 不能直接调 Prisma
  - 破坏任一约束 → 架构崩塌
```

### Q：1000 万数据怎么分页？

```
不能 OFFSET + LIMIT（OFFSET 要走完所有跳过的行）。

正确做法：游标分页（Keyset Pagination）
  WHERE created_at < :lastCursor ORDER BY created_at DESC LIMIT 20

优势：翻到第 100 万页和翻到第 1 页一样快。
代价：不能直接跳到第 N 页。
```

---

## ④ 第 1 周最重要的认知

### 架构师和码农的区别

```
码农写代码，架构师删代码。

第 1 周你写的代码不多，但每一步都是在"删问题"：
  → 删掉了 localStorage 的数据丢失问题
  → 删掉了 JSON 文件的并发写覆盖问题
  → 删掉了"查用户要全量加载"的性能问题
  → 删掉了"数据归属不清"的多用户问题
```

### 从 Demo 到产品的分水岭

```
能跑 vs 能上线：
  localStorage + JSON 文件 = "能跑"
  PostgreSQL + 三层架构 = "能上线"

第 1 周你跨过了这个分水岭。

下周开始，在你的代码基础上加功能——不再是在沙子上盖楼。
```

---

## ⑤ 总结：三句话带回家

| # | 一句话 |
|---|--------|
| 1 | 第 1 周的目标不是"写更多代码"，而是"把不靠谱的存储换成靠谱的数据库" |
| 2 | 扩展性（UUID）、一致性（外键）、维护性（分层）——三个最核心的设计维度的正确选择 |
| 3 | "能跑"和"能上线"是两个世界。你已经跨过了中间的那条线 |

**第 2 周见。** 第 2 周开始完善 JWT 认证体系、统一 API 模式、从 localStorage 全面切换到 API。

---

[← Day 5](../day-05.md) | [第 2 周 →](../../week-02-api-auth/README.md)
