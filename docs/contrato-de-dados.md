# Contrato de dados ESP32 → API

Endpoint: `POST /api/v1/readings`

Content-Type: `application/json`

Use HTTPS no ambiente publicado e envie a credencial de dispositivo em `X-Ingest-Token`. A credencial é configurada como `INGEST_TOKEN` na API. O Worker grava no banco de simulação e identifica essas leituras com `deviceId: "simulator-worker"`.

## Payload

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `tankId` | string | Sim | `oil-clean-01` ou `oil-used-01` |
| `levelPercent` | number | Sim | Nível convertido em porcentagem entre 0 e 100 |
| `measuredAt` | string ISO 8601 | Não | Momento em que a leitura foi feita; se omitido, a API usa o horário de recebimento |
| `deviceId` | string | Não | Identificador do ESP32 |

## Exemplo

```json
{
  "tankId": "oil-used-01",
  "levelPercent": 78.2,
  "measuredAt": "2026-11-16T14:30:00.000Z",
  "deviceId": "esp32-oilguard-01"
}
```

A equipe de mecatrônica ainda precisa confirmar escala, registradores, unidade física original, precisão e frequência de amostragem. A conversão de valor bruto Modbus para porcentagem precisa ser documentada antes da integração real.

A API responde com HTTP 201 e registra o horário de recebimento. Quando chegam fora de ordem, as medições são preservadas no histórico. O nível corrente segue a medição de horário mais recente.
