import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaymentMethod } from '../models/payment-method.model';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly http = inject(HttpClient);

  getPaymentMethods(branchId: string): Observable<PaymentMethod[]> {
    return this.http.get<PaymentMethod[]>(`${environment.apiUrl}/branches/${branchId}/payment-methods`);
  }

  createPaymentMethod(branchId: string, name: string, instructions?: string): Observable<PaymentMethod> {
    return this.http.post<PaymentMethod>(`${environment.apiUrl}/branches/${branchId}/payment-methods`, { name, instructions });
  }

  updatePaymentMethod(branchId: string, id: string | number, name: string, instructions?: string): Observable<PaymentMethod> {
    return this.http.put<PaymentMethod>(`${environment.apiUrl}/branches/${branchId}/payment-methods/${id}`, { name, instructions });
  }

  togglePaymentMethod(branchId: string, id: string | number): Observable<PaymentMethod> {
    return this.http.patch<PaymentMethod>(`${environment.apiUrl}/branches/${branchId}/payment-methods/${id}/toggle`, {});
  }
}
