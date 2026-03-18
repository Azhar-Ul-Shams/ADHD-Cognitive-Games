// ============================================================
//  Dual N-Back Task – X-PhenoADHD pipeline
//  • Unlimited free practice with level selector
//  • Audio rate 1.35 (10% longer than 1.5)
//  • Skip buttons for test blocks
// ============================================================

const ALL_TESTS_DNB = ['go_no_go.html', 'pvt.html', 'trail_making.html', 'dual_n_back.html'];
const THIS_TEST_DNB = 'dual_n_back.html';

const STIMULUS_DURATION = 500;
const ISI_DURATION      = 2500;
const INSTRUCTION_TIME  = 15000;
const TASK_TIME         = 30000;
const REST_TIME         = 15000;
const AUDIO_RATE        = 1.35;   // was 1.5 → 10% longer stimulus

const BLOCKS    = [0, 2, 0, 1, 0, 3];
const LETTERS   = ['G', 'C', 'W', 'P', 'T', 'K', 'H', 'Q'];
const POSITIONS = [0, 1, 2, 3, 5, 6, 7, 8];
const TRIALS_PER_BLOCK = Math.floor(TASK_TIME / (STIMULUS_DURATION + ISI_DURATION));

// ── State ─────────────────────────────────────────────────────
let currentBlockIndex = 0;
let currentTrialIndex = 0;
let trialSequence     = [];
let experimentData    = [];
let visualResponded   = false;
let audioResponded    = false;
let trialStartTime    = 0;
let isPractice        = true;
let blockSkipped      = false;
let practiceNBack     = 1;          // currently selected practice level
let practiceRunning   = false;      // is a practice trial loop active?
let practiceAbort     = false;      // signal to stop running practice loop

const screens = {
    start:        document.getElementById('start-screen'),
    practice:     document.getElementById('practice-screen'),
    instructions: document.getElementById('instructions-screen'),
    task:         document.getElementById('task-screen'),
    rest:         document.getElementById('rest-screen'),
    end:          document.getElementById('end-screen')
};
const feedbackEl   = document.getElementById('feedback-message');
const statusEl     = document.getElementById('practice-status');
const taskHeaderEl = document.getElementById('task-header');
const taskFooterEl = document.getElementById('task-footer');

// ── Utilities ─────────────────────────────────────────────────
function switchScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
}

function navigateDNBNext() {
    let completed = JSON.parse(sessionStorage.getItem('completedTests')) || [];
    if (!completed.includes(THIS_TEST_DNB)) completed.push(THIS_TEST_DNB);
    sessionStorage.setItem('completedTests', JSON.stringify(completed));
    const remaining = ALL_TESTS_DNB.filter(t => !completed.includes(t));
    location.href = remaining.length > 0
        ? remaining[Math.floor(Math.random() * remaining.length)]
        : 'completion.html';
}

function speakLetter(letter) {
    const u = new SpeechSynthesisUtterance(letter);
    u.rate = AUDIO_RATE;
    window.speechSynthesis.cancel();   // clear queue first
    window.speechSynthesis.speak(u);
}

function setStatus(text, type = 'neutral') {
    statusEl.textContent   = text;
    statusEl.className     = 'practice-status visible ' + type;
}

// ── Initial start ─────────────────────────────────────────────
document.getElementById('start-btn').addEventListener('click', () => {
    switchScreen('practice');
    setStatus('Select a level above, then click a level button to begin practicing.', 'neutral');
});
document.getElementById('skipTestBtn').addEventListener('click', navigateDNBNext);
document.getElementById('begin-test-btn').addEventListener('click', beginRealTest);

// ── Practice level buttons ────────────────────────────────────
document.querySelectorAll('.practice-level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const n = parseInt(btn.dataset.n);
        startPracticeLevel(n, btn);
    });
});

function startPracticeLevel(n, btn) {
    // Stop any running practice
    practiceAbort = true;
    practiceRunning = false;
    window.speechSynthesis.cancel();

    // Highlight selected button
    document.querySelectorAll('.practice-level-btn').forEach(b => b.classList.remove('active-level', 'running-level'));
    btn.classList.add('running-level');
    practiceNBack = n;

    const label = n === 0 ? '0-Back (fixed targets)' : `${n}-Back`;
    setStatus(`Practicing ${label} — feedback shown after each trial`, 'neutral');

    // Generate a practice sequence (10 trials, loops)
    practiceAbort   = false;
    isPractice      = true;
    currentTrialIndex = 0;

    // Build task header
    taskHeaderEl.innerHTML = `
        <div class="task-block-badge">${label}</div>
        <div class="task-mode-badge practice-badge">PRACTICE</div>`;
    taskFooterEl.innerHTML = `<button class="btn-skip-round" id="stopPracticeBtn">Stop Practice</button>`;
    document.getElementById('stopPracticeBtn').addEventListener('click', stopPractice);

    trialSequence = generatePracticeTrials(n);
    switchScreen('task');
    feedbackEl.innerText = '';
    runPracticeTrial(n);
}

function stopPractice() {
    practiceAbort = true;
    window.speechSynthesis.cancel();
    switchScreen('practice');
    document.querySelectorAll('.practice-level-btn').forEach(b => b.classList.remove('running-level', 'active-level'));
    setStatus('Practice stopped. Select another level or take the test.', 'neutral');
}

function generatePracticeTrials(n) {
    // Generate 12 trials and loop them
    const trials = [];
    for (let i = 0; i < 12; i++) {
        const isVisTarget = i >= n && Math.random() < 0.35;
        const isAudTarget = i >= n && Math.random() < 0.35;
        let visPos, audLet;
        if (n === 0) {
            visPos = isVisTarget ? 0 : POSITIONS.filter(p => p !== 0)[Math.floor(Math.random() * (POSITIONS.length - 1))];
            audLet = isAudTarget ? 'Q' : LETTERS.filter(l => l !== 'Q')[Math.floor(Math.random() * (LETTERS.length - 1))];
        } else {
            visPos = isVisTarget ? trials[i - n].visPos : POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
            audLet = isAudTarget ? trials[i - n].audLet : LETTERS[Math.floor(Math.random() * LETTERS.length)];
        }
        trials.push({ visPos, audLet, isVisTarget, isAudTarget });
    }
    return trials;
}

function runPracticeTrial(n) {
    if (practiceAbort) return;

    // Loop back
    if (currentTrialIndex >= trialSequence.length) {
        currentTrialIndex = 0;
        trialSequence = generatePracticeTrials(n);
    }

    visualResponded = false;
    audioResponded  = false;
    feedbackEl.innerText = '';

    const trial = trialSequence[currentTrialIndex];
    trialStartTime = performance.now();

    const cell = document.getElementById(`cell-${trial.visPos}`);
    cell.classList.add('active-visual');
    speakLetter(trial.audLet);

    setTimeout(() => {
        if (practiceAbort) { cell.classList.remove('active-visual'); return; }
        cell.classList.remove('active-visual');

        setTimeout(() => {
            if (practiceAbort) return;
            // Show feedback for any missed targets
            const msgs = [];
            if (!visualResponded && trial.isVisTarget) msgs.push('Missed position target');
            if (!audioResponded  && trial.isAudTarget) msgs.push('Missed letter target');
            if (msgs.length > 0) {
                feedbackEl.style.color = '#c2410c';
                feedbackEl.innerText = msgs.join('  |  ');
            } else if (!trial.isVisTarget && !trial.isAudTarget && !visualResponded && !audioResponded) {
                feedbackEl.style.color = '#15803d';
                feedbackEl.innerText = 'Correct — no match this trial';
            }
            currentTrialIndex++;
            setTimeout(() => { if (!practiceAbort) runPracticeTrial(n); }, 400);
        }, ISI_DURATION);
    }, STIMULUS_DURATION);
}

// ── Real test ─────────────────────────────────────────────────
function beginRealTest() {
    practiceAbort = true;
    window.speechSynthesis.cancel();
    isPractice       = false;
    currentBlockIndex = 0;
    runBlockFlow();
}

function runBlockFlow() {
    isPractice    = false;
    blockSkipped  = false;
    feedbackEl.innerText = '';

    if (currentBlockIndex >= BLOCKS.length) {
        switchScreen('end');
        showEndResults();
        return;
    }

    const nBack = BLOCKS[currentBlockIndex];
    trialSequence    = generateBlockTrials(nBack);
    currentTrialIndex = 0;

    switchScreen('instructions');
    document.getElementById('instruction-title').innerText =
        `Block ${currentBlockIndex + 1} of ${BLOCKS.length} — ${nBack}-Back`;
    document.getElementById('instruction-text').innerText = nBack === 0
        ? "Press F when the top-left square lights up. Press J when you hear 'Q'."
        : `Press F / J when position or letter matches ${nBack} step(s) ago.`;

    startCountdown('instruction-timer', INSTRUCTION_TIME / 1000, () => {
        taskHeaderEl.innerHTML = `
            <div class="task-block-badge">Block ${currentBlockIndex + 1}/${BLOCKS.length} — ${nBack}-Back</div>
            <div class="task-mode-badge test-badge">TEST</div>`;
        taskFooterEl.innerHTML = `<button class="btn-skip-round" id="skipBlockBtn">Skip Block</button>`;
        document.getElementById('skipBlockBtn').addEventListener('click', skipBlock);
        switchScreen('task');
        runTrial();
    });
}

function skipBlock() {
    blockSkipped = true;
    window.speechSynthesis.cancel();
    switchScreen('rest');
    startCountdown('rest-timer', REST_TIME / 1000, () => {
        currentBlockIndex++;
        runBlockFlow();
    });
}

function generateBlockTrials(nBack) {
    const trials = [];
    for (let i = 0; i < TRIALS_PER_BLOCK; i++) {
        const isVisTarget = i >= nBack && Math.random() < 0.3;
        const isAudTarget = i >= nBack && Math.random() < 0.3;
        let visPos, audLet;
        if (nBack === 0) {
            visPos = isVisTarget ? 0 : POSITIONS.filter(p => p !== 0)[Math.floor(Math.random() * (POSITIONS.length - 1))];
            audLet = isAudTarget ? 'Q' : LETTERS.filter(l => l !== 'Q')[Math.floor(Math.random() * (LETTERS.length - 1))];
        } else {
            visPos = isVisTarget ? trials[i - nBack].visPos : POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
            audLet = isAudTarget ? trials[i - nBack].audLet : LETTERS[Math.floor(Math.random() * LETTERS.length)];
        }
        trials.push({ visPos, audLet, isVisTarget, isAudTarget });
    }
    return trials;
}

function runTrial() {
    if (blockSkipped) return;
    if (currentTrialIndex >= TRIALS_PER_BLOCK) {
        switchScreen('rest');
        startCountdown('rest-timer', REST_TIME / 1000, () => {
            currentBlockIndex++;
            runBlockFlow();
        });
        return;
    }

    visualResponded = false;
    audioResponded  = false;
    feedbackEl.innerText = '';

    const trial = trialSequence[currentTrialIndex];
    trialStartTime = performance.now();

    const cell = document.getElementById(`cell-${trial.visPos}`);
    cell.classList.add('active-visual');
    speakLetter(trial.audLet);

    setTimeout(() => {
        if (blockSkipped) { cell.classList.remove('active-visual'); return; }
        cell.classList.remove('active-visual');
        setTimeout(() => {
            if (!blockSkipped) { logMisses(); currentTrialIndex++; runTrial(); }
        }, ISI_DURATION);
    }, STIMULUS_DURATION);
}

// ── Response handling ─────────────────────────────────────────
document.addEventListener('keydown', (e) => {
    if (!screens.task.classList.contains('active')) return;
    const rt = performance.now() - trialStartTime;

    if (e.code === 'KeyF' && !visualResponded) {
        visualResponded = true;
        if (isPractice) handlePracticeResponse('visual', rt);
        else recordResponse('visual', rt);
    }
    if (e.code === 'KeyJ' && !audioResponded) {
        audioResponded = true;
        if (isPractice) handlePracticeResponse('audio', rt);
        else recordResponse('audio', rt);
    }
});

function handlePracticeResponse(modality, rt) {
    if (!trialSequence[currentTrialIndex]) return;
    const trial = trialSequence[currentTrialIndex];
    const isTarget = modality === 'visual' ? trial.isVisTarget : trial.isAudTarget;
    feedbackEl.style.color = isTarget ? '#15803d' : '#b91c1c';
    feedbackEl.innerText   = isTarget
        ? `Correct ${modality} match!`
        : `False alarm — that was not a ${modality} target`;
}

function recordResponse(modality, rt) {
    const trial = trialSequence[currentTrialIndex];
    const isTarget = modality === 'visual' ? trial.isVisTarget : trial.isAudTarget;
    experimentData.push({
        block: `${BLOCKS[currentBlockIndex]}-back`,
        trial: currentTrialIndex + 1,
        modality,
        stimulus: modality === 'visual' ? trial.visPos : trial.audLet,
        isTarget,
        responded: true,
        correct: isTarget,
        rt
    });
}

function logMisses() {
    const trial = trialSequence[currentTrialIndex];
    if (!visualResponded && trial.isVisTarget)
        experimentData.push({ block: `${BLOCKS[currentBlockIndex]}-back`, trial: currentTrialIndex + 1, modality: 'visual', stimulus: trial.visPos, isTarget: true, responded: false, correct: false, rt: null });
    if (!audioResponded && trial.isAudTarget)
        experimentData.push({ block: `${BLOCKS[currentBlockIndex]}-back`, trial: currentTrialIndex + 1, modality: 'audio',  stimulus: trial.audLet, isTarget: true, responded: false, correct: false, rt: null });
}

// ── Results ───────────────────────────────────────────────────
function nbackStats(targetBlock) {
    let hits = 0, misses = 0, fa = 0, rtTotal = 0, rtCount = 0;
    experimentData.forEach(t => {
        if (t.block !== targetBlock) return;
        if (t.isTarget && t.responded)  { hits++;  if (t.rt) { rtTotal += t.rt; rtCount++; } }
        else if (t.isTarget)             misses++;
        else if (t.responded)            fa++;
    });
    const avgRT  = rtCount ? Math.round(rtTotal / rtCount) : 0;
    const total  = hits + misses;
    const hitRate = total > 0 ? Math.round((hits / total) * 100) : 0;
    return { hits, misses, fa, avgRT, hitRate };
}

function showEndResults() {
    const levels = ['0-back', '1-back', '2-back', '3-back'];
    const stats  = levels.map(l => ({ level: l, ...nbackStats(l) }));
    const wmLoad = (stats[2].hits + stats[3].hits) - stats[0].hits;

    function gb(v, g, o) { return v >= g ? 'good' : v >= o ? 'ok' : 'concern'; }
    const bl = { good: 'Good', ok: 'Fair', concern: 'Review' };

    document.getElementById('metricsCards').innerHTML = `
        <div class="metric-card"><div class="m-label">2-Back Hit Rate</div><div class="m-value">${stats[2].hitRate}%</div><div class="m-badge ${gb(stats[2].hitRate,70,50)}">${bl[gb(stats[2].hitRate,70,50)]}</div></div>
        <div class="metric-card"><div class="m-label">3-Back Hit Rate</div><div class="m-value">${stats[3].hitRate}%</div><div class="m-badge ${gb(stats[3].hitRate,60,40)}">${bl[gb(stats[3].hitRate,60,40)]}</div></div>
        <div class="metric-card"><div class="m-label">WM Load Index</div><div class="m-value">${wmLoad}</div><div class="m-unit">2+3 back hits</div></div>
        <div class="metric-card"><div class="m-label">2-Back Avg RT</div><div class="m-value">${stats[2].avgRT || '–'}</div><div class="m-unit">ms</div></div>
    `;

    document.getElementById('results-content').innerHTML = `
        <table class="block-table">
            <thead><tr><th>Level</th><th>Hits</th><th>Misses</th><th>False Alarms</th><th>Avg RT</th><th>Hit Rate</th></tr></thead>
            <tbody>${stats.map(s => `
                <tr><td>${s.level}</td><td>${s.hits}</td><td>${s.misses}</td><td>${s.fa}</td><td>${s.avgRT ? s.avgRT + ' ms' : '–'}</td><td>${s.hitRate}%</td></tr>`).join('')}
            </tbody>
            <tfoot><tr><td>WM Load</td><td colspan="5">${wmLoad} (higher = better working memory)</td></tr></tfoot>
        </table>`;

    document.getElementById('goToAnotherTest').style.display = 'block';

    // Persist
    let currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    if (currentUser) {
        currentUser.results.dualNBack = experimentData;
        if (!currentUser.completedTests) currentUser.completedTests = [];
        if (!currentUser.completedTests.includes(THIS_TEST_DNB)) currentUser.completedTests.push(THIS_TEST_DNB);
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        let users = JSON.parse(localStorage.getItem('users')) || [];
        const idx = users.findIndex(u => u.id === currentUser.id);
        if (idx !== -1) { users[idx] = currentUser; localStorage.setItem('users', JSON.stringify(users)); }
    }

    document.getElementById('goToAnotherTest').addEventListener('click', navigateDNBNext);
}

// ── Countdown helper ──────────────────────────────────────────
function startCountdown(elementId, seconds, callback) {
    const el = document.getElementById(elementId);
    let t = seconds;
    el.innerText = t;
    const timer = setInterval(() => {
        t--;
        el.innerText = t;
        if (t <= 0) { clearInterval(timer); callback(); }
    }, 1000);
}
