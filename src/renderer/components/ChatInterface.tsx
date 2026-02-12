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

  useEffect(() => {
    currentProjectId.current = project.id;
    setMessages(getConversation(project.id));
  }, [project.id]);

  useEffect(() => {
    setConversation(project.id, messages);
  }, [messages, project.id]);

  // IPC 리스너는 한 번만 등록
  useEffect(() => {
    if (handlersRegistered.current) return;
    handlersRegistered.current = true;

    window.electronAPI.onCliOutput((projectId: string, data: string) => {
      setConversation(projectId, (prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [...prev.slice(0, -1), { ...last, content: last.content + data }];
        }
        return [...prev, { role: 'assistant', content: data }];
      });

      if (projectId === currentProjectId.current) {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: last.content + data }];
          }
          return [...prev, { role: 'assistant', content: data }];
        });
      }
    });

    window.electronAPI.onCliError((projectId: string, error: string) => {
      setConversation(projectId, (prev) => [...prev, { role: 'assistant', content: `Error: ${error}` }]);
      if (projectId === currentProjectId.current) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error}` }]);
      }
      setLoading(projectId, false);
    });

    window.electronAPI.onCliDone((projectId: string) => {
      setLoading(projectId, false);
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const messageToSend = input;
    setMessages(prev => [...prev, { role: 'user', content: messageToSend }]);
    setLoading(project.id, true);
    setInput('');

    await window.electronAPI.sendMessage(project.id, project.path, project.mainAgent, messageToSend);
  };

  const currentIsLoading = isLoading(project.id);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-gray-700 bg-gray-800/50 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold truncate">{project.name}</div>
          <div className="text-xs text-gray-400">{project.mainAgent}</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
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
            <div className="bg-gray-800 rounded-xl px-3 py-2">
              <div className="flex space-x-2">
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-3 border-t border-gray-700 bg-gray-800/50 backdrop-blur">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={t('typeMessage')}
            disabled={currentIsLoading}
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 transition-all"
          />
          <button 
            onClick={handleSend} 
            disabled={currentIsLoading || !input.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
          >
            {t('send')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
