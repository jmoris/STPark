import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TenantService, CreateTenantRequest } from 'app/core/services/tenant.service';
import { Plan } from 'app/core/services/plan.service';

export interface TenantFormData {
  tenant?: any;
  isEdit: boolean;
  plans: Plan[];
}

@Component({
  selector: 'app-tenant-form',
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
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatTooltipModule
  ],
  templateUrl: './tenant-form.component.html',
  styleUrls: ['./tenant-form.component.scss']
})
export class TenantFormComponent implements OnInit {
  tenantForm!: FormGroup;
  loading = false;

  get settingsForm(): FormGroup | null {
    return this.tenantForm.get('settings') as FormGroup | null;
  }

  get userForm(): FormGroup | null {
    return this.tenantForm.get('user') as FormGroup | null;
  }

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<TenantFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TenantFormData,
    private tenantService: TenantService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.tenantForm = this.createForm();
    if (this.data.isEdit && this.data.tenant) {
      // Cargar datos después de que el formulario esté inicializado
      setTimeout(() => {
        this.loadTenantData();
      }, 50);
    }
  }

  private createForm(): FormGroup {
    // En modo edición, los campos de usuario no son requeridos
    const isEdit = this.data.isEdit;
    
    const formControls: any = {
      id: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-z0-9_-]+$/)]],
      name: ['', [Validators.required, Validators.minLength(2)]],
      plan_id: ['', Validators.required],
      rut: [''],
      razon_social: [''],
      giro: [''],
      direccion: [''],
      comuna: [''],
      dias_credito: [0, [Validators.min(0)]],
      correo_intercambio: ['', [Validators.email]],
      facturapi_environment: [''],
      facturapi_token: [''],
      user: this.fb.group({
        name: ['', isEdit ? [] : [Validators.required, Validators.minLength(2)]],
        email: ['', isEdit ? [] : [Validators.required, Validators.email]],
        password: ['', isEdit ? [] : [Validators.required, Validators.minLength(6)]]
      })
    };

    // Agregar grupo de settings solo en modo edición
    if (isEdit) {
      formControls.settings = this.fb.group({
        name: ['', Validators.required],
        pos_tuu: [false],
        boleta_electronica: [false],
        max_capacity: [0, [Validators.min(0)]]
      });
    }

    return this.fb.group(formControls);
  }

  private loadTenantData(): void {
    if (this.data.tenant) {
      console.log('Loading tenant data:', this.data.tenant);
      const settings = this.data.tenant.settings || {};
      console.log('Settings from tenant:', settings);
      
      // Preparar valores para el formulario
      const formValue: any = {
        id: this.data.tenant.id,
        name: this.data.tenant.name || '',
        plan_id: this.data.tenant.plan_id || '',
        rut: this.data.tenant.rut || '',
        razon_social: this.data.tenant.razon_social || '',
        giro: this.data.tenant.giro || '',
        direccion: this.data.tenant.direccion || '',
        comuna: this.data.tenant.comuna || '',
        dias_credito: this.data.tenant.dias_credito || 0,
        correo_intercambio: this.data.tenant.correo_intercambio || '',
        facturapi_environment: this.data.tenant.facturapi_environment || '',
        facturapi_token: this.data.tenant.facturapi_token || ''
      };

      // Agregar settings si el control existe
      const settingsControl = this.tenantForm.get('settings');
      if (settingsControl) {
        formValue.settings = {
          name: settings.name || 'STPark - Sistema de Estacionamientos',
          pos_tuu: settings.pos_tuu !== undefined ? Boolean(settings.pos_tuu) : false,
          boleta_electronica: settings.boleta_electronica !== undefined ? Boolean(settings.boleta_electronica) : false,
          max_capacity: settings.max_capacity !== undefined ? Number(settings.max_capacity) : 0
        };
        
        console.log('Settings to load:', formValue.settings);
      }
      
      // Actualizar todo el formulario de una vez
      this.tenantForm.patchValue(formValue, { emitEvent: false });
      
      console.log('Form value after loading:', this.tenantForm.value);
      console.log('Settings control value:', this.tenantForm.get('settings')?.value);
    }
  }

  getErrorMessage(controlName: string): string {
    const control = this.tenantForm.get(controlName);
    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (control?.hasError('minlength')) {
      return 'Debe tener al menos 2 caracteres';
    }
    if (control?.hasError('email')) {
      return 'Formato de email inválido';
    }
    if (control?.hasError('pattern')) {
      return 'Solo se permiten letras minúsculas, números, guiones y guiones bajos';
    }
    return 'Campo inválido';
  }

  getUserErrorMessage(controlName: string): string {
    const userGroup = this.tenantForm.get('user') as FormGroup;
    const control = userGroup?.get(controlName);
    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (control?.hasError('minlength')) {
      if (controlName === 'password') {
        return 'La contraseña debe tener al menos 6 caracteres';
      }
      return 'Debe tener al menos 2 caracteres';
    }
    if (control?.hasError('email')) {
      return 'Formato de email inválido';
    }
    return 'Campo inválido';
  }

  onSubmit(): void {
    if (this.tenantForm.valid) {
      this.loading = true;
      const formValue = this.tenantForm.value;
      
      if (this.data.isEdit && this.data.tenant) {
        // Modo edición: actualizar nombre, plan, facturación y settings
        const updateData: any = {
          name: formValue.name.trim(),
          plan_id: formValue.plan_id,
          rut: formValue.rut?.trim() || null,
          razon_social: formValue.razon_social?.trim() || null,
          giro: formValue.giro?.trim() || null,
          direccion: formValue.direccion?.trim() || null,
          comuna: formValue.comuna?.trim() || null,
          dias_credito: formValue.dias_credito ? parseInt(formValue.dias_credito) : 0,
          correo_intercambio: formValue.correo_intercambio?.trim() || null,
          facturapi_environment: formValue.facturapi_environment?.trim() || null,
          facturapi_token: formValue.facturapi_token?.trim() || null
        };

        // Incluir settings si existen
        if (formValue.settings) {
          updateData.settings = {
            name: formValue.settings.name?.trim() || 'STPark - Sistema de Estacionamientos',
            pos_tuu: formValue.settings.pos_tuu !== undefined ? formValue.settings.pos_tuu : false,
            boleta_electronica: formValue.settings.boleta_electronica !== undefined ? formValue.settings.boleta_electronica : false,
            max_capacity: formValue.settings.max_capacity !== undefined ? parseInt(formValue.settings.max_capacity) : 0
          };
        }

        this.tenantService.updateTenant(this.data.tenant.id, updateData).subscribe({
          next: (response) => {
            this.loading = false;
            this.snackBar.open('Estacionamiento actualizado exitosamente', 'Cerrar', { duration: 3000 });
            this.dialogRef.close(true);
          },
          error: (error) => {
            this.loading = false;
            console.error('Error updating tenant:', error);
            const errorMessage = error.error?.message || 'Error al actualizar estacionamiento';
            this.snackBar.open(errorMessage, 'Cerrar', { duration: 5000 });
          }
        });
      } else {
        // Modo creación: crear nuevo tenant con usuario
        const tenantData: CreateTenantRequest = {
          id: formValue.id.toLowerCase().trim(),
          name: formValue.name.trim(),
          plan_id: formValue.plan_id,
          rut: formValue.rut?.trim() || null,
          razon_social: formValue.razon_social?.trim() || null,
          giro: formValue.giro?.trim() || null,
          direccion: formValue.direccion?.trim() || null,
          comuna: formValue.comuna?.trim() || null,
          dias_credito: formValue.dias_credito ? parseInt(formValue.dias_credito) : 0,
          correo_intercambio: formValue.correo_intercambio?.trim() || null,
          facturapi_environment: formValue.facturapi_environment?.trim() || null,
          facturapi_token: formValue.facturapi_token?.trim() || null,
          user: {
            name: formValue.user.name.trim(),
            email: formValue.user.email.trim().toLowerCase(),
            password: formValue.user.password
          }
        };

        this.tenantService.createTenant(tenantData).subscribe({
          next: (response) => {
            this.loading = false;
            this.snackBar.open('Estacionamiento creado exitosamente', 'Cerrar', { duration: 3000 });
            this.dialogRef.close(true);
          },
          error: (error) => {
            this.loading = false;
            console.error('Error creating tenant:', error);
            const errorMessage = error.error?.message || 'Error al crear estacionamiento';
            this.snackBar.open(errorMessage, 'Cerrar', { duration: 5000 });
          }
        });
      }
    } else {
      this.tenantForm.markAllAsTouched();
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}

