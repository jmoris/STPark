import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { TenantConfigComponent } from './tenant-config/tenant-config.component';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class TenantConfigService {
  constructor(
    private dialog: MatDialog,
    private configService: ConfigService
  ) {}

  /**
   * Muestra el diálogo de configuración de tenant
   */
  showTenantConfigDialog(): Observable<boolean> {
    const dialogRef = this.dialog.open(TenantConfigComponent, {
      width: '450px',
      disableClose: true, // No permitir cerrar sin configurar
      data: {}
    });

    return dialogRef.afterClosed();
  }

  /**
   * Verifica si el tenant está configurado, si no, muestra el diálogo
   */
  ensureTenantConfigured(): Observable<boolean> {
    if (this.configService.hasTenant()) {
      return new Observable(observer => {
        observer.next(true);
        observer.complete();
      });
    }

    return this.showTenantConfigDialog();
  }

  /**
   * Permite cambiar el tenant actual
   */
  changeTenant(): Observable<boolean> {
    return this.showTenantConfigDialog();
  }

  /**
   * Obtiene el tenant actual
   */
  getCurrentTenant(): string | null {
    return this.configService.getCurrentTenant();
  }

  /**
   * Verifica si hay un tenant configurado
   */
  hasTenant(): boolean {
    return this.configService.hasTenant();
  }
}
