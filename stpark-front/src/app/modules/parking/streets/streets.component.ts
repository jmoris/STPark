import { Component, OnInit, OnDestroy } from '@angular/core';
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
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { StreetService } from 'app/core/services/street.service';
import { SectorService } from 'app/core/services/sector.service';
import { Street, Sector } from 'app/interfaces/parking.interface';
import { StreetFormComponent, StreetFormData } from './street-form/street-form.component';
import { ViewModalComponent, ViewModalData, ViewModalField } from 'app/shared/components/view-modal/view-modal.component';
import { getSpanishPaginatorIntl } from 'app/core/providers/spanish-paginator-intl';

@Component({
  selector: 'app-streets',
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
    MatPaginatorModule
  ],
  providers: [
    { provide: MatPaginatorIntl, useValue: getSpanishPaginatorIntl() }
  ],
  templateUrl: './streets.component.html',
  styleUrls: ['./streets.component.scss']
})
export class StreetsComponent implements OnInit, OnDestroy {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  streets: Street[] = [];
  sectors: Sector[] = [];
  loading = false;
  displayedColumns: string[] = ['name', 'sector', 'type', 'sessions_count', 'operators_count', 'actions'];
  
  // Paginación
  totalItems = 0;
  pageSize = 10;
  currentPage = 0;
  pageSizeOptions = [5, 10, 25, 50];
  
  // Filtros
  filters = {
    name: '',
    sector_id: ''
  };

  constructor(
    private streetService: StreetService,
    private sectorService: SectorService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadSectors();
    this.loadStreets();
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  loadStreets(): void {
    this.loading = true;
    
    const params: any = {
      page: this.currentPage + 1,
      per_page: this.pageSize
    };

    if (this.filters.name && this.filters.name.trim() !== '') {
      params.name = this.filters.name;
    }
    if (this.filters.sector_id && this.filters.sector_id !== '') {
      params.sector_id = this.filters.sector_id;
    }

    this.streetService.getStreets(params)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.streets = (response.data as any)?.data || [];
          this.totalItems = (response.data as any)?.total || 0;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading streets:', error);
          this.loading = false;
        }
      });
  }

  loadSectors(): void {
    this.sectorService.getSectors()
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.sectors = (response.data as any)?.data || [];
        },
        error: (error) => {
          console.error('Error loading sectors:', error);
        }
      });
  }

  getSectorName(street: Street): string {
    return (street as any).sector?.name || 'Sector no encontrado';
  }

  getFullAddress(street: Street): string {
    if (street.is_specific_address && street.address_number) {
      return `${street.name} ${street.address_number}`;
    }
    
    if (street.block_range) {
      return `${street.name} (Cuadras ${street.block_range})`;
    }
    
    return street.name;
  }

  getAddressType(street: Street): string {
    return street.is_specific_address ? 'Dirección Específica' : 'Calle Completa';
  }

  getAddressTypeColor(street: Street): string {
    return street.is_specific_address ? 'purple' : 'blue';
  }

  getSessionsCount(street: Street): number {
    return (street as any).parking_sessions?.length || 0;
  }

  getOperatorsCount(street: Street): number {
    return (street as any).operator_assignments?.length || 0;
  }

  createStreet(): void {
    const dialogRef = this.dialog.open(StreetFormComponent, {
      width: '600px',
      data: { isEdit: false } as StreetFormData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadStreets();
      }
    });
  }

  editStreet(street: Street): void {
    const dialogRef = this.dialog.open(StreetFormComponent, {
      width: '600px',
      data: { isEdit: true, street } as StreetFormData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadStreets();
      }
    });
  }

  deleteStreet(street: Street): void {
    if (confirm(`¿Está seguro de eliminar la calle ${street.name}?`)) {
      this.streetService.deleteStreet(street.id).subscribe({
        next: () => {
          this.snackBar.open('Calle eliminada correctamente', 'Cerrar', { duration: 3000 });
          this.loadStreets();
        },
        error: (error) => {
          this.snackBar.open('Error al eliminar calle', 'Cerrar', { duration: 3000 });
        }
      });
    }
  }

  viewStreet(street: Street): void {
    const fields: ViewModalField[] = [
      {
        label: 'Dirección Completa',
        key: 'name',
        icon: 'road',
        type: 'text',
        format: (value) => this.getFullAddress(street)
      },
      {
        label: 'Sector',
        key: 'sector.name',
        icon: 'location_city',
        type: 'text'
      },
      {
        label: 'Tipo de Dirección',
        key: 'is_specific_address',
        icon: 'category',
        type: 'badge',
        format: (value) => value ? 'Dirección Específica' : 'Calle Completa',
        badgeColor: (value) => value ? 'accent' : 'primary'
      },
      {
        label: 'Número de Dirección',
        key: 'address_number',
        icon: 'tag',
        type: 'text'
      },
      {
        label: 'Rango de Cuadras',
        key: 'block_range',
        icon: 'straighten',
        type: 'text'
      },
      {
        label: 'Sesiones de Estacionamiento',
        key: 'parking_sessions',
        icon: 'directions_car',
        type: 'text',
        format: (sessions) => {
          const count = sessions ? sessions.length : 0;
          return `${count} sesión${count !== 1 ? 'es' : ''}`;
        }
      },
      {
        label: 'Operadores Asignados',
        key: 'operator_assignments',
        icon: 'people',
        type: 'text',
        format: (assignments) => {
          const count = assignments ? assignments.length : 0;
          return `${count} operador${count !== 1 ? 'es' : ''}`;
        }
      },
      {
        label: 'Notas',
        key: 'notes',
        icon: 'note',
        type: 'text'
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
        title: 'Detalles de la Calle/Dirección',
        data: street,
        fields: fields,
        actions: [
          {
            label: 'Editar',
            icon: 'edit',
            color: 'primary',
            action: () => {
              dialogRef.close();
              this.editStreet(street);
            }
          }
        ]
      } as ViewModalData
    });
  }

  getTotalStreetsCount(): number {
    return this.streets.length;
  }

  getStreetsWithSessions(): number {
    return this.streets.filter(street => this.getSessionsCount(street) > 0).length;
  }

  getStreetsWithOperators(): number {
    return this.streets.filter(street => this.getOperatorsCount(street) > 0).length;
  }

  // Manejo de paginación
  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadStreets();
  }

  // Manejo de filtros
  applyFilters(): void {
    this.currentPage = 0;
    this.loadStreets();
  }

  clearFilters(): void {
    this.filters = {
      name: '',
      sector_id: ''
    };
    this.currentPage = 0;
    this.loadStreets();
  }
}
