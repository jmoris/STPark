import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent, MatPaginatorIntl } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { OperatorService } from 'app/core/services/operator.service';
import { Operator } from 'app/interfaces/parking.interface';
import { OperatorFormComponent, OperatorFormData } from './operator-form/operator-form.component';
import { ViewModalComponent, ViewModalData, ViewModalField } from 'app/shared/components/view-modal/view-modal.component';
import { OperatorAssignmentComponent, OperatorAssignmentData } from './operator-assignment/operator-assignment.component';
import { getSpanishPaginatorIntl } from 'app/core/providers/spanish-paginator-intl';

@Component({
  selector: 'app-operators',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatToolbarModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatChipsModule,
    MatSelectModule,
    MatPaginatorModule,
    MatSortModule
  ],
  providers: [
    { provide: MatPaginatorIntl, useValue: getSpanishPaginatorIntl() }
  ],
  templateUrl: './operators.component.html',
  styleUrls: ['./operators.component.scss']
})
export class OperatorsComponent implements OnInit, OnDestroy, AfterViewInit {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  @ViewChild(MatSort) sort!: MatSort;
  
  operators: Operator[] = [];
  loading = false;
  displayedColumns: string[] = ['name', 'rut', 'email', 'phone', 'status', 'actions'];
  
  // Paginación
  totalItems = 0;
  pageSize = 10;
  currentPage = 0;
  pageSizeOptions = [5, 10, 25, 50];

  // Ordenamiento
  sortBy: string = 'name';
  sortOrder: 'asc' | 'desc' = 'asc';
  
  // Filtros
  filters = {
    name: '',
    status: '',
    sector: ''
  };

  constructor(
    private operatorService: OperatorService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadOperators();
  }

  ngAfterViewInit(): void {
    // Suscribirse a cambios de ordenamiento
    if (this.sort) {
      this.sort.sortChange
        .pipe(takeUntil(this._unsubscribeAll))
        .subscribe(sort => {
          this.sortBy = sort.active;
          this.sortOrder = sort.direction === 'asc' ? 'asc' : 'desc';
          this.currentPage = 0; // Reset a la primera página al cambiar ordenamiento
          this.loadOperators();
        });
    }
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  loadOperators(): void {
    this.loading = true;
    
    const params = {
      page: this.currentPage + 1, // Backend usa 1-based indexing
      per_page: this.pageSize,
      sort_by: this.sortBy,
      sort_order: this.sortOrder,
      ...this.filters
    };

    this.operatorService.getOperators(params)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.operators = (response.data as any)?.data || [];
          this.totalItems = (response.data as any)?.total || 0;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading operators:', error);
          this.loading = false;
        }
      });
  }

  getAssignmentsCount(operator: Operator): number {
    // Contar sectores asignados desde operator_assignments
    if (!operator.operator_assignments || operator.operator_assignments.length === 0) {
      return 0;
    }
    
    // Obtener sectores únicos asignados
    const assignedSectors = new Set<number>();
    operator.operator_assignments.forEach((assignment: any) => {
      if (assignment.sector && assignment.sector.id) {
        assignedSectors.add(assignment.sector.id);
      }
    });
    
    return assignedSectors.size;
  }

  getAssignments(operator: Operator): any[] {
    if (!operator.operator_assignments || operator.operator_assignments.length === 0) {
      return [];
    }
    
    const assignments = [];
    const processedSectors = new Set<number>();
    
    // Solo agregar sectores únicos
    operator.operator_assignments.forEach((assignment: any) => {
      if (assignment.sector && assignment.sector.id && !processedSectors.has(assignment.sector.id)) {
        assignments.push({
          type: 'Sector',
          name: assignment.sector.name,
          id: assignment.sector.id
        });
        processedSectors.add(assignment.sector.id);
      }
    });
    
    return assignments;
  }

  getStatusColor(operator: Operator): string {
    const assignmentsCount = this.getAssignmentsCount(operator);
    return assignmentsCount > 0 ? 'assigned' : 'unassigned';
  }

  getStatusText(operator: Operator): string {
    const assignmentsCount = this.getAssignmentsCount(operator);
    return assignmentsCount > 0 ? 'Asignado' : 'Sin asignar';
  }

  createOperator(): void {
    const dialogRef = this.dialog.open(OperatorFormComponent, {
      width: '600px',
      data: { isEdit: false } as OperatorFormData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadOperators();
      }
    });
  }

  editOperator(operator: Operator): void {
    const dialogRef = this.dialog.open(OperatorFormComponent, {
      width: '600px',
      data: { isEdit: true, operator } as OperatorFormData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadOperators();
      }
    });
  }

  deleteOperator(operator: Operator): void {
    if (confirm(`¿Está seguro de eliminar al operador ${operator.name}?`)) {
      this.operatorService.deleteOperator(operator.id).subscribe({
        next: () => {
          this.snackBar.open('Operador eliminado correctamente', 'Cerrar', { duration: 3000 });
          this.loadOperators();
        },
        error: (error) => {
          this.snackBar.open('Error al eliminar operador', 'Cerrar', { duration: 3000 });
        }
      });
    }
  }

  getAssignedCount(): number {
    return this.operators.filter(operator => this.getAssignmentsCount(operator) > 0).length;
  }

  getUnassignedCount(): number {
    return this.operators.filter(operator => this.getAssignmentsCount(operator) === 0).length;
  }

  viewOperator(operator: Operator): void {
    const fields: ViewModalField[] = [
      {
        label: 'Nombre',
        key: 'name',
        icon: 'person',
        type: 'text'
      },
      {
        label: 'RUT',
        key: 'rut',
        icon: 'badge',
        type: 'text'
      },
      {
        label: 'Email',
        key: 'email',
        icon: 'email',
        type: 'text'
      },
      {
        label: 'Teléfono',
        key: 'phone',
        icon: 'phone',
        type: 'text'
      },
      {
        label: 'Estado',
        key: 'status',
        icon: 'toggle_on',
        type: 'badge',
        badgeColor: (value) => value === 'ACTIVE' ? 'success' : 'error'
      },
      {
        label: 'Asignaciones',
        key: 'operator_assignments',
        icon: 'location_on',
        type: 'array',
        format: (assignments) => {
          if (!assignments || assignments.length === 0) return ['Sin asignaciones'];
          return assignments.map((assignment: any) => 
            `${assignment.sector?.name || 'Sector'}${assignment.street?.name ? ' - ' + assignment.street.name : ''}`
          );
        }
      },
      {
        label: 'Fecha de Creación',
        key: 'created_at',
        icon: 'schedule',
        type: 'date'
      }
    ];

    const dialogRef = this.dialog.open(ViewModalComponent, {
      width: '600px',
      data: {
        title: 'Detalles del Operador',
        data: operator,
        fields: fields,
        actions: [
          {
            label: 'Editar',
            icon: 'edit',
            color: 'primary',
            action: () => {
              dialogRef.close();
              this.editOperator(operator);
            }
          },
          {
            label: 'Asignar',
            icon: 'location_on',
            color: 'accent',
            action: () => {
              dialogRef.close();
              this.assignOperator(operator);
            }
          }
        ]
      } as ViewModalData
    });
  }

  removeAllAssignments(operator: Operator): void {
    if (confirm(`¿Está seguro de eliminar todas las asignaciones del operador ${operator.name}?`)) {
      this.operatorService.removeAllAssignments(operator.id).subscribe({
        next: (response) => {
          this.snackBar.open(response.message || 'Asignaciones eliminadas correctamente', 'Cerrar', { duration: 3000 });
          this.loadOperators();
        },
        error: (error) => {
          this.snackBar.open('Error al eliminar asignaciones', 'Cerrar', { duration: 3000 });
        }
      });
    }
  }

  assignOperator(operator: Operator): void {
    const dialogRef = this.dialog.open(OperatorAssignmentComponent, {
      width: '600px',
      data: { operator } as OperatorAssignmentData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadOperators();
      }
    });
  }

  applyFilters(): void {
    this.currentPage = 0;
    this.loadOperators();
  }

  clearFilters(): void {
    this.filters = {
      name: '',
      status: '',
      sector: ''
    };
    this.currentPage = 0;
    this.loadOperators();
  }

  // Manejo de paginación
  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadOperators();
  }

  // Asignar sector a operador
  assignSector(operator: Operator): void {
    const dialogRef = this.dialog.open(OperatorAssignmentComponent, {
      width: '600px',
      data: { isEdit: false, operator } as OperatorAssignmentData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadOperators(); // Recargar la lista
      }
    });
  }
}
