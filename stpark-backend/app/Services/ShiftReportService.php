<?php

namespace App\Services;

use App\Models\Shift;
use App\Models\ShiftOperation;
use App\Services\ShiftService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Barryvdh\DomPDF\Facade\Pdf;

class ShiftReportService
{
    public function __construct(
        private ShiftService $shiftService
    ) {}

    /**
     * Generar reporte de turno en formato JSON, PDF o Excel
     */
    public function generate(Shift $shift, string $format = 'json'): JsonResponse|\Illuminate\Http\Response
    {
        $totals = $this->shiftService->calculateTotals($shift);

        // Obtener detalles de pagos
        $payments = $shift->payments()
            ->where('status', 'COMPLETED')
            ->with(['sale', 'parkingSession'])
            ->orderBy('paid_at', 'desc')
            ->take(50)
            ->get();

        // Obtener ajustes de caja
        $adjustments = $shift->cashAdjustments()
            ->with(['actor', 'approver'])
            ->orderBy('at', 'desc')
            ->get();

        // Calcular resumen de ventas de sesiones de estacionamiento
        $salesSummary = DB::table('sales')
            ->join('payments', 'sales.id', '=', 'payments.sale_id')
            ->where('payments.shift_id', $shift->id)
            ->where('payments.status', 'COMPLETED')
            ->select(
                DB::raw('COUNT(DISTINCT sales.id) as tickets_count'),
                DB::raw('SUM(sales.subtotal) as subtotal'),
                DB::raw('SUM(sales.discount_amount) as discount_total'),
                DB::raw('SUM(sales.total) as total')
            )
            ->first();

        // Obtener detalles de lavados de autos del turno
        $carWashes = $shift->carWashes()
            ->where('status', 'PAID')
            ->with(['carWashType', 'cashierOperator'])
            ->orderBy('paid_at', 'desc')
            ->get();

        $reportData = [
            'shift' => [
                'id' => $shift->id,
                'operator' => $shift->operator ? [
                    'id' => $shift->operator->id,
                    'name' => $shift->operator->name,
                ] : null,
                'sector' => $shift->sector ? [
                    'id' => $shift->sector->id,
                    'name' => $shift->sector->name,
                ] : null,
                'device_id' => $shift->device_id,
                'opened_at' => $shift->opened_at?->setTimezone('America/Santiago')->format('Y-m-d H:i:s'),
                'closed_at' => $shift->closed_at?->setTimezone('America/Santiago')->format('Y-m-d H:i:s'),
                'status' => $shift->status,
                'status_text' => $shift->getStatusText(),
            ],
            'cash_summary' => [
                'opening_float' => $totals['opening_float'],
                'cash_collected' => $totals['cash_collected'],
                'cash_withdrawals' => $totals['cash_withdrawals'],
                'cash_deposits' => $totals['cash_deposits'],
                'cash_expected' => $totals['cash_expected'],
                'cash_declared' => $totals['cash_declared'],
                'cash_over_short' => $totals['cash_over_short'],
            ],
            'sales_summary' => [
                'tickets_count' => (int) ($salesSummary->tickets_count ?? 0),
                'subtotal' => (float) ($salesSummary->subtotal ?? 0),
                'discount_total' => (float) ($salesSummary->discount_total ?? 0),
                'total' => (float) ($salesSummary->total ?? 0),
            ],
            'parking_sales_summary' => [
                'total' => $totals['parking_sales_total'],
                'tickets_count' => $totals['tickets_count'],
            ],
            'car_washes_summary' => [
                'count' => $totals['car_washes_count'],
                'total' => $totals['car_washes_total'],
                'cash_total' => $totals['car_washes_cash_total'],
                'card_total' => $totals['car_washes_card_total'],
            ],
            'payments_by_method' => $totals['payments_by_method']->map(function ($item) {
                return [
                    'method' => $item['method'],
                    'method_text' => match($item['method']) {
                        'CASH' => 'Efectivo',
                        'CARD' => 'Tarjeta',
                        'WEBPAY' => 'Webpay',
                        'TRANSFER' => 'Transferencia',
                        default => $item['method'],
                    },
                    'collected' => $item['collected'],
                    'count' => $item['count'],
                ];
            }),
            'recent_payments' => $payments->map(function ($payment) {
                return [
                    'id' => $payment->id,
                    'amount' => (float) $payment->amount,
                    'method' => $payment->method,
                    'method_text' => $payment->getPaymentMethodText(),
                    'paid_at' => $payment->paid_at?->setTimezone('America/Santiago')->format('Y-m-d H:i:s'),
                    'sale_id' => $payment->sale_id,
                    'session_id' => $payment->session_id,
                ];
            }),
            'car_washes' => $carWashes->map(function ($carWash) {
                return [
                    'id' => $carWash->id,
                    'plate' => $carWash->plate,
                    'wash_type' => $carWash->carWashType ? [
                        'id' => $carWash->carWashType->id,
                        'name' => $carWash->carWashType->name,
                    ] : null,
                    'amount' => (float) $carWash->amount,
                    'payment_method' => $carWash->approval_code ? 'CARD' : 'CASH',
                    'approval_code' => $carWash->approval_code,
                    'paid_at' => $carWash->paid_at?->setTimezone('America/Santiago')->format('Y-m-d H:i:s'),
                    'performed_at' => $carWash->performed_at?->setTimezone('America/Santiago')->format('Y-m-d H:i:s'),
                    'cashier_operator' => $carWash->cashierOperator ? [
                        'id' => $carWash->cashierOperator->id,
                        'name' => $carWash->cashierOperator->name,
                    ] : null,
                ];
            }),
            'cash_adjustments' => $adjustments->map(function ($adjustment) {
                return [
                    'id' => $adjustment->id,
                    'type' => $adjustment->type,
                    'type_text' => $adjustment->getTypeText(),
                    'amount' => (float) $adjustment->amount,
                    'reason' => $adjustment->reason,
                    'receipt_number' => $adjustment->receipt_number,
                    'at' => $adjustment->at?->setTimezone('America/Santiago')->format('Y-m-d H:i:s'),
                    'actor' => $adjustment->actor ? [
                        'id' => $adjustment->actor->id,
                        'name' => $adjustment->actor->name,
                    ] : null,
                    'approver' => $adjustment->approver ? [
                        'id' => $adjustment->approver->id,
                        'name' => $adjustment->approver->name,
                    ] : null,
                ];
            }),
            'created_by' => $shift->creator ? [
                'id' => $shift->creator->id,
                'name' => $shift->creator->name,
            ] : null,
            'closed_by' => $shift->closer ? [
                'id' => $shift->closer->id,
                'name' => $shift->closer->name,
            ] : null,
            'generated_at' => now()->setTimezone('America/Santiago')->format('Y-m-d H:i:s'),
        ];

        switch ($format) {
            case 'pdf':
                return $this->generatePdf($shift, $reportData);
            case 'xlsx':
            case 'excel':
                return $this->generateExcel($shift, $reportData);
            case 'json':
            default:
                return response()->json([
                    'success' => true,
                    'data' => $reportData
                ]);
        }
    }

    /**
     * Generar reporte en PDF
     */
    private function generatePdf(Shift $shift, array $data): \Illuminate\Http\Response
    {
        $pdf = Pdf::loadView('reports.shift', ['data' => $data]);
        $filename = 'reporte-turno-' . substr($shift->id, 0, 8) . '-' . now()->format('Y-m-d') . '.pdf';
        return $pdf->download($filename);
    }

    /**
     * Generar reporte en Excel
     */
    private function generateExcel(Shift $shift, array $data): \Illuminate\Http\Response
    {
        // Por ahora retornamos JSON, pero se puede implementar con maatwebsite/excel
        // TODO: Implementar generación de Excel
        return response()->json([
            'success' => true,
            'message' => 'Generación de Excel pendiente de implementar',
            'data' => $data
        ]);
    }
}

