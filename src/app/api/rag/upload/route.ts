/**
 * POST /api/rag/upload — 上传 PDF 并建立索引
 * GET  /api/rag/upload — 获取已索引文档列表
 * DELETE /api/rag/upload — 删除指定文档
 *
 * 上传流程：
 * 1. 接收 PDF 文件
 * 2. 解析为纯文本 (pdf-parse)
 * 3. 切片 (RecursiveCharacterTextSplitter)
 * 4. Embedding → 存入向量库 (Chroma / In-memory)
 * 5. 返回文档索引信息
 */

import { NextRequest, NextResponse } from "next/server";
import { parsePdf } from "@/lib/rag/document-loader";
import { splitDocument } from "@/lib/rag/text-splitter";
import { createEmbeddings } from "@/lib/rag/embeddings";
import { createVectorStore } from "@/lib/rag/vector-store";
import type { EmbeddingModel, RagDocument } from "@/types/rag";

// 内存中的文档列表（生产环境应使用数据库）
let documents: RagDocument[] = [];

// ============================================
// POST — 上传 PDF
// ============================================

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "请选择 PDF 文件" }, { status: 400 });
    }

    // 校验文件类型
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "仅支持 PDF 文件格式" },
        { status: 400 }
      );
    }

    // 校验文件大小（10MB 限制）
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "文件大小超过 10MB 限制" },
        { status: 400 }
      );
    }

    // 创建文档记录
    const docId = crypto.randomUUID();
    const doc: RagDocument = {
      id: docId,
      filename: file.name,
      status: "processing",
      chunkCount: 0,
      fileSize: file.size,
      uploadedAt: Date.now(),
    };
    documents.push(doc);

    // 异步处理：解析 → 切片 → Embedding → 存储
    // 不阻塞响应，客户端轮询状态
    processDocument(file, docId).catch((err) => {
      const idx = documents.findIndex((d) => d.id === docId);
      if (idx !== -1) {
        documents[idx].status = "error";
        documents[idx].error = err.message;
      }
    });

    return NextResponse.json({
      id: docId,
      filename: file.name,
      status: "processing",
      message: "文件上传成功，正在处理中...",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "上传失败" },
      { status: 500 }
    );
  }
}

/**
 * 后台处理文档（解析 → 切片 → Embedding → 存储）
 */
async function processDocument(file: File, docId: string) {
  // 1. 读取文件
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 2. 解析 PDF
  const result = await parsePdf(buffer, file.name);

  if (!result.text.trim()) {
    throw new Error("PDF 文件内容为空，请检查文件是否可读");
  }

  // 3. 切片
  const chunks = await splitDocument(result.text, {
    filename: file.name,
    docId,
  });

  // 4. Embedding
  const embeddingProvider =
    (process.env.RAG_EMBEDDING_PROVIDER as EmbeddingModel) || "openai";
  const embeddings = await createEmbeddings(embeddingProvider);

  // 5. 存入向量库
  const vectorStore = await createVectorStore(embeddings, "rag_knowledge");
  await vectorStore.addDocuments(chunks);

  // 6. 更新状态
  const idx = documents.findIndex((d) => d.id === docId);
  if (idx !== -1) {
    documents[idx].status = "ready";
    documents[idx].chunkCount = chunks.length;
  }
}

// ============================================
// GET — 获取文档列表
// ============================================

export async function GET() {
  return NextResponse.json({ documents });
}

// ============================================
// DELETE — 删除文档
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("id");

    if (!docId) {
      return NextResponse.json({ error: "请指定文档 ID" }, { status: 400 });
    }

    // 从向量库中删除
    const doc = documents.find((d) => d.id === docId);
    if (doc) {
      const embeddings = await createEmbeddings(
        (process.env.RAG_EMBEDDING_PROVIDER as EmbeddingModel) || "openai"
      );
      const vectorStore = await createVectorStore(embeddings, "rag_knowledge");
      await vectorStore.deleteDocuments(doc.filename);
    }

    // 从文档列表中移除
    documents = documents.filter((d) => d.id !== docId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "删除失败" },
      { status: 500 }
    );
  }
}
