import * as fs from 'fs-extra';
import * as path from 'path';
import { app } from 'electron';
import { ProjectDatabase, Project } from '../types/project';
import { v4 as uuidv4 } from 'uuid';

class ProjectManager {
  private dbPath: string = '';
  private data: ProjectDatabase = { projects: [] };

  async init() {
    this.dbPath = path.join(app.getPath('userData'), 'projects.json');
    await fs.ensureFile(this.dbPath);
    try {
      this.data = await fs.readJson(this.dbPath);
    } catch {
      this.data = { projects: [] };
      await this.save();
    }
  }

  private async save() {
    await fs.writeJson(this.dbPath, this.data, { spaces: 2 });
  }

  async addProject(name: string, projectPath: string, type: 'maintenance' | 'new-development'): Promise<Project> {
    const project: Project = {
      id: uuidv4(),
      name,
      path: projectPath,
      type,
      mainAgent: type === 'maintenance' ? 'pm_agent' : 'architect_agent',
      lastAccess: new Date().toISOString()
    };
    this.data.projects.push(project);
    await this.save();
    return project;
  }

  async getProjects(): Promise<Project[]> {
    return this.data.projects;
  }

  async updateLastAccess(id: string): Promise<void> {
    const project = this.data.projects.find(p => p.id === id);
    if (project) {
      project.lastAccess = new Date().toISOString();
      await this.save();
    }
  }

  async deleteProject(id: string): Promise<void> {
    this.data.projects = this.data.projects.filter(p => p.id !== id);
    await this.save();
  }
}

export const projectManager = new ProjectManager();
