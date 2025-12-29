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

let questions = [], currentIdx = 0, status, userAnswers;
let isSubmitted = false, currentLang = 'bn', timerInterval, timeLeft = 0;
let isPaused = false, filteredIndices = [], currentQuizId = null;
let quizSettings = { passMark: 30, posMark: 1, negMark: 0.33 };

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentQuizId = urlParams.get('id');
    if (currentQuizId) {
        document.getElementById('instContent').innerHTML = "<div style='text-align:center; padding:20px;'>Loading...</div>";
        loadQuizFromFirebase(currentQuizId);
    } else { alert("Quiz ID Missing"); }
});

function loadQuizFromFirebase(id) {
    database.ref('quizzes/' + id).once('value').then(s => {
        const d = s.val();
        if (d && d.questions) {
            if(d.title) document.getElementById('instTitle').innerText = d.title;
            if(d.duration) timeLeft = parseInt(d.duration) * 60;
            if(d.passMark) quizSettings.passMark = parseFloat(d.passMark);
            if(d.posMark) quizSettings.posMark = parseFloat(d.posMark);
            if(d.negMark) quizSettings.negMark = parseFloat(d.negMark);

            document.getElementById('dispPosMark').innerText = "+" + quizSettings.posMark;
            document.getElementById('dispNegMark').innerText = "-" + quizSettings.negMark;

            questions = d.questions;
            if(d.randomizeQuestions) shuffleArray(questions);
            if(d.randomizeOptions) {
                questions.forEach(q => {
                    const cText = q.options[q.correctIndex];
                    let opts = q.options.map((o,i)=>({txt:o, img:(q.optImgs?q.optImgs[i]:null)}));
                    shuffleArray(opts);
                    q.options = opts.map(o=>o.txt);
                    q.optImgs = opts.map(o=>o.img);
                    q.correctIndex = q.options.indexOf(cText);
                });
            }

            status = new Array(questions.length).fill(0);
            userAnswers = new Array(questions.length).fill(null);

            const instHTML = `
                <h3 style="margin-top:0;">Instructions:</h3>
                <p>1. Duration: ${d.duration} Mins</p>
                <p>2. Marks: +${quizSettings.posMark} / -${quizSettings.negMark}</p>
                <p>3. Pass Mark: ${quizSettings.passMark}</p>`;
            document.getElementById('instContent').innerHTML = instHTML;
            document.getElementById('startTestBtn').disabled = false;
        } else { alert("Invalid Quiz"); }
    });
}

document.getElementById('startTestBtn').addEventListener('click', () => {
    document.getElementById('instructionScreen').style.display = 'none';
    document.getElementById('quizMainArea').style.display = 'block';
    if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    loadQuestion(0);
    startTimer();
});

function loadQuestion(idx) {
    if(status[idx]===0) status[idx]=1;
    currentIdx = idx;
    document.getElementById('currentQNum').innerText = idx + 1;
    const q = questions[idx];
    
    let html = '';
    if(q.passage) html += `<div class="passage-box"><strong>Passage:</strong><br>${q.passage}</div>`;
    if(q.qImg) html += `<img src="${q.qImg}" class="q-img-display">`;
    html += currentLang === 'bn' ? (q.question_bn || q.question) : (q.question_en || q.question);
    document.getElementById('questionTextBox').innerHTML = html;

    const con = document.getElementById('optionsContainer'); con.innerHTML = '';
    const nextBtn = document.getElementById('saveNextBtn');
    if(idx === questions.length-1) { nextBtn.innerText="Submit Test"; nextBtn.style.background="#ff5722"; }
    else { nextBtn.innerText="Save & Next"; nextBtn.style.background="#00c696"; }

    const opts = currentLang === 'bn' ? (q.options_bn || q.options) : (q.options_en || q.options);
    opts.forEach((o, i) => {
        const div = document.createElement('div');
        div.className = 'option-row' + (userAnswers[idx]===i ? ' selected' : '');
        div.innerHTML = `<div class="radio-circle"></div><div class="opt-text">${o}</div>`;
        div.onclick = () => { if(!isPaused) { userAnswers[idx]=i; loadQuestion(idx); } }; // Auto select refresh
        con.appendChild(div);
    });
    if(window.MathJax) MathJax.typesetPromise();
}

document.getElementById('saveNextBtn').addEventListener('click', () => {
    if(isPaused) return;
    if(userAnswers[currentIdx] !== null) status[currentIdx] = 2;
    if(currentIdx < questions.length - 1) loadQuestion(currentIdx + 1);
    else if(confirm("Submit?")) submitTest();
});

document.getElementById('markReviewBtn').addEventListener('click', () => {
    if(isPaused) return;
    status[currentIdx] = userAnswers[currentIdx] !== null ? 4 : 3;
    if(currentIdx < questions.length - 1) loadQuestion(currentIdx + 1);
});

document.getElementById('clearResponseBtn').addEventListener('click', () => {
    if(isPaused) return;
    userAnswers[currentIdx] = null; status[currentIdx] = 1;
    loadQuestion(currentIdx);
});

// Drawer
const drawer = document.getElementById('paletteSheet');
document.querySelector('.menu-icon').addEventListener('click', () => {
    renderPalette(); drawer.classList.add('open'); document.getElementById('sheetOverlay').style.display='block';
});
function closeDrawer() { drawer.classList.remove('open'); document.getElementById('sheetOverlay').style.display='none'; }
document.getElementById('closeSheetBtn').addEventListener('click', closeDrawer);
document.getElementById('sheetOverlay').addEventListener('click', closeDrawer);

function renderPalette() {
    const g = document.getElementById('paletteGrid'); g.innerHTML = '';
    status.forEach((s, i) => {
        const b = document.createElement('div');
        b.className = 'p-btn ' + (s===2?'answered':s===3?'marked':s===4?'marked-ans':s===1?'not-answered':'');
        if(i===currentIdx) b.classList.add('current');
        b.innerText = i + 1;
        b.onclick = () => { loadQuestion(i); closeDrawer(); };
        g.appendChild(b);
    });
}

function startTimer() {
    timerInterval = setInterval(() => {
        if(timeLeft <= 0) { clearInterval(timerInterval); submitTest(); return; }
        timeLeft--;
        let m = Math.floor(timeLeft/60), s = timeLeft%60;
        document.getElementById('timerDisplay').innerText = `${m}:${s<10?'0'+s:s}`;
    }, 1000);
}

// Submit & Result
function submitTest() {
    if(isSubmitted) return;
    isSubmitted = true; clearInterval(timerInterval);
    if(document.exitFullscreen) document.exitFullscreen();

    let s=0, c=0, w=0, sk=0;
    questions.forEach((q, i) => {
        if(userAnswers[i]!==null) {
            if(userAnswers[i] === q.correctIndex) { s += quizSettings.posMark; c++; }
            else { s -= quizSettings.negMark; w++; }
        } else sk++;
    });

    document.getElementById('resScore').innerText = s.toFixed(2);
    document.getElementById('resCorrect').innerText = c;
    document.getElementById('resWrong').innerText = w;
    document.getElementById('resSkip').innerText = sk;
    
    const msg = document.getElementById('passFailBox');
    if(s >= quizSettings.passMark) { msg.innerHTML="Passed! 🎉"; msg.style.background="#d4edda"; msg.style.color="green"; }
    else { msg.innerHTML="Failed 😞"; msg.style.background="#f8d7da"; msg.style.color="red"; }

    document.getElementById('quizMainArea').style.display = 'none';
    document.getElementById('resultScreen').style.display = 'flex';
    applyFilter('all');
}

function applyFilter(f) {
    document.querySelectorAll('.f-btn').forEach(b => b.classList.remove('active'));
    // Simple logic for active button visual needed here if strict
    filteredIndices = [];
    questions.forEach((q, i) => {
        const u = userAnswers[i];
        let type = 'skipped';
        if(u !== null) type = (u === q.correctIndex) ? 'correct' : 'wrong';
        if(f === 'all' || f === type) filteredIndices.push(i);
    });
    
    const pal = document.getElementById('resPaletteContainer'); pal.innerHTML = '';
    filteredIndices.forEach(idx => {
        const b = document.createElement('div');
        b.className = 'rp-btn'; b.innerText = idx + 1;
        const u = userAnswers[idx], q = questions[idx];
        if(u===null) b.classList.add('skipped');
        else if(u===q.correctIndex) b.classList.add('correct');
        else b.classList.add('wrong');
        b.onclick = () => loadResQ(idx);
        pal.appendChild(b);
    });

    if(filteredIndices.length) loadResQ(filteredIndices[0]);
    else document.getElementById('resContentArea').style.display = 'none';
}

function loadResQ(idx) {
    document.getElementById('resContentArea').style.display = 'flex';
    const q = questions[idx];
    const u = userAnswers[idx];
    document.getElementById('resCurrentQNum').innerText = idx + 1;
    
    // Status Badge
    const badge = document.getElementById('resQStatusBadge');
    if(u===null) { badge.innerText="Skipped"; badge.style.background="#ffc107"; badge.style.color="black"; }
    else if(u===q.correctIndex) { badge.innerText="Correct"; badge.style.background="#28a745"; badge.style.color="white"; }
    else { badge.innerText="Wrong"; badge.style.background="#dc3545"; badge.style.color="white"; }

    let html = '';
    if(q.qImg) html += `<img src="${q.qImg}" class="q-img-display">`;
    html += currentLang === 'bn' ? (q.question_bn || q.question) : (q.question_en || q.question);
    document.getElementById('resQuestionText').innerHTML = html;

    const con = document.getElementById('resOptionsContainer'); con.innerHTML = '';
    const opts = currentLang === 'bn' ? (q.options_bn || q.options) : (q.options_en || q.options);
    
    opts.forEach((o, i) => {
        let cls = 'res-opt-row';
        if(i === q.correctIndex) cls += ' correct-ans';
        if(u === i && u !== q.correctIndex) cls += ' user-wrong';
        con.innerHTML += `<div class="${cls}"><div class="res-circle"></div><div class="opt-text">${o}</div></div>`;
    });

    const exp = document.getElementById('resExplanation');
    if(q.explanation) { exp.style.display = 'block'; document.getElementById('resExplText').innerHTML = q.explanation; }
    else exp.style.display = 'none';

    if(window.MathJax) MathJax.typesetPromise();
    
    // Swipe Logic Setup
    const currentFilterIdx = filteredIndices.indexOf(idx);
    document.getElementById('resPrevBtn').onclick = () => { if(currentFilterIdx > 0) loadResQ(filteredIndices[currentFilterIdx-1]); };
    document.getElementById('resNextBtn').onclick = () => { if(currentFilterIdx < filteredIndices.length-1) loadResQ(filteredIndices[currentFilterIdx+1]); };
}

// Swipe
const resArea = document.getElementById('resContentArea');
let tStart = 0, tEnd = 0;
resArea.addEventListener('touchstart', e => tStart = e.changedTouches[0].screenX);
resArea.addEventListener('touchend', e => {
    tEnd = e.changedTouches[0].screenX;
    if (tEnd < tStart - 50) document.getElementById('resNextBtn').click();
    if (tEnd > tStart + 50) document.getElementById('resPrevBtn').click();
});
