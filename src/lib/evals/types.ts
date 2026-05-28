/**
 * Evaluation Types
 * 
 * 定义评估相关的数据结构
 */

export interface EvalPrompt {
  id: string;
  name: string;
  description: string;
  prompt: string;
  expectedCriteria?: string;
  category: "general" | "reasoning" | "creative" | "analysis";
}

export interface EvalRun {
  id?: number;
  evalPromptId: string;
  modelConfigId: number | null;
  modelName: string;
  modelId: string;
  provider: string;
  output: string;
  manualScore?: number;
  judgeScore?: number;
  judgeFeedback?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface EvalResult {
  id: number;
  evalPrompt: EvalPrompt;
  runs: EvalRun[];
  averageScore: number | null;
  averageJudgeScore: number | null;
  createdAt: string;
}

export interface EvalDataset {
  id: string;
  name: string;
  description: string;
  prompts: EvalPrompt[];
  createdAt: string;
}

/**
 * 内置评估数据集
 */
export const BUILTIN_DATASETS: EvalDataset[] = [
  {
    id: "general-capability",
    name: "通用能力测试",
    description: "测试模型的基本理解和回答能力",
    prompts: [
      {
        id: "factual-qa",
        name: "事实问答",
        description: "测试模型对基本事实的准确回答能力",
        prompt: "请简要解释什么是人工智能机器学习，给出3个实际应用例子。",
        category: "general",
        expectedCriteria: "准确解释概念，给出相关例子",
      },
      {
        id: "summarization",
        name: "文本摘要",
        description: "测试模型的文本压缩能力",
        prompt: "请将以下文本压缩为100字以内的摘要：人工智能（AI）是计算机科学的一个分支，致力于开发能够执行通常需要人类智能的任务的系统。这包括视觉感知、语音识别、决策制定和语言翻译等。AI技术已经从实验室走向实际应用，广泛应用于医疗、金融、制造等领域。",
        category: "general",
        expectedCriteria: "保留核心信息，压缩至100字以内",
      },
      {
        id: "reasoning",
        name: "逻辑推理",
        description: "测试模型的推理能力",
        prompt: "如果所有的A都是B，有些B是C，那么下列哪个结论一定正确？A. 有些A是C B. 所有的C都是A C. 所有的A都是C D. 所有的C都是B。请给出推理过程。",
        category: "reasoning",
        expectedCriteria: "正确识别逻辑关系，给出清晰推理",
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: "domain-specific",
    name: "领域专业测试",
    description: "测试教育行业相关场景",
    prompts: [
      {
        id: "service-feedback",
        name: "服务反馈生成",
        description: "生成服务反馈的能力",
        prompt: "为一个小学数学课程生成一条服务反馈，包含：1) 本节课学习目标 2) 学生表现 3) 建议家长配合事项。语气要专业且友好。",
        category: "analysis",
        expectedCriteria: "结构清晰，语气合适，内容具体",
      },
      {
        id: "case-analysis",
        name: "案例分析",
        description: "分析学生行为案例",
        prompt: "学生小明在课堂上表现出注意力不集中、作业经常迟交、但考试成绩中等。请分析可能的原因并给出建议的干预措施。",
        category: "analysis",
        expectedCriteria: "分析全面，建议实用",
      },
      {
        id: "creative-writing",
        name: "创意写作",
        description: "测试创意表达能力",
        prompt: "为一个6岁小朋友编写一个关于友谊的睡前故事，要求：1) 故事长度约300字 2) 包含一个简单道理 3) 语言适合儿童理解。",
        category: "creative",
        expectedCriteria: "故事有趣，道理清晰，适合年龄",
      },
    ],
    createdAt: new Date().toISOString(),
  },
];

/**
 * 默认评估 prompt
 */
export const DEFAULT_EVAL_PROMPTS: EvalPrompt[] = [
  ...BUILTIN_DATASETS[0].prompts,
  ...BUILTIN_DATASETS[1].prompts,
];

/**
 * LLM-as-Judge 评分标准
 */
export const JUDGE_PROMPTS = {
  scoreOnly: `你是一个专业的AI评估专家。请对以下AI回答进行评分（0-10分）。

问题：{question}
回答：{answer}

请只输出一个数字（0-10），不要输出其他内容。`,

  scoreWithFeedback: `你是一个专业的AI评估专家。请对以下AI回答进行评估。

问题：{question}
回答：{answer}

评估维度：
1. 准确性（0-3分）：回答是否准确、符合事实
2. 完整性（0-3分）：是否完整回答了问题
3. 清晰度（0-2分）：表达是否清晰、有条理
4. 实用性（0-2分）：回答是否有实际帮助

请以JSON格式输出：
{
  "accuracy": <0-3的分数>,
  "completeness": <0-3的分数>,
  "clarity": <0-2的分数>,
  "usefulness": <0-2的分数>,
  "totalScore": <总分>,
  "feedback": "<简短反馈>"
}`,
};
