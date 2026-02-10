import React, { useState, useEffect, useRef } from 'react';
import { useConversation } from '../../entities/chat/model/conversation-context';
import { useI18n } from '../../shared/lib/i18n-context';
import { Project } from '../../shared/types/project';

interface Props {
  projects: Project[];
  selectedProject: Project | null;
  onSelect: (project: Project) => void;
  onDelete: (id: string) => void;
  onOpenSettings: (project: Project) => void;
}

const ProjectList: React.FC<Props> = ({ projects, selectedProject, onSelect, onDelete, onOpenSettings }) => {
  const { t } = useI18n();
  const { getConversation } = useConversation();
  const [contextMenuProject, setContextMenuProject] = useState<Project | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenuProject(null);
      }
    };

    if (contextMenuProject) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenuProject]);

  const handleContextMenu = (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    setContextMenuProject(project);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('confirmDelete'))) {
      await onDelete(id);
    }
    setContextMenuProject(null);
  };

  const handleOpenSettings = (project: Project) => {
    onOpenSettings(project);
    setContextMenuProject(null);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {projects.length === 0 ? (
        <div className="p-4 text-center text-gray-500 text-sm">
          {t('noProjects')}
        </div>
      ) : (
        <div className="p-2 space-y-1">
          {projects.map((project) => {
            const messageCount = getConversation(project.id).length;
            const isSelected = selectedProject?.id === project.id;
            
            return (
              <div
                key={project.id}
                onClick={() => onSelect(project)}
                onContextMenu={(e) => handleContextMenu(e, project)}
                className={`p-3 rounded-md cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-700 text-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-medium text-sm truncate">{project.name}</h3>
                  {messageCount > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-blue-500' : 'bg-gray-600'
                    }`}>
                      {messageCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs opacity-75">
                  <span className={`px-1.5 py-0.5 rounded ${
                    project.type === 'maintenance' 
                      ? (isSelected ? 'bg-blue-500' : 'bg-orange-900/50 text-orange-300')
                      : (isSelected ? 'bg-blue-500' : 'bg-green-900/50 text-green-300')
                  }`}>
                    {project.type === 'maintenance' ? t('maintenance') : t('newDevelopment')}
                  </span>
                  <span className="truncate">{project.mainAgent}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {contextMenuProject && (
        <div
          ref={contextMenuRef}
          className="fixed bg-gray-800 border border-gray-700 rounded-md shadow-lg py-1 z-50"
          style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
        >
          <button
            onClick={() => handleOpenSettings(contextMenuProject)}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {t('projectSettings')}
          </button>
          <button
            onClick={() => handleDelete(contextMenuProject.id)}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-red-400 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {t('delete')}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProjectList;
