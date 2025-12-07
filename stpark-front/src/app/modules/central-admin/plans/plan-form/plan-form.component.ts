import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PlanService, Plan, PlanFeature } from 'app/core/services/plan.service';

export interface PlanFormData {
  plan?: Plan;
  isEdit: boolean;
}

@Component({
  selector: 'app-plan-form',
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
    MatCheckboxModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './plan-form.component.html',
  styleUrls: ['./plan-form.component.scss']
})
export class PlanFormComponent implements OnInit {
  planForm: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<PlanFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PlanFormData,
    private planService: PlanService,
    private snackBar: MatSnackBar
  ) {
    this.planForm = this.createForm();
  }

  ngOnInit(): void {
    if (this.data.isEdit && this.data.plan) {
      this.loadPlanData();
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      max_price_uf: [0, [Validators.required, Validators.min(0)]],
      status: ['ACTIVE', Validators.required],
      feature: this.fb.group({
        max_operators: [null],
        max_streets: [null],
        max_sectors: [null],
        max_sessions: [null],
        max_pricing_profiles: [null],
        max_pricing_rules: [null],
        includes_debt_management: [false],
        report_type: ['BASIC'],
        support_type: ['BASIC']
      })
    });
  }

  private loadPlanData(): void {
    if (this.data.plan) {
      this.planForm.patchValue({
        name: this.data.plan.name,
        description: this.data.plan.description || '',
        max_price_uf: this.data.plan.max_price_uf,
        status: this.data.plan.status,
        feature: {
          max_operators: this.data.plan.feature?.max_operators || null,
          max_streets: this.data.plan.feature?.max_streets || null,
          max_sectors: this.data.plan.feature?.max_sectors || null,
          max_sessions: this.data.plan.feature?.max_sessions || null,
          max_pricing_profiles: this.data.plan.feature?.max_pricing_profiles || null,
          max_pricing_rules: this.data.plan.feature?.max_pricing_rules || null,
          includes_debt_management: this.data.plan.feature?.includes_debt_management || false,
          report_type: this.data.plan.feature?.report_type || 'BASIC',
          support_type: this.data.plan.feature?.support_type || 'BASIC'
        }
      });
    }
  }

  getErrorMessage(controlName: string): string {
    const control = this.planForm.get(controlName);
    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (control?.hasError('minlength')) {
      return 'Debe tener al menos 2 caracteres';
    }
    if (control?.hasError('min')) {
      return 'El valor debe ser mayor o igual a 0';
    }
    return 'Campo inválido';
  }

  onSubmit(): void {
    if (this.planForm.valid) {
      this.loading = true;
      const formValue = this.planForm.value;
      
      const planData: Partial<Plan> = {
        name: formValue.name,
        description: formValue.description,
        max_price_uf: formValue.max_price_uf,
        status: formValue.status,
        feature: formValue.feature
      };

      if (this.data.isEdit && this.data.plan?.id) {
        this.planService.updatePlan(this.data.plan.id, planData).subscribe({
          next: (response) => {
            this.loading = false;
            this.snackBar.open('Plan actualizado exitosamente', 'Cerrar', { duration: 3000 });
            this.dialogRef.close(true);
          },
          error: (error) => {
            this.loading = false;
            console.error('Error updating plan:', error);
            this.snackBar.open('Error al actualizar plan', 'Cerrar', { duration: 3000 });
          }
        });
      } else {
        this.planService.createPlan(planData).subscribe({
          next: (response) => {
            this.loading = false;
            this.snackBar.open('Plan creado exitosamente', 'Cerrar', { duration: 3000 });
            this.dialogRef.close(true);
          },
          error: (error) => {
            this.loading = false;
            console.error('Error creating plan:', error);
            this.snackBar.open('Error al crear plan', 'Cerrar', { duration: 3000 });
          }
        });
      }
    } else {
      this.planForm.markAllAsTouched();
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
