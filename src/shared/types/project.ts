export interface Project {
  id: string;
  name: string;
  path: string;
  type: 'maintenance' | 'new-development';
  mainAgent: string;
  lastAccess: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}
