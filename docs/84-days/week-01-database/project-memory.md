---
name: learning-style
description: This user is a pure beginner learning full-stack from absolute zero. Teaching style that works.
metadata:
  type: user
  project: ai-interview-platform
---

The user is a complete beginner ("小白") with zero database or backend experience before starting this course.

**What works:**
- Step-by-step, one concept at a time. Never combine multiple steps in one go.
- Explain "what is this layer/component for" BEFORE writing any code. Use restaurant analogies (Controller=服务员, Service=厨师, Repository=采购员).
- Let them make decisions themselves (e.g., "id用自增还是cuid?"), don't give answers directly - guide them to think.
- After each concept, ask them to repeat in their own words to confirm understanding.
- Record EVERYTHING as notes in `docs/84-days/week-01-database/{day-number}/` with filenames like `小白的学习笔记-{topic}.md`.
- Keep a `00-学习进度.md` in each day's folder as a checklist dashboard.
- When they say "记录到第X天", write conversation notes immediately.
- When they need to start a fresh conversation (e.g., Day 4), generate memory context they can bring.

**Current progress (end of Day 3, 2026-07-22):**
- ✅ Day 2: Designed User + Resume Prisma Schema, created database (dev.db)
- ✅ Day 3: Understood B/C/A (backend/frontend-db connection/database essence)
- ✅ Day 3: Completed 3-layer architecture for ALL three User APIs (register, login, me)
- ✅ All three User APIs now read from database (no longer JSON file)
- ✅ Understood full data flow: Frontend → Controller → Service → Repository → Database
- ✅ Learned to view database data (sqlite3 CLI, Prisma Studio, VS Code plugin)
- ✅ Installed nvm, upgraded Node.js

**User's current understanding level (from their own words):**
- "Prisma是数据库的中介/翻译官"
- "前端通过接口调用后端，后端查数据取数据给前端"
- "数据库就是数据文件，但有特定的存储和查找方法"
- "三层架构：Controller只调用交给Service，Service处理逻辑交给Repository，Repository处理数据"
- "Repository只管查和取，JSON还需要处理数据" (they understand the benefit of Repository encapsulation)

**Technical decisions they made themselves:**
- User id: cuid (not auto-increment)
- Resume id: autoincrement
- score: Int type
- status: text strings (not numbers)
- email: @unique
- timestamps: @default(now()) and @updatedAt (database-managed)

**How to refer to me:**
When they start a new conversation for Day 4, they should say something like "继续Day4" or mention the project context.

**Key files modified/created:**
- `prisma/schema.prisma` - User + Resume models (with salt field added later)
- `src/database/client.ts` - Prisma Client singleton (Prisma 7 requires adapter)
- `src/database/repositories/user.repository.ts` - findByEmail, findById, create, toSafeUser
- `src/database/services/user.service.ts` - register, login, getProfile + BusinessError
- `src/app/api/auth/register/route.ts` - Controller (30 lines, refactored from 90 lines)
- `.env` - DATABASE_URL for SQLite
- `prisma.config.ts` - Prisma 7 config

**Day 3 progress note on database viewing (2026-07-22):**
The user learned three ways to view SQLite database data:
1. `sqlite3` command line - `sqlite3 dev.db "SELECT * FROM User;"`
2. Prisma Studio (now working after upgrading Node.js via nvm)
3. VS Code plugin SQLite Viewer (most beginner-friendly)
They also installed `nvm` and upgraded Node.js to fix Prisma Studio compatibility. Saw real data in the database firsthand.

**Day 4 plan (self-directed):**
The user wants to write the Resume CRUD API entirely on their own.
- DO NOT write code for them. Give hints, explain errors, point to references.
- They have the pattern from User: Repository → Service → Controller.
- Day 4 folder has `README.md` with requirements but no code.
- Let them struggle, make mistakes, and ask questions. That's how they learn.

**Pending for Day 4:**
- [ ] User writes Resume API on their own (no code from me)
