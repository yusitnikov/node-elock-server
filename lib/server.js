const net = require('net');
const readLine = require('readline');
const LockManager = require('./lock-manager.js');

const lockManager = new LockManager();

const server = net.createServer();

server.autoIncrementSessionId = 0;
server.sessions = {};

server.on('connection', (socket) => {
    // Disable buffering so socket.write() will work synchronously
    socket.setNoDelay();
    // Disable timeout for the socket
    socket.setTimeout(0);

    let session = {
        id: ++server.autoIncrementSessionId,
        disposeTimeout: 30000,
        disposeTimeoutId: null
    };
    server.sessions[session.id] = session;

    function log(message) {
        console.log('[#' + session.id + '] ' + message);
    }

    log('connected');

    readLine.createInterface(socket).on('line', (line) => {
        log('command received: ' + line);

        let args = line.split(' ');
        socket.emit('command', ...args);
    });

    function writeLine(line, resume) {
        log('answer: ' + line);
        socket.write(line + '\n');
        if (resume) {
            log('answer end');
            socket.resume();
        }
    }

    function respond(code, message, resume = true) {
        code = code || 200;
        message = message || (code === 200 ? 'OK' : 'Internal server error');
        writeLine(code + ' ' + message, resume);
    }

    function lockExclusive(key, timeoutStr) {
        let timeout = parseInt(timeoutStr || 0);
        if (isNaN(timeout) || timeout < 0) {
            respond(500);
            return;
        }

        lockManager.lockExclusive(session.id, key, timeout, (responseCode, responseMessage) => {
            respond(responseCode, responseMessage);
        });
    }

    function lockValue(key, value, timeoutStr) {
        let timeout = parseInt(timeoutStr || 0);
        if (isNaN(timeout) || timeout < 0) {
            respond(500);
            return;
        }

        lockManager.lockValue(session.id, key, value, timeout, (responseCode, responseMessage) => {
            respond(responseCode, responseMessage);
        });
    }

    function unlockAll() {
        lockManager.unlockAll(session.id);
        respond(200);
    }

    // noinspection JSUnusedGlobalSymbols
    let commands = {
        set_timeout_1: (timeoutStr) => {
            let timeout = parseInt(timeoutStr);
            if (isNaN(timeout) || timeout < 0) {
                respond(500);
                return;
            }

            session.disposeTimeout = timeout;
            respond(200);
        },
        lock_1: lockExclusive,
        lock_2: lockExclusive,
        lock_value_2: lockValue,
        lock_value_3: lockValue,
        unlock_1: (key) => {
            lockManager.unlock(session.id, key, (responseCode, responseMessage) => {
                respond(responseCode, responseMessage);
            });
        },
        unlock_all_0: unlockAll,
        quit_0: unlockAll,
        conn_id_0: () => {
            respond(200, session.id);
        },
        conn_id_1: (newSessionIdStr) => {
            let newSessionId = parseInt(newSessionIdStr);
            if (isNaN(newSessionId) < newSessionId <= 0) {
                respond(500);
                return;
            }

            if (newSessionId === session.id) {
                respond(200, 'Resumed');
                return;
            }

            if (lockManager.doesSessionIdHaveLocks(session.id)) {
                respond(403, 'Can not resume connection - current connection already acquired locks');
                return;
            }

            let sessionToResume = server.sessions[newSessionId];
            if (!sessionToResume) {
                respond(403, 'Can not resume connection - it is already disposed');
                return;
            }

            let disposeTimeoutId = sessionToResume.disposeTimeoutId;
            if (!disposeTimeoutId) {
                respond(403, 'Can not resume connection - it is still active');
                return;
            }

            clearTimeout(disposeTimeoutId);
            delete server.sessions[session.id];
            session.id = newSessionId;
            server.sessions[newSessionId] = session;
            respond(200, 'Resumed');
        },
        stats_0: () => {
            let clientsCount = Object.keys(server.sessions).length,
                locksCount = lockManager.getLocksCount();

            respond(200, 'STATS', false);
            writeLine('STAT clients ' + clientsCount);
            writeLine('STAT locks ' + locksCount);
            writeLine('STAT monitoring ' + clientsCount);
            writeLine('END', true);
        },
        debug_0: () => {
            respond(200, 'DEBUG', false);
            for (let sessionId in server.sessions) {
                if (server.sessions.hasOwnProperty(sessionId)) {
                    writeLine('SESSION ' + JSON.stringify(server.sessions[sessionId]));
                }
            }
            lockManager.debug(message => {
                writeLine(message);
            });
            writeLine('END', true);
        }
    };

    socket.on('command', (command, ...args) => {
        socket.pause();

        let callback = commands[command + '_' + args.length];
        if (callback) {
            callback(...args);
        } else {
            respond(500);
        }
    });

    socket.on('timeout', () => {
        log('timeout event - ignore');
    });

    socket.on('error', (error) => {
        log('error:');
        console.log(error);
    });

    socket.on('close', () => {
        log('closed');

        function dispose() {
            log('dispose');
            delete server.sessions[session.id];
            lockManager.unlockAll(session.id);
        }

        if (session.disposeTimeout === 0) {
            dispose();
        } else {
            log('will dispose after ' + session.disposeTimeout / 1000 + ' seconds');
            session.disposeTimeoutId = setTimeout(dispose, session.disposeTimeout);
        }
    });
});

server.on('error', (err) => {
    console.log('unexpected server error');
    console.log(err);
});

server.listen(11400, () => {
    console.log('server bound');
});
