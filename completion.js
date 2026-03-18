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
                    { label: 'Avg RT',        value: r.goNoGo.overallAvgRT    || '–', unit: 'ms' },
                    { label: 'Median RT',      value: r.goNoGo.overallMedianRT || '–', unit: 'ms' },
                    { label: 'Commission Err', value: r.goNoGo.totalCommission,        unit: 'false alarms' },
                    { label: 'RT Variability', value: r.goNoGo.overallRTV      || '–', unit: 'ms SD' },
                ]
            });
        } else { cards.push({ icon: 'GNG', title: 'Go / No-Go Task', status: 'skipped', metrics: [] }); }

        // PVT
        if (r.pvt) {
            cards.push({
                icon: 'PVT', title: 'Vigilance Task (PVT)', status: 'complete',
                metrics: [
                    { label: 'Avg RT',        value: r.pvt.overallAvgRT    || '–', unit: 'ms' },
                    { label: 'Median RT',      value: r.pvt.overallMedianRT || '–', unit: 'ms' },
                    { label: 'Lapses',         value: r.pvt.totalLapses,             unit: 'RT > 500ms' },
                    { label: 'RT Variability', value: r.pvt.overallRTV      || '–', unit: 'ms SD' },
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
                r.dualNBack.forEach(t => {
                    if (t.block === block && t.isTarget) { total++; if (t.responded) hits++; }
                });
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

        // ── Reaction time / Attention ─────────────────────────────
        if (pvt) {
            const rt = pvt.overallAvgRT || pvt.overallMedianRT;
            if (rt && rt < 280) {
                tips.push({ type: 'attention', icon: '◎', title: 'Excellent Alertness',
                    text: `Your average reaction time of ${rt} ms is well within the high-performance range. To maintain this, prioritise consistent sleep and avoid testing after prolonged fatigue.` });
            } else if (rt && rt < 380) {
                tips.push({ type: 'attention', icon: '◎', title: 'Good Sustained Attention',
                    text: `Your reaction time of ${rt} ms reflects solid vigilance. The Pomodoro technique — 25-minute focused blocks with short breaks — can help sustain this level across longer sessions.` });
            } else if (rt) {
                tips.push({ type: 'attention', icon: '◷', title: 'Improving Sustained Attention',
                    text: `Your reaction time of ${rt} ms suggests attention may fluctuate under fatigue. Brief mindfulness practice (10 min/day) has clinical support for reducing response latency and variability.` });
            }

            if (pvt.totalLapses !== undefined) {
                if (pvt.totalLapses === 0) {
                    tips.push({ type: 'attention', icon: '◆', title: 'Zero Lapses — Strong Vigilance',
                        text: 'You had no PVT lapses, indicating excellent sustained alertness throughout the task. This is a strong marker of well-regulated attention.' });
                } else if (pvt.totalLapses <= 2) {
                    tips.push({ type: 'attention', icon: '◷', title: 'Minimal Lapses',
                        text: `${pvt.totalLapses} lapse(s) detected — well within a normal range. Light aerobic exercise before cognitive tasks is consistently shown to reduce attentional lapses.` });
                } else {
                    tips.push({ type: 'attention', icon: '◷', title: 'Reducing Attentional Lapses',
                        text: `${pvt.totalLapses} lapses were detected, which can indicate fatigue or reduced vigilance. Structured rest schedules and avoiding sustained cognitive work beyond 90 minutes without a break are evidence-based strategies.` });
                }
            }
        } else {
            tips.push({ type: 'attention', icon: '◷', title: 'Sustained Attention',
                text: 'The PVT test was not completed. Sustained attention is one of the strongest predictors of cognitive performance — consider completing it in a future session.' });
        }

        // ── Impulse control ───────────────────────────────────────
        if (gng) {
            const ce = gng.totalCommission || 0;
            if (ce <= 3) {
                tips.push({ type: 'impulse', icon: '◈', title: 'Strong Impulse Control',
                    text: `Only ${ce} commission error(s) — your inhibitory control is well developed. Maintaining regular sleep and low-stress routines helps preserve this ability over time.` });
            } else if (ce <= 8) {
                tips.push({ type: 'impulse', icon: '◈', title: 'Moderate Inhibitory Control',
                    text: `${ce} commission errors suggest occasional impulsive responses. Stop-signal training and mindful pause techniques — briefly pausing before acting in daily tasks — can strengthen inhibitory control.` });
            } else {
                tips.push({ type: 'impulse', icon: '◈', title: 'Building Inhibitory Control',
                    text: `${ce} commission errors indicate challenges with response inhibition. Daily stop-signal practice and cognitive training apps targeting executive function have the strongest evidence base for improvement.` });
            }
        }

        // ── Cognitive flexibility (TMT) ───────────────────────────
        if (tm && tm.round1 && tm.round2) {
            const ratio = tm.round1.time > 0 ? (tm.round2.time / tm.round1.time) : null;
            if (ratio !== null) {
                if (ratio < 2) {
                    tips.push({ type: 'general', icon: '↻', title: 'Excellent Cognitive Flexibility',
                        text: `Your B/A ratio of ${ratio.toFixed(2)} indicates highly efficient task-switching. This reflects strong executive function and mental agility.` });
                } else if (ratio < 3.5) {
                    tips.push({ type: 'general', icon: '↻', title: 'Good Cognitive Flexibility',
                        text: `Your B/A ratio of ${ratio.toFixed(2)} is within a healthy range. Activities that require switching between rules — like strategic board games — help maintain this flexibility.` });
                } else {
                    tips.push({ type: 'general', icon: '↻', title: 'Developing Cognitive Flexibility',
                        text: `Your B/A ratio of ${ratio.toFixed(2)} suggests switching between task rules takes extra effort. Regular aerobic exercise and task-switching practice have strong evidence for improving cognitive flexibility.` });
                }
            }
        }

        // ── Working memory (DNB) ──────────────────────────────────
        if (dnb && Array.isArray(dnb) && dnb.length > 0) {
            function nbackHR2(block) {
                let hits = 0, total = 0;
                dnb.forEach(t => {
                    if (t.block === block && t.isTarget) { total++; if (t.responded) hits++; }
                });
                return total > 0 ? Math.round(hits / total * 100) : 0;
            }
            const hr2 = nbackHR2('2-back');
            if (hr2 >= 75) {
                tips.push({ type: 'memory', icon: '◧', title: 'Strong Working Memory',
                    text: `Your 2-Back hit rate of ${hr2}% reflects well-developed working memory capacity — a key predictor of academic and professional performance.` });
            } else if (hr2 >= 50) {
                tips.push({ type: 'memory', icon: '◧', title: 'Developing Working Memory',
                    text: `Your 2-Back hit rate of ${hr2}% is in a moderate range. Consistent dual N-back practice, even 15 minutes daily, has clinical support for expanding working memory capacity.` });
            } else {
                tips.push({ type: 'memory', icon: '◧', title: 'Working Memory Training',
                    text: `Your 2-Back hit rate of ${hr2}% suggests working memory is an area to develop. Structured memory training and 7–9 hours of sleep per night are the two most robustly evidence-supported strategies.` });
            }
        }

        // ── Sleep / state ─────────────────────────────────────────
        const state = currentUser.stateAssessment;
        if (state) {
            if (state.sleepiness >= 3) {
                tips.push({ type: 'general', icon: '◑', title: 'Prioritise Sleep',
                    text: 'You reported high sleepiness before testing. Cognitive performance — especially reaction time and working memory — is acutely sensitive to sleep loss. Results taken under fatigue may underrepresent your true capacity.' });
            } else if (state.sleepiness <= 1 && state.feeling >= 4) {
                tips.push({ type: 'general', icon: '◆', title: 'Optimal Testing Conditions',
                    text: 'You reported feeling alert and well — ideal conditions for cognitive assessment. Results collected in this state are likely a reliable reflection of your baseline performance.' });
            }
        }

        // ── Always-present closing tip ────────────────────────────
        tips.push({ type: 'general', icon: '◆', title: 'Consistency is Key',
            text: 'Cognitive abilities respond to training. Regular practice, physical exercise, and quality sleep are the three most evidence-supported ways to improve attention, impulse control, and working memory over time.' });

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