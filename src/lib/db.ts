import Database from 'better-sqlite3';
import path from 'path';

const db = new Database('suprvoice.db');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    settings TEXT DEFAULT '{}',
    preferred_assistants TEXT DEFAULT '[]',
    custom_training TEXT DEFAULT '{}',
    language TEXT DEFAULT 'en'
  );

  CREATE TABLE IF NOT EXISTS interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    agent_id TEXT NOT NULL,
    transcript TEXT,
    sentiment TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS marketplace_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    developer TEXT,
    icon TEXT,
    category TEXT DEFAULT 'General',
    config TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS skill_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    rating INTEGER CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (skill_id) REFERENCES marketplace_skills(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_skills (
    user_id INTEGER NOT NULL,
    skill_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, skill_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (skill_id) REFERENCES marketplace_skills(id)
  );
`);

// Seed some marketplace skills if empty
const skillsCount = db.prepare('SELECT COUNT(*) as count FROM marketplace_skills').get() as { count: number };
if (skillsCount.count === 0) {
  const insertSkill = db.prepare('INSERT INTO marketplace_skills (name, description, developer, icon, category) VALUES (?, ?, ?, ?, ?)');
  insertSkill.run('Meditation Timer', 'A skill to set calming meditation sessions.', 'ZenDev', 'Sparkles', 'Wellness');
  insertSkill.run('Daily Quotes', 'Get inspired with a new quote every day.', 'InspireMe', 'Zap', 'Productivity');
  insertSkill.run('Sleep Sounds', 'High-quality ambient sounds for better sleep.', 'DreamSoft', 'Heart', 'Wellness');
}

export default db;
