// This solver is under MIT License (c) DomNomNom 2020

const minSolveMs = 100;  // milliseconds between receiving input and sending move.


// In this file, unless otherwise stated, `move` and `board` are the arrays like they get serialized.
// e.g. state = [
//     3, 1, 1, 6, 1,
//     2, 2, 3, 2, 2,
//     1, 3, 2, 3, 3,
//     3, 2, 3, 3, 1,
//     1, 3, 2, 2, 2
// ]
const WD = 5;
const HT = 5;
const LEN = WD*HT;

// A map from each cell index to each adjacent cell index.
const toAdj = [];
for (let src=0; src<LEN; ++src) {
    const adj = [];
    if (src%WD > 0)      adj.push(src-1);  // left
    if (src%WD < WD-1)   adj.push(src+1);  // right
    if (src >= WD)       adj.push(src-WD); // up
    if (src < (HT-1)*WD) adj.push(src+WD); // down
    toAdj.push(adj);
}


function findNextMove(board) {
    // Exhaustive check.
    for (let i=0; i<LEN; ++i) {
        for (const j of toAdj[i]) {
            if (board[i] == board[j]) {
                return [i,j];
            }
        }
    }
    return [];
}


// ================= Interaction with index.js below ====================

function sendMove(move) {
    socket.send(JSON.stringify(move));  // Note: global socket object.
    updateUI(move);
}

function getGlobalCell(i) {
    return board[Math.floor(i/WD)][i%WD]; // Note: global board object.
}

function updateUI(move) {
    score += move.length * getGlobalCell(move[0]).value;
    for (let i of move) {
        setCell(getGlobalCell(i), "?", false);
    }
    scoreEl.innerText = score;
}

function solve_main() {
    socket.addEventListener('message', e => {  // Note: global socket object.
        const solveTime0 = new Date();
        const board = JSON.parse(e.data);
        const move = findNextMove(board);
        if (!move || move.length < 2) return;
        const solveTime1 = new Date();
        const solveDurationMs = solveTime1-solveTime0;
        console.table([{move: JSON.stringify(move), ms:solveDurationMs}]);
        const waitDurationMs = minSolveMs - solveDurationMs;
        setTimeout(sendMove, waitDurationMs, move);
    });
}

// Hook into the game
const wrappedNewGame = newGame;
newGame = () => {
    wrappedNewGame();
    solve_main();
}
solve_main();

gameOver = () => {
    // no alert()!
    console.log(`Game over. Your score: ${score}`);
};
