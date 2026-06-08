import { Router, Request, Response } from 'express';
import { getConnection } from '../db';

const router = Router();

function logSection(title: string) {
  console.log(`\n  --- BLOG: ${title} ---`);
}

router.get('/posts', async (_req: Request, res: Response) => {
  try {
    const page = parseInt(_req.query.page as string) || 1;
    const limit = parseInt(_req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    logSection(`LISTAR POSTS (pagina ${page}, limite ${limit})`);

    const db = await getConnection();
    console.log(`  -> Query: SELECT * FROM blog_posts LIMIT ${limit} OFFSET ${offset}`);

    const [rows] = await db.query(
      'SELECT * FROM blog_posts ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const [countResult] = await db.query('SELECT COUNT(*) as total FROM blog_posts');
    const total = (countResult as any[])[0].total;

    console.log(`  <- Resultado: ${(rows as any[]).length} posts (total en DB: ${total})`);
    console.log(`  <- Paginas: ${Math.ceil(total / limit)}`);

    res.json({ data: rows, page, limit, total });
  } catch (error: any) {
    console.error(`  [!] Error: ${error.message}`);
    console.error(`  Stack: ${error.stack}`);
    res.status(500).json({ error: error.message });
  }
});

router.get('/posts/:id', async (req: Request, res: Response) => {
  try {
    logSection(`OBTENER POST ID ${req.params.id}`);

    const db = await getConnection();
    console.log(`  -> Query: SELECT * FROM blog_posts WHERE id = ${req.params.id}`);

    const [rows] = await db.query('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);

    if ((rows as any[]).length === 0) {
      console.log(`  <- Post no encontrado`);
      res.status(404).json({ error: 'Post no encontrado' });
      return;
    }

    const post = (rows as any[])[0];
    console.log(`  <- Encontrado: "${post.title}"`);

    console.log(`  -> Query: SELECT categorias del post ${req.params.id}`);
    const [categories] = await db.query(
      `SELECT c.* FROM blog_categories c
       INNER JOIN blog_post_categories pc ON c.id = pc.category_id
       WHERE pc.post_id = ?`,
      [req.params.id]
    );
    post.categories = categories;
    console.log(`  <- Categorias: ${(categories as any[]).length}`);

    res.json(post);
  } catch (error: any) {
    console.error(`  [!] Error: ${error.message}`);
    console.error(`  Stack: ${error.stack}`);
    res.status(500).json({ error: error.message });
  }
});

router.post('/posts', async (req: Request, res: Response) => {
  try {
    const { title, slug, content, excerpt, author, status, featured_image, category_ids } = req.body;

    logSection(`CREAR POST`);
    console.log(`  Datos:`);
    console.log(`    Titulo: "${title}"`);
    console.log(`    Contenido: ${content ? content.substring(0, 60) + '...' : 'vacio'}`);
    console.log(`    Autor: ${author || 'anonimo'}`);
    console.log(`    Status: ${status || 'draft'}`);
    console.log(`    Categorias: ${category_ids ? '[' + category_ids.join(', ') + ']' : 'ninguna'}`);

    if (!title || !content) {
      console.log(`  [!] Validacion fallo: title y content requeridos`);
      res.status(400).json({ error: 'title y content son requeridos' });
      return;
    }

    const db = await getConnection();
    const postSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    console.log(`  -> Slug generado: "${postSlug}"`);

    console.log(`  -> Query: INSERT INTO blog_posts`);
    const [result] = await db.query(
      `INSERT INTO blog_posts (title, slug, content, excerpt, author, status, featured_image, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [title, postSlug, content, excerpt || null, author || null, status || 'draft', featured_image || null]
    );

    const postId = (result as any).insertId;
    console.log(`  <- Post creado con ID: ${postId}`);

    if (category_ids && Array.isArray(category_ids) && category_ids.length > 0) {
      console.log(`  -> Asignando categorias: [${category_ids.join(', ')}]`);
      const values = category_ids.map((catId: number) => [postId, catId]);
      await db.query('INSERT INTO blog_post_categories (post_id, category_id) VALUES ?', [values]);
      console.log(`  <- Categorias asignadas`);
    }

    const [created] = await db.query('SELECT * FROM blog_posts WHERE id = ?', [postId]);
    console.log(`  [!] Operacion completada exitosamente`);
    res.status(201).json((created as any[])[0]);
  } catch (error: any) {
    console.error(`  [!] Error: ${error.message}`);
    console.error(`  Stack: ${error.stack}`);
    res.status(500).json({ error: error.message });
  }
});

router.put('/posts/:id', async (req: Request, res: Response) => {
  try {
    const { title, slug, content, excerpt, author, status, featured_image, category_ids } = req.body;

    logSection(`ACTUALIZAR POST ID ${req.params.id}`);

    const db = await getConnection();
    console.log(`  -> Verificando si existe el post...`);
    const [existing] = await db.query('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);

    if ((existing as any[]).length === 0) {
      console.log(`  <- Post no encontrado`);
      res.status(404).json({ error: 'Post no encontrado' });
      return;
    }

    console.log(`  <- Post actual: "${(existing as any[])[0].title}"`);
    console.log(`  -> Actualizando campos en DB...`);

    await db.query(
      `UPDATE blog_posts SET
        title = COALESCE(?, title),
        slug = COALESCE(?, slug),
        content = COALESCE(?, content),
        excerpt = COALESCE(?, excerpt),
        author = COALESCE(?, author),
        status = COALESCE(?, status),
        featured_image = COALESCE(?, featured_image),
        updated_at = NOW()
       WHERE id = ?`,
      [title, slug, content, excerpt, author, status, featured_image, req.params.id]
    );

    console.log(`  <- Campos actualizados`);

    if (category_ids && Array.isArray(category_ids)) {
      console.log(`  -> Reemplazando categorias...`);
      await db.query('DELETE FROM blog_post_categories WHERE post_id = ?', [req.params.id]);
      if (category_ids.length > 0) {
        const values = category_ids.map((catId: number) => [req.params.id, catId]);
        await db.query('INSERT INTO blog_post_categories (post_id, category_id) VALUES ?', [values]);
        console.log(`  <- Categorias: [${category_ids.join(', ')}]`);
      } else {
        console.log(`  <- Todas las categorias removidas`);
      }
    }

    const [updated] = await db.query('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);
    console.log(`  [!] Post actualizado exitosamente`);
    res.json((updated as any[])[0]);
  } catch (error: any) {
    console.error(`  [!] Error: ${error.message}`);
    console.error(`  Stack: ${error.stack}`);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/posts/:id', async (req: Request, res: Response) => {
  try {
    logSection(`ELIMINAR POST ID ${req.params.id}`);

    const db = await getConnection();
    console.log(`  -> Verificando si existe...`);
    const [existing] = await db.query('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);

    if ((existing as any[]).length === 0) {
      console.log(`  <- Post no encontrado`);
      res.status(404).json({ error: 'Post no encontrado' });
      return;
    }

    console.log(`  <- Eliminando: "${(existing as any[])[0].title}"`);
    console.log(`  -> Eliminando relaciones en blog_post_categories...`);
    await db.query('DELETE FROM blog_post_categories WHERE post_id = ?', [req.params.id]);
    console.log(`  -> Eliminando de blog_posts...`);
    await db.query('DELETE FROM blog_posts WHERE id = ?', [req.params.id]);

    console.log(`  [!] Post eliminado correctamente`);
    res.json({ message: 'Post eliminado correctamente' });
  } catch (error: any) {
    console.error(`  [!] Error: ${error.message}`);
    console.error(`  Stack: ${error.stack}`);
    res.status(500).json({ error: error.message });
  }
});

router.get('/categories', async (_req: Request, res: Response) => {
  try {
    logSection(`LISTAR CATEGORIAS`);

    const db = await getConnection();
    console.log(`  -> Query: SELECT * FROM blog_categories`);

    const [rows] = await db.query('SELECT * FROM blog_categories ORDER BY name ASC');

    console.log(`  <- Categorias encontradas: ${(rows as any[]).length}`);
    res.json(rows);
  } catch (error: any) {
    console.error(`  [!] Error: ${error.message}`);
    console.error(`  Stack: ${error.stack}`);
    res.status(500).json({ error: error.message });
  }
});

router.post('/categories', async (req: Request, res: Response) => {
  try {
    const { name, slug, description } = req.body;

    logSection(`CREAR CATEGORIA`);
    console.log(`  Nombre: "${name}"`);
    console.log(`  Descripcion: "${description || 'ninguna'}"`);

    if (!name) {
      console.log(`  [!] Validacion fallo: name requerido`);
      res.status(400).json({ error: 'name es requerido' });
      return;
    }

    const catSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    console.log(`  -> Slug: "${catSlug}"`);

    const db = await getConnection();
    console.log(`  -> Query: INSERT INTO blog_categories`);
    const [result] = await db.query(
      'INSERT INTO blog_categories (name, slug, description) VALUES (?, ?, ?)',
      [name, catSlug, description || null]
    );

    const catId = (result as any).insertId;
    console.log(`  <- Categoria creada con ID: ${catId}`);

    const [created] = await db.query('SELECT * FROM blog_categories WHERE id = ?', [catId]);
    console.log(`  [!] Categoria creada exitosamente`);
    res.status(201).json((created as any[])[0]);
  } catch (error: any) {
    console.error(`  [!] Error: ${error.message}`);
    console.error(`  Stack: ${error.stack}`);
    res.status(500).json({ error: error.message });
  }
});

router.put('/categories/:id', async (req: Request, res: Response) => {
  try {
    const { name, slug, description } = req.body;

    logSection(`ACTUALIZAR CATEGORIA ID ${req.params.id}`);

    const db = await getConnection();
    console.log(`  -> Verificando si existe...`);
    const [existing] = await db.query('SELECT * FROM blog_categories WHERE id = ?', [req.params.id]);

    if ((existing as any[]).length === 0) {
      console.log(`  <- Categoria no encontrada`);
      res.status(404).json({ error: 'Categoria no encontrada' });
      return;
    }

    console.log(`  <- Actual: "${(existing as any[])[0].name}"`);
    console.log(`  -> Ejecutando UPDATE...`);

    await db.query(
      'UPDATE blog_categories SET name = COALESCE(?, name), slug = COALESCE(?, slug), description = COALESCE(?, description) WHERE id = ?',
      [name, slug, description, req.params.id]
    );

    console.log(`  <- Campos actualizados`);

    const [updated] = await db.query('SELECT * FROM blog_categories WHERE id = ?', [req.params.id]);
    console.log(`  [!] Categoria actualizada`);
    res.json((updated as any[])[0]);
  } catch (error: any) {
    console.error(`  [!] Error: ${error.message}`);
    console.error(`  Stack: ${error.stack}`);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/categories/:id', async (req: Request, res: Response) => {
  try {
    logSection(`ELIMINAR CATEGORIA ID ${req.params.id}`);

    const db = await getConnection();
    console.log(`  -> Verificando si existe...`);
    const [existing] = await db.query('SELECT * FROM blog_categories WHERE id = ?', [req.params.id]);

    if ((existing as any[]).length === 0) {
      console.log(`  <- Categoria no encontrada`);
      res.status(404).json({ error: 'Categoria no encontrada' });
      return;
    }

    console.log(`  <- Eliminando: "${(existing as any[])[0].name}"`);
    console.log(`  -> Eliminando relaciones en blog_post_categories...`);
    await db.query('DELETE FROM blog_post_categories WHERE category_id = ?', [req.params.id]);
    console.log(`  -> Eliminando de blog_categories...`);
    await db.query('DELETE FROM blog_categories WHERE id = ?', [req.params.id]);

    console.log(`  [!] Categoria eliminada`);
    res.json({ message: 'Categoria eliminada correctamente' });
  } catch (error: any) {
    console.error(`  [!] Error: ${error.message}`);
    console.error(`  Stack: ${error.stack}`);
    res.status(500).json({ error: error.message });
  }
});

export default router;
