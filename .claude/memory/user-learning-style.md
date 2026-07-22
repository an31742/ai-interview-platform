---
name: user-learning-style
description: Teaching approach and progress for this beginner learner
metadata:
  type: user
  project: ai-interview-platform
  day: 3
---

The user is a complete beginner ("小白") learning full-stack from absolute zero.

**Teaching approach that works:**
- Step-by-step, one concept at a time. Never combine multiple steps.
- Explain purpose BEFORE writing code ("这一层是干什么的").
- Restaurant analogies: Controller=服务员, Service=厨师, Repository=采购员.
- Let them make their own decisions guided by questions, not given answers.
- Have them repeat concepts in their own words to confirm.
- Record everything as notes in `docs/84-days/week-01-database/{day}/`.

**Why they preferred not to use plain Node/Express:**
They realized Next.js bundles front+back and can blur concepts, but the current approach works because we stay focused on `src/database/` + `src/app/api/` and ignore frontend code. Keep doing this — let them see the backend layer clearly.

**Progress (end of Day 3, 2026-07-22):**
- Day 2: Schema design (User + Resume), created SQLite database
- Day 3: B/C/A backend concepts, 3-layer architecture, registration working with database
- Day 3: Learned to view database data (sqlite3 CLI), installed nvm, upgraded Node.js
- Created a "小白版" Week 1 study plan adapted for zero-beginners

**Key technical decisions the user made (guide don't override):**
- User id: cuid, Resume id: autoincrement
- score: Int, status: text strings
- email: @unique, timestamps: database-managed

**Day 4 pending:**
- Refactor login and me routes from JSON files to database
- Resume upload and storage

**Key files:**
- `prisma/schema.prisma` — User + Resume models
- `src/database/` — client, repositories, services
- `src/lib/auth/store.ts` — OLD JSON file store (to be phased out)
- `.env` — DATABASE_URL="file:./dev.db"
- `prisma.config.ts` — Prisma 7 config (url is here, not in schema)
|user-learning-style
