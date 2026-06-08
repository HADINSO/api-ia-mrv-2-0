import mysql, { Pool } from 'mysql2/promise';

let pool: Pool | null = null;

export async function getConnection(): Promise<Pool> {
  if (!pool) {
    pool = mysql.createPool({
      host: '129.222.203.193',
      database: 'afadfdeb_mrv_interface',
      user: 'afadfdeb_mrv_blog',
      password: 'GC!qKY]+BX#&',
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}
