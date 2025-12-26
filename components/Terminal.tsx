
import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface TerminalProps {
  logs: LogEntry[];
  isHexMode: boolean;
  autoScroll: boolean;
  showTimestamp: boolean;
  searchTerm?: string;
}

const Terminal: React.FC<TerminalProps> = ({ logs, isHexMode, autoScroll, showTimestamp, searchTerm }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour12: false }) + '.' + date.getMilliseconds().toString().padStart(3, '0');
  };

  // Basic syntax highlighting for common keywords
  const highlightContent = (content: string) => {
    if (isHexMode) return content;
    
    // Simple regex for keywords
    const keywords = [
      { regex: /\b(ERROR|FAIL|Exception)\b/gi, className: 'text-red-500 font-bold' },
      { regex: /\b(OK|SUCCESS)\b/gi, className: 'text-green-400 font-bold' },
      { regex: /\b(WARN|WARNING)\b/gi, className: 'text-yellow-400 font-bold' },
      { regex: /\b(AT\+[A-Z0-9]+)\b/gi, className: 'text-purple-400' }, // AT commands
    ];

    // If no keywords match and no search term, return plain string (handled by React as text node)
    // However, to inject spans, we need to split string. This is complex for a simple terminal.
    // For performance in a large list, we will keep it simple.
    
    // We will just do a simple search highlight if searchTerm exists, otherwise just return text
    // Integrating full syntax highlighting in a virtualized or large list in React without a library 
    // like Prism is tricky. Let's focus on the "Search Term" highlighting first as it's more dynamic.
    
    if (!searchTerm) return content;

    const parts = content.split(new RegExp(`(${searchTerm})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === searchTerm.toLowerCase() ? (
            <span key={i} className="bg-yellow-600/50 text-white rounded px-0.5">{part}</span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  return (
    <div 
      ref={scrollRef}
      className="flex-1 bg-[#0a0f1c] overflow-y-auto p-4 mono text-sm leading-relaxed scroll-smooth relative"
    >
      {logs.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700 select-none pointer-events-none">
          <svg className="w-20 h-20 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-lg font-medium">暂无数据</p>
          <p className="text-sm opacity-60 mt-1">请连接串口并开始通信</p>
        </div>
      )}
      {logs.map((log) => (
        <div 
          key={log.id} 
          className={`flex mb-1 whitespace-pre-wrap break-all font-mono text-[13px] ${
            log.type === 'rx' ? 'text-emerald-400' : 
            log.type === 'tx' ? 'text-blue-400' : 
            log.type === 'error' ? 'text-red-400 bg-red-900/10 py-0.5 rounded px-1' : 'text-slate-500 italic border-l-2 border-slate-700 pl-2'
          }`}
        >
          {showTimestamp && (
            <span className="text-slate-600 mr-3 shrink-0 select-none">[{formatTime(log.timestamp)}]</span>
          )}
          <span className="mr-2 shrink-0 font-bold opacity-70 select-none">
            {log.type === 'rx' ? '←' : log.type === 'tx' ? '→' : 'ℹ'}
          </span>
          <span className="flex-1 break-all">
            {highlightContent(isHexMode ? log.hex : log.data)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default Terminal;
