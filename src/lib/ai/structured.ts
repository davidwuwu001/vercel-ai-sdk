import { z } from "zod";

// 教师档案审计 Schema
export const TeacherProfileAuditSchema = z.object({
  basicInfo: z.object({
    name: z.string(),
    employeeId: z.string(),
    subject: z.string(),
    gradeLevel: z.string(),
    yearsOfExperience: z.number(),
  }),
  qualificationCheck: z.object({
    education: z.object({
      degree: z.string(),
      major: z.string(),
      university: z.string(),
      verified: z.boolean(),
    }),
    certifications: z.array(
      z.object({
        name: z.string(),
        issueDate: z.string(),
        expiryDate: z.string().optional(),
        status: z.enum(["valid", "expiring", "expired", "pending"]),
      })
    ),
    teachingQualification: z.boolean(),
  }),
  riskFactors: z.array(
    z.object({
      category: z.enum(["education", "certification", "compliance", "performance", "document"]),
      severity: z.enum(["critical", "high", "medium", "low"]),
      description: z.string(),
      recommendation: z.string(),
    })
  ),
  overallScore: z.number().min(0).max(100),
  auditDate: z.string(),
  auditor: z.string().optional(),
});

export type TeacherProfileAudit = z.infer<typeof TeacherProfileAuditSchema>;

// 服务案例改写 Schema
export const ServiceCaseRewriteSchema = z.object({
  originalCase: z.object({
    studentName: z.string(),
    subject: z.string(),
    originalContent: z.string(),
  }),
  improvements: z.object({
    clarity: z.object({
      score: z.number().min(0).max(10),
      suggestions: z.array(z.string()),
    }),
    professionalism: z.object({
      score: z.number().min(0).max(10),
      suggestions: z.array(z.string()),
    }),
    parentFriendly: z.object({
      score: z.number().min(0).max(10),
      suggestions: z.array(z.string()),
    }),
  }),
  rewrittenCase: z.object({
    summary: z.string(),
    fullText: z.string(),
    keyPoints: z.array(z.string()),
    followUpActions: z.array(z.string()),
  }),
  metadata: z.object({
    caseType: z.enum(["progress", "behavior", "achievement", "concern", "routine"]),
    targetAudience: z.enum(["parent", "supervisor", "teacher", "internal"]),
    tone: z.enum(["formal", "friendly", "professional", "empathetic"]),
  }),
});

export type ServiceCaseRewrite = z.infer<typeof ServiceCaseRewriteSchema>;

// 图像/文档分析摘要 Schema
export const MediaAnalysisSummarySchema = z.object({
  fileInfo: z.object({
    filename: z.string(),
    fileType: z.string(),
    fileSize: z.string(),
    analysisDate: z.string(),
  }),
  contentSummary: z.object({
    overview: z.string(),
    keyFindings: z.array(z.string()),
    importantDetails: z.array(z.string()),
  }),
  structuredData: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional()),
  classification: z.object({
    category: z.string(),
    confidence: z.number().min(0).max(1),
    tags: z.array(z.string()),
  }),
  qualityAssessment: z.object({
    clarity: z.enum(["high", "medium", "low"]),
    completeness: z.enum(["complete", "partial", "incomplete"]),
    issues: z.array(z.string()).optional(),
  }),
  recommendedActions: z.array(
    z.object({
      action: z.string(),
      priority: z.enum(["urgent", "high", "medium", "low"]),
      reason: z.string(),
    })
  ),
});

export type MediaAnalysisSummary = z.infer<typeof MediaAnalysisSummarySchema>;

// 统一的任务类型
export const StructuredTaskType = z.enum([
  "teacher-profile-audit",
  "service-case-rewrite",
  "media-analysis-summary",
]);

export type StructuredTaskType = z.infer<typeof StructuredTaskType>;

// 通用请求 Schema
export const StructuredRequestSchema = z.object({
  taskType: StructuredTaskType,
  input: z.string(),
  additionalContext: z.record(z.string(), z.string()).optional(),
});

export type StructuredRequest = z.infer<typeof StructuredRequestSchema>;

// 统一响应 Schema
export const StructuredResponseSchema = z.object({
  success: z.boolean(),
  taskType: StructuredTaskType,
  result: z.union([
    TeacherProfileAuditSchema,
    ServiceCaseRewriteSchema,
    MediaAnalysisSummarySchema,
  ]),
  markdown: z.string(),
  tokens: z
    .object({
      prompt: z.number().optional(),
      completion: z.number().optional(),
      total: z.number().optional(),
    })
    .optional(),
  warnings: z.array(z.string()).optional(),
  error: z.string().optional(),
});

export type StructuredResponse = z.infer<typeof StructuredResponseSchema>;

// 任务类型到 Schema 的映射
export const TASK_TYPE_SCHEMAS = {
  "teacher-profile-audit": TeacherProfileAuditSchema,
  "service-case-rewrite": ServiceCaseRewriteSchema,
  "media-analysis-summary": MediaAnalysisSummarySchema,
} as const;

// 任务类型元数据
export const TASK_TYPE_METADATA = {
  "teacher-profile-audit": {
    name: "教师档案审计",
    description: "审计教师档案的资质、证书和合规性",
    icon: "ScrollText",
    color: "cyan",
  },
  "service-case-rewrite": {
    name: "服务案例改写",
    description: "改写和优化服务案例，提升清晰度和专业性",
    icon: "FileEdit",
    color: "hot",
  },
  "media-analysis-summary": {
    name: "图像/文档分析摘要",
    description: "分析图像或文档并生成结构化摘要",
    icon: "Image",
    color: "emerald",
  },
} as const;
