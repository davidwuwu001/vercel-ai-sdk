import { NextRequest, NextResponse } from "next/server";
import {
  getOpenClawStatus,
  listSkills,
  listAgents,
  listPlugins,
  getOpenClawConfig,
  inspectSkill,
} from "@/lib/agent-tools/local-coding-agent";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action");

  try {
    switch (action) {
      case "status": {
        const status = await getOpenClawStatus();
        return NextResponse.json({ status });
      }

      case "skills": {
        const skills = await listSkills();
        return NextResponse.json({ skills });
      }

      case "agents": {
        const agents = await listAgents();
        return NextResponse.json({ agents });
      }

      case "plugins": {
        const plugins = await listPlugins();
        return NextResponse.json({ plugins });
      }

      case "config": {
        const config = await getOpenClawConfig();
        return NextResponse.json({ config });
      }

      case "inspect-skill": {
        const skillName = searchParams.get("name");
        if (!skillName) {
          return NextResponse.json(
            { error: "Missing 'name' parameter" },
            { status: 400 }
          );
        }
        const result = await inspectSkill(skillName);
        return NextResponse.json(result);
      }

      default: {
        const [status, skills, agents, plugins, config] = await Promise.all([
          getOpenClawStatus(),
          listSkills(),
          listAgents(),
          listPlugins(),
          getOpenClawConfig(),
        ]);

        return NextResponse.json({
          status,
          skills,
          agents,
          plugins,
          config,
        });
      }
    }
  } catch (error) {
    console.error("[local-agent-inspect]", error);
    return NextResponse.json(
      {
        error: "Failed to inspect local agent",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
