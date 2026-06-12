# Step 8：用户认证系统

> **本文覆盖：** 原理 → 架构 → 代码 → 面试考点 → 路由保护策略
> **新增路由：** `/auth/login` → `/auth/register` → 受保护路由重定向

---

## 一、原理

### 1.1 为什么需要认证系统？

认证系统是项目从"本地工具"变成"真正应用"的分水岭。

```
没有认证系统：                    有认证系统：
  数据存在 localStorage           数据可以存在服务端
  所有人共享同一份数据             每个用户独立数据
  不能部署上线                    可以部署到 Vercel
  面试官觉得"不够完整"            面试官觉得"像个正规项目"
```

### 1.2 认证流程

```
注册：
  用户填邮箱+密码+姓名 → POST /api/auth/register
    → 服务端校验邮箱是否已注册
    → PBKDF2 哈希密码（加盐 100000 轮迭代）
    → 存入内存用户表
    → 签发 JWT Token（7天有效）
    → 设置 HttpOnly Cookie → 返回用户信息

登录：
  用户填邮箱+密码 → POST /api/auth/login
    → 服务端查找用户
    → PBKDF2 验证密码
    → 签发 JWT Token
    → 设置 HttpOnly Cookie → 重定向到 /interview

路由保护：
  用户访问 /interview/xxx → 检查 Cookie
    → 有有效 Token → 正常渲染
    → 无 Token → 重定向到 /auth/login

登出：
  用户点击退出 → POST /api/auth/me
    → 清除 Cookie → 回到登录页
```

### 1.3 技术选型：为什么用 PBKDF2 + JWT？

```
密码存储方案对比：
┌──────────┬──────────┬──────────┬──────────┐
│ 方案      │ 是否需要  │ 安全性    │ 适用场景  │
│          │ 额外依赖  │          │          │
├──────────┼──────────┼──────────┼──────────┤
│ 明文存储  │ 否       │ ❌ 灾难   │ 绝不     │
│ MD5/SHA1 │ 否       │ ❌ 彩虹表  │ 绝不     │
│ bcrypt   │ 是       │ ✅✅ 好   │ Node.js  │
│ PBKDF2   │ 否       │ ✅✅ 好   │ Edge     │
│ argon2   │ 是       │ ✅✅✅ 最佳 │ 服务端   │
└──────────┴──────────┴──────────┴──────────┘

选 PBKDF2 的原因：
1. Web Crypto API 原生支持，零额外 npm 依赖
2. Next.js 16 Edge Runtime 兼容
3. 100000 轮迭代 + SHA-256，暴力破解成本高

JWT 选型：
- 无状态（不需要服务端存 session）
- 7 天过期时间，用户无需频繁登录
- HttpOnly Cookie 防止 XSS 窃取 Token
```

---

## 二、架构设计

### 2.1 文件结构

```
src/
├── proxy.ts                        ← Next.js Proxy（原 middleware）
├── types/
│   └── auth.ts                     ← 用户/认证类型定义
│
├── lib/auth/
│   ├── utils.ts                    ← JWT 签发/验证 + 密码哈希
│   └── store.ts                    ← 用户存储（内存模式）
│
├── components/auth/
│   └── auth-context.tsx            ← 客户端认证上下文
│
├── app/api/auth/
│   ├── register/route.ts           ← POST 注册
│   ├── login/route.ts              ← POST 登录
│   └── me/route.ts                 ← GET 获取用户 / POST 登出
│
└── app/auth/
    ├── login/page.tsx              ← 登录页面
    └── register/page.tsx           ← 注册页面
```

### 2.2 数据流

```
┌────────────────────────────────────────────────────────────┐
│                     未登录用户                               │
│                                                             │
│  访问 /interview/xxx                                          │
│      │                                                      │
│      ▼                                                      │
│  proxy.ts (检查 Cookie)                                     │
│      │                                                      │
│      ├─ Cookie 有有效 Token → 继续渲染页面                    │
│      └─ 无 Token → 302 重定向到 /auth/login                 │
│                                                             │
│  /auth/login                                                 │
│      │                                                      │
│      ▼                                                      │
│  填写邮箱+密码 → POST /api/auth/login                        │
│      │                                                      │
│      ▼                                                      │
│  login/route.ts:                                             │
│  1. 查找用户                                                │
│  2. PBKDF2 验证密码                                          │
│  3. 签发 JWT (7天)                                          │
│  4. 设置 HttpOnly Cookie                                     │
│      │                                                      │
│      ▼                                                      │
│  前端 AuthContext 更新 user 状态                              │
│      │                                                      │
│      ▼                                                      │
│  跳转到 /interview                                           │
└────────────────────────────────────────────────────────────┘
```

### 2.3 AuthContext 设计

```
AuthProvider (Client Component)
├── user: User | null         ← 当前登录用户
├── loading: boolean          ← 初始化加载中
├── login(email, password)    → 登录，返回 error | null
├── register(email, pwd, name)→ 注册，返回 error | null
├── logout()                  → 登出，跳转登录页
└── refresh()                 → 重新获取用户信息

使用方式：
  const { user, loading, login, logout } = useAuth();
  if (loading) return <Loading />;
  if (!user) redirect("/auth/login");
```

### 2.4 密码存储格式

```
UserWithPassword {
  id: "user_1741256689123_abc123",
  email: "user@example.com",
  name: "马香安",
  passwordHash: "a1b2c3...（64字节 hex）",  ← PBKDF2(SHA-256, 100000轮)
  salt: "d4e5f6...（32字节 hex）",          ← 随机 salt
  createdAt: 1741256689123
}
```

---

## 三、代码实现详解

### 3.1 密码哈希（Web Crypto API）

```typescript
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToArrayBuffer(salt),
      iterations: 100000,       // 迭代轮数
      hash: "SHA-256",          // 哈希算法
    },
    keyMaterial,
    64 * 8                       // 输出 64 字节
  );

  return arrayBufferToHex(derivedBits);
}
```

**安全性说明：**
- 100000 次 PBKDF2 迭代：暴力破解 1 个密码约需 0.1 秒
- 32 字节随机 salt：每个用户 salt 不同，彩虹表无效
- 64 字节输出：等同于 SHA-512 长度

### 3.2 JWT 签发（jose 库）

```typescript
export async function signToken(user: User): Promise<string> {
  return new SignJWT({ 
    sub: user.id, 
    email: user.email, 
    name: user.name 
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("ai-interview-platform")
    .setAudience("ai-interview-users")
    .setExpirationTime("7d")      // 7 天过期
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, JWT_SECRET, {
    issuer: "ai-interview-platform",
    audience: "ai-interview-users",
  });
  return { sub: payload.sub!, email: payload.email!, name: payload.name! };
}
```

### 3.3 Proxy 路由保护

```typescript
// src/proxy.ts
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 跳过公开 API（登录/注册）
  if (PUBLIC_API_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 检查受保护路由
  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // 检查 Cookie
  const token = request.cookies.get("token")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
```

### 3.4 Cookie vs localStorage Token

```
为什么用 HttpOnly Cookie 而不是 localStorage？

  localStorage 存 Token:
    ✅ 前端可以轻松读取
    ❌ XSS 攻击可以窃取 Token
    ❌ 无法在 Proxy 中读取（服务端）

  HttpOnly Cookie:
    ❌ 前端无法读取（需要用 AuthContext）
    ✅ XSS 攻击无法窃取
    ✅ Proxy 可以读取（路由保护）
    ✅ 自动带在请求中

结论：HttpOnly Cookie 更安全，适合需要路由保护的场景。
```

---

## 四、实际业务场景

### 场景 1：新用户注册

```
1. 访问 /interview → 被 proxy 重定向到 /auth/login
2. 点击"注册" → 进入 /auth/register
3. 填写姓名、邮箱、密码 → 点击注册
4. POST /api/auth/register → 校验 → 哈希密码 → 创建用户
5. 自动登录 → 跳转到 /interview
6. Navbar 右上角显示用户名 + 退出按钮
```

### 场景 2：已有用户登录

```
1. 访问 /interview → 重定向到 /auth/login
2. 输入邮箱密码 → 点击登录
3. POST /api/auth/login → 验证密码 → 签发 Token
4. 设置 Cookie → 跳转到 /interview
5. AuthContext 通过 /api/auth/me 获取用户信息
```

### 场景 3：Token 过期

```
1. Cookie 中的 JWT 已过期（7天后）
2. 访问 /interview → proxy 读到 Token → 验证失败（jwtVerify 抛异常）
3. proxy 判定为无 Token → 重定向到 /auth/login
4. 用户重新登录 → 签发新 Token

注意：当前 proxy 中只检查 Cookie 是否存在，
不验证 Token 有效性（避免每次请求都解密 JWT 的开销）。
真正的身份验证在 API 层完成。
```

---

## 五、常见面试问题

### Q1: 为什么不用 NextAuth.js / Auth.js？

> 这个项目不需要 OAuth（GitHub/Google 登录）和第三方 provider，
> 只需要基本的邮箱密码认证。自己实现的好处：
> - **零额外依赖** — 只用 Web Crypto API + jose
> - **完全可控** — 认证逻辑全部自己写，面试时能说清楚每一步
> - **轻量** — 不引入 10MB+ 的认证库

### Q2: 密码安全怎么保证的？

> 三层保护：
> 1. **PBKDF2 + SHA-256** — 100000 轮迭代，暴力破解成本高
> 2. **随机 salt** — 32 字节，每个用户不同，彩虹表无效
> 3. **HttpOnly Cookie** — XSS 攻击无法窃取 Token
>
> 对比很多小网站用 MD5 存密码，这个方案在个人项目中已经足够安全。

### Q3: 为什么用内存存储而不是数据库？

> V1 用内存存储用户（和 JD Store 同样的模式），
> 目的是快速验证认证流程的正确性。
> V4 计划迁移到 PostgreSQL，数据模型已经设计好——
> 只需要把 `findUserByEmail` 和 `createUser` 的实现
> 从数组操作换成 SQL 查询。

### Q4: Proxy 和 Middleware 有什么区别？

> Next.js 16 把 `middleware.ts` 重命名为 `proxy.ts`，
> 功能完全一样，只是名字变了。
> Proxy 运行在 Edge Runtime，在请求到达页面之前执行，
> 适合做：认证检查、重定向、Header 修改、A/B 测试。

---

## 六、实际优化方案

### 当前 V1 限制

| 限制 | 影响 | 改进 |
|------|------|------|
| 内存存储用户 | 重启后数据丢失 | 迁移 PostgreSQL |
| 无密码重置 | 忘记密码无法找回 | 邮箱验证码 |
| 无邮箱验证 | 注册后不验证邮箱 | 发送验证邮件 |
| Proxy 不解密 JWT | 过期 Token 只到 API 层才暴露 | Proxy 层验证 Token 有效性 |

---

## 七、核心代码路径

```
注册流程：
用户填表单 → auth/register/page.tsx (handleSubmit)
  → AuthContext.register(email, password, name)
  → fetch POST /api/auth/register
  → register/route.ts (校验 → hashPassword → createUser)
  → utils.ts (generateSalt → hashPassword → signToken)
  → store.ts (createUser → 存入数组)
  → 返回 { user, token } + Set-Cookie Header
  → AuthContext 更新 user
  → router.push("/interview")

登录流程：
用户填表单 → auth/login/page.tsx (handleSubmit)
  → AuthContext.login(email, password)
  → fetch POST /api/auth/login
  → login/route.ts (findUserByEmail → verifyPassword)
  → utils.ts (verifyPassword → signToken)
  → 返回 { user, token } + Set-Cookie Header
  → AuthContext 更新 user
  → router.push("/interview")

路由保护流程：
用户访问 /interview → proxy.ts
  → 检查 /interview 是否在受保护列表 → 是
  → 检查 Cookie 是否有 token → 无
  → 302 重定向到 /auth/login?redirect=/interview

登出流程：
用户点击退出 → Navbar.logout()
  → fetch POST /api/auth/me
  → me/route.ts (清除 Cookie)
  → AuthContext 设置 user = null
  → router.push("/auth/login")
```

---

## 八、新增文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/types/auth.ts` | 🆕 | 用户/认证类型 |
| `src/lib/auth/utils.ts` | 🆕 | JWT 签发验证 + PBKDF2 密码哈希 + Cookie 工具 |
| `src/lib/auth/store.ts` | 🆕 | 用户存储（内存模式） |
| `src/proxy.ts` | 🆕 | 路由保护（原 middleware.ts） |
| `src/components/auth/auth-context.tsx` | 🆕 | 客户端认证上下文 |
| `src/app/api/auth/register/route.ts` | 🆕 | 注册 API |
| `src/app/api/auth/login/route.ts` | 🆕 | 登录 API |
| `src/app/api/auth/me/route.ts` | 🆕 | 获取用户/登出 API |
| `src/app/auth/login/page.tsx` | 🆕 | 登录页面 |
| `src/app/auth/register/page.tsx` | 🆕 | 注册页面 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/app/layout.tsx` | 包裹 AuthProvider |
| `src/components/shared/navbar.tsx` | 显示用户名 + 退出/登录按钮 |

---

> **上一篇:** [项目包装](10-project-wrap.md)
> **回到开头:** [架构设计](01-architecture.md)
