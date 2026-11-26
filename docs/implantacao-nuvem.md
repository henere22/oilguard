# Preparação para implantação na nuvem

O desenho proposto usa um serviço Web Express com os arquivos estáticos do React na mesma origem. Windows, Android e ESP32 usam a API HTTPS desse serviço. O PostgreSQL fica na rede privada do provedor. A implantação depende de aprovação do proprietário do projeto.

## Render e Railway

| Critério | Render | Railway |
|---|---|---|
| Custo de entrada | Serviço web pago a partir de US$ 7/mês e PostgreSQL pago a partir de US$ 6/mês, mais armazenamento. | Hobby com mínimo de US$ 5/mês creditado ao consumo. O custo varia com CPU, RAM, volumes e tráfego. |
| PostgreSQL e persistência | PostgreSQL gerenciado, armazenamento expansível, rede privada e pool na plataforma. O banco gratuito expira após 30 dias. | PostgreSQL em volume persistente. A configuração inicial tem um nó. A plataforma oferece conversão para alta disponibilidade e pool. |
| Backups e disponibilidade | Planos pagos oferecem recuperação pontual. A janela documentada é de 3 dias no workspace Hobby e 7 dias em Pro ou superior. Confirme opções de alta disponibilidade para o plano escolhido. | Oferece backups do volume e recuperação pontual em bucket. A alta disponibilidade usa failover automático e exige infraestrutura adicional. |
| Implantação e expansão | Serviço web e banco no mesmo projeto. Planos de compute e armazenamento podem crescer conforme a carga. | Serviço e banco no mesmo projeto, com variáveis de referência e rede privada. O orçamento depende do consumo e dos recursos de operação ativados. |

Render tem custo inicial mais previsível para um serviço persistente. Railway permite começar pelo consumo e ajustar disponibilidade e backups por recurso. Confirme preços, região, requisitos de disponibilidade e retenção antes de aprovar a contratação.

Fontes oficiais de custos e documentação. [Render Pricing](https://render.com/pricing), [Render Backups](https://render.com/docs/postgresql-backups), [Render Free](https://render.com/docs/free), [Railway Pricing](https://docs.railway.com/pricing), [Railway PostgreSQL](https://docs.railway.com/databases/postgresql), [Railway Backups](https://docs.railway.com/volumes/backups), [Railway PITR](https://docs.railway.com/volumes/point-in-time-recovery).

## Configuração do serviço

- Build na raiz com `npm ci && npm run build` e inicialização com `npm start`. Configure o health check em `/api/health`.
- Use `NODE_ENV=production`, `DATA_MODE=operational`, `SERVE_WEB=true`, `HOST=0.0.0.0` e `PUBLIC_ORIGIN=https://<domínio>`. Use a porta injetada pelo provedor.
- Configure `TRUST_PROXY_HOPS` exatamente conforme a topologia validada. Restrinja o acesso à porta do Express ao proxy. O proxy deve sobrescrever `X-Forwarded-For` e `X-Forwarded-Proto`. O Express exige HTTPS em produção e usa esses cabeçalhos somente através do proxy configurado.
- Injete `DATABASE_URL` da rede privada e `INGEST_TOKEN` aleatório com pelo menos 32 caracteres. Se a conexão do banco sair da rede privada, configure TLS com verificação de certificado e hostname. Use `CORS_ORIGINS` só para origens adicionais conhecidas. O website usa a mesma origem da API.
- Defina `VITE_API_URL` como a origem HTTPS em cada build nativo. O navegador usa `/api` na origem do website. O Tauri permite conexões HTTPS pela CSP. No Android, mantenha cleartext e conteúdo misto desativados.
- Com um banco operacional novo, rode as migrações e inicialize o administrador principal em um terminal autorizado. Use um banco separado para testes. O importador preserva o histórico legado desta estação em modo simulação.

A API usa sessões compartilhadas via PostgreSQL e o limite de login também é compartilhado. O limite geral é por processo. Ao escalar réplicas, aplique um limite global no proxy ou no serviço de borda. No Windows e Android, os tokens ficam na memória da WebView. A opção de manter login após reiniciar exigiria integrar e validar o armazenamento protegido de cada plataforma, como Windows Credential Manager e Android Keystore.

## Backup e recuperação

Antes de aplicar novas migrations em ambiente publicado, crie um ponto de recuperação. Configure backups gerenciados e mantenha um dump protegido fora da instância, com acesso restrito a quem administra o banco. O dump inclui hashes de senhas e sessões.

Exporte com `pg_dump --format=custom --file=oilguard.dump`, usando as variáveis de conexão do PostgreSQL. Teste o restore em banco isolado com `pg_restore --no-owner --dbname=<banco_de_teste> oilguard.dump`. Compare contagens, chaves estrangeiras, migrações e a resposta de `/api/health` antes de apontar a aplicação restaurada para o destino. Se o restore vier de uma cópia com sessões antigas, revogue as sessões restauradas antes de liberar o acesso. Defina periodicidade e retenção de acordo com o objetivo de recuperação do projeto.

## Integração industrial

A credencial de ingestão é separada das contas pessoais. O ESP32 enviará as leituras via HTTPS com `X-Ingest-Token`. O mapa de registradores, a unidade, a conversão e a frequência dependem da especificação da mecatrônica.

