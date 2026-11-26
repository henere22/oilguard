import { useEffect, useState, type FormEvent } from 'react';
import { auth, type RecoveryCode, type SessionUser } from '../../services/api';

export function UsersPage({ user }: { user: SessionUser }) {
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [recovery, setRecovery] = useState<(RecoveryCode & { username: string }) | null>(null);

  useEffect(() => {
    let active = true;
    auth.users().then(({ data }) => { if (active) setUsers(data); })
      .catch((error: Error) => { if (active) setMessage(error.message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function work(action: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage('');
    setRecovery(null);
    try {
      await action();
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao acessar os usuários.');
    } finally {
      setBusy(false);
    }
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void work(async () => {
      const created = await auth.createUser({
        name: String(data.get('name')), username: String(data.get('username')),
        role: data.get('role') === 'admin' ? 'admin' : 'operator',
      });
      setUsers((list) => [...list, created.user].sort((a, b) => a.username.localeCompare(b.username)));
      setRecovery({ code: created.code, expiresAt: created.expiresAt, username: created.user.username });
      form.reset();
    }, 'Usuário criado.');
  }

  function update(target: SessionUser, changes: Partial<Pick<SessionUser, 'active' | 'role'>>) {
    void work(async () => {
      const result = await auth.updateUser(target.id, changes);
      setUsers((list) => list.map((item) => item.id === target.id ? result.user : item));
    }, 'Conta atualizada.');
  }

  return (
    <article className="settings-section user-admin">
      <h2>Usuários</h2>
      <form className="user-create auth-form" onSubmit={create}>
        <label>Nome <input name="name" required maxLength={100} /></label>
        <label>Usuário <input name="username" required minLength={3} maxLength={64} pattern="[A-Za-z0-9._\\-]+" /></label>
        {user.primary && <label>Perfil <select name="role"><option value="operator">Operador</option><option value="admin">Administrador</option></select></label>}
        <button className="page-intro-btn save" disabled={busy}>Criar usuário</button>
      </form>
      {message && <p role="status">{message}</p>}
      {recovery && <div className="recovery-code">
        <strong>Código de uso único para {recovery.username}</strong>
        <p>Entregue o código por um canal privado. Válido até {new Date(recovery.expiresAt).toLocaleString('pt-BR')}.</p>
        <input aria-label="Código de recuperação" readOnly value={recovery.code} onFocus={(event) => event.target.select()} />
        <button type="button" className="auth-link" onClick={() => setRecovery(null)}>Ocultar código</button>
      </div>}
      <ul className="user-list">
        {users.map((target) => {
          const canManage = !target.primary && (user.primary || target.role === 'operator');
          return (
            <li key={target.id}>
              <div><strong>{target.name}</strong><small>{target.username} · {target.primary ? 'Administrador principal' : target.role === 'admin' ? 'Administrador' : 'Operador'} · {target.active ? 'Ativo' : 'Inativo'}</small></div>
              {canManage && <div className="user-actions">
                {user.primary && <select aria-label={`Perfil de ${target.username}`} disabled={busy} value={target.role}
                  onChange={(event) => update(target, { role: event.target.value === 'admin' ? 'admin' : 'operator' })}>
                  <option value="operator">Operador</option><option value="admin">Administrador</option>
                </select>}
                <button className="page-intro-btn reset" disabled={busy} onClick={() => update(target, { active: !target.active })}>{target.active ? 'Desativar' : 'Reativar'}</button>
                <button className="page-intro-btn reset" disabled={busy || !target.active} onClick={() => void work(async () => {
                  setRecovery({ ...(await auth.resetUser(target.id)), username: target.username });
                }, 'Código emitido.')}>Redefinir senha</button>
                <button className="page-intro-btn reset" disabled={busy || !target.active} onClick={() => void work(() => auth.revokeUser(target.id), 'Sessões revogadas.')}>Revogar sessões</button>
              </div>}
            </li>
          );
        })}
      </ul>
    </article>
  );
}
