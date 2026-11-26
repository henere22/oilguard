/**
 * OILGUARD Simulator - Apenas para desenvolvimento
 * Gera leituras simuladas para os dois compartimentos
 * NÃO DEVE SER USADO EM PRODUÇÃO
 */

import readline from 'readline';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

config({ path: fileURLToPath(new URL('../apps/api/.env', import.meta.url)), quiet: true });
const apiUrl = process.env.API_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3333}`;
const ingestToken = process.env.INGEST_TOKEN;
if (!ingestToken) throw new Error('Defina INGEST_TOKEN com a credencial do banco de simulação.');
const intervalMs = Number(process.env.SIMULATOR_INTERVAL_MS ?? 5000);

// Configurações dos cenários
const SCENARIOS = {
  normal: {
    name: 'Normal',
    clean: { start: 72, rate: -0.3, noise: 0.05 },
    used: { start: 38, rate: 0.25, noise: 0.04 },
    description: 'Operação normal - níveis dentro dos limites'
  },
  attention: {
    name: 'Atenção',
    clean: { start: 32, rate: -0.4, noise: 0.06 },
    used: { start: 68, rate: 0.35, noise: 0.05 },
    description: 'Próximo aos limites de atenção'
  },
  critical: {
    name: 'Crítico',
    clean: { start: 12, rate: -0.5, noise: 0.08 },
    used: { start: 88, rate: 0.45, noise: 0.07 },
    description: 'Níveis críticos - ação imediata necessária'
  },
  demo: {
    name: 'Demo Rápida',
    clean: { start: 72, rate: -2.0, noise: 0.2 },
    used: { start: 38, rate: 1.8, noise: 0.15 },
    description: 'Variação acelerada para demonstração (10x)'
  }
};

// Estado do simulador
let currentScenario = process.env.SIMULATOR_SCENARIO ?? 'normal';
if (!SCENARIOS[currentScenario]) {
  console.warn(`Cenário "${currentScenario}" não encontrado, usando "normal"`);
  currentScenario = 'normal';
}
let running = true;
let cleanLevel = SCENARIOS[currentScenario].clean.start;
let usedLevel = SCENARIOS[currentScenario].used.start;
let tickCount = 0;

function getScenario() {
  return SCENARIOS[currentScenario];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function sendReading(tankId, levelPercent, measuredAt) {
  const response = await fetch(`${apiUrl}/api/v1/readings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-ingest-token': ingestToken },
    body: JSON.stringify({
      tankId,
      levelPercent: Number(levelPercent.toFixed(1)),
      measuredAt,
      deviceId: 'simulator-01',
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`API respondeu ${response.status}: ${message}`);
  }
  return response.json();
}

async function tick() {
  if (!running) return;

  const scenario = getScenario();
  const now = new Date();
  const measuredAt = now.toISOString();

  // Calcular novos níveis com tendência + ruído
  const cleanChange = scenario.clean.rate + (Math.random() - 0.5) * scenario.clean.noise * 2;
  const usedChange = scenario.used.rate + (Math.random() - 0.5) * scenario.used.noise * 2;

  cleanLevel = clamp(cleanLevel + cleanChange, 0, 100);
  usedLevel = clamp(usedLevel + usedChange, 0, 100);
  tickCount++;

  try {
    const [cleanResult, usedResult] = await Promise.all([
      sendReading('oil-clean-01', cleanLevel, measuredAt),
      sendReading('oil-used-01', usedLevel, measuredAt),
    ]);

    const timeStr = now.toLocaleTimeString('pt-BR');
    const statusClean = cleanLevel <= 15 ? '🔴 CRÍTICO' : cleanLevel <= 30 ? '🟡 ATENÇÃO' : '🟢 NORMAL';
    const statusUsed = usedLevel >= 85 ? '🔴 CRÍTICO' : usedLevel >= 70 ? '🟡 ATENÇÃO' : '🟢 NORMAL';

    console.log(`${timeStr} | ${scenario.name} | Tick #${tickCount}`);
    console.log(`  Óleo Limpo:  ${cleanLevel.toFixed(1)}% ${statusClean} (Δ${cleanChange >= 0 ? '+' : ''}${cleanChange.toFixed(2)}%)`);
    console.log(`  Óleo Usado:  ${usedLevel.toFixed(1)}% ${statusUsed} (Δ${usedChange >= 0 ? '+' : ''}${usedChange.toFixed(2)}%)`);
    console.log('');
  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] Erro:`, error.message);
  }
}

function printStatus() {
  const scenario = getScenario();
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    OILGUARD SIMULADOR                         ║');
  console.log('║                     (APENAS DESENVOLVIMENTO)                  ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  API: ${apiUrl.padEnd(50)} ║`);
  console.log(`║  Intervalo: ${intervalMs}ms ${' '.repeat(40)} ║`);
  console.log(`║  Cenário: ${scenario.name.padEnd(48)} ║`);
  console.log(`║  Status: ${(running ? '▶ RODANDO' : '⏸ PAUSADO').padEnd(47)} ║`);
  console.log(`║  Ticks: ${tickCount.toString().padEnd(49)} ║`);
  console.log(`║  Níveis: Limpo ${cleanLevel.toFixed(1)}% | Usado ${usedLevel.toFixed(1)}% ${' '.repeat(32)} ║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Controles:                                                   ║');
  console.log('║  [1] Normal      - Operação padrão                            ║');
  console.log('║  [2] Atenção     - Próximo aos limites                        ║');
  console.log('║  [3] Crítico     - Níveis críticos                            ║');
  console.log('║  [4] Demo Rápida - Variação acelerada (10x)                   ║');
  console.log('║  [Espaço] Pausar/Continuar                                    ║');
  console.log('║  [R] Reiniciar cenário atual                                  ║');
  console.log('║  [Q] Sair                                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
}

function resetScenario() {
  const scenario = getScenario();
  cleanLevel = scenario.clean.start;
  usedLevel = scenario.used.start;
  tickCount = 0;
  console.log(`\n🔄 Cenário "${scenario.name}" reiniciado.`);
  console.log(`   Óleo Limpo: ${cleanLevel}% | Óleo Usado: ${usedLevel}%\n`);
}

function switchScenario(key) {
  const scenarioKeys = Object.keys(SCENARIOS);
  const index = Number(key) - 1;
  if (index >= 0 && index < scenarioKeys.length) {
    currentScenario = scenarioKeys[index];
    resetScenario();
  }
}

async function init() {
  console.log('\n🚀 Iniciando simulador OILGUARD...\n');
  printStatus();

  // Primeira leitura imediata
  await tick();

  // Interval
  const intervalId = setInterval(tick, intervalMs);

  // CLI interativo
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Raw mode para capturar teclas individuais
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (key) => {
      const char = key.toString();
      if (char === '\u0003') { // Ctrl+C
        console.log('\n\n👋 Encerrando simulador...');
        clearInterval(intervalId);
        process.exit(0);
      } else if (char === ' ') { // Espaço
        running = !running;
        console.log(`\n${running ? '▶ Continuando' : '⏸ Pausado'}\n`);
        printStatus();
      } else if (char === 'r' || char === 'R') {
        resetScenario();
      } else if (['1', '2', '3', '4'].includes(char)) {
        switchScenario(char);
        printStatus();
      } else if (char === 'q' || char === 'Q') {
        console.log('\n\n👋 Encerrando simulador...');
        clearInterval(intervalId);
        process.exit(0);
      }
    });
  }

  // Cleanup
  process.on('SIGINT', () => {
    clearInterval(intervalId);
    console.log('\n\n👋 Encerrando simulador...');
    process.exit(0);
  });
}

init();
