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

const maxRngBranchFactor = 27;
const lenToRng = [[], [[1],[2],[3]]];  // sizeOfRng => possibilities
for (let moveLen=2; moveLen<=WD*HT; ++moveLen) {
    const next = [];
    if (lenToRng[moveLen-1].length*3 <= maxRngBranchFactor) {
        for (const existing of lenToRng[moveLen-1]) {
            next.push([...existing, 1]);
            next.push([...existing, 2]);
            next.push([...existing, 3]);
        }
    } else {
        for (const existing of lenToRng[moveLen-1]) {
            next.push([...existing, Math.floor(Math.random() * 3) + 1]);  // lol non-determinism starts here.
        }
    }
    lenToRng.push(next);
}

const boardType = Uint16Array;  // We do things with buffers to allocate memory less often.
function getRngOutcomes(startingBoard, move) {
    const sizeOfRng = len(move)-1;
    const rng = lenToRng[sizeOfRng];
    const numOutputs = rng.length;
    const buf = new ArrayBuffer(numOutputs * LEN * boardType.BYTES_PER_ELEMENT);

    const lastPos = move[move.length-1]
    return rng.map((choices, i) => {
        const board = new boardType(buf, i * LEN * boardType.BYTES_PER_ELEMENT, LEN);
        for (let i=0; i<LEN; ++i) {
            board[i] = startingBoard[i];
        }
        for (let i=0; i<move.length-1; ++i) {
            board[move[i]] = rng[i];
        }
        board[lastPos] = move.length * board[lastPos];
        debugger
        return board
    });
}

// TODO: heuristic

// Returns all possible moves for the given board.
function generateMoves(board) {
    const out = [];
    for (let start=0; start<LEN; ++start) {
        const val = board[start];
        const q = [[start]];  // bfs queue. oops, it's actually a stack lol, so we're doing dfs.
        while (q.length) {
            const move = q.pop();  // note: in js pop() is from the highest index
            adjLoop:
            for (const adj of toAdj[move[move.length-1]]) {
                if (board[adj] != val) continue;  // exclude chains to other values.
                // exclude loops.
                for (let i=move.length-1; i>=0; --i) {  // potentially O(N^2) but these are usually short.
                    if (move[i] == adj) continue adjLoop;
                }
                const newMove = [...move, adj];
                out.push(newMove);
                q.push(newMove);
            }
        }
    }
    return out;
}

function findNextMove(board) {
    const moves = generateMoves(board);
    if (moves.length == 0) return null;
    return moves[Math.floor(Math.random()*moves.length)];
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
        const board = new boardType(JSON.parse(e.data));
        const move = findNextMove(board);
        if (!move || move.length < 2) return;
        const solveTime1 = new Date();
        const solveDurationMs = solveTime1-solveTime0;
        console.table([{board: [...board].join(','), move: JSON.stringify(move), ms:solveDurationMs}]);
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
