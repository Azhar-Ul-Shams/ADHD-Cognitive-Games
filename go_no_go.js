// ============================================================
//  Go / No-Go Task  –  X-PhenoADHD data pipeline
// ============================================================

const ALL_TESTS  = ['go_no_go.html', 'pvt.html', 'trail_making.html', 'dual_n_back.html'];
const THIS_TEST  = 'go_no_go.html';

let score            = 0;
let correctGoHits    = 0;
let commissionErrors = 0;
let omissionErrors   = 0;
let totalGoTrials    = 0;
let totalNoGoTrials  = 0;
let totalTrials      = 0;

let testDuration  = 30;
let timeLeft      = testDuration;
let timerInterval;
let isTestRunning    = false;
let isPracticeRound  = false;
let currentRound     = 1;
const totalRounds    = 3;

let roundResults       = [];
let stimulusTimeout;
let fixationTimeout;
let stimulusStartTime  = 0;
let respondedThisTrial = false;
let currentTrialType   = null;
let currentBlockRTs    = [];

// ── Event listeners ──────────────────────────────────────────
document.getElementById('goNoGoButton').addEventListener('click', startInitialTest);
document.getElementById('skipTestBtn').addEventListener('click', () => navigateNext());
document.getElementById('skipRoundBtn').addEventListener('click', skipCurrentRound);
document.addEventListener('keydown', handleKeyPress);

// ── Navigation helper ─────────────────────────────────────────
function navigateNext() {
    let completed = JSON.parse(sessionStorage.getItem('completedTests')) || [];
    if (!completed.includes(THIS_TEST)) completed.push(THIS_TEST);
    sessionStorage.setItem('completedTests', JSON.stringify(completed));
    const remaining = ALL_TESTS.filter(t => !completed.includes(t));
    location.href = remaining.length > 0
        ? remaining[Math.floor(Math.random() * remaining.length)]
        : 'completion.html';
}

function skipCurrentRound() {
    if (!isTestRunning && !isPracticeRound) return;
    clearInterval(timerInterval);
    clearTimeout(stimulusTimeout);
    clearTimeout(fixationTimeout);
    isTestRunning = false;

    if (isPracticeRound) {
        document.getElementById('message').textContent = 'Starting main test…';
        setTimeout(() => startMainTest(1), 800);
    } else {
        endRound();
    }
}

function startInitialTest() {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('testContainer').style.display = 'block';
    document.getElementById('goNoGoButton').textContent = 'Preparing…';
    document.getElementById('goNoGoButton').disabled = true;
    setTimeout(startPracticeRound, 1000);
}

function startPracticeRound() {
    isPracticeRound = true;
    resetBlockCounters();
    timeLeft      = 10;
    isTestRunning = true;
    document.getElementById('message').textContent = 'Practice Round – Get ready!';
    document.getElementById('currentRound').textContent = 'Practice';
    startTimer();
    showNextStimulus();
}

function startMainTest(round) {
    isPracticeRound = false;
    resetBlockCounters();
    timeLeft      = testDuration;
    isTestRunning = true;
    currentRound  = round;
    document.getElementById('currentRound').textContent = `${currentRound}/${totalRounds}`;
    document.getElementById('message').textContent = `Round ${currentRound} – Be ready!`;
    startTimer();
    showNextStimulus();
}

function resetBlockCounters() {
    score = correctGoHits = commissionErrors = omissionErrors = 0;
    totalGoTrials = totalNoGoTrials = totalTrials = 0;
    currentBlockRTs = [];
}

function showNextStimulus() {
    clearTimeout(stimulusTimeout);
    clearTimeout(fixationTimeout);
    const shapeDisplay = document.getElementById('shapeDisplay');
    shapeDisplay.textContent = '+';
    shapeDisplay.style.backgroundColor = 'transparent';
    shapeDisplay.className = 'shape-display';
    respondedThisTrial = false;
    currentTrialType   = null;

    fixationTimeout = setTimeout(() => {
        const isGo     = Math.random() < 0.7;
        currentTrialType = isGo ? 'go' : 'nogo';
        shapeDisplay.textContent = '';
        shapeDisplay.style.backgroundColor = isGo ? '#ff9800' : '#2196f3';
        shapeDisplay.className = `shape-display ${isGo ? 'orange' : 'blue'}-square`;
        stimulusStartTime = Date.now();
        totalTrials++;
        if (isGo) totalGoTrials++; else totalNoGoTrials++;

        stimulusTimeout = setTimeout(() => {
            if (!respondedThisTrial && isTestRunning) {
                if (currentTrialType === 'go') omissionErrors++;
            }
            shapeDisplay.textContent = '+';
            shapeDisplay.style.backgroundColor = 'transparent';
            shapeDisplay.className = 'shape-display';
            currentTrialType = null;
            if (isTestRunning) setTimeout(showNextStimulus, Math.random() * 1000 + 500);
        }, 1000);
    }, Math.random() * 500 + 500);
}

function handleKeyPress(e) {
    if (e.code !== 'Space' || !isTestRunning || respondedThisTrial) return;
    e.preventDefault();
    respondedThisTrial = true;
    const shapeDisplay = document.getElementById('shapeDisplay');
    const reactionTime = Date.now() - stimulusStartTime;

    if (shapeDisplay.classList.contains('orange-square')) {
        correctGoHits++; score++;
        currentBlockRTs.push(reactionTime);
        if (isPracticeRound) {
            document.getElementById('message').textContent = `Correct! (${reactionTime} ms)`;
            document.getElementById('message').style.color = '#27ae60';
        }
    } else if (shapeDisplay.classList.contains('blue-square')) {
        commissionErrors++;
        if (isPracticeRound) {
            document.getElementById('message').textContent = "Wrong! Don't press for blue.";
            document.getElementById('message').style.color = '#e74c3c';
        }
    } else {
        commissionErrors++;
        if (isPracticeRound) {
            document.getElementById('message').textContent = 'Too early! Wait for the square.';
            document.getElementById('message').style.color = '#e74c3c';
        }
    }
    shapeDisplay.textContent = '+';
    shapeDisplay.style.backgroundColor = 'transparent';
    shapeDisplay.className = 'shape-display';
    if (!isPracticeRound) setTimeout(() => { document.getElementById('message').textContent = ''; }, 300);
}

function startTimer() {
    clearInterval(timerInterval);
    document.getElementById('timeLeft').textContent = timeLeft;
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timeLeft').textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            clearTimeout(stimulusTimeout);
            clearTimeout(fixationTimeout);
            if (isPracticeRound) {
                document.getElementById('message').textContent = 'Practice complete! Main test starts now.';
                setTimeout(() => startMainTest(1), 2000);
            } else {
                endRound();
            }
        }
    }, 1000);
}

function endRound() {
    isTestRunning = false;
    clearInterval(timerInterval);
    clearTimeout(stimulusTimeout);
    clearTimeout(fixationTimeout);
    const blockRTs      = [...currentBlockRTs];
    const avgRT         = computeMean(blockRTs);
    const rtVariability = computeSD(blockRTs);
    roundResults.push({ round: currentRound, totalGoTrials, totalNoGoTrials, correctGoHits, commissionErrors, omissionErrors, avgRT, rtVariability, rtArray: blockRTs });
    currentBlockRTs = [];
    if (currentRound < totalRounds) {
        currentRound++;
        setTimeout(() => startMainTest(currentRound), 2000);
    } else {
        showFinalResults();
    }
}

function computeMean(arr) {
    if (!arr.length) return 0;
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}
function computeMedian(arr) {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
        ? sorted[mid]
        : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}
function computeSD(arr) {
    if (arr.length < 2) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (arr.length - 1);
    return Math.round(Math.sqrt(variance));
}
function computeTemporalDriftIndex(values) {
    const n = values.length;
    if (n < 2) return 0;
    const xs = values.map((_, i) => i + 1);
    const xMean = xs.reduce((a, b) => a + b, 0) / n;
    const yMean = values.reduce((a, b) => a + b, 0) / n;
    const num = xs.reduce((s, x, i) => s + (x - xMean) * (values[i] - yMean), 0);
    const den = xs.reduce((s, x) => s + Math.pow(x - xMean, 2), 0);
    return den === 0 ? 0 : Math.round((num / den) * 100) / 100;
}
function getBadge(val, goodThresh, okThresh) {
    return val <= goodThresh ? 'good' : val <= okThresh ? 'ok' : 'concern';
}
function rtBadge(ms) { return ms < 300 ? 'good' : ms < 450 ? 'ok' : 'concern'; }
const badgeLabel = { good: 'Good', ok: 'Fair', warn: 'Note', concern: 'Review' };

function showFinalResults() {
    document.getElementById('testScreen').style.display    = 'none';
    document.getElementById('resultsScreen').style.display = 'block';

    let totalCE = 0, totalOE = 0, totalHits = 0, totalGo = 0, totalNoGo = 0, allRTs = [];
    roundResults.forEach(r => {
        totalCE += r.commissionErrors; totalOE += r.omissionErrors;
        totalHits += r.correctGoHits; totalGo += r.totalGoTrials;
        totalNoGo += r.totalNoGoTrials; allRTs = allRTs.concat(r.rtArray);
    });

    const overallAvgRT    = computeMean(allRTs);
    const overallMedianRT = computeMedian(allRTs);
    const overallRTV      = computeSD(allRTs);
    const tdi             = computeTemporalDriftIndex(roundResults.map(r => r.rtVariability));
    const hitRate         = totalGo > 0 ? Math.round((totalHits / totalGo) * 100) : 0;

    const cards = [
        { label: 'Avg RT',           value: overallAvgRT    || '–', unit: 'ms',          badge: overallAvgRT    ? rtBadge(overallAvgRT)         : 'ok' },
        { label: 'Median RT',        value: overallMedianRT || '–', unit: 'ms',          badge: overallMedianRT ? rtBadge(overallMedianRT)       : 'ok' },
        { label: 'RT Variability',   value: overallRTV      || '–', unit: 'ms SD',       badge: overallRTV      ? getBadge(overallRTV, 80, 140)  : 'ok' },
        { label: 'Commission Errors',value: totalCE,                unit: 'false alarms', badge: getBadge(totalCE, 5, 12) },
        { label: 'Omission Errors',  value: totalOE,                unit: 'misses',       badge: getBadge(totalOE, 3, 8) },
        { label: 'Go Hit Rate',      value: hitRate + '%',          unit: '',             badge: hitRate >= 85 ? 'good' : hitRate >= 70 ? 'ok' : 'concern' },
    ];

    document.getElementById('metricsCards').innerHTML = cards.map(c => `
        <div class="metric-card">
            <div class="m-label">${c.label}</div>
            <div class="m-value">${c.value}</div>
            ${c.unit ? `<div class="m-unit">${c.unit}</div>` : ''}
            <div class="m-badge ${c.badge}">${badgeLabel[c.badge]}</div>
        </div>
    `).join('');

    const tbody = document.getElementById('resultsBody');
    const tfoot = document.getElementById('resultsFoot');
    tbody.innerHTML = '';
    roundResults.forEach(r => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${r.round}</td><td>${r.totalGoTrials}</td><td>${r.totalNoGoTrials}</td><td>${r.commissionErrors}</td><td>${r.omissionErrors}</td><td>${r.avgRT > 0 ? r.avgRT + ' ms' : '–'}</td><td>${r.rtVariability > 0 ? r.rtVariability + ' ms' : '–'}</td>`;
        tbody.appendChild(row);
    });
    tfoot.innerHTML = `<tr><td>Total</td><td>${totalGo}</td><td>${totalNoGo}</td><td>${totalCE}</td><td>${totalOE}</td><td>${overallAvgRT > 0 ? overallAvgRT + ' ms' : '–'}</td><td>${overallRTV > 0 ? overallRTV + ' ms' : '–'}</td></tr>`;

    let currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    if (currentUser) {
        currentUser.results.goNoGo = { rounds: roundResults, totalCommission: totalCE, totalOmission: totalOE, totalGoHits: totalHits, overallAvgRT, overallMedianRT, overallRTV, temporalDriftIdx: tdi, allRTs };
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        let users = JSON.parse(localStorage.getItem('users')) || [];
        const idx = users.findIndex(u => u.id === currentUser.id);
        if (idx !== -1) { users[idx] = currentUser; localStorage.setItem('users', JSON.stringify(users)); }
    }

    document.getElementById('goToAnotherTest').addEventListener('click', navigateNext);
}
