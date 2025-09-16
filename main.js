// 🚀 VIP FUNCIONALIDADES ATUALIZADAS
// Arquivo: main.js (revisado e otimizado)

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let win;
let bot;

app.disableHardwareAcceleration();

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 720,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
      webgl: false,
      disableHardwareAcceleration: true
    }
  });

  win.loadFile('ui/index.html');

  // Carrega o horário salvo após o carregamento da interface
  const horarioSalvo = fs.existsSync('./data/schedule.txt')
    ? fs.readFileSync('./data/schedule.txt', 'utf-8')
    : '';
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('load-schedule', horarioSalvo);
  });
}

app.whenReady().then(createWindow);

// ---------- BOT CONTROLLER ----------

function loadBot() {
  delete require.cache[require.resolve('./bot')];
  const botModule = require('./bot');
  botModule.init(win);
  return botModule;
}

// ---------- IPC HANDLERS ----------

// Iniciar o bot
ipcMain.on('start-bot', () => {
  if (bot && bot.stopBot) bot.stopBot();
  bot = loadBot();
  win.webContents.send('log', '🟢 Bot iniciado');
});

// Parar o bot
ipcMain.on('stop-bot', () => {
  if (bot && bot.stopBot) bot.stopBot();
  bot = null;
  win.webContents.send('log', '🔴 Bot desligado');
});

// Enviar mensagem manual
ipcMain.on('send-message', () => {
  if (bot) bot.sendManualMessage();
});

// Salvar mensagem
ipcMain.on('save-message', (e, msg) => {
  fs.writeFileSync('./data/message.txt', msg);
});

// Salvar horário de agendamento
ipcMain.on('save-schedule', (e, time) => {
  fs.writeFileSync('./data/schedule.txt', time);
  win.webContents.send('load-schedule', time);
});

// Salvar seleção de grupos
ipcMain.on('save-groups', (e, groups) => {
  fs.writeFileSync('./data/groups.json', JSON.stringify(groups));
});

// Listar grupos disponíveis
ipcMain.on('request-groups', () => {
  if (bot) bot.sendGroupList();
});

// Ativar VIP
ipcMain.on('activate-vip', (e, key) => {
  if (!bot) bot = loadBot();
  const ativado = bot.activateVIP(key);
  if (ativado) {
    win.webContents.send('vip-activated');
  } else {
    win.webContents.send('vip-denied');
  }
});

// Reconectar bot
ipcMain.on('reconnect-bot', () => {
  if (bot && bot.reconnectClient) {
    bot.reconnectClient();
  }
});

// Enviar mídia VIP
ipcMain.on('enviar-midia-vip', async () => {
  if (!bot || !bot.isClientReady() || !bot.isVipAtivado()) {
    win.webContents.send('log', '❌ VIP não ativado ou bot indisponível.');
    return;
  }

  const files = dialog.showOpenDialogSync(win, {
    title: 'Selecionar Imagens ou Vídeos',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Mídias', extensions: ['jpg', 'jpeg', 'png', 'mp4', 'mov', 'webm'] }
    ]
  });

  if (!files || files.length === 0) return;

  for (const filePath of files) {
    bot.sendMidiaVIP(filePath);
  }
});

// Handler centralizado para promoções VIP
async function handleVipPromotions(e, url) {
  if (!bot || !bot.isClientReady() || !bot.isVipAtivado()) {
    win.webContents.send('log', '❌ VIP não ativado ou bot indisponível.');
    return;
  }
  win.webContents.send('log', '🛒 Buscando promoções e enviando...');
  bot.enviarProdutoUnico(url, win); // ✅ EXISTE E FUNCIONA

}

// Aceita ambos os eventos do frontend
ipcMain.on('vip-enviar-promocoes', handleVipPromotions);
ipcMain.on('enviar-produtos-vip', handleVipPromotions);
ipcMain.on('enviar-produto-unico', async (e, url) => {
  if (!bot || !bot.isClientReady() || !bot.isVipAtivado()) {
    win.webContents.send('log', '❌ Bot não pronto ou VIP desativado.');
    return;
  }
  win.webContents.send('log', '🔎 Buscando dados do produto único...');
  bot.enviarProdutoUnico(url, win);
});
