export const translations = {
  ko: {
    // App
    appName: 'KiroDesk',
    newProject: '+ 새로 만들기',
    settings: '설정',
    welcome: 'KiroDesk에 오신 것을 환영합니다',
    welcomeDesc: '프로젝트를 선택하거나 새로 만들어 시작하세요',
    
    // Project List
    maintenance: '유지보수',
    newDevelopment: '신규 개발',
    
    // Create Project
    createProject: '새 프로젝트 만들기',
    projectName: '프로젝트 이름',
    projectPath: '프로젝트 경로',
    projectType: '프로젝트 유형',
    maintenanceMode: '유지보수 모드',
    newDevelopmentMode: '신규 개발 모드',
    browse: '찾아보기',
    cancel: '취소',
    create: '만들기',
    selectFolder: '폴더 선택...',
    projectNamePlaceholder: '멋진 프로젝트',
    
    // Chat
    typeMessage: '메시지를 입력하세요...',
    send: '전송',
    thinking: '생각 중...',
    
    // Settings
    settingsTitle: '설정',
    theme: '테마',
    dark: '다크',
    light: '라이트',
    language: '언어',
    korean: '한국어 (Korean)',
    english: 'English',
    about: '정보',
    version: '버전',
    platform: '플랫폼',
    description: '설명',
    appDescription: 'AWS kiro-cli GUI 오케스트레이터'
  },
  en: {
    // App
    appName: 'KiroDesk',
    newProject: '+ New',
    settings: 'Settings',
    welcome: 'Welcome to KiroDesk',
    welcomeDesc: 'Select a project or create a new one to get started',
    
    // Project List
    maintenance: 'Maintenance',
    newDevelopment: 'New Development',
    
    // Create Project
    createProject: 'Create New Project',
    projectName: 'Project Name',
    projectPath: 'Project Path',
    projectType: 'Project Type',
    maintenanceMode: 'Maintenance Mode',
    newDevelopmentMode: 'New Development',
    browse: 'Browse',
    cancel: 'Cancel',
    create: 'Create',
    selectFolder: 'Select folder...',
    projectNamePlaceholder: 'My Awesome Project',
    
    // Chat
    typeMessage: 'Type your message...',
    send: 'Send',
    thinking: 'Thinking...',
    
    // Settings
    settingsTitle: 'Settings',
    theme: 'Theme',
    dark: 'Dark',
    light: 'Light',
    language: 'Language',
    korean: '한국어 (Korean)',
    english: 'English',
    about: 'About',
    version: 'Version',
    platform: 'Platform',
    description: 'Description',
    appDescription: 'AWS kiro-cli GUI Orchestrator'
  }
};

export type Language = 'ko' | 'en';
export type TranslationKey = keyof typeof translations.ko;
