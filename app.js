const CONFIG = {
  functionsUrl: 'https://tradie-dialer-3365.twil.io',
  logLimit: 50,
};

let device = null;
let currentCall = null;
let callStartTime = null;
let durationInterval = null;

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
const durationEl = document.getElementById('duration');

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

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

async function initializeDevice() {
  try {
    // Wait for Twilio SDK to load
    let attempts = 0;
    while (!window.Twilio && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!window.Twilio) {
      throw new Error('Twilio SDK failed to load');
    }

    log('Fetching access token...');
    updateConnectionStatus(false, 'Connecting...');

    const response = await fetch(`${CONFIG.functionsUrl}/token`);

    if (!response.ok) {
      throw new Error(`Token request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.token) {
      throw new Error('No token received from server');
    }

    log('Access token received');

    device = new Twilio.Voice.Device(data.token, {
      logLevel: 1,
      codecPreferences: ['opus', 'pcmu'],
      enableRingingState: true,
      edge: 'sydney',
      region: 'au',
    });

    device.on('registered', () => {
      log('Device registered successfully');
      updateConnectionStatus(true, 'Ready to call');
      callBtn.disabled = false;
      showStatus('success', 'Device ready. Enter a phone number and click Call.');
    });

    device.on('error', (error) => {
      log(`Device error: ${error.message}`, 'error');
      updateConnectionStatus(false, 'Error');
      showStatus('error', `Device error: ${error.message}`);
    });

    device.on('incoming', (conn) => {
      log('Incoming call received (not supported in this mode)');
      showStatus('info', 'Incoming call received');
      conn.reject();
    });

    device.on('disconnect', (conn) => {
      log('Call disconnected');
      currentCall = null;
      callBtn.disabled = false;
      hangupBtn.disabled = true;
      callInfo.style.display = 'none';

      if (durationInterval) {
        clearInterval(durationInterval);
        durationInterval = null;
      }

      showStatus('info', 'Call ended');
    });

    log('Registering device...');
    await device.register();
  } catch (error) {
    log(`Failed to initialize device: ${error.message}`, 'error');
    updateConnectionStatus(false, 'Error');
    showStatus(
      'error',
      'Failed to initialize device. Check configuration and logs.'
    );
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
    hangupBtn.disabled = false;

    currentCall = await device.connect({
      params: {
        To: phoneNumber,
      },
    });

    log(`Call object created for ${phoneNumber}`);

    currentCall.on('accept', () => {
      log(`Call accepted by recipient`);
      showStatus('success', `✓ Connected to ${phoneNumber}`);

      recipientNumberEl.textContent = phoneNumber;
      callInfo.style.display = 'block';

      callStartTime = Date.now();
      durationInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        durationEl.textContent = formatDuration(elapsed);
      }, 1000);
    });

    currentCall.on('disconnect', () => {
      log('Call disconnected');
      callBtn.disabled = false;
      hangupBtn.disabled = true;

      if (durationInterval) {
        clearInterval(durationInterval);
        durationInterval = null;
      }

      callInfo.style.display = 'none';
    });

    currentCall.on('cancel', () => {
      log('Call cancelled');
      callBtn.disabled = false;
      hangupBtn.disabled = true;
      showStatus('info', 'Call cancelled');
    });

    currentCall.on('error', (error) => {
      log(`Call error: ${error.message}`, 'error');
      showStatus('error', `Call error: ${error.message}`);
      callBtn.disabled = false;
      hangupBtn.disabled = true;
    });

    currentCall.on('muted', (isMuted) => {
      log(`Microphone ${isMuted ? 'muted' : 'unmuted'}`);
    });
  } catch (error) {
    log(`Failed to make call: ${error.message}`, 'error');
    showStatus('error', `Failed to call: ${error.message}`);
    callBtn.disabled = false;
    hangupBtn.disabled = true;
  }
});

hangupBtn.addEventListener('click', () => {
  if (currentCall) {
    log('Hanging up...');
    currentCall.disconnect();
    showStatus('info', 'Hanging up...');
  }
});

phoneInput.addEventListener('input', (e) => {
  let value = e.target.value.replace(/\D/g, '');

  if (value.length > 0) {
    if (value.length <= 2) {
      value = '+' + value;
    } else if (value.length <= 5) {
      value = '+' + value.slice(0, 2) + value.slice(2);
    } else {
      value = '+' + value.slice(0, 2) + value.slice(2);
    }
  }

  e.target.value = value.slice(0, 13);
});

window.addEventListener('load', () => {
  log('Application loaded');
  log('Initializing Twilio Voice...');
  initializeDevice();
});

window.addEventListener('beforeunload', () => {
  if (currentCall) {
    currentCall.disconnect();
  }
  if (device) {
    device.destroy();
  }
});

log('Tradie Dialer initialized');
log('Waiting for device registration...');
