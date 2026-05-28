import { generateText } from "ai";
import { getChatModel } from "@/lib/ai/model";
import {
  MediaAnalysisSummarySchema,
  ServiceCaseRewriteSchema,
  StructuredRequestSchema,
  StructuredResponseSchema,
  TeacherProfileAuditSchema,
  TASK_TYPE_METADATA,
} from "@/lib/ai/structured";
import {
  startRun,
  endRun,
  logError,
} from "@/lib/observability/log-run";

export const runtime = "nodejs";
export const maxDuration = 60;

const TASK_PROMPTS = {
  "teacher-profile-audit": `你是一个专业的教育行业档案审计专家。请根据以下输入审计教师档案信息。

输入信息：
{input}

请以 JSON 格式输出审计结果，包含以下结构：
- basicInfo: 基本信息（姓名、工号、科目、年级、教龄）
- qualificationCheck: 资质检查（学历认证、证书、教学资质）
- riskFactors: 风险因素（分类、严重程度、描述、建议）
- overallScore: 综合评分（0-100）
- auditDate: 审计日期
- auditor: 审计人

风险因素分类：education（学历）、certification（证书）、compliance（合规）、performance（绩效）、document（文档）
严重程度：critical、high、medium、low

请确保返回有效的 JSON 格式，不要包含额外的 markdown 代码块。`,

  "service-case-rewrite": `你是一个专业的教育服务文案专家。请根据以下输入改写服务案例。

原始案例内容：
{input}

请以 JSON 格式输出改写结果，包含以下结构：
- originalCase: 原始案例信息
- improvements: 改进评分和建议（清晰度、专业性、家长友好度）
- rewrittenCase: 改写后的案例（摘要、完整文本、要点、跟进事项）
- metadata: 元数据（案例类型、目标受众、语气）

案例类型：progress、behavior、achievement、concern、routine
目标受众：parent、supervisor、teacher、internal
语气：formal、friendly、professional、empathetic

请确保返回有效的 JSON 格式，不要包含额外的 markdown 代码块。`,

  "media-analysis-summary": `你是一个专业的多媒体内容分析专家。请根据以下输入分析图像或文档内容。

输入内容：
{input}

请以 JSON 格式输出分析结果，包含以下结构：
- fileInfo: 文件信息
- contentSummary: 内容摘要（概述、关键发现、重要细节）
- structuredData: 结构化数据（键值对）
- classification: 分类（类别、可信度、标签）
- qualityAssessment: 质量评估
- recommendedActions: 建议操作

请确保返回有效的 JSON 格式，不要包含额外的 markdown 代码块。`,
};

function generateMarkdownReport(
  taskType: string,
  result: Record<string, unknown>
): string {
  const metadata = TASK_TYPE_METADATA[taskType as keyof typeof TASK_TYPE_METADATA];

  switch (taskType) {
    case "teacher-profile-audit":
      return generateTeacherAuditMarkdown(result as Parameters<typeof generateTeacherAuditMarkdown>[0]);
    case "service-case-rewrite":
      return generateServiceCaseMarkdown(result as Parameters<typeof generateServiceCaseMarkdown>[0]);
    case "media-analysis-summary":
      return generateMediaAnalysisMarkdown(result as Parameters<typeof generateMediaAnalysisMarkdown>[0]);
    default:
      return `## 分析结果\n\n任务类型：${metadata?.name || taskType}\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
  }
}

function generateTeacherAuditMarkdown(data: {
  basicInfo: Record<string, unknown>;
  qualificationCheck: Record<string, unknown>;
  riskFactors: Array<Record<string, unknown>>;
  overallScore: number;
  auditDate: string;
}) {
  const scoreColor =
    data.overallScore >= 80
      ? "🟢"
      : data.overallScore >= 60
        ? "🟡"
        : "🔴";

  return `## 教师档案审计报告

### 基本信息
| 项目 | 内容 |
|------|------|
| 姓名 | ${data.basicInfo.name} |
| 工号 | ${data.basicInfo.employeeId} |
| 科目 | ${data.basicInfo.subject} |
| 年级 | ${data.basicInfo.gradeLevel} |
| 教龄 | ${data.basicInfo.yearsOfExperience} 年 |

### 资质检查

#### 学历认证
- **学位**: ${(data.qualificationCheck.education as Record<string, unknown>)?.degree}
- **专业**: ${(data.qualificationCheck.education as Record<string, unknown>)?.major}
- **院校**: ${(data.qualificationCheck.education as Record<string, unknown>)?.university}
- **认证状态**: ${(data.qualificationCheck.education as Record<string, unknown>)?.verified ? "✅ 已认证" : "⚠️ 未认证"}

#### 证书列表
${((data.qualificationCheck.certifications as Array<Record<string, unknown>>) || []).map((cert) =>
  `- **${cert.name}**: ${cert.status}`
).join("\n")}

### 综合评分 ${scoreColor}

**总分: ${data.overallScore}/100**

### 风险因素

${data.riskFactors.length > 0
    ? data.riskFactors.map((risk) => {
        const severityIcon =
          risk.severity === "critical"
            ? "🔴"
            : risk.severity === "high"
              ? "🟠"
              : risk.severity === "medium"
                ? "🟡"
                : "🟢";
        return `#### ${severityIcon} [${risk.severity}] ${risk.category}

${risk.description}

**建议**: ${risk.recommendation}`;
      }).join("\n\n")
    : "✅ 未发现明显风险因素"
}

---
*审计日期: ${data.auditDate}*`;
}

function generateServiceCaseMarkdown(data: {
  originalCase: Record<string, unknown>;
  improvements: Record<string, unknown>;
  rewrittenCase: Record<string, unknown>;
  metadata: Record<string, unknown>;
}) {
  return `## 服务案例改写报告

### 原始案例
- **学生姓名**: ${data.originalCase.studentName}
- **科目**: ${data.originalCase.subject}
- **原始内容**: ${data.originalCase.originalContent}

### 改进评分

| 维度 | 评分 | 建议 |
|------|------|------|
| 清晰度 | ${(data.improvements.clarity as Record<string, unknown>)?.score}/10 | ${((data.improvements.clarity as Record<string, unknown>)?.suggestions as string[])?.join(", ") || "无"} |
| 专业性 | ${(data.improvements.professionalism as Record<string, unknown>)?.score}/10 | ${((data.improvements.professionalism as Record<string, unknown>)?.suggestions as string[])?.join(", ") || "无"} |
| 家长友好度 | ${(data.improvements.parentFriendly as Record<string, unknown>)?.score}/10 | ${((data.improvements.parentFriendly as Record<string, unknown>)?.suggestions as string[])?.join(", ") || "无"} |

### 改写后的案例

#### 摘要
${data.rewrittenCase.summary}

#### 完整文本
${data.rewrittenCase.fullText}

#### 关键要点
${((data.rewrittenCase.keyPoints as string[]) || []).map((p) => `- ${p}`).join("\n")}

#### 跟进事项
${((data.rewrittenCase.followUpActions as string[]) || []).map((a) => `- ${a}`).join("\n")}

### 元数据
- **案例类型**: ${data.metadata.caseType}
- **目标受众**: ${data.metadata.targetAudience}
- **语气风格**: ${data.metadata.tone}`;
}

function generateMediaAnalysisMarkdown(data: {
  fileInfo: Record<string, unknown>;
  contentSummary: Record<string, unknown>;
  classification: Record<string, unknown>;
  qualityAssessment: Record<string, unknown>;
  recommendedActions: Array<Record<string, unknown>>;
}) {
  return `## 媒体内容分析报告

### 文件信息
| 项目 | 内容 |
|------|------|
| 文件名 | ${data.fileInfo.filename} |
| 文件类型 | ${data.fileInfo.fileType} |
| 文件大小 | ${data.fileInfo.fileSize} |
| 分析日期 | ${data.fileInfo.analysisDate} |

### 内容摘要

#### 概述
${data.contentSummary.overview}

#### 关键发现
${((data.contentSummary.keyFindings as string[]) || []).map((f) => `- ${f}`).join("\n")}

#### 重要细节
${((data.contentSummary.importantDetails as string[]) || []).map((d) => `- ${d}`).join("\n")}

### 分类
- **类别**: ${data.classification.category}
- **可信度**: ${((data.classification.confidence as number) * 100).toFixed(1)}%
- **标签**: ${((data.classification.tags as string[]) || []).join(", ")}

### 质量评估
- **清晰度**: ${data.qualityAssessment.clarity}
- **完整度**: ${data.qualityAssessment.completeness}
${((data.qualityAssessment.issues as string[] | undefined) || []).length ? `### 问题列表\n${((data.qualityAssessment.issues as string[]) || []).map((i) => `- ${i}`).join("\n")}` : ""}

### 建议操作

${data.recommendedActions.map((action) => {
  const priorityIcon =
    action.priority === "urgent"
      ? "🚨"
      : action.priority === "high"
        ? "🔴"
        : action.priority === "medium"
          ? "🟡"
          : "🟢";
  return `#### ${priorityIcon} [${action.priority}] ${action.action}

${action.reason}`;
}).join("\n\n")}`;
}

export async function POST(req: Request) {
  let runId: number | null = null;

  try {
    const body = await req.json();
    const parsed = StructuredRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          error: `Invalid request: ${parsed.error.message}`,
        },
        { status: 400 }
      );
    }

    const { taskType, input } = parsed.data;
    const promptTemplate = TASK_PROMPTS[taskType];
    const schema =
      taskType === "teacher-profile-audit"
        ? TeacherProfileAuditSchema
        : taskType === "service-case-rewrite"
          ? ServiceCaseRewriteSchema
          : MediaAnalysisSummarySchema;

    // 启动日志记录
    runId = startRun("/api/structured/analyze", {
      modelId: taskType,
      metadata: { taskType },
    });

    const result = await generateText({
      model: getChatModel(),
      prompt: promptTemplate.replace("{input}", input),
      temperature: 0.3,
    });

    let parsedResult: Record<string, unknown>;
    try {
      parsedResult = JSON.parse(result.text);
      schema.parse(parsedResult);
    } catch {
      if (runId) logError(runId, new Error("Failed to parse AI response as valid JSON"));
      return Response.json({
        success: false,
        error: "Failed to parse AI response as valid JSON",
        rawResponse: result.text,
      }, { status: 500 });
    }

    const markdown = generateMarkdownReport(taskType, parsedResult);

    const usage = result.usage;
    const tokens = usage ? {
      prompt: (usage as unknown as Record<string, number | undefined>).promptTokens ?? (usage as unknown as Record<string, number | undefined>).inputTokens,
      completion: (usage as unknown as Record<string, number | undefined>).completionTokens ?? (usage as unknown as Record<string, number | undefined>).outputTokens,
      total: usage.totalTokens,
    } : undefined;

    // 结束日志
    if (runId) {
      endRun(runId, {
        status: "success",
        usage: tokens ? {
          promptTokens: tokens.prompt ?? 0,
          completionTokens: tokens.completion ?? 0,
          totalTokens: tokens.total ?? 0,
        } : undefined,
      });
    }

    const response = StructuredResponseSchema.parse({
      success: true,
      taskType,
      result: parsedResult,
      markdown,
      tokens,
    });

    return Response.json(response);
  } catch (error) {
    if (runId) {
      logError(runId, error);
    }

    const message =
      error instanceof Error ? error.message : "Structured analysis failed unexpectedly.";

    return Response.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
