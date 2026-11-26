# Implantação do OILGUARD na Northflank

A configuração usa dois serviços contínuos e um PostgreSQL 17 privado. O serviço **API + Website** serve o React compilado e os endpoints autenticados na mesma origem HTTPS. O **Worker** grava leituras simuladas no PostgreSQL e opera em segundo plano após autorização do administrador. Windows e Android acessam a mesma API por HTTPS.

## Recursos do Developer Sandbox

| Recurso | Configuração prevista |
|---|---|
| Projeto | 1 projeto em Northflank Cloud |
| PostgreSQL | 1 addon PostgreSQL 17, instância única, TLS e acesso interno |
| Serviços | 2 serviços contínuos, cada um com 1 instância |
| Rede | 1 porta pública HTTP/HTTPS na API com domínio `.code.run`; Worker e banco privados |
| Variáveis | 1 Secret Group compartilhado para a conexão interna; configurações específicas por serviço |

A Northflank informa até US$ 20/mês em recursos no Sandbox gratuito, com cotas de dois serviços, dois jobs e um banco. O OILGUARD usa zero jobs. As opções de compute, build, armazenamento e disponibilidade dependem da conta e região. Escolha somente opções cobertas pelo Sandbox e confirme no painel de custo com a configuração completa antes de criar recursos. Se o plano gratuito não cobrir o PostgreSQL 17, os dois processos contínuos ou seus builds, interrompa a configuração e confirme com o proprietário. Mantenha uma instância por serviço e use somente a rede gerenciada e o armazenamento do addon. [Preços e cotas](https://northflank.com/pricing) · [Planos de compute](https://northflank.com/docs/v1/application/billing/resource-plans-and-quotas)

O Sandbox é destinado a demonstração e testes. O primeiro banco pode ser de simulação. Uma eventual operação real requer um banco inicializado em modo operacional, com escopo e ambiente aprovados. [Guia do Developer Sandbox](https://northflank.com/docs/v1/application/billing/pricing-on-northflank)

## Executar e testar com Docker local

O `Dockerfile` na raiz oferece os targets `api` e `worker`. Ambos usam Node.js 24 e compartilham as dependências de runtime do workspace `@oilguard/api`. Somente o target `api` compila e inclui o site. A etapa de runtime exclui a dependência opcional do importador SQLite. O `.dockerignore` limita o contexto a arquivos usados pelas imagens e exclui segredos, dados locais e builds anteriores.

```powershell
docker build --target api -t oilguard-api:local .
docker build --target worker -t oilguard-worker:local .
```

Para testar os processos junto de um PostgreSQL isolado, combine `compose.yaml` e `compose.containers.yaml`. No PowerShell, configure uma senha aleatória para o volume de teste. Reutilize a mesma senha quando reaproveitar esse volume.

```powershell
$env:POSTGRES_PASSWORD = node -e "process.stdout.write(require('node:crypto').randomBytes(24).toString('hex'))"
$env:POSTGRES_PORT = '55433'
$env:DATABASE_URL = 'postgresql://oilguard:' + $env:POSTGRES_PASSWORD + '@postgres:5432/oilguard'
$env:DATA_MODE = 'simulation'
$env:SIMULATOR_ENABLED = 'true'

$oilguardCompose = @('-p', 'oilguard-container-check', '-f', 'compose.yaml', '-f', 'compose.containers.yaml')
docker compose @oilguardCompose config --quiet
docker compose @oilguardCompose up -d --build --wait postgres api
curl.exe --fail http://localhost:3337/healthz
curl.exe --fail http://localhost:3337/api/health
docker compose @oilguardCompose up -d --build --wait worker
docker compose @oilguardCompose ps
```

Abra `http://localhost:3337` para o site. Para inicializar a conta, use `docker compose @oilguardCompose exec api sh` e o procedimento abaixo. Ative a simulação em **Configurações → Simulador Interno**, feche a tela e confirme que o contador avançou ao voltar. Para testar independência, pare apenas a API com `docker compose @oilguardCompose stop api`. O contador continuará avançando no PostgreSQL. Use `docker compose @oilguardCompose start api` para verificar. Pause o cenário no final. O Compose local aceita HTTP na interface de loopback para facilitar testes. A configuração publicada usa HTTPS.

## Configurar na Northflank após autorização

1. Crie um projeto Northflank Cloud no Developer Sandbox. No projeto, configure um addon **PostgreSQL 17** com TLS, rede privada, instância única e a opção de armazenamento coberta pela conta. Aplique a configuração depois de verificar as cotas. [PostgreSQL na Northflank](https://northflank.com/docs/v1/application/databases-and-persistence/deploy-databases-on-northflank/deploy-postgresql-on-northflank)
2. Crie um **Secret Group** de runtime, restrito aos dois serviços. Em **Linked addons**, vincule o PostgreSQL e mapeie **POSTGRES_URI → DATABASE_URL** usando a URI interna. Habilite verificação de hostname e certificado com `sslmode=verify-full` na URI efetiva ou com `PGSSLMODE=verify-full` quando a URI não tiver opção SSL. As imagens incluem certificados raiz. Confirme a URI e a cadeia TLS com os detalhes do addon. [Vincular segredos](https://northflank.com/docs/v1/application/databases-and-persistence/connect-database-secrets-to-workloads) · [TLS do addon](https://northflank.com/docs/v1/application/databases-and-persistence/access-a-database) · [TLS no node-postgres](https://node-postgres.com/features/ssl)
3. Quando o repositório privado estiver autorizado, crie dois serviços do tipo **Combined** na branch `feature/postgresql-auth-cloud`. Use o mesmo Dockerfile e contexto raiz. Se o fluxo autorizado for por imagens privadas, use dois serviços do tipo **Deployment**, cada um apontando para a imagem do target correspondente. Preserve o comando do Dockerfile. [Serviços combinados](https://northflank.com/docs/v1/application/getting-started/build-and-deploy-your-code) · [Dockerfile e target](https://northflank.com/docs/v1/application/build/build-with-a-dockerfile) · [Registro de imagens](https://northflank.com/docs/v1/application/run/run-an-image-from-a-container-registry)

| Serviço | Target e comando | Rede | Health check |
|---|---|---|---|
| `oilguard-api` | `api` · `node apps/api/src/server.js` | Porta pública HTTP `3333`, TLS no ingress | Readiness HTTP GET `/healthz` em `3333` |
| `oilguard-worker` | `worker` · `node apps/api/src/worker.js` | Sem porta pública. Checagem em loopback `3336` | Liveness CMD no container, conforme abaixo |

No serviço da API, use a origem HTTPS exata gerada pela Northflank como `PUBLIC_ORIGIN`, sem barra final. O ingress publica o site e a API na mesma origem e redireciona HTTP para HTTPS. Configure `TRUST_PROXY_HOPS=1` para o ingresso direto previsto. Valide o encaminhamento de HTTPS, a atribuição do IP de origem e a rejeição a cabeçalhos forjados antes de liberar o acesso. Mantenha `CORS_ORIGINS` vazio para usar as origens já previstas do website e dos aplicativos. [Portas e TLS](https://northflank.com/docs/v1/application/network/configure-ports) · [Rede e cabeçalhos](https://northflank.com/docs/v1/application/network/networking-on-northflank)

No serviço Worker, configure o health check do tipo **CMD**. Use atraso inicial de 30 segundos e timeout de 4 segundos como ponto de partida. O endpoint do Worker indica uma consulta recente ao banco. Uma instância em espera pelo lock também fica saudável, o que permite a substituição do container durante uma atualização. [Health checks](https://northflank.com/docs/v1/application/observe/configure-health-checks)

```sh
node -e "fetch('http://127.0.0.1:'+process.env.WORKER_HEALTH_PORT+'/healthz',{signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
```

| Variável | API | Worker |
|---|---|---|
| `DATABASE_URL` | URI interna via Secret Group | Herda a mesma URI |
| `DATA_MODE` | `simulation` para o Sandbox | Mesmo valor da API |
| `SIMULATOR_ENABLED` | `false` por padrão. Use `true` para liberar o painel administrativo em simulação | Mesmo valor da API |
| `PGSSLMODE` | `verify-full` quando a URI não especifica SSL | Mesmo valor da API |
| `NODE_ENV` | `production` na imagem | `production` na imagem |
| `PUBLIC_ORIGIN`, `TRUST_PROXY_HOPS` | Origem HTTPS da API e número de proxies confiáveis | — |
| `PORT`, `HOST`, `SERVE_WEB` | `3333`, `0.0.0.0`, `true` na imagem | — |
| `DB_POOL_MAX` | `5` na imagem | `2` na imagem |
| `WORKER_HEALTH_PORT` | — | `3336` na imagem |
| `INGEST_TOKEN` | Segredo aleatório de pelo menos 32 caracteres para ingestão por dispositivo em modo operacional | — |

O dashboard e os CSVs exibem o modo de dados. Leituras do Worker levam `deviceId=simulator-worker`, e o modo operacional veta leituras de simulação. O Worker fica em espera operacional quando desabilitado. Mantenha `SIMULATOR_ENABLED` em runtime nos dois serviços, de preferência no mesmo Secret Group. Mesmo com esse sinalizador ativo em um banco novo, o administrador precisa iniciar o cenário.

### Primeira conta administrativa

Os dois processos podem aplicar as migrações no início. Um advisory lock serializa esse trabalho. Use um shell interativo do **container da API** para inicializar a conta. O procedimento usa variáveis temporárias e evita colocar a senha na linha de comando. [Shell dos containers](https://northflank.com/docs/v1/application/run/access-running-containers-locally)

```sh
(
  trap 'stty echo' EXIT
  trap 'exit 130' INT TERM
  printf 'Usuário: '; IFS= read -r ADMIN_USERNAME
  printf 'Nome: '; IFS= read -r ADMIN_NAME
  printf 'Senha (12 a 128 caracteres): '; stty -echo
  IFS= read -r ADMIN_PASSWORD
  stty echo; printf '\n'
  export ADMIN_USERNAME ADMIN_NAME ADMIN_PASSWORD
  node apps/api/src/admin-cli.js bootstrap
)
```

Após validar login, permissões e health checks, use a origem HTTPS da API como `VITE_API_URL` nos builds Windows e Android. O website acessa `/api` na própria origem.

## Infraestrutura como código

A Northflank oferece templates oficiais em JSON, com o schema `https://api.northflank.com/v1/schemas/template`. Eles representam serviços, addons e Secret Groups. O primeiro deploy está documentado via painel, pois as opções efetivas do Sandbox, o repositório privado e a origem HTTPS ainda dependem da conta e da aprovação. Depois de aprovar e validar esses recursos, exporte o spec pelo painel para versionamento, mantendo os valores secretos nos Secret Groups. [Templates oficiais](https://northflank.com/docs/v1/application/infrastructure-as-code/infrastructure-as-code) · [Schema e exportação](https://northflank.com/docs/v1/application/infrastructure-as-code/create-a-template)

## Dados e publicação

Use um banco novo de demonstração no primeiro deploy. Qualquer envio do histórico SQLite original ou de um dump PostgreSQL exige autorização específica. Para preservar dados em futuras atualizações, mantenha um dump protegido fora do container e valide a restauração em ambiente local isolado. Antes de restaurar um banco de demonstração, pause a simulação e avalie a revogação das sessões restauradas. O Worker pode retomar uma execução autorizada encontrada no estado persistido.

Antes de publicar, confirme a autorização para o push privado e criação dos três recursos, a cobertura do Sandbox, o build dos targets em Linux e as checagens de HTTPS e TLS na plataforma. A integração industrial também depende do contrato da mecatrônica e de um ambiente operacional separado.

