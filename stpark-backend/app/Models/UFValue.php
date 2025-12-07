<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class UFValue extends Model
{
    use HasFactory;

    /**
     * El nombre de la tabla asociada al modelo.
     *
     * @var string
     */
    protected $table = 'uf_values';

    protected $fillable = [
        'date',
        'value',
        'series_id',
    ];

    protected $casts = [
        'date' => 'date',
        'value' => 'decimal:2',
    ];

    /**
     * Obtener el valor de la UF para una fecha específica
     * Si no existe para esa fecha, retorna el más reciente disponible
     */
    public static function getValueForDate(?string $date = null): ?self
    {
        $targetDate = $date ? Carbon::parse($date) : Carbon::now('America/Santiago');

        // Primero intentar obtener el valor exacto para la fecha
        $ufValue = self::where('date', $targetDate->format('Y-m-d'))->first();

        // Si no existe, obtener el más reciente disponible
        if (!$ufValue) {
            $ufValue = self::where('date', '<=', $targetDate->format('Y-m-d'))
                ->orderBy('date', 'desc')
                ->first();
        }

        return $ufValue;
    }

    /**
     * Obtener el valor más reciente disponible
     */
    public static function getLatestValue(): ?self
    {
        return self::orderBy('date', 'desc')->first();
    }

    /**
     * Verificar si existe un valor para una fecha específica
     */
    public static function existsForDate(string $date): bool
    {
        return self::where('date', $date)->exists();
    }
}
