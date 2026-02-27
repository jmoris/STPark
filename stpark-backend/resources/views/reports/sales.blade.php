<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reporte de Ventas</title>
    @include('reports._styles')
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
            <div class="info-row last">
                <span class="info-label">Generado:</span>
                <span class="info-value">{{ $generatedAt }}</span>
            </div>
            <div class="info-row last">
                <span class="info-label">Estacionamiento:</span>
                <span class="info-value">{{ $tenantName ?? (tenant('id') ?? 'N/A') }}</span>
            </div>
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
                        <td>{{ !empty($data['peak_hour']) ? ($data['peak_hour'] . ':00') : 'N/A' }}</td>
                    </tr>
                    <tr>
                        <td><strong>Ticket promedio:</strong></td>
                        <td>${{ number_format($data['average_ticket'] ?? 0, 0, ',', '.') }}</td>
                    </tr>
                </tbody>
            </table>
        </div>

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

        @if(isset($data['hourly']) && count($data['hourly']) > 0)
            <div class="section">
                <div class="section-title">Ventas por Hora</div>
                <table class="table-text">
                    <thead>
                        <tr>
                            <th>Hora</th>
                            <th class="text-right">Ventas</th>
                            <th class="text-right">Monto</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($data['hourly'] as $hour => $info)
                        <tr>
                            <td>{{ $hour }}:00</td>
                            <td class="text-right">{{ $info['count'] ?? 0 }}</td>
                            <td class="text-right">${{ number_format($info['total'] ?? 0, 0, ',', '.') }}</td>
                        </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        @endif
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
