import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil } from 'rxjs';

interface PaymentResultData {
  status: 'success' | 'failed' | 'cancelled' | 'error';
  invoice_id?: string;
  buy_order?: string;
  commerce_name?: string;
  amount?: string;
  currency?: string;
  authorization_code?: string;
  payment_date?: string;
  payment_type?: string;
  installments?: string;
  card_last4?: string;
  folio?: string;
  response_code?: string;
  error_message?: string;
  description?: string;
}

@Component({
  selector: 'app-payment-result',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './payment-result.component.html',
  styleUrls: ['./payment-result.component.scss']
})
export class PaymentResultComponent implements OnInit, OnDestroy {
  private _unsubscribeAll: Subject<any> = new Subject<any>();
  
  data: PaymentResultData | null = null;
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Leer parámetros de query string
    this.route.queryParams
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe(params => {
        this.data = {
          status: params['status'] || 'error',
          invoice_id: params['invoice_id'],
          buy_order: params['buy_order'],
          commerce_name: params['commerce_name'] || 'STPark',
          amount: params['amount'],
          currency: params['currency'] || 'CLP',
          authorization_code: params['authorization_code'],
          payment_date: params['payment_date'],
          payment_type: params['payment_type'],
          installments: params['installments'],
          card_last4: params['card_last4'],
          folio: params['folio'],
          response_code: params['response_code'],
          error_message: params['error_message'],
          description: params['description']
        };
        this.loading = false;
      });
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  formatAmount(amount: string | undefined): string {
    if (!amount) return 'N/A';
    const numAmount = parseFloat(amount);
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numAmount);
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  }

  goToInvoices(): void {
    this.router.navigate(['/invoices']);
  }

  isSuccess(): boolean {
    return this.data?.status === 'success';
  }

  isFailed(): boolean {
    return this.data?.status === 'failed';
  }

  isCancelled(): boolean {
    return this.data?.status === 'cancelled';
  }

  isError(): boolean {
    return this.data?.status === 'error';
  }
}



