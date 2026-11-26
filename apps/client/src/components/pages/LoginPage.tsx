import { useState, type FormEvent } from 'react';
import { Droplet } from 'lucide-react';
import { auth, type SessionUser } from '../../services/api';

export function LoginPage({ onLogin, initialError = '' }: {
  onLogin: (user: SessionUser) => void;
  initialError?: string;
}) {
  const [recovering, setRecovering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialError);
  const [password, setPassword] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage('');
    try {
      if (recovering) {
        await auth.recover(String(form.get('code')).trim(), password);
        setRecovering(false);
        setMessage('Senha definida. Entre com seu usuário e a nova senha.');
      } else {
        onLogin(await auth.login(String(form.get('username')), password));
      }
      setPassword('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao comunicar com a API.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand">
          <div className="brand-mark"><Droplet size={23} fill="currentColor" /></div>
          <div><strong>OIL<span>GUARD</span></strong><small>MONITORAMENTO INTELIGENTE</small></div>
        </div>
        <h1>{recovering ? 'Definir nova senha' : 'Entrar'}</h1>
        <form onSubmit={submit} key={String(recovering)} className="auth-form">
          {recovering ? (
            <label>Código de recuperação <input name="code" required autoComplete="off" maxLength={64} /></label>
          ) : (
            <label>Usuário <input name="username" required autoComplete="username" maxLength={64} /></label>
          )}
          <label>{recovering ? 'Nova senha' : 'Senha'}
            <input name="password" type="password" required minLength={recovering ? 12 : undefined} maxLength={128}
              value={password} onChange={(event) => setPassword(event.target.value)}
              autoComplete={recovering ? 'new-password' : 'current-password'} />
          </label>
          {recovering && <p>Use o código recebido do administrador. A senha deve ter pelo menos 12 caracteres.</p>}
          {message && <p role="status">{message}</p>}
          <button className="page-intro-btn save" disabled={busy}>{busy ? 'Aguarde…' : recovering ? 'Salvar senha' : 'Entrar'}</button>
        </form>
        <button className="auth-link" disabled={busy} onClick={() => {
          setRecovering(!recovering);
          setMessage('');
          setPassword('');
        }}>{recovering ? 'Voltar ao login' : 'Usar código de recuperação'}</button>
      </section>
    </main>
  );
}
