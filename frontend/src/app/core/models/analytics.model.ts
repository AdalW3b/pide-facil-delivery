export interface DailySaleData {
  date: string;       // e.g. '2026-08-24' or '24/08'
  revenue: number;    // total income e.g. 1250.50
  ordersCount?: number; // optional count of orders on that day
}

export interface KpiMetric {
  id: string;
  title: string;
  value: string;
  numericValue: number;
  changePercentage: number;
  isPositive: boolean;
  periodLabel: string;
  iconName: string;
}

export interface AnalyticsSummaryDTO {
  dailySales: DailySaleData[];
  totalSalesToday: number;
  salesGrowthPercentage: number;
  tablesServedToday: number;
  tablesGrowthPercentage: number;
  averageTicket: number;
  ticketGrowthPercentage: number;
  totalOrdersToday: number;
  ordersGrowthPercentage: number;
}
