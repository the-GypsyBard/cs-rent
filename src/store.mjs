import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export class Store {
  constructor(dir) {
    this.dir = dir; mkdirSync(dir, {recursive:true});
    this.db = new DatabaseSync(join(dir, 'orders.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,summary TEXT NOT NULL,detail TEXT,raw TEXT,updated_at TEXT,last_attempt TEXT,error TEXT);
      CREATE TABLE IF NOT EXISTS runs(id INTEGER PRIMARY KEY,started TEXT,finished TEXT,state TEXT,report TEXT);
      CREATE TABLE IF NOT EXISTS snapshots(id INTEGER PRIMARY KEY,order_id TEXT,at TEXT,raw TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS queue(order_id TEXT PRIMARY KEY,state TEXT NOT NULL,error TEXT);
    `);
    this.db.exec("UPDATE queue SET state='pending' WHERE state='running'; UPDATE runs SET state='interrupted',finished=datetime('now') WHERE state='running'");
  }
  get(key) { const r = this.db.prepare('SELECT value FROM settings WHERE key=?').get(key); return r ? JSON.parse(r.value) : null; }
  set(key,value) { this.db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run(key,JSON.stringify(value)); }
  summary(order) { this.db.prepare('INSERT INTO orders(id,summary) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET summary=excluded.summary').run(order.id,JSON.stringify(order)); }
  enqueue(ids) { const q=this.db.prepare("INSERT INTO queue VALUES (?,'pending',NULL) ON CONFLICT(order_id) DO UPDATE SET state='pending',error=NULL"); this.db.exec('BEGIN'); try { for (const id of ids) q.run(id); this.db.exec('COMMIT'); } catch(e) { this.db.exec('ROLLBACK'); throw e; } }
  pending() { return this.db.prepare("SELECT order_id FROM queue WHERE state!='done' ORDER BY CAST(order_id AS INTEGER) DESC").all().map(x=>x.order_id); }
  save(id, detail, raw) {
    const now=new Date().toISOString(), encoded=JSON.stringify(raw);
    this.db.exec('BEGIN');
    try {
      const previous=this.db.prepare('SELECT raw FROM orders WHERE id=?').get(id)?.raw;
      if(previous!==encoded) this.db.prepare('INSERT INTO snapshots(order_id,at,raw) VALUES (?,?,?)').run(id,now,encoded);
      this.db.prepare('UPDATE orders SET detail=?,raw=?,updated_at=?,last_attempt=?,error=NULL WHERE id=?').run(JSON.stringify(detail),encoded,now,now,id);
      this.db.prepare("UPDATE queue SET state='done',error=NULL WHERE order_id=?").run(id);
      this.db.exec('COMMIT');
    } catch(e) { this.db.exec('ROLLBACK'); throw e; }
  }
  fail(id,message) { this.db.prepare("UPDATE queue SET state='failed',error=? WHERE order_id=?").run(message,id); this.db.prepare('UPDATE orders SET error=?,last_attempt=? WHERE id=?').run(message,new Date().toISOString(),id); }
  list() { return this.db.prepare('SELECT * FROM orders ORDER BY CAST(id AS INTEGER) DESC').all().map(r=>({id:r.id,summary:JSON.parse(r.summary),detail:r.detail?JSON.parse(r.detail):null,updatedAt:r.updated_at,lastAttempt:r.last_attempt,error:r.error})); }
  one(id) { const r=this.db.prepare('SELECT raw FROM orders WHERE id=?').get(id); return {...this.list().find(x=>x.id===id),raw:r?.raw?JSON.parse(r.raw):null}; }
  startRun() { return Number(this.db.prepare("INSERT INTO runs(started,state) VALUES (?,'running')").run(new Date().toISOString()).lastInsertRowid); }
  finishRun(id,state,report) { this.db.prepare('UPDATE runs SET finished=?,state=?,report=? WHERE id=?').run(new Date().toISOString(),state,JSON.stringify(report),id); }
  runs() {return this.db.prepare('SELECT * FROM runs ORDER BY id DESC LIMIT 30').all().map(r=>({...r,report:r.report?JSON.parse(r.report):null}));}
  async backup() { const path=join(this.dir,`backup-${Date.now()}.sqlite`); await backup(this.db,path); return path; }
}
