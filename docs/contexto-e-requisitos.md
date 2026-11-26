# OILGUARD — Contexto do projeto e requisitos consolidados

## Resumo executivo

O OILGUARD é um protótipo de monitoramento inteligente de níveis de óleo em dois compartimentos de um reservatório industrial. O projeto foi desenvolvido originalmente pela equipe de mecatrônica no contexto SENAI/Bosch. O usuário assumiu o desenvolvimento do software que recebe os dados enviados pela unidade ESP32 e apresenta níveis, gráficos, alertas, histórico e estimativas de tendência.

O projeto tem prazo de duas semanas (decisão atual; planejamento inicial de três meses foi cancelado). O objetivo é chegar a uma demonstração funcional usando dados simulados e, assim que disponíveis, leituras reais.

## Problema e solução propostos no material do projeto

O material original aponta que a verificação manual dos níveis de óleo exige inspeções constantes e pode atrasar a identificação de níveis baixos ou elevados, gerando risco de falta de óleo limpo, transbordamento de óleo usado, desperdício, paradas e riscos aos operadores.

A solução proposta é monitoramento contínuo de dois compartimentos com classificação normal, atenção e crítico, além de alertas visuais e auditivos específicos para cada compartimento. O sistema também deve acompanhar a tendência para antecipar quando o óleo limpo estará próximo de acabar ou quando o óleo usado estará próximo do transbordamento.

Referências ao PDF original enviado pelo usuário (`projeto_final_20260918_104029_0000.pdf`):
- páginas 2–3: problema e evidências;
- página 5: arquitetura proposta com sensores nos dois compartimentos;
- página 6: níveis normal/atenção/crítico e alertas visuais/auditivos;
- página 7: protótipo conceitual sensor → unidade IoT → aplicativo;
- página 9: validação em diferentes níveis e condições;
- página 11: precisão, tempo de resposta e confiabilidade;
- página 12: previsão de falta de óleo limpo e transbordamento de óleo usado;
- página 13: benefícios esperados.

## Decisões atuais (consolidadas)

| Tema | Decisão |
|---|---|
| Prazo | Duas semanas; não usar o cronograma antigo de três meses |
| Equipamentos | Parte já disponível; equipe de mecatrônica ainda está finalizando a parte física |
| CLP → ESP32 | Modbus RTU por RS-485, a confirmar parâmetros concretos |
| ESP32 → software | HTTP + JSON pela rede Wi-Fi local |
| Rede | Wi-Fi 2,4 GHz isolada; roteador discutido: TP-Link TL-WR829N |
| Desktop | Windows 10/11, instalador Tauri 2 |
| Mobile | Android, APK via Capacitor 8 |
| iOS | Fora do escopo porque o usuário não tem Mac |
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Express |
| Banco | SQLite no protótipo |
| Gráficos | Recharts |
| Previsão | Matemática simples por tendência; sem machine learning |
| Domínio | Dois compartimentos: óleo limpo e óleo usado |

## Escopo funcional

1. Dashboard: níveis atuais dos dois compartimentos, percentual, classificação, atualização mais recente e situação de conectividade/dados desatualizados quando a frequência for definida.
2. Gráficos: histórico de leitura dos dois compartimentos.
3. Alertas: classificação Normal/Atenção/Crítico, indicação do compartimento e ação esperada, alertas visuais e sinal sonoro com opção de silenciar.
4. Histórico: leituras e ocorrências/alertas anteriores.
5. Previsão: tempo estimado até o óleo limpo alcançar o limite mínimo crítico e até o óleo usado alcançar o limite máximo crítico, apenas se houver histórico e tendência suficientes.

## O que não faz parte do escopo confirmado

- Não existem 12 tanques; existem dois compartimentos.
- Temperatura não está definida no documento funcional e não deve ser adicionada sem confirmação.
- Economia estimada, indicadores produtivos e outras métricas ilustrativas do mockup não são requisitos confirmados.
- Não implementar machine learning.
- Não implementar comando de bombas, válvulas ou CLP; o app é monitoramento/apoio à decisão.
- Não desenvolver iOS.
- Não usar nuvem como dependência para o MVP local.

## Referência visual

A imagem `referencias/prototipo-visual-enviado.png` apresenta uma interface visual escura, com acentos roxos, cards, gráficos, tela de alertas e histórico. Ela usa o nome OilLevel e mostra vários tanques e dados ilustrativos. A equipe deve usar apenas a estética e a organização visual como inspiração. O nome do projeto continua OILGUARD e os requisitos funcionais continuam limitados aos dois compartimentos descritos no documento original.

## Arquitetura de integração

1. O CLP recebe/organiza os valores dos sensores.
2. O ESP32 consulta os registradores do CLP via Modbus RTU/RS-485.
3. O ESP32 converte os valores para a estrutura acordada e faz HTTP POST para o backend.
4. O backend valida, persiste no SQLite, classifica o nível, registra alertas e calcula tendência.
5. Os aplicativos React (Windows e Android) consultam a mesma API.

O backend deverá ficar em um computador conectado à rede local, inicialmente como processo separado. O desktop pode acessar `127.0.0.1:3333` quando backend e aplicativo estiverem na mesma máquina. O Android deve acessar o IPv4 LAN do computador, e não `localhost`.

## Contrato HTTP inicial

`POST /api/v1/readings`

```json
{
  "tankId": "oil-clean-01",
  "levelPercent": 62.5,
  "measuredAt": "2026-11-16T14:30:00.000Z",
  "deviceId": "esp32-oilguard-01"
}
```

Para óleo usado, `tankId` é `oil-used-01`. A unidade e o mapeamento dos registradores ainda precisam ser confirmados. O percentual de 0 a 100 é a forma normalizada proposta para o contrato entre ESP32 e backend, não uma especificação confirmada do CLP.

## Pendências a confirmar com a equipe de mecatrônica

- marca/modelo do CLP e disponibilidade de RS-485;
- parâmetros Modbus: baud rate, paridade, bits de parada, endereço do escravo, função e registradores;
- escala e unidade dos registradores;
- modelo do ESP32 e transceptor RS-485 utilizado;
- frequência de amostragem/envio;
- limites de atenção e crítico para cada compartimento;
- capacidade em litros, se necessário exibir esse valor;
- comportamento e timeout para identificar falha de comunicação.

## Valores provisórios presentes no starter

- Óleo limpo: atenção ≤ 30%, crítico ≤ 15%.
- Óleo usado: atenção ≥ 70%, crítico ≥ 85%.

Não vieram do PDF nem foram confirmados pela equipe. São apenas valores temporários para simulação. Devem ficar configuráveis e visivelmente marcados como provisórios.
