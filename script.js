// --- Firebase Config ---
const firebaseConfig = {
    apiKey: "AIzaSyDwGzTPmFg-gjoYtNWNJM47p22NfBugYFA",
    authDomain: "mock-test-1eea6.firebaseapp.com",
    databaseURL: "https://mock-test-1eea6-default-rtdb.firebaseio.com",
    projectId: "mock-test-1eea6",
    storageBucket: "mock-test-1eea6.firebaseapp.com",
    messagingSenderId: "111849173136",
    appId: "1:111849173136:web:8b211f58d854119e88a815",
    measurementId: "G-5RLWPTP8YD"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// --- Globals ---
let questions = [];
let currentIdx = 0;
let status, userAnswers;
let isSubmitted = false;
let timerInterval;
let timeLeft = 90 * 60; 
let isPaused = false;
let filteredIndices = [];
let quizSettings = { passMark: 30, posMark: 1, negMark: 0.33 };
let currentQuizId = null;

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// --- Load Quiz ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentQuizId = urlParams.get('id');
    if (currentQuizId) {
        document.getElementById('instContent').innerHTML = "<div style='text-align:center; padding:20px; color:#666;'>Loading Quiz Details... Please wait.</div>";
        loadQuizFromFirebase(currentQuizId);
    } else {
        alert("URL Error: No Quiz ID found.");
    }
});

function loadQuizFromFirebase(quizId) {
    database.ref('quizzes/' + quizId).once('value').then((snapshot) => {
        const data = snapshot.val();
        if (data && data.questions) {
            // 1. Load Settings
            if(data.title) document.getElementById('instTitle').innerText = data.title;
            if(data.duration) timeLeft = parseInt(data.duration) * 60;
            if(data.passMark) quizSettings.passMark = parseFloat(data.passMark);
            if(data.posMark) quizSettings.posMark = parseFloat(data.posMark);
            if(data.negMark) quizSettings.negMark = parseFloat(data.negMark);

            document.getElementById('dispPosMark').innerText = "+" + quizSettings.posMark;
            document.getElementById('dispNegMark').innerText = "-" + quizSettings.negMark;

            questions = data.questions;

            // 2. Randomization Logic
            if(data.randomizeQuestions) {
                shuffleArray(questions);
            }
            if(data.randomizeOptions) {
                questions.forEach(q => {
                    const correctText = q.options[q.correctIndex];
                    let combinedOpts = q.options.map((opt, i) => {
                        return { text: opt, img: (q.optImgs && q.optImgs[i]) ? q.optImgs[i] : null };
                    });
                    shuffleArray(combinedOpts);
                    q.options = combinedOpts.map(o => o.text);
                    q.optImgs = combinedOpts.map(o => o.img);
                    q.correctIndex = q.options.indexOf(correctText);
                });
            }

            status = new Array(questions.length).fill(0); 
            userAnswers = new Array(questions.length).fill(null); 
            
            // --- 3. Previous Score Logic (Optional) ---
            let prevScoreMsg = "";
            const savedScore = localStorage.getItem('last_score_' + quizId);
            if(savedScore) {
                prevScoreMsg = `<div style="background:#e8f5e9; color:#2e7d32; padding:10px; border-radius:5px; margin-bottom:15px; border:1px solid #c8e6c9;">
                    <strong>আপনার পূর্ববর্তী ফলাফল:</strong> ${savedScore}
                </div>`;
            }

            // --- 4. DETAILED INSTRUCTION PAGE (BENGALI) ---
            const instHTML = `
                ${prevScoreMsg}
                <div style="font-family: 'Roboto', sans-serif; font-size: 15px; line-height: 1.6; color:#333;">
                    <h3 style="margin-top:0; color:#0d47a1;">পরীক্ষার্থীর নাম:</h3>
                    <input type="text" id="stdName" placeholder="আপনার নাম লিখুন..." style="width:100%; padding:10px; margin-bottom:20px; border:1px solid #ccc; border-radius:4px;">
                    
                    <h3 style="margin-bottom:10px; color:#0d47a1;">সাধারণ নির্দেশাবলী (Instructions):</h3>
                    <p>১. <strong>মোট সময় (Duration):</strong> ${data.duration} মিনিট।</p>
                    <p>২. <strong>পাস মার্ক (Pass Mark):</strong> ${quizSettings.passMark}।</p>
                    <p>৩. <strong>মার্কিং:</strong> প্রতিটি সঠিক উত্তরের জন্য <b>+${quizSettings.posMark}</b> এবং ভুল উত্তরের জন্য <b>-${quizSettings.negMark}</b> নম্বর কাটা যাবে।</p>
                    <p>৪. ডানদিকের প্যালেট ব্যবহার করে যে কোনো প্রশ্নে যাওয়া যাবে।</p>
                    
                    <div style="background:#f9f9f9; padding:10px; border-radius:5px; margin-top:10px; font-size:13px;">
                        <strong>কালার কোড (Legend):</strong>
                        <ul class="legend-list" style="margin-top:5px;">
                            <li><span class="dot-icon not-visited"></span> দেখেনি (Not Visited)</li>
                            <li><span class="dot-icon not-answered"></span> উত্তর দেয়নি (Not Answered)</li>
                            <li><span class="dot-icon answered"></span> উত্তর দিয়েছে (Answered)</li>
                            <li><span class="dot-icon marked"></span> মার্ক করা (Marked for Review)</li>
                        </ul>
                    </div>
                </div>`;
            
            document.getElementById('instContent').innerHTML = instHTML;
            document.getElementById('startTestBtn').disabled = false;
        } else {
            document.getElementById('instContent').innerHTML = "Quiz not found or invalid.";
        }
    });
}

document.getElementById('startTestBtn').addEventListener('click', () => {
    const name = document.getElementById('stdName').value.trim();
    if(!name) { alert("দয়া করে আপনার নাম লিখুন।"); return; }
    localStorage.setItem('student_name', name); // Save name locally

    document.getElementById('instructionScreen').style.display = 'none';
    document.getElementById('quizMainArea').style.display = 'block';
    if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    loadQuestion(0);
    startTimer();
});

// Fullscreen Logic
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && !isSubmitted) document.getElementById('fullscreenOverlay').style.display = 'flex';
    else document.getElementById('fullscreenOverlay').style.display = 'none';
});
document.getElementById('returnFsBtn').addEventListener('click', () => {
    if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
});

// --- Render Question ---
function loadQuestion(index) {
    if(status[index] === 0) status[index] = 1; 
    currentIdx = index;
    document.getElementById('currentQNum').innerText = index + 1;
    const q = questions[index];
    
    let qHTML = "";
    if(q.passage) qHTML += `<div class="passage-box"><strong>Passage:</strong><br>${q.passage.replace(/\n/g, '<br>')}</div>`;
    if(q.qImg) qHTML += `<img src="${q.qImg}" class="q-img-display">`;
    qHTML += q.question;
    
    document.getElementById('questionTextBox').innerHTML = qHTML;

    const container = document.getElementById('optionsContainer');
    container.innerHTML = '';
    
    const nextBtn = document.getElementById('saveNextBtn');
    if (index === questions.length - 1) { nextBtn.innerText = "Final Submit"; nextBtn.style.backgroundColor = "#ff5722"; } 
    else { nextBtn.innerText = "Save & Next"; nextBtn.style.backgroundColor = "#00c696"; }

    q.options.forEach((opt, i) => {
        const row = document.createElement('div');
        row.className = 'option-row';
        if(userAnswers[index] === i) row.classList.add('selected');
        
        let optContent = `<div class="radio-circle"></div><div style="flex:1;">`;
        if(q.optImgs && q.optImgs[i]) optContent += `<img src="${q.optImgs[i]}" style="max-width:100px; display:block; margin-bottom:5px;">`;
        optContent += `<div class="opt-text">${opt}</div></div>`;
        
        row.innerHTML = optContent;
        row.onclick = () => { if(isPaused) return; document.querySelectorAll('.option-row').forEach(r => r.classList.remove('selected')); row.classList.add('selected'); };
        container.appendChild(row);
    });

    if(window.MathJax) MathJax.typesetPromise();
}

function getSelIdx() { const s = document.querySelector('.option-row.selected'); return s ? Array.from(s.parentNode.children).indexOf(s) : null; }
document.getElementById('markReviewBtn').addEventListener('click', () => { if(isPaused) return; const i = getSelIdx(); if(i!==null){ userAnswers[currentIdx]=i; status[currentIdx]=4; } else status[currentIdx]=3; nextQ(); });
document.getElementById('saveNextBtn').addEventListener('click', () => { 
    if(isPaused) return; 
    const i = getSelIdx(); 
    if(i!==null){ userAnswers[currentIdx]=i; status[currentIdx]=2; } else status[currentIdx]=1; 
    if (currentIdx === questions.length - 1) { if (confirm("আপনি কি নিশ্চিত যে আপনি পরীক্ষা শেষ করতে চান?")) submitTest(); } else { nextQ(); }
});
document.getElementById('clearResponseBtn').addEventListener('click', () => { if(isPaused) return; document.querySelectorAll('.option-row').forEach(r => r.classList.remove('selected')); userAnswers[currentIdx]=null; status[currentIdx]=1; });
function nextQ() { if(currentIdx < questions.length - 1) loadQuestion(currentIdx + 1); else openDrawer(); }

// Drawer & Timer
const drawer = document.getElementById('paletteSheet');
document.querySelector('.menu-icon').addEventListener('click', () => { renderPalette(); drawer.classList.add('open'); document.getElementById('sheetOverlay').style.display='block'; });
function closeDrawer() { drawer.classList.remove('open'); setTimeout(()=>document.getElementById('sheetOverlay').style.display='none', 300); }
document.getElementById('closeSheetBtn').addEventListener('click', closeDrawer);
document.getElementById('sheetOverlay').addEventListener('click', closeDrawer);
function renderPalette() {
    const grid = document.getElementById('paletteGrid'); grid.innerHTML = '';
    status.forEach((s, i) => {
        const btn = document.createElement('div'); btn.className = 'p-btn'; btn.innerText = i + 1;
        if(s===2) btn.classList.add('answered'); else if(s===1) btn.classList.add('not-answered');
        else if(s===3) btn.classList.add('marked'); else if(s===4) btn.classList.add('marked-ans');
        if(i===currentIdx) btn.classList.add('current');
        btn.onclick = () => { if(!isPaused) { loadQuestion(i); closeDrawer(); }};
        grid.appendChild(btn);
    });
}
function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if(timeLeft <= 0) { clearInterval(timerInterval); submitTest(); return; }
        timeLeft--;
        let m = parseInt(timeLeft / 60), s = parseInt(timeLeft % 60);
        document.getElementById('timerDisplay').innerText = `${m}:${s<10?'0'+s:s}`;
    }, 1000);
}
document.getElementById('pauseBtn').addEventListener('click', () => {
    const ca = document.querySelector('.content-area'); const b = document.getElementById('pauseBtn');
    if(!isPaused) { clearInterval(timerInterval); isPaused=true; b.innerText="Resume"; b.style.background="#ff9800"; b.style.color="white"; ca.style.opacity='0'; } 
    else { startTimer(); isPaused=false; b.innerText="Pause"; b.style.background="white"; b.style.color="#007bff"; ca.style.opacity='1'; }
});

// --- SUBMIT & RESULT ANALYSIS (Detailed) ---
function submitTest() {
    if(isSubmitted) return;
    isSubmitted = true;
    clearInterval(timerInterval);
    if(document.exitFullscreen) document.exitFullscreen();

    let s=0, c=0, w=0, sk=0;
    questions.forEach((q, i) => { 
        if(userAnswers[i]!==null) { 
            if(userAnswers[i]===q.correctIndex) { s += quizSettings.posMark; c++; } 
            else { s -= quizSettings.negMark; w++; } 
        } else sk++; 
    });
    
    const score = s.toFixed(2);
    
    // Save to Firebase
    const stdName = document.getElementById('stdName').value || 'Anonymous';
    if(currentQuizId) {
        database.ref('results/' + currentQuizId).push({
            name: stdName, score: score, correct: c, wrong: w, date: new Date().toLocaleString()
        });
    }
    // Save locally to show "Last Score" next time
    localStorage.setItem('last_score_' + currentQuizId, score);

    document.getElementById('resScore').innerText = score; 
    document.getElementById('resCorrect').innerText = c; 
    document.getElementById('resWrong').innerText = w; 
    document.getElementById('resSkip').innerText = sk;
    
    // --- Pass/Fail Logic with Analysis ---
    const passBox = document.getElementById('passFailBox');
    
    if(s >= quizSettings.passMark) {
        passBox.innerHTML = `🎉 অভিনন্দন! আপনি পাস করেছেন।`; 
        passBox.style.background = "#d4edda"; 
        passBox.style.color = "#155724"; 
        passBox.style.border = "1px solid #c3e6cb";
    } else {
        const needed = (quizSettings.passMark - s).toFixed(2);
        passBox.innerHTML = `😞 দুঃখিত! আপনি ফেল করেছেন।<br>
        <span style="font-size:14px; font-weight:normal; display:block; margin-top:5px;">
            পাস করার জন্য আরও <strong>${needed}</strong> নম্বর প্রয়োজন ছিল।
        </span>`; 
        passBox.style.background = "#f8d7da"; 
        passBox.style.color = "#721c24"; 
        passBox.style.border = "1px solid #f5c6cb";
    }

    document.getElementById('resultModal').style.display = 'flex';
    applyFilter('all');
}

// ... (Filter & Result Render functions remain same) ...
function applyFilter(t) {
    document.querySelectorAll('.f-btn').forEach(b => { b.classList.remove('active'); if(b.innerText.toLowerCase()===t) b.classList.add('active'); });
    filteredIndices = [];
    questions.forEach((q, i) => {
        const u = userAnswers[i];
        let st = 'skipped';
        if(u !== null) st = (u === q.correctIndex) ? 'correct' : 'wrong';
        if(t === 'all' || t === st) filteredIndices.push(i);
    });
    renderResultPalette();
    if(filteredIndices.length > 0) { document.getElementById('resContentArea').style.display = 'flex'; document.getElementById('resEmptyMsg').style.display = 'none'; loadResultQuestion(filteredIndices[0]); } 
    else { document.getElementById('resContentArea').style.display = 'none'; document.getElementById('resEmptyMsg').style.display = 'flex'; }
}

function renderResultPalette() {
    const c = document.getElementById('resPaletteContainer'); c.innerHTML = '';
    filteredIndices.forEach(idx => {
        const btn = document.createElement('div'); btn.className = 'rp-btn'; btn.innerText = idx + 1;
        const u = userAnswers[idx], q = questions[idx];
        if(u===null) btn.classList.add('skipped'); else if(u===q.correctIndex) btn.classList.add('correct'); else btn.classList.add('wrong');
        btn.onclick = () => loadResultQuestion(idx);
        c.appendChild(btn);
    });
}

function loadResultQuestion(realIdx) {
    const nIdx = filteredIndices.indexOf(realIdx);
    if(nIdx === -1) return;
    document.querySelectorAll('.rp-btn').forEach(b => b.classList.remove('active'));
    if(document.querySelectorAll('.rp-btn')[nIdx]) document.querySelectorAll('.rp-btn')[nIdx].classList.add('active');
    
    document.getElementById('resCurrentQNum').innerText = realIdx + 1;
    const u = userAnswers[realIdx], q = questions[realIdx], c = q.correctIndex;
    const b = document.getElementById('resQStatusBadge');
    if(u===null) { b.innerText="Skipped"; b.style.background="#ffc107"; b.style.color="#333"; }
    else if(u===c) { b.innerText="Correct"; b.style.background="#26a745"; b.style.color="white"; }
    else { b.innerText="Wrong"; b.style.background="#dc3545"; b.style.color="white"; }
    
    let qHTML = "";
    if(q.qImg) qHTML += `<img src="${q.qImg}" style="max-height:150px; display:block; margin:0 auto 10px;">`;
    qHTML += q.question;
    document.getElementById('resQuestionText').innerHTML = qHTML;

    const con = document.getElementById('resOptionsContainer'); con.innerHTML = '';
    q.options.forEach((o, i) => {
        let cls = 'res-opt-row';
        if(i===c) cls+=' correct-ans';
        if(u===i && u!==c) cls+=' user-wrong';
        con.innerHTML += `<div class="${cls}"><div class="res-circle"></div><div class="res-opt-text">${o}</div></div>`;
    });
    
    const explBox = document.getElementById('resExplanation');
    if(q.explanation) { explBox.style.display = "block"; document.getElementById('resExplText').innerHTML = q.explanation; } else explBox.style.display = "none";
    if(window.MathJax) MathJax.typesetPromise();
    
    document.getElementById('resPrevBtn').onclick = () => { if(nIdx > 0) loadResultQuestion(filteredIndices[nIdx - 1]); };
    document.getElementById('resNextBtn').onclick = () => { if(nIdx < filteredIndices.length - 1) loadResultQuestion(filteredIndices[nIdx + 1]); };
}

document.getElementById('submitTestBtn').addEventListener('click', submitTest);
window.addEventListener('beforeunload', (e) => { if(!isSubmitted) { e.preventDefault(); e.returnValue = ''; } });
