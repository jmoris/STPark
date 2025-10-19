// src/app/interfaces/user.interface.ts
export interface User {
    id?: string;
    name: string;
    lastname: string;
    email: string;
    status: boolean; // true = Activo, false = Inactivo
    role?: string;
    last_connection?: string;
    created_at?: string;
    updated_at?: string;
}