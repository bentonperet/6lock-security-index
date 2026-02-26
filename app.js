/* ============================================
   PE Security Index - 6lock
   Interactive Security Assessment App
   ============================================ */

// ===== CONFIGURATION =====
// Update these values before deploying
const CONFIG = {
  emailjs: {
    serviceId: 'YOUR_SERVICE_ID',
    templateId: 'YOUR_TEMPLATE_ID',
    publicKey: 'YOUR_PUBLIC_KEY'
  },
  calendarUrl: 'https://6lock.com/demo',
  websiteUrl: 'https://6lock.com',
  benchmarkLow: 35,
  benchmarkHigh: 55,
  // Google Apps Script web app URL (deployed via crossvine.ai account)
  sheetsWebhookUrl: 'https://script.google.com/a/macros/crossvine.ai/s/AKfycbzH_00MFfkaimZ7vcvP8N6c2iGUOk4fkq0yV_aDi4rhaKdZ6bUYl21oMhPtAwJH1_oJ/exec',
  // Shared secret - must match VALID_TOKEN in google-apps-script.js
  webhookToken: '6lock-secidx-2026-pv8w3n'
};

// ===== QUESTIONS DATA =====
// Source: security-scoring-framework.md (Peter Steppe's 6-pillar model)
const QUESTIONS = [
  {
    id: 1,
    pillar: 'verification',
    pillarName: 'Verification Methods',
    pillarMax: 20,
    text: 'How does your firm verify wire transfer instructions before executing?',
    answers: [
      { text: 'We have a secure platform that handles verification automatically', points: 10 },
      { text: 'We call back using a known number from our records (not from the email)', points: 6 },
      { text: 'We rely on email confirmation from a known contact', points: 3 },
      { text: 'We call the number provided in the wire instructions', points: 1 },
      { text: 'We reply to the email to confirm', points: 0 }
    ],
    tooltip: 'Attackers can clone any voice from 3-5 seconds of audio. A UK energy firm lost $243K to a cloned CEO voice in 2024. Single-point verification is no longer enough.'
  },
  {
    id: 2,
    pillar: 'verification',
    pillarName: 'Verification Methods',
    pillarMax: 20,
    text: 'When an LP or counterparty requests a change to their banking details, what is your process?',
    answers: [
      { text: 'Changes are submitted and verified through a secure portal with identity verification', points: 10 },
      { text: 'We require video call verification plus a mandatory waiting period', points: 6 },
      { text: 'We call back to a known number on file to confirm the change', points: 4 },
      { text: 'We verify via email with the known contact', points: 1 },
      { text: 'We process the change as received', points: 0 }
    ],
    tooltip: 'Banking detail changes are the #1 attack vector in PE wire fraud. In the Norfund case, hackers sat in email for months, then intercepted a real banking change to steal $10 million.'
  },
  {
    id: 3,
    pillar: 'identity',
    pillarName: 'Identity & Access',
    pillarMax: 20,
    text: 'How does your firm store and manage LP and counterparty banking information?',
    answers: [
      { text: 'In a secure, access-controlled platform with audit trails', points: 10 },
      { text: 'In our fund admin\'s system (but we don\'t know the details of their security)', points: 4 },
      { text: 'In shared drives or document management systems with access controls', points: 3 },
      { text: 'In spreadsheets or PDFs stored on shared drives or email', points: 1 },
      { text: 'Varies by team member - no standard process', points: 0 }
    ],
    tooltip: 'Wire instruction docs are easy to tamper with. If banking info lives in PDF, spreadsheets or email, one compromised inbox can expose your entire directory.'
  },
  {
    id: 4,
    pillar: 'identity',
    pillarName: 'Identity & Access',
    pillarMax: 20,
    text: 'How do you identify and authenticate your LPs and counterparties for money movement?',
    answers: [
      { text: 'Multi-factor identity verification tied to each individual', points: 10 },
      { text: 'Verified phone callback to known numbers on file', points: 4 },
      { text: 'We recognize them by their email address from a known domain', points: 2 },
      { text: 'We rely on our fund admin to handle identification', points: 1 },
      { text: 'Email from a known contact is sufficient', points: 0 }
    ],
    tooltip: 'AI phishing emails now account for 40% of all phishing attempts, and they are getting good. Business Email Compromise caused $2.8B in losses in 2024.'
  },
  {
    id: 5,
    pillar: 'authorization',
    pillarName: 'Authorization & Separation of Duties',
    pillarMax: 20,
    text: 'How many people must independently approve a wire transfer, and can the same person who initiates a payment also execute it?',
    answers: [
      { text: 'Different people must initiate, approve, and execute - no single person can do more than one (enforced by system)', points: 20 },
      { text: 'Two different people required for all transfers, with role separation enforced by system', points: 15 },
      { text: 'Two people required for transfers over a threshold, but roles aren\'t system-enforced', points: 8 },
      { text: 'Two people for large transfers, but the same person could theoretically initiate and approve', points: 4 },
      { text: 'One person can authorize and execute any transfer', points: 0 }
    ],
    tooltip: 'Separation of duties is one of the most fundamental financial controls. If one person can authorize and execute a transfer, one compromised account means total exposure.'
  },
  {
    id: 6,
    pillar: 'capitalEvent',
    pillarName: 'Capital Event Security',
    pillarMax: 15,
    text: 'During a capital call or distribution, how are payment instructions communicated to or from your LPs?',
    answers: [
      { text: 'Through a secure portal where instructions are verified and can\'t be altered in transit', points: 15 },
      { text: 'Encrypted email with verified recipients, plus callback confirmation', points: 8 },
      { text: 'Standard email with PDF attachment of wire instructions', points: 3 },
      { text: 'It varies - sometimes email, sometimes through the fund admin', points: 1 },
      { text: 'We rely on instructions already on file (which may not be current)', points: 0 }
    ],
    tooltip: 'Capital events are the highest-risk moment in PE fund operations. Attackers infiltrate systems and wait months for the chaotic last-minute event where nobody double-checks.'
  },
  {
    id: 7,
    pillar: 'communication',
    pillarName: 'Communication Security',
    pillarMax: 15,
    text: 'How does your firm communicate with your fund administrator regarding money movement?',
    answers: [
      { text: 'Through a dedicated secure platform for all payment-related communications', points: 15 },
      { text: 'Encrypted/secure messaging for payment instructions, standard email for general coordination', points: 9 },
      { text: 'Email with specific security protocols (encryption, verification codes)', points: 5 },
      { text: 'Standard email - our fund admin is a trusted partner', points: 1 },
      { text: 'Mix of email, phone, and text depending on urgency', points: 0 }
    ],
    tooltip: 'Your fund admin\'s security is effectively your security. In the Tillage Commodities case, the admin was held liable - but the fund still lost millions. Attackers target the weakest link, and unencrypted email is usually it.'
  },
  {
    id: 8,
    pillar: 'incident',
    pillarName: 'Incident Preparedness',
    pillarMax: 10,
    text: 'If you discovered right now that a fraudulent wire was sent from your firm, what would happen in the next 60 minutes?',
    answers: [
      { text: 'We have a documented playbook with assigned roles, bank contact protocols, and we\'ve rehearsed it', points: 10 },
      { text: 'We have a documented incident response plan but haven\'t tested it recently', points: 6 },
      { text: 'We\'d contact our bank immediately and loop in counsel, but there\'s no formal plan', points: 3 },
      { text: 'We\'d escalate to senior leadership and figure out next steps', points: 1 },
      { text: 'Honestly, I\'m not sure what the process would be', points: 0 }
    ],
    tooltip: 'You only have 24-48 hours before funds are gone. Without a rehearsed plan, those hours get lost to confusion.'
  }
];

// ===== PILLAR RECOMMENDATIONS =====
const PILLAR_RECOMMENDATIONS = {
  verification: {
    name: 'Verification Methods',
    advice: 'Your verification methods rely on easily compromised channels. Callbacks confirmed identity in 2015 - today, attackers clone voices from 3 seconds of audio. Implementing continuous, multi-factor verification would eliminate your largest attack surface.'
  },
  identity: {
    name: 'Identity & Access',
    advice: 'Scattered identity data across spreadsheets, emails, and disconnected systems creates a distributed attack surface. You may not actually know who is on the other side of that email address. Centralizing LP and counterparty data in a secure, auditable platform with real identity verification is a critical first step.'
  },
  authorization: {
    name: 'Authorization & Separation of Duties',
    advice: 'Without system-enforced separation of duties, a single compromised account can authorize and execute fraudulent transfers. Having a "two-person rule" that isn\'t enforced by your systems is a policy, not a control. Implementing true role-based separation is fundamental.'
  },
  capitalEvent: {
    name: 'Capital Event Security',
    advice: 'Capital calls and distributions are your highest-risk moments, and attackers know it. They wait months for the urgent, last-minute event where wire instructions move fast and nobody double-checks. Moving payment instructions off email and PDFs into a secure, immutable channel eliminates the most exploited attack vector in PE.'
  },
  communication: {
    name: 'Communication Security',
    advice: 'Unencrypted email between your firm and your fund administrator is a persistent vulnerability. Your fund admin\'s security posture is your security posture - and attackers routinely position themselves between these two parties. Secure, purpose-built communication channels for payment-related discussions close this gap.'
  },
  incident: {
    name: 'Incident Preparedness',
    advice: 'Without a rehearsed response plan, you\'ll lose critical hours in the aftermath of a fraud event. The difference between recovering funds and a total loss is often measured in minutes, not days. A documented, practiced playbook with assigned roles and pre-established bank contact protocols is table stakes.'
  }
};

// ===== GRADE DEFINITIONS =====
const GRADES = [
  { min: 85, letter: 'A', label: 'Strong Security Posture', color: '#22C55E' },
  { min: 70, letter: 'B', label: 'Moderate Security Posture', color: '#0a40ff' },
  { min: 50, letter: 'C', label: 'Elevated Risk', color: '#EAB308' },
  { min: 30, letter: 'D', label: 'High Risk', color: '#F97316' },
  { min: 0,  letter: 'F', label: 'Critical Risk', color: '#EF4444' }
];

// ===== STATE =====
const state = {
  currentQuestion: 0,
  answers: [],
  pillarScores: {},
  totalScore: 0,
  respondent: null,
  sessionId: null,
  source: null,
  phase: 'landing'
};

// ===== DOM REFS =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ===== SCREEN MANAGEMENT =====
function showScreen(screenId) {
  $$('.screen').forEach(s => {
    s.classList.remove('active');
  });
  const target = $(`#${screenId}`);
  // Force reflow for animation restart
  void target.offsetWidth;
  target.classList.add('active');

  // Show/hide progress bar
  const progressBar = $('#progress-bar');
  if (screenId === 'screen-question') {
    progressBar.classList.add('visible');
  } else {
    progressBar.classList.remove('visible');
  }
}

// ===== PROGRESS BAR =====
function updateProgressBar() {
  const pct = ((state.currentQuestion) / QUESTIONS.length) * 100;
  $('#progress-fill').style.width = pct + '%';
}

// ===== RENDER QUESTION =====
function renderQuestion(index) {
  const q = QUESTIONS[index];
  state.currentQuestion = index;
  updateProgressBar();

  // Back button visibility (hide on first question)
  $('#btn-back-question').style.display = index === 0 ? 'none' : '';

  $('#question-counter').textContent = `Question ${index + 1} of ${QUESTIONS.length}`;
  $('#question-text').textContent = q.text;

  const answersContainer = $('#question-answers');
  answersContainer.innerHTML = '';

  // Hide tooltip and next button (reset for new question)
  $('#question-tooltip').hidden = true;
  $('#btn-next').hidden = true;

  q.answers.forEach((answer, i) => {
    const card = document.createElement('div');
    card.className = 'answer-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.innerHTML = `
      <div class="answer-card__radio"></div>
      <span class="answer-card__text">${answer.text}</span>
    `;
    card.addEventListener('click', () => selectAnswer(index, i));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectAnswer(index, i);
      }
    });
    answersContainer.appendChild(card);
  });

  // If user already answered this question (going back), restore selection
  if (state.answers[index]) {
    const prev = state.answers[index].selectedIndex;
    const cards = $$('.answer-card');
    cards[prev].classList.add('selected');
    showInlineTooltip(q);
  }

  showScreen('screen-question');
}

// ===== SELECT ANSWER =====
function selectAnswer(qIndex, aIndex) {
  const q = QUESTIONS[qIndex];
  const answer = q.answers[aIndex];

  // Visual feedback
  $$('.answer-card').forEach((card, i) => {
    card.classList.toggle('selected', i === aIndex);
  });

  // Record answer
  state.answers[qIndex] = {
    questionId: q.id,
    pillar: q.pillar,
    selectedIndex: aIndex,
    selectedText: answer.text,
    points: answer.points
  };

  // Update pillar scores
  recalculateScores();

  // Show inline tooltip + Next button
  showInlineTooltip(q);
}

// ===== SHOW INLINE TOOLTIP =====
function showInlineTooltip(question) {
  const tooltip = $('#question-tooltip');
  const nextBtn = $('#btn-next');
  $('#tooltip-body').textContent = question.tooltip;
  tooltip.hidden = false;
  nextBtn.hidden = false;
  // Force reflow for animation
  void tooltip.offsetWidth;
}

// ===== RECALCULATE SCORES =====
function recalculateScores() {
  state.pillarScores = {};
  state.totalScore = 0;

  state.answers.forEach(a => {
    if (!a) return;
    if (!state.pillarScores[a.pillar]) state.pillarScores[a.pillar] = 0;
    state.pillarScores[a.pillar] += a.points;
    state.totalScore += a.points;
  });
}

// ===== ADVANCE QUESTION =====
function advanceQuestion() {
  // Save partial answers to Sheets (fire-and-forget)
  savePartialToSheets();

  const next = state.currentQuestion + 1;
  if (next < QUESTIONS.length) {
    renderQuestion(next);
  } else {
    // Update progress bar to 100%
    $('#progress-fill').style.width = '100%';
    setTimeout(() => {
      showGateScreen();
    }, 300);
  }
}

// ===== GO BACK =====
function goBack() {
  if (state.currentQuestion > 0) {
    renderQuestion(state.currentQuestion - 1);
  } else {
    showScreen('screen-landing');
  }
}

// ===== GATE SCREEN =====
function showGateScreen() {
  // Render a blurred preview of results
  const preview = $('#gate-preview');
  preview.innerHTML = buildResultsHTML();
  showScreen('screen-gate');
}

// ===== SUBMIT FORM =====
function submitForm(e) {
  e.preventDefault();

  // Honeypot check - bots fill hidden fields, humans don't
  if ($('#field-website').value) return;

  const name = $('#field-name').value.trim();
  const email = $('#field-email').value.trim();
  const company = $('#field-company').value.trim();
  const role = $('#field-role').value.trim();
  const message = $('#field-message').value.trim();
  const mailingList = $('#field-mailinglist').checked;

  // Validate required fields
  let valid = true;
  [['field-name', name], ['field-email', email], ['field-company', company], ['field-role', role]].forEach(([id, val]) => {
    const el = $(`#${id}`);
    if (!val) {
      el.classList.add('error');
      valid = false;
    } else {
      el.classList.remove('error');
    }
  });

  // Email validation
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    $('#field-email').classList.add('error');
    valid = false;
  }

  if (!valid) return;

  state.respondent = { name, email, company, role, message, mailingList };

  // Send email notification
  sendNotificationEmail();

  // Send to Google Sheets
  submitToSheets();

  // Mark partial session as completed
  if (CONFIG.sheetsWebhookUrl && state.sessionId) {
    fetch(CONFIG.sheetsWebhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: CONFIG.webhookToken, sessionId: state.sessionId, isPartial: false })
    }).catch(err => console.error('Partial completion marker failed:', err));
  }

  // Reveal results
  showResults();
}

// ===== SEND EMAIL =====
function sendNotificationEmail() {
  // Skip if EmailJS not configured
  if (CONFIG.emailjs.serviceId === 'YOUR_SERVICE_ID') {
    console.log('EmailJS not configured - skipping email notification');
    console.log('Lead data:', {
      respondent: state.respondent,
      score: state.totalScore,
      grade: getGrade(state.totalScore).letter,
      answers: state.answers
    });
    return;
  }

  const grade = getGrade(state.totalScore);
  const pillarSummary = Object.entries(getPillarMaxes()).map(([key, max]) => {
    const score = state.pillarScores[key] || 0;
    const name = PILLAR_RECOMMENDATIONS[key].name;
    return `${name}: ${score}/${max}`;
  }).join('\n');

  const answersSummary = state.answers.map((a, i) => {
    const q = QUESTIONS[i];
    return `Q${i + 1}: ${q.text}\nA: ${a.selectedText} (${a.points} pts)`;
  }).join('\n\n');

  const recs = getRecommendations().map(r =>
    `${r.name}: ${r.advice}`
  ).join('\n\n');

  const templateParams = {
    respondent_name: state.respondent.name,
    respondent_email: state.respondent.email,
    respondent_company: state.respondent.company,
    respondent_role: state.respondent.role,
    respondent_message: state.respondent.message || 'None',
    mailing_list: state.respondent.mailingList ? 'Yes' : 'No',
    total_score: state.totalScore,
    letter_grade: grade.letter,
    grade_label: grade.label,
    pillar_scores: pillarSummary,
    all_answers: answersSummary,
    recommendations: recs,
    timestamp: new Date().toISOString()
  };

  emailjs.send(CONFIG.emailjs.serviceId, CONFIG.emailjs.templateId, templateParams, CONFIG.emailjs.publicKey)
    .then(() => console.log('Email notification sent'))
    .catch((err) => console.error('Email send failed:', err));
}

// ===== SHOW RESULTS =====
function showResults() {
  const container = $('#results-container');
  container.innerHTML = buildResultsHTML();
  showScreen('screen-results');

  // Animate pillar bars after screen is visible
  setTimeout(() => {
    animatePillarBars();
    animateGauge();
  }, 100);
}

// ===== BUILD RESULTS HTML =====
function buildResultsHTML() {
  const grade = getGrade(state.totalScore);
  const recs = getRecommendations();
  const pillarMaxes = getPillarMaxes();

  let html = '';

  // Score header
  html += `
    <div class="results__score-header">
      <p class="results__score-label">Your PE Security Index</p>
      <div class="results__score-number">${state.totalScore}<span class="results__score-max">/100</span></div>
      <span class="results__grade-badge" style="background:${grade.color}">${grade.letter} - ${grade.label}</span>
    </div>
  `;

  // Gauge
  html += `
    <div class="results__gauge">
      <svg class="gauge-svg" viewBox="0 0 240 140">
        <defs>
          <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#EF4444"/>
            <stop offset="35%" stop-color="#F97316"/>
            <stop offset="50%" stop-color="#EAB308"/>
            <stop offset="75%" stop-color="#0a40ff"/>
            <stop offset="100%" stop-color="#22C55E"/>
          </linearGradient>
        </defs>
        <!-- Background arc -->
        <path d="M 20 120 A 100 100 0 0 1 220 120" fill="none" stroke="#E8EEF4" stroke-width="12" stroke-linecap="round"/>
        <!-- Filled arc -->
        <path id="gauge-fill" d="M 20 120 A 100 100 0 0 1 220 120" fill="none" stroke="url(#gauge-gradient)" stroke-width="12" stroke-linecap="round"
          stroke-dasharray="314.16" stroke-dashoffset="314.16"/>
        <!-- Needle -->
        <line id="gauge-needle" x1="120" y1="120" x2="120" y2="30" stroke="${grade.color}" stroke-width="3" stroke-linecap="round"
          transform="rotate(-90, 120, 120)" style="transition: transform 1.5s cubic-bezier(0.625, 0.05, 0, 1)"/>
        <!-- Center dot -->
        <circle cx="120" cy="120" r="6" fill="${grade.color}"/>
      </svg>
    </div>
  `;

  // Benchmark
  html += `
    <div class="results__benchmark">
      Most firms we work with score between ${CONFIG.benchmarkLow} and ${CONFIG.benchmarkHigh} on their initial assessment.
    </div>
  `;

  // Pillar breakdown
  html += `<div class="results__pillars">
    <h3 class="results__pillars-title">Score Breakdown</h3>`;

  const pillarOrder = ['verification', 'identity', 'authorization', 'capitalEvent', 'communication', 'incident'];
  pillarOrder.forEach(key => {
    const max = pillarMaxes[key];
    const score = state.pillarScores[key] || 0;
    const pct = (score / max) * 100;
    let barColor = 'var(--color-danger)';
    if (pct >= 70) barColor = 'var(--color-success)';
    else if (pct >= 40) barColor = 'var(--color-warning)';

    html += `
      <div class="pillar-row">
        <div class="pillar-row__header">
          <span class="pillar-row__name">${PILLAR_RECOMMENDATIONS[key].name}</span>
          <span class="pillar-row__score">${score}/${max}</span>
        </div>
        <div class="pillar-row__bar">
          <div class="pillar-row__fill" data-width="${pct}" style="background:${barColor}"></div>
        </div>
      </div>
    `;
  });
  html += '</div>';

  // Recommendations
  if (recs.length > 0) {
    html += `<div class="results__recs">
      <h3 class="results__recs-title">Key Areas for Improvement</h3>`;
    recs.forEach(rec => {
      html += `
        <div class="rec-card">
          <p class="rec-card__pillar">${rec.name}</p>
          <p class="rec-card__text">${rec.advice}</p>
        </div>
      `;
    });
    html += '</div>';
  }

  // Closing message
  html += `
    <div class="results__closing">
      <p class="results__closing-text">Regardless of your score, every assessment reveals areas for improvement. The firms that avoid becoming case studies are the ones that take action before the attack - not after. We should talk.</p>
    </div>
  `;

  // CTAs
  html += `
    <div class="results__ctas">
      <a href="${CONFIG.calendarUrl}" target="_blank" rel="noopener" class="btn btn--primary">Schedule 15 Minutes to Discuss Your Results</a>
      <a href="${CONFIG.websiteUrl}" target="_blank" rel="noopener" class="btn btn--secondary">Learn More at 6lock.com</a>
    </div>
  `;

  return html;
}

// ===== ANIMATE GAUGE =====
function animateGauge() {
  const fill = document.getElementById('gauge-fill');
  const needle = document.getElementById('gauge-needle');
  if (!fill || !needle) return;

  const pct = state.totalScore / 100;
  const arcLength = 314.16;
  const targetOffset = arcLength * (1 - pct);

  // Animate arc fill
  requestAnimationFrame(() => {
    fill.style.transition = `stroke-dashoffset 1.5s cubic-bezier(0.625, 0.05, 0, 1)`;
    fill.style.strokeDashoffset = targetOffset;
  });

  // Animate needle rotation (-90 = 0%, +90 = 100%)
  const targetAngle = -90 + (pct * 180);
  requestAnimationFrame(() => {
    needle.setAttribute('transform', `rotate(${targetAngle}, 120, 120)`);
  });
}

// ===== ANIMATE PILLAR BARS =====
function animatePillarBars() {
  $$('.pillar-row__fill').forEach(bar => {
    const targetWidth = bar.dataset.width;
    requestAnimationFrame(() => {
      bar.style.width = targetWidth + '%';
    });
  });
}

// ===== GOOGLE SHEETS - PARTIAL SAVE (fire-and-forget on each "Next") =====
function savePartialToSheets() {
  if (!CONFIG.sheetsWebhookUrl || !state.sessionId) return;

  const grade = getGrade(state.totalScore);
  const payload = {
    token: CONFIG.webhookToken,
    sessionId: state.sessionId,
    timestamp: new Date().toISOString(),
    isPartial: true,
    source: state.source || '',
    score: state.totalScore,
    grade: grade.letter + ' - ' + grade.label
  };

  QUESTIONS.forEach((q, i) => {
    const a = state.answers[i];
    payload['q' + q.id] = a ? a.selectedText : '';
  });

  fetch(CONFIG.sheetsWebhookUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(err => console.error('Partial save failed:', err));
}

// ===== GOOGLE SHEETS - COMPLETE SUBMISSION =====
function submitToSheets() {
  if (!CONFIG.sheetsWebhookUrl) return;

  const grade = getGrade(state.totalScore);
  const pillarMaxes = getPillarMaxes();
  const pillarSummary = Object.entries(pillarMaxes).map(([key, max]) => {
    const score = state.pillarScores[key] || 0;
    return PILLAR_RECOMMENDATIONS[key].name + ': ' + score + '/' + max;
  }).join('; ');

  const row = {
    token: CONFIG.webhookToken,
    timestamp: new Date().toISOString(),
    name: state.respondent.name,
    email: state.respondent.email,
    company: state.respondent.company || '',
    role: state.respondent.role || '',
    score: state.totalScore,
    grade: grade.letter + ' - ' + grade.label,
    pillarScores: pillarSummary,
    mailingList: state.respondent.mailingList ? 'Yes' : 'No',
    source: state.source || ''
  };

  QUESTIONS.forEach((q, i) => {
    const a = state.answers[i];
    row['q' + q.id] = a ? a.selectedText : '';
  });

  fetch(CONFIG.sheetsWebhookUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row)
  })
    .then(() => console.log('Sheets: submitted'))
    .catch(err => console.error('Sheets submit failed:', err));
}

// ===== HELPERS =====
function getGrade(score) {
  return GRADES.find(g => score >= g.min) || GRADES[GRADES.length - 1];
}

function getPillarMaxes() {
  const maxes = {};
  QUESTIONS.forEach(q => {
    if (!maxes[q.pillar]) maxes[q.pillar] = 0;
    maxes[q.pillar] = q.pillarMax; // all questions in same pillar share the same max
  });
  return maxes;
}

function getRecommendations() {
  const pillarMaxes = getPillarMaxes();
  const pillarPcts = Object.entries(pillarMaxes).map(([key, max]) => {
    const score = state.pillarScores[key] || 0;
    return { key, pct: score / max };
  });

  // Sort by weakest first
  pillarPcts.sort((a, b) => a.pct - b.pct);

  // Return 2-3 weakest (those below 70%)
  const weak = pillarPcts.filter(p => p.pct < 0.7);
  const count = Math.min(weak.length, 3);
  return weak.slice(0, count).map(p => PILLAR_RECOMMENDATIONS[p.key]);
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', () => {
  // Capture source from URL (e.g., ?src=mailer for QR code prospects)
  const urlParams = new URLSearchParams(window.location.search);
  state.source = urlParams.get('src') || '';

  // Start button
  $('#btn-start').addEventListener('click', () => {
    state.sessionId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'sess-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    renderQuestion(0);
  });

  // Next button (advance to next question)
  $('#btn-next').addEventListener('click', () => {
    advanceQuestion();
  });

  // Back buttons
  $('#btn-back-question').addEventListener('click', () => {
    goBack();
  });

  $('#btn-back-gate').addEventListener('click', () => {
    // Go back to last question
    renderQuestion(QUESTIONS.length - 1);
  });

  // Gate form submit
  $('#gate-form').addEventListener('submit', submitForm);

  // Initialize EmailJS
  if (CONFIG.emailjs.publicKey !== 'YOUR_PUBLIC_KEY') {
    emailjs.init(CONFIG.emailjs.publicKey);
  }
});
