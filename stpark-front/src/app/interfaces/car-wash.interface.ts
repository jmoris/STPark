import { ApiResponse } from './parking.interface';

export type CarWashStatus = 'PENDING' | 'PAID';

export interface CarWashType {
  id?: number;
  name: string;
  price: number;
  duration_minutes?: number | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CarWash {
  id?: number;
  plate: string;
  car_wash_type_id: number;
  status: CarWashStatus;
  amount: number;
  duration_minutes?: number | null;
  performed_at: string;
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;

  // Laravel puede devolver relaciones en camelCase o snake_case
  car_wash_type?: CarWashType;
  carWashType?: CarWashType;
}

export interface CarWashesApiResponse {
  success: boolean;
  data: CarWash[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
  };
}

export type CarWashTypeListResponse = ApiResponse<CarWashType[]>;


