import { z } from "zod";
import { queryFeishuRecords } from "@/lib/business/feishu";
import { queryOrders } from "@/lib/business/orders";
import { queryTeachers } from "@/lib/business/teachers";
import { getCurrentTimeInfo } from "@/lib/business/time";

export const agentTools = {
  getCurrentTime: {
    description: "获取当前服务器时间，用于回答日期、时间、时区相关问题。",
    inputSchema: z.object({
      timezone: z.string().optional().describe("IANA 时区，例如 Asia/Shanghai"),
    }),
    execute: async ({ timezone }: { timezone?: string }) => {
      return getCurrentTimeInfo(timezone || "Asia/Shanghai");
    },
  },

  queryOrders: {
    description:
      "查询订单、课时余额、续费风险和服务状态。可按学生姓名、城市、订单状态、老师、风险等级筛选。",
    inputSchema: z.object({
      studentName: z.string().optional().describe("学生姓名，支持模糊匹配"),
      city: z.string().optional().describe("城市，例如北京、上海"),
      status: z.string().optional().describe("订单状态，例如正常使用、待续费、暂停、已完结"),
      teacher: z.string().optional().describe("负责老师姓名，支持模糊匹配"),
      riskLevel: z.string().optional().describe("风险等级：low、medium、high"),
      limit: z.number().int().positive().max(50).optional().describe("返回数量上限"),
    }),
    execute: queryOrders,
  },

  queryTeacherProfiles: {
    description:
      "查询老师资料、能力标签、资料完整度和审核风险。适合做老师资料审核、老师匹配和服务能力摘要。",
    inputSchema: z.object({
      name: z.string().optional().describe("老师姓名，支持模糊匹配"),
      city: z.string().optional().describe("城市，例如北京、上海"),
      specialty: z.string().optional().describe("能力标签，例如专注力、情绪管理、社交能力"),
      status: z.string().optional().describe("老师状态，例如可排课、资料待完善、暂停服务"),
      riskLevel: z.string().optional().describe("风险等级：low、medium、high"),
      limit: z.number().int().positive().max(50).optional().describe("返回数量上限"),
    }),
    execute: queryTeachers,
  },

  queryFeishuRecords: {
    description:
      "查询飞书多维表/业务表记录。当前提供可替换的飞书数据源骨架，适合查服务确认单、老师审核、订单跟进等记录。",
    inputSchema: z.object({
      keyword: z.string().optional().describe("关键词，匹配标题或字段内容"),
      table: z.string().optional().describe("表名，例如家长服务确认单、老师资料审核、订单跟进表"),
      status: z.string().optional().describe("状态，例如待家长确认、待补充材料、待跟进"),
      owner: z.string().optional().describe("负责人或老师姓名，支持模糊匹配"),
      limit: z.number().int().positive().max(50).optional().describe("返回数量上限"),
    }),
    execute: queryFeishuRecords,
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
          "选择合适的业务工具：时间 / 订单 / 老师资料 / 飞书记录",
          "调用查询类 Tool 收集上下文",
          "生成草稿、摘要或检查清单",
          riskLevel === "low" ? "直接返回结果" : "等待人工确认后再执行写入动作",
        ],
      };
    },
  },
};
