import React, { useState } from 'react';
import { useI18n } from '../app';

interface Props {
  onCancel: () => void;
  onCreate: (name: string, path: string, type: 'maintenance' | 'new-development') => void;
}

const CreateProject: React.FC<Props> = ({ onCancel, onCreate }) => {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [type, setType] = useState<'maintenance' | 'new-development'>('maintenance');

  const handleSelectFolder = async () => {
    const selectedPath = await window.electronAPI.selectFolder();
    if (selectedPath) setPath(selectedPath);
  };

  const handleCreate = () => {
    if (name && path) {
      onCreate(name, path, type);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl p-8">
        <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          {t('createProject')}
        </h2>
        
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">{t('projectName')}</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder={t('projectNamePlaceholder')}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">{t('projectPath')}</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={path} 
                readOnly 
                placeholder={t('selectFolder')}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-gray-400"
              />
              <button 
                onClick={handleSelectFolder}
                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg font-medium transition-colors"
              >
                {t('browse')}
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">{t('projectType')}</label>
            <select 
              value={type} 
              onChange={(e) => setType(e.target.value as any)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="maintenance">{t('maintenanceMode')}</option>
              <option value="new-development">{t('newDevelopmentMode')}</option>
            </select>
          </div>
        </div>
        
        <div className="flex gap-3 mt-8">
          <button 
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
          >
            {t('cancel')}
          </button>
          <button 
            onClick={handleCreate} 
            disabled={!name || !path}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {t('create')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateProject;
