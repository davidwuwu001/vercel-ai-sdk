/**
 * Local Coding Agent Tool - Read-only inspection tools for OpenClaw
 * 
 * This module provides read-only access to local OpenClaw installations
 * without executing any shell commands or accessing sensitive data.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface SkillInfo {
  name: string;
  description: string;
  source: string;
  path: string;
  eligible: boolean;
  requirements?: {
    bins?: string[];
    env?: string[];
    config?: string[];
  };
}

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  model?: string;
  skills: string[];
  channels: string[];
}

export interface PluginInfo {
  name: string;
  version?: string;
  skills: string[];
}

export interface OpenClawStatus {
  installed: boolean;
  configExists: boolean;
  gatewayPort: number;
  gatewayRunning: boolean;
  skillsCount: number;
  pluginsCount: number;
}

const HOME_DIR = os.homedir();
const OPENCLAW_DIR = path.join(HOME_DIR, ".openclaw");
const OPENCLAW_CONFIG = path.join(OPENCLAW_DIR, "openclaw.json");

function isSafePath(p: string): boolean {
  const normalized = path.normalize(p);
  return normalized.startsWith(OPENCLAW_DIR) && !normalized.includes("/identity/") && !normalized.includes("/workspace/");
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!isSafePath(filePath)) return fallback;
    if (!fs.existsSync(filePath)) return fallback;
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

function sanitizeConfig(config: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ["token", "apiKey", "api_key", "secret", "password", "auth"];
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(config)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeConfig(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

export async function getOpenClawStatus(): Promise<OpenClawStatus> {
  const configExists = fs.existsSync(OPENCLAW_CONFIG);
  let gatewayRunning = false;
  
  if (configExists) {
    try {
      const response = await fetch("http://localhost:18789/status", {
        signal: AbortSignal.timeout(1000),
      });
      gatewayRunning = response.ok;
    } catch {
      gatewayRunning = false;
    }
  }
  
  const skillsDir = path.join(OPENCLAW_DIR, "skills");
  const pluginSkillsDir = path.join(OPENCLAW_DIR, "plugin-skills");
  
  let skillsCount = 0;
  let pluginsCount = 0;
  
  if (fs.existsSync(skillsDir)) {
    skillsCount += fs.readdirSync(skillsDir).filter(f => {
      const skillPath = path.join(skillsDir, f);
      return fs.statSync(skillPath).isDirectory() && fs.existsSync(path.join(skillPath, "SKILL.md"));
    }).length;
  }
  
  if (fs.existsSync(pluginSkillsDir)) {
    pluginsCount = fs.readdirSync(pluginSkillsDir).filter(f => {
      const pluginPath = path.join(pluginSkillsDir, f);
      return fs.lstatSync(pluginPath).isDirectory();
    }).length;
  }
  
  const config = readJsonFile<{ gateway?: { port?: number } }>(OPENCLAW_CONFIG, {});
  
  return {
    installed: configExists,
    configExists,
    gatewayPort: config.gateway?.port || 18789,
    gatewayRunning,
    skillsCount,
    pluginsCount,
  };
}

export async function listSkills(): Promise<SkillInfo[]> {
  const skills: SkillInfo[] = [];
  
  const skillsDir = path.join(OPENCLAW_DIR, "skills");
  const pluginSkillsDir = path.join(OPENCLAW_DIR, "plugin-skills");
  
  const scanSkillDir = (dir: string, source: string) => {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const skillPath = path.join(dir, entry.name);
      const skillMdPath = path.join(skillPath, "SKILL.md");
      
      if (!fs.existsSync(skillMdPath)) continue;
      
      try {
        const content = fs.readFileSync(skillMdPath, "utf-8");
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        
        let name = entry.name;
        let description = "";
        
        if (frontmatterMatch) {
          const frontmatter = frontmatterMatch[1];
          const nameMatch = frontmatter.match(/name:\s*(.+)/i);
          const descMatch = frontmatter.match(/description:\s*(.+)/i);
          
          if (nameMatch) name = nameMatch[1].trim();
          if (descMatch) description = descMatch[1].trim();
        }
        
        skills.push({
          name,
          description,
          source,
          path: skillPath,
          eligible: true,
        });
      } catch {
        skills.push({
          name: entry.name,
          description: "Unable to parse skill metadata",
          source,
          path: skillPath,
          eligible: true,
        });
      }
    }
  };
  
  scanSkillDir(skillsDir, "local");
  scanSkillDir(pluginSkillsDir, "plugin");
  
  return skills;
}

export async function listAgents(): Promise<AgentInfo[]> {
  const agents: AgentInfo[] = [];
  const agentsDir = path.join(OPENCLAW_DIR, "agents");
  
  if (!fs.existsSync(agentsDir)) return agents;
  
  const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    const agentPath = path.join(agentsDir, entry.name);
    const agentJsonPath = path.join(agentPath, "agent.json");
    
    if (!fs.existsSync(agentJsonPath)) continue;
    
    try {
      const agentConfig = readJsonFile<{
        name?: string;
        description?: string;
        model?: string;
        skills?: string[];
        channels?: string[];
      }>(agentJsonPath, {});
      
      agents.push({
        id: entry.name,
        name: agentConfig.name || entry.name,
        description: agentConfig.description || "",
        model: agentConfig.model,
        skills: agentConfig.skills || [],
        channels: agentConfig.channels || [],
      });
    } catch {
      agents.push({
        id: entry.name,
        name: entry.name,
        description: "Unable to read agent configuration",
        skills: [],
        channels: [],
      });
    }
  }
  
  return agents;
}

export async function listPlugins(): Promise<PluginInfo[]> {
  const plugins: PluginInfo[] = [];
  const pluginSkillsDir = path.join(OPENCLAW_DIR, "plugin-skills");
  
  if (!fs.existsSync(pluginSkillsDir)) return plugins;
  
  const entries = fs.readdirSync(pluginSkillsDir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    const pluginPath = path.join(pluginSkillsDir, entry.name);
    const installsJson = path.join(OPENCLAW_DIR, "plugins", "installs.json");
    
    let version: string | undefined;
    try {
      if (fs.existsSync(installsJson)) {
        const installs = readJsonFile<Record<string, { version?: string }>>(installsJson, {});
        version = installs[entry.name]?.version;
      }
    } catch {}
    
    const skills: string[] = [];
    try {
      const skillEntries = fs.readdirSync(pluginPath);
      for (const skillEntry of skillEntries) {
        const skillEntryPath = path.join(pluginPath, skillEntry);
        if (fs.statSync(skillEntryPath).isDirectory() || skillEntry.endsWith(".md")) {
          const skillName = skillEntry.replace(/\.md$/, "");
          if (!skills.includes(skillName)) skills.push(skillName);
        }
      }
    } catch {}
    
    plugins.push({
      name: entry.name,
      version,
      skills,
    });
  }
  
  return plugins;
}

export async function getOpenClawConfig(): Promise<Record<string, unknown>> {
  const config = readJsonFile<Record<string, unknown>>(OPENCLAW_CONFIG, {});
  return sanitizeConfig(config);
}

export async function inspectSkill(skillName: string): Promise<{ exists: boolean; content?: string; metadata?: Record<string, unknown> }> {
  const skillPath = path.join(OPENCLAW_DIR, "skills", skillName);
  const skillMdPath = path.join(skillPath, "SKILL.md");
  
  if (!fs.existsSync(skillMdPath)) {
    const pluginSkillPath = path.join(OPENCLAW_DIR, "plugin-skills", skillName);
    const pluginSkillMdPath = path.join(pluginSkillPath, "SKILL.md");
    
    if (!fs.existsSync(pluginSkillMdPath)) {
      return { exists: false };
    }
    
    const content = fs.readFileSync(pluginSkillMdPath, "utf-8");
    return { exists: true, content };
  }
  
  const content = fs.readFileSync(skillMdPath, "utf-8");
  return { exists: true, content };
}
