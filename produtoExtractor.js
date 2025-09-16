const axios = require('axios');
const crypto = require('crypto');
const puppeteer = require('puppeteer-extra');
const stealth = require('puppeteer-extra-plugin-stealth');
puppeteer.use(stealth());

const partner_id = 18305910584;
const partner_key = 'GYKMLHFC2O3XBRFHQ5AK3MMHLLBAJGBB';

async function extrairProdutoShopeeAPI(url) {
  const match = url.match(/\.i\.(\d+)\.(\d+)/);
  if (!match) throw new Error('Link da Shopee inválido');
  const [_, shopid, itemid] = match;

  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `/api/v4/item/get?itemid=${itemid}&shopid=${shopid}${timestamp}${partner_id}`;
  const sign = crypto.createHmac('sha256', partner_key)
    .update(`${partner_id}${baseString}${timestamp}`)
    .digest('hex');

  const finalUrl = `https://partner.shopeemobile.com/api/v4/item/get?itemid=${itemid}&shopid=${shopid}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': sign,
    'x-partner-id': partner_id,
    'x-timestamp': timestamp
  };

  const res = await axios.get(finalUrl, { headers });
  const data = res.data?.item;
  if (!data) throw new Error('Produto não encontrado na API da Shopee');

  const imagens = data.images.map(img => `https://cf.shopee.com.br/file/${img}`);
  return {
    titulo: data.name,
    imagens: imagens.slice(0, 3)
  };
}

async function extrairViaShopeePuppeteer(url, CHROME_PATH, USER_DATA_DIR) {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME_PATH,
    userDataDir: USER_DATA_DIR,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1280,800',
      '--lang=pt-BR,pt',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    ]
  });

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  await page.mouse.move(200, 200);
  await page.mouse.down();
  await page.mouse.up();
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(10000);

  const title = await page.title();
  const imagens = await page.$$eval('img', imgs =>
    imgs.map(img => img.src).filter(src =>
      src.includes('shopee') || src.includes('cf.shopee'))
  );

  await browser.close();

  return {
    titulo: title,
    imagens: Array.from(new Set(imagens)).slice(0, 3)
  };
}

async function extrairViaPuppeteer(url, CHROME_PATH, USER_DATA_DIR) {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME_PATH,
    userDataDir: USER_DATA_DIR,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1280,800',
      '--lang=pt-BR,pt',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    ]
  });

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);

  const title = await page.title();
  const imagens = await page.$$eval('img', imgs =>
    imgs.map(img => img.src).filter(src =>
      src.includes('amazon') || src.includes('alicdn') || src.includes('cloudfront'))
  );

  await browser.close();

  return {
    titulo: title,
    imagens: Array.from(new Set(imagens)).slice(0, 3)
  };
}

async function extrairProdutoUniversal(url, CHROME_PATH, USER_DATA_DIR) {
  if (url.includes('s.shopee.com.br')) {
    try {
      const response = await axios.get(url, { maxRedirects: 5 });
      const realUrl = response.request.res.responseUrl;
      if (realUrl && realUrl.includes('/i.')) {
        url = realUrl;
      } else {
        return await extrairViaShopeePuppeteer(url, CHROME_PATH, USER_DATA_DIR);
      }
    } catch {
      return await extrairViaShopeePuppeteer(url, CHROME_PATH, USER_DATA_DIR);
    }
  }

  if (url.includes('shopee.com.br')) {
    if (url.includes('/i.')) {
      return await extrairProdutoShopeeAPI(url);
    } else {
      return await extrairViaShopeePuppeteer(url, CHROME_PATH, USER_DATA_DIR);
    }
  } else if (url.includes('aliexpress.com') || url.includes('amazon')) {
    return await extrairViaPuppeteer(url, CHROME_PATH, USER_DATA_DIR);
  } else {
    throw new Error('Loja não suportada ainda');
  }
}

module.exports = {
  extrairProdutoUniversal
};