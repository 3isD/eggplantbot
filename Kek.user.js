// ==UserScript==
// @name        Kek
// @namespace   fug
// @require     TimedQueue.js
// @require     PongGame.js
// @description Kekking
// @include     http://plug.dj/kek/
// @version     1.00
// @grant       GM_xmlhttpRequest
// @grant       GM_log
alert("Greasemonkey script started.");

// return the json object or null
function getJSON(theurl, callback) {
    setTimeout(function() { //quick fix for access violations
        GM_xmlhttpRequest({
            method: "GET",
            url: theurl, 
            onload: function(response) {
                var theobj = unsafeWindow.jQuery.parseJSON(response.responseText);
                callback(theobj);
            },
            onerror: function(response) {
                var msg = "An error occurred."
                    + "\nresponseText: " + res.responseText
                    + "\nreadyState: " + res.readyState
                    + "\nresponseHeaders: " + res.responseHeaders
                    + "\nstatus: " + res.status
                    + "\nstatusText: " + res.statusText
                    + "\nfinalUrl: " + res.finalUrl;
                alert(msg);
                //callback(null);
            }
        });
    }, 0);
}

var BoardState = function() {
    this.boardNames = null;
    this.boards = {};
};

BoardState.prototype = {
    // callback is a function(array)
    getBoardNames: function(callback) {
        var jsonURL = 'http://a.4cdn.org/boards.json';
        if (this.boardNames === null) {
            this.boardNames = [];
            getJSON(jsonURL, function(boardjson) {
                boardjson.boards.forEach(function(chunk) {
                    this.boardNames.push(chunk.board);
                }.bind(this));
                callback(this.boardNames);
            }.bind(this));
        } else {
            callback(this.boardNames);
        }
    },
    
    // Get all threads and their contents from a board.
    // boardID is a string in getBoardNames
    // callback is a function(jsonObj)
    getBoard: function(boardID, callback) {
        if (!(boardID in this.boards)) {
            this.boards[boardID] = {};
        }
    
        var seenThreads = []; // used to prune away out of date threads in boards
        var jsonURL = 'http://a.4cdn.org/' + boardID + '/threads.json';
        getJSON(jsonURL, function(jsonObj) {
            var queue = new TimedQueue(1000);
            jsonObj.forEach(function(page) {
                page.threads.forEach(function(thread) {
                    seenThreads.push(thread.no);
                    if (!(thread.no in this.boards[boardID]) || thread.last_modified > this.boards[boardID][thread.no].last_modified) {
                        queue.add(function() {
                            this.getThread(boardID, thread.no, function(threadJson) {
                                this.boards[boardID][thread.no] = {last_modified: thread.last_modified, json: threadJson};
                            }.bind(this));
                        }.bind(this));   
                    }
                }.bind(this));
            }.bind(this));
            
            // a couple last minute tasks are put at the end of the queue
            queue.add(function() {
                // throw away old threads that weren't in the threads list
                Object.keys(this.boards[boardID]).forEach(function(threadno) {
                    if (seenThreads.indexOf(parseInt(threadno)) < 0) {
                        delete this.boards[boardID][threadno];
                    }
                }.bind(this));
                // finally callback
                callback(this.boards[boardID]);
            }.bind(this), 0);
            
            queue.run();
        }.bind(this));
    },
    
    // boardID is a string in getBoardNames
    // threadID is a number
    // callback is a function(jsonObj)
    getThread: function(boardID, threadID, callback) {
        var jsonURL = 'http://a.4cdn.org/' + boardID + '/res/' + threadID.toString() + '.json';
        getJSON(jsonURL, callback);
    },
    
    getPage: function(boardID, pagenum, callback) {
        getJSON('http://a.4cdn.org/'+boardID+'/'+pagenum+'.json', callback);
    }
}

function getMatches(string, regex, index) {
    index || (index = 1); // default to the first capturing group
    var matches = [];
    var match;
    while (match = regex.exec(string)) {
        matches.push(match[index]);
    }
    return matches;
}

var boardState = new BoardState();
var BUSY = false;

// callback takes {123#p456 : N, 111#p222 : N2, ...}
function countReplies(boardName, callback) {
    var link = new RegExp('<a href="([0-9]+#p[0-9]+)" class="quotelink">', 'g');
    
    var replyCounts = {}
    
    boardState.getBoard(boardName, function(board) {
        for (var opid in board) {
            board[opid].json.posts.forEach(function(post) {
                var x;
                if (post.resto === 0) {
                    x = post.no.toString()  + '#p' + post.no.toString();
                } else {
                    x = replyCounts[post.resto.toString() + '#p' + post.no.toString()] = 0;
                }
                if (!(x in replyCounts)) {
                        replyCounts[x] = 0;
                }
                getMatches(post.com, link).forEach(function(match) {
                    if (match in replyCounts) {
                        replyCounts[match] += 1;
                    } else {
                        replyCounts[match] = 1;
                    }
                });
            });
        }
        callback(replyCounts);
    });
}

// callback takes nothing
function getTop(boardName, callback) {
    var topten = [];
    var size = 10;
    for (var i=0; i<size; i++) {
        topten[i] = {dest: null, count: 0};
    }
    countReplies(boardName, function(replyCounts) {
        for (var dest in replyCounts) {
            for (var i=0; i < size; i++) {
                if (replyCounts[dest] > topten[i].count) {
                    topten.splice(i, 0, {dest: dest, count: replyCounts[dest]});
                    topten.pop();
                    break;
                }
            }
        }
        
        unsafeWindow.API.sendChat("Top 10 posts on the board:");
        for (var i=0; i<size; i++) {
            if (topten[i].dest === null) {
                unsafeWindow.API.sendChat((i+1).toString() + ". Error getting post.");
            } else {
                theurl = "http://boards.4chan.org/" + boardName + "/res/" + topten[i].dest
                unsafeWindow.API.sendChat(
                    (i+1).toString() + ". " + theurl + " ("+topten[i].count.toString()+")"
                );
            }
        }
        callback();
    });
}

// get unchecked dubs. callback takes nothing.
function getUnchecked(boardName, callback) {
    var dests = []
    countReplies(boardName, function(replyCounts) {
        for (var dest in replyCounts) {
            if (replyCounts[dest] === 0 && dest[dest.length-1] === dest[dest.length-2]) {
                dests.push(dest);
            }
        }
        
        unsafeWindow.API.sendChat("ALERT! These dubs are unchecked!");
        // assumes post nums are at least 10
        for (var dest in replyCounts) {
            if (replyCounts[dest] === 0 && dest[dest.length-1] === dest[dest.length-2]) {
                unsafeWindow.API.sendChat("http://boards.4chan.org/" + boardName + "/res/" + dest);
            }
        }
        callback();
    });
}

function sizeOfGet(num) {
    numstr = num.toString()
    var count = 0;
    for (var i=numstr.length-1; i > 0; i--) {
        var right = numstr[i];
        var left = numstr[i-1];
        if (right === left) {
            count++;
        } else {
            break;
        }
    }
    return count;
}

function greatestGets(boardName, callback) {
    var top = [];
    var size = 10;
    for (var i=0; i<size; i++) {
        top[i] = {dest: null, greatness:0};
    }
    
    countReplies(boardName, function(replyCounts) {
        for (var dest in replyCounts) {
            var count = sizeOfGet(dest);
            for (var i=0; i < size; i++) {
                if (count > top[i].greatness) {
                    top.splice(i, 0, {dest: dest, greatness: count});
                    top.pop();
                    break;
                }
            }
        }
        
        unsafeWindow.API.sendChat("Top 10 greatest gets on " + boardName + ": ");
        for (var i=0; i<size; i++) {
            if (top[i].dest === null) {
                unsafeWindow.API.sendChat((i+1).toString() + ". Error getting post.");
            } else {
                theurl = "http://boards.4chan.org/" + boardName + "/res/" + top[i].dest;
                unsafeWindow.API.sendChat((i+1).toString() + ". " + theurl);
            }
        }
        
        callback();
    });
}

function nextGetFromNum(num, size) {
    var numstr = num.toString();

    // lead num with 0s if needed
    var sizeDifference = size - numstr.length;
    if (sizeDifference > 0) {
        numstr = Array(sizeDifference+1).join('0') + numstr;
    }
    
    // cut the string in half and hack on the repeating nums
    var left = numstr.slice(0, numstr.length - size);
    var right = numstr.slice(numstr.length - size, numstr.length);

    var repeatDigit = right[0];
    var repeatString = Array(size+1).join(repeatDigit);
    if (parseInt(right) >= parseInt(repeatString)) {
        repeatDigit = (parseInt(repeatDigit) + 1).toString()
        repeatString = Array(size+1).join(repeatDigit);
    }
    return parseInt(left + repeatString);
}

function nextGet(size, callback) {
    var queue = new TimedQueue(1000);
    var closest = [null, null]; //board, post no
    boardState.getBoardNames(function(names) {
        names.forEach(function(name) {
            queue.add(function() {
                boardState.getPage(name, 0, function(jsonObj) {
                    var highest = 0;
                    jsonObj.threads.forEach(function(thread) {
                        thread.posts.forEach(function(post) {
                            highest = Math.max(highest, post.no)
                        });
                    });
                    if (closest[0] === null) {
                        closest = [name, highest];
                    } else {
                        closestGet = nextGetFromNum(closest[1], size);
                        nextGet = nextGetFromNum(highest, size);
			//GM_log("highest: " + highest + "," + nextGet);
			//GM_log("closest: " + closest + ", "+closestGet);
                        if (closest[1] === null || nextGet - highest < closestGet - closest[1]) {
                            closest = [name, highest];
                        }
                    }
                });
            });
        });
        queue.add(function() {
            if (closest[0] === null) {
                unsafeWindow.API.sendChat("Error: Something blew up getting posts for nextGet");
            } else {
                unsafeWindow.API.sendChat(
                    "The next size " + size.toString() + " get is /" + closest[0] + 
                    "/'s " + nextGetFromNum(closest[1], size).toString() +
                    " GET. Right now it's at at " + closest[1].toString()
                );
            }
            callback();
        }, 0);
        queue.run();
    });
}

function checkBoard(name, callback) {
    boardState.getBoardNames(function(names) {
        if (name[0] === '/') {
            callback(names.indexOf(name.slice(1,name.length-1) > -1));
        } else {
            callback(names.indexOf(name) > -1);
        }
    });
}

BUSY = false;
// func must take a callback
function blockCall(func) {
    if (BUSY) {
        unsafeWindow.API.sendChat("Check ur privilege :^)");
    } else {
        BUSY = true;
        func(function() {
            BUSY = false;
        });
    }
}

snakectr = 0;

// 
function parseCmds(data) {
    var re = /^%\w+(?=(\s.*)|$)/;
    var parts;
    if (re.test(data.message)) {
        if (data.from == 'Captain_Lel') {
            switch(snakectr++%3) {
                case 0: unsafeWindow.API.sendChat("Tunnel snakes rule!"); break;
                case 1: unsafeWindow.API.sendChat("We're the tunnel snakes"); break;
                case 2: unsafeWindow.API.sendChat("That's us. And we RULE RULE RULE"); break;
            }
        }
        parts = data.message.split(" ");
        cmd = parts[0].toLowerCase();
        args = parts.slice(1);

        switch(cmd) {

        case '%boards':
            boardState.getBoardNames(function(names) {
                unsafeWindow.API.sendChat(names.join(', '));
            });
            break;

        case '%top':
            blockCall(function(unblock) {
                var board = 's4s';
                if (args.length > 0) {
                    board = args[0];
                }
                checkBoard(board, function(isBoard) {
                    if (isBoard) {
                        unsafeWindow.API.sendChat("Getting most replied to posts on " + board + "...");
                        getTop(board, unblock);
                    } else {
                        unsafeWindow.API.sendChat("uguu that's not a board you baka~~~!");
                        unblock()
                    }
                });
            });
            break;

        case '%unchecked':
            blockCall(function(unblock) {
                var board = 's4s';
                if (args.length > 0) {
                    board = args[0];
                }
                checkBoard(board, function(isBoard) {
                    if (isBoard) {
                        unsafeWindow.API.sendChat("Getting unchecked dubs on " + board + "...");
                        getUnchecked(board, unblock);
                    } else {
                        unsafeWindow.API.sendChat("uguuuu that's not a board you baka~~~!");
                        unblock();
                    }
                });
            });
            break;

        case '%gets':
            blockCall(function(unblock) {
                var board = 's4s';
                if (args.length > 0) {
                    board = args[0];
                }
                checkBoard(board, function(isBoard) {
                    if (isBoard) {
                        unsafeWindow.API.sendChat("Finding greatest gets on " + board + "...");
                        greatestGets(board, unblock);
                    } else {
                        unsafeWindow.API.sendChat("uguuuu that's not a board you baka~~~!");
                        unblock();
                    }
                });
            });
            break;

        case '%nextget':
            if (args.length === 1) {
                var intRegex = /^\d+$/;
                if (intRegex.test(args[0])) {
                    blockCall(function(unblock) {
                        unsafeWindow.API.sendChat("finding the next length " + args[0].toString() + " get");
                        nextGet(args[0], unblock);
                    })
                } else {
                    unsafeWindow.API.sendChat("nice number bruver");
                }
            } else {
                unsafeWindow.API.sendChat("wrong number of args");
            }
            break;

        case '%roll':
            if (args.length === 1 && isNaN(args[0])){
                var letter = args[0][Math.floor(Math.random()*args[0].length)];
                unsafeWindow.API.sendChat("You rolled: " + letter);
            } else if (args.length > 1 && isNaN(args[0])) {
                var word = args[Math.floor(Math.random()*args.length)];
                unsafeWindow.API.sendChat("You rolled: " + word);
            } else {
                var max = 100000000;
                if (args.length > 0) { 
                    max = args[0];
                }
                num = Math.floor((Math.random()*max) + 1);
                unsafeWindow.API.sendChat("You rolled: " + num.toString() + " on a " + max.toString() + " sided die.");
            }
            break;

        case '%raid':
            unsafeWindow.API.sendChat("LEEEEEEEEEEEEEEEEEROOOOOOOOOOOOOOOOOOOOY JEEEEEEEEEEEEEEEEEEEEEEEEEEEEENKIIIIIIIIIIIIINS");
            break;
        
        case '%fortune':
            var prefix = 'Your fortune: ';
            var fortunes = ['Reply hazy, try again', 'Excellent Luck', 'Good Luck', 'Average Luck', 'Very Bad Luck',
                            'Good news will come to you by mail', '（　´_ゝ`）ﾌｰﾝ', 'ｷﾀ━━━━━━(ﾟ∀ﾟ)━━━━━━ !!!!',
                            'You will meet a dark handsome stranger', 'Better not tell you now', 'Bad Luck', 'Godly Luck'];
            var fortune = fortunes[Math.floor(Math.random()*fortunes.length)];
            unsafeWindow.API.sendChat(prefix + fortune);
            break;
        
        case '%pong':
            if (args.length == 0) {
                unsafeWindow.API.sendChat("But against who...");
            } else {
                player1ID = data.fromID;
                player2ID = null;
                unsafeWindow.API.getUsers().forEach(function(user) {
                    if (args.join(' ').toLowerCase() === user.username.toLowerCase() || args.join(' ').toLowerCase() === '@'+user.username.toLowerCase()) {
                        player2ID = user.id;
                    }
                });
                if (player2ID !== null) {
                    waitForAccept(player1ID, player2ID, function(accepted) {
                        if (accepted && !ponging) {
                            ponging = true;
                            pongGame.reset();
                            playPong(function() {
                                ponging = false;
                            });
                        }
                    });
                } else {
                    unsafeWindow.API.sendChat("B-but " + data.from + "-chan I don't know who that is~~~ ;_;");
                }
            }
            break;
        case '%h':
        case '%halp':
        case '%help':
            var helpstr;
            if (args.length === 0) {
                helpstr = "Commands: %boards, %top [board], %unchecked [board], %gets [board], %nextget N, %roll N, %raid, %fortune, %pong opponentName. %help command for more info.";
            } else {
                var cmdarg = args[0];
                if (args[0][0] === '%') {
                    cmdarg = args[0].slice(1,args.length);
                }
                switch(cmdarg) {
                    case 'boards': helpstr = "boards: Get a list of boards."; break;
                    case 'top': helpstr = "top [board]: Get the 10 posts with the most replies on the (optional) board, which defaults to s4s."; break;
                    case 'unchecked': helpstr = "unchecked [board]: Get all unchecked dubs on the (optional) board, which defaults to s4s."; break;
                    case 'gets': helpstr = "gets [board]: Find the best current GETS on the (optional) board, which defaults to s4s"; break;
                    case 'nextget': helpstr = "nextget N: Find the board closest to a GET of the given size, where N=2 is dubs, N=3 is trips, etc."; break;
                    case 'roll': helpstr = "roll N: Roll an N sided die. %roll str: Choose a random character. %roll word1, word2, word3: Choose a random word."; break;
                    case 'raid': helpstr = "raid: :eggplant:"; break;
                    case 'fortune': helpstr = "fortune: :eggplant:"; break;
                    case 'pong': helpstr = "pong opponentName: Challenge the opponent to a riveting game of pong. Woot: move paddle left. Meh: move paddle right. Person who starts game is bottom."; break;
                }
            }
            unsafeWindow.API.sendChat(helpstr);
            break;
        
        case '%ping':
            unsafeWindow.API.sendChat('pong');
            break;
        }
    }
}

// callback takes 
function waitForAccept(player1ID, player2ID, callback) {
    player1name = unsafeWindow.API.getUser(player1ID).username;
    player2name = unsafeWindow.API.getUser(player2ID).username;
    var msg = "@" + player2name + ": " + player1name + " has challenged you to pong! Woot is left, Meh is right. " + player1name + " is bottom. Type accept to play."
    unsafeWindow.API.sendChat(msg);

    var success = false;
    function parseAcceptMessage(data) {
        if (data.fromID = player2ID && data.message === 'accept') {
            unsafeWindow.API.sendChat("Challenge accepted, wew");
            success = true;
            callback(true);
            unsafeWindow.API.off(unsafeWindow.API.CHAT, parseAcceptMessage);
        }
    }
    setTimeout(function() {
        if (!success) {
            unsafeWindow.API.sendChat("Pong challenge timed out.");
            unsafeWindow.API.off(unsafeWindow.API.CHAT, parseAcceptMessage);
            callback(false);
        }
    }, 30000);
    unsafeWindow.API.on(unsafeWindow.API.CHAT, parseAcceptMessage);
}

var pongGame = new PongGame(7);
var ponging = false;
var player1ID;
var player2ID;
function playPong(callback) {
    // theuser.vote: -1 is meh, 0 is none, 1 is woot. these are the controls.
    var player1 = unsafeWindow.API.getUser(player1ID);
    var player2 = unsafeWindow.API.getUser(player2ID);
    
    if (player1.vote === undefined || player2.vote === undefined) {
        unsafeWindow.API.sendChat("A player left! Game's over :(");
        callback();
    } else {
        unsafeWindow.API.sendChat(" ");
        var lines = pongGame.update(player1.vote, player2.vote);
        lines.forEach(function(line) {
            unsafeWindow.API.sendChat(line);
        });
        if (!(pongGame.isAsleep())) {
            setTimeout(playPong, 500);
        } else {
            winner = pongGame.checkWin();
            if (winner == 1) {
                unsafeWindow.API.sendChat(player1.username + " wins all the kek!");
            } else if (winner == 2) {
                unsafeWindow.API.sendChat(player2.username + " wins all the kek!");
            }
            player1ID = null;
            player2ID = null;
            callback();
        }
    }
}

// delay for 5 seconds before adding listeners so the page is actually loaded
window.addEventListener('load', function() { setTimeout(
    function() {
        alert("Loaded.");
        
        unsafeWindow.API.on(unsafeWindow.API.CHAT, function(data) {
            parseCmds(data);
        });
        
    }, 8000) }, false)

alert("Greasemonkey script reached end.");

// ==/UserScript==
