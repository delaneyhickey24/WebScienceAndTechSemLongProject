async function loadRandomItems(type) {
  const response = await fetch(`/api/data?type=${encodeURIComponent(type)}`);

  if (!response.ok) {
    throw new Error(`Could not load ${type}s`);
  }

  return response.json();
}

function renderProjects(items) {
  const grid = document.querySelector('#projects .grid');
  grid.replaceChildren();

  for (const item of items) {
    const card = document.createElement('article');
    card.className = 'card active project';

    if (item.image) {
      const image = document.createElement('img');
      image.className = 'thumbnail';
      image.src = item.image;
      image.alt = '';
      card.append(image);
    }

    const title = document.createElement('h3');
    title.className = 'title';
    title.textContent = item.title;

    const description = document.createElement('p');
    description.className = 'desc';
    description.textContent = item.description;

    card.append(title, description);
    grid.append(card);
  }
}

function renderList(sectionId, items) {
  const list = document.querySelector(`#${sectionId} .list ul`);
  list.replaceChildren();

  for (const item of items) {
    const li = document.createElement('li');
    const title = document.createElement('b');
    title.textContent = item.title;

    const description = document.createTextNode(` ${item.description}`);
    li.append(title, description);
    list.append(li);
  }
}

async function refreshPage() {
  try {
    const [projects, opportunities, discussions] = await Promise.all([
      loadRandomItems('project'),
      loadRandomItems('opportunity'),
      loadRandomItems('discussion'),
    ]);

    renderProjects(projects);
    renderList('opport', opportunities);
    renderList('discuss', discussions);
  } catch (error) {
    console.error(error);
  }
}

document.querySelectorAll('.submit-form').forEach(form => {
  form.addEventListener('submit', async event => {
    event.preventDefault();

    const message = form.querySelector('.form-message');
    const formData = new FormData(form);

    const submission = {
      type: form.dataset.type,
      title: formData.get('title'),
      description: formData.get('description'),
      image: formData.get('image'),
    };

    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Submission failed');
      }

      form.reset();
      message.textContent = 'Submitted successfully.';
      await refreshPage();
    } catch (error) {
      message.textContent = error.message;
    }
  });
});

refreshPage();
