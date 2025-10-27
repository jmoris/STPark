<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reporte por Operador</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'DejaVu Sans', sans-serif; font-size: 10pt; color: #333; line-height: 1.4; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; margin-bottom: 20px; }
        .header h1 { font-size: 24pt; margin-bottom: 5px; }
        .header p { font-size: 9pt; opacity: 0.9; }
        .info-box { background: #f8f9fa; border-left: 4px solid #10b981; padding: 15px; margin-bottom: 20px; }
        .info-box h2 { font-size: 12pt; margin-bottom: 10px; color: #10b981; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .info-label { font-weight: bold; color: #666; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
        .summary-card { background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; text-align: center; }
        .summary-card .number { font-size: 20pt; font-weight: bold; color: #10b981; margin-bottom: 5px; }
        .summary-card .label { font-size: 9pt; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #10b981; color: white; padding: 10px; text-align: left; font-weight: bold; font-size: 9pt; }
        td { padding: 8px 10px; border-bottom: 1px solid #e0e0e0; font-size: 9pt; }
        tr:nth-child(even) { background: #f8f9fa; }
        .text-right { text-align: right; }
        .footer { margin-top: 30px; padding-top: 15px; border-top: 2px solid #10b981; text-align: center; font-size: halt; color: #666; }
        .section-title { font-size: 14pt; font-weight: bold; margin: 20px 0 10px 0; color: #10b981; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Reporte por Operador</h1>
        <p>Sistema de Gestion de Estacionamiento STPark</p>
    </div>

    <div class="info-box">
        <h2>Informacion del Operador</h2>
        <div class="info-row">
            <span class="info-label">Nombre:</span>
            <span>{{ $data['operator']['name'] }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">RUT:</span>
            <span>{{ $data['operator']['rut'] }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Periodo:</span>
            <span>{{ \Carbon\Carbon::parse($data['period']['from'])->format('d/m/Y') }} - {{ \Carbon\Carbon::parse($data['period']['to'])->format('d/m/Y') }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Generado:</span>
            <span>{{ now()->format('d/m/Y H:i') }}</span>
        </div>
    </div>

    <div class="section-title">Resumen de Sesiones</div>
    <div class="summary-grid">
        <div class="summary-card">
            <div class="number">{{ $data['sessions']['total'] }}</div>
            <div class="label">Total Sesiones</div>
        </div>
        <div class="summary-card">
            <div class="number">{{ $data['sessions']['active'] }}</div>
            <div class="label">Activas</div>
        </div>
        <div class="summary-card">
            <div class="number">{{ $data['sessions']['completed'] }}</div>
            <div class="label">Completadas</div>
        </div>
    </div>

    <div class="section-title">Resumen de Ventas</div>
    <div class="summary-grid">
        <div class="summary-card">
            <div class="number">{{ $data['sales']['total'] }}</div>
            <div class="label">Total Ventas</div>
        </div>
        <div class="summary-card">
            <div class="number">${{ number_format($data['sales']['total_amount'], 0, ',', '.') }}</div>
            <div class="label">Monto Total</div>
        </div>
        <div class="summary-card">
            <div class="number">${{ number_format($data['sales']['total'] > 0 ? $data['sales']['total_amount'] / $data['sales']['total'] : 0, 0, ',', '.') }}</div>
            <div class="label">Ticket Promedio</div>
        </div>
    </div>

    @if(count($data['sessions enclaveservice_sector']) > 0)
    <div class="section-title">Sesiones por Sector</div>
    <table>
        <thead>
            <tr>
                <th>Sector</th>
                <th class="text-right">Cant罹d</th>
            </tr>
        </thead>
        <tbody>
            @foreach($data['sessions']['by_sector'] as $sector => $count)
            <tr>
                <td>{{ $sector }}</td>
                <td class="text-right">{{ $count }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
    @endif

    <div class="footer">
        <p>Este es un documento generado automaticamente. STPark © {{ date('Y') }}</p>
    </div>
</body>
</html>
