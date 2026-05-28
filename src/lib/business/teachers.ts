export type TeacherRecord = {
  id: string;
  name: string;
  city: string;
  specialties: string[];
  serviceAgeRange: string;
  status: "可排课" | "资料待完善" | "暂停服务";
  rating: number;
  completedServices: number;
  missingFields: string[];
  riskLevel: "low" | "medium" | "high";
};

export type TeacherQueryInput = {
  name?: string;
  city?: string;
  specialty?: string;
  status?: string;
  riskLevel?: string;
  limit?: number;
};

const demoTeachers: TeacherRecord[] = [
  {
    id: "T-001",
    name: "王老师",
    city: "北京",
    specialties: ["专注力", "学习习惯", "规则意识"],
    serviceAgeRange: "6-10岁",
    status: "可排课",
    rating: 4.8,
    completedServices: 128,
    missingFields: [],
    riskLevel: "low",
  },
  {
    id: "T-002",
    name: "陈老师",
    city: "上海",
    specialties: ["情绪管理", "亲子沟通"],
    serviceAgeRange: "4-8岁",
    status: "资料待完善",
    rating: 4.5,
    completedServices: 76,
    missingFields: ["无犯罪记录证明", "最新服务案例"],
    riskLevel: "medium",
  },
  {
    id: "T-003",
    name: "刘老师",
    city: "北京",
    specialties: ["社交能力", "表达训练", "自信心"],
    serviceAgeRange: "5-12岁",
    status: "可排课",
    rating: 4.9,
    completedServices: 203,
    missingFields: [],
    riskLevel: "low",
  },
];

export async function queryTeachers(input: TeacherQueryInput) {
  const limit = Math.min(Math.max(input.limit || 10, 1), 50);
  const records = demoTeachers
    .filter((teacher) => fuzzy(teacher.name, input.name))
    .filter((teacher) => exact(teacher.city, input.city))
    .filter((teacher) => exact(teacher.status, input.status))
    .filter((teacher) => exact(teacher.riskLevel, input.riskLevel))
    .filter((teacher) =>
      input.specialty
        ? teacher.specialties.some((specialty) => specialty.includes(input.specialty || ""))
        : true,
    )
    .slice(0, limit);

  return {
    source: process.env.TEACHERS_API_URL ? "external_api_placeholder" : "demo_data",
    connected: Boolean(process.env.TEACHERS_API_URL),
    count: records.length,
    records,
    checklist: buildTeacherChecklist(records),
    nextIntegrationHint: process.env.TEACHERS_API_URL
      ? "TEACHERS_API_URL 已配置，可在 src/lib/business/teachers.ts 中替换为真实 fetch 调用。"
      : "当前使用内置演示数据。配置 TEACHERS_API_URL 后可接入真实老师资料系统。",
  };
}

function buildTeacherChecklist(records: TeacherRecord[]) {
  return records.map((teacher) => ({
    teacherId: teacher.id,
    teacherName: teacher.name,
    profileComplete: teacher.missingFields.length === 0,
    missingFields: teacher.missingFields,
    suggestedAction:
      teacher.missingFields.length === 0
        ? "资料完整，可进入匹配或排课流程。"
        : `请补齐：${teacher.missingFields.join("、")}`,
  }));
}

function fuzzy(value: string, keyword?: string) {
  return keyword ? value.includes(keyword) : true;
}

function exact(value: string, keyword?: string) {
  return keyword ? value === keyword : true;
}
