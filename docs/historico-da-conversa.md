# OILGUARD — Histórico e transcrição organizada da conversa

## Nota sobre este registro

Este arquivo registra a evolução da conversa e preserva as decisões importantes para dar continuidade ao projeto no Claude Code. Para facilitar a leitura, as respostas longas do ChatGPT nesta conversa atual foram condensadas em sínteses fiéis, e não reproduzidas literalmente palavra por palavra. A conversa inicial com o Claude foi copiada integralmente em `referencias/conversa-original-com-claude.txt`.

## 1. Conversa original com Claude

O usuário explicou ao Claude que a namorada e a equipe de mecatrônica desenvolveram um projeto no SENAI para a Bosch, e que a parte da equipe terminaria na disponibilização dos dados na rede. O usuário assumiria a programação de um aplicativo/software para consumir os dados e mostrar dashboards, utilização dos tanques e níveis de resíduos. Comentou que concluiu o técnico em ADS há cerca de dois anos e que estava retomando Engenharia de Software na faculdade.

O Claude sugeriu inicialmente:
- alinhar o protocolo e formato de dados com a mecatrônica;
- estruturar backend/API, banco de dados e frontend;
- considerar Node.js/Express, PostgreSQL ou SQLite, React e app mobile;
- simular dados antes da disponibilidade do hardware.

Naquele momento o prazo informado era de três meses. O Claude montou um cronograma de três meses, mas essa informação foi depois corrigida pelo usuário e não é mais válida.

Na mesma conversa, o Claude explicou as alternativas de comunicação entre CLP e ESP32. O usuário escolheu **Modbus RTU**. Também escolheu uma **previsão simples por tendência**, sem machine learning. O Claude explicou que o ESP32 precisaria de transceptor RS-485 e sugeriu que a equipe confirmasse a presença da interface RS-485 no CLP.

O usuário perguntou sobre o roteador TP-Link TL-WR829N N300. O Claude considerou o modelo adequado para uma rede local Wi-Fi 2,4 GHz entre ESP32, computador e celular. O roteador não participa da comunicação serial Modbus RTU; ele é usado depois, na rede IP.

O arquivo integral dessa conversa está em `referencias/conversa-original-com-claude.txt`.

## 2. Compartilhamento do projeto e planejamento inicial

O usuário compartilhou essa conversa com o ChatGPT e pediu que o contexto fosse entendido para continuar o desenvolvimento. Depois respondeu que o produto final deveria atender computador e celular, que os equipamentos estavam parcialmente disponíveis e que ainda estava no planejamento.

O ChatGPT inicialmente sugeriu um sistema web responsivo/PWA e um planejamento de 12 semanas. Essas propostas foram posteriormente substituídas pelas decisões mais recentes: prazo de duas semanas e aplicativos instaláveis Windows + Android.

## 3. Correção do prazo e apresentação do PDF

O usuário corrigiu explicitamente: “sobre os 3 meses, esqueça, tenho apenas duas semanas”. Também informou que o CLP se comunicará com o ESP32 e que as informações do dashboard deveriam seguir o projeto. Foi anexado o PDF `projeto_final_20260918_104029_0000.pdf`.

A leitura do PDF confirmou que a solução deve monitorar dois compartimentos:
- óleo limpo, antecipando quando estará próximo de acabar;
- óleo usado, antecipando quando estará próximo do transbordamento.

O documento propõe níveis Normal, Atenção e Crítico e alertas visuais e auditivos específicos para cada compartimento. Também fala em gráficos, riscos, histórico, precisão, tempo de resposta e confiabilidade.

O ChatGPT recomendou reduzir o escopo para um MVP: dois compartimentos, níveis atuais, status, alertas, gráficos/histórico e previsão simples por tendência. Não adicionar temperatura, machine learning ou métricas que não aparecem nos requisitos confirmados.

## 4. Compartilhamento da imagem do protótipo

O usuário enviou uma imagem de protótipo de aplicativo e esclareceu que o aplicativo precisa ser instalável tanto em computador quanto em celular, sem parecer um simples port de web para as plataformas.

A imagem usa o nome “OilLevel” e mostra telas de dashboard, gráfico, alertas e histórico. Também contém exemplos ilustrativos de vários tanques, temperatura, economia estimada e indicadores extras. A conversa concluiu que a imagem deve orientar a identidade visual, cores e organização, mas não deve substituir os requisitos funcionais do PDF: o escopo confirmado continua sendo dois compartimentos e somente os dados realmente disponíveis.

## 5. Comparação Flutter versus React + Tauri + Capacitor

O usuário perguntou qual seria melhor entre:
- Flutter;
- React existente + Tauri no desktop + Capacitor no mobile.

O ChatGPT comparou as opções e recomendou React + TypeScript + Tauri 2 + Capacitor 8 para este caso, principalmente porque o usuário já possui alguma familiaridade com JavaScript e porque é possível compartilhar a base React sem manter dois frontends separados.

A solução escolhida utiliza WebViews do sistema para renderizar a interface. O requisito de “nativo” foi interpretado como aplicativo instalável, que abre em janela própria no Windows e como APK no Android, e não como controles visuais 100% nativos de cada sistema operacional.

## 6. Definição final das plataformas

O usuário informou:
- Desktop: Windows.
- Mobile: inicialmente selecionou Android e iPhone.
- Requisito: aplicativo instalável.

Em seguida, retirou iOS do escopo por não possuir Mac. A definição final é:
- Windows 10/11 via Tauri 2;
- Android via Capacitor 8;
- iOS totalmente fora do escopo; não criar projeto iOS nem adicionar dependências iOS.

## 7. Starter criado

Foi criado um projeto inicial chamado `oilguard-starter`, com:

- React + TypeScript + Vite no frontend;
- Tauri 2 para empacotamento desktop Windows;
- Capacitor 8 para empacotamento Android;
- Node.js + Express no backend;
- SQLite com `better-sqlite3`;
- Recharts para gráficos;
- lucide-react para ícones;
- simulador de dados em `tools/simulator.mjs`;
- testes de regras de classificação e previsão.

O backend contém endpoints para saúde, dashboard, tanques, leituras, alertas e previsões, além de `POST /api/v1/readings` para receber dados do ESP32.

O banco inicial contém as tabelas `tanks`, `readings` e `alerts`. O projeto cria dois registros: óleo limpo e óleo usado.

A previsão implementada no starter utiliza regressão linear simples sobre até vinte leituras recentes e exige pelo menos quatro leituras válidas. Os três testes existentes passaram quando `npm test` foi executado com Node v22.16.0 no ambiente de criação do starter.

Importante: essa verificação não confirma build completo do frontend, instalador Windows ou APK Android. Esses passos precisam ser executados no computador do usuário.

## 8. Decisões e propostas antigas que foram substituídas

Não seguir estas sugestões antigas:
- prazo de três meses;
- PWA como entrega final;
- Flutter como stack selecionada;
- implementação mobile apenas “se der tempo”.

Decisões atuais:
- duas semanas;
- React + TypeScript + Vite;
- Tauri 2 para Windows;
- Capacitor 8 para Android;
- sem iOS;
- backend Node.js + Express;
- SQLite;
- Modbus RTU CLP → ESP32;
- HTTP/JSON ESP32 → backend;
- cálculo simples por tendência;
- dois compartimentos: óleo limpo e óleo usado.

## 9. Mensagem final ao Claude Code

Leia primeiro `../CLAUDE.md` (na raiz do projeto) e `contexto-e-requisitos.md`. Depois audite o starter existente e continue a implementação em vez de começar tudo do zero. Use a imagem em `referencias/prototipo-visual-enviado.png` como referência estética, e mantenha o escopo funcional de dois compartimentos definido pelo PDF original. Priorize uma entrega demonstrável em duas semanas: execução local, simulador, dashboard, gráficos, alertas, histórico, previsão simples e builds Windows/Android. Documente os pontos que dependem da equipe de mecatrônica e não invente especificações.
