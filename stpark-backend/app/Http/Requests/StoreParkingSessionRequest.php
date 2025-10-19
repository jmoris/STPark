<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use App\Models\Operator;
use App\Models\Sector;
use App\Models\Street;
use App\Models\ParkingSession;

class StoreParkingSessionRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'plate' => [
                'required',
                'string',
                'max:10',
                'regex:/^[A-Z0-9]+$/i',
                function ($attribute, $value, $fail) {
                    // Verificar formato de patente chilena
                    if (!$this->isValidChileanPlate($value)) {
                        $fail('La patente no tiene un formato válido.');
                    }
                },
            ],
            'sector_id' => [
                'required',
                'exists:sectors,id',
                function ($attribute, $value, $fail) {
                    $sector = Sector::find($value);
                    if (!$sector) {
                        $fail('El sector no existe.');
                        return;
                    }
                    if (!$sector->is_private && !$this->hasValidOperatorAssignment()) {
                        $fail('No se puede crear sesión en sector público sin asignación válida.');
                    }
                },
            ],
            'street_id' => [
                'nullable',
                'exists:streets,id',
                function ($attribute, $value, $fail) {
                    if ($value && !$this->belongsToSector($value)) {
                        $fail('La calle no pertenece al sector seleccionado.');
                    }
                },
            ],
            'operator_id' => [
                'required',
                'exists:operators,id',
                function ($attribute, $value, $fail) {
                    $operator = Operator::find($value);
                    if (!$operator || !$operator->isActive()) {
                        $fail('El operador no está activo.');
                        return;
                    }
                    
                    if (!$this->operatorCanAccessSector($value)) {
                        $fail('El operador no tiene acceso al sector/calle seleccionado.');
                    }
                },
            ],
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'plate.required' => 'La patente es requerida.',
            'plate.regex' => 'La patente solo puede contener letras y números.',
            'sector_id.required' => 'El sector es requerido.',
            'sector_id.exists' => 'El sector seleccionado no existe.',
            'street_id.exists' => 'La calle seleccionada no existe.',
            'operator_id.required' => 'El operador es requerido.',
            'operator_id.exists' => 'El operador seleccionado no existe.',
        ];
    }

    /**
     * Verificar si la patente tiene formato válido chileno
     */
    private function isValidChileanPlate(string $plate): bool
    {
        $plate = strtoupper($plate);
        
        // Patrones de patentes chilenas
        $patterns = [
            '/^[A-Z]{2}[0-9]{4}$/', // AA1234
            '/^[0-9]{4}[A-Z]{2}$/', // 1234AA
            '/^[A-Z]{4}[0-9]{2}$/', // ABCD12
        ];
        
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $plate)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Verificar si la calle pertenece al sector
     */
    private function belongsToSector(?int $streetId): bool
    {
        if (!$streetId || !$this->input('sector_id')) {
            return true;
        }
        
        return Street::where('id', $streetId)
                    ->where('sector_id', $this->input('sector_id'))
                    ->exists();
    }

    /**
     * Verificar si el operador puede acceder al sector/calle
     */
    private function operatorCanAccessSector(int $operatorId): bool
    {
        $sectorId = $this->input('sector_id');
        $streetId = $this->input('street_id');
        
        $assignment = \App\Models\OperatorAssignment::where('operator_id', $operatorId)
            ->where('sector_id', $sectorId)
            ->where(function($query) use ($streetId) {
                if ($streetId) {
                    $query->where('street_id', $streetId)
                          ->orWhereNull('street_id');
                } else {
                    $query->whereNull('street_id');
                }
            })
            ->where('valid_from', '<=', now())
            ->where(function($query) {
                $query->whereNull('valid_to')
                      ->orWhere('valid_to', '>=', now());
            })
            ->exists();
            
        return $assignment;
    }

    /**
     * Verificar si hay asignación válida de operador
     */
    private function hasValidOperatorAssignment(): bool
    {
        $operatorId = $this->input('operator_id');
        if (!$operatorId) {
            return false;
        }
        
        return $this->operatorCanAccessSector($operatorId);
    }
}
