<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class FacturAPIConfig extends Model
{
    protected $table = 'facturapi_config';
    
    protected $fillable = [
        'environment',
        'dev_token',
        'prod_token'
    ];

    /**
     * Obtener el token de desarrollo desencriptado
     */
    public function getDevTokenAttribute($value): string
    {
        if (empty($value)) {
            return '';
        }
        
        try {
            return Crypt::decryptString($value);
        } catch (\Exception $e) {
            // Si falla la desencriptación, retornar vacío
            return '';
        }
    }

    /**
     * Encriptar el token de desarrollo antes de guardar
     */
    public function setDevTokenAttribute($value): void
    {
        if (empty($value)) {
            $this->attributes['dev_token'] = '';
            return;
        }
        
        // Siempre encriptar el valor antes de guardar
        $this->attributes['dev_token'] = Crypt::encryptString($value);
    }

    /**
     * Obtener el token de producción desencriptado
     */
    public function getProdTokenAttribute($value): string
    {
        if (empty($value)) {
            return '';
        }
        
        try {
            return Crypt::decryptString($value);
        } catch (\Exception $e) {
            // Si falla la desencriptación, retornar vacío
            return '';
        }
    }

    /**
     * Encriptar el token de producción antes de guardar
     */
    public function setProdTokenAttribute($value): void
    {
        if (empty($value)) {
            $this->attributes['prod_token'] = '';
            return;
        }
        
        // Siempre encriptar el valor antes de guardar
        $this->attributes['prod_token'] = Crypt::encryptString($value);
    }

    /**
     * Obtener o crear la configuración (singleton)
     */
    public static function getConfig(): self
    {
        return self::firstOrCreate(
            ['id' => 1],
            [
                'environment' => 'dev',
                'dev_token' => '',
                'prod_token' => ''
            ]
        );
    }
}

