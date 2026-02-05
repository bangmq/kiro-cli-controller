import React from 'react';

interface Project {
  id: string;
  name: string;
  type: 'maintenance' | 'new-development';
}

interface Props {
  tabs: Project[];
  activeTabId: string | null;
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
  onDragStart: (id: string) => void;
}

const TabBar: React.FC<Props> = ({ tabs, activeTabId, onTabClick, onTabClose, onDragStart }) => {
  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-gray-800 border-b border-gray-700 overflow-x-auto">
      {tabs.map(tab => (
        <div
          key={tab.id}
          draggable
          onDragStart={() => onDragStart(tab.id)}
          onClick={() => onTabClick(tab.id)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
            activeTabId === tab.id ? 'bg-gray-700' : 'bg-gray-750 hover:bg-gray-700'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${tab.type === 'maintenance' ? 'bg-orange-400' : 'bg-green-400'}`} />
          <span className="text-sm font-medium truncate max-w-[120px]">{tab.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(tab.id);
            }}
            className="ml-1 text-gray-500 hover:text-gray-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
};

export default TabBar;
