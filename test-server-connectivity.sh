#!/bin/bash

# Script para probar la conectividad del servidor STPark
# Uso: ./test-server-connectivity.sh

echo "=== PRUEBA DE CONECTIVIDAD STPARK ==="
echo "Fecha: $(date)"
echo ""

# URL del servidor
SERVER_URL="https://api.stpark.cl/parking"

echo "1. Probando conectividad básica..."
if ping -c 3 api.stpark.cl > /dev/null 2>&1; then
    echo "✅ Ping exitoso a api.stpark.cl"
else
    echo "❌ Ping fallido a api.stpark.cl"
fi

echo ""
echo "2. Probando conectividad HTTPS..."
if curl -s --connect-timeout 10 --max-time 30 "$SERVER_URL" > /dev/null; then
    echo "✅ Conexión HTTPS exitosa"
else
    echo "❌ Conexión HTTPS fallida"
fi

echo ""
echo "3. Probando endpoint de operadores..."
OPERATORS_URL="$SERVER_URL/operators/all"
echo "URL: $OPERATORS_URL"

response=$(curl -s --connect-timeout 10 --max-time 30 -w "%{http_code}" "$OPERATORS_URL")
http_code="${response: -3}"
response_body="${response%???}"

echo "Código HTTP: $http_code"

if [ "$http_code" = "200" ]; then
    echo "✅ Endpoint de operadores responde correctamente"
    echo "Respuesta: $response_body"
elif [ "$http_code" = "000" ]; then
    echo "❌ Error de conexión (posible problema de red o DNS)"
elif [ "$http_code" = "404" ]; then
    echo "❌ Endpoint no encontrado (404)"
elif [ "$http_code" = "500" ]; then
    echo "❌ Error interno del servidor (500)"
else
    echo "❌ Error HTTP: $http_code"
fi

echo ""
echo "4. Verificando certificado SSL..."
if openssl s_client -connect api.stpark.cl:443 -servername api.stpark.cl < /dev/null 2>/dev/null | grep -q "Verify return code: 0"; then
    echo "✅ Certificado SSL válido"
else
    echo "❌ Problema con certificado SSL"
fi

echo ""
echo "=== FIN DE PRUEBAS ==="
