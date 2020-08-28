module.exports = function(token, botSettingFile) {
    // Import Wechaty
    const { PuppetPadplus } = require('wechaty-puppet-padplus');
    const { Wechaty, ScanStatus } = require("wechaty");
    const QrcodeTerminal = require('qrcode-terminal');
    // Import Settings
    const fs = require('fs');
    const botSettings = require("./bot-settings.json");
    const schedule = require("node-schedule");
    const maximumUsers = 5;
    // Import Command System
    const commandUnits = require("./commands.js");
    const utils = require("./utils.js");
    // Construct Puppet
    const puppet = new PuppetPadplus({
        token,
        cacheOption: {
            type: 'mongo',
            url: 'mongodb://127.0.0.1:27017/lazybot', // Require MongoDB be set up.
        },
    });
    const name = "LazyBot";
    const bot = new Wechaty({ puppet, name });
    // Initialize Writing Settings
    (function(){
        const rule = new schedule.RecurrenceRule();
        rule.minute = [0, 10, 20, 30, 40, 50];
        schedule.scheduleJob(rule, function() {
            fs.writeFile(botSettingFile, JSON.stringify(botSettings,null,"\t"), function(err) {
                if (err) console.log("Encounter Error While Writing Settings to File, ", err);
                else console.log("Successfully Writing Setting to File.");
            });
        });
    })();
    // Initialize Bot Settings
    if (!botSettings["users"]) botSettings["users"] = {};
    if (!botSettings["groups"]) botSettings["groups"] = {};
    // Begin Bot
    bot
    .on('scan', function (qrcode, status) {
        if (status === ScanStatus.Waiting) {
            QrcodeTerminal.generate(qrcode);
        }
    })
    .on('login', function (user) {
        console.log(`${user.name()} Login`);
    })
    .on('logout', function (user) {
        console.log(`${user.name()} Logout`);
    })
    .on('room-invite', async roomInvitation => {
        const inviter = await roomInvitation.inviter();
        const name = inviter.name();
        const topic = await roomInvitation.topic();
        try {
            console.log(`Received Room Invitation ${topic} from ${name}.`);
            await roomInvitation.accept();
        }catch(e) {
            console.log(`Encounter Error ${e} while accepting room invitation.`)
        }
    })
    .on('room-leave', async (room, leaverList, remover) => {
        const id = room.id;
        if (!botSettings["groups"][id]) return;
        for (const contact of leaverList) {
            // Remove Leaving People from Monitor List
            if (contact.id in botSettings["groups"][id]["monitors"]) delete botSettings["groups"][id]["monitors"][contact.id];
        }
        return;
    })
    .on('friendship', async (friendship) => {
        const contact = friendship.contact();
        if (friendship.type() === bot.Friendship.Type.Receive) {
            const friends = await bot.Contact.findAll();
            if (friends.length <= maximumUsers) {
                const result = await friendship.accept();
                if (result) {
                    // Rename for the Purpose of Filtering
                    await contact.alias(String(friends.length));
                    console.log(`Request from ${contact.name()} is acceptted successfully!`)
                } else {
                    console.log(`Request from ${contact.name()} failed to accept!`)
                }
            }else {
                console.log(`Reject Friendship From ${contact.name()} because of reaching maximum amount of Users!`);
            }
        }else if (friendship.type() === bot.Friendship.Type.Confirm) {
            console.log(`New friendship confirmed with ${contact.name()}`);
        }
    })
    .on('message', async function(message){
        console.log(`Receive Message`, message);
        if (message.from().self()) return;
        // Bot To Person Chat
        if (!message.room() && utils.isCommand(message.text())) {
            const parsedCommands = utils.parseCommand(message.text());
            if (parsedCommands.err !== "") {
                await message.say(parsedCommands.err);
            }else {
                const ret = await commandUnits.CallCommand(parsedCommands, message, botSettings);
                if (ret !== "") await message.say(ret);
            }
        }else{ // Bot To Room
            const id = message.room().id;
            const topic = await message.room().topic();
            if (!botSettings["groups"][id]) botSettings["groups"][id] = {
                "switch": false, "monitors": {}
            };
            // Renew Topic For Filtering
            botSettings["groups"][id]["topic"] = topic;
            // Command, No need to Relay
            const text = message.text();
            if (utils.isCommand(text)) {
                // Special Case
                if (text === ".enable-lazybot") {
                    botSettings["groups"][id]["switch"] = true;
                    // Avoid Say for Politeness
                    // message.say(`LazyBot is enabled in room ${topic}. You could type in '.disable-lazybot' to disable lazybot.`);
                    return;
                }else if (text === ".disable-lazybot") {
                    botSettings["groups"][id]["switch"] = false;
                    // Avoid Say for Politeness
                    // message.say(`LazyBot is disabled in room ${topic}. You could type in '.enable-lazybot' to enable lazybot.`);
                    return;
                }
                // Parse Command
                if (botSettings["groups"][id]["switch"]) {
                    const parsedCommands = utils.parseCommand(text);
                    if (parsedCommands.err !== "") {
                        // Give Error Message in Personal Chat for Politeness
                        await message.from().say(parsedCommands.err);
                    }else {
                        const ret = await commandUnits.CallCommand(parsedCommands, message, botSettings);
                        if (ret !== "") await message.say(ret);
                    }
                }
            }else{
                for (const monitorId in botSettings["groups"][id]["monitors"]) {
                    const monitor = botSettings["groups"][id]["monitors"][monitorId];
                    if (message.from().id === monitorId || !monitor["switch"] || (!monitor["whitelist"]["enable"] && !monitor["blacklist"]["enable"])) continue;
                    const userId = message.from().id;
                    const text = message.text();
                    let emit = false;
                    if (monitor["whitelist"]["enable"]) emit = false;
                    if (monitor["blacklist"]["enable"]) emit = true;
                    if (monitor["blacklist"]["enable"]) {
                        // Check BlackList First
                        if (monitor["blacklist"]["users"].indexOf(userId) >= 0) emit = false;
                        else {
                            for (const regex of monitor["blacklist"]["rules"]) {
                                const r = new RegExp(regex);
                                if (r.test(text)) {
                                    emit = false;
                                    break;
                                }
                            }
                        }
                    }
                    if (monitor["whitelist"]["enable"]) {
                        // Check WhiteList Second
                        if (!emit) {
                            if (monitor["whitelist"]["users"].indexOf(userId) >= 0) emit = true;
                            else {
                                for (const regex of monitor["whitelist"]["rules"]) {
                                    const r = new RegExp(regex);
                                    if (r.test(text)) {
                                        emit = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    if (emit) {
                        const receiver = await bot.Contact.find({alias:monitor["name"]});
                        if (receiver) {
                            await receiver.say(`Group: ${topic} From: ${message.from().name()}\n${message.text()}`);
                        }
                    }
                }
            }
        }
    });

    bot.start();
}