const ALL_TESTS = ['go_no_go.html', 'pvt.html', 'trail_making.html', 'dual_n_back.html'];
const THIS_TEST = 'trail_making.html';

let numbers = [];
let currentNumber = 1;
let startTime;
let timerInterval;
let isTestRunning = false;
let currentRound = 1;
let round1Time = 0;
let round2Time = 0;
let correctMoves = 0;
let wrongMoves = 0;
let totalMoves = 0;
let round1Results = {};

const elements = {
    welcomeScreen: document.getElementById('welcomeScreen'),
    round1InstructionScreen: document.getElementById('round1InstructionScreen'),
    round1PracticeScreen: document.getElementById('round1PracticeScreen'),
    round1TestScreen: document.getElementById('round1TestScreen'),
    round1CompleteScreen: document.getElementById('round1CompleteScreen'),
    round2InstructionScreen: document.getElementById('round2InstructionScreen'),
    round2PracticeScreen: document.getElementById('round2PracticeScreen'),
    round2TestScreen: document.getElementById('round2TestScreen'),
    finalResultsScreen: document.getElementById('finalResultsScreen'),
    startButton: document.getElementById('startButton'),
    round1StartButton: document.getElementById('round1StartButton'),
    round1PracticeCompleteButton: document.getElementById('round1PracticeCompleteButton'),
    proceedToRound2Button: document.getElementById('proceedToRound2Button'),
    round2StartButton: document.getElementById('round2StartButton'),
    round2PracticeCompleteButton: document.getElementById('round2PracticeCompleteButton'),
    goToAnotherTest: document.getElementById('goToAnotherTest'),
    trailContainer: document.getElementById('trailContainer'),
    practiceTrailContainer: document.getElementById('practiceTrailContainer'),
    round2PracticeTrailContainer: document.getElementById('round2PracticeTrailContainer'),
    round2TrailContainer: document.getElementById('round2TrailContainer'),
    timeDisplay: document.getElementById('time'),
    round2TimeDisplay: document.getElementById('round2Time'),
    round1Result: document.getElementById('round1Result'),
    finalResults: document.getElementById('finalResults'),
    practiceFeedback: document.getElementById('practiceFeedback'),
    round2PracticeFeedback: document.getElementById('round2PracticeFeedback')
};

function navigateNext() {
    let completed = JSON.parse(sessionStorage.getItem('completedTests')) || [];
    if (!completed.includes(THIS_TEST)) completed.push(THIS_TEST);
    sessionStorage.setItem('completedTests', JSON.stringify(completed));
    const remaining = ALL_TESTS.filter(t => !completed.includes(t));
    location.href = remaining.length > 0 ? remaining[Math.floor(Math.random() * remaining.length)] : 'completion.html';
}

// Event Listeners
elements.startButton.addEventListener('click', () => {
    elements.welcomeScreen.style.display = 'none';
    elements.round1InstructionScreen.style.display = 'block';
});
elements.round1StartButton.addEventListener('click', startRound1Practice);
elements.round1PracticeCompleteButton.addEventListener('click', startRound1Test);
elements.proceedToRound2Button.addEventListener('click', showRound2Instructions);
elements.round2StartButton.addEventListener('click', startRound2Practice);
elements.round2PracticeCompleteButton.addEventListener('click', startRound2Test);
elements.goToAnotherTest.addEventListener('click', navigateNext);

document.getElementById('skipTestBtn').addEventListener('click', navigateNext);
document.getElementById('skipPractice1Btn').addEventListener('click', startRound1Test);
document.getElementById('skipPractice2Btn').addEventListener('click', startRound2Test);
document.getElementById('skipRound1Btn').addEventListener('click', () => {
    if (!isTestRunning) return;
    clearInterval(timerInterval); isTestRunning = false;
    round1Time = Math.floor((Date.now() - startTime) / 1000);
    round1Results = { time: round1Time, totalMoves, correctMoves, wrongMoves: totalMoves - correctMoves };
    showRound1Results();
});
document.getElementById('skipRound2Btn').addEventListener('click', () => {
    if (!isTestRunning) return;
    clearInterval(timerInterval); isTestRunning = false;
    round2Time = Math.floor((Date.now() - startTime) / 1000);
    showFinalResults();
});

function generateNumbers(round) {
    numbers = [];
    if (round === 1) {
        for (let i = 1; i <= 25; i++) numbers.push({ value: i, type: 'number' });
    } else {
        for (let i = 1; i <= 13; i++) {
            numbers.push({ value: i, type: 'number' });
            if (i <= 12) numbers.push({ value: String.fromCharCode(64 + i), type: 'letter' });
        }
    }
    const first = numbers.shift();
    numbers.sort(() => Math.random() - 0.5);
    numbers.unshift(first);
}

function displayNumbers(container, isPractice = false) {
    container.innerHTML = '';
    numbers.forEach(item => {
        const div = document.createElement('div');
        div.textContent = item.value;
        div.addEventListener('click', () => handleNumberClick(item, container, isPractice));
        container.appendChild(div);
    });
}

function handleNumberClick(item, container, isPractice) {
    if (!isPractice && !isTestRunning) return;
    if (!isPractice) totalMoves++;
    const expectedType = currentRound === 1 ? 'number' : (currentNumber % 2 === 1 ? 'number' : 'letter');
    const expectedValue = currentRound === 1 ? currentNumber : (expectedType === 'number' ? Math.ceil(currentNumber / 2) : String.fromCharCode(64 + Math.floor(currentNumber / 2)));
    const numberDivs = container.querySelectorAll('div');
    const index = numbers.findIndex(n => n.value === item.value && n.type === item.type);

    if (item.type === expectedType && item.value === expectedValue) {
        numberDivs[index].classList.add('clicked');
        if (isPractice) {
            const fb = currentRound === 1 ? elements.practiceFeedback : elements.round2PracticeFeedback;
            fb.textContent = 'Correct! Click the next one.'; fb.className = 'feedback-msg correct-feedback';
        } else { correctMoves++; }
        currentNumber++;
        const totalItems = 25;
        if (currentNumber > totalItems) {
            if (!isPractice) endTest();
            else {
                const fb = currentRound === 1 ? elements.practiceFeedback : elements.round2PracticeFeedback;
                fb.textContent = 'Practice complete!';
                currentNumber = 1; generateNumbers(currentRound); displayNumbers(container, isPractice);
            }
        }
    } else if (isPractice) {
        numberDivs[index].classList.add('wrong');
        const fb = currentRound === 1 ? elements.practiceFeedback : elements.round2PracticeFeedback;
        fb.textContent = 'Wrong! Try again.'; fb.className = 'feedback-msg wrong-feedback';
    }
}

function startRound1Practice() {
    elements.round1InstructionScreen.style.display = 'none';
    elements.round1PracticeScreen.style.display = 'block';
    currentRound = 1; currentNumber = 1;
    generateNumbers(1); displayNumbers(elements.practiceTrailContainer, true);
    elements.practiceFeedback.textContent = '';
}

function startRound1Test() {
    elements.round1PracticeScreen.style.display = 'none';
    elements.round1TestScreen.style.display = 'block';
    currentNumber = 1; correctMoves = 0; wrongMoves = 0; totalMoves = 0; isTestRunning = true;
    generateNumbers(1); displayNumbers(elements.trailContainer);
    startTime = Date.now(); startTimer(elements.timeDisplay);
}

function startRound2Practice() {
    elements.round2InstructionScreen.style.display = 'none';
    elements.round2PracticeScreen.style.display = 'block';
    currentRound = 2; currentNumber = 1;
    generateNumbers(2); displayNumbers(elements.round2PracticeTrailContainer, true);
    elements.round2PracticeFeedback.textContent = '';
}

function startRound2Test() {
    elements.round2PracticeScreen.style.display = 'none';
    elements.round2TestScreen.style.display = 'block';
    currentNumber = 1; correctMoves = 0; wrongMoves = 0; totalMoves = 0; isTestRunning = true;
    generateNumbers(2); displayNumbers(elements.round2TrailContainer);
    startTime = Date.now(); startTimer(elements.round2TimeDisplay);
}

function startTimer(timeElement) {
    clearInterval(timerInterval);
    timeElement.textContent = 0;
    timerInterval = setInterval(() => { timeElement.textContent = Math.floor((Date.now() - startTime) / 1000); }, 1000);
}

function endTest() {
    clearInterval(timerInterval); isTestRunning = false;
    const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    if (currentRound === 1) {
        round1Time = elapsedTime;
        round1Results = { time: elapsedTime, totalMoves, correctMoves, wrongMoves: totalMoves - correctMoves };
        showRound1Results();
    } else {
        round2Time = elapsedTime; showFinalResults();
    }
}

function showRound1Results() {
    elements.round1TestScreen.style.display = 'none';
    elements.round1CompleteScreen.style.display = 'block';
    const accuracy = round1Results.totalMoves > 0 ? Math.round((round1Results.correctMoves / round1Results.totalMoves) * 100) : 0;
    elements.round1Result.innerHTML = `
        <div class="metrics-grid">
            <div class="metric-card"><div class="m-label">Time</div><div class="m-value">${round1Results.time}</div><div class="m-unit">seconds</div></div>
            <div class="metric-card"><div class="m-label">Correct</div><div class="m-value">${round1Results.correctMoves}</div><div class="m-unit">moves</div></div>
            <div class="metric-card"><div class="m-label">Errors</div><div class="m-value">${round1Results.wrongMoves}</div><div class="m-unit">wrong clicks</div></div>
            <div class="metric-card"><div class="m-label">Accuracy</div><div class="m-value">${accuracy}%</div></div>
        </div>`;
}

function showRound2Instructions() {
    elements.round1CompleteScreen.style.display = 'none';
    elements.round2InstructionScreen.style.display = 'block';
}

function showFinalResults() {
    elements.round2TestScreen.style.display = 'none';
    elements.finalResultsScreen.style.display = 'block';
    const round2Results = { time: round2Time, totalMoves, correctMoves, wrongMoves: totalMoves - correctMoves };
    const r1 = round1Results, r2 = round2Results;
    const baRatio = r1.time > 0 ? (r2.time / r1.time).toFixed(2) : '–';
    const totalCorrect = (r1.correctMoves || 0) + r2.correctMoves;
    const totalWrong = (r1.wrongMoves || 0) + r2.wrongMoves;

    function rBadge(v, g, o) { return v <= g ? 'good' : v <= o ? 'ok' : 'concern'; }
    const bl = { good:'Good', ok:'Fair', concern:'Review' };

    document.getElementById('metricsCards').innerHTML = `
        <div class="metric-card"><div class="m-label">Part A Time</div><div class="m-value">${r1.time||'–'}</div><div class="m-unit">seconds</div><div class="m-badge ${rBadge(r1.time||99,60,120)}">${bl[rBadge(r1.time||99,60,120)]}</div></div>
        <div class="metric-card"><div class="m-label">Part B Time</div><div class="m-value">${r2.time||'–'}</div><div class="m-unit">seconds</div><div class="m-badge ${rBadge(r2.time||99,90,180)}">${bl[rBadge(r2.time||99,90,180)]}</div></div>
        <div class="metric-card"><div class="m-label">B/A Ratio</div><div class="m-value">${baRatio}</div><div class="m-unit">flex. index</div><div class="m-badge ${rBadge(parseFloat(baRatio)||99,2.5,4)}">${bl[rBadge(parseFloat(baRatio)||99,2.5,4)]}</div></div>
        <div class="metric-card"><div class="m-label">Total Correct</div><div class="m-value">${totalCorrect}</div><div class="m-unit">moves</div></div>
        <div class="metric-card"><div class="m-label">Total Errors</div><div class="m-value">${totalWrong}</div><div class="m-unit">wrong clicks</div><div class="m-badge ${rBadge(totalWrong,3,8)}">${bl[rBadge(totalWrong,3,8)]}</div></div>
    `;

    elements.finalResults.innerHTML = `
        <table class="block-table">
            <thead><tr><th>Metric</th><th>Part A</th><th>Part B</th></tr></thead>
            <tbody>
                <tr><td>Time (s)</td><td>${r1.time||'–'}</td><td>${r2.time||'–'}</td></tr>
                <tr><td>Correct Moves</td><td>${r1.correctMoves||0}</td><td>${r2.correctMoves}</td></tr>
                <tr><td>Wrong Clicks</td><td>${r1.wrongMoves||0}</td><td>${r2.wrongMoves}</td></tr>
                <tr><td>Total Moves</td><td>${r1.totalMoves||0}</td><td>${r2.totalMoves}</td></tr>
            </tbody>
            <tfoot><tr><td>B/A Ratio (flex)</td><td colspan="2">${baRatio}</td></tr></tfoot>
        </table>`;

    let currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    if (currentUser) {
        currentUser.results.trailMaking = { round1: r1, round2: r2, totalTime: (r1.time||0)+r2.time, totalCorrect, totalWrong };
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        let users = JSON.parse(localStorage.getItem('users')) || [];
        const idx = users.findIndex(u => u.id === currentUser.id);
        if (idx !== -1) { users[idx] = currentUser; localStorage.setItem('users', JSON.stringify(users)); }
    }
}
