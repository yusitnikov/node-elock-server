class ExclusiveLock {
    constructor(manager, key, sessionId) {
        this.manager = manager;
        this.key = key;
        this.ownerSessionId = sessionId;
        this.queue = [];
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

    _lock(sessionId, timeout, callback) {
        let that = this;

        function respondLockedOk() {
            callback(200, 'Lock acquired');
        }
        function respondLockFail() {
            callback(409, 'Already locked by #' + that.ownerSessionId);
        }

        if (this.ownerSessionId === sessionId) {
            respondLockedOk();
            return;
        }

        let deadlockLog = '#' + sessionId;
        for (let lock = this; lock; lock = this.manager.getRequestLockBySessionId(lock.ownerSessionId)) {
            deadlockLog += ' => ' + lock.key + ' = #' + lock.ownerSessionId;
            if (lock.ownerSessionId === sessionId) {
                callback(423, 'Deadlock: ' + deadlockLog);
                return;
            }
        }

        if (timeout === 0) {
            respondLockFail();
            return;
        }

        this.queue.push({
            sessionId: sessionId,
            lock: () => {
                clearTimeout(timeoutId);
                that.ownerSessionId = sessionId;
                respondLockedOk();
            }
        });

        let timeoutId = setTimeout(
            () => {
                that._removeQueueObjectBySessionId(sessionId);
                respondLockFail();
            },
            timeout * 1000
        );
    }

    _unlock(sessionId) {
        if (this.ownerSessionId === sessionId) {
            if (this.queue.length === 0) {
                this.ownerSessionId = sessionId;
                this.manager.deleteLock(this);
            } else {
                let nextSocketLock = this.queue.shift();
                nextSocketLock.lock();
            }
            return true;
        } else {
            return false;
        }
    }
}

module.exports = ExclusiveLock;
