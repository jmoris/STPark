import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatPaginatorModule, PageEvent, MatPaginatorIntl } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { FuseConfirmationService } from '@fuse/services/confirmation';

import { PricingProfileService } from 'app/core/services/pricing-profile.service';
import { SectorService } from 'app/core/services/sector.service';
import { PricingProfile, PricingRule, Sector, PricingProfileFilters } from 'app/interfaces/parking.interface';
import { getSpanishPaginatorIntl } from 'app/core/providers/spanish-paginator-intl';

@Component({
  selector: 'app-pricing-profiles',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatPaginatorModule,
    MatSortModule,
    MatChipsModule,
    MatMenuModule,
    MatDatepickerModule,
    MatCheckboxModule
  ],
  providers: [
    { provide: MatPaginatorIntl, useValue: getSpanishPaginatorIntl() }
  ],
  templateUrl: './pricing-profiles.component.html',
  styleUrls: ['./pricing-profiles.component.scss']
})
export class PricingProfilesComponent implements OnInit, OnDestroy, AfterViewInit {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  @ViewChild(MatSort) sort!: MatSort;

  pricingProfiles: PricingProfile[] = [];
  sectors: Sector[] = [];
  loading = false;
  error: string | null = null;

  // Paginación
  totalItems = 0;
  pageSize = 10;
  currentPage = 0;
  pageSizeOptions = [5, 10, 25, 50];

  // Ordenamiento
  sortBy: string = 'name';
  sortOrder: 'asc' | 'desc' = 'asc';

  // Filtros
  filters: PricingProfileFilters = {
    sector_id: undefined,
    name: '',
    is_active: undefined
  };

  // Formulario
  profileForm: FormGroup;
  showForm = false;
  editingProfile: PricingProfile | null = null;

  // Gestión de reglas
  showRulesModal = false;
  showRuleForm = false;
  selectedProfile: PricingProfile | null = null;
  pricingRules: PricingRule[] = [];
  editingRule: PricingRule | null = null;
  ruleForm: FormGroup;
  selectedDays: number[] = [];

  daysOfWeek = [
    { value: 0, label: 'Domingo' },
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' }
  ];

  ruleColumns: string[] = [
    'name',
    'rule_type',
    'duration',
    'price',
    'days',
    'time',
    'status',
    'actions'
  ];

  displayedColumns: string[] = [
    'name',
    'sector',
    'active_from',
    'active_to',
    'status',
    'rules_count',
    'actions'
  ];

  constructor(
    private pricingProfileService: PricingProfileService,
    private sectorService: SectorService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private confirmationService: FuseConfirmationService
  ) {
    this.profileForm = this.createForm();
    this.ruleForm = this.createRuleForm();
  }

  ngOnInit(): void {
    this.loadSectors();
    this.loadPricingProfiles();
  }

  ngAfterViewInit(): void {
    // Suscribirse a cambios de ordenamiento
    if (this.sort) {
      this.sort.sortChange
        .pipe(takeUntil(this._unsubscribeAll))
        .subscribe(sort => {
          this.sortBy = sort.active;
          this.sortOrder = sort.direction === 'asc' ? 'asc' : 'desc';
          this.currentPage = 0; // Reset a la primera página al cambiar ordenamiento
          this.loadPricingProfiles();
        });
    }
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      sector_id: ['', [Validators.required]],
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      active_from: [new Date(), [Validators.required]],
      active_to: [null],
      is_active: [true]
    });
  }

  loadSectors(): void {
    this.sectorService.getSectors()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.sectors = (response.data as any)?.data || response.data || [];
        },
        error: (error) => {
          console.error('Error loading sectors:', error);
        }
      });
  }

  loadPricingProfiles(): void {
    this.loading = true;
    const params: any = {
      page: this.currentPage + 1,
      per_page: this.pageSize,
      sort_by: this.sortBy,
      sort_order: this.sortOrder
    };

    if (this.filters.name && this.filters.name.trim() !== '') {
      params.name = this.filters.name;
    }
    if (this.filters.sector_id !== undefined) {
      params.sector_id = this.filters.sector_id;
    }
    if (this.filters.is_active !== undefined) {
      params.is_active = this.filters.is_active;
    }

    this.pricingProfileService.getPricingProfiles(params)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.pricingProfiles = (response.data as any)?.data || [];
          this.totalItems = (response.data as any)?.total || 0;
          this.loading = false;
        },
        error: (error) => {
          this.error = 'Error al cargar perfiles de precios';
          this.loading = false;
          console.error('Error loading pricing profiles:', error);
          this.snackBar.open('Error al cargar perfiles de precios', 'Cerrar', { duration: 3000 });
        }
      });
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadPricingProfiles();
  }

  applyFilters(): void {
    this.currentPage = 0;
    this.loadPricingProfiles();
  }

  clearFilters(): void {
    this.filters = {
      sector_id: undefined,
      name: '',
      is_active: undefined
    };
    this.currentPage = 0;
    this.loadPricingProfiles();
  }

  createProfile(): void {
    this.editingProfile = null;
    this.profileForm.reset();
    this.profileForm.patchValue({
      active_from: new Date(),
      is_active: true
    });
    this.showForm = true;
  }

  editProfile(profile: PricingProfile): void {
    this.editingProfile = profile;
    this.profileForm.patchValue({
      sector_id: profile.sector_id,
      name: profile.name,
      description: profile.description,
      active_from: new Date(profile.active_from),
      active_to: profile.active_to ? new Date(profile.active_to) : null,
      is_active: profile.is_active
    });
    this.showForm = true;
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const formData = this.profileForm.value;
    const profileData = {
      ...formData,
      active_from: formData.active_from.toISOString(),
      active_to: formData.active_to ? formData.active_to.toISOString() : null
    };

    const operation = this.editingProfile 
      ? this.pricingProfileService.updatePricingProfile(this.editingProfile.id!, profileData)
      : this.pricingProfileService.createPricingProfile(profileData);

    operation
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.snackBar.open(
            this.editingProfile ? 'Perfil actualizado exitosamente' : 'Perfil creado exitosamente',
            'Cerrar',
            { duration: 3000 }
          );
          this.showForm = false;
          this.loadPricingProfiles();
        },
        error: (error) => {
          console.error('Error saving profile:', error);
          
          // Mostrar mensaje específico si es un error de límite de plan
          let errorMessage = 'Error al guardar perfil';
          if (error.error?.error_code === 'PLAN_LIMIT_EXCEEDED' && error.error?.message) {
            errorMessage = error.error.message;
          } else if (error.error?.message) {
            errorMessage = error.error.message;
          }
          
          this.snackBar.open(errorMessage, 'Cerrar', { 
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
      });
  }

  cancelEdit(): void {
    this.showForm = false;
    this.editingProfile = null;
    this.profileForm.reset();
  }

  deleteProfile(profile: PricingProfile): void {
    const rulesCount = profile.pricing_rules?.length || 0;
    let message = `¿Está seguro de eliminar el perfil "${profile.name}"?`;
    
    if (rulesCount > 0) {
      message += `\n\n⚠️ También se eliminarán ${rulesCount} regla${rulesCount > 1 ? 's' : ''} de precios asociada${rulesCount > 1 ? 's' : ''}.`;
    }

    const confirmation = this.confirmationService.open({
      title: 'Eliminar Perfil de Precios',
      message: message,
      icon: {
        show: true,
        name: 'heroicons_outline:exclamation-triangle',
        color: 'warn'
      },
      actions: {
        confirm: {
          show: true,
          label: 'Eliminar Todo',
          color: 'warn'
        },
        cancel: {
          show: true,
          label: 'Cancelar'
        }
      }
    });

    confirmation.afterClosed().subscribe(result => {
      if (result === 'confirmed') {
        this.pricingProfileService.deletePricingProfile(profile.id!)
          .pipe(takeUntil(this._unsubscribeAll))
          .subscribe({
            next: (response) => {
              const message = response.message || 'Perfil eliminado exitosamente';
              this.snackBar.open(message, 'Cerrar', { duration: 4000 });
              this.loadPricingProfiles();
            },
            error: (error) => {
              console.error('Error deleting profile:', error);
              this.snackBar.open('Error al eliminar perfil', 'Cerrar', { duration: 3000 });
            }
          });
      }
    });
  }

  toggleProfile(profile: PricingProfile): void {
    this.pricingProfileService.togglePricingProfile(profile.id!, !profile.is_active)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.snackBar.open(
            profile.is_active ? 'Perfil desactivado' : 'Perfil activado',
            'Cerrar',
            { duration: 3000 }
          );
          this.loadPricingProfiles();
        },
        error: (error) => {
          console.error('Error toggling profile:', error);
          this.snackBar.open('Error al cambiar estado del perfil', 'Cerrar', { duration: 3000 });
        }
      });
  }

  getSectorName(sectorId: number): string {
    const sector = this.sectors.find(s => s.id === sectorId);
    return sector ? sector.name : 'N/A';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-CL');
  }

  getStatusLabel(isActive: boolean): string {
    return isActive ? 'Activo' : 'Inactivo';
  }

  getStatusColor(isActive: boolean): string {
    return isActive ? 'green' : 'gray';
  }

  getErrorMessage(field: string): string {
    const control = this.profileForm.get(field);
    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (control?.hasError('minlength')) {
      return `Mínimo ${control.errors?.['minlength'].requiredLength} caracteres`;
    }
    return '';
  }

  // ===== MÉTODOS PARA GESTIÓN DE REGLAS DE PRECIOS =====

  createRuleForm(): FormGroup {
    return this.fb.group({
      name: ['', Validators.required],
      rule_type: ['TIME_BASED', Validators.required],
      min_duration_minutes: [0, Validators.required],
      max_duration_minutes: [null],
      daily_max_amount: [null], // Monto máximo diario
      min_amount: [null], // Monto mínimo
      min_amount_is_base: [false], // Monto mínimo como base
      price_per_minute: [0, Validators.required],
      fixed_price: [0],
      start_time: [''],
      end_time: [''],
      priority: [1],
      is_active: [true]
    });
  }

  manageRules(profile: PricingProfile): void {
    this.selectedProfile = profile;
    this.showRulesModal = true;
    this.loadPricingRules(profile.id!);
  }

  closeRulesModal(): void {
    this.showRulesModal = false;
    this.selectedProfile = null;
    this.pricingRules = [];
    this.showRuleForm = false;
    this.editingRule = null;
  }

  loadPricingRules(profileId: number): void {
    this.pricingProfileService.getPricingRules(profileId)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          console.log('Respuesta del servicio de reglas:', response);
          this.pricingRules = response.data || [];
          console.log('Reglas cargadas:', this.pricingRules);
        },
        error: (error) => {
          console.error('Error loading pricing rules:', error);
          this.snackBar.open('Error al cargar reglas de precios', 'Cerrar', { duration: 3000 });
        }
      });
  }

  addRule(): void {
    this.editingRule = null;
    this.selectedDays = [];
    this.ruleForm.reset({
      name: '',
      rule_type: 'TIME_BASED',
      min_duration_minutes: 0,
      max_duration_minutes: null,
      daily_max_amount: null,
      min_amount: null,
      min_amount_is_base: false, // Agregar el campo faltante
      price_per_minute: 0,
      fixed_price: 0,
      start_time: '',
      end_time: '',
      priority: 1,
      is_active: true
    });
    this.showRuleForm = true;
  }

  editRule(rule: PricingRule): void {
    console.log('Editando regla:', rule);
    console.log('start_time raw:', rule.start_time);
    console.log('end_time raw:', rule.end_time);
    console.log('start_min:', (rule as any).start_min);
    console.log('end_min:', (rule as any).end_min);
    
    this.editingRule = rule;
    this.selectedDays = rule.days_of_week || [];
    
    // Manejar valores de tiempo - priorizar start_time y end_time sobre start_min y end_min
    let startTime = '';
    let endTime = '';
    
    // Priorizar start_time y end_time si están disponibles
    if (rule.start_time) {
      startTime = this.formatTimeForInput(rule.start_time);
      console.log('start_time formateado:', startTime);
    } else if ((rule as any).start_min !== undefined && (rule as any).start_min !== null) {
      // Si no hay start_time, usar start_min como fallback
      startTime = this.minutesToTimeString((rule as any).start_min);
      console.log('start_min convertido:', startTime);
    }
    
    if (rule.end_time) {
      endTime = this.formatTimeForInput(rule.end_time);
      console.log('end_time formateado:', endTime);
    } else if ((rule as any).end_min !== undefined && (rule as any).end_min !== null) {
      // Si no hay end_time, usar end_min como fallback
      endTime = this.minutesToTimeString((rule as any).end_min);
      console.log('end_min convertido:', endTime);
    }
    
    // Preparar los datos para el formulario
    const formData = {
      name: rule.name || '',
      rule_type: rule.rule_type || 'TIME_BASED', // Mantener el tipo original del backend
      min_duration_minutes: rule.min_duration_minutes || 0,
      max_duration_minutes: rule.max_duration_minutes || null,
      daily_max_amount: rule.daily_max_amount || null,
      min_amount: rule.min_amount || null,
      min_amount_is_base: rule.min_amount_is_base || false,
      price_per_minute: rule.price_per_minute || rule.price_per_min || 0,
      fixed_price: rule.fixed_price || 0,
      start_time: startTime,
      end_time: endTime,
      priority: rule.priority || 1,
      is_active: rule.is_active !== undefined ? rule.is_active : true
    };
    
    console.log('Datos del formulario antes de setValue:', formData);
    console.log('startTime final:', startTime);
    console.log('endTime final:', endTime);
    
    // Usar setValue en lugar de patchValue para asegurar que todos los valores se apliquen
    this.ruleForm.setValue(formData);
    
    // Forzar actualización de los controles de tiempo
    if (startTime) {
      this.ruleForm.get('start_time')?.setValue(startTime, { emitEvent: false });
    }
    if (endTime) {
      this.ruleForm.get('end_time')?.setValue(endTime, { emitEvent: false });
    }
    
    // Debug: verificar que los valores se aplicaron correctamente
    console.log('Estado del formulario después de setValue:', this.ruleForm.value);
    console.log('Formulario válido:', this.ruleForm.valid);
    
    // Verificar cada campo individualmente
    console.log('Campo name:', this.ruleForm.get('name')?.value);
    console.log('Campo rule_type:', this.ruleForm.get('rule_type')?.value);
    console.log('Campo start_time:', this.ruleForm.get('start_time')?.value);
    console.log('Campo end_time:', this.ruleForm.get('end_time')?.value);
    
    this.showRuleForm = true;
    
    // Debug adicional después de mostrar el formulario
    setTimeout(() => {
      console.log('Estado del formulario después de mostrar:', this.ruleForm.value);
      console.log('start_time control:', this.ruleForm.get('start_time')?.value);
      console.log('end_time control:', this.ruleForm.get('end_time')?.value);
    }, 100);
  }

  // Método auxiliar para convertir minutos a formato HH:mm
  private minutesToTimeString(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  // Método auxiliar para convertir formato de hora (H:i:s o HH:mm) a HH:mm para input type="time"
  private formatTimeForInput(timeString: string | null | undefined): string {
    if (!timeString) {
      return '';
    }
    
    // Convertir a string y limpiar espacios
    const cleanTime = String(timeString).trim();
    
    if (!cleanTime || cleanTime === 'null' || cleanTime === 'undefined') {
      return '';
    }
    
    // Si ya está en formato HH:mm, retornarlo directamente
    if (/^\d{2}:\d{2}$/.test(cleanTime)) {
      return cleanTime;
    }
    
    // Si está en formato H:i:s o HH:mm:ss, extraer solo HH:mm
    // También maneja casos como "18:00:00", "8:00:00", "18:00", "8:00"
    const timeMatch = cleanTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeMatch) {
      const hours = timeMatch[1].padStart(2, '0');
      const minutes = timeMatch[2];
      return `${hours}:${minutes}`;
    }
    
    // Si es un formato de fecha/hora ISO, intentar extraer la hora
    if (cleanTime.includes('T') || cleanTime.includes(' ')) {
      try {
        const date = new Date(cleanTime);
        if (!isNaN(date.getTime())) {
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          return `${hours}:${minutes}`;
        }
      } catch (e) {
        console.warn('Error parsing time string:', cleanTime, e);
      }
    }
    
    console.warn('No se pudo formatear el tiempo:', cleanTime);
    return '';
  }

  // Método auxiliar para formatear hora para el backend (formato H:i sin segundos)
  private formatTimeForBackend(timeString: string | null | undefined): string | null {
    if (!timeString || timeString.trim() === '') {
      return null;
    }
    
    // Si ya está en formato HH:mm, retornarlo directamente
    if (/^\d{2}:\d{2}$/.test(timeString)) {
      return timeString;
    }
    
    // Si está en formato H:mm (una sola cifra para horas), agregar el 0
    if (/^\d{1}:\d{2}$/.test(timeString)) {
      const parts = timeString.split(':');
      return `${parts[0].padStart(2, '0')}:${parts[1]}`;
    }
    
    // Si está en formato HH:mm:ss o H:mm:ss, extraer solo HH:mm
    const timeMatch = timeString.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (timeMatch) {
      const hours = timeMatch[1].padStart(2, '0');
      const minutes = timeMatch[2];
      return `${hours}:${minutes}`;
    }
    
    return null;
  }

  saveRule(): void {
    if (this.ruleForm.valid && this.selectedProfile) {
      // Mapear el tipo de regla para el backend
      const backendRuleType = this.ruleForm.value.rule_type === 'HOURLY' ? 'TIME_BASED' : this.ruleForm.value.rule_type;
      
      const ruleData = {
        profile_id: this.selectedProfile!.id!, // Agregar el profile_id requerido
        name: this.ruleForm.value.name,
        rule_type: backendRuleType,
        min_duration_minutes: this.ruleForm.value.min_duration_minutes,
        max_duration_minutes: this.ruleForm.value.max_duration_minutes,
        daily_max_amount: this.ruleForm.value.daily_max_amount,
        min_amount: this.ruleForm.value.min_amount,
        min_amount_is_base: this.ruleForm.value.min_amount_is_base || false, // Agregar el campo faltante
        price_per_minute: this.ruleForm.value.price_per_minute, // Campo correcto para el backend
        fixed_price: this.ruleForm.value.fixed_price,
        days_of_week: this.selectedDays,
        start_time: this.formatTimeForBackend(this.ruleForm.value.start_time),
        end_time: this.formatTimeForBackend(this.ruleForm.value.end_time),
        priority: this.ruleForm.value.priority,
        is_active: this.ruleForm.value.is_active
      };

      console.log('Datos a enviar al backend:', ruleData);
      console.log('ID de la regla:', this.editingRule?.id);

      if (this.editingRule) {
        this.pricingProfileService.updatePricingRule(this.editingRule.id!, ruleData)
          .pipe(takeUntil(this._unsubscribeAll))
          .subscribe({
            next: (response) => {
              this.snackBar.open('Regla actualizada exitosamente', 'Cerrar', { duration: 3000 });
              this.cancelRuleEdit();
              this.loadPricingRules(this.selectedProfile!.id!);
            },
            error: (error) => {
              console.error('Error updating rule:', error);
              console.error('Error details:', error.error);
              this.snackBar.open('Error al actualizar regla: ' + (error.error?.message || error.message), 'Cerrar', { duration: 5000 });
            }
          });
      } else {
        this.pricingProfileService.createPricingRule(ruleData)
          .pipe(takeUntil(this._unsubscribeAll))
          .subscribe({
            next: (response) => {
              this.snackBar.open('Regla creada exitosamente', 'Cerrar', { duration: 3000 });
              this.cancelRuleEdit();
              this.loadPricingRules(this.selectedProfile!.id!);
            },
            error: (error) => {
              console.error('Error creating rule:', error);
              
              // Mostrar mensaje específico si es un error de límite de plan
              let errorMessage = 'Error al crear regla';
              if (error.error?.error_code === 'PLAN_LIMIT_EXCEEDED' && error.error?.message) {
                errorMessage = error.error.message;
              } else if (error.error?.message) {
                errorMessage = error.error.message;
              }
              
              this.snackBar.open(errorMessage, 'Cerrar', { 
                duration: 5000,
                panelClass: ['error-snackbar']
              });
            }
          });
      }
    }
  }

  cancelRuleEdit(): void {
    this.showRuleForm = false;
    this.editingRule = null;
    this.selectedDays = [];
    this.ruleForm.reset();
  }

  deleteRule(rule: PricingRule): void {
    this.confirmationService.open({
      title: 'Eliminar Regla',
      message: `¿Estás seguro de que quieres eliminar la regla "${rule.name}"?`,
      actions: {
        confirm: {
          show: true,
          label: 'Eliminar',
          color: 'warn'
        },
        cancel: {
          show: true,
          label: 'Cancelar'
        }
      }
    }).afterClosed().subscribe((result) => {
      if (result === 'confirmed') {
        this.pricingProfileService.deletePricingRule(rule.id!)
          .pipe(takeUntil(this._unsubscribeAll))
          .subscribe({
            next: (response) => {
              this.snackBar.open('Regla eliminada exitosamente', 'Cerrar', { duration: 3000 });
              this.loadPricingRules(this.selectedProfile!.id!);
            },
            error: (error) => {
              console.error('Error deleting rule:', error);
              this.snackBar.open('Error al eliminar regla', 'Cerrar', { duration: 3000 });
            }
          });
      }
    });
  }

  toggleRule(rule: PricingRule): void {
    this.pricingProfileService.togglePricingRule(rule.id!, !rule.is_active)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.snackBar.open(
            rule.is_active ? 'Regla desactivada' : 'Regla activada',
            'Cerrar',
            { duration: 3000 }
          );
          this.loadPricingRules(this.selectedProfile!.id!);
        },
        error: (error) => {
          console.error('Error toggling rule:', error);
          this.snackBar.open('Error al cambiar estado de la regla', 'Cerrar', { duration: 3000 });
        }
      });
  }

  onDayChange(event: any, dayValue: number): void {
    if (event.checked) {
      if (!this.selectedDays.includes(dayValue)) {
        this.selectedDays.push(dayValue);
      }
    } else {
      this.selectedDays = this.selectedDays.filter(d => d !== dayValue);
    }
  }

  isDaySelected(dayValue: number): boolean {
    return this.selectedDays.includes(dayValue);
  }

  getRuleTypeLabel(ruleType: string): string {
    const types = {
      'TIME_BASED': 'Por Tiempo',
      'FIXED': 'Precio Fijo',
      'GRADUATED': 'Graduada',
      'HOURLY': 'Por Hora'
    };
    return types[ruleType as keyof typeof types] || ruleType;
  }

  getDaysLabel(days: number[]): string {
    if (!days || days.length === 0) return 'Todos';
    
    const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return days.map(d => dayLabels[d]).join(', ');
  }

  getRuleTypeColor(ruleType: string): string {
    const colors = {
      'TIME_BASED': 'blue',
      'FIXED': 'green',
      'GRADUATED': 'purple',
      'HOURLY': 'blue'
    };
    return colors[ruleType as keyof typeof colors] || 'gray';
  }

  formatTimeRange(startTime: string, endTime: string): string {
    if (!startTime || !endTime) {
      return 'Todo el día';
    }
    
    try {
      // Si startTime y endTime son solo horas (HH:mm:ss o HH:mm), parsearlos directamente
      let startTimeStr = startTime;
      let endTimeStr = endTime;
      
      // Si es un string de fecha/hora ISO, extraer solo la hora
      if (startTime.includes('T') || startTime.includes(' ')) {
        const startDate = new Date(startTime);
        if (!isNaN(startDate.getTime())) {
          startTimeStr = startDate.toTimeString().substring(0, 5); // HH:mm
        }
      } else if (startTime.includes(':')) {
        // Si ya es formato HH:mm o HH:mm:ss, usar directamente
        startTimeStr = startTime.substring(0, 5); // Tomar solo HH:mm
      }
      
      if (endTime.includes('T') || endTime.includes(' ')) {
        const endDate = new Date(endTime);
        if (!isNaN(endDate.getTime())) {
          endTimeStr = endDate.toTimeString().substring(0, 5); // HH:mm
        }
      } else if (endTime.includes(':')) {
        endTimeStr = endTime.substring(0, 5); // Tomar solo HH:mm
      }
      
      return `${startTimeStr} - ${endTimeStr}`;
    } catch (error) {
      console.error('Error formatting time range:', error);
      return 'Todo el día';
    }
  }

  // Métodos para estadísticas
  getActiveProfilesCount(): number {
    return this.pricingProfiles.filter(profile => profile.is_active).length;
  }

  getInactiveProfilesCount(): number {
    return this.pricingProfiles.filter(profile => !profile.is_active).length;
  }

  getTotalRulesCount(): number {
    return this.pricingProfiles.reduce((total, profile) => {
      return total + (profile.pricing_rules?.length || 0);
    }, 0);
  }

  // Método para manejar valores de tiempo en campos type="time"
  getTimeValue(value: any): string {
    // Si el valor es null, undefined o cadena vacía, retornar cadena vacía
    if (!value || value === '' || value === null) {
      return '';
    }
    
    // Convertir el valor a formato HH:mm usando el método auxiliar
    const formatted = this.formatTimeForInput(value);
    
    // Si el resultado es "00:00", retornar cadena vacía (para permitir campos vacíos)
    if (formatted === '00:00') {
      return '';
    }
    
    return formatted;
  }

  // Método para manejar cambios en campos de tiempo
  onTimeChange(fieldName: string, event: any): void {
    const value = event.target.value;
    // Si el valor está vacío o es "00:00", establecer como cadena vacía
    if (value === '' || value === null || value === '00:00') {
      this.ruleForm.get(fieldName)?.setValue('');
    } else {
      this.ruleForm.get(fieldName)?.setValue(value);
    }
  }
}