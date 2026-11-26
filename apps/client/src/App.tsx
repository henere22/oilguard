import { useEffect, useState, useRef } from 'react';
import {
  LayoutDashboard,
  BarChart3,
  Bell,
  History as HistoryIcon,
  Droplet,
  Settings2,
  RefreshCw,
  WifiOff,
  AlertTriangle,
  Droplets,
  MoreHorizontal,
  LogOut,
} from 'lucide-react';
import { useDashboard } from './hooks/useDashboard';
import { useAudioAlerts } from './hooks/useAudioAlerts';
import { Dashboard } from './components/pages/Dashboard';
import { Charts } from './components/pages/Charts';
import { Alerts } from './components/pages/Alerts';
import { HistoryAndReports } from './components/pages/HistoryAndReports';
import { TanksPage } from './components/pages/TanksPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { LoginPage } from './components/pages/LoginPage';
import { ApiError, api, auth, type SessionUser } from './services/api';
import { ConnectionIndicator } from './components/ui/ConnectionIndicator';
import { AudioToggle } from './components/ui/AudioToggle';
import { formatRelativeTime } from './utils/formatters';
import type { OilAlert } from './types/oilguard';
import './styles.css';

type Section = 'dashboard' | 'charts' | 'alerts' | 'history-reports' | 'tanks' | 'settings';
type NavItemId = Section | 'more';

const desktopNavigation = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tanks' as const, label: 'Tanques', icon: Droplets },
  { id: 'charts' as const, label: 'Gráficos', icon: BarChart3 },
  { id: 'alerts' as const, label: 'Alertas', icon: Bell },
  { id: 'history-reports' as const, label: 'Histórico e Relatórios', icon: HistoryIcon },
  { id: 'settings' as const, label: 'Configurações', icon: Settings2 },
];

const mobileNavigation = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tanks' as const, label: 'Tanques', icon: Droplets },
  { id: 'alerts' as const, label: 'Alertas', icon: Bell },
  { id: 'history-reports' as const, label: 'Histórico e Relatórios', icon: HistoryIcon },
  { id: 'more' as const, label: 'Mais', icon: MoreHorizontal },
];

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    const expired = () => {
      setUser(null);
      setMessage('Sua sessão expirou ou foi revogada. Entre novamente.');
    };
    window.addEventListener('oilguard:session-expired', expired);
    auth.me().then(({ user }) => { if (mounted) setUser(user); })
      .catch((error: unknown) => {
        if (mounted && (!(error instanceof ApiError) || error.status !== 401)) {
          setMessage('Não foi possível verificar a sessão. Confirme a disponibilidade da API.');
        }
      })
      .finally(() => { if (mounted) setCheckingSession(false); });
    return () => {
      mounted = false;
      window.removeEventListener('oilguard:session-expired', expired);
    };
  }, []);

  if (checkingSession) return <main className="auth-shell"><p role="status">Verificando sessão…</p></main>;
  if (!user) return <LoginPage onLogin={(session) => { setUser(session); setMessage(''); }} initialError={message} />;
  return <MonitoringApp user={user} onLogout={() => setUser(null)} />;
}

function MonitoringApp({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [section, setSection] = useState<Section>('dashboard');
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    setLogoutError('');
    try {
      await auth.logout();
      onLogout();
    } catch {
      setLogoutError('O servidor não confirmou a saída. Tente novamente.');
      setLoggingOut(false);
    }
  }

  // Hook do dashboard com auto-refresh e estados de conexão
  const {
    data,
    error,
    loading,
    refresh,
    lastRefresh: lastSuccessfulRefresh,
    connectionStatus,
  } = useDashboard({ refreshIntervalMs: 5000, enabled: true });

  // Hook de alertas sonoros
  const { playAlert, isEnabled: audioEnabled } = useAudioAlerts();

  // Detectar novos alertas para tocar som (apenas na transição PARA crítico)
  const prevAlertsRef = useRef<OilAlert[]>([]);
  const prevCriticalStateRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (data?.alerts && data?.tanks) {
      const prevIds = new Set(prevAlertsRef.current.map((a) => a.id));
      const newAlerts = data.alerts.filter((a: OilAlert) => !prevIds.has(a.id));

      // Tocar som apenas para novos alertas de atenção (não crítico)
      for (const alert of newAlerts) {
        if (audioEnabled && alert.severity === 'attention') {
          playAlert('attention');
        }
      }

      // Verificar transição para crítico em cada tanque
      for (const tank of data.tanks) {
        const isCritical = tank.status === 'critical';
        const wasCritical = prevCriticalStateRef.current[tank.id] === true;
        if (isCritical && !wasCritical && audioEnabled) {
          playAlert('critical');
        }
        prevCriticalStateRef.current[tank.id] = isCritical;
      }

      prevAlertsRef.current = data.alerts;
    }
  }, [data?.alerts, data?.tanks, audioEnabled, playAlert]);

  const handleRefresh = refresh;

  const currentNav = window.innerWidth <= 820 ? mobileNavigation : desktopNavigation;
  const title = currentNav.find((item) => item.id === section)?.label ?? 'Dashboard';

  const handleSectionChange = (id: NavItemId) => {
    if (id === 'more') {
      setMobileMoreOpen(!mobileMoreOpen);
      return;
    }
    setSection(id);
    setMobileMoreOpen(false);
  };

  return (
    <div className="app-shell">
      {/* Sidebar Desktop */}
      <aside className="sidebar" aria-label="Navegação principal">
        <div className="brand">
          <div className="brand-mark">
            <Droplet size={23} fill="currentColor" />
          </div>
          <div>
            <strong>OIL<span>GUARD</span></strong>
            <small>MONITORAMENTO INTELIGENTE</small>
          </div>
        </div>

        <div className="sidebar-label">MENU PRINCIPAL</div>

        <nav className="side-nav">
          {desktopNavigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-button ${section === id ? 'selected' : ''}`}
              onClick={() => handleSectionChange(id)}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              <span>{label}</span>
              {id === 'alerts' && data?.summary?.activeAlerts && (
                <b>{data.summary.activeAlerts}</b>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-card">
            <div className="system-card-icon">
              <Settings2 size={16} />
            </div>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role === 'admin' ? 'Administrador' : 'Operador'}</small>
            </div>
            <ConnectionIndicator status={connectionStatus} size="sm" showLabel={false} lastUpdate={lastSuccessfulRefresh} />
          </div>
          <div className="sidebar-version">
            OILGUARD · PROTÓTIPO 0.1.0
          </div>
        </div>
      </aside>

      {/* Área Principal */}
      <main className="main-area">
        {/* Topbar */}
        <header className="topbar">
          <div className="mobile-brand">
            <div className="brand-mark">
              <Droplet size={19} fill="currentColor" />
            </div>
            <strong>OIL<span>GUARD</span></strong>
          </div>

          <div className="breadcrumb">
            <span>OILGUARD</span>
            <b>/</b>
            <span>{title}</span>
          </div>

          <div className="topbar-right">
            <ConnectionIndicator status={connectionStatus} size="md" showLabel lastUpdate={lastSuccessfulRefresh} />

            <AudioToggle size="md" />
            <button className="refresh-button" type="button" aria-label="Sair da conta" title="Sair da conta"
              disabled={loggingOut} onClick={() => void logout()}><LogOut size={16} /></button>

            <button
              onClick={handleRefresh}
              aria-label="Atualizar dados"
              title="Atualizar dados"
              disabled={loading}
              className="refresh-button"
            >
              <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>

            <span className="topbar-date">
              {lastSuccessfulRefresh ? formatRelativeTime(lastSuccessfulRefresh.toISOString()) : '—'}
            </span>
          </div>
        </header>

        {/* Área de Conteúdo */}
        <div className="content-area">
          {logoutError && <p className="connection-warning" role="alert">{logoutError}</p>}
          {data?.dataMode === 'simulation' && <p className="simulation-notice">Ambiente de simulação · Dados de demonstração e teste</p>}
          {/* Aviso de conexão */}
          {error && (
            <div className="connection-warning">
              <WifiOff size={17} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>Não foi possível acessar o backend</strong>
                <span>{error} API configurada em {api.baseUrl || window.location.origin}.</span>
              </div>
              <button onClick={handleRefresh} className="btn btn-danger">
                Tentar novamente
              </button>
            </div>
          )}

          {/* Loading inicial */}
          {loading && !data ? (
            <div className="loading-state">
              <div className="loader" />
              <strong>Carregando OILGUARD...</strong>
              <span>Conectando ao serviço de monitoramento.</span>
            </div>
          ) : data ? (
            <>
              {section === 'dashboard' && (
                <Dashboard data={data} onAlertChange={() => {}} />
              )}
              {section === 'tanks' && <TanksPage data={data} />}
              {section === 'charts' && <Charts data={data} />}
              {section === 'alerts' && <Alerts data={data} />}
              {section === 'history-reports' && <HistoryAndReports data={data} />}
              {section === 'settings' && <SettingsPage user={user} tanks={data.tanks} simulation={data.dataMode === 'simulation'} onSaved={handleRefresh} />}
            </>
          ) : (
            <div className="loading-state">
              <AlertTriangle size={26} style={{ color: 'var(--danger)' }} />
              <strong>Dashboard indisponível</strong>
              <span>Inicie a API e tente novamente.</span>
            </div>
          )}

          <footer className="app-footer">
            <span>OILGUARD · Monitoramento inteligente de tendências e riscos</span>
            <span>Atualização automática a cada 5 segundos</span>
          </footer>
        </div>
      </main>

      {/* Navegação Mobile */}
      <nav className="mobile-nav" aria-label="Navegação mobile">
        {mobileNavigation.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={section === id ? 'active' : ''}
            onClick={() => handleSectionChange(id)}
          >
            <Icon size={19} />
            <span>{label}</span>
            {id === 'alerts' && data?.summary?.activeAlerts && (
              <span className="alert-dot" />
            )}
            {(section === id || (id === 'more' && mobileMoreOpen)) && (
              <span className="active-indicator" />
            )}
          </button>
        ))}
      </nav>

      {/* Mobile More Menu */}
      {mobileMoreOpen && (
        <div className="mobile-more-menu">
          {[
            { id: 'settings' as const, label: 'Configurações', icon: Settings2 },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleSectionChange(id)}
              className={`mobile-more-item ${section === id ? 'selected' : ''}`}
            >
              <Icon size={18} style={{ flexShrink: 0, color: 'var(--accent)' }} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
