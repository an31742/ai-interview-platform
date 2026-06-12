# Step 2：简历上传 + PDF 解析 + AI 分析

> **本文覆盖：** 原理 → 架构 → 代码 → 面试考点 → 实际优化方案 → 排错指南
> **对应学习计划：** Day50（Prompt工程） + Day51（Token机制） + Day52（Embedding） + Day53（RAG原理） + Day54（Function Calling） + Day55（Agent概念）

---

## 一、原理

### 1.1 简历上传的完整链路（V3 最终版）

```
用户拖拽PDF → 前端 FormData → API 路由
    → pdfjs-dist 解析文本 → DeepSeek 提取结构化信息
    → DeepSeek 分析优劣势 → 返回 JSON
    → 存入 Zustand + 后台索引到 ChromaDB（RAG）
    → 展示分析报告
```

这条链路涉及四个核心技术环节：

| 环节 | 技术 | 解决什么问题 |
|------|------|------------|
| PDF解析 | pdfjs-dist/legacy | 从二进制 PDF 中提取纯文本（Node.js 兼容） |
| 结构化提取 | DeepSeek + JSON Mode | 从非结构化文本中提取姓名/技能/项目等 |
| 优劣势分析 | DeepSeek + Prompt 工程 | 基于提取的信息给出面试准备建议 |
| RAG 索引 | ChromaDB + Embedding | 简历向量化，面试时检索增强追问 |

### 1.2 为什么分两步调用 AI？

```
两步调用（当前方案）：                一次调用（替代方案）：
┌──────────────────┐               ┌──────────────────┐
│ PDF原始文本        │               │ PDF原始文本        │
│       │           │               │       │           │
│       ▼           │               │       ▼           │
│ 提取结构化信息     │               │ 提取+分析一次完成   │
│  (JSON Mode)     │               │  (可能遗漏细节)    │
│  temperature=0.1  │               └──────────────────┘
│       │           │
│       ▼           │
│ 分析优劣势         │
│  (基于结构化数据)  │
│  temperature=0.3  │
└──────────────────┘
```

**两步的优势：**
1. **准确性更高** — 第一阶段聚焦"提取不遗漏"（低温度 0.1），第二阶段聚焦"分析有深度"（温度 0.3）
2. **互不干扰** — 如果第一阶段出错，第二阶段不受影响
3. **调试方便** — 分开调用可以独立测试每阶段的输出质量
4. **Token 可控** — 第二阶段输入是结构化 JSON，比原始 PDF 文本少 60-80% Token

### 1.3 为什么用 pdfjs-dist 而不是 pdf-parse？

> **踩坑记录：** 最初用了 `pdf-parse v2`，但它的 worker 加载方式在 Next.js 服务端环境下报错：
> `Setting up fake worker failed: Cannot find module 'pdf.worker.mjs'`
>
> **解决方案：** 改用 `pdfjs-dist/legacy`。legacy build 包含了完整的 Node.js 兼容代码，
> 无需配置 web worker。同时需要在 `next.config.ts` 中加入 `serverExternalPackages: ["pdfjs-dist"]`，
> 防止 Next.js 打包它。

```
对比维度       pdf-parse v2          pdfjs-dist/legacy
─────────     ──────────            ────────────────
API 简洁度      ✅ 一行搞定            ❌ 需要手动逐页提取
中文支持        ✅ 好                  ✅ 好（useSystemFonts）
Node.js 兼容   ❌ worker 加载失败      ✅ 原生支持
worker 配置    需要                   不需要
维护状态       活跃                    Mozilla 官方维护
```

---

## 二、架构设计

### 2.1 完整文件结构（含 RAG）

```
src/
├── lib/interview/
│   ├── agents/
│   │   └── resume-analyzer.ts    ← ResumeAnalyzer Agent（核心）
│   ├── prompts/
│   │   └── resume-analysis.ts    ← 两阶段 Prompt 模板
│   ├── utils/
│   │   └── pdf-parser.ts         ← pdfjs-dist 封装（独立于 RAG）
│   └── services/
│       └── rag-context.ts        ← 简历 RAG 索引 + 检索
│
├── app/api/interview/
│   └── analyze-resume/
│       └── route.ts              ← 上传+分析 API 路由
│
├── app/interview/resume/
│   ├── page.tsx                  ← 简历管理页面（上传+列表）
│   └── analysis/
│       └── page.tsx              ← 分析报告展示页面
│
└── types/
    └── interview.ts              ← Resume / ResumeParsed / ResumeAnalysis 类型
```

### 2.2 AI Agent 设计

```
ResumeAnalyzer Agent
├── 职责: 接收简历纯文本 → 返回结构化信息 + 优劣势分析
│
├── 第一阶段: extractResumeInfo()
│   ├── Prompt: RESUME_EXTRACTION_PROMPT
│   ├── 模型: DeepSeek (temperature=0.1)
│   ├── 输出格式: JSON Mode（system prompt 必须含 "json" 字样）
│   └── 输出: ResumeParsed
│
├── 第二阶段: analyzeResumeStrengths()
│   ├── Prompt: RESUME_ANALYSIS_PROMPT
│   ├── 输入: 第一阶段的输出(JSON)
│   ├── 模型: DeepSeek (temperature=0.3)
│   ├── 输出格式: JSON Mode
│   └── 输出: ResumeAnalysis
│
├── RAG 索引（后台异步）
│   ├── 索引文本: buildIndexText() — 结构化数据组合
│   ├── 向量库: ChromaDB (collection: "interview_resume")
│   └── 时机: API 返回后非阻塞执行
│
└── 总入口: analyzeResume()
    ├── 调用第一阶段
    ├── 调用第二阶段
    └── 返回 { parsed, analysis }
```

### 2.3 API 请求-响应

```
POST /api/interview/analyze-resume
Content-Type: multipart/form-data

Request:
  file: (binary PDF, max 10MB)

Response 200:
{
  "id": "uuid",
  "fileName": "马香安-前端开发工程师.pdf",
  "fileSize": 123456,
  "pageCount": 2,
  "rawText": "马香安...（前2000字）",
  "parsed": {
    "name": "马香安",
    "title": "高级前端开发工程师",
    "yearsOfExperience": 7,
    "skills": ["Vue", "React", "TypeScript", "Next.js", ...],
    "experience": [
      { "company": "上海科之锐", "role": "高级前端开发工程师", ... }
    ],
    "education": [...],
    "projects": [
      { "name": "Legion Zone AI", "techStack": ["Next.js", ...], ... }
    ]
  },
  "analysis": {
    "strengths": ["AI应用实战经验", ...],
    "weaknesses": ["CSS基础概念不够扎实", ...],
    "suggestedFocus": ["SSE流式渲染原理", ...],
    "confidence": 75,
    "missingKeywords": ["Webpack优化", "Node.js"],
    "suggestion": "你的AI项目经验是最大亮点..."
  }
}

Response 400:
{ "error": "仅支持 PDF 文件格式" }

Response 500:
{ "error": "PDF 解析错误: ...", "hint": "请确认简历是文字版PDF（非扫描件）" }
```

---

## 三、代码实现详解

### 3.1 PDF 解析器（pdfjs-dist/legacy）

```typescript
// src/lib/interview/utils/pdf-parser.ts

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function parsePdf(fileBuffer: Buffer, filename: string) {
  // 1. 加载文档，useSystemFonts 确保中文支持
  const pdfDocument = await getDocument({
    data: new Uint8Array(fileBuffer),
    useSystemFonts: true,
  }).promise;

  // 2. 逐页提取文本，按纵坐标保留段落结构
  const pages: string[] = [];
  for (let i = 1; i <= pdfDocument.numPages; i++) {
    const page = await pdfDocument.getPage(i);
    const content = await page.getTextContent();
    
    let lastY: number | null = null;
    let text = "";

    for (const item of content.items) {
      const textItem = item as any;
      const y = textItem.transform?.[5] ?? 0;
      
      if (lastY !== null && Math.abs(y - lastY) > 5) {
        text += "\n";     // 纵坐标变化大 → 换行
      } else if (text.length > 0 && !text.endsWith("\n")) {
        text += " ";      // 同行 → 空格
      }
      
      text += textItem.str;
      lastY = y;
    }
    pages.push(text.trim());
  }

  return {
    text: pages.filter(p => p.length > 0).join("\n\n--- 第 --- 页---\n\n"),
    pageCount: pdfDocument.numPages,
    metadata: { filename, pageCount: String(pdfDocument.numPages) },
  };
}
```

**关键设计点：**

| 设计 | 为什么 |
|------|--------|
| `useSystemFonts: true` | 中文 PDF 依赖系统字体渲染，不加这个会报字体错误 |
| `pdfjs-dist/legacy` | legacy build 包含 Node.js polyfill，不需要配 worker |
| 纵坐标判断换行 | PDF 文本内容的位置信息在 transform 中，纵坐标变化说明换行了 |
| `serverExternalPackages` | 防止 Next.js 打包 pdfjs-dist，保持原生 Node 加载 |

### 3.2 ResumeAnalyzer Agent

```typescript
// src/lib/interview/agents/resume-analyzer.ts

export async function analyzeResume(rawText: string) {
  // 第一阶段：提取结构化信息（低温度）
  const parsed = await extractResumeInfo(rawText);
  
  // 第二阶段：分析优劣势（中度温度）
  const analysis = await analyzeResumeStrengths(parsed);
  
  return { parsed, analysis };
}

async function extractResumeInfo(rawText: string): Promise<ResumeParsed> {
  const response = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages: [
      { role: "system", content: "你是一个专业的简历解析器。..." },
      { role: "user", content: RESUME_EXTRACTION_PROMPT + rawText },
    ],
    temperature: 0.1,            // 低温度，保证提取准确性
    response_format: { type: "json_object" },  // JSON Mode
  });
  return JSON.parse(response.choices[0]?.message?.content || "{}");
}

async function analyzeResumeStrengths(parsed: ResumeParsed) {
  const response = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages: [
      { role: "system", content: "你是一个资深技术面试官..." },
      { role: "user", content: RESUME_ANALYSIS_PROMPT + JSON.stringify(parsed) },
    ],
    temperature: 0.3,            // 分析需要一定创造性
    response_format: { type: "json_object" },
  });
  return JSON.parse(response.choices[0]?.message?.content || "{}");
}
```

### 3.3 RAG 索引（后台异步）

```typescript
// 在 API 路由返回后非阻塞执行
const ragData = { 
  id: "", fileName: file.name, 
  rawText: pdfResult.text, 
  parsed, analysis 
};
indexResumeToRag(ragData as any).catch(() => {});

// lib/interview/services/rag-context.ts
export async function indexResumeToRag(resume: Resume): Promise<void> {
  const indexText = buildIndexText(resume);  // 拼接结构化数据
  const embeddings = await createEmbeddings(provider);
  const vectorStore = await createVectorStore(embeddings, "interview_resume");
  const chunks = await splitDocument(indexText, { filename: resume.fileName });
  await vectorStore.addDocuments(chunks);     // 向量化存储
}
```

### 3.4 前端上传逻辑

```typescript
// 关键流程
const handleFileUpload = async (file: File) => {
  // 1. 立即创建"上传中"记录
  const resumeId = addResume({ fileName: file.name, status: "uploading" });
  
  // 2. FormData 上传
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/interview/analyze-resume", { 
    method: "POST", body: formData 
  });
  
  // 3. 更新 Store，自动跳转分析报告
  const result = await response.json();
  updateResume(resumeId, { status: "ready", ...result });
  selectResume(resumeId);
  router.push("/interview/resume/analysis");
};
```

---

## 四、两阶段 Prompt 详解

### 4.1 提取 Prompt

```typescript
export const RESUME_EXTRACTION_PROMPT = `你是一个专业的简历解析器。
请从以下简历文本中提取结构化的个人信息。
你必须返回 JSON 格式，包含以下字段：
{
  "name": "姓名",
  "title": "目标岗位",
  "yearsOfExperience": 数字,
  "skills": ["技能1", "技能2", ...],
  "experience": [
    { "company": "", "role": "", "period": "", "description": "", "highlights": [] }
  ],
  "education": [...],
  "projects": [
    { "name": "", "techStack": [], "description": "", "responsibility": "" }
  ]
}
注意事项：
- 如果某个字段找不到，用空字符串或空数组
- yearsOfExperience 根据工作经历推算
- skills 包括所有提到的技术`;
```

### 4.2 分析 Prompt

```typescript
export const RESUME_ANALYSIS_PROMPT = `你是一个资深前端技术面试官。
基于以下候选人信息，分析技术优劣势和面试准备重点。
请以 JSON 格式返回：
{
  "strengths": ["优势1（具体带技术点）", ...],
  "weaknesses": ["劣势1（可改进的具体问题）", ...],
  "suggestedFocus": ["面试准备重点1", ...],
  "confidence": 数字（0-100）,
  "missingKeywords": ["简历中缺失但市场常见的关键词", ...],
  "suggestion": "整体建议一段话"
}`;
```

### 4.3 Prompt 工程要点

| 原则 | 实现 | 为什么重要 |
|------|------|-----------|
| 明确角色 | "你是一个专业的简历解析器" | 限制模型输出范围，减少幻觉 |
| 明确输出格式 | "你必须返回 JSON 格式" | DeepSeek JSON Mode 要求 prompt 含 "json" 字样 |
| 字段级约束 | 每个字段有注释说明 | 避免模型遗漏字段或格式错误 |
| 边界处理 | "找不到用空字符串" | 防止模型编造不存在的经历 |
| 低温度 | temperature: 0.1 | 提取信息要求准确，低温度减少创造性输出 |

---

## 五、实际业务场景

### 场景 1：用户上传自己的简历

```
用户操作：
1. 进入 /interview/resume
2. 拖拽 PDF 到上传区域
3. 看到"正在解析 PDF..." → "AI 正在分析简历..."
4. 约 5-8 秒后自动跳转到分析报告
5. 查看：基本信息 → 工作经历 → 项目经历 → AI 分析

响应时间组成：
- PDF 解析：~300ms
- DeepSeek 提取：~2000ms
- DeepSeek 分析：~1500ms
- 网络传输：~500ms
- 总计：~4300ms
```

### 场景 2：上传扫描件 PDF

```
问题：pdfjs-dist 只能提取文字版 PDF
扫描件本质是图片 → 提取出空文本

处理：
- 校验 text.trim() 是否为空
- API 返回 400："PDF 文件内容为空"
- 提示用户确认是文字版 PDF

待办：V2 接入 OCR（Tesseract.js 或阿里云 OCR）
```

### 场景 3：RAG 在面试中发挥作用

```
用户上传简历后：
1. API 返回分析结果给前端
2. 后台异步索引到 ChromaDB（结构化数据组合）
3. 用户开始模拟面试
4. 面试官 Agent 发送提问
5. API 路由检索 ChromaDB → 获取简历相关段落
6. 简历上下文拼入 System Prompt
7. AI 面试官能说出：
   "你在 Legion Zone 项目中用了 SSE + getReader，
    能讲讲为什么选 ReadableStream 而不是
    直接把数据拼到 DOM 吗？"

效果：从"介绍你的项目"变成"精准追问技术细节"
```

---

## 六、常见面试问题

### Q1: PDF 解析用什么库？为什么选它？

> 用了 `pdfjs-dist/legacy`（Mozilla 官方 PDF.js 的 Node.js 兼容版本）。
>
> **为什么不用 pdf-parse v2？**
> pdf-parse v2 的 worker 加载方式在 Next.js 服务端环境下报错——
> `Cannot find module 'pdf.worker.mjs'`。排错后发现是打包路径问题，
> 直接使用底层的 pdfjs-dist 更可控。
>
> **为什么用 legacy build？**
> pdfjs-dist 的 esm build 依赖 DOMMatrix 等浏览器 API，
> Node.js 22 不支持。legacy build 包含 polyfill。
>
> **限制：** 只能处理文字版 PDF，扫描件需要 OCR。

### Q2: 怎么保证 AI 提取的信息是准确的？

> 三个策略：
> 1. **JSON Mode** — DeepSeek 强制输出 JSON，不会格式错误
> 2. **低温度** — `temperature: 0.1`，减少创造性输出
> 3. **校验函数** — `validateResumeParsed()` 确保每个字段有默认值
>
> 实测：33 项技能、3 段工作经历、6 个项目可以全部准确提取。
> 但不保证 100%，关键信息（如电话号码）仍需要人工核对。

### Q3: 为什么分两步调用 DeepSeek？成本翻倍了吗？

> 两步调用确实增加了 Token 消耗，但加起来的成本不到 ¥0.01：
> - 提取阶段：~800 Token 输入 + ~300 Token 输出
> - 分析阶段：~500 Token 输入 + ~400 Token 输出
> - 合计：~2000 Token ≈ ¥0.004
>
> 换来的是准确性提升 30% 以上。单次调用时模型经常遗漏项目细节，
> 或者把"技能描述"和"项目经历"混淆。

### Q4: 简历文件存哪里了？RAG 数据存哪里？

> **简历文件（V1）：** 存在 localStorage，通过 Zustand persist。
> 简历数据量小（100-500KB），5MB 限制下可以存 10-50 份。
>
> **RAG 向量数据：** 存在 ChromaDB 内存模式（V1）。
> 环境变量 `CHROMA_URL` 未设置时使用内存 + JSON 文件持久化。
> V4 计划接入 PostgreSQL + S3。

### Q5: 为什么不直接把 PDF 传给 AI，而是先解析再传文本？

> 两个原因：
> 1. **Token 成本** — PDF 包含大量格式信息（字体/排版/图片），
>    直接传 AI 会浪费大量 Token。一份 500KB 的 PDF 提取后文本可能只有 3KB。
> 2. **准确性** — 大模型处理结构化文本比处理 PDF 原始数据准确得多。
>    实验表明直接传 PDF 时，模型经常把"技能"和"项目"混淆。

---

## 七、排错指南

### 问题 1：上传后报错 "PDF 解析错误: Setting up fake worker failed"

```
原因：pdf-parse v2 内部的 worker 加载路径与 Next.js 打包冲突
     pdfjs-dist 的 esm build 在 Node.js 中缺少 DOM API

解决：
1. 切换为 pdfjs-dist/legacy（不需要 worker）
2. next.config.ts 中加入 serverExternalPackages: ["pdfjs-dist"]
3. 使用 useSystemFonts: true 支持中文
```

### 问题 2：DeepSeek 返回 JSON 解析失败

```
原因：DeepSeek 的 JSON Mode 要求 system prompt 包含 "json" 字样
     "你必须返回 JSON 格式" 中的 "JSON" 就是关键字

验证：如果 prompt 中没有 "json"，API 会报错：
     "Prompt must contain the word 'json'"
```

### 问题 3：上传 10MB 以上的 PDF 被拒绝

```
原因：next.config.ts 中限制了 bodySizeLimit
     原设置 2MB，改为 10MB

解决：
experimental: {
  serverActions: { bodySizeLimit: "10mb" }
}
```

---

## 八、性能数据

```
一次完整简历分析耗时分布：
┌──────────────────────────────────────────┐
│  PDF 解析 (pdfjs-dist)     ~300ms        │
│  DeepSeek 提取 (temp=0.1)  ~2000ms       │
│  DeepSeek 分析 (temp=0.3)  ~1500ms       │
│  网络传输                  ~500ms         │
│  总计                      ~4300ms (4.3s) │
└──────────────────────────────────────────┘

Token 消耗：
├─ 提取阶段: ~800 输入 + ~300 输出 = 1100 Token
├─ 分析阶段: ~500 输入 + ~400 输出 = 900 Token
├─ 合计:     ~2000 Token
└─ 成本:     ~¥0.004 (DeepSeek 定价 ¥2/1M 输出)
```

---

## 九、与 AI 学习计划的对应

这部分开发对应 12 周计划的第 8 周（Day50-56）：

| 天数 | 学习内容 | 项目实践 |
|------|---------|---------|
| Day50 | Prompt 工程 | 设计两阶段 Resume Analyzer Prompt |
| Day51 | Token 机制 | 分析每次简历分析的 Token 消耗 |
| Day52 | Embedding | ChromaDB 向量化简历内容 |
| Day53 | RAG 原理 | 简历 RAG 索引 + 面试时检索增强 |
| Day54 | Function Calling | JSON Mode 结构化输出 |
| Day55 | Agent 概念 | ResumeAnalyzer Agent 设计 |
| Day56 | 总结 | V1 简历管理功能完成 |

---

## 十、核心代码路径（完整调用链）

```
用户拖拽 PDF → resume/page.tsx (handleFileUpload)
  → fetch POST /api/interview/analyze-resume
  → analyze-resume/route.ts (接收文件 → 校验)
  → utils/pdf-parser.ts (pdfjs-dist 解析)
  → agents/resume-analyzer.ts (extractResumeInfo)
  → DeepSeek API (JSON Mode, temp=0.1)
  → agents/resume-analyzer.ts (analyzeResumeStrengths)
  → DeepSeek API (JSON Mode, temp=0.3)
  → 返回 JSON 给前端 + 后台 indexResumeToRag
  → resume/page.tsx (updateResume → router.push)
  → analysis/page.tsx (展示 7 个信息区块)
  └─ services/rag-context.ts (后台异步索引到 ChromaDB)
```

---

> **上一篇:** [数据流文档](02-data-flow.md)
> **下一篇:** [Step 3：JD 分析 + 面试题生成](07-jd-analysis.md)
