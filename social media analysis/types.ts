
export interface SocialData {
  Date: string;
  Engagement: number;
  Impressions: number;
  Shares: number;
  Likes: number;
  Comments: number;
  Sector: string;
  Platform: string;
  Hour: number;
}

export interface NTSResults {
  bestDay: string;
  bestHour: string;
  engagementScore: number;
  liftPercentage: number;
  secondaryWindow: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ForecastPoint {
  date: string;
  actual?: number;
  predicted?: number;
}
