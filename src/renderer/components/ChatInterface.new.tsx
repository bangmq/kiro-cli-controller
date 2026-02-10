import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useI18n } from '../../shared/lib/i18n-context';
import { useConversation } from '../../entities/chat/model/conversation-context';
import { Project, Message } from '../../shared/types/project';

interface Props {
  project: Project;
}

const ChatInterface: React.FC<Props> = ({ project }) => {
  const { t } = useI18n();
  const { getConversation, setConversation, isLoading, setLoading } = useConversation();
  const [input, setInput] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messages = getConversation(project.id);
  const loading = isLoading(project.id);

  useEffect(() => {
    const initSession = async () => {
      await window.electronAPI.initSession(project.id, project.path, project.mainAgent);
      setSessionReady(true);
    };
    initSession();

    const handleOutput = (_: any, projectId: string, data: string) => {
      if (projectId === project.id) {
        setConversation(project.id, (prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === 'assistant') {
            return [...prev.slice(0, -1), { role: 'assistant', content: lastMsg.content + data }];
          }
          return [...prev, { role: 'assistant', content: data }];
        });
      }
    };

    const handleError = (_: any, projectId: string, error: string) => {
      if (projectId === project.id) {
        setConversation(project.id, (prev) => [...prev, { role: 'assistant', content: `Error: ${error}` }]);
        setLoading(project.id, false);
      }
    };

    const handleDone = (_: any, projectId: string) => {
      if (projectId === project.id) {
        setLoading(project.id, false);
      }
    };

    window.electronAPI.onCliOutput(handleOutput);
    window.electronAPI.onCliError(handleError);
    window.electronAPI.onCliDone(handleDone);
  }, [project.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading || !sessionReady) return;

    const userMessage = input.trim();
    setInput('');
    setConversation(project.id, (prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(project.id, true);

    await window.electronAPI.sendMessage(project.id, project.path, project.mainAgent, userMessage);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-3 border-b border-gray-700 bg-gray-800/50 backdrop-blur">
        <h3 className="text-base font-semibold">{project.name}</h3>
        <p className="text-xs text-gray-400">{project.mainAgent}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-800 text-gray-100'
            }`}>
              <ReactMarkdown className="prose prose-invert prose-sm max-w-none">
                {msg.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-lg px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder={t('typeMessage')}
            disabled={loading || !sessionReady}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={loading || !sessionReady || !input.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            {t('send')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
