import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  inject,
  effect,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

/**
 * Structural directive that conditionally renders an element based on user permissions.
 *
 * Usage:
 *   <a *appHasPermission="'TABLES_READ'" routerLink="/dashboard">Mapa de Mesas</a>
 *
 * SUPER_ADMIN users bypass all permission checks automatically.
 */
@Directive({
  selector: '[appHasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly authService = inject(AuthService);
  private readonly templateRef = inject(TemplateRef<any>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly injector = inject(Injector);

  @Input() set appHasPermission(permission: string) {
    runInInjectionContext(this.injector, () => {
      effect(() => {
        const hasAccess = this.authService.hasPermission(permission);
        this.viewContainer.clear();
        if (hasAccess) {
          this.viewContainer.createEmbeddedView(this.templateRef);
        }
      });
    });
  }
}
