# RAG 知识库问答 — 完整实现文档

## 一、文件结构

```
src/
├── app/
│   ├── rag/
│   │   ├── layout.tsx                   # RAG 页面布局（含导航栏）
│   │   └── page.tsx                     # RAG 主页面（左文档 + 右问答）
│   └── api/rag/
│       ├── upload/route.ts              # PDF 上传 + 文档管理 API
│       └── query/route.ts               # RAG 问答 API (SSE 流式)
│
├── components/rag/
│   ├── document-upload.tsx               # PDF 上传组件（拖拽 + 点击）
│   ├── document-list.tsx                 # 文档列表（状态 + 删除）
│   ├── rag-chat.tsx                      # RAG 问答界面
│   └── source-badge.tsx                  # 来源引用标签
│
├── lib/rag/                               # RAG 核心逻辑（服务端）
│   ├── document-loader.ts                # PDF 解析
│   ├── text-splitter.ts                  # 文档切片（RecursiveCharacterTextSplitter）
│   ├── embeddings.ts                     # Embedding 模型工厂（OpenAI / BGE）
│   ├── vector-store.ts                   # 向量存储（Chroma / 内存模式）
│   └── rag-chain.ts                      # RAG 问答链（检索 → 增强 → 生成）
│
├── store/
│   └── rag-store.ts                      # RAG 状态管理（Zustand）
│
└── types/
    └── rag.ts                            # RAG 类型定义
```

---

## 二、安装的依赖

| 包名 | 用途 |
|------|------|
| `langchain` | LangChain 核心库 |
| `@langchain/core` | LangChain 核心类型和接口 |
| `@langchain/community` | 社区集成（Chroma、HF Embeddings） |
| `@langchain/openai` | OpenAI Embeddings |
| `@langchain/textsplitters` | 文本分割器 |
| `chromadb` | Chroma 向量数据库客户端 |
| `pdf-parse` | PDF 文本提取 |
| `@huggingface/inference` | HuggingFace 推理 API（BGE Embedding 用） |

---

## 三、LangChain 在 RAG 中的角色

```
原始做法（接口不统一）：
  pdf-parse → 自己写分割 → 调OpenAI API嵌入 → 调Chroma API存 → 调DeepSeek

使用 LangChain（统一接口）：
  PDFParse → RecursiveCharacterTextSplitter → OpenAIEmbeddings → Chroma → DeepSeek
```

LangChain 提供的是**标准接口**，而不是具体实现：

| 组件 | LangChain 接口 | 可选实现 |
|------|---------------|---------|
| 文档加载 | `DocumentLoader` | `pdf-parse`（本项目） |
| 文本切片 | `TextSplitter` | `RecursiveCharacterTextSplitter` |
| Embedding | `Embeddings` | `OpenAIEmbeddings` / `HuggingFaceInferenceEmbeddings` |
| 向量存储 | `VectorStore` | `Chroma` / 内存模式（本项目） |
| LLM | `ChatModel` | 直接使用 OpenAI SDK（本项目） |

---

## 四、PDF 上传 → 索引完整流程

```
用户上传 PDF
  → POST /api/rag/upload (FormData)
    → validate (文件类型 .pdf, 大小 < 10MB)
    → 创建 RagDocument { id, filename, status: "processing" }
    → processDocument() 后台异步处理：
      1. pdf-parse 提取纯文本
      2. RecursiveCharacterTextSplitter 切片
         - chunkSize: 500 (中文)
         - chunkOverlap: 100
         - separators: ["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""]
      3. createEmbeddings("openai") → 文本 → 768维向量
      4. createVectorStore() → addDocuments()
         - 有 CHROMA_URL → Chroma 持久化
         - 无 CHROMA_URL → 内存模式 + JSON 文件持久化
      5. 更新状态为 "ready"
    → 返回 { id, filename, status: "processing" }
  → 客户端轮询 GET /api/rag/upload 直到 status === "ready"
```

---

## 五、RAG 问答完整流程

```
用户提问: "注册资本认缴期限有什么变化？"
  → POST /api/rag/query { question }
    → 1. createVectorStore() 获取向量存储
    → 2. vectorStore.similaritySearch(question, topK=3)
         → 用户问题转为向量
         → 计算余弦相似度
         → 返回 Top-K 文档片段 + 相似度分数
    → 3. buildRagPrompt(documents, question)
         → 系统提示词：要求基于文档回答
         → 文档片段：按格式拼接
         → 用户问题
    → 4. DeepSeek Chat (stream: true, temperature: 0.3)
         → SSE 流式返回
         → onChunk → 逐块送达客户端
         → onSources → 返回引用来源
         → onDone → 完成
```

### 组装后的 Prompt 示例

```
系统：
你是一个知识库问答助手。
你的回答必须严格基于以下提供的文档内容。

文档内容如下：
---

[文档 1] (2024公司法.pdf):
第一条 为了规范公司的组织和行为...注册资本认缴期限为五年...

[文档 2] (2024公司法.pdf):
股东应当按期足额缴纳公司章程中规定的各自所认缴的出资额...

---

请基于以上文档内容回答用户的问题。

用户：
注册资本认缴期限有什么变化？
```

---

## 六、向量存储实现

本项目实现了**两种向量存储模式**，通过 `CHROMA_URL` 环境变量切换：

### 内存模式（默认）

```typescript
// lib/rag/vector-store.ts 中的 MemoryStore
// 无需任何外部服务，适合开发和演示

- 存储：JavaScript 数组
- 检索：线性扫描 + 余弦相似度
- 持久化：JSON 文件（.rag-data/docs.json）
- 适用：个人使用、开发调试、演示
```

### Chroma 模式

```typescript
// 当设置 CHROMA_URL 时自动启用
// 需要运行 Chroma 服务器

- 存储：Chroma 向量数据库
- 检索：ANN 索引（近似最近邻）
- 持久化：Chroma 服务器管理
- 适用：生产环境、中等规模
```

---

## 七、Embedding 模型选择

| 特性 | OpenAI | BGE |
|------|--------|-----|
| 模型 | text-embedding-3-small | BAAI/bge-base-zh-v1.5 |
| 维度 | 1536（项目中裁剪到 768） | 768 |
| 费用 | 按量计费 | 免费 |
| 中文效果 | 优秀 | 优秀 |
| 配置方式 | 设置 OPENAI_API_KEY | 安装 @huggingface/inference |

配置方式：`.env.local` 中设置 `RAG_EMBEDDING_PROVIDER=openai` 或 `=bge`

---

## 八、使用说明

```
1. 访问 http://localhost:3000/rag
2. 上传 PDF 文档
   - 支持拖拽或点击上传
   - 等待处理完成（状态变为 ✓）
3. 在右侧输入问题
   - AI 基于文档内容回答
   - 回答底部显示引用来源
   - 悬停来源可预览原文
4. 可上传多个文档
   - 所有文档合并检索
   - 可单独删除
```

---

## 九、常见问题

**Q: 上传后一直显示"处理中"？**
A: 第一需要确保 OPENAI_API_KEY 配置正确。第二 PDF 较大的话解析需要时间。

**Q: 回答没有引用来源？**
A: 可能是检索到的文档相关性不够高。尝试降低 chunkSize 或增加 topK。

**Q: 回答不准确？**
A: 检查文档内容是否正确提取、切片参数是否合理、temperature 是否设得太高。

**Q: 如何切换到 BGE Embedding？**
A: 安装 `@huggingface/inference`，设置 `RAG_EMBEDDING_PROVIDER=bge`。
