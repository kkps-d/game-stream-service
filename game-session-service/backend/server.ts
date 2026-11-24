import { apiPort } from '../ports.ts';
import { createApp } from './app.ts';
import { databasePath, readConfig } from './config.ts';
import { openDatabase } from './database.ts';

const config = readConfig();
const database = openDatabase(databasePath);
const app = await createApp(database, config);
app.listen(apiPort, '127.0.0.1', () => {
  console.log(`Game session API listening on http://127.0.0.1:${apiPort}`);
});
