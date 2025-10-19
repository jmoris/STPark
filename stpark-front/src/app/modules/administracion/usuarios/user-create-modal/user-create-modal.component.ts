import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { User } from 'app/interfaces/user.interface';

@Component({
  selector: 'app-user-create-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule
  ],
  templateUrl: './user-create-modal.component.html',
  styleUrls: ['./user-create-modal.component.scss']
})
export class UserCreateModalComponent implements OnInit, OnChanges {
  @Input() visible: boolean = false;
  @Input() userToEdit: User | null = null; // Usuario a editar
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() userCreated = new EventEmitter<User>();
  @Output() userUpdated = new EventEmitter<User>();

  userForm: FormGroup;
  isEditMode: boolean = false;
  
  // Opciones de roles disponibles
  roleOptions = [
    { label: 'Administrador', value: 'Administrador' },
    { label: 'Supervisor', value: 'Supervisor' },
    { label: 'Operador', value: 'Operador' },
    { label: 'Auditor', value: 'Auditor' }
  ];

  constructor(private fb: FormBuilder) {
    this.userForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      lastname: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      role: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    console.log('UserCreateModalComponent ngOnInit - visible:', this.visible);
    // Resetear formulario cuando se abre el modal
    if (this.visible) {
      this.resetForm();
    }
  }

  ngOnChanges(): void {
    if (this.visible) {
      this.isEditMode = !!this.userToEdit;
      this.resetForm();
      
      if (this.isEditMode && this.userToEdit) {
        // Usar setTimeout para asegurar que el formulario esté listo
        setTimeout(() => {
          this.populateFormForEdit();
        }, 100);
      }
    }
  }

  resetForm(): void {
    this.userForm.reset();
    this.userForm.patchValue({
      name: '',
      lastname: '',
      email: '',
      role: ''
    });
  }

  populateFormForEdit(): void {
    if (this.userToEdit) {
      this.userForm.patchValue({
        name: this.userToEdit.name,
        lastname: this.userToEdit.lastname,
        email: this.userToEdit.email,
        role: this.userToEdit.role
      });
    }
  }

  onSubmit(): void {
    if (this.userForm.valid) {
      const formValue = this.userForm.value;
      
      if (this.isEditMode && this.userToEdit) {
        // Modo edición
        const updatedUser: User = {
          ...this.userToEdit,
          name: formValue.name,
          lastname: formValue.lastname,
          email: formValue.email,
          role: formValue.role
        };
        
        this.userUpdated.emit(updatedUser);
      } else {
        // Modo creación
        const newUser: User = {
          name: formValue.name,
          lastname: formValue.lastname,
          email: formValue.email,
          role: formValue.role,
          status: true, // Por defecto activo
          last_connection: 'Nunca' // Valor por defecto para nuevo usuario
        };
        
        this.userCreated.emit(newUser);
      }
      
      this.closeModal();
    } else {
      // Marcar todos los campos como tocados para mostrar errores
      this.userForm.markAllAsTouched();
    }
  }

  closeModal(): void {
    this.visible = false;
    this.visibleChange.emit(false);
    this.resetForm();
  }

  onVisibleChange(visible: boolean): void {
    console.log('onVisibleChange:', visible);
    this.visibleChange.emit(visible);
  }

  // Métodos para obtener errores de validación
  getFieldError(fieldName: string): string {
    const field = this.userForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return `${this.getFieldLabel(fieldName)} es requerido`;
      }
      if (field.errors['email']) {
        return 'Formato de email inválido';
      }
      if (field.errors['minlength']) {
        return `${this.getFieldLabel(fieldName)} debe tener al menos ${field.errors['minlength'].requiredLength} caracteres`;
      }
    }
    return '';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      name: 'Nombre',
      lastname: 'Apellido',
      email: 'Email',
      role: 'Rol'
    };
    return labels[fieldName] || fieldName;
  }
}
