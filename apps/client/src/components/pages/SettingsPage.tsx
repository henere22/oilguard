import { useState } from 'react';
import { Droplet, Bell, Save, RotateCcw, Shield, Info, Monitor, Smartphone, SlidersHorizontal, RotateCw, Zap, Terminal, XCircle, Check, AlertCircle, BarChart2 } from 'lucide-react';
import { useSimulator } from '../../hooks/useSimulator';
import { audioPreferencesEvent } from '../../hooks/useAudioAlerts';
import { api, type SessionUser, type SimulatorScenario } from '../../services/api';
import type { Tank } from '../../types/oilguard';
import { UsersPage } from './UsersPage';

const PROVISIONAL_THRESHOLDS = {
  clean: { attention: 30, critical: 15 },
  used: { attention: 70, critical: 85 },
};

type Thresholds = typeof PROVISIONAL_THRESHOLDS;

export function SettingsPage({ user, tanks, simulation, onSaved }: {
  user: SessionUser;
  tanks: Tank[];
  simulation: boolean;
  onSaved: () => Promise<void>;
}) {
  const admin = user.role === 'admin';
  const { state: simulator, error: simulatorError, busy: simulatorBusy, updateConfig, resetScenario } = useSimulator(admin && simulation);
  const simulatorRunning = Boolean(simulator?.enabled && simulator.workerOnline);
  const simulatorDisabled = simulatorBusy || !simulator?.available;
  const lastTick = simulator?.lastTickAt ? new Date(simulator.lastTickAt).toLocaleTimeString('pt-BR') : null;

  const [thresholds, setThresholds] = useState<Thresholds>(() => {
    const clean = tanks.find((tank) => tank.kind === 'clean');
    const used = tanks.find((tank) => tank.kind === 'used');
    return {
      clean: clean ? { attention: clean.attentionThreshold, critical: clean.criticalThreshold } : PROVISIONAL_THRESHOLDS.clean,
      used: used ? { attention: used.attentionThreshold, critical: used.criticalThreshold } : PROVISIONAL_THRESHOLDS.used,
    };
  });
  const [audioEnabled, setAudioEnabled] = useState(() => {
    const stored = localStorage.getItem('oilguard-audio-enabled');
    return stored !== 'false';
  });
  const [audioVolume, setAudioVolume] = useState(() => {
    const stored = localStorage.getItem('oilguard-audio-volume');
    return stored !== null ? Number(stored) : 0.3;
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  const handleSave = async () => {
    setSaveStatus('saving');
    setSaveMessage('Salvando...');

    try {
      if (admin) {
        await api.updateThresholds({
          'oil-clean-01': { attention_threshold: thresholds.clean.attention, critical_threshold: thresholds.clean.critical },
          'oil-used-01': { attention_threshold: thresholds.used.attention, critical_threshold: thresholds.used.critical },
        });
        await onSaved();
      }
      localStorage.setItem('oilguard-audio-enabled', JSON.stringify(audioEnabled));
      localStorage.setItem('oilguard-audio-volume', String(audioVolume));
      window.dispatchEvent(new Event(audioPreferencesEvent));

      setSaveStatus('success');
      setSaveMessage('Altera??es salvas.');
    } catch (error) {
      setSaveStatus('error');
      setSaveMessage(`Erro ao salvar na API: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    setTimeout(() => {
      setSaveStatus('idle');
      setSaveMessage('');
    }, 3000);
  };

  const handleReset = () => {
    setThresholds({ ...PROVISIONAL_THRESHOLDS });
    setAudioEnabled(true);
    setAudioVolume(0.3);
    localStorage.removeItem('oilguard-audio-enabled');
    localStorage.removeItem('oilguard-audio-volume');
  };

  return (
    <div className="settings-page">
      <section className="page-intro">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <span className="eyebrow">CONFIGURAÇÕES DO SISTEMA</span>
            <h1>Configurações</h1>
            <p>Ajuste limites, alertas sonoros e preferências do OILGUARD.</p>
          </div>
          <div className="page-intro-actions">
            <button onClick={handleReset} className="page-intro-btn reset">
              <RotateCcw size={13} /> Restaurar padrões
            </button>
            <button onClick={handleSave} disabled={saveStatus === 'saving'} className={`page-intro-btn save ${saveStatus}`}>
              {saveStatus === 'saving' && <div style={{ width: 13, height: 13, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
              {saveStatus === 'success' && <Check size={13} />}
              {saveStatus === 'error' && <AlertCircle size={13} />}
              {saveStatus === 'idle' && <Save size={13} />}
              {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'success' ? 'Salvo!' : saveStatus === 'error' ? 'Erro' : 'Salvar alterações'}
            </button>
            {saveMessage && <span className={`page-intro-message ${saveStatus}`}>{saveMessage}</span>}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      </section>

      {admin && <UsersPage user={user} />}
      {admin && <article className="settings-section">
        <div className="settings-section-header">
          <div className="settings-section-title">
            <div className="settings-section-icon accent"><SlidersHorizontal size={18} /></div>
            <div>
              <h2>Limites de Classificação</h2>
              <p>Percentuais para Normal, Atenção e Crítico (valores provisórios)</p>
            </div>
          </div>
          <span className="settings-section-badge">PROVISÓRIO</span>
        </div>

        <div className="settings-grid">
          {/* Óleo Limpo */}
          <div className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-icon clean"><Droplet size={16} /></div>
              <strong>Óleo Limpo</strong>
              <span className="direction">Nível decresce</span>
            </div>

            <div className="settings-fields">
              <ThresholdInput
                label="Atenção (≤)"
                value={thresholds.clean.attention}
                onChange={(v: number) => setThresholds(prev => ({ ...prev, clean: { ...prev.clean, attention: v } }))}
                help="Percentual abaixo do qual entra em Atenção"
                suffix="%"
              />
              <ThresholdInput
                label="Crítico (≤)"
                value={thresholds.clean.critical}
                onChange={(v: number) => setThresholds(prev => ({ ...prev, clean: { ...prev.clean, critical: v } }))}
                help="Percentual abaixo do qual entra em Crítico"
                suffix="%"
              />
            </div>

            <div className="settings-card-note">
              <strong>Valores padrão:</strong> Atenção ≤ 30% • Crítico ≤ 15%
              <br />⚠ Confirmar com equipe de mecatrônica/Bosch antes de uso operacional.
            </div>
          </div>

          {/* Óleo Usado */}
          <div className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-icon used"><Droplet size={16} /></div>
              <strong>Óleo Usado</strong>
              <span className="direction">Nível cresce</span>
            </div>

            <div className="settings-fields">
              <ThresholdInput
                label="Atenção (≥)"
                value={thresholds.used.attention}
                onChange={(v: number) => setThresholds(prev => ({ ...prev, used: { ...prev.used, attention: v } }))}
                help="Percentual acima do qual entra em Atenção"
                suffix="%"
              />
              <ThresholdInput
                label="Crítico (≥)"
                value={thresholds.used.critical}
                onChange={(v: number) => setThresholds(prev => ({ ...prev, used: { ...prev.used, critical: v } }))}
                help="Percentual acima do qual entra em Crítico"
                suffix="%"
              />
            </div>

            <div className="settings-card-note">
              <strong>Valores padrão:</strong> Atenção ≥ 70% • Crítico ≥ 85%
              <br />⚠ Confirmar com equipe de mecatrônica/Bosch antes de uso operacional.
            </div>
          </div>
        </div>
      </article>}

      {/* Alertas Sonoros */}
      <article className="settings-section">
        <div className="settings-section-header">
          <div className="settings-section-title">
            <div className="settings-section-icon warning"><Bell size={18} /></div>
            <div>
              <h2>Alertas Sonoros</h2>
              <p>Sinais sonoros para estados de Atenção e Crítico</p>
            </div>
          </div>
        </div>

        <div className="audio-grid">
          <div className="audio-card">
            <div className="audio-toggle">
              <div className="audio-toggle-info">
                <strong>Ativar alertas sonoros</strong>
                <span>Requer interação do usuário para habilitar áudio (política do navegador)</span>
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={audioEnabled}
                  onChange={(e) => setAudioEnabled(e.target.checked)}
                  className="audio-toggle-checkbox"
                />
              </label>
            </div>
          </div>

          <div className="audio-card">
            <div className="volume-control">
              <div className="volume-control-header">
                <strong>Volume</strong>
                <span>{Math.round(audioVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={audioVolume}
                onChange={(e) => setAudioVolume(Number(e.target.value))}
                disabled={!audioEnabled}
              />
              <p className="help">
                {audioEnabled ? 'Ajuste o volume dos alertas sonoros' : 'Ative os alertas sonoros para ajustar o volume'}
              </p>
            </div>
          </div>
        </div>

        <div className="audio-behavior">
          <strong>Comportamento dos alertas:</strong>
          <ul>
            <li><strong>Atenção:</strong> Toca uma vez quando o alerta é criado (não repete a cada atualização)</li>
            <li><strong>Crítico:</strong> Toca apenas na transição PARA estado crítico (não enquanto permanece crítico)</li>
            <li>Requer clique/toque inicial na página para habilitar Web Audio API (política de autoplay)</li>
          </ul>
        </div>
      </article>

      {/* Informações do Sistema */}
      <article className="settings-section">
        <div className="settings-section-header">
          <div className="settings-section-title">
            <div className="settings-section-icon info"><Info size={18} /></div>
            <div>
              <h2>Sobre o OILGUARD</h2>
              <p>Versão, créditos e informações do protótipo</p>
            </div>
          </div>
        </div>

        <div className="info-grid">
          <InfoCard label="Versão" value="0.1.0 (Protótipo)" icon={Monitor} />
          <InfoCard label="Plataforma" value="Windows ? Android ? Web" icon={Smartphone} />
          <InfoCard label="Backend" value="Node.js + Express + PostgreSQL" icon={Shield} />
          <InfoCard label="Frontend" value="React 19 + TypeScript + Vite" icon={Monitor} />
          <InfoCard label="Gráficos" value="Recharts" icon={BarChart2} />
          <InfoCard label="Ícones" value="lucide-react" icon={BarChart2} />
        </div>

        <div className="settings-notes">
          <strong>Observações importantes:</strong>
          <ul>
            <li>Este é um protótipo para demonstração. Não use para decisões operacionais reais.</li>
            <li>Limites de Atenção/Crítico são PROVISÓRIOS e devem ser confirmados pela equipe Bosch/SENAI.</li>
            <li>Capacidades em litros não foram informadas — conversão percentual ↔ litros pendente.</li>
            <li>Contrato de dados Modbus/ESP32 precisa ser alinhado com a equipe de mecatrônica.</li>
            <li>A implantação pública usa HTTPS.</li>
          </ul>
        </div>
      </article>

      {admin && simulation && <article className="settings-section">
        <div className="settings-section-header">
          <div className="settings-section-title">
            <div className="settings-section-icon warning"><Zap size={18} /></div>
            <div>
              <h2>Simulador Interno</h2>
              <p>Gera leituras simuladas em segundo plano, mesmo fora desta tela.</p>
            </div>
          </div>
        </div>

        {!simulator && <p role="status">{simulatorError || 'Consultando o simulador…'}</p>}
        {simulator && <>
          <div className="simulator-grid">
            {/* Controles Principais */}
            <div className="simulator-card">
              <div className="simulator-status">
                <div className="simulator-status-indicator">
                  <div className={`simulator-status-dot ${simulatorRunning ? 'running' : 'stopped'}`} />
                  <strong className="simulator-status-text">{simulatorRunning ? 'RODANDO' : simulator.available ? 'PARADO' : 'DESABILITADO'}</strong>
                </div>
                <label className="simulator-toggle">
                  <input
                    type="checkbox"
                    checked={simulator.enabled}
                    disabled={simulatorDisabled}
                    onChange={(e) => void updateConfig({ enabled: e.target.checked })}
                  />
                  <span>{simulator.enabled ? 'Pausar' : 'Ativar'}</span>
                </label>
              </div>

              <div className="simulator-field">
                <label className="simulator-field-label">Cenário de Simulação</label>
                <div className="scenario-buttons">
                  {(Object.keys(simulator.scenarios) as SimulatorScenario[]).map((scenario) => {
                    const scenarioConfig = simulator.scenarios[scenario];
                    return (
                      <button
                        key={scenario}
                        onClick={() => void updateConfig({ scenario })}
                        disabled={simulatorDisabled}
                        className={`scenario-button ${simulator.scenario === scenario ? 'selected' : ''}`}
                      >
                        <span>{scenarioConfig.name}</span>
                        <span className="rates">
                          Limpo: {scenarioConfig.clean.rate > 0 ? '+' : ''}{scenarioConfig.clean.rate.toFixed(1)}%/tick
                          {' | '}
                          Usado: {scenarioConfig.used.rate > 0 ? '+' : ''}{scenarioConfig.used.rate.toFixed(1)}%/tick
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="simulator-field">
                <label className="simulator-field-label">Intervalo entre leituras</label>
                <div className="interval-input">
                  <input
                    type="number"
                    min={1000}
                    max={60000}
                    step={1000}
                    key={simulator.intervalMs}
                    defaultValue={simulator.intervalMs}
                    disabled={simulatorDisabled}
                    onBlur={(e) => {
                      const input = e.currentTarget;
                      const value = Math.round(input.valueAsNumber);
                      const intervalMs = Number.isFinite(value) ? Math.max(1000, Math.min(60000, value)) : simulator.intervalMs;
                      input.value = String(simulator.intervalMs);
                      if (intervalMs !== simulator.intervalMs) void updateConfig({ intervalMs });
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  />
                  <span className="unit">ms</span>
                  <div className="interval-presets">
                    {[2000, 5000, 10000, 30000].map((ms) => (
                      <button
                        key={ms}
                        onClick={() => void updateConfig({ intervalMs: ms })}
                        disabled={simulatorDisabled}
                        className={`interval-preset ${simulator.intervalMs === ms ? 'selected' : ''}`}
                      >
                        {ms === 1000 ? '1s' : `${ms / 1000}s`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="simulator-actions">
                <button
                  onClick={resetScenario}
                  disabled={simulatorDisabled || !simulator.enabled}
                  className="simulator-action reset"
                >
                  <RotateCw size={14} /> Reiniciar Cenário
                </button>
                <button
                  onClick={resetScenario}
                  disabled={simulatorDisabled}
                  className="simulator-action clear"
                >
                  <Terminal size={14} /> Zerar contadores
                </button>
              </div>
            </div>

            {/* Status em Tempo Real */}
            <div className="simulator-card realtime-status">
              <strong className="realtime-status-title">Status em Tempo Real</strong>
              <div className="realtime-levels">
                <div className="realtime-level clean">
                  <div className="realtime-level-header">
                    <div className="realtime-level-icon clean"><Droplet size={14} /></div>
                    <span className="realtime-level-label">ÓLEO LIMPO</span>
                  </div>
                  <div className="realtime-level-value clean">{simulator.cleanLevel.toFixed(1)}%</div>
                  <div className="realtime-level-tick">Tick #{simulator.tickCount}</div>
                </div>
                <div className="realtime-level used">
                  <div className="realtime-level-header">
                    <div className="realtime-level-icon used"><Droplet size={14} /></div>
                    <span className="realtime-level-label">ÓLEO USADO</span>
                  </div>
                  <div className="realtime-level-value used">{simulator.usedLevel.toFixed(1)}%</div>
                  <div className="realtime-level-tick">Tick #{simulator.tickCount}</div>
                </div>
              </div>

              <div className="realtime-meta">
                <div className="realtime-meta-item">
                  <div className="realtime-meta-label">Cenário Ativo</div>
                  <div className="realtime-meta-value">{simulator.scenarios[simulator.scenario].name}</div>
                </div>
                <div className="realtime-meta-item">
                  <div className="realtime-meta-label">Último Envio</div>
                  <div className="realtime-meta-value">{lastTick || '—'}</div>
                </div>
              </div>

              {simulatorError && (
                <div className="realtime-error">
                  <XCircle size={14} />
                  <span>Erro: {simulatorError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Log de Atividade */}
          <div className="activity-log">
            <div className="activity-log-header">
              <strong className="activity-log-title">Log de Atividade</strong>
              <span className={`activity-log-status ${simulatorRunning ? 'active' : ''}`}>
                {simulatorRunning ? (
                  <>
                    <span className="pulse-dot" />
                    ATIVO
                  </>
                ) : (
                  'INATIVO'
                )}
              </span>
            </div>
            <div className="activity-log-content">
              <div className="info">Cenário: {simulator.scenarios[simulator.scenario].name}</div>
              <div className="info">Níveis iniciais: Limpo {simulator.scenarios[simulator.scenario].clean.start}% | Usado {simulator.scenarios[simulator.scenario].used.start}%</div>
              {simulator.tickCount > 0 && (
                <div className="info">[{lastTick}] Tick #{simulator.tickCount} gravado — Limpo {simulator.cleanLevel.toFixed(1)}% | Usado {simulator.usedLevel.toFixed(1)}%</div>
              )}
              {simulator.available && !simulator.workerOnline && (
                <div className="muted">Aguardando conexão do Worker.</div>
              )}
              {simulator.available && simulator.workerOnline && !simulator.enabled && (
                <div className="muted">Ative o simulador para iniciar a geração de leituras.</div>
              )}
            </div>
          </div>
        </>}
      </article>}

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.9); }
        }
      `}</style>
    </div>
  );
}

function ThresholdInput({ label, value, onChange, help, suffix }: {
  label: string; value: number; onChange: (v: number) => void; help: string; suffix: string;
}) {
  return (
    <div className="threshold-input">
      <label>{label}</label>
      <div className="input-wrapper">
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value))))}
        />
        <span className="suffix">{suffix}</span>
      </div>
      <p className="help">{help}</p>
    </div>
  );
}

function InfoCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ size?: number }> }) {
  return (
    <div className="info-card">
      <div className="info-card-icon"><Icon size={18} /></div>
      <p className="info-card-label">{label}</p>
      <strong className="info-card-value">{value}</strong>
    </div>
  );
}
