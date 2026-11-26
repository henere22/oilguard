# OILGUARD — Instruções de contexto e implementação para Codex

## Decisões de arquitetura atualizadas em 26/11/2026

- PostgreSQL é o banco principal. SQLite é mantido apenas como origem legada para importação. O backend permanece em Node.js + Express.
- Navegador, Windows (Tauri 2) e Android (Capacitor 8) compartilham a API. O ambiente publicado usa HTTPS e depende de aprovação do usuário antes de contratar ou publicar.
- Uma empresa, contas individuais, sem cadastro público. Administrador principal inicializado por CLI, sessões revogáveis, Argon2id e gestão de operadores pelo administrador.
- Desenvolvimento e migração validados localmente primeiro. O histórico legado desta estação é de demonstração/teste e permanece em um PostgreSQL de simulação isolado da operação.
- As seções abaixo documentam a origem do starter. Quando houver divergência sobre persistência, autenticação, plataforma web, rede ou ordem de trabalho, use as decisões desta seção e a [arquitetura atual](docs/arquitetura.md).

> Leia este arquivo antes de alterar o projeto. Ele consolida as decisões mais recentes do usuário. Em caso de conflito, prevalecem as decisões deste arquivo e as instruções mais recentes do usuário, não sugestões antigas do histórico.

## 1. Seu papel

Atue como engenheiro de software responsável por ajudar a implementar o OILGUARD. Trabalhe diretamente sobre o repositório existente, primeiro inspecionando o código e entendendo o que já está pronto. Não descarte nem reescreva a estrutura sem uma justificativa técnica concreta.

O usuário tem formação técnica em Análise e Desenvolvimento de Sistemas e conhece fundamentos de JavaScript, Python e SQL, mas está retomando o desenvolvimento depois de um intervalo. Explique decisões importantes em português brasileiro, com linguagem prática. Prefira código organizado, simples de manter e com comentários apenas onde agregarem contexto.

## 2. Objetivo do produto

O **OILGUARD** é um sistema de monitoramento inteligente de tendências e riscos em dois compartimentos de um reservatório industrial:

1. **Óleo limpo:** acompanhar a redução do nível e estimar quando será necessário repor o óleo.
2. **Óleo usado:** acompanhar o aumento do nível e estimar quando será necessário retirar o óleo, evitando transbordamento.

O sistema deve apresentar os níveis, classificar situações em **Normal**, **Atenção** e **Crítico**, avisar qual compartimento exige atenção, mostrar histórico/gráficos e estimar o tempo até os limites críticos com base na tendência recente.

O foco do protótipo é monitoramento e apoio à decisão. Não implemente comandos para controlar máquinas, bombas ou válvulas. Não apresente previsões como garantias de segurança ou como substitutas de procedimentos operacionais.

## 3. Prazo e escopo

- O usuário informou que há **apenas duas semanas** para concluir o projeto. A referência desta conversa é 16/11/2026, portanto o horizonte de entrega considerado é aproximadamente 30/11/2026.
- O planejamento anterior de três meses está **cancelado e superado**.
- Priorize um MVP demonstrável e confiável. Evite arquitetura distribuída, nuvem, autenticação corporativa, machine learning e funcionalidades que não sejam necessárias à demonstração.
- Construa primeiro com dados simulados; depois conecte o ESP32 real assim que a equipe de mecatrônica fornecer o contrato final de dados.

## 4. Plataformas definitivas

### Dentro do escopo
- **Desktop:** Windows 10/11, aplicativo instalável com Tauri 2.
- **Mobile:** Android, aplicativo instalável em APK com Capacitor 8.

### Fora do escopo
- **iOS:** não desenvolver, não criar projeto iOS, não adicionar `@capacitor/ios`, não exigir Xcode ou Mac. O usuário não possui Mac e decidiu explicitamente retirar iOS do projeto.
- Não entregar apenas uma PWA, atalho de navegador ou site responsivo.

### O que “nativo” significa neste projeto

O requisito do usuário é entregar aplicativos que possam ser instalados e abertos em uma janela própria no Windows e como aplicativo Android, sem depender de abrir o navegador. A arquitetura escolhida é React empacotado por Tauri no Windows e Capacitor no Android. Isso utiliza WebViews do sistema para renderizar a interface; não prometa controles visuais 100% nativos do sistema operacional. O requisito é aplicativo instalável, com aparência e navegação próprias de cada plataforma.

## 5. Arquitetura acordada

```text
Sensores / processo industrial
          |
          v
         CLP
          |  Modbus RTU por RS-485
          v
        ESP32
          |  Wi-Fi 2,4 GHz / HTTP + JSON
          v
  Backend Node.js + Express
          |
          v
       SQLite
          |
          v
        API REST
          |
          +----------------------+
          |                      |
          v                      v
   React + TypeScript      React + TypeScript
      empacotado              empacotado
      com Tauri 2           com Capacitor 8
          |                      |
          v                      v
     Windows 10/11             Android
```

### Stack definida
- Frontend: React + TypeScript + Vite.
- Desktop Windows: Tauri 2.
- Android: Capacitor 8.
- Backend: Node.js + Express.
- Banco de dados inicial: SQLite usando `better-sqlite3`.
- Gráficos: Recharts.
- Ícones: lucide-react.
- Comunicação ESP32 → backend: HTTP POST com JSON pela rede Wi-Fi local.
- Comunicação CLP → ESP32: Modbus RTU por RS-485. A equipe de mecatrônica é responsável por essa camada; o backend não deve tentar conversar diretamente com o CLP.

Não troque a stack sem o usuário solicitar ou sem identificar um bloqueio real. Não acrescente Flutter ao projeto.

## 6. Requisitos funcionais obrigatórios

### 6.1 Compartimentos

Existem **dois compartimentos**, não doze:
- `oil-clean-01`: Óleo limpo.
- `oil-used-01`: Óleo usado.

Não crie tanques adicionais só porque o mockup visual de referência mostra cartões ilustrativos de vários tanques.

### 6.2 Dashboard

Exibir, no mínimo:
- nível atual de óleo limpo;
- nível atual de óleo usado;
- percentual de cada compartimento;
- estado Normal, Atenção ou Crítico;
- identificação clara de qual compartimento precisa de reposição ou retirada;
- última atualização recebida;
- estado de comunicação/dados desatualizados, se a frequência de leitura for definida;
- previsão ou mensagem explicando por que ainda não é possível calcular a previsão.

Não invente temperaturas, economia estimada, métricas de produção, doze tanques ou outros indicadores que não foram especificados no projeto. Capacidades em litros ainda não foram informadas. Só mostrar litros quando a equipe confirmar as capacidades e a conversão correta.

### 6.3 Gráficos e histórico

- Histórico temporal das medições dos dois compartimentos.
- Permitir distinguir as séries de óleo limpo e óleo usado.
- Apresentar período/intervalo de forma simples, sem criar filtros complexos desnecessários ao MVP.
- Mostrar horário da medição e, quando possível, horário em que a API recebeu a leitura.

### 6.4 Alertas visuais e sonoros

- Estados: Normal, Atenção e Crítico.
- Alertas devem identificar o compartimento e explicar a ação esperada: reposição de óleo limpo ou retirada de óleo usado.
- Manter alertas ativos e histórico de alertas resolvidos.
- Evitar criar um novo alerta repetido a cada leitura quando a mesma condição continua ativa.
- Resolver/encerrar o alerta quando a condição normalizar, preservando o histórico.
- Implementar sinalização sonora para atenção/crítico quando viável. Incluir controle de ativar/silenciar som; considerar as restrições de autoplay das WebViews e exigir uma interação inicial do usuário para habilitar o áudio.

### 6.5 Previsões simples por tendência

Não implementar machine learning. Utilizar dados históricos recentes e uma estimativa matemática transparente.

- Óleo limpo: estimar o tempo até o nível alcançar o limite mínimo crítico, quando a tendência estiver diminuindo.
- Óleo usado: estimar o tempo até o nível alcançar o limite máximo crítico, quando a tendência estiver aumentando.
- Pode ser utilizada regressão linear simples sobre leituras recentes ou taxa média por intervalo de tempo.
- Exigir histórico mínimo suficiente e intervalo temporal real entre as leituras.
- Se os dados forem insuficientes, estiverem desatualizados, forem inválidos ou a tendência não estiver caminhando em direção ao limite, não inventar uma estimativa. Mostrar mensagem clara, como “Aguardando histórico suficiente” ou “A tendência recente não indica aproximação do limite”.
- Mostrar taxa estimada e horizonte de tempo com unidade clara.
- Tratar a previsão como estimativa experimental do protótipo, não como garantia operacional.

## 7. Limites e parâmetros: não presumir valores operacionais

O PDF do projeto exige classificação Normal/Atenção/Crítico, mas **não especifica os percentuais exatos dos limites**. O starter atual contém valores provisórios:

| Compartimento | Atenção provisória | Crítico provisório |
|---|---:|---:|
| Óleo limpo | <= 30% | <= 15% |
| Óleo usado | >= 70% | >= 85% |

Esses valores foram inseridos apenas para permitir o desenvolvimento e a simulação. Não foram confirmados pela equipe da Bosch/SENAI nem pela mecatrônica. Mantenha-os centralizados e configuráveis; identifique-os como provisórios no código/documentação. Não os apresente como limites reais nem os use para orientar operação industrial sem confirmação.

Ainda precisam ser confirmados:
- limites de atenção e crítico;
- capacidade dos dois compartimentos;
- unidade medida pelo sensor e escala dos registradores;
- conversão do valor bruto Modbus para porcentagem ou litros;
- frequência de leitura;
- tempo que caracteriza ESP32/sensor offline.

## 8. Comunicação industrial e rede

### CLP → ESP32

- Decisão atual: Modbus RTU por RS-485.
- O ESP32 deverá fazer a leitura dos registradores do CLP. A configuração mestre/escravo mais provável é ESP32 como mestre e CLP como escravo, mas deve ser confirmada com a equipe.
- O ESP32 precisa de transceptor RS-485 compatível com a placa e com os níveis elétricos do equipamento (um módulo da família MAX485 foi citado como exemplo, não como componente já confirmado).
- Não invente marca/modelo do CLP, baud rate, paridade, endereço Modbus, função, registradores ou escala. Solicite essas informações à equipe e mantenha a integração desacoplada até recebê-las.

### ESP32 → backend

- Rede local Wi-Fi 2,4 GHz isolada.
- Roteador discutido: TP-Link TL-WR829N. Foi considerado adequado como roteador de rede local; sua compra/configuração final não deve ser presumida.
- O roteador não participa da comunicação Modbus RTU serial entre CLP e ESP32; ele conecta ESP32, computador do backend e celular à rede IP.
- O backend deve escutar em interface acessível pela LAN (por exemplo `0.0.0.0:3333`), mas o Firewall do Windows deve liberar a porta apenas em rede privada confiável.
- Reservar um IP para o computador que hospeda o backend, preferencialmente por DHCP reservation.
- O ESP32 envia `POST /api/v1/readings` para o IPv4 LAN do computador.
- O app Windows, se o backend estiver no mesmo computador, pode usar `http://127.0.0.1:3333`.
- O app Android deve usar o IPv4 LAN do computador (não `localhost` nem o IP do roteador) e o celular deve estar na mesma rede Wi-Fi.
- HTTP sem TLS é aceitável apenas para protótipo em rede isolada e confiável. Não expor a API à internet. Antes de uso real, implementar HTTPS/autenticação e controles adequados.

## 9. Contrato inicial de dados

O contrato ainda é provisório e deve ser alinhado com a equipe de mecatrônica. O starter atual aceita:

```json
{
  "tankId": "oil-clean-01",
  "levelPercent": 62.5,
  "measuredAt": "2026-11-16T14:30:00.000Z",
  "deviceId": "esp32-oilguard-01"
}
```

Para óleo usado, usar `tankId: "oil-used-01"`.

Endpoint:

```http
POST /api/v1/readings
Content-Type: application/json
```

`levelPercent` deve estar normalizado entre 0 e 100 quando chegar à API. A conversão do registrador Modbus bruto para esse percentual precisa ser combinada com a mecatrônica e documentada. `measuredAt` deve indicar o momento da medição; a API também registra o horário de recebimento no servidor.

Não assuma que a leitura real será percentual sem verificar com a equipe. Se os dados reais forem distância, valor bruto, milímetros ou litros, implemente uma camada clara de mapeamento/conversão depois de receber a especificação.

## 10. Interface e referência visual

Arquivos de referência incluídos:
- `docs/referencias/prototipo-visual-enviado.png`: imagem do protótipo de interface compartilhada pelo usuário.
- `docs/referencias/conversa-original-com-Codex.txt`: conversa anterior com outro assistente, incluída para contexto histórico.
- O PDF original do projeto foi enviado na conversa com o nome `projeto_final_20260918_104029_0000.pdf`; ele não foi copiado para este repositório por ser grande. O usuário pode fornecê-lo ao Codex separadamente, se necessário.

Direção visual desejada:
- interface escura;
- identidade visual roxa/violeta com acentos claros;
- aspecto de software industrial moderno;
- nome do produto: **OILGUARD**;
- navegação mobile própria (ex.: barra inferior);
- navegação desktop própria (ex.: menu lateral e painéis mais largos);
- não simplesmente ampliar a tela de celular para desktop nem comprimir o desktop no celular.

A imagem enviada usa o nome “OilLevel” e contém dados ilustrativos como vários tanques, temperatura e métricas que não constam nos requisitos. Use a imagem como **referência estética e de organização**, não como fonte funcional. O nome aprovado neste projeto é OILGUARD e o escopo funcional confirmado é de dois compartimentos: óleo limpo e óleo usado.

Telas/áreas esperadas:
1. Dashboard.
2. Gráficos.
3. Alertas.
4. Histórico.

## 11. Estado atual do repositório starter

O repositório já criado está organizado assim:

```text
oilguard-starter/
├── AGENTS.md
├── package.json
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── database.js
│   │   │   ├── domain.js
│   │   │   └── server.js
│   │   └── test/domain.test.js
│   └── client/
│       ├── src/App.tsx
│       ├── src/styles.css
│       ├── src/services/api.ts
│       ├── src/types/oilguard.ts
│       ├── src-tauri/
│       ├── capacitor.config.ts
│       └── vite.config.ts
├── tools/simulator.mjs
└── docs/
    ├── arquitetura.md
    ├── contrato-de-dados.md
    ├── contexto-e-requisitos.md
    ├── historico-da-conversa.md
    └── referencias/
```

### O que já existe no código

- React + TypeScript + Vite para o frontend.
- Componentes/layouts de desktop e mobile no `App.tsx`/`styles.css`.
- Áreas Dashboard, Gráficos, Alertas e Histórico.
- Backend Express separado do frontend.
- Persistência SQLite com tabelas `tanks`, `readings` e `alerts`.
- Endpoints atuais:
  - `GET /api/health`
  - `GET /api/v1/dashboard`
  - `GET /api/v1/tanks`
  - `GET /api/v1/readings`
  - `GET /api/v1/alerts`
  - `GET /api/v1/forecasts`
  - `POST /api/v1/readings`
- Regras de status no `apps/api/src/domain.js`.
- Previsão linear simples baseada nas últimas leituras, com requisito mínimo de histórico.
- Simulador de dados em `tools/simulator.mjs`.
- Configuração inicial Tauri 2 para Windows e Capacitor 8 para Android.
- README com comandos de instalação, simulação, execução e build.

### Validação já realizada

No ambiente em que o starter foi criado, `npm test` foi executado com Node v22.16.0 e os três testes existentes passaram:
1. classificação do óleo limpo;
2. classificação do óleo usado;
3. disponibilidade da previsão somente quando há histórico e tendência apropriados.

Isso **não** significa que o aplicativo inteiro já foi validado. A instalação de todas as dependências, typecheck completo, build Vite, build Tauri e geração do APK Android ainda precisam ser executados no computador de desenvolvimento.

### Limitações conhecidas do starter que devem ser tratadas

- O backend é um processo separado. O app Tauri não inicia automaticamente o backend neste starter. Para a primeira demonstração, documentar e facilitar a inicialização da API em separado. Só implemente serviço/sidecar/launcher se houver tempo e segurança para validar.
- O endpoint de ingestão ainda não possui autenticação. Para demonstração em rede isolada, ao menos considerar um token simples compartilhado entre ESP32 e API. Não expor a API à internet.
- Os thresholds são provisórios, conforme seção 7.
- Capacidades em litros estão nulas porque ainda não foram fornecidas.
- O contrato de dados precisa ser confirmado com a equipe de mecatrônica.
- Não há ainda detecção de dispositivo offline com intervalo validado; só implemente após saber a frequência esperada de envio.
- O projeto Android pode precisar ser gerado com `npm run android:add`, sincronizado com `npm run android:sync` e aberto no Android Studio. O usuário ainda precisa gerar/testar o APK.

## 12. Ordem de trabalho recomendada para Codex

Trabalhe em etapas curtas, sem aguardar o hardware para avançar:

### Etapa A — Auditoria e execução
1. Inspecione todos os arquivos e confirme as dependências/scripts.
2. Execute `npm install` no projeto.
3. Execute `npm test` e corrija eventuais regressões.
4. Execute `npm run typecheck` e `npm run build`; corrija erros.
5. Inicie API e frontend; confirme que dashboard consome dados reais do banco/API.
6. Verifique se não há métricas fictícias fora do escopo.

### Etapa B — MVP com dados simulados
1. Garantir que os dois compartimentos sejam exibidos corretamente.
2. Completar os quatro módulos: Dashboard, Gráficos, Alertas e Histórico.
3. Garantir navegação e layout distintos para Windows e Android, compartilhando serviços, regras e componentes úteis.
4. Melhorar estados de carregamento, falha de rede, ausência de histórico e dados desatualizados.
5. Implementar alerta sonoro com controle de áudio, se possível dentro do tempo.
6. Confirmar previsões com histórico suficiente e evitar previsões enganosas.

### Etapa C — Empacotamento
1. Gerar e testar aplicativo desktop Windows com Tauri 2.
2. Gerar projeto Android com Capacitor 8 e testar em emulador ou dispositivo físico.
3. Confirmar que o Android consegue acessar o backend pelo IPv4 LAN do computador.
4. Não criar nem tentar compilar iOS.

### Etapa D — Integração real
1. Solicitar à equipe o mapa de registradores Modbus, escala e frequência.
2. Ajustar o contrato de payload sem acoplar o frontend à comunicação Modbus.
3. Testar ingestão real de cada compartimento.
4. Comparar leituras apresentadas com a leitura do CLP/sensor.
5. Documentar toda configuração necessária para demonstração.

## 13. Critérios de aceite do MVP

O MVP estará pronto para demonstração quando:

- [ ] API inicia no Windows e `/api/health` responde.
- [ ] SQLite persiste leituras e alertas após reiniciar a API.
- [ ] Simulador envia leituras de óleo limpo e óleo usado.
- [ ] Dashboard mostra os dois compartimentos e seus níveis.
- [ ] Classificação Normal/Atenção/Crítico funciona com thresholds configuráveis e provisórios identificados.
- [ ] Gráficos mostram evolução temporal real das leituras armazenadas.
- [ ] Alertas identificam o compartimento, severidade e situação.
- [ ] Histórico lista leituras/alertas anteriores.
- [ ] Previsão simples funciona apenas com histórico suficiente e tendência adequada.
- [ ] Interface desktop está organizada para Windows e não é simplesmente o layout mobile ampliado.
- [ ] Interface Android está organizada para celular e não é simplesmente o desktop comprimido.
- [ ] Instalador Windows é gerado e abre corretamente.
- [ ] APK Android é gerado e abre corretamente.
- [ ] Android acessa a API pela rede Wi-Fi local.
- [ ] README explica claramente como iniciar backend, executar app, simular dados e configurar o IP da API.
- [ ] Nenhum dado de demonstração é confundido com leitura real.

## 14. Comunicação com o usuário durante o trabalho

Antes de mudanças grandes, explique em poucas linhas o que será alterado. Depois de cada etapa, informe:
- arquivos modificados;
- comandos executados;
- testes/builds que passaram ou falharam;
- pendências que dependem da equipe de mecatrônica.

Não afirme que um build ou teste passou sem tê-lo executado. Não invente valores dos sensores, registradores, capacidades, limites industriais ou especificações do CLP. Quando algo não estiver definido, use um placeholder explícito e registre a pergunta pendente.
