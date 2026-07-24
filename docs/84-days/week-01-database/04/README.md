# Day 4 — 自己写 Resume 接口

> 你已经理解了完整的数据流：
> 前端 → routes → Service → Repository → 数据库
>
> 现在你自己动手，不靠我写代码。

---

## 你的任务

仿照 User 的三个文件，自己写 Resume 的三个文件：

```
对照 User 的写法，自己写 Resume：

user.repository.ts     →  你写 resume.repository.ts
user.service.ts        →  你写 resume.service.ts
register/route.ts      →  你写 resume 的 API 路由
```

---

## 需求说明

### 1. Resume 需要哪些功能？

| 功能 | 说明 |
|------|------|
| 创建简历 | 用户上传简历，存到数据库 |
| 查看简历列表 | 查看当前用户的所有简历 |
| 查看简历详情 | 查看单份简历的完整信息 |
| 删除简历 | 删除某份简历 |

### 2. 参考 Schema（已经在 Day 2 建好了）

```prisma
model Resume {
  id            Int      @id @default(autoincrement())
  userId        String
  resumeName    String
  resumeContext Json?
  size          Int
  score         Int?
  status        String   @default("上传中")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user          User     @relation(fields: [userId], references: [id])
  @@index([userId])
}
```

### 3. Repository 需要的方法

```
findByUserId(userId)  → 查某个用户的所有简历
findById(id)          → 查单份简历
create(data)          → 创建简历
delete(id)            → 删除简历
```

### 4. Service 需要的方法

```
createResume(userId, resumeName, size) → 创建一份简历
getResumes(userId)                      → 获取用户的所有简历
getResumeById(resumeId, userId)         → 获取单份简历（要检查 userId 权限）
deleteResume(resumeId, userId)          → 删除简历（要检查 userId 权限）
```

### 5. API 路由

```
POST   /api/resumes          → 创建简历（body: { resumeName, size }）
GET    /api/resumes          → 获取当前用户的所有简历
GET    /api/resumes/[id]     → 获取单份简历
DELETE /api/resumes/[id]     → 删除简历
```

---

## 提示（不写代码，只给思路）

### 文件路径参考

```
src/database/repositories/resume.repository.ts
src/database/services/resume.service.ts
src/app/api/resumes/route.ts          ← 列表 + 创建
src/app/api/resumes/[id]/route.ts     ← 详情 + 删除
```

### 可能用到的东西

```typescript
// Repository 里调 Prisma
prisma.resume.findMany({ where: { userId } })
prisma.resume.findUnique({ where: { id } })
prisma.resume.create({ data: { ... } })
prisma.resume.delete({ where: { id } })

// Service 里的权限检查
if (resume.userId !== userId) throw new BusinessError("无权操作")

// Controller 里获取当前用户（从 Token）
// 参考 me/route.ts 里的 extractTokenFromCookie 和 verifyToken
```

### 测试方法

```bash
# 先登录拿到 Token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 创建简历
curl -s -X POST http://localhost:3000/api/resumes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"resumeName":"我的简历","size":1024}'

# 查看简历列表
curl -s http://localhost:3000/api/resumes \
  -H "Authorization: Bearer $TOKEN"
```

---

## 你遇到任何问题都可以问我

我不会直接给你写代码，但可以：
- ✅ 解释报错信息
- ✅ 告诉你思路对不对
- ✅ 指出哪里可能有问题
- ✅ 验证你的理解

**加油！你已经完全有能力自己写出来了！💪**
