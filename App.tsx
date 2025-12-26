
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Terminal from './components/Terminal';
import AISettingsModal from './components/AISettingsModal';
import { analyzeLogs } from './services/geminiService';
import { 
  SerialConfig, 
  LogEntry, 
  SerialState, 
  DataBits, 
  Parity, 
  StopBits, 
  FlowControl,
  SerialPort,
  SendConfig,
  QuickCommand,
  AIConfig
} from './types';

// Helper: Convert Hex String to Uint8Array
const parseHexString = (str: string): Uint8Array | null => {
  const clean = str.replace(/[^0-9A-Fa-f]/g, '');
  if (clean.length === 0 || clean.length % 2 !== 0) return null;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
};

// Helper: Convert buffer to Hex string
const bufferToHex = (buffer: Uint8Array): string => {
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
};

const DEFAULT_QUICK_COMMANDS: QuickCommand[] = [
  { id: '1', label: 'AT Test', content: 'AT\r\n', isHex: false },
  { id: '2', label: 'Reset', content: 'RST', isHex: false },
  { id: '3', label: 'Ping', content: '01 03 00 00 00 01 84 0A', isHex: true },
  { id: '4', label: 'Version', content: 'AT+GMR\r\n', isHex: false },
];

const STORAGE_KEY = 'yyl_serial_config';

const App: React.FC = () => {
  // Load initial state from local storage
  const loadInitialState = (): Partial<SerialState> => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load config", e);
    }
    return {};
  };

  const savedState = loadInitialState();

  const [state, setState] = useState<SerialState>({
    isConnected: false,
    port: null,
    config: savedState.config || {
      baudRate: 115200,
      dataBits: DataBits.Eight,
      stopBits: StopBits.One,
      parity: Parity.None,
      bufferSize: 1024,
      flowControl: FlowControl.None
    },
    sendConfig: savedState.sendConfig || {
      isHex: false,
      addCRLF: false,
      autoRepeat: false,
      repeatInterval: 1000
    },
    logs: [],
    isHexMode: false,
    autoScroll: true,
    showTimestamp: true,
    dtr: false,
    rts: false,
    rxCount: 0,
    txCount: 0,
    aiConfig: savedState.aiConfig || {
      provider: 'gemini',
      apiKey: '',
      baseUrl: '',
      model: 'gemini-2.0-flash'
    },
    showAiSettings: false
  });

  const [inputBuffer, setInputBuffer] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);
  const [quickCommands, setQuickCommands] = useState<QuickCommand[]>(DEFAULT_QUICK_COMMANDS);
  
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter | null>(null);
  const keepReadingRef = useRef<boolean>(true);
  const autoSendTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence Effect
  useEffect(() => {
    const toSave = {
      config: state.config,
      sendConfig: state.sendConfig,
      aiConfig: state.aiConfig
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, [state.config, state.sendConfig, state.aiConfig]);

  const addLog = useCallback((type: LogEntry['type'], data: string, rawBytes?: Uint8Array) => {
    let hex = '';
    if (rawBytes) {
      hex = bufferToHex(rawBytes);
    } else {
      hex = Array.from(new TextEncoder().encode(data))
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');
    }

    const newEntry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
      type,
      data,
      hex
    };

    setState(prev => ({
      ...prev,
      logs: [...prev.logs.slice(-2000), newEntry], // Keep last 2000 entries
      rxCount: type === 'rx' ? prev.rxCount + (rawBytes ? rawBytes.length : data.length) : prev.rxCount,
      txCount: type === 'tx' ? prev.txCount + (rawBytes ? rawBytes.length : data.length) : prev.txCount
    }));
  }, []);

  // Hotplug Detection
  useEffect(() => {
    if (!('serial' in navigator)) return;

    const handleConnectEvent = () => {
       addLog('info', '检测到串口设备插入');
    };

    const handleDisconnectEvent = (e: Event) => {
       addLog('info', '检测到串口设备移除');
       // Web Serial API typically handles the 'close' promise rejection, 
       // but we should ensure UI state reflects disconnection.
       if (state.port === (e as any).target) {
          handleDisconnect();
       }
    };

    navigator.serial.addEventListener('connect', handleConnectEvent);
    navigator.serial.addEventListener('disconnect', handleDisconnectEvent);

    return () => {
      navigator.serial.removeEventListener('connect', handleConnectEvent);
      navigator.serial.removeEventListener('disconnect', handleDisconnectEvent);
    };
  }, [state.port, addLog]);


  const handleConnect = async () => {
    if (!('serial' in navigator)) {
      addLog('error', '当前浏览器不支持 Web Serial API，请使用 Chrome 或 Edge。');
      return;
    }

    try {
      const port = await navigator.serial.requestPort();
      await port.open({
        baudRate: state.config.baudRate,
        dataBits: state.config.dataBits,
        stopBits: state.config.stopBits,
        parity: state.config.parity,
        flowControl: state.config.flowControl,
        bufferSize: state.config.bufferSize
      });

      setState(prev => ({ ...prev, isConnected: true, port }));
      addLog('info', `串口已打开: ${state.config.baudRate} bps`);
      
      // Initialize signals
      await port.setSignals({ dataTerminalReady: false, requestToSend: false });

      readLoop(port);
    } catch (err) {
      console.error(err);
      addLog('error', `打开失败: ${(err as Error).message}`);
    }
  };

  const handleDisconnect = async () => {
    keepReadingRef.current = false;
    
    // Stop auto send if active
    if (autoSendTimerRef.current) {
      window.clearInterval(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
      setState(prev => ({ ...prev, sendConfig: { ...prev.sendConfig, autoRepeat: false } }));
    }

    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
      } catch (e) { /* ignore */ }
    }
    
    if (state.port) {
      try {
        await state.port.close();
      } catch (e) {
        console.error("Close error", e);
      }
    }
    setState(prev => ({ ...prev, isConnected: false, port: null }));
    addLog('info', '串口已关闭');
  };

  const readLoop = async (port: SerialPort) => {
    keepReadingRef.current = true;
    while (port.readable && keepReadingRef.current) {
      try {
        readerRef.current = port.readable.getReader();
        while (true) {
          const { value, done } = await readerRef.current.read();
          if (done) break;
          if (value) {
            // Keep raw data for Hex view, decode for ASCII view
            const text = new TextDecoder().decode(value); 
            addLog('rx', text, value);
          }
        }
      } catch (err) {
        if (keepReadingRef.current) {
           addLog('error', `读取错误: ${(err as Error).message}`);
        }
      } finally {
        if (readerRef.current) {
          readerRef.current.releaseLock();
        }
      }
    }
  };

  const sendData = async (content: string | Uint8Array, isHexInput: boolean = state.sendConfig.isHex) => {
    if (!state.port || !state.port.writable) {
        addLog('error', '串口未连接');
        return;
    }
    
    try {
      writerRef.current = state.port.writable.getWriter();
      let dataToSend: Uint8Array;
      let displayLog: string;

      if (content instanceof Uint8Array) {
        // Binary send (from file)
        dataToSend = content;
        displayLog = `[FILE] Sent ${content.length} bytes`;
      } else {
        // Text/Hex String send
        if (isHexInput) {
          const bytes = parseHexString(content);
          if (!bytes) {
             addLog('error', 'Hex 格式错误 (应为偶数位 0-9 A-F)');
             writerRef.current.releaseLock();
             return;
          }
          dataToSend = bytes;
          displayLog = `[HEX] ${bufferToHex(bytes)}`;
        } else {
          let textToSend = content;
          if (state.sendConfig.addCRLF && !textToSend.endsWith('\r\n')) {
            textToSend += '\r\n';
          }
          const encoder = new TextEncoder();
          dataToSend = encoder.encode(textToSend);
          displayLog = textToSend;
        }
      }

      await writerRef.current.write(dataToSend);
      addLog('tx', displayLog, dataToSend);
      
    } catch (err) {
      addLog('error', `发送错误: ${(err as Error).message}`);
    } finally {
      if (writerRef.current) {
        writerRef.current.releaseLock();
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result;
      if (arrayBuffer instanceof ArrayBuffer) {
        const uint8Array = new Uint8Array(arrayBuffer);
        sendData(uint8Array);
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input
    event.target.value = '';
  };

  const handleSignalChange = async (signal: 'dtr' | 'rts', value: boolean) => {
    if (!state.port || !state.isConnected) return;
    try {
      await state.port.setSignals({ 
        dataTerminalReady: signal === 'dtr' ? value : state.dtr,
        requestToSend: signal === 'rts' ? value : state.rts
      });
      setState(prev => ({ ...prev, [signal]: value }));
      addLog('info', `信号设置: ${signal.toUpperCase()} = ${value ? 'ON' : 'OFF'}`);
    } catch (e) {
      addLog('error', `无法设置信号: ${(e as Error).message}`);
    }
  };

  useEffect(() => {
    if (state.sendConfig.autoRepeat && state.isConnected && inputBuffer) {
      if (!autoSendTimerRef.current) {
        autoSendTimerRef.current = window.setInterval(() => {
          sendData(inputBuffer);
        }, Math.max(10, state.sendConfig.repeatInterval));
      }
    } else {
      if (autoSendTimerRef.current) {
        window.clearInterval(autoSendTimerRef.current);
        autoSendTimerRef.current = null;
      }
    }
    return () => {
      if (autoSendTimerRef.current) window.clearInterval(autoSendTimerRef.current);
    };
  }, [state.sendConfig.autoRepeat, state.sendConfig.repeatInterval, state.isConnected, inputBuffer, state.sendConfig.isHex, state.sendConfig.addCRLF]);

  const handleAiAnalysis = async () => {
    // If no API key configured, open settings
    if (!state.aiConfig.apiKey) {
      setState(prev => ({ ...prev, showAiSettings: true }));
      return;
    }

    if (state.logs.length === 0) return;
    setIsAiAnalyzing(true);
    
    // Prepare logs
    const combinedLogs = state.logs
      .slice(-100) // Analyze last 100 for speed
      .map(l => {
        const content = state.isHexMode ? l.hex : l.data.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
        return `${l.type.toUpperCase()}: ${content}`;
      })
      .join('\n');
    
    const result = await analyzeLogs(combinedLogs, state.aiConfig);
    setAiAnalysisResult(result);
    setIsAiAnalyzing(false);
  };

  const saveLogsToFile = () => {
    const content = state.logs.map(l => {
        const time = l.timestamp.toISOString();
        const dir = l.type === 'rx' ? '<<' : l.type === 'tx' ? '>>' : '##';
        const data = state.isHexMode ? l.hex : l.data;
        return `${time} ${dir} ${data}`;
    }).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `serial_log_${new Date().toISOString().replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter logs based on search term
  const filteredLogs = useMemo(() => {
    if (!searchTerm) return state.logs;
    const term = searchTerm.toLowerCase();
    return state.logs.filter(log => 
      (state.isHexMode ? log.hex : log.data).toLowerCase().includes(term)
    );
  }, [state.logs, searchTerm, state.isHexMode]);

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <Sidebar 
        config={state.config}
        dtr={state.dtr}
        rts={state.rts}
        rxCount={state.rxCount}
        txCount={state.txCount}
        onConfigChange={(config) => setState(prev => ({ ...prev, config }))}
        onSignalChange={handleSignalChange}
        isConnected={state.isConnected}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onSaveLogs={saveLogsToFile}
        onClearLogs={() => setState(prev => ({ ...prev, logs: [], rxCount: 0, txCount: 0 }))}
      />
      
      <main className="flex-1 flex flex-col relative min-w-0">
        {/* Toolbar */}
        <header className="h-14 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-4 shrink-0 gap-4">
          <div className="flex items-center gap-4 flex-1">
             {/* Display Settings */}
             <div className="flex items-center space-x-4 bg-slate-800/50 rounded-lg px-3 py-1.5 border border-slate-700/50">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={state.isHexMode} 
                  onChange={(e) => setState(prev => ({ ...prev, isHexMode: e.target.checked }))}
                  className="rounded bg-slate-700 border-slate-600 text-blue-600 focus:ring-offset-0 focus:ring-1"
                />
                <span className="text-xs text-slate-300">16进制 (Hex)</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={state.showTimestamp} 
                  onChange={(e) => setState(prev => ({ ...prev, showTimestamp: e.target.checked }))}
                  className="rounded bg-slate-700 border-slate-600 text-blue-600 focus:ring-offset-0 focus:ring-1"
                />
                <span className="text-xs text-slate-300">时间戳</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={state.autoScroll} 
                  onChange={(e) => setState(prev => ({ ...prev, autoScroll: e.target.checked }))}
                  className="rounded bg-slate-700 border-slate-600 text-blue-600 focus:ring-offset-0 focus:ring-1"
                />
                <span className="text-xs text-slate-300">自动滚屏</span>
              </label>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-xs w-full">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索日志 / 过滤内容..."
                className="block w-full pl-9 pr-3 py-1.5 border border-slate-700 rounded-lg leading-5 bg-slate-800 text-slate-300 placeholder-slate-500 focus:outline-none focus:bg-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-xs transition-colors"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-500 hover:text-slate-300"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
               onClick={() => setState(prev => ({ ...prev, showAiSettings: true }))}
               className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
               title="配置 AI (Configure AI)"
            >
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            <button 
              onClick={handleAiAnalysis}
              disabled={isAiAnalyzing || state.logs.length === 0}
              className="flex items-center space-x-1.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white border-0 px-3 py-1.5 rounded text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{isAiAnalyzing ? '分析中...' : 'AI 分析'}</span>
            </button>
          </div>
        </header>

        {/* Terminal Area */}
        <Terminal 
          logs={filteredLogs} 
          isHexMode={state.isHexMode} 
          autoScroll={state.autoScroll}
          showTimestamp={state.showTimestamp}
          searchTerm={searchTerm}
        />

        {/* Send Area */}
        <footer className="bg-slate-900 border-t border-slate-800 p-3 shrink-0 flex flex-col gap-3 h-auto max-h-[40vh]">
            {/* Quick Commands Bar */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700">
                {quickCommands.map(cmd => (
                    <button
                        key={cmd.id}
                        onClick={() => sendData(cmd.content, cmd.isHex)}
                        className="flex-shrink-0 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-300 whitespace-nowrap transition-colors"
                        title={cmd.content}
                    >
                        {cmd.label}
                    </button>
                ))}
                <div className="w-px h-6 bg-slate-700 mx-1"></div>
                <span className="text-[10px] text-slate-500 self-center uppercase">快捷指令</span>
            </div>

            <div className="flex gap-4 h-24">
                {/* Send Settings */}
                <div className="w-48 flex flex-col justify-between space-y-1 bg-slate-800/50 p-2 rounded border border-slate-800">
                    <label className="flex items-center space-x-2 cursor-pointer select-none">
                        <input 
                        type="checkbox" 
                        checked={state.sendConfig.isHex} 
                        onChange={(e) => setState(prev => ({ ...prev, sendConfig: { ...prev.sendConfig, isHex: e.target.checked } }))}
                        className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-0 w-3.5 h-3.5"
                        />
                        <span className="text-xs text-slate-300">16进制发送 (Hex)</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer select-none">
                        <input 
                        type="checkbox" 
                        checked={state.sendConfig.addCRLF} 
                        onChange={(e) => setState(prev => ({ ...prev, sendConfig: { ...prev.sendConfig, addCRLF: e.target.checked } }))}
                        className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-0 w-3.5 h-3.5"
                        />
                        <span className="text-xs text-slate-300">发送新行 (\r\n)</span>
                    </label>
                    
                    <div className="pt-1 border-t border-slate-700">
                        <label className="flex items-center space-x-2 cursor-pointer select-none mb-1">
                            <input 
                            type="checkbox" 
                            checked={state.sendConfig.autoRepeat} 
                            disabled={!state.isConnected}
                            onChange={(e) => setState(prev => ({ ...prev, sendConfig: { ...prev.sendConfig, autoRepeat: e.target.checked } }))}
                            className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-0 w-3.5 h-3.5"
                            />
                            <span className="text-xs text-slate-300">定时发送</span>
                        </label>
                        <div className="flex items-center space-x-1">
                            <input 
                                type="number" 
                                value={state.sendConfig.repeatInterval}
                                onChange={(e) => setState(prev => ({ ...prev, sendConfig: { ...prev.sendConfig, repeatInterval: parseInt(e.target.value) } }))}
                                className="w-16 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-right focus:border-blue-500 outline-none"
                                min="10"
                            />
                            <span className="text-[10px] text-slate-500">ms/次</span>
                        </div>
                    </div>
                </div>

                {/* Input Textarea */}
                <div className="flex-1 relative group">
                    <textarea
                        value={inputBuffer}
                        onChange={(e) => setInputBuffer(e.target.value)}
                        onKeyDown={(e) => {
                           if (e.key === 'Enter' && e.ctrlKey) {
                             sendData(inputBuffer);
                           }
                        }}
                        placeholder={state.sendConfig.isHex ? "请输入 Hex 数据，例如: AA BB CC 01" : "请输入发送内容..."}
                        className="w-full h-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-700 resize-none pr-10"
                    />
                    
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleFileUpload} 
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!state.isConnected}
                      className="absolute right-2 top-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="发送文件 (Send File)"
                    >
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                       </svg>
                    </button>
                    
                    <div className="absolute right-2 bottom-2 text-[10px] text-slate-600">
                        Ctrl + Enter 发送
                    </div>
                </div>

                {/* Send Button */}
                <button 
                    onClick={() => sendData(inputBuffer)}
                    disabled={!state.isConnected}
                    className="w-24 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all flex flex-col items-center justify-center shadow-lg shadow-blue-900/20 active:translate-y-0.5"
                >
                    <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <span>发送</span>
                </button>
            </div>
        </footer>

        {/* AI Analysis Overlay */}
        {aiAnalysisResult && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 p-6 flex flex-col animate-in fade-in duration-200">
            <div className="max-w-4xl mx-auto w-full flex flex-col h-full bg-[#161b2e] rounded-xl shadow-2xl border border-slate-700 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-white">AI 智能分析报告 ({state.aiConfig.provider})</h2>
                </div>
                <button 
                  onClick={() => setAiAnalysisResult(null)}
                  className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                 <article className="prose prose-invert prose-sm max-w-none prose-headings:text-blue-400 prose-a:text-blue-400 prose-strong:text-slate-200">
                    {aiAnalysisResult.split('\n').map((line, i) => {
                        // Simple custom markdown rendering for headers and lists
                        if (line.startsWith('###')) return <h3 key={i} className="text-lg font-bold mt-4 mb-2 text-purple-400">{line.replace('###', '')}</h3>;
                        if (line.startsWith('**')) return <p key={i} className="mb-2"><strong className="text-white">{line.replace(/\*\*/g, '')}</strong></p>;
                        if (line.startsWith('-')) return <li key={i} className="ml-4 text-slate-300">{line.substring(1)}</li>;
                        return <p key={i} className="mb-2 text-slate-300 leading-relaxed">{line}</p>;
                    })}
                 </article>
              </div>
              <div className="p-4 border-t border-slate-700 bg-slate-900 flex justify-end">
                <button 
                  onClick={() => setAiAnalysisResult(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded transition-colors text-sm font-medium border border-slate-600"
                >
                  关闭报告
                </button>
              </div>
            </div>
          </div>
        )}

        <AISettingsModal 
           isOpen={state.showAiSettings}
           config={state.aiConfig}
           onClose={() => setState(prev => ({ ...prev, showAiSettings: false }))}
           onSave={(newConfig) => setState(prev => ({ ...prev, aiConfig: newConfig, showAiSettings: false }))}
        />
      </main>
    </div>
  );
};

export default App;
