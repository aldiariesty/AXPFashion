const { exec } = require('child_process');
const imageSize = require('image-size');

// --- MASUKKAN DATA ANDA DI SINI ---
const CJ_EMAIL = 'aldixplay0@gmail.com';

const CJ_API_KEY = '5b4994492acd436590e14dbdadd491ca';
// ------------------------------------

const BASE_URL = 'https://developers.cjdropshipping.com/api2.0/v1';
let accessToken = null;

function getAccessToken() {
  return new Promise((resolve, reject) => {
    console.log('Mencoba mendapatkan Access Token baru via curl...');
    const endpoint = '/authentication/getAccessToken';
    const url = `${BASE_URL}${endpoint}`;
    const body = JSON.stringify({ email: CJ_EMAIL, password: CJ_API_KEY });

    const command = `curl -s -X POST -H "Content-Type: application/json" -d '${body}' "${url}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) return reject(new Error(`Exec error: ${error.message}`));
      if (stderr) return reject(new Error(`Curl stderr: ${stderr}`));
      
      try {
        const data = JSON.parse(stdout);
        if (data.result !== true || !data.data || !data.data.accessToken) {
          return reject(new Error(`Gagal mendapatkan Access Token: ${data.message || 'Respons tidak valid'}`));
        }
        accessToken = data.data.accessToken;
        console.log('✅ Access Token baru berhasil didapatkan!');
        resolve(accessToken);
      } catch (e) {
        reject(new Error(`Gagal mem-parsing respons token: ${e.message}`));
      }
    });
  });
}

function cjApiRequest(endpoint, method = 'GET') {
    return new Promise(async (resolve, reject) => {
        if (!accessToken) {
            try {
                await getAccessToken();
            } catch (e) {
                return reject(e);
            }
        }

        const url = `${BASE_URL}${endpoint}`;
        const command = `curl -s -X ${method} -H "CJ-Access-Token: ${accessToken}" "${url}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) return reject(new Error(`Exec error: ${error.message}`));
            if (stderr) return reject(new Error(`Curl stderr: ${stderr}`));

            try {
                const data = JSON.parse(stdout);
                resolve(data);
            } catch (e) {
                reject(new Error(`Gagal mem-parsing respons API: ${e.message}`));
            }
        });
    });
}

async function cariProduk(kataKunci) {
    const endpoint = `/product/list?productNameEn=${encodeURIComponent(kataKunci)}&pageSize=20`;
    try {
        console.log(`Mencari produk di CJ dengan kata kunci: "${kataKunci}"`);
        const data = await cjApiRequest(endpoint, 'GET');

        if (data.result !== true) {
            if (data.message && data.message.toLowerCase().includes('token')) {
                console.log('Access Token kemungkinan expired. Mencoba mengambil token baru...');
                accessToken = null; // Reset token
                const newData = await cjApiRequest(endpoint, 'GET');
                if (newData.result !== true) throw new Error(`CJ API Error setelah refresh: ${newData.message}`);
                return newData.data;
            }
            throw new Error(`CJ API Error: ${data.message}`);
        }
        console.log(`✅ Berhasil menemukan ${data.data.list.length} produk.`);
        return data.data;
    } catch (error) {
        console.error('❌ Terjadi kesalahan saat mencari produk:', error.message);
        return null;
    }
}

// Fungsi getProdukDetail dan getDimensions tetap sama seperti versi curl sebelumnya
function getDimensions(url) { /* ... kode sama ... */ }
async function getProdukDetail(pid) { /* ... kode sama ... */ }


// --- Implementasi lengkap fungsi yang diringkas ---
function getDimensions(url) {
  return new Promise((resolve, reject) => {
    const command = `curl -s --max-time 10 -r 0-32768 "${url}"`;
    exec(command, { encoding: 'buffer' }, (error, stdout, stderr) => {
      if (error || !stdout || stdout.length < 100) return reject(new Error('Curl gagal mengambil data gambar.'));
      try { resolve(imageSize(stdout)); } catch (e) { reject(e); }
    });
  });
}
async function getProdukDetail(pid) {
  console.log(`Mengambil detail untuk produk PID: ${pid}`);
  const endpoint = `/product/query?pid=${pid}`;
  try {
    const data = await cjApiRequest(endpoint, 'GET');
    if (data.result !== true) throw new Error(`CJ API Error: ${data.message}`);
    console.log(`✅ Detail mentah untuk produk ${pid} berhasil didapatkan.`);
    // ... sisa logika penyaringan gambar ...
    return data.data;
  } catch (error) {
    console.error(`❌ Gagal mengambil detail produk ${pid}:`, error.message);
    return null;
  }
}


module.exports = {
  cariProduk,
  getProdukDetail
};
