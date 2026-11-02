import { networkInterfaces } from 'node:os';
import { readConfig } from './config.mjs';
import { openDatabase } from './database.mjs';
import { createApp } from './app.mjs';

const config = readConfig();
const db = openDatabase(config.databasePath);
const server = createApp({ config, db }).listen(config.port, config.host, () => {
  console.log(`Authentication backend listening on ${config.host}:${config.port}`);
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) console.log(`Phone health check: http://${address.address}:${config.port}/health`);
    }
  }
  if (config.devLogResetCodes && !config.smtp) console.log('DEVELOPMENT RESET MODE: codes are printed here; no email is sent.');
});
server.on('error', error => { console.error(`Server could not start: ${error.code}`); db.close(); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
