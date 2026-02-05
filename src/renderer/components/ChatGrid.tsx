import React, { useState } from 'react';
import ChatInterface from './ChatInterface';

interface Project {
  id: string;
  name: string;
  path: string;
  type: 'maintenance' | 'new-development';
  mainAgent: string;
  lastAccess: string;
}

interface GridCell {
  projects: Project[];
  activeProjectId: string | null;
}

interface Props {
  gridCells: GridCell[];
  isDragging: boolean;
  draggedTabId: string | null;
  draggedFromGrid: number | null;
  onDrop: (gridIndex: number) => void;
  onClose: (gridIndex: number) => void;
  onTabClose: (gridIndex: number, projectId: string) => void;
  onTabSelect: (gridIndex: number, projectId: string) => void;
  onTabDragStart: (gridIndex: number, projectId: string) => void;
}

const ChatGrid: React.FC<Props> = ({ 
  gridCells, 
  isDragging, 
  draggedTabId, 
  draggedFromGrid,
  onDrop, 
  onClose, 
  onTabClose,
  onTabSelect,
  onTabDragStart
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const activeCount = gridCells.filter(cell => cell.projects.length > 0).length;
  
  const getGridClass = () => {
    if (activeCount === 0) return 'grid-cols-1';
    if (activeCount === 1) return 'grid-cols-1';
    if (activeCount === 2) return 'grid-cols-2';
    if (activeCount === 3) return 'grid-cols-2';
    return 'grid-cols-2 grid-rows-2';
  };

  const getDropZones = () => {
    const currentGridIndex = draggedFromGrid;
    
    // 0개: 좌/우 2개
    if (activeCount === 0) {
      return [
        { index: 0, style: 'left-0 top-0 w-1/2 h-full', label: '왼쪽' },
        { index: 1, style: 'right-0 top-0 w-1/2 h-full', label: '오른쪽' }
      ];
    }
    
    // 1개 화면
    if (activeCount === 1) {
      const occupied = gridCells.findIndex(cell => cell.projects.length > 0);
      
      if (currentGridIndex === occupied) {
        // 같은 그리드에서 드래그: 반대쪽만
        const otherIndex = occupied === 0 ? 1 : 0;
        return [
          { index: otherIndex, style: otherIndex === 0 ? 'left-0 top-0 w-1/2 h-full' : 'right-0 top-0 w-1/2 h-full', label: otherIndex === 0 ? '왼쪽' : '오른쪽' }
        ];
      } else {
        // 다른 그리드에서 드래그: 좌/우 2개
        return [
          { index: 0, style: 'left-0 top-0 w-1/2 h-full', label: '왼쪽' },
          { index: 1, style: 'right-0 top-0 w-1/2 h-full', label: '오른쪽' }
        ];
      }
    }
    
    // 2개 이상: 모든 그리드 표시
    return gridCells.map((cell, i) => ({
      index: i,
      style: i === 0 ? 'left-0 top-0 w-1/2 h-1/2' : 
             i === 1 ? 'right-0 top-0 w-1/2 h-1/2' : 
             i === 2 ? 'left-0 bottom-0 w-1/2 h-1/2' : 
             'right-0 bottom-0 w-1/2 h-1/2',
      label: `영역 ${i + 1}`
    }));
  };

  if (!isDragging && activeCount === 0) {
    return null;
  }

  return (
    <div className="relative h-full">
      {/* 실제 채팅 화면 */}
      {!isDragging && activeCount > 0 && (
        <div className={`grid ${getGridClass()} gap-1 h-full bg-gray-900`}>
          {gridCells.map((cell, index) => 
            cell.projects.length > 0 ? (
              <div key={index} className="relative flex flex-col border border-gray-700 rounded-lg overflow-hidden bg-gray-800">
                {/* 탭 바 */}
                <div className="flex items-center gap-1 px-2 py-1 bg-gray-800 border-b border-gray-700 overflow-x-auto">
                  {cell.projects.map(project => (
                    <div
                      key={project.id}
                      draggable
                      onDragStart={() => onTabDragStart(index, project.id)}
                      onClick={() => onTabSelect(index, project.id)}
                      className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                        cell.activeProjectId === project.id ? 'bg-gray-700' : 'bg-gray-750 hover:bg-gray-700'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${project.type === 'maintenance' ? 'bg-orange-400' : 'bg-green-400'}`} />
                      <span className="truncate max-w-[80px]">{project.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTabClose(index, project.id);
                        }}
                        className="text-gray-500 hover:text-gray-300"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                
                {/* 채팅 영역 */}
                <div className="flex-1 overflow-hidden">
                  {cell.activeProjectId && cell.projects.find(p => p.id === cell.activeProjectId) && (
                    <ChatInterface project={cell.projects.find(p => p.id === cell.activeProjectId)!} />
                  )}
                </div>
                
                {/* 그리드 닫기 버튼 */}
                <button
                  onClick={() => onClose(index)}
                  className="absolute top-1 right-1 z-10 p-1 bg-gray-900/80 hover:bg-red-600 rounded transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : null
          )}
        </div>
      )}
      
      {/* 드래그 중 그리드 오버레이 */}
      {isDragging && (
        <div className="absolute inset-0 bg-gray-900/95 z-50">
          {getDropZones().map((zone) => (
            <div
              key={zone.index}
              onDragOver={(e) => {
                e.preventDefault();
                setHoverIndex(zone.index);
              }}
              onDragLeave={() => setHoverIndex(null)}
              onDrop={() => {
                onDrop(zone.index);
                setHoverIndex(null);
              }}
              className={`absolute ${zone.style} border-2 border-dashed flex items-center justify-center transition-all ${
                hoverIndex === zone.index 
                  ? 'border-blue-500 bg-blue-500/20' 
                  : 'border-gray-600 bg-gray-800/30'
              }`}
            >
              <div className="text-center text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm font-medium">{zone.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatGrid;
