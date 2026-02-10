import { useState, useEffect } from 'react';
import { Project } from '../../../shared/types/project';

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = async () => {
    setLoading(true);
    const data = await window.electronAPI.getProjects();
    setProjects(data);
    setLoading(false);
  };

  const createProject = async (name: string, path: string, type: 'maintenance' | 'new-development') => {
    await window.electronAPI.createProject(name, path, type);
    await loadProjects();
  };

  const deleteProject = async (id: string) => {
    await window.electronAPI.deleteProject(id);
    await loadProjects();
  };

  useEffect(() => {
    loadProjects();
  }, []);

  return { projects, loading, createProject, deleteProject, refreshProjects: loadProjects };
};
