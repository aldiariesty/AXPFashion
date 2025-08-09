import https from 'https';
import fetch from 'node-fetch';

const TELEGRAM_BOT_TOKEN = '8020172864:AAGSAx6FbPdFCfvbqK33WbJGxBBRAB0V4CE';
const TELEGRAM_CHAT_ID = '8007864475';

const testMessage = encodeURIComponent('✅ Test koneksi dari AWS ke Telegram berhasil!');

// Paksa IPv4
const agent = new https.Agent({ family: 4 });

const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${testMessage}`;

console.log('🔍 Ngetes koneksi ke Telegram (IPv4)...');

try {
    const res = await fetch(url, { agent, timeout: 15000 });
    const data = await res.json();
    console.log('📩 Respon:', data);
} catch (err) {
    console.error('❌ Gagal konek ke Telegram:', err);
}
