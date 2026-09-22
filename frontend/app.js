const state = { mode: 'login' };

const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const nameFields = document.getElementById('nameFields');
const passwordHint = document.getElementById('passwordHint');
const submitBtn = document.getElementById('submitBtn');
const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
const messageEl = document.getElementById('message');
const errorEl = document.getElementById('error');
const form = document.getElementById('authForm');

function setMessage(text, type) {
  messageEl.textContent = type === 'error' ? '' : text;
  errorEl.textContent = type === 'error' ? text : '';
}

function toggleMode(mode) {
  state.mode = mode;
  if (mode === 'register') {
    nameFields.classList.remove('hidden');
    passwordHint.classList.remove('hidden');
    submitBtn.textContent = 'Create Account';
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
  } else {
    nameFields.classList.add('hidden');
    passwordHint.classList.add('hidden');
    submitBtn.textContent = 'Login';
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
  }
}

loginTab.addEventListener('click', () => toggleMode('login'));
registerTab.addEventListener('click', () => toggleMode('register'));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('', '');

  const payload = {
    firstName: document.getElementById('firstName').value,
    lastName: document.getElementById('lastName').value,
    email: document.getElementById('email').value,
    password: document.getElementById('password').value
  };

  const endpoint = state.mode === 'register' ? '/api/register' : '/api/login';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    setMessage(data.error, 'error');
    return;
  }

  setMessage(data.message || 'Success', 'success');
  form.reset();
});

forgotPasswordBtn.addEventListener('click', async () => {
  const email = document.getElementById('email').value;
  if (!email) {
    setMessage('Please enter your email to reset the password.', 'error');
    return;
  }

  const response = await fetch('/api/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });

  const data = await response.json();
  if (!response.ok) {
    setMessage(data.error, 'error');
    return;
  }

  setMessage(data.message, 'success');
});

toggleMode('login');
// Fetch activity data from backend
async function loadActivityData() {
  try {
    const response = await fetch('/api/activity-data');

    if (!response.ok) {
      throw new Error('Failed to fetch activity data');
    }

    const data = await response.json();

    console.log('Activity Data:', data.rows);

  } catch (error) {
    console.error(error);
  }
}

loadActivityData();