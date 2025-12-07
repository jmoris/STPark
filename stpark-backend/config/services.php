<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'banco_central' => [
        'wsdl_url' => env('BANCO_CENTRAL_WSDL_URL', 'https://si3.bcentral.cl/SieteWS/SieteWS.asmx?wsdl'),
        'user' => env('BANCO_CENTRAL_USER'),
        'password' => env('BANCO_CENTRAL_PASSWORD'),
        'uf_series_id' => env('BANCO_CENTRAL_UF_SERIES_ID', 'F073.UFF.PRE.Z.D'),
    ],

];
