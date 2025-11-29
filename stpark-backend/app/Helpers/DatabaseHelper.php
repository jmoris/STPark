<?php

namespace App\Helpers;

use Illuminate\Support\Facades\DB;

class DatabaseHelper
{
    /**
     * Obtener la función para extraer la hora según el driver de base de datos
     */
    public static function getHourFunction(string $column): string
    {
        $driver = DB::getDriverName();
        
        switch ($driver) {
            case 'sqlite':
                return "CAST(strftime('%H', {$column}) AS INTEGER)";
            case 'pgsql':
                return "EXTRACT(HOUR FROM {$column})";
            case 'mysql':
            case 'mariadb':
                return "HOUR({$column})";
            default:
                throw new \Exception("Driver de base de datos no soportado: {$driver}");
        }
    }

    /**
     * Obtener la función para extraer el día según el driver de base de datos
     */
    public static function getDayFunction(string $column): string
    {
        $driver = DB::getDriverName();
        
        switch ($driver) {
            case 'sqlite':
                return "strftime('%Y-%m-%d', {$column})";
            case 'pgsql':
                return "DATE({$column})";
            case 'mysql':
            case 'mariadb':
                return "DATE({$column})";
            default:
                throw new \Exception("Driver de base de datos no soportado: {$driver}");
        }
    }

    /**
     * Obtener la función para extraer el mes según el driver de base de datos
     */
    public static function getMonthFunction(string $column): string
    {
        $driver = DB::getDriverName();
        
        switch ($driver) {
            case 'sqlite':
                return "strftime('%Y-%m', {$column})";
            case 'pgsql':
                return "DATE_TRUNC('month', {$column})";
            case 'mysql':
            case 'mariadb':
                return "DATE_FORMAT({$column}, '%Y-%m')";
            default:
                throw new \Exception("Driver de base de datos no soportado: {$driver}");
        }
    }

    /**
     * Obtener la función para extraer el año según el driver de base de datos
     */
    public static function getYearFunction(string $column): string
    {
        $driver = DB::getDriverName();
        
        switch ($driver) {
            case 'sqlite':
                return "strftime('%Y', {$column})";
            case 'pgsql':
                return "EXTRACT(YEAR FROM {$column})";
            case 'mysql':
            case 'mariadb':
                return "YEAR({$column})";
            default:
                throw new \Exception("Driver de base de datos no soportado: {$driver}");
        }
    }

    /**
     * Obtener la función para formatear fecha según el driver de base de datos
     */
    public static function getDateFormatFunction(string $column, string $format = '%Y-%m-%d'): string
    {
        $driver = DB::getDriverName();
        
        switch ($driver) {
            case 'sqlite':
                return "strftime('{$format}', {$column})";
            case 'pgsql':
                return "TO_CHAR({$column}, 'YYYY-MM-DD')";
            case 'mysql':
            case 'mariadb':
                return "DATE_FORMAT({$column}, '{$format}')";
            default:
                throw new \Exception("Driver de base de datos no soportado: {$driver}");
        }
    }

    /**
     * Obtener la función para comparar fechas según el driver de base de datos
     */
    public static function getDateComparisonFunction(string $column, string $date): string
    {
        $driver = DB::getDriverName();
        
        switch ($driver) {
            case 'sqlite':
                return "strftime('%Y-%m-%d', {$column}) = '{$date}'";
            case 'pgsql':
                return "DATE({$column}) = '{$date}'";
            case 'mysql':
            case 'mariadb':
                return "DATE({$column}) = '{$date}'";
            default:
                throw new \Exception("Driver de base de datos no soportado: {$driver}");
        }
    }

    /**
     * Obtener la función para obtener la fecha actual según el driver de base de datos
     */
    public static function getCurrentDateFunction(): string
    {
        $driver = DB::getDriverName();
        
        switch ($driver) {
            case 'sqlite':
                return "date('now')";
            case 'pgsql':
                return "CURRENT_DATE";
            case 'mysql':
            case 'mariadb':
                return "CURDATE()";
            default:
                throw new \Exception("Driver de base de datos no soportado: {$driver}");
        }
    }

    /**
     * Obtener la función para obtener la fecha y hora actual según el driver de base de datos
     */
    public static function getCurrentDateTimeFunction(): string
    {
        $driver = DB::getDriverName();
        
        switch ($driver) {
            case 'sqlite':
                return "datetime('now')";
            case 'pgsql':
                return "NOW()";
            case 'mysql':
            case 'mariadb':
                return "NOW()";
            default:
                throw new \Exception("Driver de base de datos no soportado: {$driver}");
        }
    }

    /**
     * Obtener la función para calcular la diferencia en segundos entre dos timestamps
     * Compatible con PostgreSQL y MySQL/MariaDB
     */
    public static function getSecondsDiffFunction(string $startColumn, string $endColumn): string
    {
        $driver = DB::getDriverName();
        
        switch ($driver) {
            case 'sqlite':
                return "CAST((julianday({$endColumn}) - julianday({$startColumn})) * 86400 AS INTEGER)";
            case 'pgsql':
                return "EXTRACT(EPOCH FROM ({$endColumn} - {$startColumn}))";
            case 'mysql':
            case 'mariadb':
                return "TIMESTAMPDIFF(SECOND, {$startColumn}, {$endColumn})";
            default:
                throw new \Exception("Driver de base de datos no soportado: {$driver}");
        }
    }

    /**
     * Obtener información del driver de base de datos actual
     */
    public static function getDriverInfo(): array
    {
        $driver = DB::getDriverName();
        
        return [
            'driver' => $driver,
            'version' => DB::select("SELECT version() as version")[0]->version ?? 'Unknown',
            'is_sqlite' => $driver === 'sqlite',
            'is_postgresql' => $driver === 'pgsql',
            'is_mysql' => in_array($driver, ['mysql', 'mariadb'])
        ];
    }

    /**
     * Ejecutar consulta raw con funciones específicas del driver
     */
    public static function raw(string $sql): string
    {
        return DB::raw($sql);
    }

    /**
     * Construir consulta para sesiones por hora
     */
    public static function buildHourlySessionsQuery(string $table = 'parking_sessions', string $dateColumn = 'started_at', string $date = null): string
    {
        $hourFunction = self::getHourFunction($dateColumn);
        $dateCondition = $date ? self::getDateComparisonFunction($dateColumn, $date) : '1=1';
        
        return "
            SELECT {$hourFunction} as hour, COUNT(*) as count 
            FROM {$table} 
            WHERE {$dateCondition}
            GROUP BY {$hourFunction}
            ORDER BY {$hourFunction} ASC
        ";
    }

    /**
     * Construir consulta para sesiones por día
     */
    public static function buildDailySessionsQuery(string $table = 'parking_sessions', string $dateColumn = 'started_at', string $dateFrom = null, string $dateTo = null): string
    {
        $dayFunction = self::getDayFunction($dateColumn);
        $conditions = [];
        
        if ($dateFrom) {
            $conditions[] = self::getDateComparisonFunction($dateColumn, $dateFrom) . " >= '{$dateFrom}'";
        }
        
        if ($dateTo) {
            $conditions[] = self::getDateComparisonFunction($dateColumn, $dateTo) . " <= '{$dateTo}'";
        }
        
        $whereClause = empty($conditions) ? '1=1' : implode(' AND ', $conditions);
        
        return "
            SELECT {$dayFunction} as day, COUNT(*) as count 
            FROM {$table} 
            WHERE {$whereClause}
            GROUP BY {$dayFunction}
            ORDER BY {$dayFunction} ASC
        ";
    }
}




