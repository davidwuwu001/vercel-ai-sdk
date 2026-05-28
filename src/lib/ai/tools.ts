import { z } from "zod";

const mockOrders = [
  {
    id: "TZ-202605-1001",
    studentName: "张三",
    city: "北京",
    teacher: "王老师",
    status: "正常使用",
    balanceHours: 18,
    lastServiceAt: "2026-05-20",
  },
  {
    id: "TZ-202605-1002",
    studentName: "李想",
    city: "上海",
    teacher: "陈老师",
    status: "待续费",
    balanceHours: 2,
    lastServiceAt: "2026-05-18",
  },
  {
    id: "TZ-202605-1003",
    studentName: "小雨",
    city: "北京",
    teacher: "刘老师",
    status: "正常使用",
    balanceHours: 36,
    lastServiceAt: "2026-05-21",
  },
];

export const agentTools = {
  getCurrentTime: {
    description: "获取当前服务器时间，用于回答日期、时间、时区相关问题。",
    inputSchema: z.object({
      timezone: z.string().optional().describe("IANA 时区，例如 Asia/Shanghai"),
    }),
    execute: async ({ timezone }: { timezone?: string }) => {
      const timeZone = timezone || "Asia/Shanghai";
      return {
        timezone: timeZone,
        iso: new Date().toISOString(),
        local: new Intl.DateTimeFormat("zh-CN", {
          dateStyle: "full",
          timeStyle: "medium",
          timeZone,
        }).format(new Date()),
      };
    },
  },
  queryOrders: {
    description: "按学生姓名、城市或订单状态查询演示订单数据。",
    inputSchema: z.object({
      studentName: z.string().optional().describe("学生姓名，支持模糊匹配"),
      city: z.string().optional().describe("城市，例如北京、上海"),
      status: z.string().optional().describe("订单状态，例如正常使用、待续费"),
    }),
    execute: async ({
      studentName,
      city,
      status,
    }: {
      studentName?: string;
      city?: string;
      status?: string;
    }) => {
      const orders = mockOrders.filter((order) => {
        const matchStudent = studentName
          ? order.studentName.includes(studentName)
          : true;
        const matchCity = city ? order.city === city : true;
        const matchStatus = status ? order.status === status : true;
        return matchStudent && matchCity && matchStatus;
      });

      return {
        source: "mock",
        count: orders.length,
        orders,
      };
    },
  },
  searchKnowledgeBase: {
    description: "检索知识库中的相关文档片段，用于回答基于上传文档的问题。",
    inputSchema: z.object({
      query: z.string().describe("要检索的问题或关键词"),
      enableRerank: z.boolean().optional().describe("是否启用 Rerank 重排序，默认开启"),
    }),
    execute: async ({ 
      query, 
    }: { 
      query: string; 
      enableRerank?: boolean;
    }) => {
      // 返回 mock 数据，实际检索功能在 /lab/knowledge 页面
      return {
        source: "knowledge_base",
        query,
        results: [],
        message: "知识库功能正在开发中，请先在知识库页面上传文档。",
      };
    },
  },
  createAgentTaskPlan: {
    description: "把用户目标拆成 Agent 任务计划，展示 Skill 与 Tool 的协作方式。",
    inputSchema: z.object({
      goal: z.string().describe("用户希望 Agent 完成的目标"),
      riskLevel: z
        .enum(["low", "medium", "high"])
        .describe("任务风险等级，高风险动作需要人工确认"),
    }),
    execute: async ({
      goal,
      riskLevel,
    }: {
      goal: string;
      riskLevel: "low" | "medium" | "high";
    }) => {
      return {
        goal,
        riskLevel,
        requiresHumanApproval: riskLevel !== "low",
        steps: [
          "识别目标和业务对象",
          "选择合适的 Skill",
          "调用查询类 Tool 收集上下文",
          "生成草稿或分析结果",
          riskLevel === "low" ? "直接返回结果" : "等待人工确认后再执行写入动作",
        ],
      };
    },
  },
};
