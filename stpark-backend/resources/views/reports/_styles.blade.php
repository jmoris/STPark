<style>
    @page { margin: 15mm; }

    /* -----------------------------
     * Typography system (shared)
     * ----------------------------- */
    body {
        font-family: 'DejaVu Sans', sans-serif;
        font-size: 9pt;
        color: #333;
        line-height: 1.35;
    }

    h1 { font-size: 16pt; font-weight: bold; margin: 0; }
    h2 { font-size: 12pt; font-weight: bold; margin: 0; }
    h3 { font-size: 10pt; font-weight: bold; margin: 0; }

    .small { font-size: 8pt; color: #666; }
    .muted { color: #777; }
    .table-text { font-size: 8.5pt; }

    /* -----------------------------
     * Spacing rhythm / helpers
     * ----------------------------- */
    .section { margin-top: 12pt; }
    .block { margin-bottom: 10pt; }
    .avoid-break { page-break-inside: avoid; }
    .page-break { page-break-before: always; }
    .page-break-after { page-break-after: always; }

    /* -----------------------------
     * Header (compact, consistent)
     * ----------------------------- */
    .header {
        display: table;
        width: 100%;
        margin-bottom: 10pt;
    }
    .header-left {
        display: table-cell;
        width: 60pt;
        vertical-align: top;
    }
    .header-left img {
        max-width: 55pt;
        height: auto;
    }
    .header-right {
        display: table-cell;
        vertical-align: top;
        padding-left: 10pt;
    }
    .header-subtitle {
        margin: 2pt 0 0 0;
        font-size: 8pt;
        color: #666;
    }

    /* -----------------------------
     * Info box
     * ----------------------------- */
    .info-box {
        border: 1pt solid #e0e0e0;
        padding: 10pt;
        margin-bottom: 12pt;
        border-radius: 5pt;
        background: #fff;
    }
    .info-box-content { margin-top: 6pt; }
    .info-row { margin-bottom: 6pt; display: table; width: 100%; }
    .info-row.last { padding-top: 6pt; margin-top: 6pt; margin-bottom: 0; border-top: 1pt solid #e0e0e0; }
    .info-label { display: inline-block; width: 120pt; font-weight: bold; color: #666; font-size: 8pt; }
    .info-value { display: inline-block; color: #333; font-size: 9pt; }

    /* -----------------------------
     * Section titles
     * ----------------------------- */
    .section-title {
        font-size: 11pt;
        font-weight: bold;
        margin: 0 0 6pt 0;
        color: #043476;
    }

    /* -----------------------------
     * KPI cards
     * ----------------------------- */
    .summary-row { width: 100%; display: table; margin-bottom: 10pt; }
    .summary-card {
        background: #fff;
        border: 1pt solid #e0e0e0;
        border-radius: 5pt;
        padding: 10pt;
        text-align: center;
        display: table-cell;
        width: 33%;
        vertical-align: middle;
    }
    .summary-card .number { font-size: 14pt; font-weight: bold; color: #043476; margin-bottom: 3pt; }
    .summary-card .label { font-size: 8pt; color: #666; }

    /* -----------------------------
     * Tables (PDF-friendly)
     * ----------------------------- */
    table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 12pt;
        font-size: 8.5pt;
    }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { page-break-inside: avoid; }
    td, th { page-break-inside: avoid; }

    th {
        background: #043476;
        color: #fff;
        font-size: 8pt;
        padding: 6pt 8pt;
        text-align: left;
        font-weight: bold;
    }
    td {
        padding: 5pt 8pt;
        border-bottom: 1pt solid #e0e0e0;
    }
    tr:nth-child(even) { background: #f8f9fa; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }

    /* -----------------------------
     * Notices
     * ----------------------------- */
    .notice-warning {
        padding: 8pt;
        border: 1pt solid #f0ad4e;
        background: #fff8e1;
        color: #8a6d3b;
        border-radius: 4pt;
    }

    /* -----------------------------
     * Charts (dompdf-safe)
     * ----------------------------- */
    .chart {
        border: 1pt solid #e0e0e0;
        border-radius: 6pt;
        padding: 10pt;
        margin-bottom: 12pt;
    }
    .chart-row { display: table; width: 100%; margin: 2pt 0; page-break-inside: avoid; }
    .chart-label { display: table-cell; width: 34pt; font-size: 8pt; color:#666; vertical-align: middle; }
    .chart-bar-cell { display: table-cell; width: auto; vertical-align: middle; padding: 0 6pt; }
    .chart-bar-bg { background:#f3f4f6; height: 10pt; border-radius: 6pt; }
    .chart-bar { background:#043476; height: 10pt; border-radius: 6pt; }
    .chart-bar.peak { background:#10B981; }
    .chart-value { display: table-cell; width: 78pt; font-size: 8pt; text-align: right; vertical-align: middle; color:#111; }

    /* -----------------------------
     * Badges (status)
     * ----------------------------- */
    .badge {
        padding: 3pt 7pt;
        border-radius: 4pt;
        font-size: 8pt;
        font-weight: bold;
        display: inline-block;
    }
    .badge-pending { background: #fff3cd; color: #856404; }
    .badge-settled { background: #d4edda; color: #155724; }
    .badge-cancelled { background: #f8d7da; color: #721c24; }

    /* -----------------------------
     * Footer (visible)
     * ----------------------------- */
    .footer {
        margin-top: 12pt;
        padding-top: 8pt;
        border-top: 1pt solid #e0e0e0;
        text-align: center;
        font-size: 8pt;
        color: #777;
    }
</style>
