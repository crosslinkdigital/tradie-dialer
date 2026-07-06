const CONFIG = {
  functionsUrl: 'https://vapi-call-9084.twil.io',
  logLimit: 50,
};

let vapi = null;
let currentCall = null;
let isCallActive = false;

const phoneInput = document.getElementById('phoneInput');
const callBtn = document.getElementById('callBtn');
const hangupBtn = document.getElementById('hangupBtn');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('statusText');
const connectionIndicator = document.getElementById('connectionIndicator');
const connectionText = document.getElementById('connectionText');
const callInfo = document.getElementById('callInfo');
const logContainer = document.getElementById('logContainer');
const recipientNumberEl = document.getElementById('recipientNumber');
const callStatusEl = document.getElementById('callStatus');

function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry ${type}`;
  logEntry.textContent = `[${timestamp}] ${message}`;
  logContainer.appendChild(logEntry);

  while (logContainer.children.length > CONFIG.logLimit) {
    logContainer.removeChild(logContainer.firstChild);
  }

  logContainer.scrollTop = logContainer.scrollHeight;
  console.log(`[${type.toUpperCase()}] ${message}`);
}

function updateConnectionStatus(connected, message) {
  if (connected) {
    connectionIndicator.className = 'status-indicator connected';
  } else {
    connectionIndicator.className = 'status-indicator error';
  }
  connectionText.textContent = message;
}

function showStatus(type, message) {
  statusText.innerHTML = message;
  statusEl.className = `status-message ${type}`;
  statusEl.style.display = 'block';
}

function validatePhoneNumber(phoneNumber) {
  if (!phoneNumber) {
    return { valid: false, error: 'Phone number is required' };
  }

  const cleaned = phoneNumber.trim();

  if (!cleaned.match(/^\+61\d{9}$/)) {
    return {
      valid: false,
      error: 'Invalid format. Use +614XXXXXXXX (Australian number)',
    };
  }

  return { valid: true };
}

function initializeVapi() {
  try {
    log('Initializing Vapi...');
    
    vapi = new Vapi('25174597-74db-421c-8b9c-20121cf647ca');

    vapi.on('call-start', () => {
      log('Call started');
      isCallActive = true;
      callBtn.disabled = true;
      hangupBtn.disabled = false;
      callStatusEl.textContent = 'Connected';
      showStatus('success', 'Call connected. You can now speak.');
    });

    vapi.on('call-end', () => {
      log('Call ended');
      isCallActive = false;
      currentCall = null;
      callBtn.disabled = false;
      hangupBtn.disabled = true;
      callInfo.style.display = 'none';
      showStatus('info', 'Call ended');
      updateConnectionStatus(true, 'Ready');
    });

    vapi.on('error', (error) => {
      log(`Vapi error: ${error.message}`, 'error');
      showStatus('error', `Error: ${error.message}`);
      updateConnectionStatus(false, 'Error');
    });

    vapi.on('message', (message) => {
      log(`Message: ${JSON.stringify(message)}`);
    });

    updateConnectionStatus(true, 'Ready to call');
    log('Vapi initialized successfully');
  } catch (error) {
    log(`Failed to initialize Vapi: ${error.message}`, 'error');
    updateConnectionStatus(false, 'Error');
    showStatus('error', 'Failed to initialize. Check logs.');
  }
}

callBtn.addEventListener('click', async () => {
  const phoneNumber = phoneInput.value.trim();

  const validation = validatePhoneNumber(phoneNumber);
  if (!validation.valid) {
    log(`Validation failed: ${validation.error}`, 'warn');
    showStatus('error', validation.error);
    return;
  }

  try {
    log(`Initiating call to ${phoneNumber}`);
    showStatus('info', `📞 Calling ${phoneNumber}...`);
    callBtn.disabled = true;

    // Call the Twilio Function to initiate Vapi outbound call
    const response = await fetch(`${CONFIG.functionsUrl}?phone=${encodeURIComponent(phoneNumber)}`);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.id) {
      throw new Error('No call ID received from server');
    }

    log(`Call initiated with ID: ${data.id}`);
    currentCall = data;
    recipientNumberEl.textContent = phoneNumber;
    callStatusEl.textContent = 'Ringing...';
    callInfo.style.display = 'block';

    // Connect browser audio to the call
    try {
      await vapi.start('212ee6eb-6700-40fa-ae85-e6f5b7a74da8');
      log('Browser audio connected to call');
    } catch (audioError) {
      log(`Audio connection warning: ${audioError.message}`, 'warn');
      // Don't fail the call, audio might still work
    }
  } catch (error) {
    log(`Failed to make call: ${error.message}`, 'error');
    showStatus('error', `Failed: ${error.message}`);
    callBtn.disabled = false;
    callInfo.style.display = 'none';
  }
});

hangupBtn.addEventListener('click', () => {
  if (isCallActive || currentCall) {
    log('Hanging up...');
    vapi.stop();
    showStatus('info', 'Hanging up...');
  }
});

phoneInput.addEventListener('input', (e) => {
  let value = e.target.value.replace(/\D/g, '');

  if (value.length > 0) {
    if (value.length <= 2) {
      value = '+' + value;
    } else {
      value = '+' + value.slice(0, 2) + value.slice(2);
    }
  }

  e.target.value = value.slice(0, 13);
});

window.addEventListener('load', () => {
  log('Application loaded');
  initializeVapi();
});

window.addEventListener('beforeunload', () => {
  if (isCallActive && vapi) {
    vapi.stop();
  }
});

log('Tradie Dialer initialized');
