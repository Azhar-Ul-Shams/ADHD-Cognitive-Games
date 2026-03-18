// ============================================================
//  PVT – X-PhenoADHD pipeline (with skip buttons + styled results)
// ============================================================

const ALL_TESTS = ['go_no_go.html', 'pvt.html', 'trail_making.html', 'dual_n_back.html'];
const THIS_TEST = 'pvt.html';

let startTime;
let reactionTimes = [];
let falseStarts   = 0;
let lapses        = 0;
let testDuration  = 30;
let timeLeft      = testDuration;
let timerInterval;
let isTestRunning    = false;
let isStimulusOn     = false;
let currentRound     = 1;
const totalRounds    = 3;
let roundResults     = [];
let stimulusTimeout;
let fixationTimeout;
let isPracticeRound  = false;

document.getElementById('startButton').addEventListener('click', startPracticeRound);
document.getElementById('skipTestBtn').addEventListener('click', () => navigateNext());
document.getElementById('skipPracticeBtn').addEventListener('click', skipPractice);
document.getElementById('skipRoundBtn').addEventListener('click', skipRound);
document.addEventListener('keydown', handleKeyPress);

function navigateNext() {
    let completed = JSON.parse(sessionStorage.getItem('completedTests')) || [];
    if (!completed.includes(THIS_TEST)) completed.push(THIS_TEST);
    sessionStorage.setItem('completedTests', JSON.stringify(completed));
    const remaining = ALL_TESTS.filter(t => !completed.includes(t));
    location.href = remaining.length > 0 ? remaining[Math.floor(Math.random() * remaining.length)] : 'completion.html';
}

function skipPractice() {
    clearInterval(timerInterval); clearTimeout(stimulusTimeout); clearTimeout(fixationTimeout);
    isTestRunning = false;
    document.getElementById('practiceScreen').style.display = 'none';
    setTimeout(() => startTestRound(1), 300);
}

function skipRound() {
    if (!isTestRunning) return;
    clearInterval(timerInterval); clearTimeout(stimulusTimeout); clearTimeout(fixationTimeout);
    isTestRunning = false;
    endRound();
}

function startPracticeRound() {
    isPracticeRound = true;
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('practiceScreen').style.display = 'block';
    resetBlockCounters();
    timeLeft = testDuration; isTestRunning = true;
    startTimer('practiceTimeLeft');
    showNextStimulus(true);
}

function startTestRound(round) {
    isPracticeRound = false;
    document.getElementById('practiceScreen').style.display = 'none';
    document.getElementById('testScreen').style.display = 'block';
    resetBlockCounters();
    timeLeft = testDuration; isTestRunning = true;
    currentRound = round;
    document.getElementById('currentRound').textContent = `${currentRound}/${totalRounds}`;
    document.getElementById('message').textContent = '';
    startTimer('timeLeft');
    showNextStimulus(false);
}

function resetBlockCounters() { reactionTimes = []; falseStarts = 0; lapses = 0; }

function showNextStimulus(showFeedback) {
    clearTimeout(stimulusTimeout); clearTimeout(fixationTimeout);
    const stimulusDisplay = isPracticeRound ? document.getElementById('practiceStimulus') : document.getElementById('stimulusDisplay');
    stimulusDisplay.textContent = '+'; stimulusDisplay.style.color = '#000';
    isStimulusOn = false;
    fixationTimeout = setTimeout(() => {
        stimulusDisplay.textContent = '0'; stimulusDisplay.style.color = '#e53935';
        startTime = Date.now(); isStimulusOn = true;
        const counterInterval = setInterval(() => {
            if (isStimulusOn) stimulusDisplay.textContent = Date.now() - startTime;
            else clearInterval(counterInterval);
        }, 10);
        stimulusTimeout = setTimeout(() => {
            if (isStimulusOn) lapses++;
            stimulusDisplay.textContent = '+'; stimulusDisplay.style.color = '#000';
            isStimulusOn = false; clearInterval(counterInterval);
            if (isTestRunning) setTimeout(() => showNextStimulus(showFeedback), Math.random() * 8000 + 2000);
        }, 1000);
    }, Math.random() * 8000 + 2000);
}

function handleKeyPress(e) {
    if (e.code !== 'Space' || !isTestRunning) return;
    e.preventDefault();
    const stimulusDisplay = isPracticeRound ? document.getElementById('practiceStimulus') : document.getElementById('stimulusDisplay');
    const messageElement = isPracticeRound ? document.getElementById('practiceMessage') : document.getElementById('message');
    const currentTime = Date.now();
    if (isStimulusOn) {
        const reactionTime = currentTime - startTime;
        if (reactionTime < 100) {
            falseStarts++;
            if (isPracticeRound) { messageElement.textContent = 'False start! (<100ms)'; messageElement.style.color = '#e74c3c'; }
        } else {
            reactionTimes.push(reactionTime);
            if (reactionTime > 500) lapses++;
            if (isPracticeRound) { messageElement.textContent = `${reactionTime}ms${reactionTime > 500 ? ' (lapse)' : ''}`; messageElement.style.color = reactionTime > 500 ? '#e67e22' : '#27ae60'; }
        }
        stimulusDisplay.textContent = '+'; stimulusDisplay.style.color = '#000';
        isStimulusOn = false;
        clearTimeout(stimulusTimeout);
        setTimeout(() => showNextStimulus(isPracticeRound), Math.random() * 8000 + 2000);
    } else {
        falseStarts++;
        if (isPracticeRound) { messageElement.textContent = 'False start! No stimulus.'; messageElement.style.color = '#e74c3c'; }
    }
}

function startTimer(timeElementId) {
    clearInterval(timerInterval);
    document.getElementById(timeElementId).textContent = timeLeft;
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById(timeElementId).textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerInterval); clearTimeout(stimulusTimeout); clearTimeout(fixationTimeout);
            endRound();
        }
    }, 1000);
}

function endRound() {
    isTestRunning = false;
    const blockRTs = [...reactionTimes];
    const avgRT = computeMean(blockRTs);
    const rtVariability = computeSD(blockRTs);
    if (isPracticeRound) { setTimeout(() => startTestRound(1), 2000); return; }
    roundResults.push({ round: currentRound, avgRT, rtVariability, validAttempts: blockRTs.length, falseStarts, lapses, rtArray: blockRTs });
    if (currentRound < totalRounds) { currentRound++; setTimeout(() => startTestRound(currentRound), 2000); }
    else showFinalResults();
}

function computeMean(arr) { if (!arr.length) return 0; return Math.round(arr.reduce((a,b)=>a+b,0)/arr.length); }
function computeMedian(arr) {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid-1] + sorted[mid]) / 2);
}
function computeSD(arr) {
    if (arr.length < 2) return 0;
    const mean = arr.reduce((a,b)=>a+b,0)/arr.length;
    return Math.round(Math.sqrt(arr.reduce((s,v)=>s+Math.pow(v-mean,2),0)/(arr.length-1)));
}
function computeTemporalDriftIndex(values) {
    const n = values.length; if (n < 2) return 0;
    const xs = values.map((_,i)=>i+1), xMean = xs.reduce((a,b)=>a+b,0)/n, yMean = values.reduce((a,b)=>a+b,0)/n;
    const num = xs.reduce((s,x,i)=>s+(x-xMean)*(values[i]-yMean),0), den = xs.reduce((s,x)=>s+Math.pow(x-xMean,2),0);
    return den===0 ? 0 : Math.round((num/den)*100)/100;
}
function getBadge(val, g, o) { return val <= g ? 'good' : val <= o ? 'ok' : 'concern'; }
function rtBadge(ms) { return ms < 300 ? 'good' : ms < 450 ? 'ok' : 'concern'; }
const badgeLabel = { good:'Good', ok:'Fair', warn:'Note', concern:'Review' };

function showFinalResults() {
    document.getElementById('testScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'block';
    let totalValid=0, totalFS=0, totalLapses=0, allRTs=[];
    roundResults.forEach(r => { totalValid+=r.validAttempts; totalFS+=r.falseStarts; totalLapses+=r.lapses; allRTs=allRTs.concat(r.rtArray); });
    const overallAvgRT=computeMean(allRTs), overallMedianRT=computeMedian(allRTs), overallRTV=computeSD(allRTs);
    const tdi=computeTemporalDriftIndex(roundResults.map(r=>r.rtVariability));

    const cards = [
        { label:'Avg RT',          value: overallAvgRT    ||'–', unit:'ms',     badge: overallAvgRT    ? rtBadge(overallAvgRT)        : 'ok' },
        { label:'Median RT',       value: overallMedianRT ||'–', unit:'ms',     badge: overallMedianRT ? rtBadge(overallMedianRT)      : 'ok' },
        { label:'RT Variability',  value: overallRTV      ||'–', unit:'ms SD',  badge: overallRTV      ? getBadge(overallRTV,80,140)   : 'ok' },
        { label:'Lapses',          value: totalLapses,            unit:'RT > 500 ms', badge: getBadge(totalLapses,2,6) },
        { label:'False Starts',    value: totalFS,                unit:'anticipatory', badge: getBadge(totalFS,2,6) },
        { label:'Valid Trials',    value: totalValid,             unit:'responses', badge: totalValid >= 20 ? 'good' : totalValid >= 10 ? 'ok' : 'concern' },
    ];
    document.getElementById('metricsCards').innerHTML = cards.map(c=>`
        <div class="metric-card">
            <div class="m-label">${c.label}</div>
            <div class="m-value">${c.value}</div>
            ${c.unit?`<div class="m-unit">${c.unit}</div>`:''}
            <div class="m-badge ${c.badge}">${badgeLabel[c.badge]}</div>
        </div>`).join('');

    const tbody=document.getElementById('resultsBody'), tfoot=document.getElementById('resultsFoot');
    tbody.innerHTML='';
    roundResults.forEach(r => {
        const row=document.createElement('tr');
        row.innerHTML=`<td>${r.round}</td><td>${r.validAttempts>0?r.avgRT+' ms':'N/A'}</td><td>${r.rtVariability>0?r.rtVariability+' ms':'N/A'}</td><td>${r.validAttempts}</td><td>${r.lapses}</td><td>${r.falseStarts}</td>`;
        tbody.appendChild(row);
    });
    tfoot.innerHTML=`<tr><td>Total</td><td>${overallAvgRT>0?overallAvgRT+' ms':'–'}</td><td>${overallRTV>0?overallRTV+' ms':'–'}</td><td>${totalValid}</td><td>${totalLapses}</td><td>${totalFS}</td></tr>`;

    let currentUser=JSON.parse(sessionStorage.getItem('currentUser'));
    if (currentUser) {
        currentUser.results.pvt={rounds:roundResults,overallAvgRT,overallMedianRT,overallRTV,totalValidAttempts:totalValid,totalLapses,totalFalseStarts:totalFS,temporalDriftIdx:tdi,allRTs};
        sessionStorage.setItem('currentUser',JSON.stringify(currentUser));
        let users=JSON.parse(localStorage.getItem('users'))||[];
        const idx=users.findIndex(u=>u.id===currentUser.id);
        if(idx!==-1){users[idx]=currentUser;localStorage.setItem('users',JSON.stringify(users));}
    }
    document.getElementById('goToAnotherTest').addEventListener('click', navigateNext);
}
