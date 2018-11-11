const ExclusiveLock = require('./exclusive-lock.js');
const ValueLock = require('./value-lock.js');

class LockManager {
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

    _lock(lockClass, params, callback) {
        callback = this._getSafeCallback(callback);

        let lock = this._locks[params.key] = this._locks[params.key] || new lockClass(this, params);
        if (!(lock instanceof lockClass)) {
            // Trying to apply lock method of a wrong lock type
            callback(500);
            return;
        }
        this._locksRequests[params.sessionId] = lock;
        lock._lock(params, (...args) => {
            delete this._locksRequests[params.sessionId];
            callback(...args);
        });
    }

    lockExclusive(sessionId, key, timeout, callback) {
        return this._lock(
            ExclusiveLock,
            {
                sessionId: sessionId,
                key: key,
                timeout: timeout
            },
            callback
        );
    }

    lockValue(sessionId, key, value, timeout, callback) {
        return this._lock(
            ValueLock,
            {
                sessionId: sessionId,
                key: key,
                value: value,
                timeout: timeout
            },
            callback
        );
    }

    unlock(sessionId, key, callback) {
        callback = this._getSafeCallback(callback);

        let lock = this._locks[key];
        if (!lock || lock._unlock(sessionId)) {
            callback(200, 'Lock released');
        } else {
            callback(403, 'Locked by ' + lock);
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
                if (this._locks[key].ownerSessionIds[sessionId]) {
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

    debug(writer) {
        for (let key in this._locks) {
            if (this._locks.hasOwnProperty(key)) {
                let lock = this._locks[key];
                writer('LOCK ' + lock.key + ' ' + lock);
            }
        }

        for (let sessionId in this._locksRequests) {
            if (this._locksRequests.hasOwnProperty(sessionId)) {
                let lock = this._locksRequests[sessionId];
                writer('REQUEST #' + sessionId + ' ' + lock.key);
            }
        }
    }
}

module.exports = LockManager;
