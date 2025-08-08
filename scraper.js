const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function scrapeProduct(url) {
  console.log(`🚀 Meluncurkan browser mode STEALTH untuk target Tokopedia...`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  try {
    console.log(`Mengunjungi halaman produk: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('Halaman berhasil dimuat. Mengambil screenshot untuk dianalisis...');
    // --- MATA-MATA KITA ---
    // Mengambil screenshot dari apa yang dilihat bot
    await page.screenshot({ path: 'tokopedia_view.png', fullPage: true });
    console.log('Screenshot disimpan sebagai tokopedia_view.png');

    const nameSelector = 'h1[data-testid="lblPDPDetailProductName"]';
    const priceSelector = 'div[data-testid="lblPDPDetailProductPrice"]';
    const imageContainerSelector = 'div[data-testid="PDPImageMain"]';
    
    await page.waitForSelector(priceSelector, { timeout: 30000 }); 

    const productData = await page.evaluate((nameSel, priceSel, imageContainerSel) => {
        const nameElement = document.querySelector(nameSel);
        const name = nameElement ? nameElement.textContent.trim() : 'Nama tidak ditemukan';

        const priceElement = document.querySelector(priceSel);
        const price = priceElement ? priceElement.textContent.trim() : 'Harga tidak ditemukan';

        // --- LOGIKA BARU YANG LEBIH CANGGIH UNTUK GAMBAR ---
        let imageUrl = 'Gambar tidak ditemukan';
        const imageContainer = document.querySelector(imageContainerSel);
        if (imageContainer) {
            const imageElement = imageContainer.querySelector('img');
            if (imageElement) {
                // Cek atribut 'srcset' dulu, karena seringkali berisi gambar resolusi tinggi
                if (imageElement.srcset) {
                    // Ambil URL pertama dari daftar srcset
                    imageUrl = imageElement.srcset.split(',')[0].split(' ')[0];
                } else {
                    // Jika tidak ada srcset, baru ambil dari src
                    imageUrl = imageElement.src;
                }
            }
        }
        
        return { name, price, imageUrl };
    }, nameSelector, priceSelector, imageContainerSelector);

    if (!productData.name || !productData.price) {
        throw new Error('Gagal menemukan nama atau harga produk.');
    }

    console.log('✅ Data berhasil diambil:');
    console.log(productData);
    
  } catch (error) {
    console.error(`❌ Terjadi kesalahan saat scraping:`, error.message);
    
  } finally {
    await browser.close();
    console.log('Browser telah ditutup.');
  }
}

const targetUrl = 'https://www.tokopedia.com/hijabnindi/pashmina-plisket-ceruty-babby-doll-premium-rondom';
scrapeProduct(targetUrl);
