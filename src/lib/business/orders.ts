export type OrderStatus = "正常使用" | "待续费" | "暂停" | "已完结";

export type OrderRecord = {
  id: string;
  studentName: string;
  city: string;
  teacher: string;
  status: OrderStatus;
  balanceHours: number;
  totalHours: number;
  usedHours: number;
  lastServiceAt: string;
  nextServiceAt?: string;
  riskLevel: "low" | "medium" | "high";
  riskReason?: string;
};

export type OrderQueryInput = {
  studentName?: string;
  city?: string;
  status?: string;
  teacher?: string;
  riskLevel?: string;
  limit?: number;
};

const demoOrders: OrderRecord[] = [
  {
    id: "TZ-202605-1001",
    studentName: "张三",
    city: "北京",
    teacher: "王老师",
    status: "正常使用",
    balanceHours: 18,
    totalHours: 60,
    usedHours: 42,
    lastServiceAt: "2026-05-20",
    nextServiceAt: "2026-05-29",
    riskLevel: "low",
  },
  {
    id: "TZ-202605-1002",
    studentName: "李想",
    city: "上海",
    teacher: "陈老师",
    status: "待续费",
    balanceHours: 2,
    totalHours: 36,
    usedHours: 34,
    lastServiceAt: "2026-05-18",
    nextServiceAt: "2026-05-30",
    riskLevel: "high",
    riskReason: "剩余课时不足，且下一次服务已临近。",
  },
  {
    id: "TZ-202605-1003",
    studentName: "小雨",
    city: "北京",
    teacher: "刘老师",
    status: "正常使用",
    balanceHours: 36,
    totalHours: 80,
    usedHours: 44,
    lastServiceAt: "2026-05-21",
    nextServiceAt: "2026-05-28",
    riskLevel: "low",
  },
  {
    id: "TZ-202605-1004",
    studentName: "乐乐",
    city: "北京",
    teacher: "赵老师",
    status: "暂停",
    balanceHours: 12,
    totalHours: 48,
    usedHours: 36,
    lastServiceAt: "2026-04-30",
    riskLevel: "medium",
    riskReason: "超过三周未服务，需要确认暂停原因和复课计划。",
  },
];

export async function queryOrders(input: OrderQueryInput) {
  const limit = Math.min(Math.max(input.limit || 10, 1), 50);
  const records = demoOrders
    .filter((order) => fuzzy(order.studentName, input.studentName))
    .filter((order) => exact(order.city, input.city))
    .filter((order) => exact(order.status, input.status))
    .filter((order) => fuzzy(order.teacher, input.teacher))
    .filter((order) => exact(order.riskLevel, input.riskLevel))
    .slice(0, limit);

  return {
    source: process.env.ORDERS_API_URL ? "external_api_placeholder" : "demo_data",
    connected: Boolean(process.env.ORDERS_API_URL),
    count: records.length,
    records,
    summary: summarizeOrders(records),
    nextIntegrationHint: process.env.ORDERS_API_URL
      ? "ORDERS_API_URL 已配置，可在 src/lib/business/orders.ts 中替换为真实 fetch 调用。"
      : "当前使用内置演示数据。配置 ORDERS_API_URL 后可接入真实订单系统。",
  };
}

function summarizeOrders(records: OrderRecord[]) {
  const highRisk = records.filter((item) => item.riskLevel === "high").length;
  const mediumRisk = records.filter((item) => item.riskLevel === "medium").length;
  const renewals = records.filter((item) => item.status === "待续费").length;

  return {
    highRisk,
    mediumRisk,
    renewals,
    totalBalanceHours: records.reduce((sum, item) => sum + item.balanceHours, 0),
  };
}

function fuzzy(value: string, keyword?: string) {
  return keyword ? value.includes(keyword) : true;
}

function exact(value: string, keyword?: string) {
  return keyword ? value === keyword : true;
}
