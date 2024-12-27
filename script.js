pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const elements = {
  dropZone: document.getElementById("dropZone"),
  fileInput: document.getElementById("fileInput"),
  contentDisplay: document.getElementById("contentDisplay"),
  playBtn: document.getElementById("playBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  stopBtn: document.getElementById("stopBtn"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  progress: document.getElementById("progress"),
  voiceSelect: document.getElementById("voiceSelect"),
  rate: document.getElementById("rate"),
  rateValue: document.getElementById("rateValue"),
};

let state = {
  currentPdf: null,
  currentPage: 1,
  totalPages: 0,
  utterance: null,
  isPlaying: false,
  words: [],
  wordElements: [],
};

const synthesis = window.speechSynthesis;

// Load voices
function loadVoices() {
  const voices = synthesis.getVoices();
  elements.voiceSelect.innerHTML = voices
    .map((voice) => `<option value="${voice.name}">${voice.name}</option>`)
    .join("");
}

synthesis.onvoiceschanged = loadVoices;
loadVoices();

// Event listeners
elements.dropZone.onclick = () => elements.fileInput.click();
elements.dropZone.ondragover = (e) => {
  e.preventDefault();
  elements.dropZone.classList.add("dragover");
};
elements.dropZone.ondragleave = () =>
  elements.dropZone.classList.remove("dragover");
elements.dropZone.ondrop = (e) => {
  e.preventDefault();
  elements.dropZone.classList.remove("dragover");
  processFile(e.dataTransfer.files[0]);
};
elements.fileInput.onchange = (e) => processFile(e.target.files[0]);
elements.rate.oninput = (e) =>
  (elements.rateValue.textContent = `${e.target.value}x`);

elements.playBtn.onclick = startReading;
elements.pauseBtn.onclick = () => {
  synthesis.pause();
  state.isPlaying = false;
  updateButtons();
};
elements.stopBtn.onclick = stopReading;
elements.prevBtn.onclick = () => changePage(state.currentPage - 1);
elements.nextBtn.onclick = () => changePage(state.currentPage + 1);

async function processFile(file) {
  if (!file) return;

  if (file.type === "application/pdf") {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    state.currentPdf = pdf;
    state.totalPages = pdf.numPages;
    enableControls();
    changePage(1);
  } else if (file.type === "text/plain") {
    const text = await file.text();
    displayText(text);
  }
}

async function changePage(newPage) {
  if (newPage < 1 || newPage > state.totalPages) return;
  state.currentPage = newPage;

  try {
    const page = await state.currentPdf.getPage(newPage);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item) => item.str).join(" ");
    displayText(text);
  } catch (error) {
    elements.contentDisplay.textContent = "Error loading page.";
  }
}

function displayText(text) {
  state.words = text.split(/\s+/);
  state.wordElements = state.words.map((word, index) => {
    const span = document.createElement("span");
    span.textContent = word + " ";
    span.dataset.index = index;
    return span;
  });

  elements.contentDisplay.innerHTML = "";
  state.wordElements.forEach((span) =>
    elements.contentDisplay.appendChild(span)
  );
  enableControls();
}

function highlightWord(index) {
  state.wordElements.forEach((span) => span.classList.remove("highlighted"));
  if (state.wordElements[index]) {
    state.wordElements[index].classList.add("highlighted");
    // state.wordElements[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function startReading() {
  if (state.isPlaying) return;

  stopReading();
  const text = state.words.join(" ");
  state.utterance = new SpeechSynthesisUtterance(text);

  const selectedVoice = synthesis
    .getVoices()
    .find((voice) => voice.name === elements.voiceSelect.value);
  if (selectedVoice) state.utterance.voice = selectedVoice;

  state.utterance.rate = elements.rate.value;

  state.utterance.onboundary = (event) => {
    const wordIndex = Math.floor(event.charIndex / 5);
    highlightWord(wordIndex);
    elements.progress.style.width = `${(event.charIndex / text.length) * 100}%`;
  };

  state.utterance.onend = () => {
    state.isPlaying = false;
    elements.progress.style.width = "0";
    if (state.currentPage < state.totalPages) {
      changePage(state.currentPage + 1).then(startReading);
    }
  };

  synthesis.speak(state.utterance);
  state.isPlaying = true;
  updateButtons();
}

function stopReading() {
  synthesis.cancel();
  state.isPlaying = false;
  elements.progress.style.width = "0";
  state.wordElements.forEach((span) => span.classList.remove("highlighted"));
  updateButtons();
}

function enableControls() {
  elements.playBtn.disabled = false;
  elements.pauseBtn.disabled = false;
  elements.stopBtn.disabled = false;
  elements.prevBtn.disabled = state.currentPage === 1;
  elements.nextBtn.disabled = state.currentPage === state.totalPages;
}

function updateButtons() {
  elements.playBtn.disabled = state.isPlaying;
  elements.pauseBtn.disabled = !state.isPlaying;
  elements.stopBtn.disabled = !state.isPlaying;
}
