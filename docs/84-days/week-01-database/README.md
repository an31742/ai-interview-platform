# 第 1 周：企业级数据库（Prisma + PostgreSQL）

> **目标：** 不是学 Prisma，而是让 AI 面试平台真正支持多用户持久化。

---

## 本周宏观目标

```
现状（全部 localStorage）：
  User → .rag-data/users.json（文件兜底）
  Chat → localStorage "ai-chat-storage"
  Interview → localStorage "ai-interview-storage"
  Resume → localStorage（含 Base64）

目标（PostgreSQL）：
  所有核心实体落库
  支持多用户数据隔离
  第一次 Migration 可回滚
```

---

## 为什么第 1 周必须是数据库？

因为：
- 没有数据库 → 用户关闭浏览器 = 数据丢失
- 没有数据库 → 无法支持真正多用户
- 没有数据库 → 无法做数据分析
- 没有数据库 → 面试报告无法分享

**localStorage 不是持久化，是临时缓存。**

---

## 本周每日概览

| 日 | 主题 | 🚇 地铁 | 🌙 晚上 | 📝 睡前 |
|:--:|------|---------|---------|---------|
| **1** | 为什么需要数据库 | 理解 localStorage vs PostgreSQL | Staff Engineer 架构分析 | 写 docs/15-postgresql.md |
| **2** | Prisma 核心概念 | Schema/Migration/ORM 本质 | 设计 User + Resume 模型 | 完成 schema.prisma |
| **3** | 企业架构模式 | Repository/DAO/Service | 接入 Prisma + 用户落库 | Git Commit |
| **4** | 简历数据持久化 | 为什么 Resume 单独建表 | Resume CRUD 全流程 | Git Commit |
| **5** | 面试对话落库 | Context 管理策略 | Conversation + Message 落库 | Git Commit |
| --- | --- | --- | --- | --- |
| ☀️ **日** | **Tech Lead 评审日** | — | Review + 重构 + 文档 | 模拟面试官追问 |

---

## 验收标准

到周日结束时：
- ✅ Prisma Schema 包含 User / Resume / Interview / Message / Question / Review
- ✅ 所有 Model 完成了第一次 Migration
- ✅ User CRUD 通过 API 可验证
- ✅ Resume 上传后落库
- ✅ Interview + Message 落库
- ✅ docs/15-postgresql.md 不少于 3000 字
- ✅ GitHub 有本周所有 Commit

---

[← 返回目录](../README.md) | [Day 1 →](day-01.md)
