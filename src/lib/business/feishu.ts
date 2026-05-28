export type FeishuQueryInput = {
  keyword?: string;
  table?: string;
  status?: string;
  owner?: string;
  limit?: number;
};

export type FeishuRecord = {
  id: string;
  table: string;
  title: string;
  status: string;
  owner: string;
  updatedAt: string;
  fields: Record<string, string | number | boolean>;
};

const demoRecords: FeishuRecord[] = [
  {
    id: "fs-001",
    table: "家长服务确认单",
    title: "张三 5月第4周服务确认",
    status: "待家长确认",
    owner: "王老师",
    updatedAt: "2026-05-27",
    fields: {
      city: "北京",
      studentName: "张三",
      serviceHours: 2,
    },
  },
  {
    id: "fs-002",
    table: "老师资料审核",
    title: "陈老师资料补全",
    status: "待补充材料",
    owner: "运营组",
    updatedAt: "2026-05-26",
    fields: {
      missing: "无犯罪记录证明、最新服务案例",
      priority: "medium",
    },
  },
  {
    id: "fs-003",
    table: "订单跟进表",
    title: "李想续费提醒",
    status: "待跟进",
    owner: "顾问组",
    updatedAt: "2026-05-28",
    fields: {
      balanceHours: 2,
      riskLevel: "high",
    },
  },
];

export async function queryFeishuRecords(input: FeishuQueryInput) {
  const limit = Math.min(Math.max(input.limit || 10, 1), 50);
  const records = demoRecords
    .filter((record) => fuzzy(record.title, input.keyword) || fuzzy(JSON.stringify(record.fields), input.keyword))
    .filter((record) => exact(record.table, input.table))
    .filter((record) => exact(record.status, input.status))
    .filter((record) => fuzzy(record.owner, input.owner))
    .slice(0, limit);

  return {
    source: process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET ? "feishu_api_placeholder" : "demo_data",
    connected: Boolean(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET),
    count: records.length,
    records,
    nextIntegrationHint:
      process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET
        ? "飞书凭证已配置，可在 src/lib/business/feishu.ts 中接入真实多维表 API。"
        : "当前使用内置演示数据。配置 FEISHU_APP_ID / FEISHU_APP_SECRET 后可接入飞书多维表。",
  };
}

function fuzzy(value: string, keyword?: string) {
  return keyword ? value.includes(keyword) : true;
}

function exact(value: string, keyword?: string) {
  return keyword ? value === keyword : true;
}
