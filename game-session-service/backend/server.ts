import { apiPort } from '../ports.ts';
import { databasePath, readConfig } from './config.ts';
import { openDatabase } from './database.ts';
import { createSessionServer } from './http-server.ts';

const config = readConfig();
const { db } = openDatabase(databasePath);
const server = await createSessionServer(db, config);
server.listen(apiPort, '127.0.0.1', () => {
  console.log(`Game session API listening on http://127.0.0.1:${apiPort}`);
});
