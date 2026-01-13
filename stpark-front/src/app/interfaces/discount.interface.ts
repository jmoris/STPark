// Interfaces para descuentos de sesiones

export interface SessionDiscount {
  id?: number;
  name: string;
  description?: string;
  discount_type: 'AMOUNT' | 'PERCENTAGE' | 'PRICING_PROFILE';
  value?: number; // Para AMOUNT y PERCENTAGE
  max_amount?: number; // Monto máximo de descuento (para PERCENTAGE)
  
  // Para PRICING_PROFILE
  minute_value?: number; // Valor del minuto distinto
  min_amount?: number; // Valor mínimo distinto
  minimum_duration?: number; // Duración mínima en minutos (para cálculo de PRICING_PROFILE)
  minimum_session_duration?: number; // Duración mínima de sesión requerida para aplicar el descuento (aplica a todos los tipos)
  
  // Horario nocturno (solo para PRICING_PROFILE)
  night_time_start?: string; // Hora de inicio del horario nocturno (formato H:i, ej: "22:00")
  night_time_end?: string; // Hora de fin del horario nocturno (formato H:i, ej: "06:00")
  night_minute_value?: number; // Valor del minuto en horario nocturno
  night_min_amount?: number; // Monto mínimo en horario nocturno (opcional)
  
  is_active: boolean;
  priority?: number; // Prioridad de aplicación
  valid_from?: string; // Fecha de inicio de validez
  valid_until?: string; // Fecha de fin de validez
  created_at?: string;
  updated_at?: string;
}

export interface SessionDiscountRequest {
  name: string;
  description?: string;
  discount_type: 'AMOUNT' | 'PERCENTAGE' | 'PRICING_PROFILE';
  value?: number;
  max_amount?: number;
  minute_value?: number;
  min_amount?: number;
  minimum_duration?: number;
  minimum_session_duration?: number;
  night_time_start?: string;
  night_time_end?: string;
  night_minute_value?: number;
  night_min_amount?: number;
  is_active?: boolean;
  priority?: number;
  valid_from?: string;
  valid_until?: string;
}

export interface SessionDiscountListResponse {
  success: boolean;
  data: SessionDiscount[];
  message?: string;
}


