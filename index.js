const tokenJSON = require("./token.json")
const infoJSON = require("./package.json")
console.log(`Running LazyBot ${infoJSON.version}...`)
console.log(`Trying to detect 'token' from './token.json'`)
if (!tokenJSON.token) {
    console.log(`Unable to acquire 'token' field from './token.json'. If you don't possess token of Wechaty, turn to https://github.com/juzibot/Welcome/wiki/Everything-about-Wechaty for more information.`)
    return
}
console.log(`Detect 'token' from './token.json': ${tokenJSON.token}`)
const main = require("./main.js")
main(tokenJSON.token, './bot-settings.json')