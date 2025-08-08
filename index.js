const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const fetch = require('node-fetch');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { cariProduk, getProdukDetail } = require('./cj-api.js');

const app = express();
const PORT = 3000;

const TELEGRAM_BOT_TOKEN = '8020172864:AAGSAx6FbPdFCfvbqK33WbJGxBBRAB0V4CE';
const TELEGRAM_CHAT_ID = '8007864475';

app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
  secret: 'axpfashion-🔥-empire',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

const uploadDir = 'public/uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now();
    const extension = path.extname(file.originalname);
    cb(null, `file-${uniqueSuffix}${extension}`);
  }
});
const upload = multer({ storage: storage });

const db = new sqlite3.Database('db.sqlite', (err) => {
  if (err) return console.error("Error saat koneksi ke database:", err.message);
  console.log('Connected to SQLite DB');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_name TEXT, items_summary TEXT, status TEXT DEFAULT 'Menunggu Pembayaran', payment_proof_path TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS products (pid TEXT PRIMARY KEY, name TEXT, description TEXT, main_image TEXT, gallery_images TEXT, price TEXT, variants TEXT, source_url TEXT, is_published BOOLEAN DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS admin_users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT)`);
});

const requireLogin = (req, res, next) => {
  if (req.session && req.session.loggedIn) {
    next();
  } else {
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Sesi habis, silakan login kembali.' });
    }
    res.redirect('/login.html');
  }
};

// ROUTES
app.get('/admin.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/my-products.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'my-products.html')));
app.get('/add-product.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'add-product.html')));
app.get('/edit-product.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'edit-product.html')));

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM admin_users WHERE username = ? AND password = ?', [username, password], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(401).json({ error: 'Login gagal!' });
        req.session.loggedIn = true;
        res.status(200).json({ message: 'Login sukses!' });
    });
});
app.get('/logout', (req, res) => {
    req.session.destroy(() => { res.redirect('/login.html'); });
});

app.get('/api/products/search/:keyword', requireLogin, async (req, res) => {
    const { keyword } = req.params;
    const searchResult = await cariProduk(keyword);
    if (searchResult && searchResult.list) {
        const products = searchResult.list.map(p => ({ id: p.pid, name: p.productNameEn, image: p.productImage, price: p.sellPrice }));
        res.json(products);
    } else {
        res.status(500).json({ error: 'Gagal mengambil data produk dari supplier.' });
    }
});

app.post('/api/products/import', requireLogin, async (req, res) => {
    const { pid } = req.body;
    const productDetail = await getProdukDetail(pid);
    if (!productDetail) return res.status(500).json({ error: 'Gagal mengambil detail dari supplier.' });
    let { productNameEn, productImage, productImageSet, variants, productUrl, description, sellPrice } = productDetail;
    const allImages = new Set();
    if (productImage) allImages.add(productImage);
    if (Array.isArray(productImageSet)) productImageSet.forEach(img => allImages.add(img));
    if (Array.isArray(variants)) variants.forEach(v => { if(v.variantImage) allImages.add(v.variantImage); });
    const galleryImages = Array.from(allImages);
    const mainImage = galleryImages[0] || null;
    if (!productUrl) {
        const slug = productNameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        productUrl = `https://cjdropshipping.com/product/${slug}-p-${pid}.html`;
    }
    const cleanDescription = description ? description.replace(/<[^>]*>/g, '') : '';
    const variantsWithMarkup = (variants || []).map(v => ({...v, customSellPrice: (v.variantSellPrice * 1.5).toFixed(2), isForSale: true }));
    db.run('INSERT OR REPLACE INTO products (pid, name, main_image, gallery_images, price, description, variants, source_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [pid, productNameEn, mainImage, JSON.stringify(galleryImages), sellPrice, cleanDescription, JSON.stringify(variantsWithMarkup), productUrl],
        (err) => {
            if (err) return res.status(500).json({ error: 'Gagal menyimpan produk.' });
            res.status(201).json({ message: 'Produk berhasil diimpor.' });
        }
    );
});

app.post('/api/product/:pid', requireLogin, upload.array('new_images', 10), (req, res) => {
    const { pid } = req.params;
    const { name, description, variants, main_image, existing_images } = req.body;
    let newImagePaths = [];
    if (req.files && req.files.length > 0) {
        newImagePaths = req.files.map(file => '/' + file.path.replace(/\\/g, '/').replace('public/', ''));
    }
    const existingImages = existing_images ? JSON.parse(existing_images) : [];
    const finalGallery = [...existingImages, ...newImagePaths];
    db.run('UPDATE products SET name = ?, description = ?, main_image = ?, gallery_images = ?, variants = ? WHERE pid = ?',
        [name, description, main_image, JSON.stringify(finalGallery), variants, pid],
        (err) => {
            if (err) return res.status(500).json({ error: 'Gagal menyimpan perubahan.' });
            res.status(200).json({ message: 'Perubahan berhasil disimpan.' });
        }
    );
});

app.get('/api/products', (req, res) => { db.all('SELECT * FROM products', [], (err, rows) => { if (err) return res.status(500).json({ error: 'Gagal mengambil produk.' }); res.json(rows); }); });
app.get('/api/product/:pid', (req, res) => { const { pid } = req.params; db.get('SELECT * FROM products WHERE pid = ?', [pid], (err, row) => { if (err) return res.status(500).json({ error: 'Gagal mengambil data.' }); if (!row) return res.status(404).json({ error: 'Produk tidak ditemukan.' }); res.json(row); }); });
app.post('/api/products/delete/:pid', requireLogin, (req, res) => { const { pid } = req.params; db.run('DELETE FROM products WHERE pid = ?', [pid], (err) => { if (err) return res.status(500).json({ error: 'Gagal menghapus produk.' }); res.status(200).json({ message: 'Produk berhasil dihapus.' }); }); });
app.get('/api/image-proxy', async (req, res) => { const imageUrl = req.query.url; if (!imageUrl) return res.status(400).send('URL gambar diperlukan.'); try { const response = await fetch(imageUrl); if (!response.ok) throw new Error('Gagal mengambil gambar.'); const contentType = response.headers.get('content-type'); res.setHeader('Content-Type', contentType); response.body.pipe(res); } catch (error) { res.status(500).send('Gagal memuat gambar.'); } });

app.get('/api/orders', requireLogin, (req, res) => { db.all(`SELECT * FROM orders ORDER BY id DESC`, (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); }); });
app.post('/api/orders', (req, res) => { const { customer_name, item } = req.body; const status = 'Menunggu Pembayaran'; db.run('INSERT INTO orders (customer_name, items_summary, status) VALUES (?, ?, ?)', [customer_name, item, status], function (err) { if (err) return res.status(500).json({ error: err.message }); const orderId = this.lastID; const message = `🛒 Pesanan Baru! (ID: ${orderId})\n\n👤 Nama: ${customer_name}\n📦 Item: ${item}`; const encodedMessage = encodeURIComponent(message); const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodedMessage}`; fetch(url).catch(err => console.error(err)); res.status(201).json({ order_id: orderId }); }); });
app.post('/api/confirm-payment', upload.single('payment_proof'), (req, res) => { const { order_id } = req.body; const paymentProofFile = req.file; if (!order_id || !paymentProofFile) return res.status(400).json({ error: 'Nomor Pesanan dan bukti transfer wajib diisi.' }); const newStatus = 'Menunggu Konfirmasi'; const filePath = '/' + paymentProofFile.path.replace(/\\/g, '/').replace('public/', ''); db.run('UPDATE orders SET status = ?, payment_proof_path = ? WHERE id = ?', [newStatus, filePath, order_id], function(err) { if (err) return res.status(500).json({ error: 'Gagal update database.' }); if (this.changes === 0) return res.status(404).json({ error: 'Order ID tidak ditemukan.' }); const message = `🔔 Konfirmasi Diterima!\n\nOrder ID: #${order_id}\nSilakan verifikasi pembayaran.`; const encodedMessage = encodeURIComponent(message); const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodedMessage}`; fetch(url).catch(err => console.error(err)); res.status(200).json({ message: 'Konfirmasi berhasil diterima.' }); }); });
app.post('/api/orders/:id/confirm', requireLogin, (req, res) => { const id = req.params.id; db.run('UPDATE orders SET status = ? WHERE id = ?', ['Diproses', id], (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ success: true }); }); });
app.post('/api/orders/:id/reject', requireLogin, (req, res) => { const id = req.params.id; db.run('UPDATE orders SET status = ? WHERE id = ?', ['Ditolak', id], (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ success: true }); }); });

app.listen(PORT, () => {
  console.log(`AXPFashion API running at http://localhost:${PORT}`);
});
