class Lock {
    constructor(manager, params) {
        this.manager = manager;
        this.key = params.key;
        this.ownerSessionIds = {};
        this.ownerSessionIds[params.sessionId] = params.sessionId;
        this.queue = [];
    }

    toString() {
        return '#' + Object.keys(this.ownerSessionIds).join(', #');
    }

    _removeQueueObjectBySessionId(sessionId) {
        for (let index = 0; index < this.queue.length; index++) {
            let socketLock = this.queue[index];
            if (socketLock.sessionId === sessionId) {
                this.queue.splice(index, 1);
                break;
            }
        }
    }

    _getImmediateLockResult(params) {
        return null;
    }

    _detectDeadLock(sessionId) {
        let map = {};
        let queue = [
            {
                lock: this,
                log: '#' + sessionId + ' => ' + this.key
            }
        ];
        while (queue.length) {
            let item = queue.shift(),
                lock = item.lock;

            if (lock.ownerSessionIds[sessionId]) {
                return item.log + ' = #' + sessionId;
            }

            for (let ownerSessionId in lock.ownerSessionIds) {
                if (lock.ownerSessionIds.hasOwnProperty(ownerSessionId)) {
                    if (map[ownerSessionId]) {
                        // already checked
                        continue;
                    }
                    map[ownerSessionId] = true;

                    let nextLock = this.manager.getRequestLockBySessionId(ownerSessionId);
                    if (nextLock) {
                        queue.push({
                            lock: nextLock,
                            log: item.log + ' = #' + ownerSessionId + ' => ' + lock.key
                        });
                    }
                }
            }
        }
        return null;
    }

    _lock(params, callback) {
        let sessionId = params.sessionId;
        let timeout = params.timeout;
        let that = this;
        let immediateLockResult = this._getImmediateLockResult(params);

        function respondLockedOk() {
            callback(200, 'Lock acquired');
        }
        function respondLockFail() {
            callback(409, 'Already locked by ' + that);
        }

        if (immediateLockResult === true) {
            this.ownerSessionIds[sessionId] = sessionId;
            respondLockedOk();
            return;
        }

        if (immediateLockResult === false) {
            respondLockFail();
            return;
        }

        let deadlockLog = this._detectDeadLock(sessionId);
        if (deadlockLog) {
            callback(423, 'Deadlock: ' + deadlockLog);
            return;
        }

        if (timeout === 0) {
            respondLockFail();
            return;
        }

        let socketLock = {
            lock: () => {
                clearTimeout(timeoutId);
                that.ownerSessionIds[sessionId] = sessionId;
                respondLockedOk();
            }
        };
        for (let key in params) {
            if (params.hasOwnProperty(key)) {
                socketLock[key] = params[key];
            }
        }
        this.queue.push(socketLock);

        let timeoutId = setTimeout(
            () => {
                that._removeQueueObjectBySessionId(sessionId);
                respondLockFail();
            },
            timeout * 1000
        );
    }

    _unlock(sessionId) {
        if (this.ownerSessionIds[sessionId]) {
            delete this.ownerSessionIds[sessionId];
            if (Object.keys(this.ownerSessionIds).length) {
                // have other owners - nothing to update
            } else if (this.queue.length === 0) {
                this.manager.deleteLock(this);
            } else {
                this._acquireNextSocketLock();
            }
            return true;
        } else {
            return false;
        }
    }

    _acquireNextSocketLock() {
        let nextSocketLock = this.queue.shift();
        nextSocketLock.lock();
    }
}

module.exports = Lock;
