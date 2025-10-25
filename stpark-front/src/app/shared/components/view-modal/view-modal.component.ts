import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';

export interface ViewModalData {
  title: string;
  data: any;
  fields: ViewModalField[];
  actions?: ViewModalAction[];
}

export interface ViewModalField {
  label: string;
  key: string;
  type?: 'text' | 'date' | 'boolean' | 'array' | 'object' | 'chip' | 'badge';
  icon?: string;
  format?: (value: any) => string;
  chipColor?: (value: any) => string;
  badgeColor?: (value: any) => string;
}

export interface ViewModalAction {
  label: string;
  icon: string;
  color: 'primary' | 'accent' | 'warn';
  action: () => void;
}

@Component({
  selector: 'app-view-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule
  ],
  templateUrl: './view-modal.component.html',
  styleUrls: ['./view-modal.component.scss']
})
export class ViewModalComponent {
  constructor(
    private dialogRef: MatDialogRef<ViewModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ViewModalData
  ) {}

  getFieldValue(field: ViewModalField): any {
    const value = this.getNestedValue(this.data.data, field.key);
    
    if (field.format) {
      return field.format(value);
    }
    
    return value;
  }

  getFieldDisplayValue(field: ViewModalField): string {
    const value = this.getFieldValue(field);
    
    if (value === null || value === undefined) {
      return 'No especificado';
    }
    
    switch (field.type) {
      case 'boolean':
        return value ? 'Sí' : 'No';
      case 'date':
        return new Date(value).toLocaleDateString('es-ES');
      case 'array':
        return Array.isArray(value) ? value.join(', ') : 'No especificado';
      case 'object':
        return typeof value === 'object' ? JSON.stringify(value) : value;
      default:
        return String(value);
    }
  }

  getChipColor(field: ViewModalField): string {
    const value = this.getFieldValue(field);
    if (field.chipColor) {
      return field.chipColor(value);
    }
    return 'primary';
  }

  getBadgeColor(field: ViewModalField): string {
    const value = this.getFieldValue(field);
    if (field.badgeColor) {
      return field.badgeColor(value);
    }
    return 'primary';
  }

  onAction(action: ViewModalAction): void {
    action.action();
  }

  onClose(): void {
    this.dialogRef.close();
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }
}
