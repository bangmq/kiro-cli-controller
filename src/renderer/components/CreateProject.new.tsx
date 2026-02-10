import React, { useState } from 'react';
import { useI18n } from '../../shared/lib/i18n-context';

interface Props {
  onCancel: () => void;
  onCreate: (name: string, path: string, type: 'maintenance' | 'new-development') => void;
}

const CreateProject: React.FC<Props> = ({ onCancel, onCreate }) => {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [type, setType] = useState<'maintenance' | 'new-development'>('maintenance');

  const handleBrowse = async () => {
    const selectedPath = await window.electronAPI.selectFolder();
    if (selectedPath) setPath(selectedPath);
  };

  const handleSubmit = () => {
    if (name && path) {
      onCreate(name, path, type);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-5 py-3 border-b border-gray-700 bg-gray-800/50 backdrop-blur">
        <h3 className="text-base font-semibold">{t('createProject')}</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-2xl space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">{t('projectName')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('projectNamePlaceholder')}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t('projectPath')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder={t('selectFolder')}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleBrowse}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors text-sm"
              >
                {t('browse')}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t('projectType')}</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setType('maintenance')}
                className={`p-3 rounded-md border-2 transition-all ${
                  type === 'maintenance'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="text-sm font-medium">{t('maintenanceMode')}</div>
              </button>
              <button
                onClick={() => setType('new-development')}
                className={`p-3 rounded-md border-2 transition-all ${
                  type === 'new-development'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="text-sm font-medium">{t('newDevelopmentMode')}</div>
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleSubmit}
              disabled={!name || !path}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors text-sm"
            >
              {t('create')}
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors text-sm"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateProject;
