import { db } from './database.js';
import { bootstrapPrimary, recoverPrimary } from './auth.js';
import { migrate } from './migrate.js';

try {
  await migrate();
  const command = process.argv[2];
  if (command === 'bootstrap') {
    const user = await bootstrapPrimary({
      username: process.env.ADMIN_USERNAME,
      name: process.env.ADMIN_NAME,
      password: process.env.ADMIN_PASSWORD,
    });
    console.log(`Administrador principal inicializado: ${user.username}`);
  } else if (command === 'recover') {
    const { code, expiresAt } = await recoverPrimary();
    console.log(`Código de recuperação de uso único: ${code}\nVence em: ${expiresAt}`);
  } else {
    throw new Error('Use bootstrap ou recover.');
  }
} catch (error) {
  console.error('Falha na operação administrativa.', error.code ?? error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
