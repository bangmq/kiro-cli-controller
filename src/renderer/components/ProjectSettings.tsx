import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../app';

interface Project {
  id: string;
  name: string;
  path: string;
  type: 'maintenance' | 'new-development';
  mainAgent: string;
  lastAccess: string;
}

interface AgentDraft {
  id: string;
  fileName: string;
  name: string;
  description: string;
  prompt: string;
}

interface FileDraft {
  id: string;
  fileName: string;
  content: string;
}

interface Props {
  project: Project;
  onClose: () => void;
}

const ProjectSettings: React.FC<Props> = ({ project, onClose }) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'agents' | 'sub-agents' | 'skills' | 'steering'>('agents');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentDraft[]>([]);
  const [skills, setSkills] = useState<FileDraft[]>([]);
  const [steering, setSteering] = useState<FileDraft[]>([]);
  const [mainAgentFile, setMainAgentFile] = useState<string | null>(null);
  const [subAgentFiles, setSubAgentFiles] = useState<string[]>([]);
  const [agentSkills, setAgentSkills] = useState<Record<string, string[]>>({});
  const [agentSteering, setAgentSteering] = useState<Record<string, string[]>>({});
  const [mainAgentSubAgents, setMainAgentSubAgents] = useState<string[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedSteeringId, setSelectedSteeringId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const initialSnapshotRef = useRef<string>('');

  const selectedAgent = useMemo(
    () => agents.find(a => a.id === selectedAgentId) || null,
    [agents, selectedAgentId]
  );
  const selectedSkill = useMemo(
    () => skills.find(f => f.id === selectedSkillId) || null,
    [skills, selectedSkillId]
  );
  const selectedSteering = useMemo(
    () => steering.find(f => f.id === selectedSteeringId) || null,
    [steering, selectedSteeringId]
  );

  const selectedSubAgentFile = useMemo(() => {
    if (!selectedAgent) return null;
    if (selectedAgent.fileName === mainAgentFile) return null;
    return selectedAgent.fileName || null;
  }, [selectedAgent, mainAgentFile]);

  useEffect(() => {
    if (!mainAgentFile && agents.length > 0) {
      setMainAgentFile(agents[0].fileName || null);
    }
  }, [agents, mainAgentFile]);

  useEffect(() => {
    if (selectedAgentId) return;
    const mainAgent = agents.find(agent => agent.fileName === mainAgentFile);
    if (mainAgent) setSelectedAgentId(mainAgent.id);
  }, [agents, mainAgentFile, selectedAgentId]);

  useEffect(() => {
    if (!mainAgentFile) return;
    const mainAgent = agents.find(agent => agent.fileName === mainAgentFile);
    if (mainAgent && mainAgent.id !== selectedAgentId && activeTab === 'agents') {
      setSelectedAgentId(mainAgent.id);
    }
  }, [activeTab, agents, mainAgentFile, selectedAgentId]);


  useEffect(() => {
    const files = agents.map(agent => agent.fileName).filter((fileName): fileName is string => !!fileName);
    const resolvedMain = files.includes(mainAgentFile || '') ? mainAgentFile : files[0] || null;
    if (resolvedMain !== mainAgentFile) setMainAgentFile(resolvedMain);
    const subs = files.filter(file => file !== resolvedMain);
    setSubAgentFiles(subs);
    setMainAgentSubAgents(prev => prev.filter(file => subs.includes(file)));
  }, [agents, mainAgentFile]);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await window.electronAPI.getProjectConfig(project.path);
      const loadedAgents = data.agents.map((agent, index) => ({
        id: `${agent.fileName}-${index}`,
        ...agent
      }));
      const loadedSkills = data.skills.map((file, index) => ({
        id: `${file.fileName}-${index}`,
        ...file
      }));
      const loadedSteering = data.steering.map((file, index) => ({
        id: `${file.fileName}-${index}`,
        ...file
      }));
      setAgents(loadedAgents);
      setSkills(loadedSkills);
      setSteering(loadedSteering);
      setMainAgentFile(data.meta.mainAgentFile || loadedAgents[0]?.fileName || null);
      setSubAgentFiles(data.meta.subAgentFiles || []);
      setAgentSkills(data.meta.agentSkills || {});
      setAgentSteering(data.meta.agentSteering || {});
      setMainAgentSubAgents(data.meta.mainAgentSubAgents || []);
      const mainAgent = loadedAgents.find(agent => agent.fileName === (data.meta.mainAgentFile || loadedAgents[0]?.fileName));
      setSelectedAgentId(mainAgent?.id || loadedAgents[0]?.id || null);
      setSelectedSkillId(loadedSkills[0]?.id || null);
      setSelectedSteeringId(loadedSteering[0]?.id || null);
      const snapshot = JSON.stringify({
        agents: loadedAgents,
        skills: loadedSkills,
        steering: loadedSteering,
        meta: data.meta
      });
      initialSnapshotRef.current = snapshot;
    } catch {
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [project.id]);

  const handleSaveAll = async () => {
    setSaving(true);
    await window.electronAPI.saveProjectAgents(
      project.path,
      agents.map(({ id, ...rest }) => rest)
    );
    await window.electronAPI.saveProjectFiles(
      project.path,
      'skills',
      skills.map(({ id, ...rest }) => rest)
    );
    await window.electronAPI.saveProjectFiles(
      project.path,
      'steering',
      steering.map(({ id, ...rest }) => rest)
    );
    const resolvedMain = mainAgentFile || agents[0]?.fileName || null;
    const resolvedSubAgents = agents
      .map(agent => agent.fileName)
      .filter((fileName): fileName is string => !!fileName && fileName !== resolvedMain);
    const meta = {
      mainAgentFile: resolvedMain,
      subAgentFiles: resolvedSubAgents,
      agentSkills,
      agentSteering,
      mainAgentSubAgents: mainAgentSubAgents.filter(file => resolvedSubAgents.includes(file))
    };
    await window.electronAPI.saveProjectMeta(project.path, meta);
    if (resolvedMain) {
      const mainAgentName = agents.find(agent => agent.fileName === resolvedMain)?.name || project.mainAgent;
      await window.electronAPI.updateProjectMainAgent(project.id, mainAgentName);
    }
    await loadConfig();
    setSaving(false);
  };

  const isDirty = () => {
    const snapshot = JSON.stringify({
      agents,
      skills,
      steering,
      meta: {
        mainAgentFile,
        subAgentFiles,
        agentSkills,
        agentSteering,
        mainAgentSubAgents
      }
    });
    return snapshot !== initialSnapshotRef.current;
  };

  const requestClose = () => {
    if (isDirty()) {
      setShowUnsavedConfirm(true);
      return;
    }
    onClose();
  };

  const addAgent = () => {
    const id = `agent-${Date.now()}`;
    const fileName = `agent_${Date.now()}.json`;
    const next = [...agents, { id, fileName, name: '', description: '', prompt: '' }];
    setAgents(next);
    setSelectedAgentId(id);
  };

  const updateAgentFileName = (agentId: string, newFileName: string) => {
    const current = agents.find(agent => agent.id === agentId);
    if (!current) return;
    const oldFileName = current.fileName;
    setAgents(prev => prev.map(agent => agent.id === agentId ? { ...agent, fileName: newFileName } : agent));
    if (oldFileName && oldFileName !== newFileName) {
      setAgentSkills(prev => {
        const { [oldFileName]: value, ...rest } = prev;
        return value ? { ...rest, [newFileName]: value } : rest;
      });
      setAgentSteering(prev => {
        const { [oldFileName]: value, ...rest } = prev;
        return value ? { ...rest, [newFileName]: value } : rest;
      });
      setMainAgentSubAgents(prev => prev.map(file => (file === oldFileName ? newFileName : file)));
      setSubAgentFiles(prev => prev.map(file => (file === oldFileName ? newFileName : file)));
      if (mainAgentFile === oldFileName) {
        setMainAgentFile(newFileName);
      }
    }
  };

  const removeAgent = (id: string) => {
    const agentToRemove = agents.find(agent => agent.id === id);
    if (agentToRemove?.fileName && agentToRemove.fileName === mainAgentFile) {
      return;
    }
    const next = agents.filter(agent => agent.id !== id);
    setAgents(next);
    if (selectedAgentId === id) {
      setSelectedAgentId(next[0]?.id || null);
    }
    if (agentToRemove?.fileName) {
      const file = agentToRemove.fileName;
      setSubAgentFiles(prev => prev.filter(name => name !== file));
      setMainAgentSubAgents(prev => prev.filter(name => name !== file));
      setAgentSkills(prev => {
        const { [file]: _, ...rest } = prev;
        return rest;
      });
      setAgentSteering(prev => {
        const { [file]: _, ...rest } = prev;
        return rest;
      });
      if (mainAgentFile === file) {
        setMainAgentFile(next[0]?.fileName || null);
      }
    }
  };

  const addFile = (kind: 'skills' | 'steering') => {
    const id = `${kind}-${Date.now()}`;
    const newFile: FileDraft = { id, fileName: '', content: '' };
    if (kind === 'skills') {
      const next = [...skills, newFile];
      setSkills(next);
      setSelectedSkillId(id);
    } else {
      const next = [...steering, newFile];
      setSteering(next);
      setSelectedSteeringId(id);
    }
  };

  const removeFile = (kind: 'skills' | 'steering', id: string) => {
    if (kind === 'skills') {
      const next = skills.filter(file => file.id !== id);
      setSkills(next);
      if (selectedSkillId === id) setSelectedSkillId(next[0]?.id || null);
    } else {
      const next = steering.filter(file => file.id !== id);
      setSteering(next);
      if (selectedSteeringId === id) setSelectedSteeringId(next[0]?.id || null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        {t('loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
        <p className="mb-3">{error}</p>
        <button
          onClick={loadConfig}
          className="px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors text-sm"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-gray-700 bg-gray-800/50 backdrop-blur flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={requestClose}
            className="px-2 py-1 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors text-xs"
          >
            {t('backToChat')}
          </button>
          <div className="text-sm font-semibold truncate">{project.name}</div>
        </div>
        <div className="text-xs text-gray-400">{t('projectSettingsTitle')}</div>
      </div>

      <div className="px-4 py-2 border-b border-gray-700 flex items-center gap-2">
        <button
          onClick={() => setActiveTab('agents')}
          className={`px-3 py-1 rounded-md text-xs transition-colors ${
            activeTab === 'agents' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11a4 4 0 10-8 0 4 4 0 008 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14a6 6 0 016 6H6a6 6 0 016-6z" />
            </svg>
            {t('mainAgent')}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('sub-agents')}
          className={`px-3 py-1 rounded-md text-xs transition-colors ${
            activeTab === 'sub-agents' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10a3 3 0 106 0 3 3 0 00-6 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 20a6 6 0 0112 0" />
            </svg>
            {t('subAgents')}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('skills')}
          className={`px-3 py-1 rounded-md text-xs transition-colors ${
            activeTab === 'skills' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h18M3 12h18M3 17h18" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 3h10v4H7z" />
            </svg>
            {t('skills')}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('steering')}
          className={`px-3 py-1 rounded-md text-xs transition-colors ${
            activeTab === 'steering' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7h16M4 12h10M4 17h6" />
              <circle cx="18" cy="12" r="3" strokeWidth={1.5} />
            </svg>
            {t('steering')}
          </span>
        </button>
        <div className="flex-1" />
        {activeTab === 'agents' ? (
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors text-xs"
          >
            {t('save')}
          </button>
        ) : (
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors text-xs"
          >
            {t('save')}
          </button>
        )}
      </div>

      {activeTab === 'agents' && (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            {selectedAgent ? (
              <div className="space-y-4 max-w-2xl">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('mainAgent')}</label>
                  <div className="text-sm text-gray-300">{selectedAgent.name || t('untitled')}</div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('agentName')}</label>
                  <input
                    value={selectedAgent.name}
                    onChange={(e) => {
                      setAgents(prev => prev.map(agent => agent.id === selectedAgent.id ? { ...agent, name: e.target.value } : agent));
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('fileName')}</label>
                  <input
                    value={selectedAgent.fileName}
                    onChange={(e) => {
                      updateAgentFileName(selectedAgent.id, e.target.value);
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('agentDescription')}</label>
                  <input
                    value={selectedAgent.description}
                    onChange={(e) => {
                      setAgents(prev => prev.map(agent => agent.id === selectedAgent.id ? { ...agent, description: e.target.value } : agent));
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('agentPrompt')}</label>
                  <textarea
                    value={selectedAgent.prompt}
                    onChange={(e) => {
                      setAgents(prev => prev.map(agent => agent.id === selectedAgent.id ? { ...agent, prompt: e.target.value } : agent));
                    }}
                    className="w-full h-64 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                {selectedAgent.fileName === mainAgentFile && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">{t('assignedSubAgents')}</label>
                      <div className="flex flex-col gap-2 max-h-40 overflow-y-auto border border-gray-700 rounded-md p-2">
                        {agents
                          .filter(agent => agent.fileName && agent.fileName !== mainAgentFile)
                          .map(agent => {
                            const file = agent.fileName;
                            const checked = mainAgentSubAgents.includes(file);
                            return (
                              <label key={agent.id} className="flex items-center gap-2 text-xs text-gray-300">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    setMainAgentSubAgents(prev => {
                                      if (e.target.checked) return [...new Set([...prev, file])];
                                      return prev.filter(name => name !== file);
                                    });
                                  }}
                                />
                                {agent.name || file}
                              </label>
                            );
                          })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">{t('assignSkills')}</label>
                      <div className="flex flex-col gap-2">
                        {skills.map(skill => {
                          const file = skill.fileName;
                          const selected = agentSkills[mainAgentFile || ''] || [];
                          const checked = selected.includes(file);
                          return (
                            <label key={skill.id} className="flex items-center gap-2 text-xs text-gray-300">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  setAgentSkills(prev => {
                                    const key = mainAgentFile || '';
                                    const current = prev[key] || [];
                                    const next = e.target.checked
                                      ? [...new Set([...current, file])]
                                      : current.filter(name => name !== file);
                                    return { ...prev, [key]: next };
                                  });
                                }}
                              />
                              {skill.fileName || t('untitled')}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">{t('assignSteering')}</label>
                      <div className="flex flex-col gap-2">
                        {steering.map(item => {
                          const file = item.fileName;
                          const selected = agentSteering[mainAgentFile || ''] || [];
                          const checked = selected.includes(file);
                          return (
                            <label key={item.id} className="flex items-center gap-2 text-xs text-gray-300">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  setAgentSteering(prev => {
                                    const key = mainAgentFile || '';
                                    const current = prev[key] || [];
                                    const next = e.target.checked
                                      ? [...new Set([...current, file])]
                                      : current.filter(name => name !== file);
                                    return { ...prev, [key]: next };
                                  });
                                }}
                              />
                              {item.fileName || t('untitled')}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <svg className="w-20 h-20 mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11a4 4 0 10-8 0 4 4 0 008 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14a6 6 0 016 6H6a6 6 0 016-6z" />
                </svg>
                <h3 className="text-lg font-semibold mb-2">{t('noAgentSelectedTitle')}</h3>
                <p className="text-gray-600 text-sm">{t('noAgentSelectedBody')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'skills' && (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-56 border-r border-gray-700 overflow-y-auto">
            <div className="p-3">
              <button
                onClick={() => addFile('skills')}
                className="w-full px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-xs transition-colors"
              >
                {t('addFile')}
              </button>
            </div>
            {skills.map(file => (
              <div
                key={file.id}
                onClick={() => setSelectedSkillId(file.id)}
                className={`px-3 py-2 cursor-pointer text-xs border-t border-gray-700 ${
                  selectedSkillId === file.id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {file.fileName || t('untitled')}
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {selectedSkill ? (
              <div className="space-y-4 max-w-3xl">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('fileName')}</label>
                  <input
                    value={selectedSkill.fileName}
                    onChange={(e) => {
                      setSkills(prev => prev.map(file => file.id === selectedSkill.id ? { ...file, fileName: e.target.value } : file));
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('content')}</label>
                  <textarea
                    value={selectedSkill.content}
                    onChange={(e) => {
                      setSkills(prev => prev.map(file => file.id === selectedSkill.id ? { ...file, content: e.target.value } : file));
                    }}
                    className="w-full h-72 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={() => removeFile('skills', selectedSkill.id)}
                  className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-500 text-xs transition-colors"
                >
                  {t('delete')}
                </button>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <svg className="w-20 h-20 mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h18M3 12h18M3 17h18" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 3h10v4H7z" />
                </svg>
                <h3 className="text-lg font-semibold mb-2">{t('noFileSelectedTitle')}</h3>
                <p className="text-gray-600 text-sm">{t('noFileSelectedBody')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'steering' && (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-56 border-r border-gray-700 overflow-y-auto">
            <div className="p-3">
              <button
                onClick={() => addFile('steering')}
                className="w-full px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-xs transition-colors"
              >
                {t('addFile')}
              </button>
            </div>
            {steering.map(file => (
              <div
                key={file.id}
                onClick={() => setSelectedSteeringId(file.id)}
                className={`px-3 py-2 cursor-pointer text-xs border-t border-gray-700 ${
                  selectedSteeringId === file.id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {file.fileName || t('untitled')}
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {selectedSteering ? (
              <div className="space-y-4 max-w-3xl">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('fileName')}</label>
                  <input
                    value={selectedSteering.fileName}
                    onChange={(e) => {
                      setSteering(prev => prev.map(file => file.id === selectedSteering.id ? { ...file, fileName: e.target.value } : file));
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('content')}</label>
                  <textarea
                    value={selectedSteering.content}
                    onChange={(e) => {
                      setSteering(prev => prev.map(file => file.id === selectedSteering.id ? { ...file, content: e.target.value } : file));
                    }}
                    className="w-full h-72 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={() => removeFile('steering', selectedSteering.id)}
                  className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-500 text-xs transition-colors"
                >
                  {t('delete')}
                </button>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <svg className="w-20 h-20 mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7h16M4 12h10M4 17h6" />
                  <circle cx="18" cy="12" r="3" strokeWidth={1.5} />
                </svg>
                <h3 className="text-lg font-semibold mb-2">{t('noFileSelectedTitle')}</h3>
                <p className="text-gray-600 text-sm">{t('noFileSelectedBody')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'sub-agents' && (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-56 border-r border-gray-700 overflow-y-auto">
            <div className="p-3">
              <button
                onClick={addAgent}
                className="w-full px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-xs transition-colors"
              >
                {t('addAgent')}
              </button>
            </div>
            {agents
              .filter(agent => agent.fileName !== mainAgentFile)
              .map(agent => (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={`px-3 py-2 cursor-pointer text-xs border-t border-gray-700 ${
                    selectedAgentId === agent.id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {agent.name || t('untitled')}
                </div>
              ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {selectedSubAgentFile && selectedAgent ? (
              <div className="space-y-4 max-w-3xl">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('agentName')}</label>
                  <input
                    value={selectedAgent.name}
                    onChange={(e) => {
                      setAgents(prev => prev.map(agent => agent.id === selectedAgent.id ? { ...agent, name: e.target.value } : agent));
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('fileName')}</label>
                  <input
                    value={selectedAgent.fileName}
                    onChange={(e) => {
                      updateAgentFileName(selectedAgent.id, e.target.value);
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('agentDescription')}</label>
                  <input
                    value={selectedAgent.description}
                    onChange={(e) => {
                      setAgents(prev => prev.map(agent => agent.id === selectedAgent.id ? { ...agent, description: e.target.value } : agent));
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('agentPrompt')}</label>
                  <textarea
                    value={selectedAgent.prompt}
                    onChange={(e) => {
                      setAgents(prev => prev.map(agent => agent.id === selectedAgent.id ? { ...agent, prompt: e.target.value } : agent));
                    }}
                    className="w-full h-64 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('assignSkills')}</label>
                  <div className="flex flex-col gap-2">
                    {skills.map(skill => {
                      const file = skill.fileName;
                      const selected = agentSkills[selectedSubAgentFile] || [];
                      const checked = selected.includes(file);
                      return (
                        <label key={skill.id} className="flex items-center gap-2 text-xs text-gray-300">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setAgentSkills(prev => {
                                const current = prev[selectedSubAgentFile] || [];
                                const next = e.target.checked
                                  ? [...new Set([...current, file])]
                                  : current.filter(name => name !== file);
                                return { ...prev, [selectedSubAgentFile]: next };
                              });
                            }}
                          />
                          {skill.fileName || t('untitled')}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('assignSteering')}</label>
                  <div className="flex flex-col gap-2">
                    {steering.map(item => {
                      const file = item.fileName;
                      const selected = agentSteering[selectedSubAgentFile] || [];
                      const checked = selected.includes(file);
                      return (
                        <label key={item.id} className="flex items-center gap-2 text-xs text-gray-300">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setAgentSteering(prev => {
                                const current = prev[selectedSubAgentFile] || [];
                                const next = e.target.checked
                                  ? [...new Set([...current, file])]
                                  : current.filter(name => name !== file);
                                return { ...prev, [selectedSubAgentFile]: next };
                              });
                            }}
                          />
                          {item.fileName || t('untitled')}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <button
                  onClick={() => removeAgent(selectedAgent.id)}
                  className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-500 text-xs transition-colors"
                >
                  {t('delete')}
                </button>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <svg className="w-20 h-20 mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6a3 3 0 100 6 3 3 0 000-6z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 20a6 6 0 0112 0" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 8h2M20 7v2" />
                </svg>
                <h3 className="text-lg font-semibold mb-2">{t('noAgentSelectedTitle')}</h3>
                <p className="text-gray-600 text-sm">{t('noAgentSelectedBody')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showUnsavedConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowUnsavedConfirm(false)}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">{t('unsavedTitle')}</h3>
            <p className="text-gray-400 mb-6">{t('unsavedBody')}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowUnsavedConfirm(false);
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors text-sm"
              >
                {t('cancel')}
              </button>
              <button
                onClick={async () => {
                  setShowUnsavedConfirm(false);
                  await handleSaveAll();
                  onClose();
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md transition-colors text-sm"
              >
                {t('saveChanges')}
              </button>
              <button
                onClick={() => {
                  setShowUnsavedConfirm(false);
                  onClose();
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-md transition-colors text-sm"
              >
                {t('discardChanges')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectSettings;
