document.addEventListener('DOMContentLoaded', () => {
    const sessionUser = JSON.parse(sessionStorage.getItem('currentUser'));
    const users       = JSON.parse(localStorage.getItem('users')) || [];
    let currentUser   = null;
    if (sessionUser) currentUser = users.find(u => u.id === sessionUser.id) || users[users.length - 1];

    const alreadySaved  = sessionStorage.getItem('dataSaved');
    const saveBanner    = document.getElementById('save-status-banner');
    const saveText      = document.getElementById('save-text');
    const spinDot       = saveBanner.querySelector('.spin-dot');

    function setBannerState(state, text) {
        saveBanner.className = 'save-banner ' + state;
        saveText.textContent = text;
        if (state !== 'saving') spinDot.style.display = 'none';
    }

    // ── Data save ─────────────────────────────────────
    if (currentUser && !alreadySaved) {
        sessionStorage.setItem('dataSaved', 'true');
        fetch('http://127.0.0.1:5000/save_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: currentUser })
        })
        .then(r => { if (!r.ok) throw new Error('Server error'); return r.json(); })
        .then(d => {
            if (d.status === 'success') setBannerState('success', '✓ Data saved to research database');
            else throw new Error('Rejected');
        })
        .catch(() => {
            setBannerState('error', '⚠ Could not reach server — ensure server.py is running');
            sessionStorage.removeItem('dataSaved');
        });
    } else if (alreadySaved) {
        setBannerState('success', '✓ Data already saved');
    } else {
        setBannerState('error', 'No session data found');
    }

    // ── Build results section ─────────────────────────
    if (currentUser && currentUser.results) {
        document.getElementById('resultsSection').style.display = 'block';
        document.getElementById('tipsSection').style.display    = 'block';
        const r = currentUser.results;
        const cards = [];

        // Go / No-Go
        if (r.goNoGo) {
            cards.push({
                icon:'GNG', title:'Go / No-Go Task', status:'complete',
                metrics:[
                    { label:'Avg RT',          value: r.goNoGo.overallAvgRT || '–', unit:'ms' },
                    { label:'Commission Err',  value: r.goNoGo.totalCommission,    unit:'false alarms' },
                    { label:'Omission Err',    value: r.goNoGo.totalOmission,      unit:'misses' },
                    { label:'RT Variability',  value: r.goNoGo.overallRTV || '–',  unit:'ms SD' },
                ]
            });
        } else { cards.push({ icon:'GNG', title:'Go / No-Go Task', status:'skipped', metrics:[] }); }

        // PVT
        if (r.pvt) {
            cards.push({
                icon:'PVT', title:'Vigilance Task (PVT)', status:'complete',
                metrics:[
                    { label:'Avg RT',        value: r.pvt.overallAvgRT || '–', unit:'ms' },
                    { label:'Lapses',        value: r.pvt.totalLapses,         unit:'RT > 500ms' },
                    { label:'False Starts',  value: r.pvt.totalFalseStarts,    unit:'' },
                    { label:'RT Variability',value: r.pvt.overallRTV || '–',   unit:'ms SD' },
                ]
            });
        } else { cards.push({ icon:'PVT', title:'Vigilance Task (PVT)', status:'skipped', metrics:[] }); }

        // Trail Making
        if (r.trailMaking) {
            const tm = r.trailMaking;
            const baRatio = tm.round1 && tm.round2 && tm.round1.time > 0
                ? (tm.round2.time / tm.round1.time).toFixed(2) : '–';
            cards.push({
                icon:'TMT', title:'Trail Making Test', status:'complete',
                metrics:[
                    { label:'Part A Time',  value: tm.round1 ? tm.round1.time : '–', unit:'seconds' },
                    { label:'Part B Time',  value: tm.round2 ? tm.round2.time : '–', unit:'seconds' },
                    { label:'B/A Ratio',    value: baRatio,                            unit:'flex index' },
                    { label:'Total Errors', value: tm.totalWrong || 0,                unit:'wrong clicks' },
                ]
            });
        } else { cards.push({ icon:'TMT', title:'Trail Making Test', status:'skipped', metrics:[] }); }

        // Dual N-Back
        if (r.dualNBack && Array.isArray(r.dualNBack) && r.dualNBack.length > 0) {
            function nbackHR(block) {
                let hits=0,total=0;
                r.dualNBack.forEach(t=>{ if(t.block===block && t.isTarget){total++;if(t.responded)hits++;} });
                return total > 0 ? Math.round(hits/total*100) : 0;
            }
            cards.push({
                icon:'DNB', title:'Dual N-Back Task', status:'complete',
                metrics:[
                    { label:'1-Back Hit Rate', value: nbackHR('1-back')+'%', unit:'' },
                    { label:'2-Back Hit Rate', value: nbackHR('2-back')+'%', unit:'' },
                    { label:'3-Back Hit Rate', value: nbackHR('3-back')+'%', unit:'' },
                    { label:'0-Back Hit Rate', value: nbackHR('0-back')+'%', unit:'baseline' },
                ]
            });
        } else { cards.push({ icon:'DNB', title:'Dual N-Back Task', status:'skipped', metrics:[] }); }

        document.getElementById('testResultCards').innerHTML = cards.map(c => `
            <div class="test-card-block">
                <div class="test-card-header">
                    <span class="test-card-icon">${c.icon}</span>
                    <span class="test-card-title">${c.title}</span>
                    <span class="test-card-status ${c.status === 'complete' ? 'status-complete' : 'status-skipped'}">
                        ${c.status === 'complete' ? '✓ Complete' : 'Skipped'}
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

        // ── Tips generation ────────────────────────────
        const tips = [];
        const gng = r.goNoGo, pvt = r.pvt, tm = r.trailMaking, dnb = r.dualNBack;

        // Attention tips
        if (pvt && pvt.totalLapses > 3) {
            tips.push({ type:'attention', icon:'◷', title:'Sustained Attention Strategies',
                text:'Your PVT lapses suggest periods of reduced alertness. Try the Pomodoro technique — 25-minute focused work blocks followed by a 5-minute break — to maintain vigilance over long tasks.' });
        }
        if (pvt && pvt.overallRTV > 100) {
            tips.push({ type:'attention', icon:'◎', title:'Reduce Response Variability',
                text:'High reaction-time variability indicates inconsistent attentional engagement. Mindfulness practice (10 minutes daily) has been shown in clinical trials to reduce RTV in individuals with attention difficulties.' });
        }

        // Impulse control
        if (gng && gng.totalCommission > 8) {
            tips.push({ type:'impulse', icon:'◈', title:'Inhibitory Control Practice',
                text:'Elevated commission errors suggest impulse control challenges. Consider brief daily stop-signal practice or cognitive training apps designed to strengthen response inhibition.' });
        }

        // Flexibility / TMT
        if (tm && tm.round2 && tm.round1 && tm.round1.time > 0 && (tm.round2.time / tm.round1.time) > 3.5) {
            tips.push({ type:'general', icon:'↻', title:'Cognitive Flexibility',
                text:'A high B/A ratio on the Trail Making Test may indicate challenges when switching between task rules. Task-switching exercises and regular aerobic activity can help improve cognitive flexibility over time.' });
        }

        // Working memory
        if (dnb && Array.isArray(dnb)) {
            function nbackHR2(block) {
                let hits=0,total=0;
                dnb.forEach(t=>{ if(t.block===block && t.isTarget){total++;if(t.responded)hits++;} });
                return total > 0 ? Math.round(hits/total*100) : 0;
            }
            const hr2 = nbackHR2('2-back');
            if (hr2 < 60) {
                tips.push({ type:'memory', icon:'◧', title:'Working Memory Exercises',
                    text:'Your 2-Back performance suggests working memory has room to grow. Dual-tasking exercises, memory strategy training, and regular sleep (7–9 hours) have the strongest evidence base for improving working memory capacity.' });
            }
        }

        // Sleep / well-being tip from state assessment
        const state = currentUser.stateAssessment;
        if (state && state.sleepiness >= 3) {
            tips.push({ type:'general', icon:'◑', title:'Prioritise Sleep',
                text:'You reported high sleepiness before testing. Cognitive performance — especially attention and reaction time — is acutely sensitive to sleep loss. Aiming for a consistent 7–9 hours per night can meaningfully improve your scores.' });
        }

        // Always add a general positive tip
        tips.push({ type:'general', icon:'◆', title:'Consistency is Key',
            text:'Cognitive abilities are trainable. Regular practice, physical exercise, and quality sleep are the three most robustly evidence-supported ways to improve attention, impulse control, and working memory over time.' });

        document.getElementById('tipsList').innerHTML = tips.map(tip => `
            <div class="tip-card ${tip.type}">
                <div class="tip-icon">${tip.icon}</div>
                <div class="tip-body">
                    <div class="tip-title">${tip.title}</div>
                    <div class="tip-text">${tip.text}</div>
                </div>
            </div>`).join('');
    }

    // ── New participant ────────────────────────────────
    document.getElementById('addUserBtn').addEventListener('click', () => {
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('completedTests');
        sessionStorage.removeItem('dataSaved');
        window.location.href = 'index.html';
    });
});
