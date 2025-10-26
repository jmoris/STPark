<?php

return [
    'paths' => ['api/*', 'parking/*', 'auth/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [
        'https://panel.stpark.cl',
        'http://localhost:4200',
        'http://localhost:8081',
    ],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => ['Authorization', 'X-Tenant'],
    'max_age' => 86400,
    'supports_credentials' => true,
];
