# Primeira instrução para Claude Code

Abra este repositório como projeto no Claude Code e leia primeiro `CLAUDE.md`, depois `docs/contexto-e-requisitos.md` e `docs/historico-da-conversa.md`.

Use o código que já existe como ponto de partida. Não comece do zero e não troque a stack. A referência visual está em `docs/referencias/prototipo-visual-enviado.png`; a conversa antiga com Claude está em `docs/referencias/conversa-original-com-claude.txt`.

Quero que você assuma a implementação do MVP do OILGUARD seguindo as decisões atuais:

- Desktop Windows 10/11: Tauri 2.
- Mobile Android: Capacitor 8. Não desenvolver iOS.
- Frontend: React + TypeScript + Vite.
- Backend: Node.js + Express.
- Banco: SQLite.
- CLP → ESP32: Modbus RTU/RS-485.
- ESP32 → backend: HTTP + JSON pela rede local.
- Dois compartimentos apenas: óleo limpo e óleo usado.
- Alertas Normal/Atenção/Crítico, histórico, gráficos e previsão matemática simples por tendência.
- Prazo: aproximadamente duas semanas; priorize o MVP funcional.

Comece auditando o repositório e verificando dependências, scripts, arquitetura e estado real do código. Execute os testes disponíveis, corrija problemas e confira o typecheck/build. Depois implemente e valide as telas e fluxos que faltarem. Não afirme que algo está funcionando sem executar a verificação correspondente.

Não invente limites operacionais, capacidades, unidades, registradores Modbus ou frequência de leitura. Os thresholds que já estão no starter são placeholders. Registre qualquer dependência da equipe de mecatrônica como pendência.

Ao concluir cada etapa, informe arquivos alterados, o que foi implementado, comandos/testes realmente executados e o que ainda falta. Explique as decisões importantes em português brasileiro e mantenha o código simples, modular e sustentável.
