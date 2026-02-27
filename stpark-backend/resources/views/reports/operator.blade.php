<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reporte por Operador</title>
    @include('reports._styles')
</head>
<body>
    @php
        $generatedAt = now()->format('d/m/Y H:i');
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

        $totalAmount = (float)($data['total_amount'] ?? 0);
        $cashAmount = (float)($data['cash_amount'] ?? 0);
        $cardAmount = (float)($data['card_amount'] ?? 0);
        $avgTicket = ($data['total_sales'] ?? 0) > 0 ? ($totalAmount / (float)$data['total_sales']) : 0;
        $cashPct = $totalAmount > 0 ? round(($cashAmount / $totalAmount) * 100, 0) : 0;
        $cardPct = $totalAmount > 0 ? round(($cardAmount / $totalAmount) * 100, 0) : 0;

        $includeSessions = (bool)($data['meta']['include_sessions_detail'] ?? false);
        $sessionsCount = count($data['sessions_detail'] ?? []);

        $carWashEnabled = (bool)($data['meta']['car_wash_enabled'] ?? false);
        $washTotal = (float)($data['car_wash']['total_amount'] ?? 0);
    @endphp

    <div class="header">
        <div class="header-left">
            <img src="{{ public_path('images/logo/stpark-blue.png') }}" alt="STPark Logo">
        </div>
        <div class="header-right">
            <h1>Reporte por Operador</h1>
            <p class="header-subtitle">STPark — Gestión de Estacionamiento</p>
        </div>
    </div>

    <div class="info-box">
        <h2>Información del Reporte</h2>
        <div class="info-box-content">
            <div class="info-row">
                <span class="info-label">Operador:</span>
                <span class="info-value">{{ $data['operator']['name'] }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Estacionamiento:</span>
                <span class="info-value">{{ $tenantName ?? (tenant('id') ?? 'N/A') }}</span>
            </div>
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
        </div>
    </div>

    <div class="section avoid-break">
        <div class="section-title">Resumen</div>

        <div class="summary-row">
            <div class="summary-card">
                <div class="number">{{ $data['total_sales'] ?? 0 }}</div>
                <div class="label">Sesiones completadas</div>
            </div>
            <div class="summary-card">
                <div class="number">${{ number_format($totalAmount, 0, ',', '.') }}</div>
                <div class="label">Total recaudado</div>
            </div>
            <div class="summary-card">
                <div class="number">${{ number_format($avgTicket, 0, ',', '.') }}</div>
                <div class="label">Ticket promedio</div>
            </div>
        </div>

        <div class="summary-row">
            <div class="summary-card">
                <div class="number">${{ number_format($cashAmount, 0, ',', '.') }}</div>
                <div class="label">Efectivo ({{ $cashPct }}%)</div>
            </div>
            <div class="summary-card">
                <div class="number">${{ number_format($cardAmount, 0, ',', '.') }}</div>
                <div class="label">Tarjeta ({{ $cardPct }}%)</div>
            </div>
            <div class="summary-card">
                <div class="number">{{ $carWashEnabled ? 'Sí' : 'No' }}</div>
                <div class="label">Lavado de autos habilitado</div>
            </div>
        </div>

        @if($carWashEnabled && $washTotal > 0)
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
                    <tr>
                        <td>Lavado de autos</td>
                        <td class="text-right">${{ number_format($data['car_wash']['cash_amount'] ?? 0, 0, ',', '.') }}</td>
                        <td class="text-right">${{ number_format($data['car_wash']['card_amount'] ?? 0, 0, ',', '.') }}</td>
                        <td class="text-right">${{ number_format($data['car_wash']['total_amount'] ?? 0, 0, ',', '.') }}</td>
                    </tr>
                    <tr>
                        <td><strong>Total</strong></td>
                        <td class="text-right"><strong>${{ number_format($cashAmount, 0, ',', '.') }}</strong></td>
                        <td class="text-right"><strong>${{ number_format($cardAmount, 0, ',', '.') }}</strong></td>
                        <td class="text-right"><strong>${{ number_format($totalAmount, 0, ',', '.') }}</strong></td>
                    </tr>
                </tbody>
            </table>
        @endif
    </div>

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
                    <td class="text-right">{{ $info['count'] ?? 0 }}</td>
                    <td class="text-right">${{ number_format($info['total'] ?? 0, 0, ',', '.') }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>
    @endif

    @if(count($data['debts_detail'] ?? []) > 0)
    <div class="section avoid-break">
        <div class="section-title">Deudas Liquidadas</div>
        <table class="table-text">
            <thead>
                <tr>
                    <th style="width: 12%;">ID</th>
                    <th style="width: 14%;">Patente</th>
                    <th style="width: 26%;">Sector</th>
                    <th style="width: 16%;" class="text-right">Monto</th>
                    <th style="width: 32%;">Fecha Liquidación</th>
                </tr>
            </thead>
            <tbody>
                @foreach($data['debts_detail'] as $debt)
                <tr>
                    <td>#{{ $debt['id'] }}</td>
                    <td>{{ $debt['plate'] }}</td>
                    <td>{{ $debt['sector'] }}</td>
                    <td class="text-right">${{ number_format($debt['principal_amount'], 0, ',', '.') }}</td>
                    <td>{{ \Carbon\Carbon::parse($debt['settled_at'])->format('d/m/Y H:i') }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>
    @endif

    @if($includeSessions && $sessionsCount > 0)
        <div class="page-break"></div>
        <div class="section">
            <div class="section-title">Anexo A — Detalle de Sesiones</div>
            <div class="small muted block">
                Mostrando {{ $sessionsCount }} sesiones
            </div>
            <table class="table-text">
                <thead>
                    <tr>
                        <th style="width: 22%;">Ingreso</th>
                        <th style="width: 22%;">Salida</th>
                        <th style="width: 14%;" class="text-right">Duración</th>
                        <th style="width: 14%;" class="text-right">Efectivo</th>
                        <th style="width: 14%;" class="text-right">Tarjeta</th>
                        <th style="width: 14%;" class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($data['sessions_detail'] as $session)
                    <tr>
                        <td>{{ \Carbon\Carbon::parse($session['started_at'])->format('d/m/Y H:i') }}</td>
                        <td>{{ $session['ended_at'] ? \Carbon\Carbon::parse($session['ended_at'])->format('d/m/Y H:i') : 'N/A' }}</td>
                        <td class="text-right">{{ $session['duration'] }}</td>
                        <td class="text-right">${{ number_format($session['cash'] ?? 0, 0, ',', '.') }}</td>
                        <td class="text-right">${{ number_format($session['card'] ?? 0, 0, ',', '.') }}</td>
                        <td class="text-right">${{ number_format($session['amount'] ?? 0, 0, ',', '.') }}</td>
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
