
import React, { useState, useEffect } from 'react';
import { AIConfig, AIProvider } from '../types';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AIConfig;
  onSave: (config: AIConfig) => void;
}

const PROVIDERS: { id: AIProvider; name: string; defaultUrl: string; defaultModel: string }[] = [
  { id: 'gemini', name: 'Google Gemini', defaultUrl: '', defaultModel: 'gemini-2.0-flash' },
  { id: 'deepseek', name: 'DeepSeek', defaultUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-chat' },
  { id: 'grok', name: 'xAI Grok', defaultUrl: 'https://api.x.ai/v1', defaultModel: 'grok-beta' },
  { id: 'openai', name: 'OpenAI GPT', defaultUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  { id: 'custom', name: '自定义 (Custom)', defaultUrl: '', defaultModel: '' },
];

const AISettingsModal: React.FC<AISettingsModalProps> = ({ isOpen, onClose, config, onSave }) => {
  const [localConfig, setLocalConfig] = useState<AIConfig>(config);

  useEffect(() => {
    if (isOpen) {
      setLocalConfig(config);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleProviderChange = (provider: AIProvider) => {
    const defaults = PROVIDERS.find(p => p.id === provider);
    setLocalConfig(prev => ({
      ...prev,
      provider,
      baseUrl: defaults?.defaultUrl || prev.baseUrl,
      model: defaults?.defaultModel || prev.model
    }));
  };

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            AI 配置
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">AI 提供商 (Provider)</label>
            <select
              value={localConfig.provider}
              onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
            >
              {PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">API Key</label>
            <input
              type="password"
              value={localConfig.apiKey}
              onChange={(e) => setLocalConfig({...localConfig, apiKey: e.target.value})}
              placeholder="sk-..."
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none placeholder:text-slate-600"
            />
            <p className="text-[10px] text-slate-500 mt-1">Key 仅保存在本地浏览器缓存中</p>
          </div>

          {localConfig.provider !== 'gemini' && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Base URL</label>
              <input
                type="text"
                value={localConfig.baseUrl}
                onChange={(e) => setLocalConfig({...localConfig, baseUrl: e.target.value})}
                placeholder="https://api.example.com/v1"
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">模型名称 (Model)</label>
            <input
              type="text"
              value={localConfig.model}
              onChange={(e) => setLocalConfig({...localConfig, model: e.target.value})}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
          >
            取消
          </button>
          <button 
            onClick={() => onSave(localConfig)}
            className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white font-medium rounded shadow-lg shadow-purple-900/20 transition-all"
          >
            保存配置
          </button>
        </div>
      </div>
    </div>
  );
};

export default AISettingsModal;
