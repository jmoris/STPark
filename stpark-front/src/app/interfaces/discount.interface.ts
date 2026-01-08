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


