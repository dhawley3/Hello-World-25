const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

class Database {
  constructor() {
    this.db = new sqlite3.Database(path.join(__dirname, 'users.db'));
    this.init();
  }

  init() {
    // Create users table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT,
        google_id TEXT UNIQUE,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create negotiations table to track user negotiations
    this.db.run(`
      CREATE TABLE IF NOT EXISTS negotiations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        negotiation_id TEXT UNIQUE NOT NULL,
        phone_number TEXT NOT NULL,
        user_message TEXT NOT NULL,
        order_number TEXT,
        screenshot_url TEXT,
        status TEXT DEFAULT 'pending',
        result TEXT,
        vapi_call_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Insert default admin user if not exists
    this.createDefaultUsers();
  }

  async createDefaultUsers() {
    const adminPassword = await bcrypt.hash('vapi123', 10);
    const userPassword = await bcrypt.hash('vapi123', 10);

    // Check if admin exists
    this.db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
      if (!row) {
        this.db.run(
          'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
          ['admin', 'admin@vapi.com', adminPassword, 'admin']
        );
        console.log('✅ Default admin user created');
      }
    });

    // Check if demo user exists
    this.db.get('SELECT id FROM users WHERE username = ?', ['user'], (err, row) => {
      if (!row) {
        this.db.run(
          'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
          ['user', 'user@vapi.com', userPassword, 'user']
        );
        console.log('✅ Default demo user created');
      }
    });
  }

  // User methods
  async createUser(userData) {
    return new Promise((resolve, reject) => {
      const { username, email, password, google_id, role = 'user' } = userData;
      
      if (password) {
        bcrypt.hash(password, 10, (err, hashedPassword) => {
          if (err) return reject(err);
          
          this.db.run(
            'INSERT INTO users (username, email, password, google_id, role) VALUES (?, ?, ?, ?, ?)',
            [username, email, hashedPassword, google_id, role],
            function(err) {
              if (err) return reject(err);
              resolve({ id: this.lastID, username, email, role });
            }
          );
        });
      } else {
        this.db.run(
          'INSERT INTO users (username, email, google_id, role) VALUES (?, ?, ?, ?)',
          [username, email, google_id, role],
          function(err) {
            if (err) return reject(err);
            resolve({ id: this.lastID, username, email, role });
          }
        );
      }
    });
  }

  async findUserByUsername(username) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE username = ?',
        [username],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
  }

  async findUserByEmail(email) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE email = ?',
        [email],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
  }

  async findUserByGoogleId(google_id) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE google_id = ?',
        [google_id],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
  }

  async validatePassword(password, hashedPassword) {
    return new Promise((resolve, reject) => {
      bcrypt.compare(password, hashedPassword, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  }

  async findUserById(id) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE id = ?',
        [id],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
  }

  async updateUserWithGoogleId(userId, google_id) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE users SET google_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [google_id, userId],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  async updateUserLastLogin(userId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [userId],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  // Negotiation methods
  async createNegotiation(userId, negotiationData) {
    return new Promise((resolve, reject) => {
      const { negotiation_id, phone_number, user_message, order_number, screenshot_url } = negotiationData;
      
      this.db.run(
        'INSERT INTO negotiations (user_id, negotiation_id, phone_number, user_message, order_number, screenshot_url) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, negotiation_id, phone_number, user_message, order_number, screenshot_url],
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID, negotiation_id });
        }
      );
    });
  }

  async updateNegotiationStatus(negotiation_id, status, result = null, vapi_call_id = null) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE negotiations SET status = ?, result = ?, vapi_call_id = ?, updated_at = CURRENT_TIMESTAMP WHERE negotiation_id = ?',
        [status, result, vapi_call_id, negotiation_id],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  async getNegotiationsByUser(userId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM negotiations WHERE user_id = ? ORDER BY created_at DESC',
        [userId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  async getNegotiationById(negotiation_id) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM negotiations WHERE negotiation_id = ?',
        [negotiation_id],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
  }

  close() {
    this.db.close();
  }
}

module.exports = Database;
