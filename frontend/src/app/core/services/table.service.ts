import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class TableService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = environment.apiUrl;

  /**
   * Creates a new table for a specific branch
   * @param branchId Branch UUID string
   * @param tableNumber Target table number
   * @returns Observable of the created table DTO response
   */
  createTable(branchId: string, tableNumber: number): Observable<any> {
    return this.http.post<any>(`${this.apiBase}/branches/${branchId}/tables`, {
      tableNumber,
      capacity: 4 // Optional default capacity
    });
  }

  /**
   * Creates multiple new tables in bulk for a specific branch
   * @param branchId Branch UUID string
   * @param tableNumbers List of target table numbers
   * @returns Observable of the created bulk response DTO
   */
  createTablesBulk(branchId: string, tableNumbers: number[]): Observable<any> {
    return this.http.post<any>(`${this.apiBase}/branches/${branchId}/tables/bulk`, {
      tableNumbers
    });
  }
}
