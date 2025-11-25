<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reporte de Sesiones</title>
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
            margin-bottom: 12pt;
        }
        .logo-container img {
            max-width: 85pt;
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
            padding: 12pt; 
            margin-bottom: 15pt;
        }
        .info-box h2 { 
            font-size: 12pt; 
            margin-bottom: 10pt; 
            color: #333;
            border-bottom: 1pt solid #e0e0e0;
            padding-bottom: 6pt;
        }
        .info-row { 
            margin-bottom: 6pt;
            display: inline-block;
            width: 48%;
            vertical-align: top;
        }
        .info-row.last {
            display: block;
            width: 100%;
            border-top: 1pt solid #e0e0e0;
            padding-top: 8pt;
            margin-top: 6pt;
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
            background: #dc2626; 
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
        .badge {
            padding: 4pt 8pt;
            border-radius: 4pt;
            font-size: 8pt;
            font-weight: bold;
            display: inline-block;
        }
        .badge-pending {
            background: #fff3cd;
            color: #856404;
        }
        .badge-settled {
            background: #d4edda;
            color: #155724;
        }
        .footer { 
            margin-top: 25pt; 
            padding-top: 12pt; 
            border-top: 2pt solid #dc2626; 
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
                <h1>Reporte de Sesiones</h1>
                <p>Sistema de Gestión de Estacionamiento STPark</p>
            </div>
        </div>
    </div>

    <div class="info-box">
        <h2>Período de Reporte</h2>
        <div class="info-row">
            <strong>Desde:</strong> {{ \Carbon\Carbon::parse($data['period']['from'])->format('d/m/Y') }}
        </div>
        <div class="info-row">
            <strong>Hasta:</strong> {{ \Carbon\Carbon::parse($data['period']['to'])->format('d/m/Y') }}
        </div>
        <div class="info-row">
            <strong>Generado:</strong> {{ now()->format('d/m/Y H:i') }}
        </div>
    </div>

    <div class="summary-row">
        <div class="summary-card">
            <div class="number">{{ $data['total_debts'] }}</div>
            <div class="label">Total Deudas</div>
        </div>
        <div class="summary-card">
            <div class="number">${{ number_format($data['total_amount'], 0, ',', '.') }}</div>
            <div class="label">Monto Total</div>
        </div>
        <div class="summary-card">
            <div class="number">{{ $data['by_status']['PENDING']['count'] ?? 0 }}</div>
            <div class="label">Deudas Pendientes</div>
        </div>
    </div>

    @if(count($data['by_status']) > 0)
    <div class="section-title">Deudas por Estado</div>
    <table>
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
                    @else
                        <span class="badge badge-settled">Cancelada</span>
                    @endif
                </td>
                <td class="text-right">{{ $info['count'] }}</td>
                <td class="text-right">${{ number_format($info['total'], 0, ',', '.') }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
    @endif

    @if(count($data['by_sector']) > 0)
    <div class="section-title">Deudas por Sector</div>
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
                <td>{{ $sector ?? 'N/A' }}</td>
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
