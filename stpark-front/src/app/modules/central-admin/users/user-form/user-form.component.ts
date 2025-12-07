import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { UserService, CreateUserRequest, UpdateUserRequest, User } from 'app/core/services/user.service';
import { TenantService, Tenant } from 'app/core/services/tenant.service';
import { Subject, takeUntil } from 'rxjs';

export interface UserFormData {
  user?: User;
  isEdit: boolean;
  showTenantAssignment?: boolean;
}

@Component({
  selector: 'app-user-form',
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
    MatChipsModule,
    MatTooltipModule,
    MatCardModule
  ],
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.scss']
})
export class UserFormComponent implements OnInit, OnDestroy {
  userForm!: FormGroup;
  loading = false;
  tenants: Tenant[] = [];
  selectedTenants: Tenant[] = [];
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<UserFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: UserFormData,
    private userService: UserService,
    private tenantService: TenantService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.userForm = this.createForm();
    
    if (this.data.isEdit && this.data.user) {
      setTimeout(() => {
        this.loadUserData();
      }, 50);
    }

    if (this.data.showTenantAssignment && this.data.user) {
      this.loadTenants();
      this.loadUserTenants();
    } else if (!this.data.showTenantAssignment) {
      this.loadTenants();
    }
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  private createForm(): FormGroup {
    const isEdit = this.data.isEdit;
    
    const formControls: any = {
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', isEdit ? [] : [Validators.required, Validators.minLength(6)]],
      is_central_admin: [false]
    };

    return this.fb.group(formControls);
  }

  private loadUserData(): void {
    if (this.data.user) {
      const formValue: any = {
        name: this.data.user.name || '',
        email: this.data.user.email || '',
        is_central_admin: this.data.user.is_central_admin || false
      };
      
      this.userForm.patchValue(formValue, { emitEvent: false });
    }
  }

  private loadTenants(): void {
    this.tenantService.getTenants({ per_page: 100 })
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.tenants = (response.data as any)?.data || [];
        },
        error: (error) => {
          console.error('Error loading tenants:', error);
        }
      });
  }

  private loadUserTenants(): void {
    if (this.data.user && this.data.user.id) {
      this.userService.getUser(this.data.user.id)
        .pipe(takeUntil(this._unsubscribeAll))
        .subscribe({
          next: (response) => {
            const user = response.data;
            if (user.tenants) {
              this.selectedTenants = user.tenants.map((t: any) => ({
                id: t.id,
                name: t.name
              }));
            }
          },
          error: (error) => {
            console.error('Error loading user tenants:', error);
          }
        });
    }
  }

  getErrorMessage(controlName: string): string {
    const control = this.userForm.get(controlName);
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

  toggleTenant(tenant: Tenant): void {
    const index = this.selectedTenants.findIndex(t => t.id === tenant.id);
    if (index >= 0) {
      this.selectedTenants.splice(index, 1);
    } else {
      this.selectedTenants.push(tenant);
    }
  }

  isTenantSelected(tenant: Tenant): boolean {
    return this.selectedTenants.some(t => t.id === tenant.id);
  }

  onSubmit(): void {
    if (this.data.showTenantAssignment && this.data.user) {
      // Modo asignación de estacionamientos
      if (this.selectedTenants.length === 0) {
        this.snackBar.open('Debe seleccionar al menos un estacionamiento', 'Cerrar', { duration: 3000 });
        return;
      }

      this.loading = true;
      const tenantIds = this.selectedTenants.map(t => t.id);

      this.userService.assignToTenants(this.data.user.id, tenantIds).subscribe({
        next: (response) => {
          this.loading = false;
          this.snackBar.open('Usuario asignado a estacionamiento(s) exitosamente', 'Cerrar', { duration: 3000 });
          this.dialogRef.close(true);
        },
        error: (error) => {
          this.loading = false;
          console.error('Error assigning user to tenants:', error);
          const errorMessage = error.error?.message || 'Error al asignar usuario a estacionamiento(s)';
          this.snackBar.open(errorMessage, 'Cerrar', { duration: 5000 });
        }
      });
    } else if (this.userForm.valid) {
      this.loading = true;
      const formValue = this.userForm.value;
      
      if (this.data.isEdit && this.data.user) {
        // Modo edición
        const updateData: UpdateUserRequest = {
          name: formValue.name.trim(),
          email: formValue.email.trim().toLowerCase(),
          is_central_admin: formValue.is_central_admin || false
        };

        // Solo actualizar contraseña si se proporciona
        if (formValue.password && formValue.password.trim()) {
          updateData.password = formValue.password;
        }

        this.userService.updateUser(this.data.user.id, updateData).subscribe({
          next: (response) => {
            this.loading = false;
            this.snackBar.open('Usuario actualizado exitosamente', 'Cerrar', { duration: 3000 });
            this.dialogRef.close(true);
          },
          error: (error) => {
            this.loading = false;
            console.error('Error updating user:', error);
            const errorMessage = error.error?.message || 'Error al actualizar usuario';
            this.snackBar.open(errorMessage, 'Cerrar', { duration: 5000 });
          }
        });
      } else {
        // Modo creación
        const userData: CreateUserRequest = {
          name: formValue.name.trim(),
          email: formValue.email.trim().toLowerCase(),
          password: formValue.password,
          is_central_admin: formValue.is_central_admin || false
        };

        this.userService.createUser(userData).subscribe({
          next: (response) => {
            this.loading = false;
            this.snackBar.open('Usuario creado exitosamente', 'Cerrar', { duration: 3000 });
            this.dialogRef.close(true);
          },
          error: (error) => {
            this.loading = false;
            console.error('Error creating user:', error);
            const errorMessage = error.error?.message || 'Error al crear usuario';
            this.snackBar.open(errorMessage, 'Cerrar', { duration: 5000 });
          }
        });
      }
    } else {
      this.userForm.markAllAsTouched();
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
