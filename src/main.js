/* ================= Helpers ================= */
const MAX_PREVIEW = 140;
let currentUser = null;

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function postJson(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  }).then(readJson);
}

function emptyNote(text) {
  const p = document.createElement('p');
  p.className = 'empty';
  p.textContent = text;
  return p;
}

/* ================= Auth ================= */
const authMessage = document.querySelector('#auth-message');
const loginForm = document.querySelector('#login-form');
const registerForm = document.querySelector('#register-form');
const logoutButton = document.querySelector('#logout-button');

function showAuthMessage(text, isError = false) {
  authMessage.textContent = text;
  authMessage.classList.toggle('error', isError);
}

async function updateAuthUI() {
  const data = await fetch('/api/me', { credentials: 'same-origin' }).then(readJson);
  currentUser = data.user;
  const loggedIn = Boolean(currentUser);

  loginForm.hidden = loggedIn;
  registerForm.hidden = loggedIn;
  logoutButton.hidden = !loggedIn;
  document.querySelectorAll('.submit-form').forEach(f => { f.hidden = !loggedIn; });
  document.querySelectorAll('.signin-hint').forEach(p => { p.hidden = loggedIn; });

  if (loggedIn) showAuthMessage(`Signed in as ${currentUser.username}.`);
}

function wireAuthForm(form, url, fields) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await postJson(url, Object.fromEntries(fields.map(f => [f, data.get(f)])));
      form.reset();
      showAuthMessage('');
      await updateAuthUI();
    } catch (error) {
      showAuthMessage(error.message, true);
    } finally {
      button.disabled = false;
    }
  });
}

wireAuthForm(loginForm, '/api/login', ['username', 'password']);
wireAuthForm(registerForm, '/api/register', ['username', 'email', 'password']);

logoutButton.addEventListener('click', async () => {
  try {
    await postJson('/api/logout', {});
    await updateAuthUI();
    showAuthMessage('You are logged out.');
  } catch (error) {
    showAuthMessage(error.message, true);
  }
});

/* ================= Posts ================= */
const loadItems = type =>
  fetch(`/api/data?type=${encodeURIComponent(type)}`, { credentials: 'same-origin' }).then(readJson);

function renderProjects(items) {
  const grid = document.querySelector('#projects .grid');
  grid.replaceChildren();
  if (!items.length) return grid.append(emptyNote('No projects yet.'));

  for (const item of items) {
    const card = document.createElement('article');
    card.className = 'card active project';

    if (item.image) {
      const img = document.createElement('img');
      img.className = 'thumbnail';
      img.src = item.image;
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('error', () => img.remove());
      card.append(img);
    }

    const title = document.createElement('h3');
    title.className = 'title';
    title.textContent = item.title;

    const desc = document.createElement('p');
    desc.className = 'desc';
    desc.textContent = item.description.length > MAX_PREVIEW
      ? item.description.slice(0, MAX_PREVIEW).trimEnd() + '…'
      : item.description;

    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'info';
    more.textContent = 'View details';

    card.append(title, desc, more);
    card._item = item;
    grid.append(card);
  }
}

function renderList(sectionId, items) {
  const list = document.querySelector(`#${sectionId} .list ul`);
  list.replaceChildren();
  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Nothing here yet.';
    return list.append(li);
  }
  for (const item of items) {
    const li = document.createElement('li');
    const title = document.createElement('b');
    title.textContent = item.title;
    li.append(title, document.createTextNode(` ${item.description}`));
    list.append(li);
  }
}

async function loadPosts() {
  try {
    const [projects, opportunities, discussions] = await Promise.all([
      loadItems('project'), loadItems('opportunity'), loadItems('discussion'),
    ]);
    renderProjects(projects);
    renderList('opport', opportunities);
    renderList('discuss', discussions);
  } catch (error) {
    console.error(error);
    document.querySelector('#projects .grid')
      .replaceChildren(emptyNote('Could not load posts. Check that the server is running.'));
  }
}

/* ================= Submit forms ================= */
document.querySelectorAll('.submit-form').forEach(form => {
  const message = form.querySelector('.form-message');
  const button = form.querySelector('button[type="submit"]');
  const label = button.textContent;

  const textarea = form.querySelector('textarea');
  if (textarea) {
    const counter = document.createElement('span');
    counter.className = 'counter';
    textarea.closest('label').append(counter);
    const update = () => { counter.textContent = `${textarea.value.length}/${textarea.maxLength}`; };
    textarea.addEventListener('input', update);
    form.addEventListener('reset', () => setTimeout(update));
    update();
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const fields = new FormData(form);
    message.className = 'form-message';
    message.textContent = '';
    button.disabled = true;
    button.textContent = 'Submitting…';
    try {
      await postJson('/api/data', {
        type: form.dataset.type,
        title: fields.get('title'),
        description: fields.get('description'),
        image: fields.get('image') || '',
      });
      form.reset();
      message.textContent = 'Submitted.';
      await loadPosts();
    } catch (error) {
      message.classList.add('error');
      message.textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  });
});

/* ================= Details dialog ================= */
const dialog = document.querySelector('#project-dialog');
const joinLink = dialog.querySelector('.join');

document.querySelector('#projects .grid').addEventListener('click', event => {
  const button = event.target.closest('button.info');
  if (!button) return;
  const item = button.closest('.card')._item;

  dialog.querySelector('#dialog-title').textContent = item.title;
  dialog.querySelector('.dialog-desc').textContent = item.description;
  const img = dialog.querySelector('.dialog-image');
  img.hidden = !item.image;
  if (item.image) img.src = item.image;

  // Join requests have no backend yet: signed-out users are sent to sign in.
  joinLink.hidden = Boolean(currentUser);
  dialog.showModal();
});

dialog.addEventListener('click', event => {
  if (event.target === dialog || event.target.closest('[data-close]')) dialog.close();
});

/* ================= Nav highlight ================= */
const navLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    navLinks.forEach(a => a.toggleAttribute('aria-current', a.hash === `#${entry.target.id}`));
  }
}, { rootMargin: '-40% 0px -55% 0px' });
navLinks.forEach(a => { const t = document.querySelector(a.hash); if (t) observer.observe(t); });

/* ================= Start ================= */
(async function start() {
  try { await updateAuthUI(); } catch (error) { showAuthMessage(error.message, true); }
  await loadPosts();
})();