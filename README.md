# NodeJS eLock server
Distributed locking server on NodeJS.

Implements [Dustin's eLock server](https://github.com/dustin/elock) protocol with following additions:
- deadlock detection:
  `lock` command may return 423 error code with a detailed deadlock description.
- value lock:
  `lock_value key value [timeout]` locks the key to be equal to value.
  Many client sessions can lock the key to the same value at the same time.
  Return codes are same as for the `lock` command.
- `debug` command. Expected output:
  ```
  200 DEBUG
  SESSION <session 1 object JSON>
  SESSION <session 2 object JSON>
  ...
  LOCK <lock 1 description (free text)>
  LOCK <lock 2 description (free text)>
  ...
  REQUEST <lock request 1 description (free text)>
  REQUEST <lock request 2 description (free text)>
  ...
  END
  ```

## Install

1. Install NodeJS
2. Clone the repository:
   ```cmd
   git clone git@github.com:yusitnikov/node-elock-server.git
   ```
3. Install dependencies
   ```cmd
   npm install
   ```
4. Run the server
   ```cmd
   npm run start
   ```
