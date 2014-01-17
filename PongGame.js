// To use this basically just call update with your inputs (1 for woot, -1 for meh), and it will return the board.
// Eventually it will just start returning null since the game's over. Check isAsleep to see if that's the case.
// Then reset to start a new game.

var PongGame = function(boardHeight) {
	this.boardHeight = boardHeight;
	// could make a method to find board width by asking...
	this.boardWidth = 12;

	// position of leftmost block of paddle
	this.player1pos;
	this.player2pos;
	this.ballpos;
	this.ballvel;
	this.paddleSize; // must be an odd number

	this.boardchar = ':heavy_minus_sign:';
	this.paddlechar = ':construction:';
	this.ballchar = ':eggplant:';
	this.numberchar = ':office:';

	// stage 0: reset
	// stage 1: countdown
	// stage 2: playing game
	// stage 3: sleep stage
	// repeat if users want
	this.stage = 0;
	this.counter;
};

PongGame.prototype = {
	isAsleep: function() {
		return (this.stage === 3);
	},

	// return winner which is 0 (no win), 1 (p1 win) or 2 (p2 win).
	checkWin: function() {
		if (this.ballpos[1] == 0) {
			return 1;
		} else if (this.ballpos[1] == this.boardHeight-1) {
			return 2;
		} else {
			return 0;
		}
	},

	// returns lines of the board to print, or null if in ending sleep stage
	update: function(player1move, player2move) {
		switch(this.stage) {
			case 0: return this.reset();
			case 1: return this.countDown();
			case 2: return this.move(player1move, player2move);
			case 3: return this.sleepStage();
		}
	},

	reset: function() {
		this.paddleSize = 7; // must be an odd number
		this.player1pos = Math.floor(this.boardWidth/2 - (this.paddleSize-1)/2);
		this.player2pos = this.player1pos;
		this.ballpos = [Math.floor(this.boardWidth/2), Math.floor(this.boardHeight/2)]
		this.ballvel = [[0, 1], [0,-1]][Math.floor(Math.random()*2)];
		this.counter = 5;
		this.stage = 1;
		return this.toLines(this.getBoard());
	},

	// take board and overlay a 3... 2... 1 counter over it.
	countDown: function() {
		var number;
		var numberHeight = 5;
		var numberWidth = 4;
		var one = ['  x ', ' xx ', '  x ', '  x ', ' xxx'];
		var two = ['xxxx', '   x', 'xxxx', 'x   ', 'xxxx'];
		var three = ['xxxx', '   x', 'xxxx', '   x', 'xxxx'];
		
		if (this.counter === 5 || this.counter === 4) {
			number = three;
		} else if (this.counter === 3 || this.counter === 2) {
			number = two;
		} else if (this.counter === 1 || this.counter === 0) {
			number = one;
		}

		// upper left is origin of number
		var px = Math.floor(this.boardWidth/2) - 2;
		var py = Math.floor(this.boardHeight/2) - 2;

		var board = [];
		for (var y=0;y<this.boardHeight; y++) {
			board[y] = [];
			for (var x=0; x<this.boardWidth; x++) {
				board[y][x] = this.boardchar;
			}
		}
		for (var y=0; y<numberHeight; y++) {
			for (var x=0; x<numberWidth; x++) {
				if (number[y][x] === 'x') {
					board[y+py][x+px] = this.numberchar;
				}
			}
		}

		this.counter--;

		if (this.counter < 0) {
			this.stage = 2;
		}

		return this.toLines(board);
	},

	// woot is 1, meh is -1, neither is 0
	move: function(player1move, player2move) {
		var relativeCenter = (this.paddleSize-1)/2;
		// Change velocity if ball collides with player 1 paddle (bottom).
		var relativeBallX = this.ballpos[0] - this.player1pos;
		if ((relativeBallX >= 0 && relativeBallX < this.paddleSize) || (relativeBallX==-1 && this.ballvel[0]==1) || (relativeBallX==this.paddleSize && this.ballvel[0]==-1)) {
			if (this.ballpos[1] === this.boardHeight-2 && this.ballvel[1] == 1) {
				if (relativeBallX < relativeCenter) {
					this.ballvel = [-1, -1];
				} else if (relativeBallX > relativeCenter) {
					this.ballvel = [1, -1];
				} else {
					this.ballvel = [0, -1];
				}
			}
		}	
		// Change velocity if ball collides with player 2 paddle (top).
		var relativeBallX = this.ballpos[0] - this.player2pos;
		if ((relativeBallX >= 0 && relativeBallX < this.paddleSize) || (relativeBallX==-1 && this.ballvel[0]==1) || (relativeBallX==this.paddleSize && this.ballvel[0]==-1)) {
			if (this.ballpos[1] === 1 && this.ballvel[1] == -1) {
				if (relativeBallX < relativeCenter) {
					this.ballvel = [-1, 1];
				} else if (relativeBallX > relativeCenter) {
					this.ballvel = [1, 1];
				} else if (relativeBallX == relativeCenter) {
					this.ballvel = [0, 1];
				}
			}
		}

		// Bounce off walls.
		if (this.ballpos[0] === 0 && this.ballvel[0] === -1) {
			this.ballvel[0] = 1;
		} else if (this.ballpos[0] === this.boardWidth-1 && this.ballvel[0] === 1) {
			this.ballvel[0] = -1;
		}

		// Apply velocity.
		this.ballpos[0] += this.ballvel[0];
		this.ballpos[1] += this.ballvel[1];

		// Move paddles.
		if (player1move === 1 && this.player1pos >= 1) {
			this.player1pos -= 1;
		} else if (player1move == -1 && (this.player1pos+this.paddleSize-2) < this.boardWidth-1) {
			this.player1pos += 1;
		}

		if (player2move === 1 && this.player2pos >= 1) {
			this.player2pos -= 1;
		} else if (player2move == -1 && (this.player2pos+this.paddleSize-2 ) < this.boardWidth-1) {
			this.player2pos += 1;
		}

		// Check win (if so, go to last stage)
		if (this.checkWin() == 1) {
			this.stage = 3;
		} else if (this.checkWin() == 2) {
			this.stage = 3;
		}
		return this.toLines(this.getBoard());
	},

	sleepStage: function() {
		return null;
	},

	getBoard: function() {
		var board = [];
		for (var y=0; y<this.boardHeight; y++) {
			board[y] = []
			for (var x=0; x<this.boardWidth; x++) {
				board[y][x] = this.boardchar;
			}
		}

		for (var x=this.player2pos; x < this.player2pos+this.paddleSize; x++) {
			board[0][x] = this.paddlechar;
		}
		for (var x=this.player1pos; x < this.player1pos+this.paddleSize; x++) {
			board[this.boardHeight-1][x] = this.paddlechar;
		}

		if (this.ballpos[1] >= 0 && this.ballpos[1] < this.boardHeight && this.ballpos[0] >= 0 && this.ballpos[0] < this.boardWidth) {
			board[this.ballpos[1]][this.ballpos[0]] = this.ballchar;
		}
		
		return board;
	},

	toLines: function(board) {
		var out = [];
		for (var i=0; i<this.boardHeight; i++) {
			out[i] = board[i].join('');
		}
		return out;
	}
}
