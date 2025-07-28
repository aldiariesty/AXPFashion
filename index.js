const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const fetch = require('node-fetch'); // buat kirim request ke API Telegram
const app = express();
const PORT = 3000;

// Telegram config
const TELEGRAM_BOT_TOKEN = '8020172864:AAGSAx6FbPdFCfvbqK33WbJGxBBRAB0V4CE';
const TELEGRAM_CHAT_ID = '8007864475';

// Setup database
const db = new sqlite3.Database('db.sqlite', (err) => {
  if (err) return console.error(err.message);
  console.log('Connected to SQLite DB');
});

db.run(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT,
    item TEXT,
    status TEXT DEFAULT 'pending'
  )
`);

app.use(bodyParser.json());
app.use(session({
  secret: 'axpfashion-🔥-empire',
  resave: false,
  saveUninitialized: false
}));
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get(
    'SELECT * FROM admin_users WHERE username = ? AND password = ?',
    [username, password],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(401).json({ error: 'Login gagal!' });

      req.session.loggedIn = true;
      res.status(200).json({ message: 'Login sukses!' });
    }
  );
});
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});
app.get('/admin.html', (req, res, next) => {
  if (req.session.loggedIn) {
    next(); // lanjut akses file
  } else {
    res.redirect('/login.html');
  }
});
app.use(express.static('public'));

// Route: Tambah order baru
app.post('/api/orders', (req, res) => {
  const { customer_name, item } = req.body;
  const status = 'pending'; // tambahin ini manual
  db.run(
    'INSERT INTO orders (customer_name, item, status) VALUES (?, ?, ?)',
    [customer_name, item, status],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      // Notifikasi Telegram
      const message = `🛒 Pesanan Baru!\n👤 Nama: ${customer_name}\n📦 Item: ${item}`;
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodeURIComponent(message)}`;

      fetch(url)
        .then(() => console.log('✅ Notif Telegram terkirim'))
        .catch((err) => console.error('❌ Gagal kirim notif:', err));

      res.status(200).json({ order_id: this.lastID });
    }
  );
});

// Route: Ambil semua order
app.get('/api/orders', (req, res) => {
  db.all(`SELECT * FROM orders`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`AXPFashion API running at http://localhost:${PORT}`);
});

// Konfirmasi order
app.post('/api/orders/:id/confirm', (req, res) => {
  const id = req.params.id;
  console.log('[CONFIRM] ID yang diterima:', id); // <-- ini dia

  db.run('UPDATE orders SET status = ? WHERE id = ?', ['confirmed', id], function (err) {
    if (err) {
      console.error('[CONFIRM] Error:', err.message); // <-- error juga dicetak
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

// Tolak order
app.post('/api/orders/:id/reject', (req, res) => {
  const id = req.params.id;
  console.log('[REJECT] ID yang diterima:', id); // <-- ini juga

  db.run('UPDATE orders SET status = ? WHERE id = ?', ['rejected', id], function (err) {
    if (err) {
      console.error('[REJECT] Error:', err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true });
  });
});
