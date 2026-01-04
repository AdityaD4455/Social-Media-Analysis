
import React, { useState, useMemo, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, RadarChart, 
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
  ScatterChart, Scatter, Brush, ComposedChart
} from 'recharts';
import { SocialData, ForecastPoint } from '../types';

const COLORS = ['#00D4FF', '#FF00FF', '#00FF90', '#FFD700', '#FF4500'];

interface Props {
  data: SocialData[];
  forecast: ForecastPoint[];
  isRefreshing?: boolean;
}

const NeuralLoader: React.FC<{ color: string }> = ({ color }) => (
  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-500">
    <div className={`w-12 h-12 border-2 border-t-transparent rounded-full animate-spin mb-3`} style={{ borderColor: `${color}44`, borderTopColor: color }}></div>
    <div className="text-[10px] font-orbitron uppercase tracking-[0.4em] animate-pulse" style={{ color }}>
      Recalibrating Matrix
    </div>
  </div>
);

const ChartCard: React.FC<{ title: string; color: string; children: React.ReactNode; isRefreshing?: boolean; className?: string }> = ({ title, color, children, isRefreshing, className = "" }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!cardRef.current || isExporting) return;
    setIsExporting(true);
    
    try {
      await new Promise(r => setTimeout(r, 800)); // Slight delay for visual feedback
      const html2canvas = (window as any).html2canvas;
      if (!html2canvas) throw new Error("Optical capture unit unavailable.");

      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#02020a',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      const link = document.createElement('a');
      link.download = `Tactical_Matrix_${title.replace(/\s+/g, '_')}_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error("Export failure:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div 
      ref={cardRef}
      className={`glass-card p-5 min-h-[380px] flex flex-col group relative overflow-hidden hud-corner hud-corner-tl hud-corner-br transition-all duration-500 hover:scale-[1.02] hover:border-cyan-400/60 hover:shadow-[0_0_30px_rgba(0,212,255,0.15)] hover:bg-black/90 cursor-default ${className}`}
    >
      {isRefreshing && <NeuralLoader color={color} />}
      
      <div className="flex justify-between items-center mb-6 z-10">
        <h3 className="text-[11px] font-orbitron uppercase tracking-[0.2em]" style={{ color }}>{title}</h3>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className={`
              relative flex items-center gap-1.5 px-3 py-1 rounded border transition-all duration-300
              ${isExporting 
                ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-[0_0_15px_rgba(0,212,255,0.4)] opacity-100 cursor-wait' 
                : 'opacity-0 group-hover:opacity-100 border-white/10 bg-white/5 hover:bg-white/10 hover:border-cyan-500/50 text-cyan-400 hover:text-white'
              }
              text-[8px] font-bold uppercase tracking-[0.15em]
            `}
            title="Export Data Packet as PNG"
          >
            {isExporting ? (
              <>
                <div className="w-2.5 h-2.5 border border-t-transparent border-white rounded-full animate-spin"></div>
                <span className="animate-pulse">Capturing Matrix...</span>
              </>
            ) : (
              <>
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                </svg>
                Extract
              </>
            )}
          </button>

          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, opacity: 0.3 }}></div>
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, opacity: 0.6 }}></div>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color }}></div>
          </div>
        </div>
      </div>

      <div className="flex-1 z-0">
        {children}
      </div>
      
      <div className="absolute bottom-2 right-4 opacity-5 pointer-events-none select-none">
        <span className="text-[60px] font-black italic tracking-tighter" style={{ color }}>{title.charAt(0)}</span>
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label, borderColor }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-black/90 border border-cyan-500/50 p-3 backdrop-blur-xl animate-in zoom-in-95 duration-200 shadow-[0_0_15px_rgba(0,212,255,0.2)]">
        <p className="text-[10px] font-orbitron text-cyan-400 mb-2 border-b border-cyan-500/30 pb-1">{label}</p>
        <div className="space-y-1">
          {payload.map((p: any, i: number) => (
            <div key={i} className="flex justify-between items-center gap-4">
              <span className="text-[9px] text-gray-400 uppercase tracking-tighter">{p.name}:</span>
              <span className="text-xs font-bold font-mono" style={{ color: p.color || p.stroke || p.fill }}>
                {p.value !== undefined ? p.value.toLocaleString() : 'N/A'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// --- Exported Sub-Charts for use in Briefing Room ---

export const ForecastChart = ({ forecast }: { forecast: ForecastPoint[] }) => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={forecast} syncId="matrix-sync">
      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" vertical={false} />
      <XAxis dataKey="date" stroke="#444" fontSize={9} hide />
      <YAxis stroke="#444" fontSize={9} />
      <Tooltip content={<CustomTooltip borderColor="#00D4FF" />} />
      <Line type="monotone" dataKey="actual" name="Historical" stroke="#00D4FF" strokeWidth={2} dot={{r: 2}} />
      <Line type="monotone" dataKey="predicted" name="Projected" stroke="#FF00FF" strokeDasharray="5 5" strokeWidth={2} dot={false} />
      <Brush dataKey="date" height={20} stroke="#00D4FF" fill="transparent" travelerWidth={10} />
    </LineChart>
  </ResponsiveContainer>
);

export const VectorChart = ({ data }: { data: any[] }) => {
  const radarData = useMemo(() => [
    { subject: 'Resonance', A: Math.max(...data.map(d => d.Engagement), 0), fullMark: 1000 },
    { subject: 'Impact', A: Math.max(...data.map(d => d.Impressions), 0) / 10, fullMark: 1000 },
    { subject: 'Virality', A: Math.max(...data.map(d => d.Shares), 0) * 5, fullMark: 1000 },
    { subject: 'Affinity', A: Math.max(...data.map(d => d.Likes), 0), fullMark: 1000 },
    { subject: 'Dialogue', A: Math.max(...data.map(d => d.Comments), 0) * 2, fullMark: 1000 },
  ], [data]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
        <PolarGrid stroke="#222" />
        <PolarAngleAxis dataKey="subject" stroke="#666" fontSize={10} />
        <Radar name="Fleet" dataKey="A" stroke="#FF00FF" fill="#FF00FF" fillOpacity={0.3} />
        <Tooltip content={<CustomTooltip borderColor="#FF00FF" />} />
      </RadarChart>
    </ResponsiveContainer>
  );
};

export const SectorChart = ({ data }: { data: SocialData[] }) => {
  const sectorData = useMemo(() => {
    const counts: Record<string, number> = {};
    data.forEach(d => counts[d.Sector] = (counts[d.Sector] || 0) + d.Engagement);
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={sectorData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">
          {sectorData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip content={<CustomTooltip borderColor="#00FF90" />} />
        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '9px', textTransform: 'uppercase' }} />
      </PieChart>
    </ResponsiveContainer>
  );
};

export const TrajectoryChart = ({ data, forecast }: { data: SocialData[], forecast: ForecastPoint[] }) => {
  const syncedTrajectoryData = useMemo(() => {
    const historical = data.map(d => ({
      ...d,
      date: d.Date.split('T')[0],
      Engagement: d.Engagement
    }));
    const forecastDates = forecast.map(f => f.date);
    const historicalDates = new Set(historical.map(h => h.date));
    const padded = [...historical];
    forecastDates.forEach(date => {
      if (!historicalDates.has(date)) {
        padded.push({
          date: date,
          Engagement: undefined as any,
          Date: '', Impressions: 0, Shares: 0, Likes: 0, Comments: 0, Sector: '', Platform: '', Hour: 0
        });
      }
    });
    return padded.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data, forecast]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={syncedTrajectoryData} syncId="matrix-sync">
        <defs>
          <linearGradient id="colorEng" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.5}/>
            <stop offset="95%" stopColor="#00D4FF" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" vertical={false} />
        <XAxis dataKey="date" stroke="#444" fontSize={9} hide />
        <YAxis stroke="#444" fontSize={9} />
        <Tooltip content={<CustomTooltip borderColor="#00D4FF" />} />
        <Area type="monotone" dataKey="Engagement" name="Stream" stroke="#00D4FF" fillOpacity={1} fill="url(#colorEng)" connectNulls={false} />
        <Brush dataKey="date" height={20} stroke="#00D4FF" fill="transparent" travelerWidth={10} />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export const TacticalIntelligenceMatrix: React.FC<Props> = ({ data, forecast, isRefreshing = false }) => {
  const hourlyData = useMemo(() => {
    const hours: Record<number, { hour: number; engagement: number; count: number }> = {};
    for (let i = 0; i < 24; i++) {
      hours[i] = { hour: i, engagement: 0, count: 0 };
    }
    data.forEach(d => {
      hours[d.Hour].engagement += d.Engagement;
      hours[d.Hour].count += 1;
    });
    return Object.values(hours).map(h => ({
      hour: `${h.hour.toString().padStart(2, '0')}:00`,
      engagement: h.count > 0 ? Math.round(h.engagement / h.count) : 0
    }));
  }, [data]);

  return (
    <div id="tactical-matrix-display" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative pb-10">
      <ChartCard title="Neural Forecast" color="#00D4FF" isRefreshing={isRefreshing}>
        <ForecastChart forecast={forecast} />
      </ChartCard>

      <ChartCard title="Vector Distribution" color="#FF00FF" isRefreshing={isRefreshing}>
        <VectorChart data={data} />
      </ChartCard>

      <ChartCard title="Sector Share" color="#00FF90" isRefreshing={isRefreshing}>
        <SectorChart data={data} />
      </ChartCard>

      <ChartCard title="Trajectory Stream" color="#00D4FF" isRefreshing={isRefreshing}>
        <TrajectoryChart data={data} forecast={forecast} />
      </ChartCard>

      <ChartCard title="Hourly Chrono-Resonance" color="#FF00FF" isRefreshing={isRefreshing}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={hourlyData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <defs>
              <linearGradient id="composedBarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF00FF" stopOpacity={0.4}/>
                <stop offset="100%" stopColor="#FF00FF" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="lineGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF00FF" stopOpacity={1}/>
                <stop offset="100%" stopColor="#00D4FF" stopOpacity={1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" vertical={false} />
            <XAxis dataKey="hour" stroke="#444" fontSize={8} tick={{ dy: 10 }} />
            <YAxis stroke="#444" fontSize={9} />
            <Tooltip cursor={{ stroke: 'rgba(255, 0, 255, 0.2)', strokeWidth: 2 }} content={<CustomTooltip borderColor="#FF00FF" />} />
            <Bar 
              dataKey="engagement" 
              name="Packet Density" 
              fill="url(#composedBarGradient)" 
              radius={[2, 2, 0, 0]}
              barSize={20}
            />
            <Line 
              type="monotone" 
              dataKey="engagement" 
              name="Resonance Wave" 
              stroke="url(#lineGlow)" 
              strokeWidth={3} 
              dot={{ r: 2, fill: '#FF00FF', strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#FFFFFF', stroke: '#FF00FF', strokeWidth: 2 }}
              animationDuration={2000}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Interaction Cluster" color="#00FF90" isRefreshing={isRefreshing}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid stroke="#1a1a2e" strokeDasharray="3 3" />
            <XAxis type="number" dataKey="Likes" name="Likes" stroke="#444" fontSize={9} />
            <YAxis type="number" dataKey="Comments" name="Comments" stroke="#444" fontSize={9} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip borderColor="#00FF90" />} />
            <Scatter name="Packets" data={data} fill="#00FF90" fillOpacity={0.6} />
          </ScatterChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
};
