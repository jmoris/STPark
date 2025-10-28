import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { FuseCardComponent } from '@fuse/components/card';

import { ParkingSessionService } from 'app/core/services/parking-session.service';
import { SectorService } from 'app/core/services/sector.service';
import { OperatorService } from 'app/core/services/operator.service';
import { DebtService } from 'app/core/services/debt.service';
import { PrinterService } from 'app/core/services/printer.service';
import { 
  CreateSessionRequest,
  Sector,
  Operator,
  Street,
  OperatorAssignment,
  Debt
} from 'app/interfaces/parking.interface';
import { DebtAlertModalComponent } from './debt-alert-modal/debt-alert-modal.component';

@Component({
  selector: 'app-new-session',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    FuseCardComponent,
    DebtAlertModalComponent
  ],
  templateUrl: './new-session.component.html',
  styleUrls: ['./new-session.component.scss']
})
export class NewSessionComponent implements OnInit, OnDestroy {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  // Form
  sessionForm: FormGroup;
  loading = false;
  error: string | null = null;

  // Data
  sectors: Sector[] = [];
  operators: Operator[] = [];
  streets: Street[] = [];
  operatorAssignments: OperatorAssignment[] = [];

  // Current user (simulado)
  currentOperator: Operator | null = null;

  // Debt alert modal
  showDebtAlert = false;
  pendingDebts: Debt[] = [];
  currentPlate: string = '';

  constructor(
    private fb: FormBuilder,
    private sessionService: ParkingSessionService,
    private sectorService: SectorService,
    private operatorService: OperatorService,
    private debtService: DebtService,
    private printerService: PrinterService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.sessionForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadSectors();
    this.loadOperators();
    this.setupFormSubscriptions();
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  createForm(): FormGroup {
    return this.fb.group({
      plate: ['', [Validators.required, Validators.pattern(/^[A-Z0-9]+$/i)]],
      sector_id: ['', Validators.required],
      street_id: [null, Validators.required],
      operator_id: ['', Validators.required]
    });
  }

  setupFormSubscriptions(): void {
    // Cuando cambia el sector, cargar calles y filtrar operadores
    this.sessionForm.get('sector_id')?.valueChanges
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe(sectorId => {
        if (sectorId) {
          // Resetear valores primero
          this.sessionForm.patchValue({ street_id: null, operator_id: '' });
          // Cargar calles
          this.loadStreetsBySector(sectorId);
        } else {
          this.streets = [];
          this.operators = [];
          this.sessionForm.patchValue({ street_id: null, operator_id: '' });
        }
      });

    // Cuando cambia la calle, filtrar operadores
    this.sessionForm.get('street_id')?.valueChanges
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe(streetId => {
        const sectorId = this.sessionForm.value.sector_id;
        if (sectorId && streetId) {
          this.filterOperatorsBySectorAndStreet(sectorId, streetId);
        } else if (!streetId) {
          this.operators = [];
        }
        // Resetear operator_id pero sin disparar eventos para evitar loops
        this.sessionForm.patchValue({ operator_id: '' }, { emitEvent: false });
      });
  }

  loadSectors(): void {
    this.sectorService.getSectors()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.sectors = (response.data as any)?.data || [];
        },
        error: (error) => {
          console.error('Error loading sectors:', error);
          this.snackBar.open('Error al cargar sectores', 'Cerrar', { duration: 3000 });
        }
      });
  }

  loadOperators(): void {
    this.operatorService.getOperators()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.operators = (response.data as any)?.data || [];
        },
        error: (error) => {
          console.error('Error loading operators:', error);
          this.snackBar.open('Error al cargar operadores', 'Cerrar', { duration: 3000 });
        }
      });
  }

  loadStreetsBySector(sectorId: number): void {
    if (!sectorId) {
      this.streets = [];
      console.log('No sector selected, clearing streets');
      return;
    }

    console.log('Loading streets for sector:', sectorId);
    this.sectorService.getSectorStreets(sectorId)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          // El backend retorna el array directamente en data (sin paginación)
          this.streets = response.data || [];
          console.log('Streets loaded for sector', sectorId, ':', this.streets.length, 'streets');
          
          // Seleccionar automáticamente la primera calle
          if (this.streets.length > 0) {
            this.sessionForm.patchValue({ street_id: this.streets[0].id });
            console.log('Auto-selected first street:', this.streets[0].id);
          } else {
            this.sessionForm.patchValue({ street_id: null });
          }
        },
        error: (error) => {
          console.error('Error loading streets:', error);
          this.streets = [];
          this.sessionForm.patchValue({ street_id: null });
        }
      });
  }

  filterOperatorsBySector(sectorId: number): void {
    if (!sectorId) {
      this.operators = [];
      return;
    }

    // Filtrar operadores que tienen asignación al sector
    this.operatorService.getOperators()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.operators = ((response.data as any)?.data || []).filter((operator: any) => 
            operator.sectors?.some((sector: any) => 
              sector.id === sectorId && this.isAssignmentValid(sector.pivot)
            )
          );
        },
        error: (error) => {
          console.error('Error filtering operators:', error);
          this.operators = [];
        }
      });
  }

  filterOperatorsBySectorAndStreet(sectorId: number, streetId?: number): void {
    if (!sectorId) {
      this.operators = [];
      return;
    }

    // Filtrar operadores que tienen asignación al sector y calle específica
    this.operatorService.getOperators()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.operators = ((response.data as any)?.data || []).filter((operator: any) => 
            operator.operator_assignments?.some((assignment: any) => {
              const hasSectorAccess = assignment.sector_id === sectorId;
              const hasStreetAccess = !streetId || !assignment.street_id || assignment.street_id === streetId;
              return hasSectorAccess && hasStreetAccess && this.isAssignmentValid(assignment);
            })
          );
        },
        error: (error) => {
          console.error('Error filtering operators:', error);
          this.operators = [];
        }
      });
  }

  isAssignmentValid(assignment: OperatorAssignment): boolean {
    const now = new Date();
    const validFrom = new Date(assignment.valid_from);
    const validTo = assignment.valid_to ? new Date(assignment.valid_to) : null;
    
    return validFrom <= now && (!validTo || validTo >= now);
  }

  onSubmit(): void {
    if (this.sessionForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    // Validar formato de patente
    const plate = this.sessionForm.value.plate.toUpperCase();
    if (!this.sessionService.validateChileanPlate(plate)) {
      this.snackBar.open('Formato de patente inválido', 'Cerrar', { duration: 3000 });
      return;
    }

    // Verificar deudas pendientes antes de crear la sesión
    this.checkPendingDebts(plate);
  }

  checkPendingDebts(plate: string): void {
    this.loading = true;
    this.error = null;

    this.debtService.getDebtsByPlate(plate)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          const debts = response.data || [];
          const pendingDebts = debts.filter(debt => debt.status === 'PENDING');
          
          if (pendingDebts.length > 0) {
            // Mostrar modal de alerta
            this.pendingDebts = pendingDebts;
            this.currentPlate = plate;
            this.showDebtAlert = true;
            this.loading = false;
          } else {
            // No hay deudas pendientes, crear sesión directamente
            this.createSession(plate);
          }
        },
        error: (error) => {
          console.error('Error checking debts:', error);
          // En caso de error, continuar con la creación de sesión
          this.createSession(plate);
        }
      });
  }

  createSession(plate: string): void {
    this.loading = true;
    this.error = null;

    // Obtener el valor de street_id y convertirlo a null si está vacío o undefined
    const streetIdValue = this.sessionForm.value.street_id;
    const streetId = (streetIdValue && streetIdValue !== '') ? streetIdValue : null;

    const request: CreateSessionRequest = {
      plate: plate,
      sector_id: this.sessionForm.value.sector_id,
      street_id: streetId,
      operator_id: this.sessionForm.value.operator_id
    };

    this.sessionService.createSession(request)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.snackBar.open('Sesión creada exitosamente', 'Cerrar', { duration: 3000 });
          
          // Imprimir ticket de entrada automáticamente
          this.printEntryTicket(response.data);
          
          this.router.navigate(['/parking/sessions', response.data.id]);
        },
        error: (error) => {
          this.error = error.error?.message || 'Error al crear sesión';
          this.loading = false;
          console.error('Error creating session:', error);
          this.snackBar.open(this.error, 'Cerrar', { duration: 5000 });
        }
      });
  }

  onPayDebts(): void {
    // Redirigir al módulo de deudas para pagar
    this.router.navigate(['/parking/debts'], { 
      queryParams: { plate: this.currentPlate, filter: 'PENDING' }
    });
  }

  onContinueWithoutPayment(): void {
    // Crear sesión sin pagar las deudas
    this.createSession(this.currentPlate);
  }

  closeDebtAlert(): void {
    this.showDebtAlert = false;
    this.pendingDebts = [];
    this.currentPlate = '';
    this.loading = false;
  }

  markFormGroupTouched(): void {
    Object.keys(this.sessionForm.controls).forEach(key => {
      const control = this.sessionForm.get(key);
      control?.markAsTouched();
    });
  }

  onCancel(): void {
    this.router.navigate(['/parking/sessions']);
  }

  getFieldError(fieldName: string): string {
    const field = this.sessionForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return `${this.getFieldLabel(fieldName)} es requerido`;
      }
      if (field.errors['pattern']) {
        return `${this.getFieldLabel(fieldName)} tiene un formato inválido`;
      }
    }
    return '';
  }

  getFieldLabel(fieldName: string): string {
    const labels: Record<string, string> = {
      plate: 'Placa',
      sector_id: 'Sector',
      street_id: 'Calle',
      operator_id: 'Operador'
    };
    return labels[fieldName] || fieldName;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.sessionForm.get(fieldName);
    return !!(field?.invalid && field.touched);
  }

  formatPlate(event: any): void {
    const input = event.target;
    const value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.sessionForm.patchValue({ plate: value });
  }

  getSectorName(sectorId: number): string {
    const sector = this.sectors.find(s => s.id === sectorId);
    return sector ? sector.name : '';
  }

  getStreetName(streetId: number): string {
    const street = this.streets.find(s => s.id === streetId);
    return street ? street.name : '';
  }

  getOperatorName(operatorId: number): string {
    const operator = this.operators.find(o => o.id === operatorId);
    return operator ? operator.name : '';
  }

  hasStreets(): boolean {
    return this.streets.length > 0;
  }

  hasOperators(): boolean {
    return this.operators.length > 0;
  }

  /**
   * Imprimir ticket de entrada
   */
  private printEntryTicket(session: any): void {
    this.printerService.printEntryTicket(session)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (result) => {
          if (result.printed) {
            this.snackBar.open('Ticket de entrada impreso exitosamente', 'Cerrar', { duration: 3000 });
          } else {
            this.snackBar.open(result.message, 'Cerrar', { duration: 5000 });
          }
        },
        error: (error) => {
          console.error('Error printing entry ticket:', error);
          this.snackBar.open('Error al imprimir ticket de entrada', 'Cerrar', { duration: 3000 });
        }
      });
  }
}
