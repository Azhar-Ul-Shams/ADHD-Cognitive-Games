document.addEventListener('DOMContentLoaded', () => {
    const sessionUser = JSON.parse(sessionStorage.getItem('currentUser'));
    const users       = JSON.parse(localStorage.getItem('users')) || [];
    let currentUser   = null;
    if (sessionUser) currentUser = users.find(u => u.id === sessionUser.id) || users[users.length - 1];

    const alreadySaved = sessionStorage.getItem('dataSaved');
    const saveBanner   = document.getElementById('save-status-banner');
    const saveText     = document.getElementById('save-text');
    const spinDot      = saveBanner.querySelector('.spin-dot');

    function setBannerState(state, text) {
        saveBanner.className = 'save-banner ' + state;
        saveText.textContent = text;
        if (state !== 'saving') spinDot.style.display = 'none';
    }

    // ── Data save ─────────────────────────────────────────────────
    if (currentUser && !alreadySaved) {
        sessionStorage.setItem('dataSaved', 'true');

        // Relative URL — works both on Render and locally via `python server.py`
        fetch('/save_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: currentUser })
        })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(d => {
            if (d.status === 'success') {
                setBannerState('success', 'Data saved to research database');
            } else {
                throw new Error(d.message || 'Server rejected the data');
            }
        })
        .catch(err => {
            console.error('Save error:', err);
            setBannerState('error', 'Could not save — check that the server is running and MONGO_URI is set');
            sessionStorage.removeItem('dataSaved');
        });

    } else if (alreadySaved) {
        setBannerState('success', 'Data already saved');
    } else {
        setBannerState('error', 'No session data found');
    }

    // ── Build results section ─────────────────────────────────────
    if (currentUser && currentUser.results) {
        document.getElementById('resultsSection').style.display = 'block';
        document.getElementById('tipsSection').style.display    = 'block';
        const r = currentUser.results;
        const cards = [];

        // Go / No-Go
        if (r.goNoGo) {
            cards.push({
                icon: 'GNG', title: 'Go / No-Go Task', status: 'complete',
                metrics: [
                    { label: 'Avg RT',          value: r.goNoGo.overallAvgRT    || '–', unit: 'ms' },
                    { label: 'Median RT',        value: r.goNoGo.overallMedianRT || '–', unit: 'ms' },
                    { label: 'Commission Err',   value: r.goNoGo.totalCommission,        unit: 'false alarms' },
                    { label: 'RT Variability',   value: r.goNoGo.overallRTV      || '–', unit: 'ms SD' },
                ]
            });
        } else { cards.push({ icon: 'GNG', title: 'Go / No-Go Task', status: 'skipped', metrics: [] }); }

        // PVT
        if (r.pvt) {
            cards.push({
                icon: 'PVT', title: 'Vigilance Task (PVT)', status: 'complete',
                metrics: [
                    { label: 'Avg RT',         value: r.pvt.overallAvgRT    || '–', unit: 'ms' },
                    { label: 'Median RT',       value: r.pvt.overallMedianRT || '–', unit: 'ms' },
                    { label: 'Lapses',          value: r.pvt.totalLapses,             unit: 'RT > 500ms' },
                    { label: 'RT Variability',  value: r.pvt.overallRTV      || '–', unit: 'ms SD' },
                ]
            });
        } else { cards.push({ icon: 'PVT', title: 'Vigilance Task (PVT)', status: 'skipped', metrics: [] }); }

        // Trail Making
        if (r.trailMaking) {
            const tm = r.trailMaking;
            const baRatio = tm.round1 && tm.round2 && tm.round1.time > 0
                ? (tm.round2.time / tm.round1.time).toFixed(2) : '–';
            cards.push({
                icon: 'TMT', title: 'Trail Making Test', status: 'complete',
                metrics: [
                    { label: 'Part A Time',  value: tm.round1 ? tm.round1.time : '–', unit: 'seconds' },
                    { label: 'Part B Time',  value: tm.round2 ? tm.round2.time : '–', unit: 'seconds' },
                    { label: 'B/A Ratio',    value: baRatio,                            unit: 'flex index' },
                    { label: 'Total Errors', value: tm.totalWrong || 0,                 unit: 'wrong clicks' },
                ]
            });
        } else { cards.push({ icon: 'TMT', title: 'Trail Making Test', status: 'skipped', metrics: [] }); }

        // Dual N-Back
        if (r.dualNBack && Array.isArray(r.dualNBack) && r.dualNBack.length > 0) {
            function nbackHR(block) {
                let hits = 0, total = 0;
                r.dualNBack.forEach(t => { if (t.block === block && t.isTarget) { total++; if (t.responded) hits++; } });
                return total > 0 ? Math.round(hits / total * 100) : 0;
            }
            cards.push({
                icon: 'DNB', title: 'Dual N-Back Task', status: 'complete',
                metrics: [
                    { label: '1-Back Hit Rate', value: nbackHR('1-back') + '%', unit: '' },
                    { label: '2-Back Hit Rate', value: nbackHR('2-back') + '%', unit: '' },
                    { label: '3-Back Hit Rate', value: nbackHR('3-back') + '%', unit: '' },
                    { label: '0-Back Baseline', value: nbackHR('0-back') + '%', unit: '' },
                ]
            });
        } else { cards.push({ icon: 'DNB', title: 'Dual N-Back Task', status: 'skipped', metrics: [] }); }

        document.getElementById('testResultCards').innerHTML = cards.map(c => `
            <div class="test-card-block">
                <div class="test-card-header">
                    <span class="test-card-icon">${c.icon}</span>
                    <span class="test-card-title">${c.title}</span>
                    <span class="test-card-status ${c.status === 'complete' ? 'status-complete' : 'status-skipped'}">
                        ${c.status === 'complete' ? '&#10003; Complete' : 'Skipped'}
                    </span>
                </div>
                ${c.metrics.length > 0 ? `
                <div class="test-card-metrics">
                    ${c.metrics.map(m => `
                        <div class="tcm-item">
                            <div class="tcm-label">${m.label}</div>
                            <div class="tcm-value">${m.value}</div>
                            ${m.unit ? `<div class="tcm-unit">${m.unit}</div>` : ''}
                        </div>`).join('')}
                </div>` : ''}
            </div>
        `).join('');

        // ── Tips ─────────────────────────────────────────────────
        const tips = [];
        const gng = r.goNoGo, pvt = r.pvt, tm = r.trailMaking, dnb = r.dualNBack;

        if (pvt && pvt.totalLapses > 3)
            tips.push({ type: 'attention', icon: '◷', title: 'Sustained Attention',
                text: 'Your PVT lapses suggest periods of reduced alertness. The Pomodoro technique — 25-minute focused blocks with 5-minute breaks — is well-supported for maintaining vigilance.' });

        if (pvt && pvt.overallRTV > 100)
            tips.push({ type: 'attention', icon: '◎', title: 'Response Consistency',
                text: 'High reaction-time variability indicates inconsistent attentional engagement. Ten minutes of daily mindfulness practice has clinical support for reducing RTV.' });

        if (gng && gng.totalCommission > 8)
            tips.push({ type: 'impulse', icon: '◈', title: 'Inhibitory Control',
                text: 'Elevated commission errors suggest impulse control challenges. Stop-signal practice and cognitive training apps designed to strengthen response inhibition may help.' });

        if (tm && tm.round2 && tm.round1 && tm.round1.time > 0 && (tm.round2.time / tm.round1.time) > 3.5)
            tips.push({ type: 'general', icon: '↻', title: 'Cognitive Flexibility',
                text: 'A high B/A ratio on the Trail Making Test may reflect rule-switching difficulty. Task-switching exercises and regular aerobic activity can improve cognitive flexibility.' });

        if (dnb && Array.isArray(dnb)) {
            function nbackHR2(block) {
                let hits = 0, total = 0;
                dnb.forEach(t => { if (t.block === block && t.isTarget) { total++; if (t.responded) hits++; } });
                return total > 0 ? Math.round(hits / total * 100) : 0;
            }
            if (nbackHR2('2-back') < 60)
                tips.push({ type: 'memory', icon: '◧', title: 'Working Memory',
                    text: 'Your 2-Back performance suggests working memory capacity has room to grow. Structured dual-tasking practice and consistent sleep (7–9 hours) have the strongest evidence base.' });
        }

        const state = currentUser.stateAssessment;
        if (state && state.sleepiness >= 3)
            tips.push({ type: 'general', icon: '◑', title: 'Prioritise Sleep',
                text: 'You reported high sleepiness before testing. Attention and reaction time are acutely sensitive to sleep loss — consistent 7–9 hour nights can meaningfully improve cognitive performance.' });

        tips.push({ type: 'general', icon: '◆', title: 'Consistency is Key',
            text: 'Cognitive abilities are trainable. Regular practice, physical exercise, and quality sleep are the three most evidence-supported levers for improving attention, impulse control, and working memory.' });

        document.getElementById('tipsList').innerHTML = tips.map(tip => `
            <div class="tip-card ${tip.type}">
                <div class="tip-icon">${tip.icon}</div>
                <div class="tip-body">
                    <div class="tip-title">${tip.title}</div>
                    <div class="tip-text">${tip.text}</div>
                </div>
            </div>`).join('');
    }

    // ── New participant ───────────────────────────────────────────
    document.getElementById('addUserBtn').addEventListener('click', () => {
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('completedTests');
        sessionStorage.removeItem('dataSaved');
        window.location.href = 'index.html';
    });
});