function disabled(): never {
  throw new Error(
    'analyticsService is disabled (legacy Firebase implementation retired). Use the Supabase-backed analytics endpoints instead.'
  );
}

export interface AnalyticsData {
  totalScans: number;
  uniqueDevices: number;
  mostActiveCountry: string;
  topReferrer: string;
  scansByDay: Record<string, number>;
  scansByCountry: Record<string, number>;
  deviceBreakdown: Record<string, number>;
  scansByReferrer: Record<string, number>;
  scansByLocation: Record<string, number>;
  scanHistory?: unknown[];
}

export async function getAnalytics(
  _userId: string,
  _period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly',
  _startDate?: Date
): Promise<AnalyticsData> {
  disabled();
}

export async function getQRCodePerformanceSummary(_userId: string): Promise<{
  totalQRCodes: number;
  totalScans: number;
  topPerformingCodes: Array<{
    id: string;
    name: string;
    scans: number;
    conversionRate?: number;
  }>;
}> {
  disabled();
}

export async function getAnalyticsData(
  _userId: string,
  _startDate?: Date | null,
  _endDate?: Date | null
): Promise<AnalyticsData> {
  disabled();
}