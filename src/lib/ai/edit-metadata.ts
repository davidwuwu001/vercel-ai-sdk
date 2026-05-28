/**
 * 工具元数据 - 客户端可用
 * 
 * 包含工具分类和信息的常量定义，不依赖服务端模块
 */

export const toolMetadataSchema = {
  getCurrentTime: {
    name: "获取当前时间",
    description: "获取服务器当前时间",
    category: "system",
    parameters: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description: "IANA 时区，例如 Asia/Shanghai"
        }
      }
    },
  },
  queryOrders: {
    name: "查询订单",
    description: "按学生姓名、城市或订单状态查询订单数据",
    category: "business",
    parameters: {
      type: "object",
      properties: {
        studentName: {
          type: "string",
          description: "学生姓名，支持模糊匹配"
        },
        city: {
          type: "string",
          description: "城市，例如北京、上海"
        },
        status: {
          type: "string",
          description: "订单状态，例如正常使用、待续费"
        }
      }
    },
  },
  searchKnowledgeBase: {
    name: "知识库检索",
    description: "检索知识库中的相关文档片段",
    category: "knowledge",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "要检索的问题或关键词"
        },
        enableRerank: {
          type: "boolean",
          description: "是否启用 Rerank 重排序，默认开启"
        }
      },
      required: ["query"]
    },
  },
  createAgentTaskPlan: {
    name: "创建任务计划",
    description: "把用户目标拆成 Agent 任务计划",
    category: "planning",
    parameters: {
      type: "object",
      properties: {
        goal: {
          type: "string",
          description: "用户希望 Agent 完成的目标"
        },
        riskLevel: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "任务风险等级，高风险动作需要人工确认"
        }
      },
      required: ["goal", "riskLevel"]
    },
  },
} as const;

export type ToolMetadataKey = keyof typeof toolMetadataSchema;
export type ToolMetadataValue = (typeof toolMetadataSchema)[ToolMetadataKey];

/**
 * 获取工具分类
 */
export function getToolCategories(): Record<string, ToolMetadataKey[]> {
  const categories: Record<string, ToolMetadataKey[]> = {};
  
  for (const key of Object.keys(toolMetadataSchema) as ToolMetadataKey[]) {
    const meta = toolMetadataSchema[key];
    const category = meta.category;
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(key);
  }
  
  return categories;
}

/**
 * 获取工具信息
 */
export function getToolInfo(toolName: string): ToolMetadataValue | undefined {
  return toolMetadataSchema[toolName as ToolMetadataKey];
}
