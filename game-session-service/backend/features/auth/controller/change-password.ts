import promptPassword from '@inquirer/password';
import { databasePath } from '../../../config.ts';
import { openDatabase } from '../../../database.ts';
import { changeAccountPassword } from '../services/accounts.ts';

const [username, passwordArgument, ...extra] = process.argv.slice(2);
if (!username || extra.length > 0) {
  console.error('Usage: npm run account:password -- <username> [password]');
  process.exitCode = 1;
} else {
  try {
    const { db, close } = openDatabase(databasePath);
    try {
      const password =
        passwordArgument ?? (await promptPassword({ message: 'New password', mask: true }));
      await changeAccountPassword(db, username, password);
      console.log(`Changed the password for ${username.toLowerCase()}.`);
    } finally {
      close();
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Could not change the password.');
    process.exitCode = 1;
  }
}
