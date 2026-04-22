// ── Difficulty settings ────────────────────────────────────────────────────
const LEVELS = {
    easy:   { rows: 9,  cols: 9,  mines: 10 },
    medium: { rows: 16, cols: 16, mines: 40 },
    hard:   { rows: 16, cols: 30, mines: 99 },
};

// ── Game state ─────────────────────────────────────────────────────────────
let rows, cols, minesCount;
let grid       = [];   // grid[r][c] = { mine, revealed, flagged, count }
let gameOver   = false;
let firstClick = true;
let timerInterval = null;
let seconds    = 0;
let flagsPlaced = 0;

// ── DOM references ─────────────────────────────────────────────────────────
const boardEl      = document.getElementById('board');
const minesLeftEl  = document.getElementById('mines-left');
const timerEl      = document.getElementById('timer');
const resetBtn     = document.getElementById('reset-btn');
const messageEl    = document.getElementById('message');
const msgTitle     = document.getElementById('msg-title');
const msgBody      = document.getElementById('msg-body');
const msgResetBtn  = document.getElementById('msg-reset-btn');
const customFields = document.getElementById('custom-fields');
const startBtn     = document.getElementById('start-btn');
const diffBtns     = document.querySelectorAll('.diff-btn');

let selectedLevel = 'easy';

// ── Difficulty selection ───────────────────────────────────────────────────
diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        diffBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedLevel = btn.dataset.level;

        if (selectedLevel === 'custom') {
            customFields.classList.add('visible');
        } else {
            customFields.classList.remove('visible');
            const cfg = LEVELS[selectedLevel];
            initGame(cfg.rows, cfg.cols, cfg.mines);
        }
    });
});

startBtn.addEventListener('click', () => {
    const r = parseInt(document.getElementById('custom-rows').value)  || 10;
    const c = parseInt(document.getElementById('custom-cols').value)  || 10;
    const m = parseInt(document.getElementById('custom-mines').value) || 15;
    const maxMines = r * c - 1;
    initGame(r, Math.min(c, 50), Math.min(m, maxMines));
});

resetBtn.addEventListener('click', resetGame);
msgResetBtn.addEventListener('click', () => {
    messageEl.classList.remove('visible');
    resetGame();
});

// ── Start / Reset ──────────────────────────────────────────────────────────
function initGame(r, c, m) {
    rows       = r;
    cols       = c;
    minesCount = m;
    resetGame();
}

function resetGame() {
    stopTimer();
    seconds      = 0;
    flagsPlaced  = 0;
    gameOver     = false;
    firstClick   = true;
    timerEl.textContent      = '0';
    minesLeftEl.textContent  = minesCount;
    messageEl.classList.remove('visible');
    buildGrid();
    renderBoard();
}

// ── Logical grid ───────────────────────────────────────────────────────────
function buildGrid() {
    grid = [];
    for (let r = 0; r < rows; r++) {
        grid[r] = [];
        for (let c = 0; c < cols; c++) {
            grid[r][c] = { mine: false, revealed: false, flagged: false, count: 0 };
        }
    }
}

function placeMines(excludeR, excludeC) {
    let placed = 0;
    while (placed < minesCount) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);
        // Do not place a mine on the first-click cell or its neighbors
        if (Math.abs(r - excludeR) <= 1 && Math.abs(c - excludeC) <= 1) continue;
        if (grid[r][c].mine) continue;
        grid[r][c].mine = true;
        placed++;
    }
    calcCounts();
}

function calcCounts() {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c].mine) { grid[r][c].count = -1; continue; }
            grid[r][c].count = neighbors(r, c).filter(([nr, nc]) => grid[nr][nc].mine).length;
        }
    }
}

function neighbors(r, c) {
    const result = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) result.push([nr, nc]);
        }
    }
    return result;
}

// ── Rendering ──────────────────────────────────────────────────────────────
function renderBoard() {
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = `repeat(${cols}, 32px)`;
    boardEl.style.gridTemplateRows    = `repeat(${rows}, 32px)`;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.r = r;
            cell.dataset.c = c;
            cell.addEventListener('click', onLeftClick);
            cell.addEventListener('contextmenu', onRightClick);
            boardEl.appendChild(cell);
        }
    }
}

function updateCell(r, c) {
    const cell = getCellEl(r, c);
    const data = grid[r][c];
    cell.className = 'cell';
    cell.textContent = '';

    if (data.flagged && !data.revealed) {
        cell.classList.add('flagged');
        cell.textContent = 'F';
        return;
    }
    if (!data.revealed) return;

    cell.classList.add('revealed');
    if (data.mine) {
        cell.classList.add('mine-shown');
        cell.textContent = 'M';
    } else if (data.count > 0) {
        cell.textContent = data.count;
        cell.classList.add(`n${data.count}`);
    }
}

function getCellEl(r, c) {
    return boardEl.children[r * cols + c];
}

// ── Click events ───────────────────────────────────────────────────────────
function onLeftClick(e) {
    if (gameOver) return;
    const r = +this.dataset.r, c = +this.dataset.c;
    const data = grid[r][c];
    if (data.revealed || data.flagged) return;

    if (firstClick) {
        firstClick = false;
        placeMines(r, c);
        startTimer();
    }

    if (data.mine) {
        data.revealed = true;
        getCellEl(r, c).classList.add('mine-exploded');
        getCellEl(r, c).textContent = 'M';
        endGame(false);
        return;
    }

    reveal(r, c);
    checkWin();
}

function onRightClick(e) {
    e.preventDefault();
    if (gameOver) return;
    const r = +this.dataset.r, c = +this.dataset.c;
    const data = grid[r][c];
    if (data.revealed) return;

    data.flagged = !data.flagged;
    flagsPlaced += data.flagged ? 1 : -1;
    minesLeftEl.textContent = minesCount - flagsPlaced;
    updateCell(r, c);
}

// ── Reveal (flood fill for empty cells) ───────────────────────────────────
/**
 * Reveals a cell and propagates the reveal to empty neighboring cells.
 *
 * Uses an iterative stack-based traversal to avoid deep recursion.
 * It only reveals cells that are not revealed, not flagged, and not mines.
 * If the current cell has `count === 0`, it pushes neighbors onto the stack
 * to continue the flood-fill.
 *
 * @param {number} r Starting row.
 * @param {number} c Starting column.
 */
function reveal(r, c) {
    const stack = [[r, c]];
    while (stack.length) {
        const [cr, cc] = stack.pop();
        const data = grid[cr][cc];
        if (data.revealed || data.flagged || data.mine) continue;
        data.revealed = true;
        updateCell(cr, cc);
        if (data.count === 0) {
            neighbors(cr, cc).forEach(([nr, nc]) => {
                if (!grid[nr][nc].revealed) stack.push([nr, nc]);
            });
        }
    }
}

// ── End game ───────────────────────────────────────────────────────────────
function endGame(won) {
    gameOver = true;
    stopTimer();

    if (!won) {
        // Reveal all mines
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (grid[r][c].mine && !grid[r][c].flagged) {
                    grid[r][c].revealed = true;
                    updateCell(r, c);
                }
            }
        }
    }

    setTimeout(() => {
        msgTitle.textContent = won ? 'Ganaste' : 'Perdiste';
        msgBody.textContent  = won
            ? `Completaste el tablero en ${seconds}s.`
            : 'Pisaste una mina. ¡Inténtalo de nuevo!';
        messageEl.classList.add('visible');
    }, 400);

    if (won) saveScore(seconds);
}

function checkWin() {
    let unrevealed = 0;
    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
            if (!grid[r][c].revealed && !grid[r][c].mine) unrevealed++;
    if (unrevealed === 0) endGame(true);
}

// ── Timer ──────────────────────────────────────────────────────────────────
function startTimer() {
    timerInterval = setInterval(() => {
        seconds++;
        timerEl.textContent = seconds;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

// ── Leaderboard ────────────────────────────────────────────────────────────
const SCORES_KEY = 'buscaminas_scores';

const LEVEL_LABELS = { easy: 'Fácil', medium: 'Medio', hard: 'Difícil' };

function loadScores() {
    try { return JSON.parse(localStorage.getItem(SCORES_KEY)) || []; }
    catch { return []; }
}

function saveScore(time) {
    const label = selectedLevel === 'custom'
        ? `${rows}x${cols} (${minesCount} minas)`
        : LEVEL_LABELS[selectedLevel];
    const date = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

    const scores = loadScores();
    scores.push({ time, label, date });
    scores.sort((a, b) => a.time - b.time);
    localStorage.setItem(SCORES_KEY, JSON.stringify(scores.slice(0, 10)));
    renderLeaderboard();
}

function renderLeaderboard() {
    const scores = loadScores();
    const tbody = document.getElementById('scores-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (scores.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="4" style="text-align:center;color:#a8b2d8;padding:14px 0">Sin puntuaciones aún</td>';
        tbody.appendChild(tr);
        return;
    }

    scores.forEach((s, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i + 1}</td><td>${s.label}</td><td>${s.time}s</td><td>${s.date}</td>`;
        tbody.appendChild(tr);
    });
}

document.getElementById('clear-scores-btn').addEventListener('click', () => {
    localStorage.removeItem(SCORES_KEY);
    renderLeaderboard();
});

// ── Initial startup ────────────────────────────────────────────────────────
initGame(LEVELS.easy.rows, LEVELS.easy.cols, LEVELS.easy.mines);
renderLeaderboard();
