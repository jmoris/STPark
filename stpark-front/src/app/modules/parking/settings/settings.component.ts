import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { PricingProfileService } from 'app/core/services/pricing-profile.service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';

interface DefaultPricingConfig {
  price_per_min: number;
  min_amount: number;
  daily_max_amount: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDividerModule,
    MatNativeDateModule,
    MatDatepickerModule,
    MatSnackBarModule
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  generalForm: FormGroup;
  pricingForm: FormGroup;
  loading = false;

  planName: string = 'Sin plan';

  constructor(
    private fb: FormBuilder,
    private pricingProfileService: PricingProfileService,
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {
    this.generalForm = this.fb.group({
      name: ['STPark - Sistema de Estacionamientos', [Validators.required]],
      language: ['es', [Validators.required]],
      plan_name: ['Sin plan'], // Se deshabilitará después de cargar
      pos_tuu: [{ value: false, disabled: true }], // Solo lectura - solo administradores pueden cambiar
      boleta_electronica: [{ value: false, disabled: true }], // Solo lectura - solo administradores pueden cambiar
      max_capacity: [0, [Validators.required, Validators.min(0)]],
      car_wash_enabled: [{ value: false, disabled: true }], // Solo lectura - solo administradores pueden cambiar
      car_wash_payment_deferred: [false] // Permitir pago posterior del lavado de autos (solo visible si car_wash_enabled está activo)
    });

    this.pricingForm = this.fb.group({
      price_per_min: [0, [Validators.required, Validators.min(0)]],
      min_amount: [0, [Validators.required, Validators.min(0)]],
      daily_max_amount: [0, [Validators.required, Validators.min(0)]],
      start_time: ['00:00', Validators.required],
      end_time: ['23:59', Validators.required],
      is_active: [true]
    });
  }

  ngOnInit(): void {
    this.loadGeneralSettings();
    this.loadDefaultPricing();
  }

  loadGeneralSettings(): void {
    this.loading = true;
    this.http.get<{ success: boolean; data: any }>(`${environment.apiUrl}/settings/general`)
      .subscribe({
        next: (response) => {
          // El backend devuelve { success: true, data: {...} }
          if (response && response.success && response.data) {
            console.log('Configuración general cargada:', response.data);
            
            // Actualizar el plan_name
            const planName = response.data.plan_name || 'Sin plan';
            this.planName = planName;
            console.log('Plan name asignado:', this.planName);
            
            // Excluir plan_name, pos_tuu, boleta_electronica y car_wash_enabled del patchValue ya que los actualizamos por separado
            const { plan_name, pos_tuu, boleta_electronica, car_wash_enabled, ...formData } = response.data;
            
            // Actualizar los demás campos del formulario
            this.generalForm.patchValue(formData);
            
            // Actualizar plan_name, pos_tuu y boleta_electronica (campos deshabilitados)
            setTimeout(() => {
              // Actualizar plan_name
              const planNameControl = this.generalForm.get('plan_name');
              if (planNameControl) {
                if (planNameControl.disabled) {
                  planNameControl.enable({ emitEvent: false });
                }
                planNameControl.setValue(planName, { emitEvent: false });
                setTimeout(() => {
                  planNameControl.disable({ emitEvent: false });
                }, 100);
              }

              // Actualizar pos_tuu
              const posTuuControl = this.generalForm.get('pos_tuu');
              if (posTuuControl && response.data.pos_tuu !== undefined) {
                if (posTuuControl.disabled) {
                  posTuuControl.enable({ emitEvent: false });
                }
                posTuuControl.setValue(response.data.pos_tuu, { emitEvent: false });
                setTimeout(() => {
                  posTuuControl.disable({ emitEvent: false });
                }, 100);
              }

              // Actualizar boleta_electronica
              const boletaElectronicaControl = this.generalForm.get('boleta_electronica');
              if (boletaElectronicaControl && response.data.boleta_electronica !== undefined) {
                if (boletaElectronicaControl.disabled) {
                  boletaElectronicaControl.enable({ emitEvent: false });
                }
                boletaElectronicaControl.setValue(response.data.boleta_electronica, { emitEvent: false });
                setTimeout(() => {
                  boletaElectronicaControl.disable({ emitEvent: false });
                }, 100);
              }

              // Actualizar car_wash_enabled (solo lectura)
              const carWashEnabledControl = this.generalForm.get('car_wash_enabled');
              if (carWashEnabledControl && response.data.car_wash_enabled !== undefined) {
                if (carWashEnabledControl.disabled) {
                  carWashEnabledControl.enable({ emitEvent: false });
                }
                const carWashEnabledValue = !!response.data.car_wash_enabled;
                carWashEnabledControl.setValue(carWashEnabledValue, { emitEvent: false });
                setTimeout(() => {
                  carWashEnabledControl.disable({ emitEvent: false });
                }, 100);
              }
              
              // Si car_wash_enabled es false, desactivar también car_wash_payment_deferred solo en la UI
              // Pero NO forzar el guardado de este valor, ya que car_wash_enabled puede cambiar después
              const carWashEnabledValue = response.data.car_wash_enabled === true;
              if (!carWashEnabledValue) {
                const paymentDeferredControl = this.generalForm.get('car_wash_payment_deferred');
                if (paymentDeferredControl) {
                  paymentDeferredControl.setValue(false, { emitEvent: false });
                  paymentDeferredControl.disable({ emitEvent: false });
                }
              } else {
                // Si car_wash_enabled es true, habilitar el campo
                const paymentDeferredControl = this.generalForm.get('car_wash_payment_deferred');
                if (paymentDeferredControl) {
                  paymentDeferredControl.enable({ emitEvent: false });
                }
              }
            }, 0);
          } else {
            console.warn('La respuesta no tiene el formato esperado:', response);
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error al cargar configuración general:', error);
          console.log('No hay configuración general previa, usando valores por defecto');
          this.loading = false;
        }
      });
  }

  loadDefaultPricing(): void {
    this.loading = true;
    this.http.get<{ success: boolean; data: DefaultPricingConfig }>(`${environment.apiUrl}/settings/default-pricing`)
      .subscribe({
        next: (response) => {
          // El backend devuelve { success: true, data: {...} }
          if (response && response.success && response.data) {
            console.log('Configuración de precios cargada:', response.data);
            this.pricingForm.patchValue(response.data);
          } else {
            console.warn('La respuesta no tiene el formato esperado:', response);
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error al cargar configuración de precios:', error);
          console.log('No hay configuración previa, usando valores por defecto');
          this.loading = false;
        }
      });
  }

  saveSettings(): void {
    // Verificar qué formulario está activo
    const activeTab = this.getActiveTab();
    
    if (activeTab === 'general') {
      this.saveGeneralSettings();
    } else if (activeTab === 'pricing') {
      this.savePricingSettings();
    }
  }

  private getActiveTab(): string {
    // Obtener la pestaña activa desde el DOM
    const tabGroup = document.querySelector('mat-tab-group');
    if (tabGroup) {
      const activeTab = tabGroup.querySelector('.mat-mdc-tab-active');
      if (activeTab) {
        const label = activeTab.querySelector('.mdc-tab__text-label');
        if (label?.textContent?.toLowerCase().includes('general')) {
          return 'general';
        }
        if (label?.textContent?.toLowerCase().includes('precios')) {
          return 'pricing';
        }
      }
    }
    return 'general'; // Por defecto general
  }

  saveGeneralSettings(): void {
    if (this.generalForm.invalid) {
      this.snackBar.open('Por favor completa todos los campos correctamente', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    this.loading = true;
    
    // Obtener el valor de car_wash_payment_deferred ANTES de excluir campos
    // Asegurarse de obtener el valor incluso si el campo está deshabilitado
    const carWashPaymentDeferredControl = this.generalForm.get('car_wash_payment_deferred');
    const carWashPaymentDeferredValue = carWashPaymentDeferredControl ? carWashPaymentDeferredControl.value : false;
    
    // Excluir pos_tuu, boleta_electronica, car_wash_enabled y plan_name del objeto a enviar (solo lectura, el backend los preserva automáticamente)
    const { pos_tuu, boleta_electronica, car_wash_enabled, plan_name, ...config } = this.generalForm.getRawValue();
    
    // Asegurar que car_wash_payment_deferred se incluya en el objeto a enviar
    config.car_wash_payment_deferred = carWashPaymentDeferredValue;
    
    console.log('Settings: Enviando configuración al backend', config);

    this.http.post(`${environment.apiUrl}/settings/general`, config)
      .subscribe({
        next: () => {
          this.snackBar.open('Configuración general guardada exitosamente', 'Cerrar', {
            duration: 3000
          });
          // Recargar la configuración después de guardar para mantener los valores sincronizados
          this.loadGeneralSettings();
        },
        error: (error) => {
          console.error('Error al guardar configuración general:', error);
          this.snackBar.open('Error al guardar la configuración general', 'Cerrar', {
            duration: 3000
          });
          this.loading = false;
        }
      });
  }

  savePricingSettings(): void {
    if (this.pricingForm.invalid) {
      this.snackBar.open('Por favor completa todos los campos correctamente', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    this.loading = true;
    const config = this.pricingForm.value;

    this.http.post(`${environment.apiUrl}/settings/default-pricing`, config)
      .subscribe({
        next: () => {
          this.snackBar.open('Configuración de precios guardada exitosamente', 'Cerrar', {
            duration: 3000
          });
          this.loading = false;
        },
        error: (error) => {
          console.error('Error al guardar configuración de precios:', error);
          this.snackBar.open('Error al guardar la configuración de precios', 'Cerrar', {
            duration: 3000
          });
          this.loading = false;
        }
      });
  }

  resetSettings(): void {
    this.generalForm.reset({
      name: 'STPark - Sistema de Estacionamientos',
      language: 'es',
      pos_tuu: false,
      boleta_electronica: false,
      max_capacity: 0
    });
    
    this.pricingForm.reset({
      price_per_min: 0,
      min_amount: 0,
      daily_max_amount: 0,
      start_time: '00:00',
      end_time: '23:59',
      is_active: true
    });
    this.snackBar.open('Valores restaurados', 'Cerrar', {
      duration: 2000
    });
  }
}
