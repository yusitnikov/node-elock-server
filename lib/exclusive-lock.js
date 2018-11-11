const Lock = require('./lock.js');

class ExclusiveLock extends Lock {
    _getImmediateLockResult(params) {
        if (this.ownerSessionIds[params.sessionId]) {
            return true;
        }

        return super._getImmediateLockResult(params);
    }
}

module.exports = ExclusiveLock;
