const TOKEN_URL = 'https://tradie-dialer-3365.twil.io/token';

let device = null;
let activeCall = null;

document.addEventListener('DOMContentLoaded', () => {
  initialiseDialer();
});

async function initialiseDialer() {
  log('Tradie Dialer loaded');
  log('Connecting to Twilio...');

  try {
    if (
      typeof Twilio === 'undefined' ||
      typeof Twilio.Device === 'undefined'
    ) {
      throw new Error('Twilio Voice SDK did not load.');
    }

    const response = await fetch(TOKEN_URL);

    if (!response.ok) {
      throw new Error(
        `Token request failed with status ${response.status}`
      );
    }

    const data = await response.json();

    if (!data.token) {
      throw new Error('Token endpoint did not return a token.');
    }

   device = new Twilio.Device(data.token, {
       logLevel: 'debug',
      codecPreferences: ['opus', 'pcmu'],
      enableImprovedSignalingErrorPrecision: true,
      edge: ['singapore', 'sydney']
  });

    attachDeviceEvents();

    log(`Twilio device created: ${data.identity || 'browser user'}`);
    setConnectionStatus('Ready');
    setCallButtonEnabled(true);
  } catch (error) {
    console.error(error);
    log(`Initialisation failed: ${error.message}`);
    setConnectionStatus('Connection failed');
    setCallButtonEnabled(false);
  }
}

function attachDeviceEvents() {
  device.on('registered', () => {
    log('Twilio device registered');
    setConnectionStatus('Ready');
  });

  device.on('registering', () => {
    log('Registering Twilio device...');
    setConnectionStatus('Connecting...');
  });

  device.on('unregistered', () => {
    log('Twilio device unregistered');
    setConnectionStatus('Disconnected');
  });

  device.on('error', (error) => {
    console.error('Twilio device error:', error);
    log(`Twilio error: ${error.message}`);
    setConnectionStatus('Error');
    resetCallControls();
  });
}

async function makeCall() {
  const phoneInput = document.getElementById('phoneInput');

  if (!phoneInput) {
    log('Phone input field not found');
    return;
  }

  const toNumber = normaliseAustralianNumber(phoneInput.value);

  if (!toNumber) {
    log('Enter a valid Australian mobile number');
    setCallStatus('Invalid number');
    return;
  }

  if (!device) {
    log('Twilio device is not ready');
    return;
  }

  try {
    log(`Calling ${toNumber}...`);
    setCallStatus('Calling...');
    setRecipientNumber(toNumber);
    setCallButtonEnabled(false);
    setHangupButtonEnabled(true);

    activeCall = await device.connect({
      params: {
        To: toNumber
      }
    });

    attachCallEvents(activeCall);
  } catch (error) {
    console.error('Call failed:', error);
    log(`Call failed: ${error.message}`);
    setCallStatus('Call failed');
    resetCallControls();
  }
}

function attachCallEvents(call) {
  call.on('ringing', () => {
    log('Recipient phone is ringing');
    setCallStatus('Ringing');
  });

  call.on('accept', () => {
    log('Call connected');
    setCallStatus('Connected');
  });

  call.on('disconnect', () => {
    log('Call ended');
    setCallStatus('Ended');
    activeCall = null;
    resetCallControls();
  });

  call.on('cancel', () => {
    log('Call cancelled');
    setCallStatus('Cancelled');
    activeCall = null;
    resetCallControls();
  });

  call.on('reject', () => {
    log('Call rejected');
    setCallStatus('Rejected');
    activeCall = null;
    resetCallControls();
  });

  call.on('error', (error) => {
    console.error('Call error:', error);
    log(`Call error: ${error.message}`);
    setCallStatus('Error');
    activeCall = null;
    resetCallControls();
  });
}

function hangUpCall() {
  if (!activeCall) {
    log('No active call');
    return;
  }

  log('Hanging up...');
  activeCall.disconnect();
}

function normaliseAustralianNumber(value) {
  let number = value.replace(/[^\d+]/g, '');

  if (number.startsWith('04')) {
    number = `+61${number.substring(1)}`;
  } else if (number.startsWith('614')) {
    number = `+${number}`;
  }

  if (!/^\+61\d{9}$/.test(number)) {
    return null;
  }

  return number;
}

function setConnectionStatus(message) {
  const element =
    document.getElementById('connectionText') ||
    document.getElementById('connectionStatus');

  if (element) {
    element.textContent = message;
  }
}

function setCallStatus(message) {
  const statusText = document.getElementById('statusText');
  const statusBox = document.getElementById('status');
  const callStatus = document.getElementById('callStatus');

  if (statusText) {
    statusText.textContent = message;
  }

  if (statusBox) {
    statusBox.style.display = 'block';
  }

  if (callStatus) {
    callStatus.textContent = message;
  }
}

function setRecipientNumber(number) {
  const element = document.getElementById('recipientNumber');
  const callInfo = document.getElementById('callInfo');

  if (element) {
    element.textContent = number;
  }

  if (callInfo) {
    callInfo.style.display = 'block';
  }
}

function setCallButtonEnabled(enabled) {
  const button = document.getElementById('callBtn');

  if (button) {
    button.disabled = !enabled;
  }
}

function setHangupButtonEnabled(enabled) {
  const button = document.getElementById('hangupBtn');

  if (button) {
    button.disabled = !enabled;
  }
}

function resetCallControls() {
  setCallButtonEnabled(true);
  setHangupButtonEnabled(false);
}

function log(message) {
  console.log(message);

  const container =
    document.getElementById('logContainer') ||
    document.getElementById('console');

  if (!container) {
    return;
  }

  const line = document.createElement('div');
  const time = new Date().toLocaleTimeString();

  line.textContent = `[${time}] ${message}`;
  container.appendChild(line);
  container.scrollTop = container.scrollHeight;
}

const callButton = document.getElementById('callBtn');
const hangupButton = document.getElementById('hangupBtn');

if (callButton) {
  callButton.addEventListener('click', makeCall);
}

if (hangupButton) {
  hangupButton.addEventListener('click', hangUpCall);
}
