const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: 'C:/Users/MATHEUS/AppData/Local/Google/Chrome/User Data/Default',
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars'
    ]
  });

  const page = await browser.newPage();

  await page.goto('https://shopee.com.br', { waitUntil: 'networkidle2' });

  console.log("🔥 Agora FAZ LOGIN MANUALMENTE na Shopee dentro desse navegador que abriu.");
  console.log("⚠️ NÃO FECHA essa janela até terminar o login e ver que está logado.");

  await new Promise(resolve => setTimeout(resolve, 180000));
 // 3 minutos pra você logar com calma

  console.log("✅ Se logou com sucesso, os dados estão salvos no perfil. Pode fechar agora.");
  await browser.close();
})();
