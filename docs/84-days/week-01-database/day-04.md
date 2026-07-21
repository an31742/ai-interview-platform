# Day 4 — Resume 数据持久化（第 1 周）

> **日期：** 2026-07-16（周四）
> **主题：** 简历上传 → 解析 → 分析 → 落库 完整链路数据库化
> **金句：** 一份简历从浏览器上传到数据库，才是真正的"用户数据"。

---

## ✅ 今日验收标准

- [ ] 🚇 理解了为什么 Resume 单独建表而不是 User 里的 JSON
- [ ] 🌙 创建了 ResumeRepository
- [ ] 🌙 创建了 ResumeService
- [ ] 🌙 重构了 Resume Upload API（Controller）
- [ ] 🌙 文件存储策略确定（本地 / S3 / 数据库）
- [ ] 📝 Git Commit
- [ ] 🎤 睡前面试模拟

---

## 🚇 地铁 30 分钟（只看不写）

### 打开 ChatGPT，输入这个 Prompt

```
你是一位数据库架构师。
我有一个 AI 面试平台，用户上传简历。

我的 Resume 数据结构如下：
- 元数据：fileName, fileSize, status, uploadTime
- 解析结果：结构化数据（name, title, skills, experience, education, projects）
- AI 分析结果：strengths, weaknesses, suggestedFocus, confidence, missingKeywords

问题：
① 为什么 Resume 必须单独建表，不能是 User 表里的一个 JSON 字段？
② 解析结果（ResumeParsed）是单独表还是嵌套 JSON？
③ AI 分析结果（ResumeAnalysis）是单独表还是嵌套 JSON？
④ 简历 PDF 文件存在哪里？（数据库 BLOB？文件系统？S3？）
⑤ 以后如果支持多人协作（HR 查看简历），表结构怎么扩展？

要求：不要写代码，讲本质原因。
```

### 30 分钟理解 3 个核心问题

**本质 1：为什么 Resume 是单独表，不是 User 字段？**

```
错误设计：
  User 表增加一个 resume JSON 字段
  问题：
  - 一个用户多份简历？只能存最新的
  - 简历很大（含解析结果）→ User 表每行膨胀
  - 查简历和查用户混在一起 → 性能互相影响

正确设计：
  User (1) ──→ Resume (N)
  用户可以有 10 份简历
  Resume 可以独立查询
  分表存储，互不影响
```

**本质 2：JSON 字段 vs 单独表的权衡**

```
ResumeParsed（姓名、技能、工作经验）：
  → 如果只是展示，JSON 字段够了（PostgreSQL JSONB）
  → 如果需要按技能搜索（"找所有懂 React 的候选人"）
  → 必须拆成单独表：Skill 表 + Experience 表

ResumeAnalysis（AI 分析结果）：
  → 通常是只读的、结构固定的 JSON
  → JSONB 足够
  → 不需要拆表

决策原则：
  - 需要查询的 → 拆表 + 索引
  - 只需要展示的 → JSONB
  - 会变化的 → 拆表
  - 只读的 → JSONB
```

**本质 3：文件存哪里？**

```
选择 1：数据库 BLOB
  ✅ 备份简单（一个 pg_dump 全包含）
  ❌ 数据库膨胀快
  ❌ 查询性能受影响
  ❌ 不适合大文件（> 10MB）

选择 2：文件系统
  ✅ 简单直接
  ❌ 服务器重启丢失（临时文件）
  ❌ 不支持分布式（多台服务器看不到对方文件）

选择 3：S3 / 阿里云 OSS（推荐）
  ✅ 独立存储，不拖累数据库
  ✅ CDN 加速
  ✅ 支持大文件
  ✅ 成本低

初期建议：数据库 + 文件系统双写（数据库存 Base64，文件系统存原始 PDF）
V2 迁移到 S3。
```

---

## 🌙 晚上 40 分钟（动手写代码）

### 第一步：更新 Prisma Schema（5 分钟）

在 `prisma/schema.prisma` 中增加 Resume Model：

参考设计：
```prisma
model Resume {
  id         String   @id @default(cuid())
  userId     String
  fileName   String
  fileSize   Int
  fileType   String   @default("application/pdf")
  fileData   Bytes?   // PDF 文件二进制（初期用，V2 改 S3）
  status     String   @default("uploading") // uploading | parsing | analyzing | ready | error
  rawText    String?  // PDF 解析后的文本

  // 结构化解析结果（JSONB）
  parsed     Json?    // ResumeParsed
  // AI 分析结果（JSONB）
  analysis   Json?    // ResumeAnalysis

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  sessions   InterviewSession[]

  @@index([userId])
  @@map("resumes")
}
```

然后运行 Migration：
```bash
npx prisma migrate dev --name add-resume
```

### 第二步：创建 ResumeRepository（10 分钟）

**`src/database/repositories/resume.repository.ts`**

Prompt：

```
帮我生成 Resume Repository。
项目路径：/Users/maxiangan/Desktop/project/ai
技术栈：Prisma + TypeScript

要求：
1. 文件路径 src/database/repositories/resume.repository.ts
2. 方法包括：
   - findById(id: string)
   - findByUserId(userId: string)
   - create(data: CreateResumeInput)
   - update(id: string, data: Partial<Resume>)
   - delete(id: string)
   - getFileData(id: string)   // 获取 PDF 文件数据
3. Repository 职责：只做数据查询，不做业务逻辑
4. 文件数据默认不返回（fileData 大字段避免默认加载）
5. 定义 CreateResumeInput 等 DTO
```

### 第三步：创建 ResumeService（10 分钟）

**`src/database/services/resume.service.ts`**

Prompt：

```
帮我生成 Resume Service。
项目路径：/Users/maxiangan/Desktop/project/ai

要求：
1. 文件路径 src/database/services/resume.service.ts
2. 依赖 ResumeRepository
3. 方法包括：
   - uploadResume(userId, fileBuffer, fileName) → 保存文件 + 创建 Resume 记录
   - getResumes(userId) → 用户的所有简历列表（不含文件数据）
   - getResumeDetail(resumeId, userId) → 单份简历详情 + 文件
   - deleteResume(resumeId, userId) → 删除简历 + 文件
   - updateAnalysis(resumeId, analysis) → 更新 AI 分析结果
4. 业务规则：
   - 文件大小限制（< 10MB）
   - 文件类型限制（仅 PDF）
   - 用户只能操作自己的简历（权限检查）
   - 删除时同时删除数据库记录和文件
5. 解析 PDF 后更新 rawText
```

### 第四步：重构 Resume API Route（10 分钟）

修改 `src/app/api/interview/analyze-resume/route.ts`：

```
Controller 职责：
  1. 获取当前用户（从 JWT/cookie）
  2. 获取上传文件（form-data）
  3. 调用 ResumeService.uploadResume()
  4. 如果是分析请求：
     - 调 PDF 解析器提取文本
     - 调 AI 分析
     - 调 ResumeService.updateAnalysis()
  5. 返回 Resume（不含 fileData）
```

**关键修改：**
- 删除直接操作 `interviewStore.addResume()` 的逻辑
- 所有数据从此经过 Service → Repository → Database
- 前端不再需要从 localStorage 读取简历

### 第五步：更新前端（5 分钟）

修改 `src/app/interview/resume/` 下的页面：
- 从 `GET /api/resumes` 获取简历列表
- 从 `POST /api/resumes/upload` 上传简历
- 从 `DELETE /api/resumes/:id` 删除简历

```typescript
// 之前：
const resumes = useInterviewStore((s) => s.resumes);

// 之后：
const [resumes, setResumes] = useState<Resume[]>([]);
useEffect(() => {
  fetch("/api/resumes").then(res => res.json()).then(setResumes);
}, []);
```

> **注意：** 今天只是把 Resume 数据源从 localStorage 切到 API。
> 完整的 React Query / SWR 状态管理重构在第 4 周。

### 第六步：验证 + Commit（2 分钟）

```bash
npm run build
git add -A
git commit -m "feat: Resume 数据持久化 - 三层架构完整链路

- 新增 Resume Prisma Model + Migration
- 实现 ResumeRepository（数据访问层）
- 实现 ResumeService（业务逻辑层+文件处理）
- 重构 Resume Upload/Analysis API（Controller层）
- 前端 Resume 页面切换到数据库查询

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 📝 睡前 10 分钟

### 更新 docs/15-postgresql.md

新增章节：

```markdown
## 九、Resume 数据设计

### 9.1 为什么单独建表
（JSON 字段的三个问题：多份简历、数据膨胀、查询耦合）

### 9.2 JSONB vs 单独表
（结构化和非结构化数据的存储决策树）

### 9.3 文件存储策略
（BLOB / 文件系统 / S3 对比 + 项目当前选择）

### 9.4 权限隔离
（用户只能看自己的简历：userId 外键 + 查询过滤）
```

### 回答 3 个问题

```
Q1：如果用户上传 100 份简历，数据库会怎样？
A1：（估算每条记录大小、总存储、索引效率）

Q2：JSONB 和单独表怎么选？决策标准是什么？
A2：（从"是否需要查询"出发画决策树）

Q3：PDF 文件存数据库 BLOB 有什么风险？
A3：（备份大小、查询性能、分布式部署）
```

### 🎤 面试模拟

```
我是阿里 P8 架构师。
追问 Resume 设计：
① 如果简历有 100 个字段，你还全放 Resume 表吗？
② 用户上传了一份 50MB 的 PDF，你怎么办？
③ 如果要在简历里搜 "懂 React 的候选人"，你的数据库方案是什么？
④ 多租户场景下（企业版），简历表怎么设计？
⑤ 简历的版本管理怎么做？（用户修改后能查看历史版本）
```

---

## 📁 今日产出

```
新增：
  src/database/repositories/resume.repository.ts
  src/database/services/resume.service.ts

修改：
  prisma/schema.prisma          ← 新增 Resume Model
  prisma/migrations/             ← add-resume Migration
  src/app/api/interview/analyze-resume/route.ts
  src/app/interview/resume/      ← 前端页面
  src/app/interview/resume/analysis/ ← 前端分析页面

更新：
  docs/15-postgresql.md         ← 新增 Resume 设计章节
```

---

## ⚠️ 常见陷阱

| 陷阱 | 正确做法 |
|------|---------|
| 把 PDF 解析逻辑写在 Service 里 | PDF 解析是工具方法，Service 只管编排 |
| 上传接口没做文件大小限制 | 一定设 limit，Nginx 默认可能只 1MB |
| 没做用户权限检查 | 每个查询都要带上 userId，防越权 |
| 一次返回所有简历含 fileData | 列表查询排除大字段，详情单独查 |

---

## 📌 明天预告

Day 5 — 面试对话落库

```
🚇 理解：AI 聊天数据为什么必须持久化？Context 怎么管理？
🌙 动手：Conversation + Message Model + Repository + Service
📝 产出：面试对话真正存进数据库
```

---

[← Day 3](day-03.md) | [Day 5 →](day-05.md)
