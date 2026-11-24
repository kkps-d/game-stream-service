import promptPassword from '@inquirer/password';
import { createAccount } from './accounts.ts';
import { databasePath } from './config.ts';
import { openDatabase } from './database.ts';

const [username, role = 'user', ...extra] = process.argv.slice(2);
if (!username || (role !== 'user' && role !== 'admin') || extra.length > 0) {
  console.error('Usage: npm run account:create -- <username> [user|admin]');
  process.exitCode = 1;
} else {
  const database = openDatabase(databasePath);
  try {
    const password = await promptPassword({ message: 'Password', mask: true });
    await createAccount(database, username, password, role);
    console.log(`Created ${role} account ${username.toLowerCase()}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Could not create account.');
    process.exitCode = 1;
  } finally {
    database.close();
  }
}
