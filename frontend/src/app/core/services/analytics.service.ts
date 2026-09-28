import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { DailySaleData, AnalyticsSummaryDTO } from '../models/analytics.model';

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/analytics`;

  /**
   * Consumes GET /api/v1/analytics/sales/daily
   * @param startDate Optional ISO date string (YYYY-MM-DD)
   * @param endDate Optional ISO date string (YYYY-MM-DD)
   * @param branchId Optional branch ID filter (omitted if 'all branches')
   * @param restaurantId Optional restaurant ID filter
   */
  getDailySales(startDate?: string, endDate?: string, branchId?: string | number, restaurantId?: string | number): Observable<DailySaleData[]> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    if (restaurantId && restaurantId !== '') params = params.set('restaurantId', restaurantId.toString());
    if (branchId && branchId !== '' && branchId !== 'null' && branchId !== null) {
      params = params.set('branchId', branchId.toString());
    }

    return this.http.get<DailySaleData[] | any>(`${this.apiUrl}/sales/daily`, { params }).pipe(
      map((res) => {
        // Handle array response or nested data key
        const dataList: any[] = Array.isArray(res) ? res : (res?.data || res?.content || []);
        
        return dataList.map((item) => ({
          date: item.date || item.saleDate || item.day || '',
          revenue: Number(item.revenue || item.totalSales || item.total || item.amount || 0),
          ordersCount: item.ordersCount ? Number(item.ordersCount) : undefined
        }));
      }),
      catchError((error) => {
        console.error('Error in GET /api/v1/analytics/sales/daily:', error);
        return of([]);
      })
    );
  }

  /**
   * Fetches full analytics summary for KPI widgets and dashboard stats
   */
  getAnalyticsSummary(branchId?: string | number, restaurantId?: string | number): Observable<AnalyticsSummaryDTO> {
    let params = new HttpParams();
    if (restaurantId && restaurantId !== '') params = params.set('restaurantId', restaurantId.toString());
    if (branchId && branchId !== '' && branchId !== 'null' && branchId !== null) {
      params = params.set('branchId', branchId.toString());
    }

    return this.http.get<AnalyticsSummaryDTO>(`${this.apiUrl}/summary`, { params }).pipe(
      catchError((error) => {
        console.error('Error in GET /api/v1/analytics/summary:', error);
        return of({
          dailySales: [],
          totalSalesToday: 0,
          salesGrowthPercentage: 0,
          tablesServedToday: 0,
          tablesGrowthPercentage: 0,
          averageTicket: 0,
          ticketGrowthPercentage: 0,
          totalOrdersToday: 0,
          ordersGrowthPercentage: 0,
        });
      })
    );
  }
}
