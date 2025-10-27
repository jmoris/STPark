import { NgModule } from '@angular/core';
import { NgIconsModule, withIcons } from '@ng-icons/core';

@NgModule({
    imports: [
        NgIconsModule.withIcons({
            // Icons loaded here
            // Note: With Angular 19, icon registration should be done via provideIcons in app.config.ts
        })
    ],
    exports: [NgIconsModule],
})
export class IconsModule {}

