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
  pricingForm: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private pricingProfileService: PricingProfileService,
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {
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
    this.loadDefaultPricing();
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
          this.snackBar.open('Configuración guardada exitosamente', 'Cerrar', {
            duration: 3000
          });
          this.loading = false;
        },
        error: (error) => {
          console.error('Error al guardar configuración:', error);
          this.snackBar.open('Error al guardar la configuración', 'Cerrar', {
            duration: 3000
          });
          this.loading = false;
        }
      });
  }

  resetSettings(): void {
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
