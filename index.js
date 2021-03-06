let bodyLoaded = false;
let loadedData;
let score;
let scoreEl;
const bodyLoadedPromise = new Promise(done => {
	window.onload = function() {
		this.createBoard();
		document.getElementsByTagName("name-container")[0].onclick = usernamePrompt;
		document.getElementsByTagName("name")[0].innerText = localStorage.username;
		scoreEl = document.getElementsByTagName("score")[0];
		document.getElementsByTagName("reset-container")[0].onclick = resetGame;
		
		bodyLoaded = true;
		if (loadedData)
			setGameState(loadedData);
	}
});

let socket;
let submitQueue = [];

newGame();
function newGame() {

	if (socket) {
		socket.done = true;
		socket.close();
	}
	score = 0;
	loadedData = undefined;

	socket = new WebSocket("wss://server.lucasholten.com:21212");
	socket.addEventListener('open', function (e) {
		if (!localStorage.username)
			usernamePrompt(true);
		this.send('"' + localStorage.username + '"');
	});
	socket.addEventListener('close', function (e) {
		if (!this.done) {
			alert("socket disconnected. Sorry!");
			resetGame();
		}
	});

	socket.addEventListener('message', function (e) {

		loadedData = JSON.parse(e.data);

		if (!this.boardCreated) {
			this.boardCreated = true;
			if (bodyLoaded)
				setGameState(loadedData);
		} else {
			submitQueue.shift();
			for (let i = 0; i < 5; i++) {
				dataInput:
				for (let j = 0; j < 5; j++) {
					const cell = board[i][j];
					if (cell.value == "?") {
						for (let submitTask of submitQueue)
							if (submitTask.includes(cell))
								continue dataInput;
						setCell(cell, loadedData[5*i+j]);
					} else if (submitQueue.length == 1 && cell.value != loadedData[5*i+j]) {
						for (let submitTask of submitQueue)
							if (submitTask[submitTask.length - 1] == cell)
								continue dataInput;
						console.error(cell, "is", cell.value, "but server says", loadedData[5*i+j]);
						setCell(cell, loadedData[5*i+j]);
					}
				}
			}
			if (submitQueue.length >= 1)
				this.sendTask();
			else {
				for (let i = 0; i < 5; i++)
					for (let j = 0; j < 4; j++)
						if (board[i][j].value == board[i][j+1].value)
							return;
				for (let i = 0; i < 4; i++)
					for (let j = 0; j < 5; j++)
						if (board[i][j].value == board[i+1][j].value)
							return;
				this.done = true;
				gameOver();
			}
		}
	});

	socket.sendTask = function() {
		if (this.readyState >= WebSocket.CLOSING)
			return this.close();
		this.send(JSON.stringify(submitQueue[0].map(c => 5*c.x + c.y)));
	};
}

function gameOver() {
	alert("Game over, you scored " + score + "!");
	resetGame();
}

function resetGame() {
	if (!loadedData)
		return;
	for (let i = 0; i < 5; i++)
		for (let j = 0; j < 5; j++)
			setCell(board[i][j], 0);
	newGame();
	scoreEl.innerText = score;
}

function setGameState(data) {
	for (let i = 0; i < 5; i++)
		for (let j = 0; j < 5; j++)
			setCell(board[i][j], data[5*i + j]);
}


let board;
function setCell(cell, val) {
	cell.value = val;
	if (val == "?") {
		cell.innerEl.style.setProperty("transition", "none");
		cell.innerEl.style.setProperty("color", "transparent");
		cell.innerEl.offsetHeight; // flush css
		cell.innerEl.style.setProperty("transition", "");
	} else {
		if (val > 0) {
			cell.innerEl.innerText = val;
			cell.innerEl.style.setProperty("color", "");
		} else
			cell.innerEl.style.setProperty("color", "transparent");
		if (val >= 10000)
			cell.innerEl.style.setProperty("--font-scale", 0.48);
		else if (val >= 1000)
			cell.innerEl.style.setProperty("--font-scale", 0.6);
		else if (val >= 100)
			cell.innerEl.style.setProperty("--font-scale", 0.8);
		else
			cell.innerEl.style.setProperty("--font-scale", 1);
		updateColor(cell);
	}
}

function updateColor(cell) {
	const COLORS = [[158, 193, 207], [158, 224, 158], [253, 253, 151], [254, 177, 68], [255, 102, 99], [204, 153, 201], [158, 193, 207]];
	let lval = cell.value >= 4 ? Math.min(Math.log2(cell.value) / 2, COLORS.length - 1) : ((cell.value || 2) - 1) / 4;
	lval = lval % 6;
	for (let i = 1; i < COLORS.length; i++)
		if (--lval <= 0) {
			cell.el.style.setProperty("--bg", "rgb(" + ((1+lval) * COLORS[i][0] - lval * COLORS[i-1][0]) + "," + ((1+lval) * COLORS[i][1] - lval * COLORS[i-1][1]) + "," + ((1+lval) * COLORS[i][2] - lval * COLORS[i-1][2]) + ")");
			return;
		}
}


function usernamePrompt(noReset) {
	let newUsername;
	while ((!localStorage.username && (newUsername === null || newUsername === undefined || newUsername.length == 0)) || newUsername === undefined)
		newUsername = prompt("Change username");
	if (newUsername === null || newUsername.length == 0 || newUsername == localStorage.username)
		return;
	document.getElementsByTagName("name")[0].innerText = localStorage.username = newUsername;
	if (noReset !== true)
		resetGame();
}


function setDragHandlers(board) {
	
	let dragging = false;
	let selectedCells;
	for (let i = 0; i < 5; i++)
		for (let j = 0; j < 5; j++) {
			const cell = board[i][j];
			cell.inputEl.onmousedown = cell.inputEl.ontouchstart = function(e) {
				if (cell.value == "?")
					return;
				dragging = true;
				selectedCells = [[cell]];
				cell.el.classList.add("connected");
				e.preventDefault();
			};

			cell.inputEl.onmouseenter = function(e) {
				if (!dragging)
					return;
				const lastMove = selectedCells[selectedCells.length-1];
				if (cell == lastMove[lastMove.length-1].value)
					return;
				for (let i = 0; i < selectedCells.length; i++) {
					const move = selectedCells[i];
					let index = move.indexOf(cell);
					if (index < 0)
						continue;
					while (move.length >= index + 2) {
						const removedCell = move.pop();
						removedCell.el.classList.remove("connected_" + (removedCell.x - move[move.length-1].x) + "_" + (removedCell.y - move[move.length-1].y));
						move[move.length-1].el.classList.remove("connected_" + (move[move.length-1].x - removedCell.x) + "_" + (move[move.length-1].y - removedCell.y));
						move[move.length-1].el.classList.remove("connected");
					}
					for (let j = selectedCells.length; --j > i;) {
						const move = selectedCells.pop();
						for (let k = 1; k < move.length; k++) {
							const removedCell = move[k];
							const nextCell = move[k-1];
							removedCell.el.classList.remove("connected_" + (removedCell.x - nextCell.x) + "_" + (removedCell.y - nextCell.y));
							nextCell.el.classList.remove("connected_" + (nextCell.x - removedCell.x) + "_" + (nextCell.y - removedCell.y));
							nextCell.el.classList.remove("connected");
						}
					}
					return;
				}

				if (Math.abs(cell.x - lastMove[lastMove.length-1].x) + Math.abs(cell.y - lastMove[lastMove.length-1].y) != 1)
					return;
				
				if (cell.value != lastMove[lastMove.length-1].value && cell.value != selectedCells[0][0].value * selectedCells.map(m => m.length).reduce((a, b) => a * b))
					return;
				lastMove[lastMove.length-1].el.classList.add("connected_" + (lastMove[lastMove.length-1].x - cell.x) + "_" + (lastMove[lastMove.length-1].y - cell.y));
				cell.el.classList.add("connected_" + (cell.x - lastMove[lastMove.length-1].x) + "_" + (cell.y - lastMove[lastMove.length-1].y));
				cell.el.classList.add("connected");
				if (cell.value == lastMove[lastMove.length-1].value)
					lastMove.push(cell);
				else 
					selectedCells.push([lastMove[lastMove.length-1], cell]);
			};
		}
	
	let lastMoveEl;
	window.ontouchmove = function(e) {
		const el = document.elementFromPoint(e.touches[0].pageX, e.touches[0].pageY);
		if (el == lastMoveEl)
			return;
		lastMoveEl = el;
		if (el.tagName == "BOARD-CELL" && board.inputEl.contains(el))
			el.onmouseenter(e);
		e.preventDefault();
	}
	window.onmouseup = window.ontouchend = function(e) {
		if (!dragging)
			return;
		const lastMove = selectedCells[selectedCells.length-1];
		if (lastMove.length > 1) {
			let scoreIncrease = selectedCells[0][0].value;
			for (let move of selectedCells) {
				scoreIncrease *= move.length;
				score += scoreIncrease;
				for (let i = 0; i < move.length - 1; i++)
					setCell(move[i], "?", false);
			}
			setCell(lastMove[lastMove.length-1], scoreIncrease);
			scoreEl.innerText = score;
			const queueEmpty = submitQueue.length == 0;

			submitQueue.push(...selectedCells);
			if (queueEmpty)
				socket.sendTask();
		}
		endDrag();
		e.stopPropagation();
	};
	window.onblur = function(e) {
		if (!dragging)
			return;
		endDrag();
	};
	window.onkeydown = function(e) {
		if (!dragging)
			return;
		if (e.code == "Escape")
			endDrag();
	};
	function endDrag() {
		for (let move of selectedCells)
			for (let cell of move) {
				cell.el.classList.remove("connected");
				cell.el.classList.remove("connected_-1_0");
				cell.el.classList.remove("connected_1_0");
				cell.el.classList.remove("connected_0_-1");
				cell.el.classList.remove("connected_0_1");
			}
		dragging = false;
		selectedCells = undefined;
	}

}


function createBoard() {
	const containerEl = document.getElementById("board-container");
	containerEl.innerHTML = "";

	const boardEl = document.createElement("board");
	const renderEl = document.createElement("board-render");
	const animationEl = document.createElement("board-animation");
	const inputEl = document.createElement("board-input");
	board = [];
	board.el = boardEl;
	board.renderEl = renderEl;
	board.animationEl = animationEl;
	board.inputEl = inputEl;

	for (let i = 0; i < 5; i++) {
		const rowEl = document.createElement("board-row");
		const rowInputEl = document.createElement("board-row");
		const row = [];
		for (let j = 0; j < 5; j++) {
			const cellEl = document.createElement("board-cell");
			const cellInnerEl = document.createElement("board-cell-inner");
			cellInnerEl.style.setProperty("color", "transparent");
			const cellInputEl = document.createElement("board-cell");
			const cell = {
				x: i,
				y: j,
				el: cellEl,
				innerEl: cellInnerEl,
				inputEl: cellInputEl,
				value: undefined
			}
			cellEl.style.setProperty("--val", 0);
			
			updateColor(cell);
			row[j] = cell;
			cellEl.appendChild(cellInnerEl);
			rowEl.appendChild(cellEl);
			rowInputEl.appendChild(cellInputEl);
		}
		
		board[i] = row;
		renderEl.appendChild(rowEl);
		inputEl.appendChild(rowInputEl);
	}

	boardEl.appendChild(renderEl);
	boardEl.appendChild(animationEl);
	boardEl.appendChild(inputEl);

	setDragHandlers(board);	

	containerEl.appendChild(boardEl);
	return board;
}