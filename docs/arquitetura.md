# Arquitetura do OILGUARD

```text
Sensores → CLP → Modbus RTU / RS-485 → ESP32
                                        │ HTTPS / JSON
                                        ▼
 React Web ── HTTPS ───────────► Node.js / Express ◄── HTTPS ── Windows (Tauri 2)
                                ▲        │
      Android (Capacitor 8) ────┘        ▼
                                     PostgreSQL
```

A API Express valida leituras, aplica limites, administra contas e oferece os mesmos endpoints ao navegador, Windows e Android. O PostgreSQL é o único banco usado em execução. A integração Modbus será realizada no ESP32 pela equipe de mecatrônica.

## Banco e migrações

| Tabela | Dados e relacionamentos |
|---|---|
| `tanks` | Dois compartimentos, limites, nível e data de recebimento da última leitura atual. |
| `readings` | Medição, recebimento, dispositivo e referência ao compartimento. |
| `alerts` | Severidade, abertura e resolução, com referência ao compartimento. Um alerta ativo por compartimento. |
| `report_snapshots` | Versão mais recente gerada de cada relatório diário ou por período. |
| `users` | Conta individual, perfil, estado da conta e hash Argon2id. Um administrador principal por banco. |
| `user_sessions` | Hash do token, expiração e revogação, vinculados ao usuário. |
| `password_recovery_tokens` | Códigos de uso único em hash, vinculados ao usuário. |
| `audit_logs` | Ação, data, autor e usuário afetado, quando aplicáveis. |
| `login_limits` | Contadores temporários compartilhados para tentativas de login e recuperação. |
| `system_settings`, `schema_migrations`, `legacy_imports` | Identificação do modo, versões aplicadas e histórico de importação conferida. |

Leituras e mudanças de configuração atualizam o nível e os alertas dentro de transações. Leituras antigas recebidas fora de ordem entram no histórico sem substituir o nível corrente. A API monta o histórico operacional a partir de leituras e alertas persistidos. Relatórios e previsões são calculados sob demanda a partir dessas tabelas. Os relatórios agrupam o calendário por dia UTC e a versão mais recente gerada de cada intervalo é registrada no PostgreSQL.

O SQLite original continha `tanks`, `readings`, `alerts` e a sequência interna para IDs. A migração preserva nomes, chaves, valores e tempos, incluindo IDs de registros excluídos da sequência. Datas de texto passaram a `timestamptz` e alertas ativos foram convertidos de 0/1 para booleano.

Cada PostgreSQL tem modo fixado na primeira inicialização. O modo simulação contém apenas dados de demonstração/teste, incluindo o legado desta estação. O modo operacional usa ingestão por credencial própria e um banco independente.

## Controle de acesso

Navegadores usam sessão por cookie protegido na mesma origem. Aplicativos nativos usam bearer opaco por sessão. Operadores consultam dados e relatórios. Administradores podem ajustar limites e gerir as contas que seu perfil permite. O administrador principal pode atribuir e gerenciar outros administradores e é protegido de alterações pela aplicação.

Os limites iniciais são provisórios. Óleo limpo entra em Atenção em 30% e em Crítico em 15%. Óleo usado entra em Atenção em 70% e em Crítico em 85%. Capacidades, escala do sensor, registradores e frequência esperada dependem de confirmação da mecatrônica. Consulte o [contrato de dados](contrato-de-dados.md) e a [preparação para nuvem](implantacao-nuvem.md).

