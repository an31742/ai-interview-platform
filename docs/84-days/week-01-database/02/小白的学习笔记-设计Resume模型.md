# 📝 小白的学习笔记：设计 Resume（简历）模型

> **日期：** 2026-07-20
> **学习主题：** 继续设计第二个数据表——简历表
> **前置知识：** 已设计好 User 表，理解了一对多关系

---

## 一、我当时怎么想的（自己的原始设计）

我用中文先写了一遍我的想法：

```
//简历
model Resume{
  id             int 可以自增
  userId         string  因为是1对多的关系 一个用户可以有多个简历
  resumeName     string 简历的名称
  resumeContext  JSon字段  里面有个人信息 有工作经历  有项目经历  简历的内容
  简历评分
  size 要记
  简历的分析进度 对应多个字段值  1,2,3,4， 开始分析，分析结束，评价
}
```

**✅ 这一步很关键：先用自己的话写出来，再翻译成 Prisma 语法。**

---

## 二、学到的重点

### 重点 1：一对多关系的写法

```
User 表（一的那方）：
  resumes    Resume[]    ← 用数组表示"一个用户有多份简历"

Resume 表（多的那方）：
  userId     String      ← 存用户的 id
  user       User @relation(fields: [userId], references: [id])  ← 指向 User 表
```

### 重点 2：@relation 是两张表的"连接线"

```
Resume 里的 userId 指向 User 里的 id：

@relation(fields: [userId], references: [id])
            ↑ 自己表里的字段       ↑ 对方表里的字段
```

这样数据库就知道：`resume.userId = user.id`，查简历时能顺带查出用户信息。

### 重点 3：关于 id 是否用自增的思考

```
User  用 cuid() → 不怕暴露用户数量，不怕合并数据库冲突
Resume 用 autoincrement() → 目前的想法

问题：简历的 id 暴露给别人看到 id=3，有关系吗？
     未来如果多个数据库合并，两个数据库都有 id=1 的简历会冲突吗？
```

没有标准答案，但值得自己想清楚为什么选。

### 重点 4：简历评分和进度状态

```
评分（score）：
  数字（85分） → Int 或 Float
  等级（A/B）  → String
  还没决定用哪种

进度（status）：
  用数字 1,2,3,4 还是用文字？
  用文字的话："上传中"、"解析中"、"分析中"、"已完成"
  以后代码里看到文字就知道什么意思，不用猜数字代表什么
```

### 重点 5：JSON 字段又用上了

```
resumeContext Json?    ← 简历内容用 JSON
                       里面装：个人信息、工作经历、项目经历……
                       结构不固定，适合 JSON
```

---

## 三、最终还没定稿的设计

```prisma
model Resume {
  id              Int       @id @default(autoincrement())
  userId          String
  resumeName      String                     // 简历文件名
  resumeContext   Json?                      // 简历解析内容
  size            Int                        // 文件大小（字节）
  score           Int?                       // 评分（还没定类型）
  status          String   @default("上传中") // 进度状态
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user            User     @relation(fields: [userId], references: [id])
  @@index([userId])
}
```

**还没决定的地方：**
- [ ] id 用 `autoincrement()` 还是 `cuid()`？
- [ ] score 用 Int 还是 String 还是 Float？
- [ ] status 用数字还是文字描述？

---

## 四、今天我理解的核心概念

| 概念 | 我之前以为 | 我现在理解了 |
|------|-----------|-------------|
| 表结构设计 | 很高深，不知道怎么下手 | 就是列出字段 + 想用途 + 选类型 |
| 一对多关系 | 不知道怎么在代码里表示 | 多的那方加一个 userId 指向对方 |
| JSON 字段 | 和普通字段一样 | 结构不固定的数据用 JSON |
| @relation | 很复杂的东西 | 就是告诉数据库"这两个字段是连着的" |
| Prisma 的角色 | 很神秘 | 就是"翻译官"——把我的描述翻译成 SQL 发给数据库 |

---

## 五、明天（Day 3）回来从这里开始

### 第一步：先确认 Resume 设计的几个决定

```
□ 决定 id 用 autoincrement 还是 cuid
□ 决定 score 用什么类型
□ 决定 status 用数字还是文字
□ 把最终版本写到 schema.prisma 里
```

### 第二步：验证 + 建表

```bash
npx prisma validate    # 检查 Schema 语法
npx prisma db push     # 真正建库（创建 dev.db 文件）
```

### 第三步：开始 Day 3

```
理解三层架构：
  Controller（管 HTTP 请求和响应）
    → Service（管业务规则）
      → Repository（管数据查询）
```

### 快速唤醒记忆

打开这个笔记，先看**第四节"核心概念"**，再看一眼你的 Schema，就能接上了。
