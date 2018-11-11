const Lock = require('./lock.js');

class ValueLock extends Lock {
    constructor(manager, params) {
        super(manager, params);
        this.value = params.value;
    }

    toString() {
        return super.toString() + ' (' + this.value + ')';
    }

    _getImmediateLockResult(params) {
        if (this.value === params.value) {
            return true;
        }

        if (this.ownerSessionIds[params.sessionId]) {
            return false;
        }

        return super._getImmediateLockResult(params);
    }

    _acquireNextSocketLock() {
        this.value = this.queue[0].value;
        // trigger and remove all socket locks with the upcoming value
        let oldQueue = this.queue;
        this.queue = [];
        for (var i = 0; i < oldQueue.length; i++) {
            let socketLock = oldQueue[i];
            if (socketLock.value === this.value) {
                // current value - trigger lock and remove from the queue
                socketLock.lock();
            } else {
                // other value - remain in the queue
                this.queue.push(socketLock);
            }
        }
    }
}

module.exports = ValueLock;
