import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pipe para convertir nombres de iconos heroicons al formato de componentes ng-icons
 * Ejemplo: 'heroicons_outline:bars-3' -> 'heroBars3'
 *          'heroicons_solid:truck' -> 'heroTruckSolid'
 */
@Pipe({
    name: 'iconName',
    standalone: true,
})
export class IconNamePipe implements PipeTransform {
    transform(value: string | null | undefined): string {
        if (!value) return '';
        
        const parts = value.split(':');
        if (parts.length !== 2) return value;
        
        const [type, iconName] = parts;
        const variant = type.replace('heroicons_', '');
        
        // Convertir kebab-case a PascalCase
        const pascalName = iconName
            .split('-')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join('');
        
        // Solo agregar sufijo para solid y mini, no para outline
        let suffix = '';
        if (variant === 'solid') suffix = 'Solid';
        else if (variant === 'mini') suffix = 'Mini';
        
        return `hero${pascalName}${suffix}`;
    }
}
