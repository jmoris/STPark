/**
 * Utilidades para manejo de fechas con timezone America/Santiago
 */

/**
 * Obtiene la fecha actual en timezone America/Santiago y la convierte a ISO string
 * Esta función asegura que las fechas se envíen con el timezone correcto
 */
export function getCurrentDateInSantiago(): string {
  const now = new Date();
  
  // Usar Intl para obtener la fecha/hora actual en timezone America/Santiago
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  const hour = parts.find(p => p.type === 'hour')?.value;
  const minute = parts.find(p => p.type === 'minute')?.value;
  const second = parts.find(p => p.type === 'second')?.value;
  
  // Obtener también la hora UTC para calcular el offset
  const utcFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const utcParts = utcFormatter.formatToParts(now);
  const utcYear = utcParts.find(p => p.type === 'year')?.value;
  const utcMonth = utcParts.find(p => p.type === 'month')?.value;
  const utcDay = utcParts.find(p => p.type === 'day')?.value;
  const utcHour = utcParts.find(p => p.type === 'hour')?.value;
  const utcMinute = utcParts.find(p => p.type === 'minute')?.value;
  const utcSecond = utcParts.find(p => p.type === 'second')?.value;
  
  // Crear objetos Date interpretando ambas como horas locales para comparar
  const santiagoAsLocal = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
  const utcAsLocal = new Date(`${utcYear}-${utcMonth}-${utcDay}T${utcHour}:${utcMinute}:${utcSecond}`);
  
  // Calcular el offset en milisegundos (diferencia entre cómo se interpretan las fechas)
  const offsetMs = utcAsLocal.getTime() - santiagoAsLocal.getTime();
  
  // Ajustar la fecha actual (que está en UTC) restando el offset para obtener
  // la representación ISO correcta de la hora en Santiago
  const santiagoISO = new Date(now.getTime() - offsetMs);
  
  return santiagoISO.toISOString();
}

/**
 * Obtiene el offset UTC de un timezone en minutos
 * Esto es una aproximación - para producción debería usar una librería como date-fns-tz
 */
function getTimezoneOffset(timezone: string): number {
  // Offset de America/Santiago: UTC-3 en verano (CLT), UTC-4 en invierno (CLST)
  // Esta es una aproximación simple. Para precisión total, usar date-fns-tz
  
  const now = new Date();
  const jan = new Date(now.getFullYear(), 0, 1);
  const jul = new Date(now.getFullYear(), 6, 1);
  
  // Verificar si estamos en horario de verano (aproximadamente Oct-Mar en Chile)
  const month = now.getMonth();
  const isDST = month >= 9 || month <= 2; // Octubre a Marzo es horario de verano
  
  // America/Santiago:
  // Horario de verano (CLT): UTC-3 = -180 minutos
  // Horario de invierno (CLST): UTC-4 = -240 minutos
  
  // Nota: Chile cambia a horario de verano típicamente en septiembre/octubre
  // y vuelve a horario de invierno en marzo/abril
  // Esta es una aproximación - para precisión total usar date-fns-tz
  
  if (timezone === 'America/Santiago') {
    // Aproximación: asumir UTC-3 (puede necesitar ajuste según fecha exacta)
    return -180; // UTC-3 = -180 minutos
  }
  
  return 0;
}

/**
 * Formatea una fecha a ISO string considerando el timezone de Santiago
 */
export function formatDateToSantiagoISO(date: Date): string {
  // Para fechas específicas, convertir al timezone de Santiago
  const santiagoDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  const offset = getTimezoneOffset('America/Santiago');
  const localOffset = -date.getTimezoneOffset();
  const diffMinutes = offset - localOffset;
  const adjustedDate = new Date(date.getTime() + diffMinutes * 60000);
  
  return adjustedDate.toISOString();
}

