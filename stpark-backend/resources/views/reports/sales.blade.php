<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reporte de Ventas</title>
    <style>
        @page { margin: 15mm; }
        body { 
            font-family: 'DejaVu Sans', sans-serif; 
            font-size: 10pt; 
            color: #333; 
            line-height: 1.4;
        }
        .header { 
            background-color: white;
            color: black; 
            padding: 15pt; 
            margin-bottom: 15pt;
            border: none;
            text-align: center;
        }
        .header-content {
            display: block;
        }
        .logo-container {
            margin-bottom: 8pt;
        }
        .logo-container img {
            max-width: 100pt;
            height: auto;
        }
        .header-text {
            display: block;
        }
        .header h1 { 
            font-size: 20pt; 
            margin-bottom: 5pt; 
            color: #333;
        }
        .header p { 
            font-size: 8pt; 
            color: #666;
        }
        .info-box { 
            background: white; 
            border: 1pt solid #e0e0e0;
            border-radius: 5pt;
            padding: 0;
            margin-bottom: 15pt;
            overflow: hidden;
        }
        .info-box h2 { 
            font-size: 13pt; 
            margin: 0;
            padding: 12pt; 
            color: white;
            background-color: #043476;
            font-weight: bold;
        }
        .info-box-content {
            padding: 12pt;
        }
        .info-row { 
            margin-bottom: 8pt;
            display: table;
            width: 100%;
        }
        .info-row.last {
            padding-top: 8pt;
            margin-top: 8pt;
            margin-bottom: 0;
            border-top: 1pt solid #e0e0e0;
        }
        .info-label {
            display: inline-block;
            width: 140pt;
            font-weight: bold;
            color: #666;
        }
        .info-value {
            display: inline-block;
            color: #333;
        }
        .summary-row {
            width: 100%;
            display: table;
            margin-bottom: 20pt;
        }
        .summary-card { 
            background: white; 
            border: 1pt solid #e0e0e0; 
            border-radius: 5pt; 
            padding: 15pt; 
            text-align: center;
            display: table-cell;
            width: 33.33%;
            vertical-align: middle;
        }
        .summary-card .number { 
            font-size: 18pt; 
            font-weight: bold; 
            color: #043476; 
            margin-bottom: 5pt; 
        }
        .summary-card .label { 
            font-size: 9pt; 
            color: #666; 
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 15pt;
        }
        th { 
            background: #043476; 
            color: white; 
            padding: 8pt 10pt; 
            text-align: left; 
            font-weight: bold; 
            font-size: 9pt; 
        }
        td { 
            padding: 7pt 10pt; 
            border-bottom: 1pt solid #e0e0e0; 
            font-size: 9pt; 
        }
        tr:nth-child(even) { 
            background: #f8f9fa; 
        }
        .text-right { 
            text-align: right; 
        }
        .footer { 
            margin-top: 25pt; 
            padding-top: 12pt; 
            border-top: 2pt solid #043476; 
            text-align: center; 
            font-size: 8pt; 
            color: #666; 
        }
        .section-title { 
            font-size: 14pt; 
            font-weight: bold; 
            margin: 18pt 0 8pt 0; 
            color: #043476; 
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-content">
            <div class="logo-container">
                <img src="{{ public_path('images/logo/stpark-blue.png') }}" alt="STPark Logo">
            </div>
            <div class="header-text">
                <h1>Reporte de Ventas</h1>
                <p>Sistema de Gestión de Estacionamiento STPark</p>
            </div>
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
                <span class="info-value">{{ now()->format('d/m/Y H:i') }}</span>
            </div>
            <div class="info-row last">
                <span class="info-label">Generado por:</span>
                <span class="info-value">{{ auth()->user() ? auth()->user()->name . ' (' . auth()->user()->email . ')' : 'Sistema' }}</span>
            </div>
        </div>
    </div>

    @if(count($data['sessions_detail'] ?? []) > 0)
    <div class="section-title">Detalle de Sesiones</div>
    <table>
        <thead>
            <tr>
                <th style="width: 20%;">Operador</th>
                <th style="width: 18%;">Ingreso</th>
                <th style="width: 18%;">Salida</th>
                <th style="width: 12%;" class="text-right">Duración</th>
                <th style="width: 12%;" class="text-right">Monto</th>
            </tr>
        </thead>
        <tbody>
            @foreach($data['sessions_detail'] as $session)
            <tr>
                <td>{{ $session['operator'] }}</td>
                <td>{{ \Carbon\Carbon::parse($session['started_at'])->format('d/m/Y H:i') }}</td>
                <td>{{ $session['ended_at'] ? \Carbon\Carbon::parse($session['ended_at'])->format('d/m/Y H:i') : 'N/A' }}</td>
                <td class="text-right">{{ $session['duration'] }}</td>
                <td class="text-right">${{ number_format($session['amount'], 0, ',', '.') }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
    @endif

    <div class="section-title">Resumen de Ventas</div>
    
    <div class="summary-row">
        <div class="summary-card">
            <div class="number">{{ $data['total_sales'] }}</div>
            <div class="label">Total Ventas</div>
        </div>
        <div class="summary-card">
            <div class="number">${{ number_format($data['cash_amount'] ?? 0, 0, ',', '.') }}</div>
            <div class="label">En Efectivo</div>
        </div>
        <div class="summary-card">
            <div class="number">${{ number_format($data['card_amount'] ?? 0, 0, ',', '.') }}</div>
            <div class="label">Tarjeta</div>
        </div>
    </div>

    <div class="summary-row" style="margin-top: 0;">
        <div class="summary-card">
            <div class="number">${{ number_format($data['total_amount'], 0, ',', '.') }}</div>
            <div class="label">Monto Total</div>
        </div>
        <div class="summary-card">
            <div class="number">{{ $data['total_sales'] > 0 ? round(($data['cash_amount'] ?? 0) / $data['total_amount'] * 100, 0) : 0 }}%</div>
            <div class="label">% Efectivo</div>
        </div>
        <div class="summary-card">
            <div class="number">{{ $data['total_sales'] > 0 ? round(($data['card_amount'] ?? 0) / $data['total_amount'] * 100, 0) : 0 }}%</div>
            <div class="label">% Tarjeta</div>
        </div>
    </div>

    @if(count($data['by_sector']) > 0)
    <div class="section-title">Ventas por Sector</div>
    <table>
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
    @endif

    @if(count($data['by_operator']) > 0)
    <div class="section-title">Ventas por Operador</div>
    <table>
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
    @endif

    <div class="footer">
        <p>Este es un documento generado automáticamente. STPark © {{ date('Y') }}</p>
    </div>
</body>
</html>
