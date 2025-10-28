import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { AuthService } from 'app/core/services/auth.service';

export interface EditProfileData {
  user: {
    id: string;
    name: string;
    email: string;
    tenant?: string;
  };
}

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './edit-profile.component.html',
  styleUrls: ['./edit-profile.component.scss']
})
export class EditProfileComponent implements OnInit {
  profileForm: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<EditProfileComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EditProfileData,
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private authService: AuthService
  ) {
    this.profileForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadUserData();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      tenant: [''],
      password: ['']
    });
  }

  private loadUserData(): void {
    if (this.data.user) {
      this.profileForm.patchValue({
        name: this.data.user.name,
        email: this.data.user.email,
        tenant: this.data.user.tenant || ''
      });
      
      // Hacer los campos email y tenant de solo lectura
      this.profileForm.get('email')?.disable();
      this.profileForm.get('tenant')?.disable();
    }
  }

  onSubmit(): void {
    if (this.profileForm.valid) {
      this.loading = true;
      const formData = this.profileForm.value;
      
      // Preparar datos para enviar (solo nombre y contraseña si está presente)
      const payload: any = {
        name: formData.name
      };
      
      // Solo incluir contraseña si no está vacía
      if (formData.password && formData.password.trim() !== '') {
        payload.password = formData.password;
      }
      
      // Enviar la petición
      this.updateProfile(payload);
    } else {
      this.snackBar.open('Por favor, complete todos los campos requeridos', 'Cerrar', { duration: 3000 });
    }
  }

  private updateProfile(payload: any): void {
    // Usar el endpoint de la API central para actualizar el perfil del usuario
    // El endpoint es: PUT /api/user/profile
    const updateUrl = `${environment.authApiUrl}/api/user/profile`;
    
    this.http.put(updateUrl, payload).subscribe({
      next: (response: any) => {
        this.loading = false;
        this.snackBar.open('Perfil actualizado correctamente', 'Cerrar', { duration: 3000 });
        
        // Actualizar el usuario en el AuthService
        if (response.data && response.success) {
          this.authService.updateCurrentUser({
            name: response.data.name,
            email: response.data.email
          });
        }
        
        this.dialogRef.close(true);
      },
      error: (error) => {
        this.loading = false;
        console.error('Error updating profile:', error);
        this.snackBar.open('Error al actualizar perfil', 'Cerrar', { duration: 3000 });
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  getErrorMessage(field: string): string {
    const control = this.profileForm.get(field);
    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (control?.hasError('email')) {
      return 'Ingrese un email válido';
    }
    if (control?.hasError('minlength')) {
      return 'Mínimo 2 caracteres';
    }
    return '';
  }
}

