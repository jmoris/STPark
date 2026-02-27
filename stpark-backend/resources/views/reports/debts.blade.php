<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reporte de Deudas</title>
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

        $byStatus = $data['by_status'] ?? [];
        $pendingCount = $byStatus['PENDING']['count'] ?? 0;
        $pendingTotal = $byStatus['PENDING']['total'] ?? 0;
        $settledCount = $byStatus['SETTLED']['count'] ?? 0;
        $settledTotal = $byStatus['SETTLED']['total'] ?? 0;
        $cancelledCount = $byStatus['CANCELLED']['count'] ?? 0;
        $cancelledTotal = $byStatus['CANCELLED']['total'] ?? 0;

        $includeDetail = (bool)($data['meta']['include_debts_detail'] ?? false);
        $detailCount = count($data['debts_detail'] ?? []);
    @endphp

    <div class="header">
        <div class="header-left">
            <img src="{{ public_path('images/logo/stpark-blue.png') }}" alt="STPark Logo">
        </div>
        <div class="header-right">
            <h1>Reporte de Deudas</h1>
            <p class="header-subtitle">STPark — Gestión de Estacionamiento</p>
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
        <div class="section-title">Resumen de Deudas</div>

        <div class="summary-row">
            <div class="summary-card">
                <div class="number">{{ $data['total_debts'] ?? 0 }}</div>
                <div class="label">Total de deudas</div>
            </div>
            <div class="summary-card">
                <div class="number">${{ number_format($data['total_amount'] ?? 0, 0, ',', '.') }}</div>
                <div class="label">Monto total</div>
            </div>
            <div class="summary-card">
                <div class="number">{{ $pendingCount }}</div>
                <div class="label">Pendientes</div>
            </div>
        </div>

        <div class="summary-row">
            <div class="summary-card">
                <div class="number">${{ number_format($pendingTotal ?? 0, 0, ',', '.') }}</div>
                <div class="label">Monto pendientes</div>
            </div>
            <div class="summary-card">
                <div class="number">{{ $settledCount }}</div>
                <div class="label">Liquidadas</div>
            </div>
            <div class="summary-card">
                <div class="number">${{ number_format($settledTotal ?? 0, 0, ',', '.') }}</div>
                <div class="label">Monto liquidadas</div>
            </div>
        </div>
    </div>

    @if(count($data['by_status']) > 0)
    <div class="section avoid-break">
        <div class="section-title">Deudas por Estado</div>
        <table class="table-text">
            <thead>
                <tr>
                    <th>Estado</th>
                    <th class="text-right">Cantidad</th>
                    <th class="text-right">Total</th>
                </tr>
            </thead>
            <tbody>
                @foreach($data['by_status'] as $status => $info)
                <tr>
                    <td>
                        @if($status == 'PENDING')
                            <span class="badge badge-pending">Pendiente</span>
                        @elseif($status == 'SETTLED')
                            <span class="badge badge-settled">Liquidada</span>
                        @elseif($status == 'CANCELLED')
                            <span class="badge badge-cancelled">Cancelada</span>
                        @else
                            {{ $status }}
                        @endif
                    </td>
                    <td class="text-right">{{ $info['count'] ?? 0 }}</td>
                    <td class="text-right">${{ number_format($info['total'] ?? 0, 0, ',', '.') }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>
    @endif

    @if(count($data['by_sector']) > 0)
    <div class="section avoid-break">
        <div class="section-title">Deudas por Sector</div>
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
                    <td>{{ $sector ?? 'N/A' }}</td>
                    <td class="text-right">{{ $info['count'] ?? 0 }}</td>
                    <td class="text-right">${{ number_format($info['total'] ?? 0, 0, ',', '.') }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>
    @endif

    @if($includeDetail && $detailCount > 0)
        <div class="page-break"></div>
        <div class="section">
            <div class="section-title">Anexo A — Detalle de Deudas</div>
            <div class="small muted block">
                Mostrando {{ $detailCount }} deudas
            </div>
            <table class="table-text">
                <thead>
                    <tr>
                        <th style="width: 12%;">ID</th>
                        <th style="width: 14%;">Patente</th>
                        <th style="width: 22%;">Sector</th>
                        <th style="width: 14%;" class="text-right">Monto</th>
                        <th style="width: 16%;">Estado</th>
                        <th style="width: 22%;">Fecha</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($data['debts_detail'] as $debt)
                    <tr>
                        <td>#{{ $debt['id'] }}</td>
                        <td>{{ $debt['plate'] }}</td>
                        <td>{{ $debt['sector'] }}</td>
                        <td class="text-right">${{ number_format($debt['principal_amount'], 0, ',', '.') }}</td>
                        <td>
                            @if(($debt['status'] ?? '') == 'PENDING')
                                <span class="badge badge-pending">Pendiente</span>
                            @elseif(($debt['status'] ?? '') == 'SETTLED')
                                <span class="badge badge-settled">Liquidada</span>
                            @elseif(($debt['status'] ?? '') == 'CANCELLED')
                                <span class="badge badge-cancelled">Cancelada</span>
                            @else
                                {{ $debt['status'] ?? 'N/A' }}
                            @endif
                        </td>
                        <td>{{ \Carbon\Carbon::parse($debt['created_at'])->format('d/m/Y H:i') }}</td>
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
