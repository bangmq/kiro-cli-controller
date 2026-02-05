import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useI18n, useConversation } from '../app';

interface Project {
  id: string;
  name: string;
  path: string;
  type: 'maintenance' | 'new-development';
  mainAgent: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  project: Project;
}

const ChatInterface: React.FC<Props> = ({ project }) => {
  const { t } = useI18n();
  const { getConversation, setConversation, isLoading, setLoading } = useConversation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const handlersRegistered = useRef(false);
  const currentProjectId = useRef(project.id);

  // 프로젝트 변경 시 해당 프로젝트의 대화 내역 불러오기
  useEffect(() => {
    currentProjectId.current = project.id;
    const savedMessages = getConversation(project.id);
    setMessages(savedMessages);
  }, [project.id]);

  // 메시지 변경 시 현재 프로젝트의 대화 내역 저장
  useEffect(() => {
    setConversation(project.id, messages);
  }, [messages, project.id]);

  // IPC 리스너는 한 번만 등록
  useEffect(() => {
    if (handlersRegistered.current) return;
    handlersRegistered.current = true;

    const handleOutput = (projectId: string, data: string) => {
      console.log(`[Renderer] Received output for ${projectId}:`, data.substring(0, 50));
      
      setConversation(projectId, (prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [...prev.slice(0, -1), { ...last, content: last.content + data }];
        }
        return [...prev, { role: 'assistant', content: data }];
      });
      
      // 현재 보고 있는 프로젝트면 로컬 상태도 업데이트
      if (projectId === currentProjectId.current) {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: last.content + data }];
          }
          return [...prev, { role: 'assistant', content: data }];
        });
      }
      
      setLoading(projectId, false);
    };

    const handleError = (projectId: string, error: string) => {
      console.log(`[Renderer] Received error for ${projectId}:`, error);
      
      setConversation(projectId, (prev) => [...prev, { role: 'assistant', content: `Error: ${error}` }]);
      
      if (projectId === currentProjectId.current) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error}` }]);
      }
      
      setLoading(projectId, false);
    };

    console.log(`[Renderer] Setting up listeners (once)`);
    window.electronAPI.onCliOutput(handleOutput);
    window.electronAPI.onCliError(handleError);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const messageToSend = input;
    const projectToSend = project.id;
    
    setMessages(prev => [...prev, { role: 'user', content: messageToSend }]);
    setLoading(projectToSend, true);
    setInput('');
    
    await window.electronAPI.sendMessage(projectToSend, project.path, project.mainAgent, messageToSend);
  };

  const currentIsLoading = isLoading(project.id);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-800 text-gray-100'
            }`}>
              <div className="message-content">
                {msg.role === 'assistant' ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          </div>
        ))}
        {currentIsLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl px-4 py-3">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t border-gray-700 bg-gray-800/50 backdrop-blur">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={t('typeMessage')}
            disabled={currentIsLoading}
            className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 transition-all"
          />
          <button 
            onClick={handleSend} 
            disabled={currentIsLoading || !input.trim()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
          >
            {t('send')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
