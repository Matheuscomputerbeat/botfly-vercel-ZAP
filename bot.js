const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const schedule = require('node-schedule');
const puppeteer = require('puppeteer-core');
const axios = require('axios');
const { extrairProdutoUniversal } = require('./produtoExtractor'); // <- Lógica universal de scraping

let client;
let win;
let clientReady = false;
let vipAtivado = false;
let jobAgendado = null;

// Caminhos do Chrome e profile do usuário
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const USER_DATA_DIR = 'C:/Users/MATHEUS/AppData/Local/Google/Chrome/User Data/Default';

function init(mainWindow) {
  win = mainWindow;

  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      executablePath: CHROME_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        `--user-data-dir=${USER_DATA_DIR}`
      ]
    }
  });

  client.on('qr', qr => win.webContents.send('qr-code', qr));
  client.on('ready', () => {
    clientReady = true;
    win.webContents.send('log', '✅ Bot pronto e conectado!');
    scheduleMessage();
    setTimeout(sendGroupList, 3000);
  });
  client.on('disconnected', () => {
    clientReady = false;
    win.webContents.send('log', '⚠️ Bot desconectado. Tentando reconectar...');
    setTimeout(() => client.initialize(), 5000);
  });
  client.initialize();

  try {
    vipAtivado = fs.existsSync('./data/vip.json') && JSON.parse(fs.readFileSync('./data/vip.json')).ativado;
  } catch (e) {
    vipAtivado = false;
  }

  fs.watchFile('./data/schedule.txt', scheduleMessage);
}

function stopBot() {
  if (client) {
    client.destroy();
    clientReady = false;
    win.webContents.send('log', '🔴 Bot foi desligado manualmente.');
  }
}

function sendManualMessage() {
  if (!clientReady) return;
  const msg = fs.readFileSync('./data/message.txt', 'utf-8');
  let groups = JSON.parse(fs.readFileSync('./data/groups.json', 'utf-8'));
  if (!Array.isArray(groups)) groups = [groups];

  (async () => {
    for (const id of groups) {
      try {
        const chat = await client.getChatById(id);
        await chat.sendMessage(msg);
        win.webContents.send('log', `✅ Mensagem enviada para: ${chat.name || id}`);
        await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        win.webContents.send('log', `❌ Erro ao enviar para ${id}: ${err.message}`);
      }
    }
  })();
}

function scheduleMessage() {
  try {
    const horario = fs.readFileSync('./data/schedule.txt', 'utf-8').trim();
    const [hourStr, minuteStr] = horario.split(':');
    const hour = parseInt(hourStr);
    const minute = parseInt(minuteStr);
    if (isNaN(hour) || isNaN(minute)) return;

    if (jobAgendado) jobAgendado.cancel();

    jobAgendado = schedule.scheduleJob({ hour, minute, second: 0 }, () => {
      if (clientReady) sendManualMessage();
    });
    win.webContents.send('log', `📅 Novo agendamento: ${horario}`);
  } catch (err) {
    win.webContents.send('log', '⚠️ Erro ao configurar agendamento: ' + err.message);
  }
}

function sendGroupList() {
  if (!client || !clientReady) return;
  client.getChats().then(chats => {
    const groups = chats.filter(chat => chat.isGroup).map(chat => ({
      id: chat.id._serialized,
      name: chat.name
    }));
    win.webContents.send('group-list', groups);
  });
}

function activateVIP(key) {
  if (key === 'vip123') {
    vipAtivado = true;
    fs.writeFileSync('./data/vip.json', JSON.stringify({ ativado: true }));
    win.webContents.send('vip-activated');
    win.webContents.send('log', '🔓 VIP ativado com sucesso!');
    return true;
  } else {
    win.webContents.send('vip-denied');
    win.webContents.send('log', '❌ Senha VIP incorreta.');
    return false;
  }
}

async function sendMidiaVIP(filePath) {
  try {
    const media = await MessageMedia.fromFilePath(filePath);
    const grupos = JSON.parse(fs.readFileSync('./data/groups.json', 'utf-8'));
    let caption = '';
    try {
      caption = fs.readFileSync('./data/message.txt', 'utf-8').trim();
    } catch (_) {}

    for (const id of grupos) {
      const chat = await client.getChatById(id);
      await chat.sendMessage(media, { caption });
      win.webContents.send('log', `📷 Mídia enviada para: ${chat.name || id}`);
    }
  } catch (err) {
    win.webContents.send('log', `❌ Erro ao enviar mídia: ${err.message}`);
  }
}

async function enviarProdutoUnico(affUrl, win) {
  try {
    const enviadosPath = './data/enviados.json';
    let enviados = fs.existsSync(enviadosPath) ? JSON.parse(fs.readFileSync(enviadosPath)) : [];

    if (enviados.includes(affUrl)) {
      win.webContents.send('log', '⚠️ Produto já enviado anteriormente.');
      return;
    }

    // Universal extractor: pega título e imagens independente da loja
    const { titulo, imagens } = await extrairProdutoUniversal(affUrl, CHROME_PATH, USER_DATA_DIR);
    const grupos = JSON.parse(fs.readFileSync('./data/groups.json', 'utf-8'));

    for (const id of grupos) {
      const chat = await client.getChatById(id);
      for (const src of imagens) {
        const buffer = await axios.get(src, { responseType: 'arraybuffer' });
        const media = new MessageMedia('image/jpeg', buffer.data.toString('base64'));
        await chat.sendMessage(media, {
          caption: `🛒 ${titulo}\n👉 ${affUrl}`
        });
      }
      win.webContents.send('log', `✅ Produto enviado para: ${chat.name || id}`);
    }

    enviados.push(affUrl);
    fs.writeFileSync(enviadosPath, JSON.stringify(enviados, null, 2));
  } catch (err) {
    win.webContents.send('log', `❌ Erro ao enviar produto: ${err.message}`);
  }
}

function reconnectClient() {
  if (!clientReady && client) {
    win.webContents.send('log', '🔁 Tentando reconectar...');
    client.destroy().then(() => client.initialize());
  }
}

module.exports = {
  init,
  stopBot,
  sendManualMessage,
  sendGroupList,
  activateVIP,
  reconnectClient,
  isClientReady: () => clientReady,
  isVipAtivado: () => vipAtivado,
  sendMidiaVIP,
  enviarProdutoUnico
};