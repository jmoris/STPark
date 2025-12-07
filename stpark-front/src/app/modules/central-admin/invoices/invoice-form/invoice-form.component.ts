import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { InvoiceService } from 'app/core/services/invoice.service';
import { TenantService, Tenant } from 'app/core/services/tenant.service';
import { Invoice, InvoiceItem } from 'app/interfaces/parking.interface';

export interface InvoiceFormData {
  invoice?: Invoice;
  isEdit: boolean;
  tenants: Tenant[];
}

@Component({
  selector: 'app-invoice-form',
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
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './invoice-form.component.html',
  styleUrls: ['./invoice-form.component.scss']
})
export class InvoiceFormComponent implements OnInit {
  invoiceForm!: FormGroup;
  loading = false;

  get itemsFormArray(): FormArray {
    return this.invoiceForm.get('items') as FormArray;
  }

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<InvoiceFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: InvoiceFormData,
    private invoiceService: InvoiceService,
    private tenantService: TenantService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.invoiceForm = this.createForm();
    if (this.data.isEdit && this.data.invoice) {
      setTimeout(() => {
        this.loadInvoiceData();
      }, 50);
    } else {
      // Agregar un item inicial
      this.addItem();
      // Calcular totales iniciales
      setTimeout(() => {
        this.calculateTotals();
      }, 100);
    }

    // Suscribirse a cambios en tenant_id para cargar datos de facturación
    this.invoiceForm.get('tenant_id')?.valueChanges.subscribe(tenantId => {
      if (tenantId && !this.data.isEdit) {
        this.loadTenantBillingData(tenantId);
      }
    });
  }

  private createForm(): FormGroup {
    // Fecha de hoy como valor por defecto
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    
    const form = this.fb.group({
      tenant_id: ['', Validators.required],
      client_name: ['', [Validators.required, Validators.minLength(2)]],
      client_rut: ['', [Validators.required]],
      emission_date: [todayString, Validators.required],
      notes: [''],
      items: this.fb.array([]),
      // Campos para almacenar los totales calculados
      _net_amount: [0],
      _iva_amount: [0],
      _total_amount: [0]
    });
    
    return form;
  }

  private loadInvoiceData(): void {
    if (this.data.invoice) {
      const formValue: any = {
        tenant_id: this.data.invoice.tenant?.id || '',
        client_name: this.data.invoice.client_name,
        client_rut: this.data.invoice.client_rut,
        emission_date: this.data.invoice.emission_date,
        notes: this.data.invoice.notes || ''
      };

      // Cargar items
      if (this.data.invoice.items && this.data.invoice.items.length > 0) {
        this.data.invoice.items.forEach(item => {
          this.addItem(item);
        });
      } else {
        this.addItem();
      }

      this.invoiceForm.patchValue(formValue, { emitEvent: false });
    }
  }

  private loadTenantBillingData(tenantId: string): void {
    // Buscar el tenant en la lista de tenants pasada como data
    const tenant = this.data.tenants.find(t => t.id === tenantId);
    
    if (tenant) {
      // Si el tenant tiene datos de facturación, prellenar los campos
      if (tenant.razon_social || tenant.rut) {
        const billingData: any = {};
        
        if (tenant.razon_social) {
          billingData.client_name = tenant.razon_social;
        }
        
        if (tenant.rut) {
          billingData.client_rut = tenant.rut;
        }
        
        // Solo actualizar si hay datos para prellenar
        if (Object.keys(billingData).length > 0) {
          this.invoiceForm.patchValue(billingData, { emitEvent: false });
        }
      }
    } else {
      // Si no está en la lista, obtenerlo del servicio
      this.tenantService.getTenant(tenantId).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            const tenantData = response.data;
            const billingData: any = {};
            
            if (tenantData.razon_social) {
              billingData.client_name = tenantData.razon_social;
            }
            
            if (tenantData.rut) {
              billingData.client_rut = tenantData.rut;
            }
            
            // Solo actualizar si hay datos para prellenar
            if (Object.keys(billingData).length > 0) {
              this.invoiceForm.patchValue(billingData, { emitEvent: false });
            }
          }
        },
        error: (error) => {
          console.error('Error loading tenant billing data:', error);
          // No mostrar error al usuario, simplemente no prellenar
        }
      });
    }
  }

  createItemFormGroup(item?: InvoiceItem): FormGroup {
    const quantity = item?.quantity || 1;
    const unitPrice = item?.unit_price || 0;
    const subtotal = item?.subtotal || (quantity * unitPrice);
    
    return this.fb.group({
      description: [item?.description || '', [Validators.required, Validators.minLength(2)]],
      quantity: [quantity, [Validators.required, Validators.min(1)]],
      unit_price: [unitPrice, [Validators.required, Validators.min(0)]],
      subtotal: [subtotal, [Validators.required, Validators.min(0)]],
      notes: [item?.notes || '']
    });
  }

  addItem(item?: InvoiceItem): void {
    const itemGroup = this.createItemFormGroup(item);
    
    // Calcular subtotal cuando cambian quantity o unit_price
    itemGroup.get('quantity')?.valueChanges.subscribe(() => {
      this.calculateItemSubtotal(itemGroup);
    });
    
    itemGroup.get('unit_price')?.valueChanges.subscribe(() => {
      this.calculateItemSubtotal(itemGroup);
    });
    
    this.itemsFormArray.push(itemGroup);
    
    // Calcular subtotal inicial siempre
    this.calculateItemSubtotal(itemGroup);
  }

  removeItem(index: number): void {
    this.itemsFormArray.removeAt(index);
    this.calculateTotals();
  }

  calculateItemSubtotal(itemGroup: FormGroup): void {
    const quantity = parseFloat(itemGroup.get('quantity')?.value) || 0;
    const unitPrice = parseFloat(itemGroup.get('unit_price')?.value) || 0;
    const subtotal = quantity * unitPrice;
    // Actualizar el subtotal (habilitado para que se envíe al backend)
    itemGroup.patchValue({ subtotal: Math.round(subtotal * 100) / 100 }, { emitEvent: false });
    this.calculateTotals();
  }

  calculateTotals(): void {
    let netAmount = 0;
    
    this.itemsFormArray.controls.forEach(control => {
      const subtotal = parseFloat(control.get('subtotal')?.value) || 0;
      netAmount += subtotal;
    });

    // Redondear el monto neto a 2 decimales
    netAmount = Math.round(netAmount * 100) / 100;

    // Calcular IVA (19% en Chile)
    const ivaPercentage = 19;
    const ivaAmount = Math.round((netAmount * (ivaPercentage / 100)) * 100) / 100;
    const totalAmount = Math.round((netAmount + ivaAmount) * 100) / 100;

    // Guardar los totales en el formulario para usarlos al enviar
    // Usamos setValue en lugar de patchValue para asegurar que se establezcan
    const currentFormValue = this.invoiceForm.value;
    this.invoiceForm.patchValue({
      ...currentFormValue,
      _net_amount: netAmount,
      _iva_amount: ivaAmount,
      _total_amount: totalAmount
    }, { emitEvent: false });
  }

  getErrorMessage(controlName: string): string {
    const control = this.invoiceForm.get(controlName);
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

  getItemErrorMessage(index: number, controlName: string): string {
    const itemGroup = this.itemsFormArray.at(index) as FormGroup;
    const control = itemGroup?.get(controlName);
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
    if (this.invoiceForm.valid && this.itemsFormArray.length > 0) {
      this.loading = true;
      
      // Calcular totales finales
      this.calculateTotals();
      
      const formValue = this.invoiceForm.value;
      
      // Formatear fecha de emisión (asegurar formato YYYY-MM-DD)
      let emissionDate = formValue.emission_date;
      if (emissionDate instanceof Date) {
        emissionDate = emissionDate.toISOString().split('T')[0];
      } else if (typeof emissionDate === 'string') {
        // Si ya es string, asegurar formato correcto
        const dateObj = new Date(emissionDate);
        if (!isNaN(dateObj.getTime())) {
          emissionDate = dateObj.toISOString().split('T')[0];
        }
      }
      
      // Preparar datos de la factura
      const invoiceData: any = {
        tenant_id: formValue.tenant_id,
        client_name: formValue.client_name.trim(),
        client_rut: formValue.client_rut.trim(),
        emission_date: emissionDate,
        // El estado siempre será PENDING_REVIEW para nuevas facturas
        // En edición, se mantiene el estado actual
        status: this.data.isEdit ? (this.data.invoice?.status || 'PENDING_REVIEW') : 'PENDING_REVIEW',
        notes: formValue.notes?.trim() || '',
        net_amount: this.invoiceForm.get('_net_amount')?.value || 0,
        iva_amount: this.invoiceForm.get('_iva_amount')?.value || 0,
        total_amount: this.invoiceForm.get('_total_amount')?.value || 0,
        items: this.itemsFormArray.controls.map(control => {
          const itemValue = control.value;
          const quantity = parseInt(itemValue.quantity) || 0;
          const unitPrice = parseFloat(itemValue.unit_price) || 0;
          // Calcular subtotal si no está presente o es 0
          const subtotal = parseFloat(itemValue.subtotal) || (quantity * unitPrice);
          
          return {
            description: itemValue.description.trim(),
            quantity: quantity,
            unit_price: unitPrice,
            subtotal: subtotal,
            notes: itemValue.notes?.trim() || ''
          };
        })
      };

      if (this.data.isEdit && this.data.invoice) {
        // Modo edición
        this.invoiceService.updateInvoice(this.data.invoice.id!, invoiceData).subscribe({
          next: (response) => {
            this.loading = false;
            this.snackBar.open('Factura actualizada exitosamente', 'Cerrar', { duration: 3000 });
            this.dialogRef.close(true);
          },
          error: (error) => {
            this.loading = false;
            console.error('Error updating invoice:', error);
            const errorMessage = error.error?.message || error.error?.errors || 'Error al actualizar factura';
            this.snackBar.open(errorMessage, 'Cerrar', { duration: 5000 });
          }
        });
      } else {
        // Modo creación
        this.invoiceService.createInvoice(invoiceData).subscribe({
          next: (response) => {
            this.loading = false;
            this.snackBar.open('Factura creada exitosamente', 'Cerrar', { duration: 3000 });
            this.dialogRef.close(true);
          },
          error: (error) => {
            this.loading = false;
            console.error('Error creating invoice:', error);
            const errorMessage = error.error?.message || error.error?.errors || 'Error al crear factura';
            this.snackBar.open(errorMessage, 'Cerrar', { duration: 5000 });
          }
        });
      }
    } else {
      this.invoiceForm.markAllAsTouched();
      if (this.itemsFormArray.length === 0) {
        this.snackBar.open('Debe agregar al menos un item a la factura', 'Cerrar', { duration: 3000 });
      }
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  formatAmount(amount: number): string {
    return this.invoiceService.formatAmount(amount);
  }

  get netAmount(): number {
    // Calcular si no está en el formulario
    if (!this.invoiceForm.get('_net_amount')) {
      this.calculateTotals();
    }
    return parseFloat(this.invoiceForm.get('_net_amount')?.value) || 0;
  }

  get ivaAmount(): number {
    // Calcular si no está en el formulario
    if (!this.invoiceForm.get('_iva_amount')) {
      this.calculateTotals();
    }
    return parseFloat(this.invoiceForm.get('_iva_amount')?.value) || 0;
  }

  get totalAmount(): number {
    // Calcular si no está en el formulario
    if (!this.invoiceForm.get('_total_amount')) {
      this.calculateTotals();
    }
    return parseFloat(this.invoiceForm.get('_total_amount')?.value) || 0;
  }
}
