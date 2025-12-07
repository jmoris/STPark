import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'app/core/services/auth.service';

@Component({
  selector: 'app-redirect',
  template: '<div></div>',
  standalone: true
})
export class RedirectComponent implements OnInit {
  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Verificar si está en modo Administración Central
    if (this.authService.isCentralAdminMode() && this.authService.isCentralAdmin()) {
      this.router.navigate(['/central-admin/dashboard']);
      return;
    }

    // Si el usuario no es administrador central, verificar si tiene tenants asignados
    const tenants = this.authService.getTenants();
    const currentTenant = this.authService.getCurrentTenant();

    // Si tiene tenants pero no hay tenant actual seleccionado, establecer el primero
    if (tenants && tenants.length > 0 && !currentTenant) {
      console.log('Usuario tiene tenants pero no hay tenant actual, estableciendo el primero:', tenants[0]);
      this.authService.setCurrentTenant(tenants[0]);
      this.router.navigate(['/parking/dashboard']);
      return;
    }

    // Si tiene tenant actual, redirigir al dashboard del parking
    if (currentTenant) {
      this.router.navigate(['/parking/dashboard']);
      return;
    }

    // Si no tiene tenants y no es administrador central, redirigir al dashboard del parking
    // (esto puede ser un caso donde el usuario no tiene permisos)
    this.router.navigate(['/parking/dashboard']);
  }
}
