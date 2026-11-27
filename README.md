# OILGUARD

Monitoramento dos níveis de óleo limpo e usado em dois compartimentos. O sistema apresenta o nível atual, o histórico de leituras, alertas, relatórios e estimativas por tendência.

O navegador e os apps para Windows e Android usam a mesma API e o mesmo banco PostgreSQL.

## Baixar os aplicativos

| Plataforma | Arquivo |
| --- | --- |
| Windows 64 bits | [OILGUARD-Windows-x64-0.1.1.msi](https://github.com/henere22/oilguard/releases/download/v0.1.1/OILGUARD-Windows-x64-0.1.1.msi) |
| Android 7 ou superior | [OILGUARD-Android-1.1.apk](https://github.com/henere22/oilguard/releases/download/v0.1.1/OILGUARD-Android-1.1.apk) |

Os dois aplicativos usam a API hospedada e exigem uma conta do OILGUARD. O APK tem assinatura de teste. Consulte a [release v0.1.1](https://github.com/henere22/oilguard/releases/tag/v0.1.1) para ver as notas da versão.

## Modo de simulação

**A geração de leituras começa pausada em um banco novo.** A faixa de ambiente de simulação no painel indica o tipo de dado exibido. Para gerar novas leituras, o ambiente precisa estar com `DATA_MODE=simulation` e `SIMULATOR_ENABLED=true` na API e no Worker. O Worker é um processo separado que grava as leituras.

Com o Worker em execução, entre na interface **Web** como administrador e escolha **Configurações → Simulador Interno → Ativar**. Você pode escolher o cenário e o intervalo na mesma tela. Depois de ativada, a simulação segue enquanto o Worker estiver em execução, mesmo com os aplicativos fechados. O estado fica no PostgreSQL e é retomado se o Worker voltar. Use **Pausar** na interface Web para parar a geração.

Para rodar o Worker localmente, execute `npm run worker` em outro terminal. A API e o Worker devem usar o mesmo `DATABASE_URL`. Para configurar o serviço hospedado, consulte o [guia de implantação](docs/implantacao-nuvem.md).

## Desenvolvimento local

Use Node.js 24 e PostgreSQL 17. A configuração do Docker Compose disponibiliza um banco local. Se já tiver PostgreSQL, use a conexão da sua instância em `DATABASE_URL`.

1. Instale as dependências com `npm ci`.
2. Para usar o banco do Compose, defina `POSTGRES_PASSWORD` no ambiente ou em um `.env` na raiz e rode `docker compose up -d --wait postgres`.
3. Crie `apps/api/.env` a partir de [`apps/api/.env.example`](apps/api/.env.example) e preencha `DATABASE_URL`. No Compose, os padrões são `127.0.0.1:5432`, usuário `oilguard` e banco `oilguard`. Use a senha definida no passo anterior.
4. Rode `npm run db:migrate` e crie a conta principal conforme a seção abaixo.
5. Rode `npm run dev` e abra [localhost:5173](http://localhost:5173). A API responde em [127.0.0.1:3333/api/health](http://127.0.0.1:3333/api/health).

<details>
<summary>Conta principal e recuperação</summary>

Após configurar o banco, execute uma vez no host da API:

```powershell
$env:ADMIN_USERNAME = Read-Host 'Usuário do administrador'
$env:ADMIN_NAME = Read-Host 'Nome do administrador'
$secret = Read-Host 'Senha (12 a 128 caracteres)' -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $secret).Password
try { npm run admin:bootstrap } finally {
  Remove-Item Env:ADMIN_PASSWORD
  $secret.Dispose()
}
```

Em **Configurações → Usuários**, o administrador pode cadastrar operadores, gerenciar acessos e emitir códigos de recuperação. O código expira em 30 minutos e deve ser compartilhado por um canal privado. Para recuperar a conta principal, execute `npm run admin:recover` no host da API e use o código em **Usar código de recuperação**, na tela de login.

</details>

<details>
<summary>Importação de dados do SQLite</summary>

Pare os processos que gravam no SQLite. Em um PostgreSQL de simulação sem leituras, execute `npm run db:import` antes de gravar novas leituras. O caminho padrão é `apps/api/data/oilguard.sqlite`. Para usar outro arquivo, execute `npm run db:import -- <caminho-absoluto>`. O importador lê a origem em modo somente leitura, preserva IDs e reverte a importação em caso de divergência. Guarde o arquivo original até conferir o backup PostgreSQL.

</details>

## Compilação e testes

| Plataforma | Comando ou procedimento |
| --- | --- |
| Windows | Defina `VITE_API_URL` em `apps/client/.env.desktop` e rode `npm run build:desktop`. O build usa Tauri, Rust MSVC e Build Tools C++. O aplicativo usa WebView2. |
| Android | Defina `VITE_API_URL` em `apps/client/.env.android`, rode `npm run android:sync` e abra o projeto com `npm run android:open` para gerar o APK. Use HTTPS para distribuição. |
| Web | Rode `npm run build`. Para servir a interface na mesma origem da API, defina `SERVE_WEB=true` e rode `npm start`. |

```powershell
npm test
npm run typecheck
npm run build
```

Para os testes de integração, defina `TEST_DATABASE_URL` com um PostgreSQL de teste que permita criar schemas e rode `npm run test:postgres`. A suíte usa um schema temporário.

## Documentação

- [Arquitetura](docs/arquitetura.md)
- [Contrato da API de leituras](docs/contrato-de-dados.md)
- [Implantação no Northflank](docs/implantacao-nuvem.md)

Os limites de atenção e crítico são provisórios. Use um banco separado para o modo operacional, com `DATA_MODE=operational`. Quando a frequência de leitura for confirmada, configure `EXPECTED_READING_INTERVAL_SECONDS` para avaliar a cobertura nos relatórios.
