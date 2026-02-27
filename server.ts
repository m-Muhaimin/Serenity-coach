import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from 'dotenv';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './src/lib/db';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'suprvoice-secret-key';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Auth Routes
  app.post('/api/auth/signup', async (req, res) => {
    const { email, password, name } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)');
      const result = stmt.run(email, hashedPassword, name);
      const token = jwt.sign({ id: result.lastInsertRowid }, JWT_SECRET);
      res.json({ token, user: { id: result.lastInsertRowid, email, name } });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const token = jwt.sign({ id: user.id }, JWT_SECRET);
      res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Middleware to verify JWT
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.userId = decoded.id;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  // Profile Routes
  app.get('/api/profile', authenticate, (req: any, res) => {
    const user = db.prepare('SELECT id, email, name, settings, preferred_assistants, custom_training, language FROM users WHERE id = ?').get(req.userId) as any;
    res.json(user);
  });

  app.put('/api/profile', authenticate, (req: any, res) => {
    const { name, settings, preferred_assistants, custom_training, language } = req.body;
    const stmt = db.prepare(`
      UPDATE users SET 
        name = COALESCE(?, name),
        settings = COALESCE(?, settings),
        preferred_assistants = COALESCE(?, preferred_assistants),
        custom_training = COALESCE(?, custom_training),
        language = COALESCE(?, language)
      WHERE id = ?
    `);
    stmt.run(name, JSON.stringify(settings), JSON.stringify(preferred_assistants), JSON.stringify(custom_training), language, req.userId);
    res.json({ success: true });
  });

  // Interaction History
  app.get('/api/interactions', authenticate, (req: any, res) => {
    const interactions = db.prepare('SELECT * FROM interactions WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50').all(req.userId);
    res.json(interactions);
  });

  app.post('/api/interactions', authenticate, (req: any, res) => {
    const { agent_id, transcript, sentiment } = req.body;
    const stmt = db.prepare('INSERT INTO interactions (user_id, agent_id, transcript, sentiment) VALUES (?, ?, ?, ?)');
    stmt.run(req.userId, agent_id, transcript, sentiment);
    res.json({ success: true });
  });

  // Marketplace Routes
  app.get('/api/marketplace/skills', (req, res) => {
    const { search, category } = req.query;
    let query = 'SELECT ms.*, (SELECT AVG(rating) FROM skill_reviews WHERE skill_id = ms.id) as avg_rating, (SELECT COUNT(*) FROM skill_reviews WHERE skill_id = ms.id) as review_count FROM marketplace_skills ms';
    const params: any[] = [];

    if (search || category) {
      query += ' WHERE';
      if (search) {
        query += ' (name LIKE ? OR description LIKE ? OR developer LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }
      if (category) {
        if (search) query += ' AND';
        query += ' category = ?';
        params.push(category);
      }
    }

    const skills = db.prepare(query).all(...params);
    res.json(skills);
  });

  app.get('/api/marketplace/skills/:id/reviews', (req, res) => {
    const reviews = db.prepare(`
      SELECT sr.*, u.name as user_name FROM skill_reviews sr
      JOIN users u ON sr.user_id = u.id
      WHERE sr.skill_id = ?
      ORDER BY sr.timestamp DESC
    `).all(req.params.id);
    res.json(reviews);
  });

  app.post('/api/marketplace/skills/:id/reviews', authenticate, (req: any, res) => {
    const { rating, comment } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO skill_reviews (skill_id, user_id, rating, comment) VALUES (?, ?, ?, ?)');
      stmt.run(req.params.id, req.userId, rating, comment);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/marketplace/install', authenticate, (req: any, res) => {
    const { skill_id } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO user_skills (user_id, skill_id) VALUES (?, ?)');
      stmt.run(req.userId, skill_id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Skill already installed or invalid' });
    }
  });

  app.get('/api/user/skills', authenticate, (req: any, res) => {
    const skills = db.prepare(`
      SELECT ms.* FROM marketplace_skills ms
      JOIN user_skills us ON ms.id = us.skill_id
      WHERE us.user_id = ?
    `).all(req.userId);
    res.json(skills);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
