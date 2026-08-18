// =====================================================================
// NERD IN LOVE — COFFEE DATE INVITATION (app.js)
// Interactive Viral Date Proposal Web App
// =====================================================================

const state = {
  crushName: '',
  dateType: 'Cozy Coffee & Pastries ☕🥐',
  location: 'Cozy Aesthetic Cafe 🌿',
  timeSlot: '☀️ Afternoon Chill (1:00 PM - 4:00 PM)',
  dateStr: '',
};

// Utilities
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ---------------------------------------------------------------------
// Floating Hearts Generator
// ---------------------------------------------------------------------
function initHearts() {
  const container = $('#heartsBg');
  if (!container) return;
  const emojis = ['💖', '💕', '☕', '✨', '🌸', '🥐', '🥰'];

  setInterval(() => {
    const heart = document.createElement('div');
    heart.className = 'heart-particle';
    heart.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    heart.style.left = Math.random() * 100 + 'vw';
    heart.style.animationDuration = (5 + Math.random() * 5) + 's';
    heart.style.fontSize = (1 + Math.random() * 1.5) + 'rem';
    container.appendChild(heart);

    setTimeout(() => {
      heart.remove();
    }, 9000);
  }, 400);
}

// ---------------------------------------------------------------------
// Music Toggle System
// ---------------------------------------------------------------------
let isMusicPlaying = false;
const audio = $('#bgMusic');
const musicBtn = $('#musicToggleBtn');

function toggleMusic() {
  if (!audio || !musicBtn) return;
  if (isMusicPlaying) {
    audio.pause();
    isMusicPlaying = false;
    musicBtn.classList.remove('playing');
    musicBtn.innerHTML = '<i class="fa-solid fa-music"></i>';
  } else {
    audio.play().then(() => {
      isMusicPlaying = true;
      musicBtn.classList.add('playing');
      musicBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    }).catch(() => {});
  }
}

// ---------------------------------------------------------------------
// Navigation & Step Control
// ---------------------------------------------------------------------
function showStep(stepNum) {
  $$('.step-view').forEach(s => s.classList.remove('active'));
  const target = $(`#step${stepNum}`);
  if (target) target.classList.add('active');

  // Trigger confetti on final step
  if (stepNum === 6) {
    triggerConfetti();
    renderSummary();
  }
}

// ---------------------------------------------------------------------
// Confetti Animation
// ---------------------------------------------------------------------
function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ff7675', '#74b9ff', '#ffeaa7', '#a29bfe', '#55efc4']
    });

    setTimeout(() => {
      confetti({
        particleCount: 80,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#ff7675', '#fd79a8']
      });
      confetti({
        particleCount: 80,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#74b9ff', '#6c5ce7']
      });
    }, 400);
  }
}

// ---------------------------------------------------------------------
// Runaway / Dodge "No" Button
// ---------------------------------------------------------------------
function initNoButtonDodge() {
  const btnNo = $('#btnNo');
  if (!btnNo) return;

  const dodge = (e) => {
    e.preventDefault();
    const card = $('#inviteCard');
    if (!card) return;

    const cardRect = card.getBoundingClientRect();
    const btnRect = btnNo.getBoundingClientRect();

    const maxOffsetX = (cardRect.width / 2) - btnRect.width;
    const maxOffsetY = 100;

    const randomX = (Math.random() - 0.5) * 2 * maxOffsetX;
    const randomY = (Math.random() - 0.5) * 2 * maxOffsetY;

    btnNo.style.transform = `translate(${randomX}px, ${randomY}px)`;

    const teaseTexts = ['Oops! 🙈', 'Try again! 😜', 'Nice try! 💕', 'Click Yes instead! 💖', 'Di pwede no! 🥰'];
    btnNo.textContent = teaseTexts[Math.floor(Math.random() * teaseTexts.length)];
  };

  btnNo.addEventListener('mouseenter', dodge);
  btnNo.addEventListener('touchstart', dodge);
  btnNo.addEventListener('click', dodge);
}

// ---------------------------------------------------------------------
// Render Summary (Step 6)
// ---------------------------------------------------------------------
function renderSummary() {
  $('#resName').textContent = state.crushName || 'My Special Someone 💖';
  $('#resType').textContent = state.dateType;
  $('#resLocation').textContent = state.location || 'Cozy Cafe of your choice ☕';
  
  let formattedDate = state.dateStr;
  if (state.dateStr) {
    const d = new Date(state.dateStr);
    formattedDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  $('#resTime').textContent = `${formattedDate ? formattedDate + ' · ' : ''}${state.timeSlot}`;
}

window.restartInvite = function() {
  showStep(1);
  const btnNo = $('#btnNo');
  if (btnNo) {
    btnNo.style.transform = 'translate(0, 0)';
    btnNo.textContent = 'No, sorry 💔';
  }
};

// ---------------------------------------------------------------------
// Main Event Handlers
// ---------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initHearts();
  initNoButtonDodge();

  // Set default date to coming Saturday
  const dateIn = $('#dateInput');
  if (dateIn) {
    const nextSat = new Date();
    nextSat.setDate(nextSat.getDate() + ((6 - nextSat.getDay() + 7) % 7 || 7));
    dateIn.value = nextSat.toISOString().slice(0, 10);
    dateIn.min = new Date().toISOString().slice(0, 10);
  }

  musicBtn?.addEventListener('click', toggleMusic);

  // STEP 1: Enter Name
  const nameInput = $('#crushNameInput');
  const btnStep1 = $('#btnStep1Next');
  const errStep1 = $('#step1Error');

  const handleStep1 = () => {
    const val = nameInput.value.trim();
    if (!val) {
      errStep1.textContent = 'Please enter your name first! 💖';
      return;
    }
    state.crushName = val;
    $('#crushNameDisplay').textContent = val;
    errStep1.textContent = '';
    
    // Auto-play music on first interaction
    if (!isMusicPlaying) toggleMusic();

    showStep(2);
  };

  btnStep1?.addEventListener('click', handleStep1);
  nameInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleStep1();
  });

  // STEP 2: YES button clicked!
  $('#btnYes')?.addEventListener('click', () => {
    triggerConfetti();
    showStep(3);
  });

  // STEP 3: Choice Selection
  $$('.choice-card').forEach(card => {
    card.addEventListener('click', () => {
      $$('.choice-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      state.dateType = card.dataset.type;
    });
  });

  $('#btnStep3Next')?.addEventListener('click', () => {
    showStep(4);
  });

  // STEP 4: Location & Tags
  $$('.tag-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const loc = pill.dataset.cafe;
      $('#cafeLocationInput').value = loc;
      state.location = loc;
    });
  });

  $('#btnStep4Next')?.addEventListener('click', () => {
    const customLoc = $('#cafeLocationInput').value.trim();
    if (customLoc) state.location = customLoc;
    showStep(5);
  });

  // STEP 5: Timing
  $('#btnStep5Next')?.addEventListener('click', () => {
    state.timeSlot = $('#timeSlotSelect').value;
    state.dateStr = $('#dateInput').value;
    showStep(6);
  });

  // STEP 6: Share / Copy
  $('#btnShareSummary')?.addEventListener('click', () => {
    const summaryText = `Hey! It's official! ☕💖 Here is our date pass:\n` +
      `✨ Partner: ${state.crushName}\n` +
      `🥐 Vibe: ${state.dateType}\n` +
      `📍 Place: ${state.location}\n` +
      `⏰ Time: ${$('#resTime').textContent}\n` +
      `See you! Coffee is on me! 🥰`;

    navigator.clipboard.writeText(summaryText).then(() => {
      alert('✨ Date summary copied to clipboard! You can now send it to your crush via Messenger/WhatsApp! 💕');
    }).catch(() => {
      alert(summaryText);
    });
  });
});
