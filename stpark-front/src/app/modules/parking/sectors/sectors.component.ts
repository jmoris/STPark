import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent, MatPaginatorIntl } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { SectorService } from 'app/core/services/sector.service';
import { Sector } from 'app/interfaces/parking.interface';
import { SectorFormComponent, SectorFormData } from './sector-form/sector-form.component';
import { ViewModalComponent, ViewModalData, ViewModalField } from 'app/shared/components/view-modal/view-modal.component';
import { getSpanishPaginatorIntl } from 'app/core/providers/spanish-paginator-intl';

@Component({
  selector: 'app-sectors',
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
    MatDialogModule,
    MatSelectModule,
    MatPaginatorModule,
    MatSortModule
  ],
  providers: [
    { provide: MatPaginatorIntl, useValue: getSpanishPaginatorIntl() }
  ],
  templateUrl: './sectors.component.html',
  styleUrls: ['./sectors.component.scss']
})
export class SectorsComponent implements OnInit, OnDestroy, AfterViewInit {
  private _unsubscribeAll: Subject<any> = new Subject<any>();

  @ViewChild(MatSort) sort!: MatSort;
  
  sectors: Sector[] = [];
  dataSource = new MatTableDataSource<Sector>([]);
  loading = false;
  displayedColumns: string[] = ['name', 'type', 'streets_count', 'operators_count', 'status', 'actions'];
  
  // Paginación
  totalItems = 0;
  pageSize = 10;
  currentPage = 0;
  pageSizeOptions = [5, 10, 25, 50];
  
  // Filtros
  filters = {
    name: '',
    is_private: undefined
  };

  constructor(
    private sectorService: SectorService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadSectors();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    // Forzar recarga después de que la vista esté inicializada
    setTimeout(() => {
      this.loadSectors();
    }, 100);
  }

  ngOnDestroy(): void {
    this._unsubscribeAll.next(null);
    this._unsubscribeAll.complete();
  }

  loadSectors(): void {
    this.loading = true;
    
    // Filtrar parámetros undefined para evitar enviar filtros vacíos
    const params: any = {
      page: this.currentPage + 1, // Backend usa 1-based indexing
      per_page: this.pageSize
    };

    // Solo agregar filtros que tengan valores válidos
    if (this.filters.name && this.filters.name.trim() !== '') {
      params.name = this.filters.name;
    }
    if (this.filters.is_private !== undefined && this.filters.is_private !== 'undefined') {
      params.is_private = this.filters.is_private;
    }

    this.sectorService.getSectors(params)
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe({
        next: (response) => {
          this.sectors = (response.data as any)?.data || [];
          this.dataSource.data = this.sectors;
          this.totalItems = (response.data as any)?.total || 0;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading sectors:', error);
          this.loading = false;
        }
      });
  }

  getSectorType(sector: Sector): string {
    return sector.is_private ? 'Privado' : 'Público';
  }

  getSectorTypeColor(sector: Sector): string {
    return sector.is_private ? 'purple' : 'blue';
  }

  getStreetsCount(sector: Sector): number {
    return sector.streets?.length || 0;
  }

  getOperatorsCount(sector: Sector): number {
    return sector.operators?.length || 0;
  }

  getOperators(sector: Sector): any[] {
    return sector.operators || [];
  }

  getStatusColor(sector: Sector): string {
    const operatorsCount = this.getOperatorsCount(sector);
    const streetsCount = this.getStreetsCount(sector);
    
    if (operatorsCount === 0) return 'red';
    if (streetsCount === 0) return 'orange';
    return 'green';
  }

  getStatusText(sector: Sector): string {
    const operatorsCount = this.getOperatorsCount(sector);
    const streetsCount = this.getStreetsCount(sector);
    
    if (operatorsCount === 0) return 'Sin operadores';
    if (streetsCount === 0) return 'Sin calles';
    return 'Activo';
  }

  createSector(): void {
    const dialogRef = this.dialog.open(SectorFormComponent, {
      width: '600px',
      data: { isEdit: false } as SectorFormData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadSectors();
      }
    });
  }

  editSector(sector: Sector): void {
    const dialogRef = this.dialog.open(SectorFormComponent, {
      width: '600px',
      data: { isEdit: true, sector } as SectorFormData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadSectors();
      }
    });
  }

  deleteSector(sector: Sector): void {
    if (confirm(`¿Está seguro de eliminar el sector ${sector.name}?`)) {
      this.sectorService.deleteSector(sector.id).subscribe({
        next: () => {
          this.snackBar.open('Sector eliminado correctamente', 'Cerrar', { duration: 3000 });
          this.loadSectors();
        },
        error: (error) => {
          this.snackBar.open('Error al eliminar sector', 'Cerrar', { duration: 3000 });
        }
      });
    }
  }

  getPublicSectorsCount(): number {
    return this.sectors.filter(sector => !sector.is_private).length;
  }

  getPrivateSectorsCount(): number {
    return this.sectors.filter(sector => sector.is_private).length;
  }

  getSectorsWithoutOperators(): number {
    return this.sectors.filter(sector => this.getOperatorsCount(sector) === 0).length;
  }

  viewSector(sector: Sector): void {
    const fields: ViewModalField[] = [
      {
        label: 'Nombre',
        key: 'name',
        icon: 'location_city',
        type: 'text'
      },
      {
        label: 'Tipo',
        key: 'is_private',
        icon: 'security',
        type: 'badge',
        format: (value) => value ? 'Privado' : 'Público',
        badgeColor: (value) => value ? 'accent' : 'primary'
      },
      {
        label: 'Estado',
        key: 'is_active',
        icon: 'toggle_on',
        type: 'badge',
        format: (value) => value ? 'Activo' : 'Inactivo',
        badgeColor: (value) => value ? 'success' : 'error'
      },
      {
        label: 'Calles',
        key: 'streets',
        icon: 'road',
        type: 'array',
        format: (streets) => {
          if (!streets || streets.length === 0) return ['Sin calles'];
          return streets.map((street: any) => street.name);
        }
      },
      {
        label: 'Operadores Asignados',
        key: 'operators',
        icon: 'people',
        type: 'array',
        format: (operators) => {
          if (!operators || operators.length === 0) return ['Sin operadores'];
          return operators.map((operator: any) => operator.name);
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
        title: 'Detalles del Sector',
        data: sector,
        fields: fields,
        actions: [
          {
            label: 'Editar',
            icon: 'edit',
            color: 'primary',
            action: () => {
              dialogRef.close();
              this.editSector(sector);
            }
          }
        ]
      } as ViewModalData
    });
  }

  // Manejo de paginación
  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadSectors();
  }

  // Manejo de filtros
  applyFilters(): void {
    this.currentPage = 0; // Reset a la primera página
    this.loadSectors();
  }

  clearFilters(): void {
    this.filters = {
      name: '',
      is_private: undefined
    };
    this.currentPage = 0;
    this.loadSectors();
  }
}
