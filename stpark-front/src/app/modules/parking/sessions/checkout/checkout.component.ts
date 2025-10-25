import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { FuseCardComponent } from '@fuse/components/card';
import { FuseConfirmationService } from '@fuse/services/confirmation';

import { ParkingSessionService } from 'app/core/services/parking-session.service';
import { PrinterService } from 'app/core/services/printer.service';
import { ParkingSession } from 'app/interfaces/parking.interface';
import { CheckoutModalComponent, CheckoutModalData } from '../checkout-modal/checkout-modal.component';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDividerModule,
    MatChipsModule,
    MatDialogModule,
    FuseCardComponent
  ],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent implements OnInit, OnDestroy {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  session: ParkingSession | null = null;
  checkoutForm: FormGroup;
  loading = false;
  error: string | null = null;
  calculating = false;
  quote: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private sessionService: ParkingSessionService,
    private printerService: PrinterService,
    private snackBar: MatSnackBar,
    private confirmationService: FuseConfirmationService,
    private dialog: MatDialog
  ) {
    this.checkoutForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadSession();
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      discount_code: [''],
      notes: [''],
      payment_method: ['CASH', Validators.required],
      amount: ['0', [Validators.required, Validators.min(0)]]
    });
  }

  loadSession(): void {
    const sessionId = this.route.snapshot.paramMap.get('id');
    if (!sessionId) {
      this.router.navigate(['/parking/sessions']);
      return;
    }

    this.loading = true;
    this.error = null;

    this.sessionService.getSession(+sessionId)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.session = response.data;
          if (this.session?.status !== 'ACTIVE') {
            this.snackBar.open('Solo se puede hacer checkout de sesiones activas', 'Cerrar', { duration: 3000 });
            this.router.navigate(['/parking/sessions']);
            return;
          }
          this.loadQuote();
          this.loading = false;
        },
        error: (error) => {
          this.error = 'Error al cargar sesión';
          this.loading = false;
          console.error('Error loading session:', error);
          this.snackBar.open('Error al cargar sesión', 'Cerrar', { duration: 3000 });
        }
      });
  }

  loadQuote(): void {
    if (!this.session) return;

    this.calculating = true;
    // Usar la hora actual como hora de cierre
    const endedAt = new Date().toISOString();
    this.sessionService.getQuote(this.session.id, { ended_at: endedAt })
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.quote = response.data;
          this.calculating = false;
          // Configurar el campo de monto según el método de pago
          this.onPaymentMethodChange();
        },
        error: (error) => {
          this.calculating = false;
          console.error('Error calculating quote:', error);
          this.snackBar.open('Error al calcular cotización', 'Cerrar', { duration: 3000 });
        }
      });
  }

  onApplyDiscount(): void {
    if (!this.session || !this.checkoutForm.get('discount_code')?.value) return;

    this.calculating = true;
    const discountCode = this.checkoutForm.get('discount_code')?.value;
    // Usar la hora actual como hora de cierre
    const endedAt = new Date().toISOString();
    
    this.sessionService.getQuote(this.session.id, { 
      ended_at: endedAt,
      discount_code: discountCode 
    })
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.quote = response.data;
          this.calculating = false;
          // No actualizar automáticamente el monto, dejar que el usuario lo llene
          this.snackBar.open('Descuento aplicado correctamente', 'Cerrar', { duration: 3000 });
        },
        error: (error) => {
          this.calculating = false;
          console.error('Error applying discount:', error);
          this.snackBar.open('Error al aplicar descuento', 'Cerrar', { duration: 3000 });
        }
      });
  }

  onCheckout(): void {
    if (!this.session || !this.quote) return;

    const confirmation = this.confirmationService.open({
      title: 'Confirmar Checkout',
      message: `¿Está seguro de procesar el checkout para la placa ${this.session.plate}?<br>
                <strong>Monto a cobrar:</strong> ${this.formatAmount(this.quote.net_amount)}`,
      icon: {
        show: true,
        name: 'heroicons_outline:currency-dollar',
        color: 'primary'
      },
      actions: {
        confirm: {
          show: true,
          label: 'Procesar Checkout',
          color: 'primary'
        },
        cancel: {
          show: true,
          label: 'Cancelar'
        }
      }
    });

    confirmation.afterClosed().subscribe(result => {
      if (result === 'confirmed') {
        this.processCheckout();
      }
    });
  }

  processCheckout(): void {
    if (!this.session || !this.checkoutForm.valid) return;

    this.loading = true;
    const checkoutData = {
      payment_method: this.checkoutForm.get('payment_method')?.value,
      amount: this.getNumericAmount(),
      discount_code: this.checkoutForm.get('discount_code')?.value || null,
      notes: this.checkoutForm.get('notes')?.value || null
    };

    this.sessionService.checkoutSession(this.session.id, checkoutData)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.loading = false;
          this.snackBar.open('Checkout procesado exitosamente', 'Cerrar', { duration: 3000 });
          
          // Imprimir ticket de salida automáticamente
          this.printExitTicket(response.data, checkoutData);
          
          this.router.navigate(['/parking/sessions']);
        },
        error: (error) => {
          this.loading = false;
          console.error('Error processing checkout:', error);
          this.snackBar.open('Error al procesar checkout', 'Cerrar', { duration: 3000 });
        }
      });
  }

  onBack(): void {
    const sessionId = this.route.snapshot.paramMap.get('id');
    if (sessionId) {
      this.router.navigate(['/parking/sessions', sessionId]);
    } else {
      this.router.navigate(['/parking/sessions']);
    }
  }

  openPaymentModal(): void {
    if (!this.session || !this.quote) {
      this.snackBar.open('No se puede procesar el pago sin datos de sesión', 'Cerrar', { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(CheckoutModalComponent, {
      width: '800px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: { session: this.session, quote: this.quote } as CheckoutModalData,
      disableClose: false
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        // Recargar la sesión para obtener el estado actualizado
        this.loadSession();
        this.snackBar.open('Pago procesado exitosamente', 'Cerrar', { duration: 3000 });
        // Navegar de vuelta a la lista de sesiones
        this.router.navigate(['/parking/sessions']);
      }
    });
  }

  formatAmount(amount: number): string {
    return this.sessionService.formatAmount(amount);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('es-CL');
  }

  formatDateTime(date: string | null): string {
    if (!date) {
      return 'N/A';
    }
    
    const dateObj = new Date(date);
    
    // Verificar si la fecha es válida
    if (isNaN(dateObj.getTime())) {
      return 'N/A';
    }
    
    const dateStr = dateObj.toLocaleDateString('es-CL', { 
      day: '2-digit', 
      month: '2-digit', 
      year: '2-digit' 
    });
    const timeStr = dateObj.toLocaleTimeString('es-CL', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    return `${dateStr} ${timeStr}`;
  }

  formatDuration(seconds: number): string {
    return this.sessionService.formatDuration(seconds);
  }

  formatDurationFromMinutes(minutes: number): string {
    if (minutes < 60) {
      return `${Math.round(minutes)} minutos`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = Math.round(minutes % 60);
      if (remainingMinutes === 0) {
        return `${hours} hora${hours > 1 ? 's' : ''}`;
      } else {
        return `${hours} hora${hours > 1 ? 's' : ''} ${remainingMinutes} minuto${remainingMinutes > 1 ? 's' : ''}`;
      }
    }
  }

  getStatusLabel(status: string): string {
    return this.sessionService.getStatusLabel(status);
  }

  getStatusColor(status: string): string {
    return this.sessionService.getStatusColor(status);
  }

  /**
   * Obtener valor numérico del campo amount
   */
  getNumericAmount(): number {
    const amountValue = this.checkoutForm.get('amount')?.value;
    if (typeof amountValue === 'string') {
      return parseInt(amountValue.replace(/[^\d]/g, '')) || 0;
    }
    return amountValue || 0;
  }

  /**
   * Calcular el vuelto para pagos en efectivo
   */
  calculateChange(): number {
    const paymentMethod = this.checkoutForm.get('payment_method')?.value;
    const amountPaid = this.getNumericAmount();
    const amountToCharge = this.quote?.net_amount || 0;

    if (paymentMethod === 'CASH' && amountPaid > amountToCharge) {
      return amountPaid - amountToCharge;
    }
    return 0;
  }

  /**
   * Cálcular cuánto dinero falta para completar el pago
   */
  calculateAmountMissing(): number {
    const paymentMethod = this.checkoutForm.get('payment_method')?.value;
    const amountPaid = this.getNumericAmount();
    const amountToCharge = this.quote?.net_amount || 0;

    if (paymentMethod === 'CASH' && amountPaid < amountToCharge) {
      return amountToCharge - amountPaid;
    }
    return 0;
  }

  /**
   * Verificar si debe mostrar el vuelto
   */
  shouldShowChange(): boolean {
    const paymentMethod = this.checkoutForm.get('payment_method')?.value;
    const amountPaid = this.getNumericAmount();
    const amountToCharge = this.quote?.net_amount || 0;

    return paymentMethod === 'CASH' && amountPaid > amountToCharge;
  }

  /**
   * Verificar si debe mostrar el monto faltante
   */
  shouldShowMissingAmount(): boolean {
    const paymentMethod = this.checkoutForm.get('payment_method')?.value;
    const amountPaid = this.getNumericAmount();
    const amountToCharge = this.quote?.net_amount || 0;

    return paymentMethod === 'CASH' && amountPaid < amountToCharge;
  }

  /**
   * Verificar si el monto es insuficiente para el pago
   */
  isAmountInsufficient(): boolean {
    const paymentMethod = this.checkoutForm.get('payment_method')?.value;
    const amountPaid = this.getNumericAmount();
    const amountToCharge = this.quote?.net_amount || 0;

    return paymentMethod === 'CASH' && amountPaid < amountToCharge;
  }

  /**
   * Validador personalizado para verificar monto suficiente en efectivo
   */
  validateAmountSufficient(control: any) {
    const amountPaid = control.value;
    const paymentMethod = this.checkoutForm?.get('payment_method')?.value;
    const amountToCharge = this.quote?.net_amount || 0;

    if (paymentMethod === 'CASH' && amountPaid < amountToCharge) {
      return { insufficientAmount: true };
    }
    return null;
  }

  /**
   * Obtener mensaje de error para validación
   */
  getAmountErrorMessage(): string {
    const amountControl = this.checkoutForm.get('amount');
    if (amountControl?.hasError('required')) {
      return 'El monto es requerido';
    }
    if (amountControl?.hasError('min')) {
      return 'El monto debe ser mayor a 0';
    }
    if (amountControl?.hasError('insufficientAmount')) {
      const amountToCharge = this.quote?.net_amount || 0;
      return `El monto debe ser al menos ${this.formatAmount(amountToCharge)}`;
    }
    return '';
  }

  /**
   * Formatear input de moneda con separadores de miles (formato Chile)
   */
  formatCurrencyInput(event: any): void {
    const input = event.target;
    let value = input.value.replace(/[^\d]/g, ''); // Solo números
    
    if (value) {
      // Formatear con puntos como separador de miles (formato Chile)
      const formattedValue = parseInt(value).toLocaleString('es-CL');
      input.value = formattedValue;
      
      // Actualizar el valor del formulario con el número sin formato
      this.checkoutForm.patchValue({ amount: parseInt(value) });
    } else {
      this.checkoutForm.patchValue({ amount: 0 });
    }
  }

  /**
   * Actualizar campo de monto con formato
   */
  updateAmountField(amount: number): void {
    const formattedAmount = amount.toLocaleString('es-CL');
    this.checkoutForm.patchValue({ amount: formattedAmount });
  }

  /**
   * Llenar el monto exacto a cobrar
   */
  fillExactAmount(): void {
    if (this.quote?.net_amount) {
      this.updateAmountField(this.quote.net_amount);
    }
  }

  /**
   * Manejar evento blur del campo de monto
   */
  onAmountBlur(): void {
    const amountControl = this.checkoutForm.get('amount');
    const currentValue = amountControl?.value;
    
    if (currentValue && typeof currentValue === 'string') {
      // Convertir string formateado a número
      const numericValue = parseInt(currentValue.replace(/[^\d]/g, ''));
      if (numericValue) {
        this.checkoutForm.patchValue({ amount: numericValue });
      }
    }
  }

  /**
   * Obtener hora actual formateada
   */
  getCurrentTime(): string {
    return new Date().toLocaleString('es-CL');
  }

  /**
   * Manejar cambio de método de pago
   */
  onPaymentMethodChange(): void {
    const paymentMethod = this.checkoutForm.get('payment_method')?.value;
    
    if (paymentMethod === 'CASH') {
      // Efectivo: campo editable con valor 0
      this.checkoutForm.get('amount')?.setValue('0');
      this.checkoutForm.get('amount')?.enable();
    } else {
      // Tarjeta/Transferencia: campo readonly con monto exacto
      if (this.quote?.net_amount) {
        this.updateAmountField(this.quote.net_amount);
        this.checkoutForm.get('amount')?.disable();
      }
    }
  }

  /**
   * Obtener tarifa por minuto desde el breakdown
   */
  getRatePerMinute(): string {
    if (!this.quote?.breakdown || this.quote.breakdown.length === 0) {
      return 'N/A';
    }
    
    // Buscar la primera regla con rate_per_minute válido
    const ruleWithRate = this.quote.breakdown.find(rule => rule.rate_per_minute && rule.rate_per_minute > 0);
    
    if (ruleWithRate) {
      return this.formatAmount(ruleWithRate.rate_per_minute) + '/min';
    }
    
    return 'N/A';
  }

  /**
   * Verificar si hay máximo diario configurado
   */
  hasDailyMaxAmount(): boolean {
    if (!this.quote?.breakdown || this.quote.breakdown.length === 0) {
      return false;
    }
    
    // Buscar si alguna regla tiene daily_max_amount
    return this.quote.breakdown.some(rule => rule.daily_max_amount && rule.daily_max_amount > 0);
  }

  /**
   * Obtener el máximo diario desde el breakdown
   */
  getDailyMaxAmount(): string {
    if (!this.quote?.breakdown || this.quote.breakdown.length === 0) {
      return 'N/A';
    }
    
    // Buscar la primera regla con daily_max_amount válido
    const ruleWithMax = this.quote.breakdown.find(rule => rule.daily_max_amount && rule.daily_max_amount > 0);
    
    if (ruleWithMax) {
      return this.formatAmount(ruleWithMax.daily_max_amount);
    }
    
    return 'N/A';
  }

  /**
   * Verificar si el campo de monto debe estar deshabilitado
   */
  isAmountFieldDisabled(): boolean {
    const paymentMethod = this.checkoutForm.get('payment_method')?.value;
    return paymentMethod !== 'CASH';
  }

  // Estado del desglose de reglas
  breakdownExpanded = false;

  /**
   * Alternar la expansión del desglose de reglas
   */
  toggleBreakdown(): void {
    this.breakdownExpanded = !this.breakdownExpanded;
    console.log('Breakdown expanded:', this.breakdownExpanded);
  }

  /**
   * Imprimir ticket de salida
   */
  private printExitTicket(session: any, paymentData: any): void {
    if (!this.quote) return;

    this.printerService.printExitTicket(session, this.quote, paymentData)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (result) => {
          if (result.printed) {
            this.snackBar.open('Ticket de salida impreso exitosamente', 'Cerrar', { duration: 3000 });
          } else {
            this.snackBar.open(result.message, 'Cerrar', { duration: 5000 });
          }
        },
        error: (error) => {
          console.error('Error printing exit ticket:', error);
          this.snackBar.open('Error al imprimir ticket de salida', 'Cerrar', { duration: 3000 });
        }
      });
  }
}