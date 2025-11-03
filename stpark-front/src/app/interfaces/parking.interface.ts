// Interfaces para el sistema de estacionamiento

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

export interface SessionsApiResponse {
  success: boolean;
  data: ParkingSession[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
  };
}

// Interfaces principales
export interface Sector {
  id?: number;
  name: string;
  is_private: boolean;
  description?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  streets?: Street[];
  operators?: Operator[];
}

export interface Street {
  id?: number;
  sector_id: number;
  name: string;
  address_number?: string;
  address_type?: 'STREET' | 'ADDRESS';
  block_range?: string;
  is_specific_address?: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  sector?: Sector;
  parking_sessions?: ParkingSession[];
  operator_assignments?: OperatorAssignment[];
}

export interface Operator {
  id?: number;
  name: string;
  rut?: string;
  email?: string;
  phone?: string;
  pin?: string;
  status: 'ACTIVE' | 'INACTIVE';
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  operator_assignments?: OperatorAssignment[];
}

export interface OperatorAssignment {
  id?: number;
  operator_id: number;
  sector_id: number;
  street_id?: number;
  valid_from: string;
  valid_to?: string;
  created_at?: string;
  updated_at?: string;
  operator?: Operator;
  sector?: Sector;
  street?: Street;
}

export interface ParkingSession {
  id?: number;
  plate: string;
  sector_id: number;
  street_id?: number;
  operator_in_id: number;
  started_at: string;
  ended_at?: string;
  seconds_total?: number;
  gross_amount?: number;
  discount_amount?: number;
  net_amount?: number;
  status: 'CREATED' | 'ACTIVE' | 'TO_PAY' | 'PAID' | 'CLOSED' | 'CANCELED';
  created_at?: string;
  updated_at?: string;
  sector?: Sector;
  street?: Street;
  operator?: Operator;
  // Campos calculados del backend
  duration_minutes?: number;
  duration_formatted?: string;
  total_paid?: number;
  total_paid_formatted?: string;
}

export interface PricingProfile {
  id?: number;
  sector_id: number;
  name: string;
  description?: string;
  is_active: boolean;
  active_from: string;
  active_to?: string;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  sector?: Sector;
  pricing_rules?: PricingRule[];
}

export interface PricingRule {
  id?: number;
  profile_id: number;
  name: string;
  rule_type: 'TIME_BASED' | 'FIXED' | 'GRADUATED' | 'HOURLY';
  min_duration_minutes: number;
  max_duration_minutes?: number;
  daily_max_amount?: number; // Monto máximo diario
  min_amount?: number; // Monto mínimo
  min_amount_is_base?: boolean; // Si el monto mínimo es base después del tiempo mínimo
  price_per_minute?: number; // Campo del frontend
  price_per_min?: number; // Campo del backend
  fixed_price?: number;
  days_of_week?: number[];
  start_time?: string;
  end_time?: string;
  start_min?: number; // Minutos desde medianoche para inicio
  end_min?: number; // Minutos desde medianoche para fin
  priority?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DiscountRule {
  id?: number;
  profile_id: number;
  kind: 'PERCENTAGE' | 'FIXED';
  value: number;
  min_duration_minutes?: number;
  max_duration_minutes?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Sale {
  id?: number;
  session_id: number;
  operator_id: number;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  status: 'PENDING' | 'PAID' | 'PARTIAL' | 'CANCELED';
  created_at?: string;
  updated_at?: string;
  session?: ParkingSession;
  operator?: Operator;
  payments?: Payment[];
}

export interface Payment {
  id?: number;
  sale_id?: number;
  session_id?: number;
  method: 'CASH' | 'CARD' | 'WEBPAY' | 'TRANSFER';
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  transaction_id?: string;
  processed_at?: string;
  created_at?: string;
  updated_at?: string;
  sale?: Sale;
  parking_session?: ParkingSession;
}

export interface Debt {
  id?: number;
  plate: string;
  session_id?: number;
  origin: 'SESSION' | 'FINE' | 'MANUAL';
  principal_amount: number;
  status: 'PENDING' | 'SETTLED' | 'CANCELLED';
  settled_at?: string;
  created_at?: string;
  updated_at?: string;
  parking_session?: ParkingSession;
  payments?: Payment[];
}

// Interfaces para filtros
export interface SessionFilters {
  plate?: string;
  sector_id?: number;
  operator_id?: number;
  status?: string;
  date_from?: string;
  date_to?: string;
}

export interface OperatorFilters {
  name?: string;
  status?: string;
  sector?: number;
  [key: string]: string | number | undefined;
}

export interface SectorFilters {
  name?: string;
  is_private?: boolean;
}

export interface PaymentFilters {
  method?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  operator_id?: number;
  session_id?: number;
  sale_id?: number;
}

export interface DebtFilters {
  plate?: string;
  status?: string;
  origin?: string;
  date_from?: string;
  date_to?: string;
}

export interface PricingProfileFilters {
  sector_id?: number;
  name?: string;
  is_active?: boolean;
}

// Interfaces para requests
export interface CreateSessionRequest {
  plate: string;
  sector_id: number;
  street_id: number;
  operator_id: number;
}

export interface QuoteRequest {
  ended_at: string;
  discount_code?: string;
}

export interface CheckoutRequest {
  payment_method: 'CASH' | 'CARD' | 'WEBPAY' | 'TRANSFER';
  amount: number;
  discount_code?: string;
  notes?: string;
}

export interface PaymentRequest {
  sale_id?: number;
  session_id?: number;
  method: 'CASH' | 'CARD' | 'WEBPAY' | 'TRANSFER';
  amount: number;
}

export interface OperatorAssignmentData {
  operator: Operator;
  isEdit: boolean;
  assignment?: any;
}

// Interfaces para respuestas
export interface QuoteResponse {
  session_id: number;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  pricing_profile: string;
}

export interface DashboardStats {
  active_sessions: number;
  today_revenue: number;
  pending_debts: number;
  total_amount: number;
}

export interface DashboardData {
  active_sessions: {
    count: number;
    sessions: ParkingSession[];
  };
  sessions_by_hour: {
    hour: number;
    count: number;
  }[];
  today_sales: {
    count: number;
    total_amount: number;
    by_sector: any;
  };
  pending_debts: {
    total_amount: number;
  };
  today_payments: {
    total_amount: number;
    by_method: any;
  };
}

export interface DebtRequest {
  plate: string;
  session_id?: number;
  origin: 'SESSION' | 'MANUAL' | 'IMPORT';
  principal_amount: number;
  interest_amount: number;
  due_date?: string;
}

export interface SettleDebtRequest {
  amount: number;
  payment_method: string;
  notes?: string;
}

export interface WebpayWebhookRequest {
  token_ws: string;
  TBK_TOKEN: string;
}

// ============ INTERFACES DE TURNOS ============

export interface Shift {
  id: string;
  operator_id: number;
  sector_id?: number;
  device_id?: string;
  opened_at: string;
  closed_at?: string;
  opening_float: number;
  closing_declared_cash?: number;
  cash_over_short?: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELED';
  notes?: string;
  created_by?: number;
  closed_by?: number;
  created_at?: string;
  updated_at?: string;
  operator?: Operator;
  sector?: Sector;
  creator?: any;
  closer?: any;
  totals?: ShiftTotals;
}

export interface ShiftTotals {
  opening_float: number;
  cash_collected: number;
  cash_withdrawals: number;
  cash_deposits: number;
  cash_expected: number;
  cash_declared?: number;
  cash_over_short?: number;
  tickets_count: number;
  sales_total: number;
  payments_by_method: PaymentByMethod[];
}

export interface PaymentByMethod {
  method: string;
  collected: number;
  count: number;
}

export interface ShiftOperation {
  id: number;
  shift_id: string;
  kind: 'OPEN' | 'CLOSE' | 'ADJUSTMENT' | 'WITHDRAWAL' | 'DEPOSIT';
  amount?: number;
  at: string;
  ref_id?: number;
  ref_type?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CashAdjustment {
  id: number;
  shift_id: string;
  type: 'WITHDRAWAL' | 'DEPOSIT';
  amount: number;
  at: string;
  reason?: string;
  receipt_number?: string;
  actor_id?: number;
  approved_by?: number;
  created_at?: string;
  updated_at?: string;
  actor?: Operator;
  approver?: any;
}

export interface ShiftFilters {
  from?: string;
  to?: string;
  operator_id?: number;
  sector_id?: number;
  status?: 'OPEN' | 'CLOSED' | 'CANCELED';
  per_page?: number;
}

export interface OpenShiftRequest {
  operator_id: number;
  opening_float: number;
  sector_id?: number;
  device_id?: string;
  notes?: string;
}

export interface CloseShiftRequest {
  closing_declared_cash: number;
  notes?: string;
}

export interface CashAdjustmentRequest {
  type: 'WITHDRAWAL' | 'DEPOSIT';
  amount: number;
  reason?: string;
  receipt_number?: string;
}

export interface ShiftReport {
  shift: Shift;
  cash_summary: {
    opening_float: number;
    cash_collected: number;
    cash_withdrawals: number;
    cash_deposits: number;
    cash_expected: number;
    cash_declared?: number;
    cash_over_short?: number;
  };
  sales_summary: {
    tickets_count: number;
    subtotal: number;
    discount_total: number;
    total: number;
  };
  payments_by_method: any[];
  recent_payments: any[];
  cash_adjustments: CashAdjustment[];
  created_by?: any;
  closed_by?: any;
  generated_at: string;
}