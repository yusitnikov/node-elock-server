const ExclusiveLock = require('./exclusive-lock.js');

class ExclusiveLockManager {
    constructor() {
        this._locks = {};
        this._locksRequests = {};
    }

    _getSafeCallback(callback) {
        return (...args) => {
            try {
                callback(...args);
            } catch (e) {
                console.log('Unexpected exception during calling the callback');
                console.log(e);
            }
        };
    }

    lock(sessionId, key, timeout, callback) {
        callback = this._getSafeCallback(callback);

        let lock = this._locks[key] = this._locks[key] || new ExclusiveLock(this, key, sessionId);
        this._locksRequests[sessionId] = lock;
        lock._lock(sessionId, timeout, (...args) => {
            delete this._locksRequests[sessionId];
            callback(...args);
        });
    }

    unlock(sessionId, key, callback) {
        callback = this._getSafeCallback(callback);

        let lock = this._locks[key];
        if (!lock || lock._unlock(sessionId)) {
            callback(200, 'Lock released');
        } else {
            callback(403, 'Locked by #' + lock.ownerSessionId);
        }
    }

    unlockAll(sessionId) {
        for (let key in this._locks) {
            if (this._locks.hasOwnProperty(key)) {
                let lock = this._locks[key];
                lock._removeQueueObjectBySessionId(sessionId);
                lock._unlock(sessionId);
            }
        }
    }

    doesSessionIdHaveLocks(sessionId) {
        for (let key in this._locks) {
            if (this._locks.hasOwnProperty(key)) {
                if (this._locks[key].ownerSessionId === sessionId) {
                    return true;
                }
            }
        }

        return false;
    }

    getLocksCount() {
        return Object.keys(this._locks).length;
    }

    deleteLock(lock) {
        delete this._locks[lock.key];
    }

    getRequestLockBySessionId(sessionId) {
        return this._locksRequests[sessionId];
    }
}

module.exports = ExclusiveLockManager;
