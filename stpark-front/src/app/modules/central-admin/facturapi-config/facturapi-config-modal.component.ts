import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FacturAPIConfigService, FacturAPIConfig } from 'app/core/services/facturapi-config.service';

@Component({
  selector: 'app-facturapi-config-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './facturapi-config-modal.component.html',
  styleUrls: ['./facturapi-config-modal.component.scss']
})
export class FacturAPIConfigModalComponent implements OnInit {
  configForm!: FormGroup;
  loading = false;
  saving = false;

  environments = [
    { value: 'dev', label: 'Desarrollo (dev.facturapi.cl)' },
    { value: 'prod', label: 'Producción (prod.facturapi.cl)' }
  ];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<FacturAPIConfigModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private facturapiConfigService: FacturAPIConfigService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.configForm = this.fb.group({
      environment: ['dev', [Validators.required]],
      dev_token: ['', [Validators.required]],
      prod_token: ['', [Validators.required]]
    });

    this.loadConfig();
  }

  loadConfig(): void {
    this.loading = true;
    this.facturapiConfigService.getConfig().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.configForm.patchValue({
            environment: response.data.environment || 'dev',
            dev_token: response.data.dev_token || '',
            prod_token: response.data.prod_token || ''
          });
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error cargando configuración:', error);
        this.snackBar.open('Error al cargar la configuración', 'Cerrar', {
          duration: 3000
        });
        this.loading = false;
      }
    });
  }

  saveConfig(): void {
    if (this.configForm.invalid) {
      this.configForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    const config: FacturAPIConfig = this.configForm.value;

    this.facturapiConfigService.saveConfig(config).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open('Configuración guardada exitosamente', 'Cerrar', {
            duration: 3000
          });
          this.dialogRef.close(true);
        } else {
          this.snackBar.open(response.message || 'Error al guardar la configuración', 'Cerrar', {
            duration: 3000
          });
        }
        this.saving = false;
      },
      error: (error) => {
        console.error('Error guardando configuración:', error);
        const errorMessage = error.error?.message || 'Error al guardar la configuración';
        this.snackBar.open(errorMessage, 'Cerrar', {
          duration: 3000
        });
        this.saving = false;
      }
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  getEndpointForEnvironment(env: string): string {
    return env === 'dev' 
      ? 'https://dev.facturapi.cl/api' 
      : 'https://prod.facturapi.cl/api';
  }
}
