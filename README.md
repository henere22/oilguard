# OILGUARD

OILGUARD acompanha o nível de óleo limpo e usado em dois compartimentos. A mesma interface React atende navegador, Windows (Tauri 2) e Android (Capacitor 8). O Express atende os três clientes e armazena usuários, sessões, parâmetros e dados de monitoramento no PostgreSQL.

## Downloads

Os instaladores de demonstração para Windows 64 bits e Android 7 ou superior estão na [release v0.1.1](https://github.com/henere22/oilguard/releases/tag/v0.1.1). O Windows usa um instalador MSI. O APK Android tem assinatura de teste.

Os aplicativos se conectam à API hospedada e pedem uma conta do OILGUARD.

## Desenvolvimento local

Use Node.js 24 LTS e PostgreSQL 17. O arquivo `compose.yaml` oferece PostgreSQL com volume persistente e porta restrita ao computador local. Use um servidor PostgreSQL já instalado se preferir. O [guia Northflank](docs/implantacao-nuvem.md) inclui comandos para testar as duas imagens localmente.

1. Instale as dependências com `npm install`.
2. Defina `POSTGRES_PASSWORD` na sessão do PowerShell ou em um `.env` na raiz. Inicie o banco com `docker compose up -d --wait postgres`.
3. Crie `apps/api/.env` a partir de `apps/api/.env.example`, se ele ainda não existir. Configure `DATABASE_URL`. Com o PostgreSQL do Compose e os processos executados direto no computador, os padrões são `127.0.0.1:5432`, usuário `oilguard` e banco `oilguard`. Use a mesma senha configurada no Compose.
4. Execute `npm run db:migrate`. Para importar o legado, siga o procedimento abaixo antes de gravar novas leituras.
5. Crie a conta principal com o procedimento abaixo. Execute `npm run dev` e abra `http://localhost:5173`. A API responde em `http://127.0.0.1:3333/api/health`.

Nesta estação Windows, a instância portátil usada na migração está configurada em `127.0.0.1:55432`. Se estiver parada, inicie em um terminal dedicado, na raiz do projeto:

```powershell
& '.\.oilguard-local\postgres\pgsql\bin\postgres.exe' -D .oilguard-local/pgdata -h 127.0.0.1 -p 55432
```

A pasta `.oilguard-local` é ignorada pelo versionamento. O Compose serve como alternativa reproduzível em outras estações.

Nesta estação, a API PostgreSQL usa a porta `3335` porque a `3333` já está ocupada. O proxy do Vite e o endereço nativo de desenvolvimento foram configurados nos arquivos locais ignorados.

## Migração do SQLite

Pare os processos que escrevem no SQLite para fixar o ponto de corte. Em um PostgreSQL de simulação sem leituras, execute `npm run db:import`. A origem padrão é `apps/api/data/oilguard.sqlite`. Para outra origem, passe o caminho absoluto depois de `--`.

O importador abre a origem em modo somente leitura e gera uma cópia consistente, incluindo dados confirmados presentes no WAL. Verifica integridade e referências, preserva IDs, campos e sequência, e compara cada linha no PostgreSQL dentro da transação de importação. Se houver divergência, a transação é revertida. O registro em `legacy_imports` identifica a cópia conferida. Preserve o original e a cópia até verificar o backup PostgreSQL. `better-sqlite3` é uma dependência opcional concentrada no importador.

A base legada desta estação contém 2 compartimentos, 585 leituras de demonstração/teste e 22 alertas. Para operação, crie um banco separado com `DATA_MODE=operational`. O modo é registrado no banco e verificado nas inicializações seguintes.

## Conta principal e recuperação

Em um terminal autorizado no host da API, após configurar o banco:

```powershell
$env:ADMIN_USERNAME = Read-Host 'Usuário do administrador'
$env:ADMIN_NAME = Read-Host 'Nome do administrador'
$oilguardAdminSecret = Read-Host 'Senha (12 a 128 caracteres)' -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $oilguardAdminSecret).Password
try { npm run admin:bootstrap } finally {
  Remove-Item Env:ADMIN_PASSWORD
  $oilguardAdminSecret.Dispose()
}
```

O procedimento é executado uma vez por banco. No aplicativo, use **Configurações → Usuários** para cadastrar operadores, emitir o código inicial de senha, mudar perfis, suspender ou reativar contas e revogar sessões. O código expira em 30 minutos e deve chegar ao usuário por canal privado. Ele é usado na opção **Usar código de recuperação** na tela de login. Para recuperar a conta principal, execute `npm run admin:recover` no host autorizado. O terminal exibe o código uma vez, portanto use uma sessão privada.

O navegador recebe cookie HttpOnly e SameSite=Strict, com Secure em produção. Windows e Android enviam um token opaco mantido na memória do aplicativo e pedem login ao reabrir. As sessões duram até 8 horas e o PostgreSQL armazena apenas os hashes dos tokens. A redefinição de senha, desativação e troca de perfil revogam sessões associadas.

Ao concluir a recuperação da senha, o bloqueio por tentativas da conta é limpo. O limite por IP continua aplicável. Sair da conta limpa o cookie mesmo se a sessão já tiver expirado.

## Simulador

Em `DATA_MODE=simulation`, defina `SIMULATOR_ENABLED=true` em `apps/api/.env` para a API e o Worker. Execute `npm run dev:api` para iniciar só a API ou `npm run dev` para iniciar a API e o Vite. Em outro terminal, execute `npm run worker`. Os dois processos usam o mesmo `DATABASE_URL`. O Worker responde em `http://127.0.0.1:3336/healthz` e o ambiente fica identificado na interface e nos CSVs.

Na interface Web, entre como administrador e use **Configurações → Simulador Interno** para selecionar o cenário e o intervalo, iniciar, pausar ou reiniciar. A simulação começa pausada em um banco novo. Uma execução já autorizada permanece registrada no PostgreSQL e pode continuar quando a interface fecha ou o Worker volta. Pause antes de encerrar a demonstração. A reinicialização zera o contador do cenário e os níveis do simulador. O histórico de leituras é preservado.

## Aplicativos e validação

- **Windows.** Configure `VITE_API_URL` em `apps/client/.env.desktop`. Use `npm run dev:desktop` ou `npm run build:desktop` para o instalador Tauri. O build exige Rust MSVC, Build Tools C++ e WebView2.
- **Android.** Configure `VITE_API_URL` em `apps/client/.env.android`. Execute `npm run android:add` na primeira vez, `npm run android:sync` a cada build e `npm run android:open` para gerar o APK no Android Studio. Para teste por HTTP em LAN confiável, use o IPv4 do PC, configure `HOST=0.0.0.0` na API, libere a porta somente na rede privada e defina `OILGUARD_ANDROID_LOCAL_HTTP=true` antes de sincronizar. Para o APK de produção, use HTTPS e mantenha esse sinalizador desativado.
- **Website.** Execute `npm run build` e sirva o resultado na mesma origem da API com `SERVE_WEB=true` e `npm start`. Para testar a autenticação no site servido diretamente pelo Express em HTTP local, inclua essa origem em `CORS_ORIGINS`.

```powershell
npm test
npm run typecheck
npm run build
# Defina TEST_DATABASE_URL com uma conexão PostgreSQL de teste.
npm run test:postgres
```

O teste PostgreSQL cria um schema temporário, exercita a API HTTP e remove esse schema ao terminar. A conexão de teste precisa de permissão de criar schemas.

## Configuração operacional

Os limites de atenção e crítico são provisórios. Ainda dependem da mecatrônica o mapa Modbus, a escala e conversão, as capacidades, o contrato de leitura e a frequência esperada. O OILGUARD usa leituras para apoiar decisões. A previsão é uma estimativa baseada na tendência recente. Quando houver uma frequência confirmada, configure `EXPECTED_READING_INTERVAL_SECONDS` para a avaliação de cobertura nos relatórios.

Consulte [Arquitetura](docs/arquitetura.md), [Contrato da API de leituras](docs/contrato-de-dados.md) e [Preparação para nuvem](docs/implantacao-nuvem.md).

