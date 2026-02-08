import * as fs from 'fs-extra';
import * as path from 'path';

export interface AgentConfig {
  fileName: string;
  name: string;
  description: string;
  prompt: string;
}

export interface FileConfig {
  fileName: string;
  content: string;
}

export interface ProjectConfigData {
  agents: AgentConfig[];
  skills: FileConfig[];
  steering: FileConfig[];
  meta: {
    mainAgentFile: string | null;
    subAgentFiles: string[];
    agentSkills: Record<string, string[]>;
    agentSteering: Record<string, string[]>;
    mainAgentSubAgents: string[];
  };
}

const ensureUniqueFileName = (baseName: string, ext: string, used: Set<string>) => {
  let name = baseName;
  let candidate = `${name}${ext}`;
  let index = 1;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${name}_${index}${ext}`;
  }
  used.add(candidate);
  return candidate;
};

const sanitizeBaseName = (value: string, fallback: string) => {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const safe = trimmed.replace(/[^a-zA-Z0-9-_]+/g, '_');
  return safe.length ? safe : fallback;
};

const listFiles = async (dirPath: string): Promise<string[]> => {
  if (!(await fs.pathExists(dirPath))) return [];
  const entries = await fs.readdir(dirPath);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const stat = await fs.stat(fullPath);
    if (stat.isFile()) files.push(entry);
  }
  return files;
};

export class ProjectConfigManager {
  async load(projectPath: string): Promise<ProjectConfigData> {
    const kiroDir = path.join(projectPath, '.kiro');
    const agentsDir = path.join(kiroDir, 'agents');
    const skillsDir = path.join(kiroDir, 'skills');
    const steeringDir = path.join(kiroDir, 'steering');
    const configPath = path.join(kiroDir, 'config.json');

    const agentFiles = (await listFiles(agentsDir)).filter(name => name.endsWith('.json'));
    const agents: AgentConfig[] = [];
    for (const fileName of agentFiles) {
      const fullPath = path.join(agentsDir, fileName);
      try {
        const data = await fs.readJson(fullPath);
        agents.push({
          fileName,
          name: data.name || path.basename(fileName, '.json'),
          description: data.description || '',
          prompt: data.prompt || ''
        });
      } catch {
        agents.push({
          fileName,
          name: path.basename(fileName, '.json'),
          description: '',
          prompt: ''
        });
      }
    }

    const skills: FileConfig[] = [];
    for (const fileName of await listFiles(skillsDir)) {
      const content = await fs.readFile(path.join(skillsDir, fileName), 'utf8');
      skills.push({ fileName, content });
    }

    const steering: FileConfig[] = [];
    for (const fileName of await listFiles(steeringDir)) {
      const content = await fs.readFile(path.join(steeringDir, fileName), 'utf8');
      steering.push({ fileName, content });
    }

    let meta: ProjectConfigData['meta'] = {
      mainAgentFile: agents[0]?.fileName || null,
      subAgentFiles: agents.slice(1).map(agent => agent.fileName),
      agentSkills: {},
      agentSteering: {},
      mainAgentSubAgents: agents.slice(1).map(agent => agent.fileName)
    };

    if (await fs.pathExists(configPath)) {
      try {
        const config = await fs.readJson(configPath);
        if (config?.agentSettings) {
          meta = {
            mainAgentFile: config.agentSettings.mainAgentFile ?? meta.mainAgentFile,
            subAgentFiles: Array.isArray(config.agentSettings.subAgentFiles) ? config.agentSettings.subAgentFiles : meta.subAgentFiles,
            agentSkills: { ...meta.agentSkills, ...config.agentSettings.agentSkills },
            agentSteering: { ...meta.agentSteering, ...config.agentSettings.agentSteering },
            mainAgentSubAgents: Array.isArray(config.agentSettings.mainAgentSubAgents) ? config.agentSettings.mainAgentSubAgents : meta.mainAgentSubAgents
          };
        }
      } catch {
        // ignore config parse errors
      }
    }

    return { agents, skills, steering, meta };
  }

  async saveAgents(projectPath: string, agents: AgentConfig[]): Promise<void> {
    const kiroDir = path.join(projectPath, '.kiro');
    const agentsDir = path.join(kiroDir, 'agents');
    await fs.ensureDir(agentsDir);

    const existingFiles = new Set(await listFiles(agentsDir));
    const used = new Set<string>();
    const fileMap = new Map<string, AgentConfig>();

    for (const agent of agents) {
      const base = sanitizeBaseName(agent.fileName ? path.basename(agent.fileName, '.json') : agent.name, 'agent');
      const fileName = agent.fileName && agent.fileName.endsWith('.json')
        ? agent.fileName
        : ensureUniqueFileName(base, '.json', used);
      fileMap.set(fileName, { ...agent, fileName });
    }

    for (const fileName of existingFiles) {
      if (!fileMap.has(fileName)) {
        await fs.remove(path.join(agentsDir, fileName));
      }
    }

    for (const [fileName, agent] of fileMap.entries()) {
      await fs.writeJson(path.join(agentsDir, fileName), {
        name: agent.name,
        description: agent.description,
        prompt: agent.prompt
      }, { spaces: 2 });
    }
  }

  async saveFiles(projectPath: string, kind: 'skills' | 'steering', files: FileConfig[]): Promise<void> {
    const kiroDir = path.join(projectPath, '.kiro');
    const targetDir = path.join(kiroDir, kind);
    await fs.ensureDir(targetDir);

    const existingFiles = new Set(await listFiles(targetDir));
    const used = new Set<string>();
    const fileMap = new Map<string, FileConfig>();

    for (const file of files) {
      const fallback = kind === 'skills' ? 'skill' : 'steering';
      const rawName = file.fileName || fallback;
      const ext = path.extname(rawName) || '.md';
      const base = sanitizeBaseName(path.basename(rawName, ext), fallback);
      const fileName = ensureUniqueFileName(base, ext, used);
      fileMap.set(fileName, { ...file, fileName });
    }

    for (const fileName of existingFiles) {
      if (!fileMap.has(fileName)) {
        await fs.remove(path.join(targetDir, fileName));
      }
    }

    for (const [fileName, file] of fileMap.entries()) {
      await fs.writeFile(path.join(targetDir, fileName), file.content ?? '', 'utf8');
    }
  }

  async saveMeta(projectPath: string, meta: ProjectConfigData['meta']): Promise<void> {
    const kiroDir = path.join(projectPath, '.kiro');
    const configPath = path.join(kiroDir, 'config.json');
    await fs.ensureDir(kiroDir);
    let config: any = {};
    if (await fs.pathExists(configPath)) {
      try {
        config = await fs.readJson(configPath);
      } catch {
        config = {};
      }
    }
    config.agentSettings = meta;
    await fs.writeJson(configPath, config, { spaces: 2 });
    // Do not write agentSettings into agent json files; schema does not allow it.
    const agentsDir = path.join(kiroDir, 'agents');
    const agentFiles = (await listFiles(agentsDir)).filter(name => name.endsWith('.json'));
    for (const fileName of agentFiles) {
      const agentPath = path.join(agentsDir, fileName);
      try {
        const agentConfig = await fs.readJson(agentPath);
        if ('subAgents' in agentConfig || 'skills' in agentConfig || 'steering' in agentConfig) {
          delete agentConfig.subAgents;
          delete agentConfig.skills;
          delete agentConfig.steering;
          await fs.writeJson(agentPath, agentConfig, { spaces: 2 });
        }
      } catch {
        // ignore cleanup failures
      }
    }
  }
}

export const projectConfigManager = new ProjectConfigManager();
