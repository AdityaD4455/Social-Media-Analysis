
import { SocialData, NTSResults, ForecastPoint } from '../types';

export const processCSVData = (rawData: any[]): SocialData[] => {
  return rawData.map(row => ({
    Date: row.Date || row.date || new Date().toISOString(),
    Engagement: Number(row.Engagement || row.engagement || 0),
    Impressions: Number(row.Impressions || row.impressions || 0),
    Shares: Number(row.Shares || row.shares || 0),
    Likes: Number(row.Likes || row.likes || 0),
    Comments: Number(row.Comments || row.comments || 0),
    Sector: row.Sector || row.sector || 'General',
    Platform: row.Platform || row.platform || 'Unknown',
    Hour: row.Hour ? Number(row.Hour) : (new Date(row.Date).getHours() || 0),
  }));
};

export const calculateNTS = (data: SocialData[]): NTSResults => {
  if (!data.length) return { bestDay: 'N/A', bestHour: 'N/A', engagementScore: 0, liftPercentage: 0, secondaryWindow: 'N/A' };

  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const intersectionMap: Record<string, number[]> = {};
  const globalEngagements: number[] = [];

  data.forEach(item => {
    const d = new Date(item.Date);
    const day = weekDays[d.getDay()];
    const hr = item.Hour;
    const key = `${day}|${hr}`;

    if (!intersectionMap[key]) intersectionMap[key] = [];
    intersectionMap[key].push(item.Engagement);
    globalEngagements.push(item.Engagement);
  });

  const baselineAverage = globalEngagements.reduce((a, b) => a + b, 0) / globalEngagements.length;

  const rankings = Object.entries(intersectionMap)
    .map(([key, vals]) => {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      return { key, avg };
    })
    .sort((a, b) => b.avg - a.avg);

  const best = rankings[0];
  const secondary = rankings[1] || rankings[0];
  
  const [bestDay, bestHourRaw] = best.key.split('|');
  const [secDay, secHourRaw] = secondary.key.split('|');
  
  const lift = ((best.avg - baselineAverage) / baselineAverage) * 100;

  return {
    bestDay: bestDay,
    bestHour: `${bestHourRaw.padStart(2, '0')}:00`,
    engagementScore: Math.round(best.avg),
    liftPercentage: Math.round(lift),
    secondaryWindow: `${secDay} @ ${secHourRaw.padStart(2, '0')}:00`
  };
};

export const generateNeuralForecast = (data: SocialData[]): ForecastPoint[] => {
  if (data.length < 2) return [];
  
  const sorted = [...data].sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());
  const lastDate = new Date(sorted[sorted.length - 1].Date);
  
  // Removed .slice(-20) to include all historical data for better alignment with other charts
  const points: ForecastPoint[] = sorted.map(d => ({
    date: d.Date.split('T')[0],
    actual: d.Engagement
  }));

  let lastVal = points[points.length - 1].actual || 100;
  const trend = (lastVal - (points[0].actual || 0)) / points.length;

  for (let i = 1; i <= 10; i++) {
    const nextDate = new Date(lastDate);
    nextDate.setDate(lastDate.getDate() + i);
    points.push({
      date: nextDate.toISOString().split('T')[0],
      predicted: Math.max(0, lastVal + (trend * i) + (Math.random() * 20 - 10))
    });
  }

  return points;
};

export const generateRichSummary = (data: SocialData[], nts: NTSResults): string => {
  if (!data.length) return "Fleet data unavailable.";

  const totalEng = data.reduce((a, b) => a + b.Engagement, 0);
  const avgEng = totalEng / data.length;
  const totalImp = data.reduce((a, b) => a + b.Impressions, 0);
  
  const platformStats = data.reduce((acc, curr) => {
    acc[curr.Platform] = (acc[curr.Platform] || 0) + curr.Engagement;
    return acc;
  }, {} as Record<string, number>);

  const sectorStats = data.reduce((acc, curr) => {
    acc[curr.Sector] = (acc[curr.Sector] || 0) + curr.Engagement;
    return acc;
  }, {} as Record<string, number>);

  const topPlatform = Object.entries(platformStats).sort((a, b) => b[1] - a[1])[0];
  const topSector = Object.entries(sectorStats).sort((a, b) => b[1] - a[1])[0];

  return `
    Mission Status: Active
    Total Neural Packets Analyzed: ${data.length}
    Global Fleet Engagement: ${totalEng.toLocaleString()} (Avg: ${avgEng.toFixed(1)})
    Total Neural Reach (Impressions): ${totalImp.toLocaleString()}
    Top Sector: ${topSector ? topSector[0] : 'None'} (${topSector ? topSector[1] : 0} eng)
    Dominant Platform: ${topPlatform ? topPlatform[0] : 'None'} (${topPlatform ? topPlatform[1] : 0} eng)
    Optimal Sync Window (NTS): ${nts.bestDay} at ${nts.bestHour}
    NTS Lift Potential: ${nts.liftPercentage}% above baseline.
    Secondary Sync: ${nts.secondaryWindow}
  `.trim();
};
