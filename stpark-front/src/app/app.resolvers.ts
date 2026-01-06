import { inject } from '@angular/core';
import { NavigationService } from 'app/core/navigation/navigation.service';
import { MessagesService } from 'app/layout/common/messages/messages.service';
import { NotificationsService } from 'app/layout/common/notifications/notifications.service';
import { QuickChatService } from 'app/layout/common/quick-chat/quick-chat.service';
import { ShortcutsService } from 'app/layout/common/shortcuts/shortcuts.service';
import { ConfigService } from 'app/core/services/config.service';
import { AuthService } from 'app/core/services/auth.service';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap, map, delay, tap } from 'rxjs/operators';

export const initialDataResolver = () => {
    const messagesService = inject(MessagesService);
    const navigationService = inject(NavigationService);
    const notificationsService = inject(NotificationsService);
    const quickChatService = inject(QuickChatService);
    const shortcutsService = inject(ShortcutsService);
    const configService = inject(ConfigService);
    const authService = inject(AuthService);

    // Fork join multiple API endpoint calls to wait all of them to finish
    // Catch errors to prevent infinite loading
    const handleError = (error: any) => {
        console.error('Error loading initial data:', error);
        return of(null);
    };

    // Cargar configuración del tenant si hay uno seleccionado
    const currentTenant = authService.getCurrentTenant();
    const isCentralAdminMode = authService.isCentralAdminMode();
    
    // Si hay tenant y no estamos en modo Admin Central, cargar configuración primero
    // Usar forkJoin para cargar configuración y navegación en paralelo, pero config primero
    if (currentTenant && !isCentralAdminMode) {
        // Cargar configuración primero y esperar a que termine antes de cargar navegación
        return configService.loadConfig().pipe(
            catchError(handleError),
            switchMap(() => {
                // Después de que la configuración se cargó (y se guardó en sessionStorage),
                // cargar la navegación y otros datos
                return forkJoin([
                    navigationService.get().pipe(catchError(handleError)),
                    messagesService.getAll().pipe(catchError(handleError)),
                    notificationsService.getAll().pipe(catchError(handleError)),
                    quickChatService.getChats().pipe(catchError(handleError)),
                    shortcutsService.getAll().pipe(catchError(handleError)),
                ]);
            })
        );
    }

    // Si no hay tenant o es modo Admin Central, cargar directamente sin configuración
    return forkJoin([
        navigationService.get().pipe(catchError(handleError)),
        messagesService.getAll().pipe(catchError(handleError)),
        notificationsService.getAll().pipe(catchError(handleError)),
        quickChatService.getChats().pipe(catchError(handleError)),
        shortcutsService.getAll().pipe(catchError(handleError)),
    ]);
};
