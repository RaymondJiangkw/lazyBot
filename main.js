module.exports = function(token) {
    const { PuppetPadplus } = require('wechaty-puppet-padplus')
    const { Wechaty, ScanStatus } = require("wechaty")
    const QrcodeTerminal = require('qrcode-terminal')

    const puppet = new PuppetPadplus({
        token,
        cacheOption: {
            type: 'mongo',
            url: 'mongodb://127.0.0.1:27017/lazybot', // Require MongoDB be set up.
        },
    });
    const name = "LazyBot";
    const bot = new Wechaty({
        puppet,
        name,
    });

    bot
    .on('scan', function (qrcode, status) {
        if (status === ScanStatus.Waiting) {
            QrcodeTerminal.generate(qrcode);
        }
    })
    .on('login', function (user) {
        console.log(`${user.name()} login`);
    })
    .on('logout', function (user) {
        console.log(`${user.name()} logout`);
    })
    .on('message', async function(message){
        console.log(message);
    })
    .start();
}