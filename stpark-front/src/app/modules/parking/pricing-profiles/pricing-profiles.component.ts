import { Component, OnInit, OnDestroy } from '@angular/core';
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
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { FuseConfirmationService } from '@fuse/services/confirmation';

import { PricingProfileService } from 'app/core/services/pricing-profile.service';
import { SectorService } from 'app/core/services/sector.service';
import { PricingProfile, PricingRule, Sector, PricingProfileFilters } from 'app/interfaces/parking.interface';

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
    MatNativeDateModule,
    MatCheckboxModule
  ],
  templateUrl: './pricing-profiles.component.html',
  styleUrls: ['./pricing-profiles.component.scss']
})
export class PricingProfilesComponent implements OnInit, OnDestroy {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  pricingProfiles: PricingProfile[] = [];
  sectors: Sector[] = [];
  loading = false;
  error: string | null = null;

  // Paginación
  totalItems = 0;
  pageSize = 10;
  currentPage = 0;
  pageSizeOptions = [5, 10, 25, 50];

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
      per_page: this.pageSize
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
          this.snackBar.open('Error al guardar perfil', 'Cerrar', { duration: 3000 });
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
    this.editingRule = rule;
    this.selectedDays = rule.days_of_week || [];
    
    // Manejar valores de tiempo - solo cargar si realmente existen
    let startTime = '';
    let endTime = '';
    
    // Si tenemos start_min y end_min, convertirlos a formato HH:mm
    if ((rule as any).start_min !== undefined && (rule as any).end_min !== undefined) {
      startTime = this.minutesToTimeString((rule as any).start_min);
      endTime = this.minutesToTimeString((rule as any).end_min);
    } else if (rule.start_time && rule.end_time) {
      // Solo usar start_time y end_time si ambos existen y no son null
      startTime = rule.start_time;
      endTime = rule.end_time;
    }
    // Si no hay valores válidos, mantener campos vacíos
    
    // Preparar los datos para el formulario
    const formData = {
      name: rule.name || '',
      rule_type: rule.rule_type || 'TIME_BASED', // Mantener el tipo original del backend
      min_duration_minutes: rule.min_duration_minutes || 0,
      max_duration_minutes: rule.max_duration_minutes || null,
      daily_max_amount: rule.daily_max_amount || null,
      min_amount: rule.min_amount || null,
      price_per_minute: rule.price_per_minute || rule.price_per_min || 0,
      fixed_price: rule.fixed_price || 0,
      start_time: startTime,
      end_time: endTime,
      priority: rule.priority || 1,
      is_active: rule.is_active !== undefined ? rule.is_active : true
    };
    
    console.log('Datos del formulario:', formData);
    
    // Usar setValue en lugar de patchValue para asegurar que todos los valores se apliquen
    this.ruleForm.setValue(formData);
    
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
    }, 100);
  }

  // Método auxiliar para convertir minutos a formato HH:mm
  private minutesToTimeString(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
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
        price_per_minute: this.ruleForm.value.price_per_minute, // Campo correcto para el backend
        fixed_price: this.ruleForm.value.fixed_price,
        days_of_week: this.selectedDays,
        start_time: this.ruleForm.value.start_time || null,
        end_time: this.ruleForm.value.end_time || null,
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
              this.snackBar.open('Error al crear regla', 'Cerrar', { duration: 3000 });
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
      // Parse ISO datetime strings
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      // Format as dd/mm/yyyy HH:mm - HH:mm
      const startFormatted = start.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }) + ' ' + start.toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      
      const endFormatted = end.toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      
      return `${startFormatted} - ${endFormatted}`;
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
    // Si el valor es null, undefined, cadena vacía o "00:00", retornar cadena vacía
    if (!value || value === '' || value === null || value === '00:00') {
      return ''; // Retorna cadena vacía para campos vacíos
    }
    
    // Si es un string en formato HH:MM válido (no 00:00), lo retorna tal como está
    if (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) && value !== '00:00') {
      return value;
    }
    
    // Si es un objeto Date, lo convierte a formato HH:MM
    if (value instanceof Date) {
      const timeString = value.toTimeString().slice(0, 5);
      return timeString === '00:00' ? '' : timeString;
    }
    
    return '';
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