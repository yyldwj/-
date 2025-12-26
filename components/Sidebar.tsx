
import React from 'react';
import { Parity, StopBits, DataBits, FlowControl, SerialConfig } from '../types';

interface SidebarProps {
  config: SerialConfig;
  dtr: boolean;
  rts: boolean;
  onConfigChange: (config: SerialConfig) => void;
  onSignalChange: (signal: 'dtr' | 'rts', value: boolean) => void;
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onSaveLogs: () => void;
  onClearLogs: () => void;
  rxCount: number;
  txCount: number;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  config, 
  dtr, 
  rts,
  onConfigChange, 
  onSignalChange,
  isConnected, 
  onConnect, 
  onDisconnect,
  onSaveLogs,
  onClearLogs,
  rxCount,
  txCount
}) => {
  const handleChange = (key: keyof SerialConfig, value: string | number) => {
    onConfigChange({ ...config, [key]: value });
  };

  const baudRates = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];

  return (
    <div className="w-72 bg-slate-900 border-r border-slate-700 flex flex-col h-full overflow-y-auto p-4 space-y-6 shrink-0">
      {/* Header */}
      <div className="flex items-center space-x-2 mb-2">
        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shadow-lg shadow-blue-500/20">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">串口助手</h1>
          <div className="text-[10px] text-slate-400 font-mono">Web Serial v1.1</div>
        </div>
      </div>

      {/* Port Configuration */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center">
          <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
          端口设置 (Settings)
        </h2>
        
        <div className="space-y-3 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
          <div className="grid grid-cols-3 items-center gap-2">
            <span className="text-xs text-slate-300">波特率</span>
            <div className="col-span-2 relative">
              <input
                type="number"
                list="baudRates"
                disabled={isConnected}
                value={config.baudRate}
                onChange={(e) => handleChange('baudRate', parseInt(e.target.value) || 115200)}
                className="block w-full rounded bg-slate-800 border-slate-600 text-xs py-1 px-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              />
              <datalist id="baudRates">
                {baudRates.map(br => <option key={br} value={br} />)}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-3 items-center gap-2">
            <span className="text-xs text-slate-300">数据位</span>
            <select 
              disabled={isConnected}
              value={config.dataBits}
              onChange={(e) => handleChange('dataBits', parseInt(e.target.value))}
              className="col-span-2 block w-full rounded bg-slate-800 border-slate-600 text-xs py-1 px-2 disabled:opacity-50"
            >
              <option value={DataBits.Seven}>7 bit</option>
              <option value={DataBits.Eight}>8 bit</option>
            </select>
          </div>

          <div className="grid grid-cols-3 items-center gap-2">
            <span className="text-xs text-slate-300">校验位</span>
            <select 
              disabled={isConnected}
              value={config.parity}
              onChange={(e) => handleChange('parity', e.target.value)}
              className="col-span-2 block w-full rounded bg-slate-800 border-slate-600 text-xs py-1 px-2 disabled:opacity-50"
            >
              <option value={Parity.None}>None</option>
              <option value={Parity.Even}>Even</option>
              <option value={Parity.Odd}>Odd</option>
            </select>
          </div>

          <div className="grid grid-cols-3 items-center gap-2">
            <span className="text-xs text-slate-300">停止位</span>
            <select 
              disabled={isConnected}
              value={config.stopBits}
              onChange={(e) => handleChange('stopBits', parseInt(e.target.value))}
              className="col-span-2 block w-full rounded bg-slate-800 border-slate-600 text-xs py-1 px-2 disabled:opacity-50"
            >
              <option value={StopBits.One}>1 bit</option>
              <option value={StopBits.Two}>2 bit</option>
            </select>
          </div>

          <div className="grid grid-cols-3 items-center gap-2">
            <span className="text-xs text-slate-300">流  控</span>
            <select 
              disabled={isConnected}
              value={config.flowControl}
              onChange={(e) => handleChange('flowControl', e.target.value)}
              className="col-span-2 block w-full rounded bg-slate-800 border-slate-600 text-xs py-1 px-2 disabled:opacity-50"
            >
              <option value={FlowControl.None}>None</option>
              <option value={FlowControl.Hardware}>RTS/CTS</option>
            </select>
          </div>
        </div>
      </div>

      {/* Connection Button */}
      <div>
        {!isConnected ? (
          <button
            onClick={onConnect}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-lg transition-all flex items-center justify-center space-x-2 shadow-lg shadow-emerald-900/20 active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>打开串口 (Open)</span>
          </button>
        ) : (
          <button
            onClick={onDisconnect}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 px-4 rounded-lg transition-all flex items-center justify-center space-x-2 shadow-lg shadow-red-900/20 active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>关闭串口 (Close)</span>
          </button>
        )}
      </div>

      {/* Signal Control */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">信号控制 (Signals)</h2>
        <div className="grid grid-cols-2 gap-3">
           <label className={`flex items-center justify-center p-2 rounded border cursor-pointer transition-all ${dtr ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400'} ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}>
             <input 
               type="checkbox" 
               checked={dtr}
               disabled={!isConnected}
               onChange={(e) => onSignalChange('dtr', e.target.checked)}
               className="hidden" 
             />
             <span className="text-xs font-bold">DTR</span>
             <span className={`ml-2 w-2 h-2 rounded-full ${dtr ? 'bg-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.8)]' : 'bg-slate-600'}`}></span>
           </label>
           
           <label className={`flex items-center justify-center p-2 rounded border cursor-pointer transition-all ${rts ? 'bg-green-600/20 border-green-500 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-400'} ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}>
             <input 
               type="checkbox" 
               checked={rts}
               disabled={!isConnected}
               onChange={(e) => onSignalChange('rts', e.target.checked)}
               className="hidden" 
             />
             <span className="text-xs font-bold">RTS</span>
             <span className={`ml-2 w-2 h-2 rounded-full ${rts ? 'bg-green-400 shadow-[0_0_5px_rgba(74,222,128,0.8)]' : 'bg-slate-600'}`}></span>
           </label>
        </div>
      </div>

      {/* Statistics */}
      <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 space-y-2 mt-auto">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">接收 (RX):</span>
          <span className="font-mono text-emerald-400">{rxCount} Bytes</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">发送 (TX):</span>
          <span className="font-mono text-blue-400">{txCount} Bytes</span>
        </div>
      </div>

      {/* Tools */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
        <button 
          onClick={onSaveLogs}
          className="flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 rounded text-xs text-slate-300 transition-colors"
        >
          <svg className="w-4 h-4 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
          保存日志
        </button>
        <button 
          onClick={onClearLogs}
          className="flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 rounded text-xs text-slate-300 transition-colors"
        >
          <svg className="w-4 h-4 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          清空窗口
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
