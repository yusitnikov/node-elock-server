# NodeJS eLock server
Distributed locking server on NodeJS.

Implements [Dustin's eLock server](https://github.com/dustin/elock) protocol with an addition of deadlock detection:
`lock` command may return 423 error code with a detailed deadlock description.

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
