/**
 * Evaluation Runner
 * 
 * 运行评估任务，执行 prompt 并存储结果
 */

import { getDb } from "@/lib/db";
import { generateText } from "ai";
import { getChatModel } from "@/lib/ai/model";
import {
  type EvalRun,
  type EvalResult,
  type EvalDataset,
  BUILTIN_DATASETS,
} from "./types";
import { JUDGE_PROMPTS } from "./types";
import { listModelConfigs } from "@/lib/models";

export interface RunEvalOptions {
  /** 评估 prompt ID 列表 */
  promptIds?: string[];
  /** 模型配置 ID 列表 */
  modelConfigIds?: number[];
  /** 是否使用 LLM-as-Judge */
  useJudge?: boolean;
  /** Judge 模型配置 ID */
  judgeModelConfigId?: number;
}

export interface RunEvalResult {
  totalRuns: number;
  successCount: number;
  errorCount: number;
  results: EvalResult[];
  errors: Array<{ promptId: string; modelId: string; error: string }>;
}

/**
 * 确保评估表存在
 */
function ensureEvalSchema() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS eval_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eval_prompt_id TEXT NOT NULL,
      model_config_id INTEGER,
      model_name TEXT NOT NULL,
      model_id TEXT NOT NULL,
      provider TEXT,
      output TEXT NOT NULL,
      manual_score INTEGER,
      judge_score INTEGER,
      judge_feedback TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_eval_runs_prompt ON eval_runs(eval_prompt_id);
    CREATE INDEX IF NOT EXISTS idx_eval_runs_model ON eval_runs(model_id);
    CREATE INDEX IF NOT EXISTS idx_eval_runs_created ON eval_runs(created_at DESC);
  `);
}

/**
 * 获取所有评估数据集
 */
export function listEvalDatasets(): EvalDataset[] {
  return BUILTIN_DATASETS;
}

/**
 * 获取单个数据集
 */
export function getEvalDataset(datasetId: string): EvalDataset | null {
  return BUILTIN_DATASETS.find(d => d.id === datasetId) || null;
}

/**
 * 运行评估
 */
export async function runEvaluation(options: RunEvalOptions = {}): Promise<RunEvalResult> {
  ensureEvalSchema();

  const {
    promptIds,
    modelConfigIds,
    useJudge = false,
    judgeModelConfigId,
  } = options;

  // 获取要评估的 prompts
  const allPrompts = BUILTIN_DATASETS.flatMap(d => d.prompts);
  const selectedPrompts = promptIds
    ? allPrompts.filter(p => promptIds.includes(p.id))
    : allPrompts;

  // 获取要测试的模型
  const allModels = listModelConfigs();
  const selectedModels = modelConfigIds
    ? allModels.filter(m => modelConfigIds.includes(m.id))
    : allModels.filter(m => m.enabled);

  if (selectedModels.length === 0) {
    throw new Error("没有可用的模型配置");
  }

  const results: EvalResult[] = [];
  const errors: Array<{ promptId: string; modelId: string; error: string }> = [];
  let successCount = 0;
  let errorCount = 0;

  // 对每个 prompt 运行评估
  for (const prompt of selectedPrompts) {
    const promptResults: EvalRun[] = [];

    for (const modelConfig of selectedModels) {
      try {
        // 获取模型
        const model = getChatModel(modelConfig.id);

        // 运行模型
        const result = await generateText({
          model,
          prompt: prompt.prompt,
          temperature: 0.7,
          maxOutputTokens: 1000,
        });

        const output = result.text;

        // 保存评估结果
        const run = saveEvalRun({
          evalPromptId: prompt.id,
          modelConfigId: modelConfig.id,
          modelName: modelConfig.name,
          modelId: modelConfig.modelId,
          provider: modelConfig.provider,
          output,
        });

        promptResults.push(run);

        // LLM-as-Judge 评分
        if (useJudge) {
          try {
            const judgeScore = await runJudge(
              prompt.prompt,
              output,
              judgeModelConfigId
            );
            updateEvalRun(run.id!, {
              judgeScore: judgeScore.score,
              judgeFeedback: judgeScore.feedback,
            });
            run.judgeScore = judgeScore.score;
            run.judgeFeedback = judgeScore.feedback;
          } catch (judgeError) {
            console.warn("Judge failed:", judgeError);
          }
        }

        successCount++;
      } catch (error) {
        errorCount++;
        errors.push({
          promptId: prompt.id,
          modelId: modelConfig.modelId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // 计算平均分
    const validScores = promptResults.filter(r => r.judgeScore !== undefined);
    const avgJudgeScore = validScores.length > 0
      ? validScores.reduce((sum, r) => sum + (r.judgeScore || 0), 0) / validScores.length
      : null;

    results.push({
      id: 0, // 临时 ID
      evalPrompt: prompt,
      runs: promptResults,
      averageScore: null, // 手动评分
      averageJudgeScore: avgJudgeScore,
      createdAt: new Date().toISOString(),
    });
  }

  return {
    totalRuns: selectedPrompts.length * selectedModels.length,
    successCount,
    errorCount,
    results,
    errors,
  };
}

/**
 * LLM-as-Judge 评分
 */
async function runJudge(
  question: string,
  answer: string,
  modelConfigId?: number
): Promise<{ score: number; feedback: string }> {
  const model = getChatModel(modelConfigId);

  const result = await generateText({
    model,
    prompt: JUDGE_PROMPTS.scoreWithFeedback
      .replace("{question}", question)
      .replace("{answer}", answer),
    temperature: 0.1,
  });

  // 尝试解析 JSON
  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        score: parsed.totalScore || 0,
        feedback: parsed.feedback || "",
      };
    }
  } catch {
    // 解析失败，尝试提取数字
  }

  // 降级：提取数字
  const scoreMatch = result.text.match(/\d+/);
  const score = scoreMatch ? parseInt(scoreMatch[0], 10) : 5;

  return {
    score: Math.min(10, Math.max(0, score)),
    feedback: result.text.slice(0, 500),
  };
}

/**
 * 保存评估运行结果
 */
function saveEvalRun(run: Omit<EvalRun, "id" | "createdAt">): EvalRun {
  const db = getDb();
  ensureEvalSchema();

  const result = db
    .prepare(
      `INSERT INTO eval_runs 
        (eval_prompt_id, model_config_id, model_name, model_id, provider, output, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      run.evalPromptId,
      run.modelConfigId,
      run.modelName,
      run.modelId,
      run.provider,
      run.output,
      run.metadata ? JSON.stringify(run.metadata) : null
    );

  return {
    ...run,
    id: Number(result.lastInsertRowid),
    createdAt: new Date().toISOString(),
  };
}

/**
 * 更新评估运行结果
 */
function updateEvalRun(
  id: number,
  updates: {
    manualScore?: number;
    judgeScore?: number;
    judgeFeedback?: string;
  }
): void {
  const db = getDb();

  db.prepare(`
    UPDATE eval_runs SET
      manual_score = COALESCE(?, manual_score),
      judge_score = COALESCE(?, judge_score),
      judge_feedback = COALESCE(?, judge_feedback)
    WHERE id = ?
  `).run(updates.manualScore, updates.judgeScore, updates.judgeFeedback, id);
}

/**
 * 查询评估结果
 */
export function queryEvalRuns(filter: {
  promptId?: string;
  modelId?: string;
  limit?: number;
  offset?: number;
} = {}): { runs: EvalRun[]; total: number } {
  const db = getDb();
  ensureEvalSchema();

  let whereClause = "WHERE 1=1";
  const params: (string | number)[] = [];

  if (filter.promptId) {
    whereClause += " AND eval_prompt_id = ?";
    params.push(filter.promptId);
  }
  if (filter.modelId) {
    whereClause += " AND model_id = ?";
    params.push(filter.modelId);
  }

  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM eval_runs ${whereClause}`)
    .get(...params) as { count: number };

  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;

  const rows = db
    .prepare(
      `SELECT * FROM eval_runs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as Array<{
      id: number;
      eval_prompt_id: string;
      model_config_id: number | null;
      model_name: string;
      model_id: string;
      provider: string | null;
      output: string;
      manual_score: number | null;
      judge_score: number | null;
      judge_feedback: string | null;
      metadata: string | null;
      created_at: string;
    }>;

  const runs: EvalRun[] = rows.map(row => ({
    id: row.id,
    evalPromptId: row.eval_prompt_id,
    modelConfigId: row.model_config_id,
    modelName: row.model_name,
    modelId: row.model_id,
    provider: row.provider ?? "unknown",
    output: row.output,
    manualScore: row.manual_score ?? undefined,
    judgeScore: row.judge_score ?? undefined,
    judgeFeedback: row.judge_feedback ?? undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.created_at,
  } as EvalRun));

  return {
    runs,
    total: countResult.count,
  };
}

/**
 * 获取评估统计
 */
export function getEvalStats(): {
  totalRuns: number;
  averageScore: number | null;
  byModel: Record<string, { count: number; avgScore: number | null }>;
  byPrompt: Record<string, { count: number; avgScore: number | null }>;
} {
  const db = getDb();
  ensureEvalSchema();

  const overall = db.prepare(`
    SELECT 
      COUNT(*) as total,
      AVG(judge_score) as avg_score,
      AVG(manual_score) as avg_manual_score
    FROM eval_runs
  `).get() as {
    total: number;
    avg_score: number | null;
    avg_manual_score: number | null;
  };

  const byModel = db.prepare(`
    SELECT model_id, COUNT(*) as count, AVG(judge_score) as avg_score
    FROM eval_runs
    GROUP BY model_id
  `).all() as Array<{ model_id: string; count: number; avg_score: number | null }>;

  const byPrompt = db.prepare(`
    SELECT eval_prompt_id, COUNT(*) as count, AVG(judge_score) as avg_score
    FROM eval_runs
    GROUP BY eval_prompt_id
  `).all() as Array<{ eval_prompt_id: string; count: number; avg_score: number | null }>;

  return {
    totalRuns: overall.total,
    averageScore: overall.avg_score || overall.avg_manual_score || null,
    byModel: Object.fromEntries(
      byModel.map(m => [m.model_id, { count: m.count, avgScore: m.avg_score }])
    ),
    byPrompt: Object.fromEntries(
      byPrompt.map(p => [p.eval_prompt_id, { count: p.count, avgScore: p.avg_score }])
    ),
  };
}

/**
 * 更新手动评分
 */
export function setManualScore(runId: number, score: number): void {
  updateEvalRun(runId, { manualScore: score });
}
