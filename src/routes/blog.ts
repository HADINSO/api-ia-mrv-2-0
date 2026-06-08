import { Router, Request, Response } from 'express';
import { getConnection } from '../db';

const router = Router();

// GET /api/blog/posts - Listar posts (con paginacion)
router.get('/posts', async (_req: Request, res: Response) => {
  try {
    const page = parseInt(_req.query.page as string) || 1;
    const limit = parseInt(_req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const db = await getConnection();
    const [rows] = await db.query(
      'SELECT * FROM blog_posts ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const [countResult] = await db.query('SELECT COUNT(*) as total FROM blog_posts');
    const total = (countResult as any[])[0].total;

    res.json({ data: rows, page, limit, total });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/blog/posts/:id - Obtener un post por ID
router.get('/posts/:id', async (req: Request, res: Response) => {
  try {
    const db = await getConnection();
    const [rows] = await db.query('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);

    if ((rows as any[]).length === 0) {
      res.status(404).json({ error: 'Post no encontrado' });
      return;
    }

    const post = (rows as any[])[0];
    const [categories] = await db.query(
      `SELECT c.* FROM blog_categories c
       INNER JOIN blog_post_categories pc ON c.id = pc.category_id
       WHERE pc.post_id = ?`,
      [req.params.id]
    );
    post.categories = categories;

    res.json(post);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/blog/posts - Crear un post
router.post('/posts', async (req: Request, res: Response) => {
  try {
    const { title, slug, content, excerpt, author, status, featured_image, category_ids } = req.body;

    if (!title || !content) {
      res.status(400).json({ error: 'title y content son requeridos' });
      return;
    }

    const db = await getConnection();
    const postSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const [result] = await db.query(
      `INSERT INTO blog_posts (title, slug, content, excerpt, author, status, featured_image, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [title, postSlug, content, excerpt || null, author || null, status || 'draft', featured_image || null]
    );

    const postId = (result as any).insertId;

    if (category_ids && Array.isArray(category_ids) && category_ids.length > 0) {
      const values = category_ids.map((catId: number) => [postId, catId]);
      await db.query('INSERT INTO blog_post_categories (post_id, category_id) VALUES ?', [values]);
    }

    const [created] = await db.query('SELECT * FROM blog_posts WHERE id = ?', [postId]);
    res.status(201).json((created as any[])[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/blog/posts/:id - Actualizar un post
router.put('/posts/:id', async (req: Request, res: Response) => {
  try {
    const { title, slug, content, excerpt, author, status, featured_image, category_ids } = req.body;

    const db = await getConnection();
    const [existing] = await db.query('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);

    if ((existing as any[]).length === 0) {
      res.status(404).json({ error: 'Post no encontrado' });
      return;
    }

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

    if (category_ids && Array.isArray(category_ids)) {
      await db.query('DELETE FROM blog_post_categories WHERE post_id = ?', [req.params.id]);
      if (category_ids.length > 0) {
        const values = category_ids.map((catId: number) => [req.params.id, catId]);
        await db.query('INSERT INTO blog_post_categories (post_id, category_id) VALUES ?', [values]);
      }
    }

    const [updated] = await db.query('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);
    res.json((updated as any[])[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/blog/posts/:id - Eliminar un post
router.delete('/posts/:id', async (req: Request, res: Response) => {
  try {
    const db = await getConnection();
    const [existing] = await db.query('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);

    if ((existing as any[]).length === 0) {
      res.status(404).json({ error: 'Post no encontrado' });
      return;
    }

    await db.query('DELETE FROM blog_post_categories WHERE post_id = ?', [req.params.id]);
    await db.query('DELETE FROM blog_posts WHERE id = ?', [req.params.id]);

    res.json({ message: 'Post eliminado correctamente' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/blog/categories - Listar categorias
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const db = await getConnection();
    const [rows] = await db.query('SELECT * FROM blog_categories ORDER BY name ASC');
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/blog/categories - Crear categoria
router.post('/categories', async (req: Request, res: Response) => {
  try {
    const { name, slug, description } = req.body;

    if (!name) {
      res.status(400).json({ error: 'name es requerido' });
      return;
    }

    const catSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const db = await getConnection();
    const [result] = await db.query(
      'INSERT INTO blog_categories (name, slug, description) VALUES (?, ?, ?)',
      [name, catSlug, description || null]
    );

    const catId = (result as any).insertId;
    const [created] = await db.query('SELECT * FROM blog_categories WHERE id = ?', [catId]);
    res.status(201).json((created as any[])[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/blog/categories/:id - Actualizar categoria
router.put('/categories/:id', async (req: Request, res: Response) => {
  try {
    const { name, slug, description } = req.body;

    const db = await getConnection();
    const [existing] = await db.query('SELECT * FROM blog_categories WHERE id = ?', [req.params.id]);

    if ((existing as any[]).length === 0) {
      res.status(404).json({ error: 'Categoria no encontrada' });
      return;
    }

    await db.query(
      'UPDATE blog_categories SET name = COALESCE(?, name), slug = COALESCE(?, slug), description = COALESCE(?, description) WHERE id = ?',
      [name, slug, description, req.params.id]
    );

    const [updated] = await db.query('SELECT * FROM blog_categories WHERE id = ?', [req.params.id]);
    res.json((updated as any[])[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/blog/categories/:id - Eliminar categoria
router.delete('/categories/:id', async (req: Request, res: Response) => {
  try {
    const db = await getConnection();
    const [existing] = await db.query('SELECT * FROM blog_categories WHERE id = ?', [req.params.id]);

    if ((existing as any[]).length === 0) {
      res.status(404).json({ error: 'Categoria no encontrada' });
      return;
    }

    await db.query('DELETE FROM blog_post_categories WHERE category_id = ?', [req.params.id]);
    await db.query('DELETE FROM blog_categories WHERE id = ?', [req.params.id]);

    res.json({ message: 'Categoria eliminada correctamente' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
