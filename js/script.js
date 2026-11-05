// Find our date picker inputs on the page
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');
const searchButton = document.getElementById('searchButton');
const gallery = document.getElementById('gallery');
const resultCount = document.getElementById('resultCount');
const spaceFact = document.getElementById('spaceFact');
const imageModal = document.getElementById('imageModal');
const closeModal = document.getElementById('closeModal');
const modalMedia = document.getElementById('modalMedia');
const modalTitle = document.getElementById('modalTitle');
const modalDate = document.getElementById('modalDate');
const modalExplanation = document.getElementById('modalExplanation');
const modalVideoLink = document.getElementById('modalVideoLink');

setupDateInputs(startInput, endInput);

const apiUrl = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic';
const nasaImagesApiUrl = 'https://images-api.nasa.gov/search';
const spaceFacts = [
  'A day on Venus is longer than its year.',
  'Neutron stars can spin around 600 times every second.',
  'One million Earths could fit inside the Sun.',
  'Saturn would float in water because it is less dense than water.',
  'Light from the Sun takes about eight minutes to reach Earth.'
];

spaceFact.textContent = spaceFacts[Math.floor(Math.random() * spaceFacts.length)];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[character]));
}

function getExplanationText(explanation) {
  const explanationDocument = new DOMParser().parseFromString(
    explanation || '',
    'text/html'
  );
  return explanationDocument.body.textContent.replace(/\s+/g, ' ').trim();
}

function getImageUrl(item) {
  return item.hdurl || item.url;
}

function getVideoUrl(item) {
  return item.video_url || item.url;
}

function canEmbedVideo(url) {
  return /(?:youtube\.com\/embed|youtube\.com\/watch|youtu\.be|player\.vimeo\.com)/i.test(url);
}

function hasUsableMedia(item) {
  const imageUrl = getImageUrl(item);
  const isPlaceholder = item.title === 'NASA Science'
    && imageUrl?.includes('/nasa-logo');

  return Boolean(item.date && imageUrl && !isPlaceholder);
}

async function loadFallbackImages() {
  const response = await fetch(
    `${nasaImagesApiUrl}?q=space&media_type=image&page_size=9`
  );

  if (!response.ok) {
    throw new Error('NASA image services are unavailable right now.');
  }

  const data = await response.json();
  if (!Array.isArray(data.collection?.items)) {
    throw new Error('NASA returned an unexpected image library response.');
  }

  const fallbackImages = data.collection.items
    .map((item) => {
      const image = item.links?.find((link) => link.render === 'image');
      const details = item.data?.[0];

      if (!image || !details) return null;

      return {
        date: details.date_created.split('T')[0],
        explanation: details.description || 'NASA image from the public image library.',
        media_type: 'image',
        title: details.title,
        url: image.href
      };
    })
    .filter(Boolean);

  if (fallbackImages.length === 0) {
    throw new Error('NASA returned no usable space photos.');
  }

  return fallbackImages;
}

function createCard(item) {
  const imageUrl = getImageUrl(item);
  const title = escapeHtml(item.title);
  const date = escapeHtml(item.date);
  const videoUrl = getVideoUrl(item);
  const media = item.media_type === 'video' && canEmbedVideo(videoUrl)
    ? `<iframe src="${escapeHtml(videoUrl)}" title="${title}" loading="lazy" allowfullscreen></iframe>`
    : `<img src="${escapeHtml(imageUrl)}" alt="${title}" loading="lazy">`;
  const videoLink = item.media_type === 'video'
    ? `<a class="video-link" href="${escapeHtml(videoUrl)}" target="_blank" rel="noopener noreferrer">Open video on NASA</a>`
    : '';

  return `
    <article class="gallery-item" data-date="${date}" tabindex="0" role="button" aria-label="View details for ${title}">
      <div class="media-frame">${media}</div>
      <div class="card-copy">
        <div class="card-date">${date}</div>
        <h3>${title}</h3>
        ${videoLink}
      </div>
    </article>
  `;
}

function openItem(item) {
  const imageUrl = getImageUrl(item);
  const videoUrl = getVideoUrl(item);
  modalMedia.innerHTML = item.media_type === 'video' && canEmbedVideo(videoUrl)
    ? `<iframe src="${escapeHtml(videoUrl)}" title="${escapeHtml(item.title)}" allowfullscreen></iframe>`
    : `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.title)}">`;
  modalTitle.textContent = item.title;
  modalDate.textContent = item.date;
  modalExplanation.textContent = getExplanationText(item.explanation);
  modalVideoLink.hidden = item.media_type !== 'video';
  modalVideoLink.href = videoUrl;
  imageModal.showModal();
}

async function loadImages() {
  searchButton.disabled = true;
  searchButton.textContent = 'Launching...';
  gallery.innerHTML = '<div class="status-message">🔄 Loading space photos...</div>';
  resultCount.textContent = '';

  try {
    const response = await fetch(
      `${apiUrl}?api_key=DEMO_KEY&start_date=${startInput.value}&end_date=${endInput.value}`
    );

    if (!response.ok) {
      throw new Error('NASA archive is unavailable right now.');
    }

    const images = await response.json();
    if (!Array.isArray(images)) {
      throw new Error('NASA returned an unexpected response.');
    }

    let usableImages = images.filter(hasUsableMedia);
    if (usableImages.length === 0) {
      usableImages = await loadFallbackImages();
    }

    usableImages.sort((first, second) => second.date.localeCompare(first.date));
    gallery.innerHTML = usableImages.map(createCard).join('');
    resultCount.textContent = `${usableImages.length} ${usableImages.length === 1 ? 'discovery' : 'discoveries'}`;
    gallery.querySelectorAll('.gallery-item').forEach((card, index) => {
      card.addEventListener('click', (event) => {
        if (event.target.closest('a, iframe')) return;
        openItem(usableImages[index]);
      });
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openItem(usableImages[index]);
        }
      });
    });
  } catch (error) {
    gallery.innerHTML = `<div class="status-message error">${error.message} Please try again.</div>`;
  } finally {
    searchButton.disabled = false;
    searchButton.innerHTML = 'Explore images <span aria-hidden="true">→</span>';
  }
}

searchButton.addEventListener('click', loadImages);
closeModal.addEventListener('click', () => imageModal.close());
imageModal.addEventListener('click', (event) => {
  if (event.target === imageModal) imageModal.close();
});
loadImages();
