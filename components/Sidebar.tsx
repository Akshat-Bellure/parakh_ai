import React from 'react';
import { AppMode } from '../types';
import { MessageSquare, Image as ImageIcon, Video, Mic, Sparkles } from 'lucide-react';

interface SidebarProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentMode, onModeChange }) => {
  const navItems = [
    { mode: AppMode.CHAT, icon: MessageSquare, label: 'Chat' },
    { mode: AppMode.IMAGE, icon: ImageIcon, label: 'Image' },
    { mode: AppMode.VIDEO, icon: Video, label: 'Video' },
    { mode: AppMode.LIVE, icon: Mic, label: 'Live' },
  ];

  return (
    <div className="w-20 md:w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full shrink-0 transition-all duration-300">
      <div className="p-6 flex items-center gap-3 text-indigo-400">
        <Sparkles className="w-8 h-8" />
        <span className="font-bold text-xl hidden md:block text-zinc-100">Gemini</span>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2">
        {navItems.map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            onClick={() => onModeChange(mode)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
              currentMode === mode
                ? 'bg-indigo-600/10 text-indigo-400'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
            }`}
          >
            <Icon className={`w-5 h-5 ${currentMode === mode ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
            <span className="hidden md:block font-medium">{label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <div className="text-xs text-zinc-500 text-center md:text-left px-2">
          <span className="hidden md:inline">Powered by Google Gemini</span>
          <span className="md:hidden">Gemini</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;