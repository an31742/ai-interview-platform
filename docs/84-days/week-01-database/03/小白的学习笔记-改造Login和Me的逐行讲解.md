# 小白的学习笔记：改造 Login + Me API（一步步看逻辑）

日期：2026-07-22
学习主题：把登录和查用户信息从 JSON 文件改成数据库
关键原则：不改逻辑，只改"数据从哪来"——Service 已经写好了，只动 Controller

---

## 一、先看清全貌

三个用户相关的 API：

```
POST /api/auth/register   → register/route.ts   → JSON 文件  ✅ 已改数据库
POST /api/auth/login      → login/route.ts      → JSON 文件  ❌ 今天要改
GET  /api/auth/me         → me/route.ts         → JSON 文件  ❌ 今天要改
```

它们都在同一个目录：`src/app/api/auth/`

---

## 二、改之前先想清楚：为什么要改？

### 看看 Service 已经有什么

| Service 方法 | 对应哪个 API | 做了什么 |
|---|---|---|
| userService.register(email, password, name) | register | 校验+查重+哈希+创建 |
| userService.login(email, password) | login | 查用户+验密码+去密码返回 |
| userService.getProfile(userId) | me | 查用户+去密码返回 |

**Service 已经全部写好了。** 现在 Controller 只是在两个选项之间选：

```
选项 A：自己干
  自己调 JSON 文件 → 自己验证 → 自己返回

选项 B：调 Service
  调 Service → Service 调 Repository 查数据库 → 返回

选项 A 是我以前的做法（写在 JSON 文件里）
选项 B 是三层架构的做法（写在数据库里）
```

### 要改的只有一行

```
改之前：const user = await findUserByEmail(email)      ← 读 JSON 文件
改之后：const user = await userService.login(email, password)  ← 走数据库

剩下的（签发 Token、设置 Cookie、返回）完全不变。
```

---

## 三、login/route.ts 逐行对比

### 改之前（旧代码）

第 1 块：import 引入

```typescript
import { findUserByEmail, toSafeUser } from "@/lib/auth/store";
```

这一行是问题的根源：
- findUserByEmail → 从 JSON 文件查用户
- toSafeUser → 去掉密码字段
- 两个函数都在 src/lib/auth/store.ts 里（JSON 文件读写）

第 2 块：查用户

```typescript
const user = await findUserByEmail(email);
if (!user) {
  return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
}
```

这行在做两件事：
- 查用户（"去 JSON 文件里找这个邮箱"）
- 没找到就返回 401

第 3 块：验证密码

```typescript
const valid = await verifyPassword(password, user.salt, user.passwordHash);
if (!valid) {
  return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
}
```

验证密码对不对（这步必须做，而且必须放在后端）

第 4 块：去密码 + 签发 Token

```typescript
const safeUser = toSafeUser(user);
const token = await signToken(safeUser);
```

toSafeUser 去掉 passwordHash 和 salt
signToken 生成 JWT Token

### 改之后（新代码）

第 1 块：import 变了

```typescript
// 删掉这两行：
import { findUserByEmail, toSafeUser } from "@/lib/auth/store";

// 加上这两行：
import { userService, BusinessError } from "@/database/services/user.service";
```

为什么？
- userService.login 里面已经包含了：查用户 + 验密码 + 去密码
- BusinessError 是 Service 抛出的"业务错误"类型

第 2 块：查用户 + 验密码 + 去密码，三件事变成一句话

```typescript
// 之前是 4 段代码共 15 行：
const user = await findUserByEmail(email);
if (!user) { return Response(...) }
const valid = await verifyPassword(password, user.salt, user.passwordHash);
if (!valid) { return Response(...) }
const safeUser = toSafeUser(user);

// 之后是 1 段代码 1 行：
const user = await userService.login(email, password);
```

这一行代替了上面 4 段代码。Service 内部做了：
1. 查数据库（调 Repository）
2. 判断用户存不存在 → 不存在抛 BusinessError
3. 验证密码对不对 → 不对抛 BusinessError
4. 返回安全用户（不含密码）

第 3 块：错误处理变了

```typescript
// 之前：所有错误都返回 500
const message = err instanceof Error ? err.message : "登录失败";
return NextResponse.json({ error: message }, { status: 500 });

// 之后：区分业务错误和系统错误
if (err instanceof BusinessError) {
  return NextResponse.json({ error: err.message }, { status: 401 });
}
// 其他错误 → 返回"服务器内部错误"
```

为什么？
- BusinessError = "邮箱或密码错误" → 用户输入错了 → 返回 401
- 其他 Error = 服务器炸了 → 返回 500，不暴露细节

---

## 四、整个流程完整走一遍

### 登录成功时

```
你输入 email="test@example.com", password="123456"
    ↓
login/route.ts（Controller）
    ① 解析请求：拿到 email 和 password
    ② 调 userService.login("test@example.com", "123456")
    ↓
user.service.ts（Service）
    ③ 调 userRepository.findByEmail("test@example.com")
    ↓
user.repository.ts（Repository）
    ④ prisma.user.findUnique({ where: { email: "test@example.com" } })
    ↓
SQLite 数据库
    ⑤ 查到用户：id, email, name, passwordHash, salt, createdAt, updatedAt
    ↑
    ⑥ 数据返回给 Repository → Service
    ↓
user.service.ts
    ⑦ 验证密码：把你输入的 "123456" + 数据库的 salt 加密
    ⑧ 和数据库的 passwordHash 对比 → 一样 → 密码正确
    ⑨ 去掉 passwordHash 和 salt → 返回 SafeUser
    ↓
login/route.ts（Controller）
    ⑩ 签发 Token → 设置 Cookie → 返回 { user, token }
```

### 密码错误时

```
你输入 email="test@example.com", password="wrong"
    ↓
①~⑥ 同上（查到用户）
    ↓
user.service.ts
    ⑦ 验证密码：把你输入的 "wrong" + 数据库的 salt 加密
    ⑧ 和数据库的 passwordHash 对比 → 不一样 → 密码错误
    ⑨ throw new BusinessError("邮箱或密码错误")
    ↓
login/route.ts（Controller）
    ⑩ catch 到 BusinessError
    ⑪ 返回 401：{ error: "邮箱或密码错误" }
```

---

## 五、me/route.ts 的改造（更简单）

me 比 login 更简单，因为它**不需要验证密码**——只需要查用户。

### 改之前

```typescript
// 从 Token 里拿到 userId → 去 JSON 文件查
const user = await findUserById(payload.sub);
// 去掉密码再返回
return NextResponse.json({ user: toSafeUser(user) });
```

### 改之后

```typescript
// 从 Token 里拿到 userId → 调 Service 从数据库查
const user = await userService.getProfile(payload.sub);
// getProfile 已经自动去掉密码了
return NextResponse.json({ user });
```

### 为什么 me 不需要 BusinessError？

因为 getProfile 的代码：

```typescript
async getProfile(userId: string): Promise<SafeUser | null> {
  const user = await userRepository.findById(userId);
  if (!user) return null;          // 没找到就返回 null
  return userRepository.toSafeUser(user);  // 找到就去掉密码
}
```

它不抛 BusinessError，而是返回 null。所以 Controller 只需要判断：

```typescript
if (!user) {
  return NextResponse.json({ error: "用户不存在" }, { status: 401 });
}
```

---

## 六、改完之后怎么确认没改坏？

用 curl 测试。我的测试方法是：

### 测试 login（三种场景）

```bash
# 场景 1：登录成功
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'
# 应该返回：{ user: {...}, token: "..." }

# 场景 2：密码错误
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}'
# 应该返回：{ error: "邮箱或密码错误" }

# 场景 3：邮箱不存在
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@test.com","password":"123456"}'
# 应该返回：{ error: "邮箱或密码错误" }
```

### 测试 me

```bash
# 先登录拿到 Token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 用 Token 查用户信息
curl -s http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
# 应该返回：{ user: { id, email, name, createdAt } }
# 注意：没有 passwordHash！
```

---

## 七、怎么在前端直接测试？

你的 Next.js 服务器在 http://localhost:3000 运行着。

### 方法 1：浏览器地址栏（只能测 GET）

打开 Chrome/Safari，地址栏输入：

```
http://localhost:3000/api/auth/me
```

但这个方法**不会带 Token**，所以会返回 401。

### 方法 2：浏览器开发者工具 Console

打开你的项目页面（http://localhost:3000），按 F12 打开开发者工具 → 点 Console 标签，输入：

```javascript
fetch("/api/auth/login", {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({email: "test@example.com", password: "123456"})
}).then(r => r.json()).then(data => {
  console.log("登录结果:", data);
  // 如果能登录成功，再用 token 查 me
  if (data.token) {
    fetch("/api/auth/me", {
      headers: {"Authorization": "Bearer " + data.token}
    }).then(r => r.json()).then(me => console.log("用户信息:", me));
  }
});
```

### 方法 3：你的前端页面已经可以直接用了

如果你项目里有登录页面，输入 test@example.com / 123456，点击登录，它调的就是这个 API——现在走的是数据库，不是 JSON 文件了。

**你不需要改任何前端代码，因为 API 的路径没变、返回的格式没变，变的只是数据来源。**

---

## 八、总结：今天改了什么

```diff
- src/app/api/auth/login/route.ts
-  把 findUserByEmail（JSON 文件）换成 userService.login()（数据库）
-  把 toSafeUser 去掉 → Service 已经去掉了
-  把 BusinessError 分开处理（业务错误 401 / 系统错误 500）

- src/app/api/auth/me/route.ts
-  把 findUserById + toSafeUser（JSON 文件）换成 userService.getProfile()（数据库）
-  不需要 BusinessError，因为 getProfile 返回 null 而不是抛错
```

### 核心逻辑变化

```
改之前：Controller → 直接读 JSON 文件 → 自己验证 → 自己返回
改之后：Controller → 调 Service → Service 调 Repository → 查数据库 → 返回

Controller 从 70 行缩到 40 行（login）和 30 行（me）。
每一行代码都在干自己该干的事。
```
