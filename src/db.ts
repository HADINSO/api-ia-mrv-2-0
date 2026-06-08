import mysql, { Pool } from 'mysql2/promise';

let pool: Pool | null = null;

export async function getConnection(): Promise<Pool> {
  if (!pool) {
    console.log(`\n  --- DB: CONECTANDO A MYSQL ---`);
    console.log(`  Host: 69.6.233.64`);
    console.log(`  Database: siste395_mrv_db_interface`);
    console.log(`  User: siste395_mrv_user_interface`);

    pool = mysql.createPool({
      host: '69.6.233.64',
      database: 'afadfdeb_mrv_interface',
      user: 'afadfdeb_mrv_blog',
      password: 'p=736lhUEoev',
      waitForConnections: true,
      connectionLimit: 10,
    });

    try {
      const connection = await pool.getConnection();
      console.log(`  [!] Conexion exitosa a MySQL`);
      connection.release();
    } catch (error: any) {
      console.error(`  [!] Error de conexion: ${error.message}`);
      throw error;
    }
  }
  return pool;
}
