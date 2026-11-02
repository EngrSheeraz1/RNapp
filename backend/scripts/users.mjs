import { readConfig } from '../src/config.mjs';
import { openDatabase } from '../src/database.mjs';
const db = openDatabase(readConfig().databasePath);
console.table(db.prepare(`SELECT u.id, u.email, u.name, u.created_at,
  CASE WHEN u.password_hash IS NOT NULL THEN 'password' ELSE i.provider END AS provider,
  i.provider_user_id FROM users u LEFT JOIN identities i ON i.user_id = u.id ORDER BY u.created_at`).all());
db.close();
