<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reporte de Turno</title>
    <style>
        @page { margin: 12mm; }
        body { 
            font-family: 'DejaVu Sans', sans-serif; 
            font-size: 8pt; 
            color: #333; 
            line-height: 1.3;
        }
        .header { 
            background-color: white;
            color: black; 
            padding: 10pt; 
            margin-bottom: 10pt;
            border: none;
            text-align: center;
        }
        .header-content {
            display: block;
        }
        .logo-container {
            margin-bottom: 6pt;
        }
        .logo-container img {
            max-width: 100pt;
            height: auto;
        }
        .header-text {
            display: block;
        }
        .header h1 { 
            font-size: 16pt; 
            margin-bottom: 4pt; 
            color: #333;
        }
        .header p { 
            font-size: 7pt; 
            color: #666;
        }
        .info-box { 
            background: white; 
            border: 1pt solid #e0e0e0;
            border-radius: 5pt;
            padding: 0;
            margin-bottom: 10pt;
            overflow: hidden;
        }
        .info-box h2 { 
            font-size: 10pt; 
            margin: 0;
            padding: 8pt; 
            color: white;
            background-color: #043476;
            font-weight: bold;
        }
        .info-box-content {
            padding: 8pt;
        }
        .info-row { 
            margin-bottom: 5pt;
            display: table;
            width: 100%;
        }
        .info-row.last {
            padding-top: 5pt;
            margin-top: 5pt;
            margin-bottom: 0;
            border-top: 1pt solid #e0e0e0;
        }
        .info-label {
            display: inline-block;
            width: 120pt;
            font-weight: bold;
            color: #666;
            font-size: 7.5pt;
        }
        .info-value {
            display: inline-block;
            color: #333;
            font-size: 7.5pt;
        }
        .amount-row {
            display: table;
            width: 100%;
            margin-bottom: 5pt;
            padding: 5pt;
            background-color: #f9fafb;
            border-left: 3pt solid #3b82f6;
        }
        .amount-label {
            display: inline-block;
            width: 120pt;
            font-weight: bold;
            color: #374151;
            font-size: 7.5pt;
        }
        .amount-value {
            display: inline-block;
            font-size: 9pt;
            font-weight: bold;
            color: #1f2937;
        }
        .amount-positive {
            color: #059669;
        }
        .amount-negative {
            color: #dc2626;
        }
        .total-row {
            display: table;
            width: 100%;
            margin-top: 8pt;
            padding: 8pt;
            background-color: #eff6ff;
            border: 2pt solid #3b82f6;
            border-radius: 4pt;
        }
        .total-label {
            display: inline-block;
            width: 120pt;
            font-size: 10pt;
            font-weight: bold;
            color: #1d4ed8;
        }
        .total-value {
            display: inline-block;
            font-size: 12pt;
            font-weight: bold;
            color: #1d4ed8;
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 10pt;
        }
        th { 
            background: #043476; 
            color: white; 
            padding: 5pt 8pt; 
            text-align: left; 
            font-weight: bold; 
            font-size: 7.5pt; 
        }
        td { 
            padding: 4pt 8pt; 
            border-bottom: 1pt solid #e0e0e0; 
            font-size: 7.5pt; 
        }
        tr:nth-child(even) { 
            background: #f8f9fa; 
        }
        .text-right { 
            text-align: right; 
        }
        .footer { 
            margin-top: 15pt; 
            padding-top: 8pt; 
            border-top: 2pt solid #043476; 
            text-align: center; 
            font-size: 7pt; 
            color: #666; 
        }
        .section-title { 
            font-size: 11pt; 
            font-weight: bold; 
            margin: 10pt 0 6pt 0; 
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
                <h1>Reporte de Turno</h1>
                <p>Sistema de Gestión de Estacionamiento STPark</p>
            </div>
        </div>
    </div>

    <div class="info-box">
        <h2>Información del Turno</h2>
        <div class="info-box-content">
            <div class="info-row">
                <span class="info-label">Turno ID:</span>
                <span class="info-value">{{ substr($data['shift']['id'], 0, 8) }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Operador:</span>
                <span class="info-value">{{ $data['shift']['operator']['name'] ?? 'N/A' }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Sector:</span>
                <span class="info-value">{{ $data['shift']['sector']['name'] ?? 'N/A' }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Estado:</span>
                <span class="info-value">{{ $data['shift']['status_text'] ?? $data['shift']['status'] }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Apertura:</span>
                <span class="info-value">{{ $data['shift']['opened_at'] ? \Carbon\Carbon::parse($data['shift']['opened_at'])->format('d/m/Y H:i') : 'N/A' }}</span>
            </div>
            @if(!empty($data['shift']['closed_at']))
            <div class="info-row">
                <span class="info-label">Cierre:</span>
                <span class="info-value">{{ \Carbon\Carbon::parse($data['shift']['closed_at'])->format('d/m/Y H:i') }}</span>
            </div>
            @endif
            <div class="info-row last">
                <span class="info-label">Generado:</span>
                <span class="info-value">{{ \Carbon\Carbon::parse($data['generated_at'])->format('d/m/Y H:i') }}</span>
            </div>
        </div>
    </div>

    <div class="section-title">Resumen Financiero</div>
    
    <div class="info-box">
        <div class="info-box-content">
            <div class="amount-row">
                <span class="amount-label">Fondo Inicial:</span>
                <span class="amount-value">${{ number_format($data['cash_summary']['opening_float'], 0, ',', '.') }}</span>
            </div>
            <div class="amount-row">
                <span class="amount-label">Efectivo Cobrado:</span>
                <span class="amount-value amount-positive">+${{ number_format($data['cash_summary']['cash_collected'], 0, ',', '.') }}</span>
            </div>
            @if(($data['cash_summary']['cash_withdrawals'] ?? 0) > 0)
            <div class="amount-row">
                <span class="amount-label">Retiros:</span>
                <span class="amount-value amount-negative">-${{ number_format($data['cash_summary']['cash_withdrawals'], 0, ',', '.') }}</span>
            </div>
            @endif
            @if(($data['cash_summary']['cash_deposits'] ?? 0) > 0)
            <div class="amount-row">
                <span class="amount-label">Depósitos:</span>
                <span class="amount-value amount-positive">+${{ number_format($data['cash_summary']['cash_deposits'], 0, ',', '.') }}</span>
            </div>
            @endif
            <div class="total-row">
                <span class="total-label">Efectivo Esperado:</span>
                <span class="total-value">${{ number_format($data['cash_summary']['cash_expected'], 0, ',', '.') }}</span>
            </div>
            @if(isset($data['cash_summary']['cash_declared']) && $data['cash_summary']['cash_declared'] !== null)
            <div class="amount-row" style="margin-top: 5pt;">
                <span class="amount-label">Efectivo Declarado:</span>
                <span class="amount-value">${{ number_format($data['cash_summary']['cash_declared'], 0, ',', '.') }}</span>
            </div>
            @endif
            @if(isset($data['cash_summary']['cash_over_short']) && $data['cash_summary']['cash_over_short'] !== null)
            <div class="amount-row" style="margin-top: 5pt; background-color: {{ $data['cash_summary']['cash_over_short'] < 0 ? '#fef2f2' : '#f0fdf4' }}; border-left-color: {{ $data['cash_summary']['cash_over_short'] < 0 ? '#dc2626' : '#059669' }};">
                <span class="amount-label">Diferencia:</span>
                <span class="amount-value {{ $data['cash_summary']['cash_over_short'] < 0 ? 'amount-negative' : 'amount-positive' }}">${{ number_format($data['cash_summary']['cash_over_short'], 0, ',', '.') }}</span>
            </div>
            @endif
        </div>
    </div>

    @if(count($data['payments_by_method'] ?? []) > 0)
    <div class="section-title">Pagos por Método</div>
    <table>
        <thead>
            <tr>
                <th>Método de Pago</th>
                <th class="text-right">Transacciones</th>
                <th class="text-right">Monto Total</th>
            </tr>
        </thead>
        <tbody>
            @foreach($data['payments_by_method'] as $payment)
            <tr>
                <td>{{ $payment['method_text'] ?? $payment['method'] }}</td>
                <td class="text-right">{{ $payment['count'] ?? 0 }}</td>
                <td class="text-right">${{ number_format($payment['collected'] ?? 0, 0, ',', '.') }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
    @endif

    @if(count($data['sales_summary'] ?? []) > 0 && ($data['sales_summary']['tickets_count'] ?? 0) > 0)
    <div class="section-title">Resumen de Ventas</div>
    <div class="info-box">
        <div class="info-box-content">
            <div class="info-row">
                <span class="info-label">Tickets Vendidos:</span>
                <span class="info-value">{{ $data['sales_summary']['tickets_count'] }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Subtotal:</span>
                <span class="info-value">${{ number_format($data['sales_summary']['subtotal'] ?? 0, 0, ',', '.') }}</span>
            </div>
            @if(($data['sales_summary']['discount_total'] ?? 0) > 0)
            <div class="info-row">
                <span class="info-label">Descuentos:</span>
                <span class="info-value">${{ number_format($data['sales_summary']['discount_total'], 0, ',', '.') }}</span>
            </div>
            @endif
            <div class="info-row last">
                <span class="info-label">Total:</span>
                <span class="info-value" style="font-weight: bold; font-size: 9pt;">${{ number_format($data['sales_summary']['total'] ?? 0, 0, ',', '.') }}</span>
            </div>
        </div>
    </div>
    @endif

    <div class="footer">
        <p>Este es un documento generado automáticamente. STPark © {{ date('Y') }}</p>
    </div>
</body>
</html>

