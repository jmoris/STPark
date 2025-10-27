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

  constructor(
    private fb: FormBuilder,
    private pricingProfileService: PricingProfileService,
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {
    this.generalForm = this.fb.group({
      name: ['STPark - Sistema de Estacionamientos', [Validators.required]],
      currency: ['CLP', [Validators.required]],
      timezone: ['America/Santiago', [Validators.required]],
      language: ['es', [Validators.required]]
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
    this.http.get<any>(`${environment.apiUrl}/settings/general`)
      .subscribe({
        next: (config) => {
          this.generalForm.patchValue(config);
          this.loading = false;
        },
        error: (error) => {
          console.log('No hay configuración general previa, usando valores por defecto');
          this.loading = false;
        }
      });
  }

  loadDefaultPricing(): void {
    this.loading = true;
    this.http.get<DefaultPricingConfig>(`${environment.apiUrl}/settings/default-pricing`)
      .subscribe({
        next: (config) => {
          this.pricingForm.patchValue(config);
          this.loading = false;
        },
        error: (error) => {
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
    const config = this.generalForm.value;

    this.http.post(`${environment.apiUrl}/settings/general`, config)
      .subscribe({
        next: () => {
          this.snackBar.open('Configuración general guardada exitosamente', 'Cerrar', {
            duration: 3000
          });
          this.loading = false;
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
      currency: 'CLP',
      timezone: 'America/Santiago',
      language: 'es'
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
