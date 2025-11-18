import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { ParkingSessionService } from 'app/core/services/parking-session.service';
import { ParkingSession } from 'app/interfaces/parking.interface';
import { CheckoutModalComponent, CheckoutModalData } from '../checkout-modal/checkout-modal.component';

@Component({
  selector: 'app-session-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './session-detail.component.html',
  styleUrls: ['./session-detail.component.scss']
})
export class SessionDetailComponent implements OnInit, OnDestroy {
  private _unsubscribeAll: Subject<any> = new Subject<any>();
  private _intervalId: any;

  session: ParkingSession | null = null;
  loading = false;
  error: string | null = null;
  
  // Tiempo real para sesiones activas
  currentDuration = 0;
  estimatedCost = 0;
  isActiveSession = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sessionService: ParkingSessionService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadSession();
  }

  ngOnDestroy(): void {
    this.stopRealTimeCalculation();
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  loadSession(): void {
    this.loading = true;
    this.error = null;

    const sessionId = this.route.snapshot.paramMap.get('id');
    if (!sessionId) {
      this.error = 'ID de sesión no válido';
      this.loading = false;
      return;
    }

    this.sessionService.getSession(parseInt(sessionId))
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.session = response.data;
          this.loading = false;
          
          // Iniciar cálculo de tiempo real si la sesión está activa
          if (this.session?.status === 'ACTIVE') {
            this.isActiveSession = true;
            this.startRealTimeCalculation();
          } else {
            this.isActiveSession = false;
            this.stopRealTimeCalculation();
          }
        },
        error: (error) => {
          this.error = 'Error al cargar la sesión';
          this.loading = false;
          console.error('Error loading session:', error);
          this.snackBar.open('Error al cargar la sesión', 'Cerrar', { duration: 3000 });
        }
      });
  }

  goBack(): void {
    this.router.navigate(['/parking/sessions']);
  }

  checkoutSession(): void {
    if (!this.session || this.session.status !== 'ACTIVE') {
      this.snackBar.open('Solo se puede hacer checkout de sesiones activas', 'Cerrar', { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(CheckoutModalComponent, {
      width: '800px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: { session: this.session } as CheckoutModalData,
      disableClose: false
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        // Recargar la sesión para obtener el estado actualizado
        this.loadSession();
        this.snackBar.open('Checkout procesado exitosamente', 'Cerrar', { duration: 3000 });
      }
    });
  }

  paySession(): void {
    if (!this.session || this.session.status !== 'TO_PAY') {
      this.snackBar.open('Solo se pueden pagar sesiones pendientes de pago', 'Cerrar', { duration: 3000 });
      return;
    }

    this.router.navigate(['/parking/sessions', this.session.id, 'payment']);
  }

  formatAmount(amount: number): string {
    return this.sessionService.formatAmount(amount);
  }

  formatDate(date: string | null): string {
    if (!date) {
      return 'N/A';
    }
    
    const dateObj = new Date(date);
    
    // Verificar si la fecha es válida
    if (isNaN(dateObj.getTime())) {
      return 'N/A';
    }
    
    return dateObj.toLocaleString('es-CL');
  }

  formatDuration(seconds: number): string {
    return this.sessionService.formatDuration(seconds);
  }

  getStatusLabel(status: string): string {
    return this.sessionService.getStatusLabel(status);
  }

  getStatusColor(status: string): string {
    return this.sessionService.getStatusColor(status);
  }

  getPaymentIcon(status: string): string {
    const icons: Record<string, string> = {
      'PAID': 'check_circle',
      'TO_PAY': 'schedule',
      'ACTIVE': 'play_circle',
      'CANCELLED': 'cancel',
      'CANCELED': 'cancel',
      'COMPLETED': 'check_circle',
      'CLOSED': 'check_circle',
      'FORCED_CHECKOUT': 'warning',
      'CREATED': 'add_circle'
    };
    return icons[status] || 'help';
  }

  getPaymentStatusTitle(status: string): string {
    const titles: Record<string, string> = {
      'PAID': 'Sesión Pagada',
      'TO_PAY': 'Pendiente de Pago',
      'ACTIVE': 'Sesión Activa',
      'CANCELLED': 'Sesión Cancelada',
      'CANCELED': 'Sesión Cancelada',
      'COMPLETED': 'Sesión Completada',
      'CLOSED': 'Sesión Cerrada',
      'FORCED_CHECKOUT': 'Checkout Forzado',
      'CREATED': 'Sesión Creada'
    };
    return titles[status] || 'Estado Desconocido';
  }

  getPaymentStatusDescription(status: string): string {
    const descriptions: Record<string, string> = {
      'PAID': 'La sesión ha sido pagada exitosamente',
      'TO_PAY': 'La sesión está lista para ser pagada',
      'ACTIVE': 'La sesión está actualmente en curso',
      'CANCELLED': 'Esta sesión ha sido cancelada',
      'CANCELED': 'Esta sesión ha sido cancelada',
      'COMPLETED': 'La sesión ha sido completada y cerrada',
      'CLOSED': 'La sesión ha sido cerrada',
      'FORCED_CHECKOUT': 'La sesión fue cerrada sin pago (deuda creada)',
      'CREATED': 'Sesión recién creada'
    };
    return descriptions[status] || 'Estado no disponible';
  }

  formatPaymentMethod(method: string): string {
    const methods: Record<string, string> = {
      'CASH': 'Efectivo',
      'CARD': 'Tarjeta',
      'WEBPAY': 'Webpay',
      'TRANSFER': 'Transferencia'
    };
    return methods[method] || method;
  }

  /**
   * Iniciar cálculo de tiempo real para sesiones activas
   */
  startRealTimeCalculation(): void {
    this.stopRealTimeCalculation(); // Limpiar interval anterior si existe
    
    // Calcular inmediatamente
    this.calculateCurrentDuration();
    
    // Actualizar cada segundo
    this._intervalId = setInterval(() => {
      this.calculateCurrentDuration();
    }, 1000);
  }

  /**
   * Detener cálculo de tiempo real
   */
  stopRealTimeCalculation(): void {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  /**
   * Calcular duración actual y costo estimado
   */
  calculateCurrentDuration(): void {
    if (!this.session || this.session.status !== 'ACTIVE') {
      return;
    }

    const startTime = new Date(this.session.started_at);
    const currentTime = new Date();
    const durationInSeconds = Math.floor((currentTime.getTime() - startTime.getTime()) / 1000);
    
    this.currentDuration = durationInSeconds;
    this.estimatedCost = this.calculateEstimatedCost(durationInSeconds);
  }

  /**
   * Calcular costo estimado basado en la duración
   */
  calculateEstimatedCost(durationInSeconds: number): number {
    // Tarifa básica por hora (ejemplo: $1000 CLP por hora)
    const hourlyRate = 1000;
    
    // Calcular horas completas
    const hours = Math.floor(durationInSeconds / 3600);
    
    // Calcular minutos adicionales
    const remainingMinutes = Math.floor((durationInSeconds % 3600) / 60);
    
    // Tarifa por fracción de hora (15 minutos = $250 CLP)
    const quarterHourRate = hourlyRate / 4;
    const quarterHours = Math.ceil(remainingMinutes / 15);
    
    return (hours * hourlyRate) + (quarterHours * quarterHourRate);
  }

  /**
   * Obtener duración actual formateada
   */
  getCurrentDurationFormatted(): string {
    return this.formatDuration(this.currentDuration);
  }

  /**
   * Obtener costo estimado formateado
   */
  getEstimatedCostFormatted(): string {
    return this.formatAmount(this.estimatedCost);
  }
}
