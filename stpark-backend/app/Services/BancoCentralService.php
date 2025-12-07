<?php

namespace App\Services;

use SoapClient;
use SoapFault;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use App\Models\UFValue;

class BancoCentralService
{
    protected $wsdlUrl;
    protected $user;
    protected $password;
    protected $ufSeriesId;
    protected $soapClient;

    public function __construct()
    {
        $config = config('services.banco_central');
        $this->wsdlUrl = $config['wsdl_url'];
        $this->user = $config['user'];
        $this->password = $config['password'];
        $this->ufSeriesId = $config['uf_series_id'] ?? 'F073.TCO.PRE.Z.D';
    }

    /**
     * Obtener el cliente SOAP
     */
    protected function getSoapClient(): SoapClient
    {
        if (!$this->soapClient) {
            try {
                $this->soapClient = new SoapClient($this->wsdlUrl, [
                    'trace' => true,
                    'exceptions' => true,
                    'cache_wsdl' => WSDL_CACHE_NONE,
                    'stream_context' => stream_context_create([
                        'http' => [
                            'timeout' => 30,
                            'user_agent' => 'Laravel-SOAP-Client',
                        ],
                        'ssl' => [
                            'verify_peer' => true,
                            'verify_peer_name' => true,
                        ],
                    ]),
                ]);
            } catch (SoapFault $e) {
                Log::error('Error al crear cliente SOAP del Banco Central', [
                    'error' => $e->getMessage(),
                    'wsdl_url' => $this->wsdlUrl,
                ]);
                throw new \Exception('No se pudo conectar al servicio del Banco Central: ' . $e->getMessage());
            }
        }

        return $this->soapClient;
    }

    /**
     * Buscar series disponibles
     */
    public function searchSeries(?string $frequencyCode = null): array
    {
        try {
            $client = $this->getSoapClient();

            $params = [
                'user' => $this->user,
                'password' => $this->password,
            ];

            if ($frequencyCode) {
                $params['frequencyCode'] = $frequencyCode;
            }

            $result = $client->SearchSeries($params);

            if (isset($result->SearchSeriesResult)) {
                $response = $result->SearchSeriesResult;

                return [
                    'success' => $response->Codigo == 0,
                    'code' => $response->Codigo,
                    'description' => $response->Descripcion ?? '',
                    'series' => $this->parseSeries($response->Series ?? null),
                    'series_infos' => $this->parseSeriesInfos($response->SeriesInfos ?? null),
                ];
            }

            return [
                'success' => false,
                'code' => -1,
                'description' => 'Respuesta inválida del servicio',
                'series' => [],
                'series_infos' => [],
            ];
        } catch (SoapFault $e) {
            Log::error('Error al buscar series en Banco Central', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'code' => -1,
                'description' => 'Error al consultar el servicio: ' . $e->getMessage(),
                'series' => [],
                'series_infos' => [],
            ];
        }
    }

    /**
     * Obtener datos de una serie específica
     */
    public function getSeries(array $seriesIds, ?string $firstDate = null, ?string $lastDate = null): array
    {
        try {
            $client = $this->getSoapClient();

            // Si no se proporcionan fechas, usar el día actual
            if (!$firstDate) {
                $firstDate = Carbon::now('America/Santiago')->subDays(30)->format('Y-m-d');
            }
            if (!$lastDate) {
                $lastDate = Carbon::now('America/Santiago')->format('Y-m-d');
            }

            $params = [
                'user' => $this->user,
                'password' => $this->password,
                'firstDate' => $firstDate,
                'lastDate' => $lastDate,
                'seriesIds' => [
                    'string' => $seriesIds,
                ],
            ];

            $result = $client->GetSeries($params);

            if (isset($result->GetSeriesResult)) {
                $response = $result->GetSeriesResult;

                return [
                    'success' => $response->Codigo == 0,
                    'code' => $response->Codigo,
                    'description' => $response->Descripcion ?? '',
                    'series' => $this->parseSeries($response->Series ?? null),
                    'series_infos' => $this->parseSeriesInfos($response->SeriesInfos ?? null),
                ];
            }

            return [
                'success' => false,
                'code' => -1,
                'description' => 'Respuesta inválida del servicio',
                'series' => [],
                'series_infos' => [],
            ];
        } catch (SoapFault $e) {
            Log::error('Error al obtener series del Banco Central', [
                'error' => $e->getMessage(),
                'series_ids' => $seriesIds,
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'code' => -1,
                'description' => 'Error al consultar el servicio: ' . $e->getMessage(),
                'series' => [],
                'series_infos' => [],
            ];
        }
    }

    /**
     * Obtener el valor de la UF desde la base de datos
     * Primero consulta la BD, si no existe retorna null
     */
    public function getUFValue(?string $date = null): array
    {
        $ufValue = UFValue::getValueForDate($date);

        if (!$ufValue) {
            return [
                'success' => false,
                'message' => 'No se encontró el valor de la UF en la base de datos. Ejecuta el comando de actualización diaria.',
                'value' => null,
                'date' => $date,
            ];
        }

        return [
            'success' => true,
            'value' => (float) $ufValue->value,
            'date' => $ufValue->date->format('Y-m-d'),
            'series_id' => $ufValue->series_id ?? $this->ufSeriesId,
        ];
    }

    /**
     * Actualizar el valor de la UF desde el webservice del Banco Central
     * Obtiene los valores de los últimos días y los almacena en la BD
     */
    public function updateUFValues(int $daysBack = 7): array
    {
        try {
            $today = Carbon::now('America/Santiago');
            $firstDate = $today->copy()->subDays($daysBack)->format('Y-m-d');
            $lastDate = $today->format('Y-m-d');

            $result = $this->getSeries([$this->ufSeriesId], $firstDate, $lastDate);

            if (!$result['success']) {
                return [
                    'success' => false,
                    'message' => $result['description'],
                    'updated_count' => 0,
                ];
            }

            $updatedCount = 0;
            $errors = [];

            if (!empty($result['series'])) {
                foreach ($result['series'] as $series) {
                    if (isset($series['observations']) && !empty($series['observations'])) {
                        foreach ($series['observations'] as $obs) {
                            if (!isset($obs['date']) || !isset($obs['value'])) {
                                continue;
                            }

                            // Validar que el valor no sea null y sea numérico
                            $rawValue = $obs['value'];
                            if ($rawValue === null || $rawValue === '') {
                                $errors[] = "Valor nulo o vacío para fecha {$obs['date']}";
                                Log::warning('Valor de UF nulo o vacío', [
                                    'date' => $obs['date'] ?? null,
                                    'value' => $rawValue,
                                ]);
                                continue;
                            }

                            // Convertir el valor a string para procesarlo
                            $valueString = (string) $rawValue;
                            
                            // Limpiar el string: formato chileno "39.643,59" -> "39643.59"
                            // 1. Remover espacios
                            $cleaned = trim($valueString);
                            
                            // 2. Detectar si tiene coma (formato chileno) o punto decimal (formato internacional)
                            $hasComma = strpos($cleaned, ',') !== false;
                            $hasPoint = strpos($cleaned, '.') !== false;
                            
                            if ($hasComma && $hasPoint) {
                                // Formato chileno: "39.643,59" (punto=miles, coma=decimal)
                                // Remover puntos primero (separadores de miles)
                                $cleaned = str_replace('.', '', $cleaned);
                                // Luego convertir coma a punto (separador decimal)
                                $cleaned = str_replace(',', '.', $cleaned);
                            } elseif ($hasComma && !$hasPoint) {
                                // Solo tiene coma: "39643,59" -> "39643.59"
                                $cleaned = str_replace(',', '.', $cleaned);
                            } elseif ($hasPoint && !$hasComma) {
                                // Solo tiene punto: podría ser decimal o miles
                                // Si tiene más de un punto, son separadores de miles
                                $pointCount = substr_count($cleaned, '.');
                                if ($pointCount > 1) {
                                    // Múltiples puntos = separadores de miles, remover todos
                                    $cleaned = str_replace('.', '', $cleaned);
                                }
                                // Si tiene un solo punto, asumir que es decimal (ya está bien)
                            }
                            
                            // Remover cualquier espacio restante
                            $cleaned = str_replace(' ', '', $cleaned);

                            // Validar que sea numérico después de la limpieza
                            if (!is_numeric($cleaned)) {
                                $errors[] = "Valor no numérico para fecha {$obs['date']}: {$rawValue} (limpio: {$cleaned})";
                                Log::warning('Valor de UF no numérico', [
                                    'date' => $obs['date'] ?? null,
                                    'raw_value' => $rawValue,
                                    'raw_type' => gettype($rawValue),
                                    'cleaned' => $cleaned,
                                ]);
                                continue;
                            }

                            $value = (float) $cleaned;
                            
                            // Log para debugging (solo en desarrollo)
                            if (config('app.debug')) {
                                Log::debug('Conversión de valor UF', [
                                    'date' => $obs['date'] ?? null,
                                    'raw_value' => $rawValue,
                                    'cleaned' => $cleaned,
                                    'final_value' => $value,
                                ]);
                            }

                            if ($value <= 0) {
                                $errors[] = "Valor inválido (<= 0) para fecha {$obs['date']}: {$rawValue}";
                                Log::warning('Valor de UF inválido (<= 0)', [
                                    'date' => $obs['date'] ?? null,
                                    'raw_value' => $rawValue,
                                    'value' => $value,
                                ]);
                                continue;
                            }

                            try {
                                $date = Carbon::parse($obs['date'], 'America/Santiago')->format('Y-m-d');

                                // Redondear a 2 decimales para asegurar precisión
                                $valueToSave = round($value, 2);

                                // Validar que el valor sea finito (no NaN ni infinito)
                                if (!is_finite($valueToSave)) {
                                    throw new \Exception("Valor no finito: {$valueToSave}");
                                }

                                // Actualizar o crear el registro usando DB directamente para evitar problemas con el cast
                                DB::table('uf_values')->updateOrInsert(
                                    ['date' => $date],
                                    [
                                        'value' => $valueToSave,
                                        'series_id' => $this->ufSeriesId,
                                        'updated_at' => now(),
                                        'created_at' => DB::raw('COALESCE(created_at, NOW())'),
                                    ]
                                );

                                $updatedCount++;
                            } catch (\Exception $e) {
                                $errors[] = "Error procesando fecha {$obs['date']}: " . $e->getMessage();
                                Log::warning('Error al guardar valor de UF', [
                                    'date' => $obs['date'] ?? null,
                                    'raw_value' => $rawValue,
                                    'cleaned' => $cleaned ?? null,
                                    'value' => $value,
                                    'value_to_save' => $valueToSave ?? null,
                                    'error' => $e->getMessage(),
                                    'trace' => $e->getTraceAsString(),
                                ]);
                            }
                        }
                    }
                }
            }

            if ($updatedCount === 0 && empty($result['series'])) {
                return [
                    'success' => false,
                    'message' => 'No se encontraron valores de UF en la respuesta del servicio',
                    'updated_count' => 0,
                ];
            }

            // Completar sábados y domingos con el valor del viernes anterior
            $filledCount = $this->fillWeekendValues($firstDate, $lastDate);
            $updatedCount += $filledCount;

            return [
                'success' => true,
                'message' => "Se actualizaron {$updatedCount} valores de UF" . ($filledCount > 0 ? " (incluyendo {$filledCount} fines de semana completados)" : ""),
                'updated_count' => $updatedCount,
                'filled_weekend_count' => $filledCount,
                'errors' => $errors,
            ];
        } catch (\Exception $e) {
            Log::error('Error al actualizar valores de UF', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'message' => 'Error al actualizar valores de UF: ' . $e->getMessage(),
                'updated_count' => 0,
            ];
        }
    }

    /**
     * Completar valores de sábados y domingos con el valor del viernes anterior
     */
    protected function fillWeekendValues(string $firstDate, string $lastDate): int
    {
        $filledCount = 0;
        $startDate = Carbon::parse($firstDate, 'America/Santiago');
        $endDate = Carbon::parse($lastDate, 'America/Santiago');
        $currentDate = $startDate->copy();

        while ($currentDate->lte($endDate)) {
            $dayOfWeek = $currentDate->dayOfWeek; // 0 = domingo, 6 = sábado
            $dateString = $currentDate->format('Y-m-d');

            // Solo procesar sábados (6) y domingos (0)
            if ($dayOfWeek === 0 || $dayOfWeek === 6) {
                // Verificar si ya existe un valor para este día
                $existingValue = UFValue::where('date', $dateString)->first();

                if (!$existingValue) {
                    // Buscar el viernes anterior más cercano con valor
                    $fridayValue = $this->findPreviousFridayValue($currentDate);

                    if ($fridayValue) {
                        try {
                            UFValue::updateOrCreate(
                                ['date' => $dateString],
                                [
                                    'value' => $fridayValue->value,
                                    'series_id' => $fridayValue->series_id ?? $this->ufSeriesId,
                                ]
                            );

                            $filledCount++;
                            Log::info('Valor de UF completado para fin de semana', [
                                'date' => $dateString,
                                'day' => $dayOfWeek === 0 ? 'domingo' : 'sábado',
                                'value' => $fridayValue->value,
                                'source_date' => $fridayValue->date->format('Y-m-d'),
                            ]);
                        } catch (\Exception $e) {
                            Log::warning('Error al completar valor de UF para fin de semana', [
                                'date' => $dateString,
                                'error' => $e->getMessage(),
                            ]);
                        }
                    }
                }
            }

            $currentDate->addDay();
        }

        return $filledCount;
    }

    /**
     * Buscar el valor del viernes anterior más cercano
     */
    protected function findPreviousFridayValue(Carbon $date): ?UFValue
    {
        $searchDate = $date->copy();

        // Buscar hacia atrás hasta encontrar un viernes con valor
        // Máximo 7 días hacia atrás (para cubrir casos de feriados)
        for ($i = 0; $i < 7; $i++) {
            $searchDate->subDay();

            // Si es viernes (5)
            if ($searchDate->dayOfWeek === 5) {
                $fridayValue = UFValue::where('date', $searchDate->format('Y-m-d'))->first();
                if ($fridayValue) {
                    return $fridayValue;
                }
            }
        }

        // Si no se encuentra un viernes, buscar cualquier día hábil anterior con valor
        $searchDate = $date->copy();
        for ($i = 0; $i < 7; $i++) {
            $searchDate->subDay();
            $dayOfWeek = $searchDate->dayOfWeek;

            // Ignorar sábados y domingos en la búsqueda
            if ($dayOfWeek !== 0 && $dayOfWeek !== 6) {
                $value = UFValue::where('date', $searchDate->format('Y-m-d'))->first();
                if ($value) {
                    return $value;
                }
            }
        }

        return null;
    }

    /**
     * Parsear las series de la respuesta
     */
    protected function parseSeries($series): array
    {
        if (!$series || !isset($series->fameSeries)) {
            return [];
        }

        $parsed = [];
        $seriesArray = is_array($series->fameSeries) ? $series->fameSeries : [$series->fameSeries];

        foreach ($seriesArray as $serie) {
            if (!$serie) {
                continue;
            }

            $observations = [];
            if (isset($serie->obs) && is_array($serie->obs)) {
                foreach ($serie->obs as $obs) {
                    if ($obs && isset($obs->value)) {
                        $observations[] = [
                            'date' => $obs->indexDateString ?? null,
                            'value' => $obs->value ?? null,
                            'status_code' => $obs->statusCode ?? null,
                        ];
                    }
                }
            } elseif (isset($serie->obs) && is_object($serie->obs)) {
                $observations[] = [
                    'date' => $serie->obs->indexDateString ?? null,
                    'value' => $serie->obs->value ?? null,
                    'status_code' => $serie->obs->statusCode ?? null,
                ];
            }

            $parsed[] = [
                'series_id' => $serie->seriesKey->seriesId ?? null,
                'description' => $serie->seriesKey->Description ?? null,
                'description_es' => $serie->seriesKey->descripEsp ?? null,
                'description_en' => $serie->seriesKey->descripIng ?? null,
                'precision' => $serie->precision ?? null,
                'observations' => $observations,
            ];
        }

        return $parsed;
    }

    /**
     * Parsear la información de las series
     */
    protected function parseSeriesInfos($seriesInfos): array
    {
        if (!$seriesInfos || !isset($seriesInfos->internetSeriesInfo)) {
            return [];
        }

        $parsed = [];
        $infosArray = is_array($seriesInfos->internetSeriesInfo) 
            ? $seriesInfos->internetSeriesInfo 
            : [$seriesInfos->internetSeriesInfo];

        foreach ($infosArray as $info) {
            if (!$info) {
                continue;
            }

            $parsed[] = [
                'series_id' => $info->seriesId ?? null,
                'frequency' => $info->frequency ?? null,
                'frequency_code' => $info->frequencyCode ?? null,
                'observed' => $info->observed ?? null,
                'observed_code' => $info->observedCode ?? null,
                'spanish_title' => $info->spanishTitle ?? null,
                'english_title' => $info->englishTitle ?? null,
                'first_observation' => $info->firstObservation ?? null,
                'last_observation' => $info->lastObservation ?? null,
                'updated_at' => $info->updatedAt ?? null,
                'created_at' => $info->createdAt ?? null,
            ];
        }

        return $parsed;
    }
}
