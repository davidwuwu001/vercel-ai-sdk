/**
 * Knowledge Base RAG API
 * 
 * POST /api/knowledge/rag - RAG 问答
 */

import { NextRequest, NextResponse } from "next/server";
import { retrieveContext, buildRAGPrompt, formatCitationsAsMarkdown } from "@/lib/knowledge/rag";
import { createRequestLogger } from "@/lib/observability";

export const runtime = "nodejs";

/**
 * POST /api/knowledge/rag
 * 基于知识库的 RAG 问答
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger(request);
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { query, topK, maxContextTokens, includeCitations } = body;

    if (!query) {
      return NextResponse.json(
        { error: "query is required" },
        { status: 400 }
      );
    }

    log.info("RAG query started", { query: query.slice(0, 100) });

    // 1. 检索上下文
    const ragContext = await retrieveContext(query, {
      topK: topK || 5,
      maxContextTokens: maxContextTokens || 4000,
      includeCitations: includeCitations !== false,
      enableRerank: true,
    });

    // 2. 如果没有检索到内容，直接返回
    if (ragContext.chunks.length === 0) {
      return NextResponse.json({
        success: true,
        answer: "抱歉，知识库中没有找到与您问题相关的内容。请尝试上传更多文档或调整搜索关键词。",
        citations: [],
        metadata: ragContext.metadata,
      });
    }

    // 3. 构建 RAG prompt
    const { system, user } = buildRAGPrompt(query, ragContext, {
      systemPrefix: "你是一个基于知识库文档的智能助手。请根据提供的上下文信息回答用户的问题。",
      includeCitationNote: includeCitations !== false,
    });

    // 4. 调用 LLM 生成回答
    const modelId = process.env.KNOWLEDGE_MODEL_ID || "qwen-plus";

    const llmResponse = await fetch(`${process.env.VERCEL_GATEWAY_URL || "http://localhost:3000"}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        modelId,
        temperature: 0.3,
        maxTokens: 2000,
      }),
    });

    let answer: string;

    if (llmResponse.ok) {
      const llmData = await llmResponse.json();
      answer = llmData.message?.content || llmData.text || llmData.response || "生成回答时出现问题。";
    } else {
      // 如果 LLM 调用失败，返回基于上下文的简单回答
      answer = `基于知识库内容，以下是相关信息：\n\n${ragContext.contextText.slice(0, 1000)}${ragContext.contextText.length > 1000 ? "..." : ""}`;
    }

    // 5. 添加引用说明
    if (includeCitations !== false && ragContext.citations.length > 0) {
      answer += `\n\n${formatCitationsAsMarkdown(ragContext.citations)}`;
    }

    const latencyMs = Date.now() - startTime;
    log.info("RAG query completed", { 
      chunksFound: ragContext.metadata.totalChunksFound,
      chunksUsed: ragContext.metadata.chunksUsed,
      latencyMs,
    });

    return NextResponse.json({
      success: true,
      answer,
      citations: ragContext.citations,
      metadata: ragContext.metadata,
    });
  } catch (error) {
    console.error("RAG query failed:", error);
    log.error(error);
    return NextResponse.json(
      { error: "RAG query failed", details: String(error) },
      { status: 500 }
    );
  }
}
