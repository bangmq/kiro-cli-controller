import React, { createContext, useContext, useRef, useState, ReactNode } from 'react';
import { Message } from '../types/project';

interface ConversationContextType {
  conversations: Map<string, Message[]>;
  loadingProjects: Set<string>;
  getConversation: (projectId: string) => Message[];
  setConversation: (projectId: string, updater: Message[] | ((prev: Message[]) => Message[])) => void;
  isLoading: (projectId: string) => boolean;
  setLoading: (projectId: string, loading: boolean) => void;
}

const ConversationContext = createContext<ConversationContextType>({
  conversations: new Map(),
  loadingProjects: new Set(),
  getConversation: () => [],
  setConversation: () => {},
  isLoading: () => false,
  setLoading: () => {}
});

export const useConversation = () => useContext(ConversationContext);

export const ConversationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const conversationsRef = useRef<Map<string, Message[]>>(new Map());
  const loadingProjectsRef = useRef<Set<string>>(new Set());
  const [, forceUpdate] = useState({});

  const getConversation = (projectId: string): Message[] => {
    return conversationsRef.current.get(projectId) || [];
  };

  const setConversation = (projectId: string, updater: Message[] | ((prev: Message[]) => Message[])) => {
    const currentMessages = conversationsRef.current.get(projectId) || [];
    const newMessages = typeof updater === 'function' ? updater(currentMessages) : updater;
    conversationsRef.current.set(projectId, newMessages);
    forceUpdate({});
  };

  const isLoading = (projectId: string): boolean => {
    return loadingProjectsRef.current.has(projectId);
  };

  const setLoading = (projectId: string, loading: boolean) => {
    if (loading) {
      loadingProjectsRef.current.add(projectId);
    } else {
      loadingProjectsRef.current.delete(projectId);
    }
    forceUpdate({});
  };

  return (
    <ConversationContext.Provider value={{
      conversations: conversationsRef.current,
      loadingProjects: loadingProjectsRef.current,
      getConversation,
      setConversation,
      isLoading,
      setLoading
    }}>
      {children}
    </ConversationContext.Provider>
  );
};
