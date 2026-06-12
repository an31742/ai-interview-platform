/**
 * POST /api/rag/query
 *
 * RAG 问答接口：检索 → 增强 → 生成
 *
 * 请求体：
 * {
 *   question: string      // 用户问题
 *   topK?: number         // 检索文档数（默认3）
 * }
 *
 * 响应：SSE 流式
 *   data: {"type":"sources","sources":[...]}   // 引用来源
 *   data: {"type":"chunk","content":"..."}       // 逐块回答
 *   data: {"type":"done"}                        // 完成
 *   data: {"type":"error","error":"..."}         // 错误
 */

import { NextRequest } from "next/server";
import { createEmbeddings } from "@/lib/rag/embeddings";
import { createVectorStore } from "@/lib/rag/vector-store";
import { ragQueryStream } from "@/lib/rag/rag-chain";
import type { EmbeddingModel } from "@/types/rag";

export async function POST(request: NextRequest) {
  try {
    // 1. 解析请求
    const body = await request.json().catch(() => null);
    if (!body?.question) {
      return errorResponse("请输入问题", 400);
    }

    const question = String(body.question).trim();
    const topK = Math.min(Math.max(Number(body.topK) || 3, 1), 10);

    // 2. 初始化向量存储
    const embeddingProvider =
      (process.env.RAG_EMBEDDING_PROVIDER as EmbeddingModel) || "openai";
    const embeddings = await createEmbeddings(embeddingProvider);
    const vectorStore = await createVectorStore(embeddings, "rag_knowledge");

    // 3. 构建 SSE 流
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        await ragQueryStream(
          vectorStore,
          question,
          // onChunk
          (chunk) => {
            const data = JSON.stringify({ type: "chunk", content: chunk });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          },
          // onSources
          (sources) => {
            const data = JSON.stringify({ type: "sources", sources });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          },
          // onError
          (error) => {
            const data = JSON.stringify({ type: "error", error });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            controller.close();
          },
          // onDone
          () => {
            controller.enqueue(encoder.encode(`data: {"type":"done"}\n\n`));
            controller.close();
          },
          topK
        );
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "服务器内部错误",
      500
    );
  }
}

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
