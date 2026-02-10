import React from 'react';

interface TitleBarProps {
  isMac: boolean;
}

export const TitleBar: React.FC<TitleBarProps> = ({ isMac }) => {
  return (
    <div className="h-7 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-3 select-none" style={{WebkitAppRegion: 'drag'} as any}>
      <div className={`flex items-center gap-2 ${isMac ? 'pl-14' : ''}`}>
        <span className="text-xs font-semibold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          KiroDesk
        </span>
      </div>
      {!isMac && (
        <div className="flex items-center gap-1" style={{WebkitAppRegion: 'no-drag'} as any}>
          <button
            onClick={() => window.electronAPI.windowMinimize()}
            className="w-10 h-7 flex items-center justify-center hover:bg-gray-700 transition-colors"
            title="Minimize"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12">
              <rect x="0" y="5" width="10" height="1" />
            </svg>
          </button>
          <button
            onClick={() => window.electronAPI.windowMaximize()}
            className="w-10 h-7 flex items-center justify-center hover:bg-gray-700 transition-colors"
            title="Maximize"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 10 10">
              <rect x="0" y="0" width="10" height="10" />
            </svg>
          </button>
          <button
            onClick={() => window.electronAPI.windowClose()}
            className="w-10 h-7 flex items-center justify-center hover:bg-red-600 transition-colors"
            title="Close"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12">
              <polygon points="11,1.576 10.424,1 6,5.424 1.576,1 1,1.576 5.424,6 1,10.424 1.576,11 6,6.576 10.424,11 11,10.424 6.576,6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
