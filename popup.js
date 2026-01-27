// Estagiario Extension - popup-v2.js
// VERSÃO 2.0.0 - Histórico via Firestore + Modo Chat Only
// ============================================

const APP_VERSION = '2.0.0';


// ============================================
// 🔒 PROTEÇÃO CONTRA DEVTOOLS (DESATIVADO)
// ============================================


// Bloquear teclas de atalho do DevTools
document.addEventListener('keydown', function(e) {
  // F12
  if (e.keyCode === 123) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
  
  // Ctrl+Shift+I (DevTools)
  if (e.ctrlKey && e.shiftKey && e.keyCode === 73) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
  
  // Ctrl+Shift+J (Console)
  if (e.ctrlKey && e.shiftKey && e.keyCode === 74) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
  
  // Ctrl+U (View Source)
  if (e.ctrlKey && e.keyCode === 85) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
  
  // Ctrl+Shift+C (Inspect Element)
  if (e.ctrlKey && e.shiftKey && e.keyCode === 67) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
  
  // Ctrl+S (Save)
  if (e.ctrlKey && e.keyCode === 83) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
});

// Bloquear clique direito
document.addEventListener('contextmenu', function(e) {
  e.preventDefault();
  e.stopPropagation();
  return false;
});

// Bloquear seleção de texto
document.addEventListener('selectstart', function(e) {
  e.preventDefault();
  return false;
});

// Bloquear arrastar
document.addEventListener('dragstart', function(e) {
  e.preventDefault();
  return false;
});

// Detectar se DevTools está aberto (método básico)
let devtools = {
  open: false,
  orientation: null
};

// Definir threshold localmente para evitar conflitos
const devToolsThreshold = 160;

setInterval(() => {
  if (window.outerHeight - window.innerHeight > devToolsThreshold || 
      window.outerWidth - window.innerWidth > devToolsThreshold) {
    if (!devtools.open) {
      devtools.open = true;
      console.clear();
      // Opcional: fechar a extensão se DevTools for detectado
      // window.close();
    }
  } else {
    devtools.open = false;
  }
}, 500);

// Limpar console periodicamente
setInterval(() => {
  console.clear();
}, 1000);

// Sobrescrever console methods
const noop = () => {};
if (typeof console !== 'undefined') {
  console.log = noop;
  console.warn = noop;
  console.error = noop;
  console.info = noop;
  console.debug = noop;
  console.trace = noop;
}


// ============================================
// RESTO DO CÓDIGO ORIGINAL
// ============================================

const crypto = globalThis.crypto;
if (!crypto || !crypto.getRandomValues) {
  throw new Error('Web Crypto API unavailable in this context.');
}

// DOM Elements
const historyEl = document.getElementById('history');
const messageEl = document.getElementById('message');
const statusEl = document.getElementById('status');
const sendBtn = document.getElementById('sendBtn');
const restartBtn = document.getElementById('restartBtn');
const verifyBtn = document.getElementById('verifyBtn');
const saveBtn = document.getElementById('saveBtn');
const historyBtn = document.getElementById('historyBtn');
const presenceBtn = document.getElementById('presenceBtn');
const tokenBadge = document.getElementById('tokenBadge');
const uploadInput = document.getElementById('uploadInput');
const uploadBtn = document.getElementById('uploadBtn');
const fileInfoEl = document.getElementById('fileInfo');
const uploadLabel = document.querySelector('.upload-label');
const licenseInput = document.getElementById('licenseInput');
const activateBtn = document.getElementById('activateBtn');
const authStatus = document.getElementById('authStatus');
const licenseInfo = document.getElementById('licenseInfo');
const blockedOverlay = document.getElementById('blockedOverlay');
const chatOnlyCheckbox = document.getElementById('chatOnlyCheckbox');

// State
let projectId = '';
let authToken = '';
let sessionToken = '';
let licenseKey = '';
let licenseData = null;
let messages = [];
let tokenCount = 0;
let fileMeta = { id: '', name: '', preview: '' };
let checkInterval = null;
let chatOnlyMode = false;

// Constants
const CROCKFORD32 = '0123456789abcdefghjkmnpqrstvwxyz';

// ============================================
// 🔧 CONFIGURAÇÃO DA API
// Vai direto para o Supabase Edge Functions
// ============================================
const SUPABASE_URL = 'https://aypdymvyiunbsyxfwisc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5cGR5bXZ5aXVuYnN5eGZ3aXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NTEyNjUsImV4cCI6MjA4NTEyNzI2NX0.qSRwGEORbSwZDehtDq1uTpUloclg3Dk4O4O8SD8VhyA';

const AUTH_URL = SUPABASE_URL + '/functions/v1/radioai-authorization';
const PROXY_URL = SUPABASE_URL + '/functions/v1/radioai-proxy';
const UPLOAD_URL = 'https://api.lovable.dev/files/generate-upload-url';

const CHECK_INTERVAL_MS = 60000;

// ============================================
// ULID Generation Functions (para aimsg)
// ============================================

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function encodeBase32BigInt(value, length) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result = CROCKFORD32[Number(value & 0x1fn)] + result;
    value >>= 5n;
  }
  return result;
}

function bytesToBigInt(bytes) {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }
  return result;
}

function ulidLike() {
  const timestamp = BigInt(Date.now());
  const timePart = encodeBase32BigInt(timestamp, 10);
  const randomPart = encodeBase32BigInt(bytesToBigInt(randomBytes(10)), 16);
  return timePart + randomPart;
}

function makeId(prefix = 'umsg_') {
  return prefix + ulidLike();
}

// ============================================
// UI Rendering Functions
// ============================================

function renderHistory() {
  historyEl.innerHTML = '';
  messages.forEach(msg => {
    const div = document.createElement('div');
    div.className = 'bubble ' + (msg.from === 'bot' ? 'bot' : 'user');
    div.textContent = msg.text;
    historyEl.appendChild(div);
  });
  historyEl.scrollTop = historyEl.scrollHeight;
}

function randomTokenCost() {
  const rand = Math.random();
  if (rand < 0.7) {
    return Math.floor(Math.random() * 5) + 1;
  }
  return Math.floor(Math.random() * 5) + 6;
}

function updateFileInfo() {
  if (!fileInfoEl) return;
  if (fileMeta.id) {
    fileInfoEl.textContent = fileMeta.name || fileMeta.id;
    if (uploadLabel) uploadLabel.classList.add('has-file');
    if (uploadBtn) {
      uploadBtn.classList.add('ready');
      uploadBtn.textContent = '✓';
    }
    if (clearFileBtn) clearFileBtn.classList.remove('hidden');
  } else {
    fileInfoEl.textContent = 'Anexar arquivo';
    if (uploadLabel) uploadLabel.classList.remove('has-file');
    if (uploadBtn) {
      uploadBtn.classList.remove('ready');
      uploadBtn.textContent = '⬆️';
    }
    if (clearFileBtn) clearFileBtn.classList.add('hidden');
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function calcDaysLeft(expiresAt) {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function updateLicenseUI() {
  console.log('🔍 updateLicenseUI chamada, licenseData:', licenseData);
  
  if (!licenseData) {
    authStatus.textContent = 'Insira sua chave de licença';
    authStatus.className = 'auth-status';
    if (licenseInfo) licenseInfo.classList.add('hidden');
    showBlocked(false);
    console.log('📝 Nenhuma licença encontrada, overlay escondido');
    return;
  }

  const isTrial = licenseData.is_trial || (licenseData.plan && String(licenseData.plan).toLowerCase().includes('trial')) || false;
  const isActive = licenseData.is_active;
  
  console.log('🔍 Verificações:', { isTrial, isActive, plan: licenseData.plan });
  
  // Verificar se é trial e se ainda tem mensagens
  if (isTrial) {
    // Extrair limite de mensagens do plano (ex: "Trial (10 mensagens)")
    const planText = licenseData.plan || '';
    const limitMatch = planText.match(/\((\d+)\s*mensagens?\)/i);
    const messageLimit = limitMatch ? parseInt(limitMatch[1]) : 10;
    const messagesUsed = licenseData.requests_today || 0;
    const messagesRemaining = Math.max(0, messageLimit - messagesUsed);
    
    console.log('📊 Trial info:', { messageLimit, messagesUsed, messagesRemaining });
    
    if (messagesRemaining <= 0) {
      console.log('❌ Trial sem mensagens restantes');
      authStatus.textContent = `❌ Limite do trial atingido (${messagesUsed}/${messageLimit} mensagens)`;
      authStatus.className = 'auth-status error';
      showBlocked(true, 'trial');
      return;
    }
  }
  
  // Verificar se a licença está ativa
  if (!isActive) {
    console.log('❌ Licença inativa - dados brutos:', licenseData.raw_license);
    console.log('❌ Campos verificados:', { 
      ativa: licenseData.raw_license?.ativa, 
      is_active: licenseData.raw_license?.is_active 
    });
    
    authStatus.textContent = '❌ Licença bloqueada ou inativa';
    authStatus.className = 'auth-status error';
    showBlocked(true, 'expired');
    return;
  }
  
  // Verificar expiração para licenças não-trial
  if (!isTrial && licenseData.expires_at) {
    const daysLeft = calcDaysLeft(licenseData.expires_at);
    if (daysLeft <= 0) {
      authStatus.textContent = '❌ Licença expirada';
      authStatus.className = 'auth-status error';
      showBlocked(true, 'expired');
      return;
    }
  }

  authStatus.textContent = '✅ Licença ativa';
  authStatus.className = 'auth-status success';
  showBlocked(false);

  if (licenseInfo) {
    licenseInfo.classList.remove('hidden');
    document.getElementById('infoName').textContent = licenseData.name || 'Usuário';
    document.getElementById('infoPlan').textContent = licenseData.plan || 'Desconhecido';
    
    if (isTrial) {
      // Para trial, mostrar mensagens restantes
      const planText = licenseData.plan || '';
      const limitMatch = planText.match(/\((\d+)\s*mensagens?\)/i);
      const messageLimit = limitMatch ? parseInt(limitMatch[1]) : 10;
      const messagesUsed = licenseData.requests_today || 0;
      const messagesRemaining = Math.max(0, messageLimit - messagesUsed);
      
      document.getElementById('infoExpires').textContent = 'Trial';
      document.getElementById('infoDaysLeft').textContent = '-';
      document.getElementById('infoRequests').textContent = `${messagesRemaining}/${messageLimit} restantes`;
      
      console.log('📊 UI atualizada - Trial:', { messagesUsed, messageLimit, messagesRemaining });
    } else {
      // Para licenças pagas
      const daysLeft = licenseData.expires_at ? calcDaysLeft(licenseData.expires_at) : 0;
      document.getElementById('infoExpires').textContent = licenseData.expires_at ? formatDate(licenseData.expires_at) : 'Sem data';
      document.getElementById('infoDaysLeft').textContent = daysLeft > 0 ? daysLeft + ' dias' : 'Expirada';
      
      // Verificar se é ilimitado baseado no texto do plano
      const isUnlimited = (licenseData.plan && String(licenseData.plan).toLowerCase().includes('ilimitado')) || false;
      document.getElementById('infoRequests').textContent = isUnlimited ? 'Ilimitado ✨' : `${licenseData.requests_today || 0} hoje`;
    }
  }
  
  console.log('✅ updateLicenseUI concluída com sucesso');
  
  // Atualizar estado da interface baseado na licença
  updateInterfaceState();
  
  // Garantir que o overlay esteja escondido quando a licença é válida
  if (blockedOverlay) {
    const isHidden = blockedOverlay.classList.contains('hidden');
    console.log('🔍 Estado do overlay:', { isHidden, classList: Array.from(blockedOverlay.classList) });
    
    if (!isHidden) {
      console.log('🔧 Forçando ocultação do overlay');
      blockedOverlay.classList.add('hidden');
      
      // Verificar novamente
      setTimeout(() => {
        const stillVisible = !blockedOverlay.classList.contains('hidden');
        console.log('🔍 Overlay ainda visível após correção:', stillVisible);
      }, 100);
    }
  }
}

function showBlocked(blocked, reason = 'expired') {
  console.log('🚫 showBlocked chamada:', { blocked, reason });
  
  if (blockedOverlay) {
    if (blocked) {
      blockedOverlay.classList.remove('hidden');
      console.log('👁️ Overlay mostrado');
    } else {
      blockedOverlay.classList.add('hidden');
      console.log('🙈 Overlay escondido');
    }
    
    const title = blockedOverlay.querySelector('h2');
    const desc = blockedOverlay.querySelector('p');
    
    if (reason === 'trial') {
      title.textContent = 'Limite do Trial Atingido';
      
      // Tentar extrair informações específicas do plano
      const planText = licenseData?.plan || '';
      const limitMatch = planText.match(/\((\d+)\s*mensagens?\)/i);
      const messageLimit = limitMatch ? parseInt(limitMatch[1]) : 10;
      
      desc.innerHTML = `Você usou suas ${messageLimit} mensagens gratuitas do trial.<br>Faça upgrade para continuar usando.`;
    } else {
      title.textContent = 'Licença Expirada ou Inativa';
      desc.innerHTML = 'Sua licença expirou ou foi desativada.<br>Entre em contato para renovar.';
    }
  }
  sendBtn.disabled = blocked;
  messageEl.disabled = blocked;
}

// Função para limpar licença e focar no input
function clearLicenseAndFocus() {
  console.log('🧹 clearLicenseAndFocus chamada');
  
  // Limpar dados da licença
  licenseData = null;
  licenseKey = '';
  authToken = '';
  
  // Limpar input
  if (licenseInput) {
    licenseInput.value = '';
    console.log('📝 Input da licença limpo');
  }
  
  // Esconder overlay
  if (blockedOverlay) {
    blockedOverlay.classList.add('hidden');
    console.log('🙈 Overlay escondido');
  }
  
  // Atualizar UI
  updateLicenseUI();
  
  // Focar no input
  setTimeout(() => {
    if (licenseInput) {
      licenseInput.focus();
      console.log('🎯 Foco no input da licença');
    }
  }, 100);
  
  // Salvar estado
  saveState();
  console.log('💾 Estado salvo');
}

// Função para verificar se a licença permite ações
function isLicenseValid() {
  if (!licenseData || !licenseData.is_active) {
    return { valid: false, reason: 'Licença inativa ou não encontrada' };
  }

  const isTrial = licenseData.is_trial || (licenseData.plan && String(licenseData.plan).toLowerCase().includes('trial')) || false;
  
  if (isTrial) {
    // Para trial, verificar se ainda tem mensagens
    const planText = licenseData.plan || '';
    const limitMatch = planText.match(/\((\d+)\s*mensagens?\)/i);
    const limit = limitMatch ? parseInt(limitMatch[1]) : 10; // Limite padrão para trial
    const used = licenseData.requests_today || 0;
    const remaining = Math.max(0, limit - used);
    
    console.log('🔍 Verificação trial:', { limit, used, remaining, planText });
    
    if (remaining <= 0) {
      return { valid: false, reason: `Limite do trial atingido (${used}/${limit} mensagens)` };
    }
  } else {
    // Para licenças pagas, verificar expiração
    if (licenseData.expires_at) {
      const daysLeft = calcDaysLeft(licenseData.expires_at);
      if (daysLeft <= 0) {
        return { valid: false, reason: 'Licença expirada' };
      }
    }
  }

  return { valid: true, reason: null };
}

// Função para bloquear interface quando licença inválida
function enforceValidLicense(actionName = 'esta ação') {
  const licenseCheck = isLicenseValid();
  
  if (!licenseCheck.valid) 