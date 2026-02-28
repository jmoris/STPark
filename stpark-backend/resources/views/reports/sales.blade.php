<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reporte de Ventas</title>
    @include('reports._styles')
    <style>
        .page-break { page-break-before: always; }
        .chart-container { page-break-inside: avoid; }
    </style>
</head>
<body>
    @php
        $generatedAt = now()->format('d/m/Y H:i');
        $sessionsCount = count($data['sessions_detail'] ?? []);
        $sessionsLimitUsed = $data['meta']['sessions_limit_used'] ?? null;
        $tenantName = null;
        try {
            $t = tenant();
            if (is_object($t)) {
                $tenantName = $t->name ?? $t->id ?? null;
            } else {
                $tenantName = tenant('name') ?? tenant('id') ?? null;
            }
        } catch (\Throwable $e) {
            $tenantName = null;
        }
        $carWashEnabled = (bool)($data['meta']['car_wash_enabled'] ?? true);
        $includeWashes = (bool)($data['meta']['include_washes'] ?? true);
        $washTotal = (float)($data['car_wash']['total_amount'] ?? 0);
    @endphp

    <div class="header">
        <div class="header-left">
            <img src="{{ public_path('images/logo/stpark-blue.png') }}" alt="STPark Logo">
        </div>
        <div class="header-right">
            <h1 style="font-size:16pt;">Reporte de Ventas</h1>
            <p class="header-subtitle">STPark — Gestión de Estacionamiento</p>
            <p style="font-size:9pt; color:#666; margin: 2pt 0 0 0;">
                Modo: {{ ($data['mode'] ?? 'summary') === 'full' ? 'Completo (Avanzado)' : 'Resumen' }}
            </p>
        </div>
    </div>

    <div class="info-box">
        <h2>Información del Reporte</h2>
        <div class="info-box-content">
            <div class="info-row">
                <span class="info-label">Fecha Desde:</span>
                <span class="info-value">{{ \Carbon\Carbon::parse($data['period']['from'])->format('d/m/Y H:i') }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Fecha Hasta:</span>
                <span class="info-value">{{ \Carbon\Carbon::parse($data['period']['to'])->format('d/m/Y H:i') }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Alcance:</span>
                <span class="info-value">
                    @php $scope = strtoupper((string)($data['meta']['scope'] ?? 'SHIFT')); @endphp
                    {{ $scope === 'DATE' ? 'Por fechas (modo antiguo)' : 'Por turnos (SHIFT)' }}
                </span>
            </div>
            @if(($data['meta']['scope'] ?? 'SHIFT') === 'SHIFT')
                <div class="info-row">
                    <span class="info-label">Turnos incluidos:</span>
                    <span class="info-value">
                        {{ (int)($data['meta']['shifts_included_count'] ?? 0) }}
                        <span class="small muted">
                            (turnos abiertos entre las fechas seleccionadas)
                        </span>
                    </span>
                </div>
            @endif
            <div class="info-row last">
                <span class="info-label">Generado:</span>
                <span class="info-value">{{ $generatedAt }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Estacionamiento:</span>
                <span class="info-value">{{ $tenantName ?? (tenant('id') ?? 'N/A') }}</span>
            </div>
            @if(!empty($data['meta']['generated_by']))
                <div class="info-row">
                    <span class="info-label">Generado por:</span>
                    <span class="info-value">{{ $data['meta']['generated_by'] }}</span>
                </div>
            @endif
        </div>
    </div>

    <div class="section avoid-break">
        <div class="section-title">Resumen de Ventas</div>

        @if(($data['other_amount'] ?? 0) > 0)
            <div class="notice-warning small block">
                Hay pagos en métodos no soportados: ${{ number_format($data['other_amount'] ?? 0, 0, ',', '.') }}
            </div>
        @endif
    
        <div class="summary-row block">
            <div class="summary-card">
                <div class="number">${{ number_format($data['total_amount'] ?? 0, 0, ',', '.') }}</div>
                <div class="label">Total (Parking + Lavado de autos)</div>
            </div>
            <div class="summary-card">
                <div class="number">${{ number_format($data['cash_amount'] ?? 0, 0, ',', '.') }}</div>
                <div class="label">Efectivo (Total)</div>
            </div>
            <div class="summary-card">
                <div class="number">${{ number_format($data['card_amount'] ?? 0, 0, ',', '.') }}</div>
                <div class="label">Tarjeta (Total)</div>
            </div>
        </div>

        <table class="table-text">
            <thead>
                <tr>
                    <th>Origen</th>
                    <th class="text-right">Efectivo</th>
                    <th class="text-right">Tarjeta</th>
                    <th class="text-right">Total</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Parking</td>
                    <td class="text-right">${{ number_format($data['parking']['cash_amount'] ?? 0, 0, ',', '.') }}</td>
                    <td class="text-right">${{ number_format($data['parking']['card_amount'] ?? 0, 0, ',', '.') }}</td>
                    <td class="text-right">${{ number_format($data['parking']['total_amount'] ?? 0, 0, ',', '.') }}</td>
                </tr>
                @if($carWashEnabled && $includeWashes && $washTotal > 0)
                    <tr>
                        <td>Lavado de autos</td>
                        <td class="text-right">${{ number_format($data['car_wash']['cash_amount'] ?? 0, 0, ',', '.') }}</td>
                        <td class="text-right">${{ number_format($data['car_wash']['card_amount'] ?? 0, 0, ',', '.') }}</td>
                        <td class="text-right">${{ number_format($data['car_wash']['total_amount'] ?? 0, 0, ',', '.') }}</td>
                    </tr>
                @endif
                <tr>
                    <td><strong>Total</strong></td>
                    <td class="text-right"><strong>${{ number_format($data['cash_amount'] ?? 0, 0, ',', '.') }}</strong></td>
                    <td class="text-right"><strong>${{ number_format($data['card_amount'] ?? 0, 0, ',', '.') }}</strong></td>
                    <td class="text-right"><strong>${{ number_format($data['total_amount'] ?? 0, 0, ',', '.') }}</strong></td>
                </tr>
            </tbody>
        </table>
    </div>

    @if(($data['mode'] ?? 'summary') === 'full')
        <div class="section avoid-break">
            <div class="section-title">Análisis Operacional</div>
            <table class="table-text">
                <tbody>
                    <tr>
                        <td><strong>Hora pico:</strong></td>
                        <td>{{ isset($data['peak_hour_money']) ? (str_pad((string)$data['peak_hour_money'], 2, '0', STR_PAD_LEFT) . ':00') : 'N/A' }}</td>
                    </tr>
                    <tr>
                        <td><strong>Ticket promedio:</strong></td>
                        <td>${{ number_format($data['average_ticket'] ?? 0, 0, ',', '.') }}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        @if(!empty($data['hourly_money']))
            <div class="page-break"></div>
            <div class="section">
            
                <div class="section-title">Ventas por Hora</div>
                <p class="section-description">
                    Distribución de ingresos por hora durante el período seleccionado
                </p>
                <div class="chart-container">
                    <div class="chart">
                        <div style="font-size:9pt;color:#666;margin-bottom:6pt;">
                            Hora pico por monto: {{ str_pad((string)($data['peak_hour_money'] ?? 0), 2, '0', STR_PAD_LEFT) }}:00
                        </div>

                        @php $max = max(1, (float)($data['hourly_max_total'] ?? 1)); @endphp

                        @foreach($data['hourly_money'] as $hour => $info)
                            @php
                                $total = (float)($info['total'] ?? 0);
                                $pct = min(100, round(($total / $max) * 100));
                                $isPeak = ((int)$hour === (int)($data['peak_hour_money'] ?? -1));
                            @endphp
                            <div class="chart-row">
                                <div class="chart-label">{{ str_pad((string)$hour, 2, '0', STR_PAD_LEFT) }}</div>
                                <div class="chart-bar-cell">
                                    <div class="chart-bar-bg">
                                        <div class="chart-bar {{ $isPeak ? 'peak' : '' }}" style="width: {{ $pct }}%;"></div>
                                    </div>
                                </div>
                                <div class="chart-value">${{ number_format($total, 0, ',', '.') }}</div>
                            </div>
                        @endforeach

                        @php
                            $top3 = collect($data['hourly_money'])
                                ->map(function($v, $k){ return ['hour' => (int)$k, 'total' => (float)($v['total'] ?? 0)]; })
                                ->sortByDesc('total')
                                ->take(3)
                                ->values();
                        @endphp
                        <div style="margin-top:8pt;" class="small muted">
                            Top 3 horas por monto:
                            @foreach($top3 as $idx => $row)
                                {{ str_pad((string)$row['hour'], 2, '0', STR_PAD_LEFT) }}:00 (${{ number_format($row['total'], 0, ',', '.') }})@if($idx < 2),@endif
                            @endforeach
                        </div>
                    </div>
                </div>
            </div>
        @endif

        <div class="section avoid-break">
            <div class="section-title">Distribución de Pagos</div>
            <table class="table-text">
                <thead>
                    <tr>
                        <th>Método</th>
                        <th class="text-right">Monto</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Efectivo</td>
                        <td class="text-right">${{ number_format($data['payment_methods']['cash'] ?? 0, 0, ',', '.') }}</td>
                    </tr>
                    <tr>
                        <td>Tarjeta</td>
                        <td class="text-right">${{ number_format($data['payment_methods']['card'] ?? 0, 0, ',', '.') }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    @endif

    @if(count($data['by_sector']) > 0)
    <div class="section avoid-break">
        <div class="section-title">Ventas por Sector</div>
        <table class="table-text">
            <thead>
                <tr>
                    <th>Sector</th>
                    <th class="text-right">Cantidad</th>
                    <th class="text-right">Total</th>
                </tr>
            </thead>
            <tbody>
                @foreach($data['by_sector'] as $sector => $info)
                <tr>
                    <td>{{ $sector }}</td>
                    <td class="text-right">{{ $info['count'] }}</td>
                    <td class="text-right">${{ number_format($info['total'], 0, ',', '.') }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>
    @endif

    @if(count($data['by_operator']) > 0)
    <div class="section avoid-break">
        <div class="section-title">Ventas por Operador</div>
        <table class="table-text">
            <thead>
                <tr>
                    <th>Operador</th>
                    <th class="text-right">Cantidad</th>
                    <th class="text-right">Total</th>
                </tr>
            </thead>
            <tbody>
                @foreach($data['by_operator'] as $operator => $info)
                <tr>
                    <td>{{ $operator }}</td>
                    <td class="text-right">{{ $info['count'] }}</td>
                    <td class="text-right">${{ number_format($info['total'], 0, ',', '.') }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>
    @endif

    @if(!empty($data['sessions_detail']))
        <div class="page-break"></div>
        <div class="section">
        <div class="section-title">Anexo A — Detalle de Sesiones</div>
        <div class="small muted block">
            @if(!is_null($sessionsLimitUsed))
                Mostrando {{ $sessionsCount }} sesiones (límite {{ $sessionsLimitUsed }} aplicado)
            @else
                Mostrando {{ $sessionsCount }} sesiones
            @endif
        </div>
        <table class="table-text">
            <thead>
                <tr>
                    <th style="width: 16%;">Operador</th>
                    <th style="width: 12%;">Patente</th>
                    <th style="width: 18%;">Ingreso</th>
                    <th style="width: 18%;">Salida</th>
                    <th style="width: 12%;" class="text-right">Duración</th>
                    <th style="width: 12%;" class="text-right">Monto</th>
                </tr>
            </thead>
            <tbody>
                @foreach(($data['sessions_detail'] ?? []) as $session)
                <tr>
                    <td>{{ $session['operator'] }}</td>
                    <td>{{ $session['plate'] ?? 'N/A' }}</td>
                    <td>{{ \Carbon\Carbon::parse($session['started_at'])->format('d/m/Y H:i') }}</td>
                    <td>{{ $session['ended_at'] ? \Carbon\Carbon::parse($session['ended_at'])->format('d/m/Y H:i') : 'N/A' }}</td>
                    <td class="text-right">{{ $session['duration'] }}</td>
                    <td class="text-right">${{ number_format($session['amount'], 0, ',', '.') }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
        </div>
    @endif

    <div class="footer">
        Documento generado automáticamente por STPark.
    </div>

    <script type="text/php">
        if (isset($pdf)) {
            $pdf->page_text(15, 820, "STPark © " . date('Y') . "  |  Página {PAGE_NUM} de {PAGE_COUNT}", null, 8, array(120,120,120));
        }
    </script>
</body>
</html>
