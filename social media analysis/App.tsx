
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { SocialData, NTSResults, ChatMessage, ForecastPoint } from './types';
import { processCSVData, calculateNTS, generateNeuralForecast, generateRichSummary } from './services/dataProcessor';
import { askAdmiral, generateTacticalReport, fetchLiveContext } from './services/geminiService';
import { 
  TacticalIntelligenceMatrix, 
  ForecastChart, 
  VectorChart, 
  SectorChart, 
  TrajectoryChart 
} from './components/DataVisuals';

interface StreamPacket {
  id: string;
  timestamp: string;
  topic: string;
  engagement: number;
  status: 'NOMINAL' | 'VOLATILE' | 'SURGE';
}

const generateMockPoint = (date: Date, baseEng: number = 100, multiplier: number = 1.0): SocialData => {
  const base = Math.floor(Math.random() * baseEng) + 100;
  const engagement = Math.floor(base * multiplier);
  return {
    Date: date.toISOString(),
    Engagement: engagement,
    Impressions: Math.floor(engagement * (8 + Math.random() * 4)),
    Shares: Math.floor(engagement * 0.05),
    Likes: Math.floor(engagement * 0.4),
    Comments: Math.floor(engagement * 0.1),
    Sector: ['Tech', 'Gaming', 'Finance', 'Lifestyle'][Math.floor(Math.random() * 4)],
    Platform: ['X', 'Instagram', 'LinkedIn', 'Facebook'][Math.floor(Math.random() * 4)],
    Hour: date.getHours()
  };
};

const INITIAL_MOCK_DATA: SocialData[] = Array.from({ length: 50 }, (_, i) => 
  generateMockPoint(new Date(Date.now() - (50 - i) * 86400000))
);

const MarkdownContent = ({ content }: { content: string }) => {
  const html = useMemo(() => {
    const rawHtml = marked.parse(content) as string;
    return DOMPurify.sanitize(rawHtml);
  }, [content]);

  return (
    <div 
      className="chat-md-content"
      dangerouslySetInnerHTML={{ __html: html }} 
    />
  );
};

const EngagementGauge = ({ value }: { value: number }) => {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, value / 1000);
  const offset = circumference - progress * circumference;

  return (
    <div className="relative flex flex-col items-center">
      <svg className="w-12 h-12 transform -rotate-90">
        <circle cx="24" cy="24" r={radius} stroke="currentColor" strokeWidth="3" fill="transparent" className="text-white/5" />
        <circle 
          cx="24" cy="24" r={radius} 
          stroke="currentColor" strokeWidth="3" 
          strokeDasharray={circumference} 
          strokeDashoffset={offset} 
          strokeLinecap="round" 
          fill="transparent" 
          className="text-cyan-400 transition-all duration-700 ease-out shadow-[0_0_8px_rgba(0,212,255,0.5)]" 
        />
      </svg>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-cyan-200">
        {Math.round(value / 10)}
      </div>
      <span className="text-[7px] text-gray-500 uppercase mt-1">Eng Score</span>
    </div>
  );
};

const MultiplierBar = ({ value }: { value: number }) => {
  const percentage = Math.min(100, (value / 5) * 100);
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1 px-1">
        <span className="text-[7px] text-gray-500 uppercase">Multiplier</span>
        <span className="text-[10px] font-mono font-bold text-pink-400">{value.toFixed(1)}x</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
        <div 
          className="h-full bg-gradient-to-r from-pink-600 to-pink-400 transition-all duration-700 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default function App() {
  const [data, setData] = useState<SocialData[]>(INITIAL_MOCK_DATA);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isDeepThought, setIsDeepThought] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [showBriefingRoom, setShowBriefingRoom] = useState(false);
  const [briefingData, setBriefingData] = useState<any>(null);
  const [commanderNote, setCommanderNote] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>(['summary', 'insights', 'recommendations', 'matrix', 'logs', 'forecast']);
  
  const [isLive, setIsLive] = useState(false);
  const [liveTopic, setLiveTopic] = useState('Global AI Trends');
  const [liveMetrics, setLiveMetrics] = useState({ score: 0, multiplier: 1.0, volatility: 0 });
  const [isPulsing, setIsPulsing] = useState(false);
  const [streamLog, setStreamLog] = useState<StreamPacket[]>([]);
  const [linkIntegrity, setLinkIntegrity] = useState(100);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatLogRef = useRef<HTMLDivElement>(null);

  const [platformFilter, setPlatformFilter] = useState('All');
  const [sectorFilter, setSectorFilter] = useState('All');
  const [sortBy, setSortBy] = useState('Date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredData = useMemo(() => {
    let result = [...data];
    if (platformFilter !== 'All') result = result.filter(d => d.Platform === platformFilter);
    if (sectorFilter !== 'All') result = result.filter(d => d.Sector === sectorFilter);
    result.sort((a, b) => {
      let valA: any = a[sortBy as keyof SocialData];
      let valB: any = b[sortBy as keyof SocialData];
      if (sortBy === 'Date') { valA = new Date(valA).getTime(); valB = new Date(valB).getTime(); }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [data, platformFilter, sectorFilter, sortBy, sortOrder]);

  const nts = useMemo(() => calculateNTS(filteredData), [filteredData]);
  const forecast = useMemo(() => generateNeuralForecast(filteredData), [filteredData]);
  const platforms = useMemo(() => ['All', ...new Set(data.map(d => d.Platform))], [data]);
  const sectors = useMemo(() => ['All', ...new Set(data.map(d => d.Sector))], [data]);

  const getVolatilityIndicator = (v: number) => {
    if (v > 70) return { label: 'VOLATILE_SURGE', color: 'text-red-500', bg: 'bg-red-500/20', border: 'border-red-500/40', pulse: 'animate-pulse' };
    if (v > 30) return { label: 'NEURAL_CAUTION', color: 'text-yellow-500', bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', pulse: '' };
    return { label: 'SIGNAL_NOMINAL', color: 'text-green-500', bg: 'bg-green-500/20', border: 'border-green-500/40', pulse: '' };
  };

  const volatilityStatus = useMemo(() => getVolatilityIndicator(liveMetrics.volatility), [liveMetrics.volatility]);

  const initiateNeuralPulse = useCallback(async (isSilent = false) => {
    if (isPulsing) return;
    if (!isSilent) setIsRefreshing(true);
    setIsPulsing(true);
    
    try {
      const context = await fetchLiveContext(liveTopic);
      const numbers = context.match(/[-+]?[0-9]*\.?[0-9]+/g);
      
      let score = 250;
      let multiplier = 1.0;
      let volatility = 10;

      if (numbers && numbers.length >= 3) {
        score = parseFloat(numbers[0]);
        multiplier = parseFloat(numbers[1]);
        volatility = parseFloat(numbers[2]);
        setLiveMetrics({ score, multiplier, volatility });
        setLinkIntegrity(prev => Math.min(100, prev + 5));
      } else {
        setLinkIntegrity(prev => Math.max(0, prev - 15));
      }

      const status: StreamPacket['status'] = volatility > 50 ? 'VOLATILE' : (score > 600 ? 'SURGE' : 'NOMINAL');
      
      const newPacket: StreamPacket = {
        id: Math.random().toString(36).substr(2, 9).toUpperCase(),
        timestamp: new Date().toLocaleTimeString(),
        topic: liveTopic,
        engagement: score,
        status
      };

      setStreamLog(prev => [newPacket, ...prev].slice(0, 10));

      setData(prevData => {
        const lastDate = new Date(prevData[prevData.length - 1].Date);
        const nextDate = new Date(lastDate.getTime() + 1000 * 60 * 60);
        const newPoint = generateMockPoint(nextDate, score, multiplier);
        return [...prevData.slice(1), newPoint];
      });

      if (!isSilent) {
        setChat(prev => [...prev, { 
          role: 'assistant', 
          content: `### NEURAL PULSE: ${liveTopic}\n\nPacket ID: **${newPacket.id}**\nIntensity: **${score.toFixed(0)}**\nStatus: **${status}**\n\nCommand Matrix updated in real-time.` 
        }]);
      }

    } catch (err) {
      console.error("Pulse error:", err);
      setLinkIntegrity(prev => Math.max(0, prev - 20));
    } finally {
      setIsPulsing(false);
      if (!isSilent) setIsRefreshing(false);
      if (!isSilent) setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [isPulsing, liveTopic]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const processed = processCSVData(results.data);
          if (processed.length > 0) {
            setData(processed);
            setChat(prev => [...prev, { role: 'assistant', content: `### UPLINK SUCCESS\n\nNeural matrix updated with **${processed.length}** packets. All sectors reporting nominal.` }]);
          } else {
            alert("No valid tactical data found in CSV.");
          }
        } catch (err) {
          console.error(err);
          alert("Data corruption detected during uplink.");
        }
      }
    });
  };

  useEffect(() => {
    let intervalId: number;
    if (isLive) {
      initiateNeuralPulse(true);
      intervalId = window.setInterval(() => {
        initiateNeuralPulse(true);
      }, 15000);
    }
    return () => clearInterval(intervalId);
  }, [isLive, initiateNeuralPulse]);

  const startBriefing = async () => {
    setIsReporting(true);
    try {
      const reportRawText = await generateTacticalReport(filteredData, { nts, totalRecords: filteredData.length }, chat);
      const sections: Record<string, string> = {};
      const sectionMatches = reportRawText.match(/\[([A-Z_]+)\]([\s\S]*?)(?=\[[A-Z_]+\]|$)/g);
      
      if (sectionMatches) {
        sectionMatches.forEach(match => {
          const title = match.match(/\[([A-Z_]+)\]/)?.[1] || 'GENERAL';
          const content = match.replace(/\[[A-Z_]+\]/, '').trim();
          sections[title] = content;
        });
      } else {
        sections['EXECUTIVE_SUMMARY'] = reportRawText;
      }

      setBriefingData(sections);
      setShowBriefingRoom(true);
    } catch (e) {
      alert("Briefing synthesis failure.");
    } finally {
      setIsReporting(false);
    }
  };

  const finalizeReport = async () => {
    setIsReporting(true);
    const html2canvas = (window as any).html2canvas;
    const { jsPDF } = (window as any).jspdf;
    
    try {
      const matrixEl = document.getElementById('tactical-matrix-display');
      const matrixCanvas = matrixEl ? await html2canvas(matrixEl, { backgroundColor: '#02020a', scale: 2, useCORS: true }) : null;
      const matrixImg = matrixCanvas ? matrixCanvas.toDataURL('image/png') : null;

      const chatHtml = chat.slice(-10).map(m => `
        <div style="margin-bottom: 12px; border-left: 3px solid ${m.role === 'user' ? '#00D4FF' : '#FF00FF'}; padding-left: 10px; background: rgba(0,0,0,0.02);">
          <div style="font-size: 8px; font-weight: bold; color: ${m.role === 'user' ? '#00D4FF' : '#FF00FF'}; text-transform: uppercase;">Node: ${m.role}</div>
          <div style="font-size: 10px; color: #333; line-height: 1.4;">${m.content.replace(/###/g, '').replace(/\*\*/g, '').replace(/`/g, '').slice(0, 300)}</div>
        </div>
      `).join('');

      const captureArea = document.createElement('div');
      captureArea.id = 'enhanced-synthetic-export';
      captureArea.style.position = 'absolute';
      captureArea.style.left = '-9999px';
      
      const sectionsToInclude = {
        summary: selectedModules.includes('summary') ? briefingData?.['EXECUTIVE_SUMMARY'] || briefingData?.['GENERAL'] : null,
        insights: selectedModules.includes('insights') ? briefingData?.['KEY_INSIGHTS'] : null,
        recommendations: selectedModules.includes('recommendations') ? briefingData?.['STRATEGIC_RECOMMENDATIONS'] : null,
        forecastText: selectedModules.includes('forecast') ? briefingData?.['NEURAL_FORECAST'] : null,
        matrix: selectedModules.includes('matrix') ? matrixImg : null,
        logs: selectedModules.includes('logs') ? chatHtml : null,
      };

      captureArea.innerHTML = `
        <div style="font-family: 'Inter', sans-serif; color: #111; padding: 40px; background: white; width: 900px;">
          <div style="border-bottom: 8px solid #00D4FF; padding-bottom: 25px; margin-bottom: 35px; display: flex; justify-content: space-between; align-items: center;">
            <div style="background: #02020a; padding: 15px 30px; border-radius: 4px;">
              <h1 style="font-family: 'Orbitron'; font-size: 28px; margin: 0; letter-spacing: 4px; color: #00D4FF;">INSIGHTSPHERE TACTICAL</h1>
              <p style="text-transform: uppercase; letter-spacing: 2px; font-weight: bold; margin: 5px 0 0 0; font-size: 10px; color: #fff; opacity: 0.7;">Strategic Intelligence Briefing // Alpha_Relay</p>
            </div>
            <div style="text-align: right; font-family: monospace; font-size: 10px; line-height: 1.6;">
              <div style="color: #999;">SESSION_ID: <span style="color: #000; font-weight: bold;">${Date.now().toString(16).toUpperCase()}</span></div>
              <div style="color: #999;">COORDINATES: <span style="color: #000; font-weight: bold;">${sectorFilter.toUpperCase()} Sector</span></div>
              <div style="color: #999;">TIMESTAMP: <span style="color: #000; font-weight: bold;">${new Date().toLocaleString()}</span></div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px;">
            <div style="border: 2px solid #00D4FF; border-radius: 4px; padding: 15px; background: #f0faff;">
              <div style="font-family: 'Orbitron'; font-size: 9px; color: #00D4FF; margin-bottom: 5px;">NEURAL RESONANCE</div>
              <div style="font-size: 24px; font-weight: 900; color: #000;">${Math.round(filteredData.reduce((a,b)=>a+b.Engagement,0)/filteredData.length).toLocaleString()}</div>
            </div>
            <div style="border: 2px solid #FF00FF; border-radius: 4px; padding: 15px; background: #fff0ff;">
              <div style="font-family: 'Orbitron'; font-size: 9px; color: #FF00FF; margin-bottom: 5px;">NTS OPTIMIZATION</div>
              <div style="font-size: 24px; font-weight: 900; color: #000;">+${nts.liftPercentage}%</div>
            </div>
            <div style="border: 2px solid #00FF90; border-radius: 4px; padding: 15px; background: #f0fff8;">
              <div style="font-family: 'Orbitron'; font-size: 9px; color: #00FF90; margin-bottom: 5px;">TOTAL PACKETS</div>
              <div style="font-size: 24px; font-weight: 900; color: #000;">${filteredData.length}</div>
            </div>
          </div>

          ${commanderNote ? `
            <div style="margin-bottom: 30px; padding: 20px; border: 1px solid #00D4FF; background: #f9ffff; border-radius: 4px;">
              <div style="font-family: 'Orbitron'; font-size: 9px; color: #00D4FF; margin-bottom: 10px; text-transform: uppercase; font-weight: bold;">[ COMMANDER_NOTE ]</div>
              <div style="font-style: italic; font-size: 13px; color: #333;">"${commanderNote}"</div>
            </div>
          ` : ''}

          ${sectionsToInclude.summary ? `
            <div style="margin-bottom: 45px;">
              <h2 style="font-family: 'Orbitron'; font-size: 14px; color: #000; text-transform: uppercase; letter-spacing: 2px; border-bottom: 2px solid #eee; padding-bottom: 8px; margin-bottom: 20px;">I. EXECUTIVE SUMMARY</h2>
              <div style="background: #fdfdfd; padding: 20px; border-radius: 8px; font-size: 13px; line-height: 1.6; color: #222;">
                ${sectionsToInclude.summary.replace(/\n/g, '<br/>')}
              </div>
            </div>
          ` : ''}

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 45px;">
            ${sectionsToInclude.insights ? `
              <div style="border: 1px solid #00D4FF; border-radius: 8px; padding: 25px; background: #fafdfe;">
                <h2 style="font-family: 'Orbitron'; font-size: 12px; color: #00D4FF; text-transform: uppercase; margin-top: 0; margin-bottom: 15px;">II. KEY TACTICAL TRENDS (TOP 3)</h2>
                <div style="font-size: 12px; line-height: 1.7; color: #333;">
                  ${sectionsToInclude.insights.replace(/\n/g, '<br/>')}
                </div>
              </div>
            ` : ''}
            ${sectionsToInclude.recommendations ? `
              <div style="border: 1px solid #FF00FF; border-radius: 8px; padding: 25px; background: #fefaff;">
                <h2 style="font-family: 'Orbitron'; font-size: 12px; color: #FF00FF; text-transform: uppercase; margin-top: 0; margin-bottom: 15px;">III. ADMIRAL'S STRATEGIC MANEUVERS</h2>
                <div style="font-size: 12px; line-height: 1.7; color: #333;">
                  ${sectionsToInclude.recommendations.replace(/\n/g, '<br/>')}
                </div>
              </div>
            ` : ''}
          </div>

          ${sectionsToInclude.forecastText ? `
            <div style="margin-bottom: 45px; padding: 25px; border: 1px solid #00FF90; background: #f5fff9; border-radius: 8px;">
               <h2 style="font-family: 'Orbitron'; font-size: 13px; color: #00FF90; text-transform: uppercase; letter-spacing: 2px; margin-top: 0; margin-bottom: 15px;">IV. NEURAL MOMENTUM FORECAST</h2>
               <div style="font-size: 12px; line-height: 1.7; color: #222;">
                  ${sectionsToInclude.forecastText.replace(/\n/g, '<br/>')}
               </div>
            </div>
          ` : ''}

          ${sectionsToInclude.matrix ? `
            <div style="margin-bottom: 45px;">
               <h2 style="font-family: 'Orbitron'; font-size: 14px; color: #000; text-transform: uppercase; letter-spacing: 2px; border-bottom: 2px solid #eee; padding-bottom: 8px; margin-bottom: 20px;">V. TACTICAL INTELLIGENCE MATRIX</h2>
               <div style="background: #02020a; padding: 20px; border-radius: 12px; text-align: center;">
                  <img src="${sectionsToInclude.matrix}" style="width: 100%; border-radius: 8px;" />
               </div>
            </div>
          ` : ''}

          ${sectionsToInclude.logs ? `
            <div style="page-break-before: always; padding-top: 40px;">
               <h2 style="font-family: 'Orbitron'; font-size: 14px; color: #000; text-transform: uppercase; letter-spacing: 2px; border-bottom: 2px solid #eee; padding-bottom: 8px; margin-bottom: 20px;">VI. NEURAL COMMUNICATION LOGS</h2>
               <div style="padding: 25px; background: #fcfcfc; border: 1px dashed #ccc; border-radius: 8px;">
                 ${sectionsToInclude.logs}
               </div>
            </div>
          ` : ''}

          <div style="margin-top: 50px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
            <p style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 3px;">End of Transmission // InsightSphere AI // Fleet Security Protocol Alpha</p>
          </div>
        </div>
      `;
      document.body.appendChild(captureArea);

      const reportCanvas = await html2canvas(captureArea, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const finalImg = reportCanvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (reportCanvas.height * pdfWidth) / reportCanvas.width;
      
      pdf.addImage(finalImg, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Tactical_Report_${Date.now().toString(16).toUpperCase()}.pdf`);

      document.body.removeChild(captureArea);
      setShowBriefingRoom(false);
    } catch (e) {
      console.error("PDF Synthesis Failure:", e);
      alert("Encryption engine bottleneck detected. Neural export failed.");
    } finally {
      setIsReporting(false);
    }
  };

  const handleAiAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    const currentQuery = query;
    setQuery('');
    setChat(prev => [...prev, { role: 'user', content: currentQuery }]);
    setIsAiThinking(true);
    
    const summary = generateRichSummary(filteredData, nts);
    const response = await askAdmiral(currentQuery, summary, chat, isDeepThought);
    
    setChat(prev => [...prev, { role: 'assistant', content: response }]);
    setIsAiThinking(false);
    
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const toggleModule = (modId: string) => {
    setSelectedModules(prev => 
      prev.includes(modId) ? prev.filter(m => m !== modId) : [...prev, modId]
    );
  };

  return (
    <div className="h-screen flex flex-col md:flex-row p-4 gap-6 overflow-hidden relative">
      <aside className="w-full md:w-96 flex flex-col gap-4 h-full overflow-y-auto custom-scrollbar pr-2 z-10">
        <div className="glass-card p-5 border-l-4 border-l-[#00D4FF] rounded-xl flex flex-col gap-4 hud-corner hud-corner-tl hud-corner-br shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black neon-text-cyan leading-none uppercase italic">InsightSphere AI</h1>
              <p className="text-[9px] text-cyan-400 font-bold tracking-[0.3em] uppercase mt-1 opacity-70">Strategic Command Console</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] text-gray-500 font-mono uppercase">Node: IS-X9</p>
              <div className="flex items-center gap-1 justify-end">
                 <div className={`w-1 h-1 rounded-full ${linkIntegrity > 70 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                 <p className="text-[8px] text-gray-500 font-mono uppercase">Relay: {linkIntegrity}%</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => fileInputRef.current?.click()} className="py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded text-[9px] font-bold uppercase tracking-widest text-cyan-400 flex items-center justify-center gap-2">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg> CSV Uplink
            </button>
            <button onClick={startBriefing} disabled={isReporting} className={`py-2 border rounded text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${isReporting ? 'bg-white/10 border-white/20 text-white/50 animate-pulse' : 'bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/30 text-pink-400'}`}>
              {isReporting ? 'Synthesizing...' : <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> Galactic Report</>}
            </button>
          </div>

          <div className="p-3 bg-black/40 rounded border border-white/5 space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${isLive ? (isPulsing ? 'bg-cyan-500 animate-ping' : 'bg-green-500 animate-pulse') : 'bg-gray-600'}`}></span>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">Live Neural Feed {isLive && <span className={`text-[8px] font-mono transition-all duration-300 ${isPulsing ? 'neon-text-cyan animate-pulse' : 'text-gray-500'}`}>[{isPulsing ? 'SYNCING...' : 'NOMINAL'}]</span>}</span>
              </div>
              <div onClick={() => setIsLive(!isLive)} className={`w-8 h-4 rounded-full cursor-pointer transition-colors ${isLive ? 'bg-green-500' : 'bg-gray-700'} relative`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isLive ? 'left-4.5' : 'left-0.5'}`}></div></div>
            </div>
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative group flex-1">
                  <input type="text" value={liveTopic} onChange={(e) => setLiveTopic(e.target.value)} className="w-full bg-black/60 border border-cyan-500/20 rounded px-2 py-1.5 text-[10px] text-cyan-200 focus:outline-none focus:border-cyan-500/50" placeholder="Target keyword..." />
                  <div className="absolute right-2 top-2 w-2 h-2 rounded-full bg-cyan-500/20 group-focus-within:bg-cyan-500 animate-ping"></div>
                </div>
                <button onClick={() => initiateNeuralPulse(false)} disabled={isPulsing} className={`px-3 py-1.5 rounded text-[9px] font-orbitron font-bold uppercase transition-all flex items-center gap-1 ${isPulsing ? 'bg-white/10 text-white/20 animate-pulse cursor-not-allowed' : 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30'}`}>{isPulsing ? 'Probing...' : 'Pulse'}</button>
              </div>
              {(isLive || isPulsing || liveMetrics.score > 0) && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-300 space-y-4 bg-white/[0.02] p-2 rounded-lg border border-white/[0.03]">
                  <div className={`flex items-center justify-between px-3 py-1.5 rounded border ${volatilityStatus.bg} ${volatilityStatus.border} ${volatilityStatus.pulse} transition-all duration-500 shadow-[inset_0_0_10px_rgba(255,255,255,0.05)]`}>
                    <div className="flex items-center gap-1.5"><div className={`w-1 h-1 rounded-full bg-current ${volatilityStatus.pulse}`}></div><span className="text-[7px] font-orbitron text-white/40 uppercase tracking-widest">Stability</span></div>
                    <span className={`text-[10px] font-black font-orbitron ${volatilityStatus.color} tracking-tighter`}>{volatilityStatus.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <EngagementGauge value={liveMetrics.score} />
                    <div className="pb-1"><MultiplierBar value={liveMetrics.multiplier} /><div className="mt-2 text-center py-1 bg-white/5 rounded border border-white/5"><p className="text-[7px] text-gray-500 uppercase">Volatility Index</p><p className={`text-[11px] font-mono font-bold ${volatilityStatus.color}`}>{liveMetrics.volatility.toFixed(0)}%</p></div></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="glass-card p-4 border border-pink-500/20 rounded-xl hud-corner hud-corner-tr hud-corner-bl shadow-lg shadow-pink-900/10 shrink-0">
          <div className="flex justify-between items-center mb-3"><h3 className="text-[10px] font-orbitron text-pink-400 uppercase tracking-widest">NTS Synchronization</h3><span className="text-[9px] font-bold text-green-400">OPTIMAL</span></div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-center">
            <div className="bg-black/30 p-2 rounded border border-white/5"><p className="text-[8px] text-gray-500 uppercase">Sector Day</p><p className="text-sm font-bold text-pink-300">{nts.bestDay}</p></div>
            <div className="bg-black/30 p-2 rounded border border-white/5"><p className="text-[8px] text-gray-500 uppercase">Peak Hour</p><p className="text-sm font-bold text-cyan-300">{nts.bestHour}</p></div>
          </div>
        </div>
        <div className="glass-card flex-1 flex flex-col overflow-hidden border border-cyan-500/20 rounded-xl hud-corner hud-corner-tl hud-corner-br min-h-[300px] mb-4 shadow-2xl relative">
          <div className="p-3 border-b border-white/5 bg-cyan-500/5 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2"><div className={`w-1.5 h-1.5 rounded-full ${isAiThinking ? 'bg-cyan-500 animate-ping' : 'bg-green-500'}`}></div><span className="text-[9px] font-orbitron uppercase text-cyan-400 tracking-widest">Admiral Tactical Log</span></div>
            <button onClick={() => setIsDeepThought(!isDeepThought)} className={`text-[8px] px-2 py-0.5 rounded border transition-all font-bold uppercase ${isDeepThought ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' : 'bg-white/5 border-white/10 text-gray-500'}`}>{isDeepThought ? 'Deep Neural' : 'Standard'}</button>
          </div>
          <div ref={chatLogRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/10">
            {chat.length === 0 && <div className="h-full flex items-center justify-center opacity-30"><p className="text-[10px] font-orbitron uppercase tracking-[0.3em] text-cyan-500">Awaiting Neural Interface...</p></div>}
            {chat.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                <div className={`max-w-[90%] p-3 rounded-lg border ${msg.role === 'user' ? 'bg-cyan-900/30 border-cyan-500/50 text-cyan-50 rounded-br-none' : 'bg-gray-800/60 border-white/10 text-gray-200 rounded-bl-none shadow-lg'}`}><MarkdownContent content={msg.content} /></div>
              </div>
            ))}
            {isAiThinking && <div className="flex gap-2 items-center text-cyan-500 animate-pulse text-[9px] font-mono"><span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce"></span>Processing packets...</div>}
            <div ref={chatEndRef} />
          </div>
          <div className="p-4 bg-black/40 border-t border-cyan-500/20 relative shrink-0">
            <form onSubmit={handleAiAsk} className="relative"><input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="INPUT COMMAND..." className="w-full bg-black/60 border border-cyan-500/40 rounded-lg py-2.5 pl-4 pr-12 text-[11px] font-mono text-cyan-100 placeholder:text-cyan-900 focus:outline-none focus:border-cyan-400" /><button type="submit" disabled={!query.trim() || isAiThinking} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-cyan-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg></button></form>
          </div>
        </div>
      </aside>

      {showBriefingRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 md:p-10 animate-in fade-in duration-300">
          <div className="glass-card w-full max-w-6xl h-full max-h-[95vh] flex flex-col rounded-3xl overflow-hidden border-cyan-500/40 shadow-[0_0_100px_rgba(0,212,255,0.2)]">
            <div className="p-6 border-b border-white/10 bg-cyan-500/5 flex justify-between items-center">
              <div><h2 className="text-2xl font-black font-orbitron neon-text-cyan uppercase italic tracking-widest">Tactical Briefing Room</h2><p className="text-[10px] text-cyan-400 font-bold uppercase tracking-[0.4em]">Integrated Intelligence Suite</p></div>
              <button onClick={() => setShowBriefingRoom(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <div className="w-full md:w-80 border-r border-white/10 p-6 flex flex-col gap-6 bg-black/20 overflow-y-auto custom-scrollbar">
                <div><h3 className="text-[11px] font-orbitron text-gray-400 uppercase tracking-widest mb-4">Module Selection</h3><div className="space-y-3">
                  {[
                    {id: 'summary', label: 'Exec Summary', color: 'cyan'},
                    {id: 'insights', label: 'Tactical Trends', color: 'pink'},
                    {id: 'recommendations', label: 'Strategic Maneuvers', color: 'green'},
                    {id: 'forecast', label: 'Neural Forecast', color: 'green'},
                    {id: 'matrix', label: 'Visual Matrix', color: 'cyan'},
                    {id: 'logs', label: 'Neural Logs', color: 'purple'}
                  ].map(mod => (
                    <div key={mod.id} onClick={() => toggleModule(mod.id)} className={`group flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all duration-300 ${selectedModules.includes(mod.id) ? 'bg-cyan-500/10 border-cyan-500/40' : 'bg-black/40 border-white/5 opacity-50'}`}>
                      <span className={`text-[10px] font-bold uppercase tracking-tighter ${selectedModules.includes(mod.id) ? 'text-cyan-400' : 'text-gray-400'}`}>{mod.label}</span>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedModules.includes(mod.id) ? 'bg-cyan-500 border-cyan-400' : 'border-white/20'}`}>{selectedModules.includes(mod.id) && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}</div>
                    </div>
                  ))}
                </div></div>
                <div className="flex-1"><h3 className="text-[11px] font-orbitron text-gray-400 uppercase tracking-widest mb-4">Commander's Note</h3><textarea value={commanderNote} onChange={(e) => setCommanderNote(e.target.value)} placeholder="Input directive..." className="w-full h-32 bg-black/60 border border-white/10 rounded-xl p-3 text-xs text-cyan-100 focus:outline-none custom-scrollbar resize-none font-mono" /></div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-[#02020a] custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-12">
                   <div className="bg-black/40 border border-cyan-500/20 p-6 rounded-2xl relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-white/5"><div className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(0,212,255,0.8)] animate-[progress_3s_ease-in-out_infinite]" style={{width: '60%'}}></div></div>
                      <div className="flex justify-between items-center mb-4"><span className="text-[10px] font-orbitron text-cyan-400 uppercase animate-pulse">Encryption Status: Nominal</span><span className="text-[10px] font-mono text-gray-500">RELAY_STRENGTH: 98.4%</span></div>
                      <div className="grid grid-cols-4 gap-2">{[1,2,3,4,5,6,7,8].map(i => (<div key={i} className={`h-1 rounded-full ${i <= 6 ? 'bg-cyan-500/40' : 'bg-white/5'}`}></div>))}</div>
                   </div>

                   {selectedModules.includes('summary') && (
                     <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h4 className="text-[11px] font-orbitron text-cyan-400 border-b border-cyan-500/30 pb-2 mb-6 uppercase tracking-[0.3em]">I. Executive Summary</h4>
                        <div className="text-gray-300 text-sm leading-relaxed font-light mb-10">
                          {briefingData?.['EXECUTIVE_SUMMARY'] ? <MarkdownContent content={briefingData['EXECUTIVE_SUMMARY']} /> : <span className="text-gray-600 italic">No data detected in relay.</span>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10 animate-in fade-in zoom-in duration-700">
                           <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-4 h-64 flex flex-col relative">
                              <span className="text-[9px] font-orbitron text-cyan-400 uppercase mb-3 block tracking-widest opacity-70">Neural Forecast // Stream_01</span>
                              <div className="flex-1"><ForecastChart forecast={forecast} /></div>
                           </div>
                           <div className="bg-black/40 border border-pink-500/20 rounded-xl p-4 h-64 flex flex-col relative">
                              <span className="text-[9px] font-orbitron text-pink-400 uppercase mb-3 block tracking-widest opacity-70">Vector Distribution // Asset_02</span>
                              <div className="flex-1"><VectorChart data={filteredData} /></div>
                           </div>
                           <div className="bg-black/40 border border-green-500/20 rounded-xl p-4 h-64 flex flex-col relative">
                              <span className="text-[9px] font-orbitron text-green-400 uppercase mb-3 block tracking-widest opacity-70">Sector Share // Segment_03</span>
                              <div className="flex-1"><SectorChart data={filteredData} /></div>
                           </div>
                           <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-4 h-64 flex flex-col relative">
                              <span className="text-[9px] font-orbitron text-cyan-400 uppercase mb-3 block tracking-widest opacity-70">Trajectory Stream // Wave_04</span>
                              <div className="flex-1"><TrajectoryChart data={filteredData} forecast={forecast} /></div>
                           </div>
                        </div>
                     </div>
                   )}

                   {selectedModules.includes('insights') && (
                     <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                        <h4 className="text-[11px] font-orbitron text-cyan-400 border-b border-cyan-500/30 pb-2 mb-4 uppercase tracking-[0.3em]">II. Key Tactical Trends (TOP 3)</h4>
                        <div className="text-gray-300 text-sm leading-relaxed font-light">
                          {briefingData?.['KEY_INSIGHTS'] ? <MarkdownContent content={briefingData['KEY_INSIGHTS']} /> : <span className="text-gray-600 italic">Scanning clusters...</span>}
                        </div>
                     </div>
                   )}

                   {selectedModules.includes('recommendations') && (
                     <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                        <h4 className="text-[11px] font-orbitron text-pink-400 border-b border-pink-500/30 pb-2 mb-4 uppercase tracking-[0.3em]">III. Admiral's Strategic Maneuvers</h4>
                        <div className="text-gray-300 text-sm leading-relaxed font-light">
                          {briefingData?.['STRATEGIC_RECOMMENDATIONS'] ? <MarkdownContent content={briefingData['STRATEGIC_RECOMMENDATIONS']} /> : <span className="text-gray-600 italic">Awaiting advice...</span>}
                        </div>
                     </div>
                   )}

                   {selectedModules.includes('forecast') && (
                     <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
                        <h4 className="text-[11px] font-orbitron text-green-400 border-b border-green-500/30 pb-2 mb-4 uppercase tracking-[0.3em]">IV. Neural Forecast Projection</h4>
                        <div className="text-gray-300 text-sm leading-relaxed font-light">
                          {briefingData?.['NEURAL_FORECAST'] ? <MarkdownContent content={briefingData['NEURAL_FORECAST']} /> : <span className="text-gray-600 italic">Calculating trajectory...</span>}
                        </div>
                     </div>
                   )}
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-white/10 bg-cyan-500/5 flex justify-between items-center">
              <div className="flex items-center gap-6"><div className="flex flex-col"><span className="text-[8px] text-gray-500 uppercase font-bold mb-1">Modules Locked</span><span className="text-xl font-black text-white font-orbitron">{selectedModules.length} <span className="text-xs text-gray-500">/ 6</span></span></div><div className="w-px h-10 bg-white/10"></div><div className="flex flex-col"><span className="text-[8px] text-gray-500 uppercase font-bold mb-1">Briefing Encryption</span><span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">AES-256 SECURE</span></div></div>
              <div className="flex gap-4"><button onClick={() => setShowBriefingRoom(false)} className="px-8 py-3 rounded-full border border-white/10 text-xs font-bold text-gray-400 hover:bg-white/5 uppercase tracking-widest">Abstain</button><button onClick={finalizeReport} disabled={isReporting || selectedModules.length === 0} className={`px-10 py-3 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 text-xs font-black text-white uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(0,212,255,0.3)] flex items-center gap-3 ${isReporting ? 'opacity-50 animate-pulse' : ''}`}>{isReporting ? 'Finalizing...' : <>Transmit Briefing <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg></>}</button></div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6 pr-2">
        <header className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3"><span className="w-8 h-0.5 bg-cyan-500 shadow-[0_0_10px_rgba(0,212,255,0.8)]"></span>Neural Command Display</h2>
            <div className="flex gap-4 mt-1"><span className="text-[9px] font-bold text-cyan-500 uppercase flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-cyan-500"></span> Sector: {sectorFilter}</span><span className="text-[9px] font-bold text-pink-500 uppercase flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-pink-500"></span> Platform: {platformFilter}</span><span className="text-[9px] font-bold text-gray-500 uppercase flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-gray-500 animate-pulse"></span> Status: {isRefreshing ? 'Recalibrating...' : 'NOMINAL'}</span></div>
          </div>
          <div className="flex gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[7px] text-gray-500 font-bold uppercase ml-1">Segment</span>
              <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)} className="bg-black/80 border border-cyan-500/30 rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                {sectors.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[7px] text-gray-500 font-bold uppercase ml-1">Relay</span>
              <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="bg-black/80 border border-pink-500/30 rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-pink-400">
                {platforms.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </header>
        <TacticalIntelligenceMatrix data={filteredData} forecast={forecast} isRefreshing={isRefreshing} />
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 212, 255, 0.3); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0, 212, 255, 0.5); }
        @keyframes progress { 0% { transform: translateX(-100%); } 50% { transform: translateX(50%); } 100% { transform: translateX(200%); } }
      `}</style>
    </div>
  );
}
