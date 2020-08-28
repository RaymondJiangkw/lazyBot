class Command{
    _parse(commands) {
        const parsedCommands = {
            mainCommand: commands.mainCommand,
            err: "",
            args: [],
            flags:{

            }
        };
        parsedCommands.args = commands.args;
        for (const flag of this.booleanFlags.flags) {
            if (commands.flags[flag] === undefined || typeof commands.flags[flag] === "boolean") {
                parsedCommands.flags[flag] = commands.flags[flag] || false;
                continue;
            }
            parsedCommands.err = `Encounter Error while parsing command ${flag}, expecting boolean expression. You should type in --${flag}`;
            return parsedCommands;
        }
        /** Non-existing non-boolean flag from original command will not be added into flags */
        for (const flag of this.nonBooleanFlags.flags) {
            if (commands.flags[flag] === undefined) continue;
            if (typeof commands.flags[flag] === "string") {
                parsedCommands.flags[flag] = commands.flags[flag];
                continue;
            }
            parsedCommands.err = `Encounter Error while parsing command ${flag}, expecting bare string expression. You should type in -${flag} <expression>`;
            return parsedCommands;
        }
        return parsedCommands;
    }
    Call(commands, message, botSettings) {
        const parsedCommands = this._parse(commands);
        if (parsedCommands.err !== "") return parsedCommands.err;
        if (parsedCommands.flags["help"] || parsedCommands.flags["h"] !== undefined) return this.help();
        return this.caller(parsedCommands, message , botSettings);
    }
    help() {
        let ret = `Help of Command ${this.mainCommand}\n\n`;
        for (const flag of this.booleanFlags.flags) {
            ret += `\t--${flag}\t${this.booleanFlags.descriptions[flag]}\n`;
        }
        ret += `\n`;
        for (const flag of this.nonBooleanFlags.flags) {
            ret += `\t-${flag}\t${this.nonBooleanFlags.descriptions[flag]}\n`;
        }
        return ret;
    }
    /**
     * 
     * @param {string} mainCommand 
     * @param {Array<{flag: string, description: string}>} booleanFlags 
     * @param {Array<{flag: string, description: string}>} nonBooleanFlags 
     * @param {(commands, message, botSettings) => string} caller 
     */
    constructor(mainCommand, booleanFlags, nonBooleanFlags, caller) {
        this.mainCommand = mainCommand;
        this.booleanFlags = {
            flags: [],
            descriptions:{}
        };
        this.nonBooleanFlags = {
            flags: [],
            descriptions:{}
        };
        for (const flag of booleanFlags) {
            this.booleanFlags.flags.push(flag["flag"]);
            this.booleanFlags.descriptions[flag["flag"]] = flag["description"] || "";
        }
        this.booleanFlags.flags.push("help");
        this.booleanFlags.descriptions["help"] = "List Help of This Command";
        this.booleanFlags.flags.sort((a, b) => a < b? -1:1);
        for (const flag of nonBooleanFlags) {
            this.nonBooleanFlags.flags.push(flag["flag"]);
            this.nonBooleanFlags.descriptions[flag["flag"]] = flag["description"] || "";
        }
        this.nonBooleanFlags.flags.push("h");
        this.nonBooleanFlags.descriptions["h"] = "List Help of This Command";
        this.nonBooleanFlags.flags.sort((a, b) => a < b? -1:1);
        this.caller = caller;
    }
}
/**
 * Command ".help" is reserved for listing all possible commands with their descriptions.
 */
class CommandUnits{
    RegisterCommand(command, description) {
        this.commands[command.mainCommand] = command;
        this.descriptions[command.mainCommand] = description;
    }
    RegisterRegexCommand(regex, command, display, description) {
        this.regexCommands.push({
            regex, command, display, description
        });
    }
    CallCommand(parsedCommands, message, botSettings){
        if (parsedCommands.mainCommand === ".help") {
            const commands = Object.keys(this.commands);
            commands.sort((a, b) => a < b? -1 : 1);
            let ret = "Command\tDescription\n";
            for (const command of commands) ret += `${command}\t${this.descriptions[command]}\n`;
            ret += '\nRegex Command\tDescription\n';
            for (const regexCommand of this.regexCommands) ret += `${regexCommand.display}\t${regexCommand.description}`;
            return ret;
        }
        // Test for complete Match first
        if (this.commands[parsedCommands.mainCommand]) return this.commands[parsedCommands.mainCommand].Call(parsedCommands, message, botSettings);
        for (const regexCommand of this.regexCommands) {
            if (regexCommand.regex.test(parsedCommands.mainCommand)) return regexCommand.command.Call(parsedCommands, message, botSettings);
        }
        return `Unrecognized Command: ${parsedCommands.mainCommand}.`;
    }
    Ready(){
        // Sort Regex Command to Display more beautifully
        this.regexCommands.sort((a,b) => a.display < b.display? -1:1);
    }
    constructor() {
        this.commands = {};
        this.descriptions = {};
        this.regexCommands = [];
    }
}

const tips = `
Tips:
1. In order to type in '--' correctly, you had better turn off "Smart Punctuation", if you use iOS system.
2. You can type in '.help' to list all possible commands.
3. Every command has '-h' and '--help' arguments to list help information of it.
4. Invalid arguments of command will be ignored.`;

const registerPrompt = "Please register first by typing in '.register' before using any command.";

const commandUnits = new CommandUnits();

commandUnits.RegisterCommand(new Command(".register", 
[
    {
        flag:"force",
        description:"Force to register account. In this case, the original account will be deleted, if have registered."
    }
], 
[

],
function (commands, message, botSettings) {
    if (message.room()) return ".register is invalid in Group Chat.";
    const id = message.from().id;
    if (botSettings["users"][id] && !commands.flags["force"]) {
        console.log("Account",id,"Tried to register again");
        return `Have registered Account ${id}`;
    }
    botSettings["users"][id] = {};
    console.log("Account Registered",id);
    return `Hello, ${message.from().name()}!` + tips;
}), "Register Account");

commandUnits.RegisterCommand(new Command(".hi",
[

],
[

],
function (commands, message, botSettings) {
    if (!botSettings["users"][message.from().id]) {
        console.log(`Invalid .hi command from unregistered user ${message.from().id}`);
        return registerPrompt;
    }
    return `Hello, ${message.from().name()}! What a nice day!` + tips;
}), "Say Hi to Bot");

commandUnits.RegisterCommand(new Command(".monitor",
[
    {flag: "off", description: "Turn Off The Monitor"},
    {flag: "whitelist", description: "Toggle the WhiteList"},
    {flag: "blacklist", description: "Toggle the BlackList"}
],
[

],
async function (commands, message, botSettings) {
    if (!botSettings["users"][message.from().id]) {
        console.log(`Invalid .monitor command from unregistered user ${message.from().id}`);
        return registerPrompt;
    }
    if (!message.room()) return `.monitor is invalid in Personal Chat. It is used in Group Chat`;

    const id = message.room().id;
    const userId = message.from().id;
    if (!botSettings["groups"][id]["monitors"][userId]) {
        const alias = await message.from().alias();
        botSettings["groups"][id]["monitors"][userId] = {
            "switch": true, "blacklist":{"users":[],"rules":[], "enable": false}, "whitelist":{"users":[],"rules":[], "enable": false}, "name": alias,
        }
    }
    if (commands.flags["off"]) botSettings["groups"][id]["monitors"][userId]["switch"] = false;
    if (commands.flags["whitelist"]) botSettings["groups"][id]["monitors"][userId]["whitelist"]["enable"] = !botSettings["groups"][id]["monitors"][userId]["whitelist"]["enable"];
    if (commands.flags["blacklist"]) botSettings["groups"][id]["monitors"][userId]["blacklist"]["enable"] = !botSettings["groups"][id]["monitors"][userId]["blacklist"]["enable"];
    return "";
}), "Monitor Group Chat");

commandUnits.RegisterCommand(new Command(".whitelist",
[
    {flag:"delete", description: "Whether to delete rules instead of adding"},
    {flag:"show", description: "Display WhiteList"},
],
[
    {flag:"u", description: "Add/Delete User to/from White List"},
    {flag:"m", description: "Add/Delete Message Filter (Regex) to/from White List"}
],
async function (commands, message, botSettings) {
    if (!botSettings["users"][message.from().id]) {
        console.log(`Invalid .whitelist command from unregistered user ${message.from().id}`);
        return registerPrompt;
    }
    if (!message.room()) return `.whitelist is invalid in Personal Chat. It is used in Group Chat`;
    if (!botSettings["groups"][message.room().id]["monitors"][message.from().id]) return `.whitelist requires user to turn on Monitor once in Group Chat first. You can type in '.monitor' to do it.`;
    if (!commands.flags["u"] && !commands.flags["m"] && !commands.flags["show"]) return `.whitelist require at least one valid argument ( -u <something> or -m <something> or --show ).`;
    
    const topic = await message.room().topic();
    const id = message.room().id;
    const userId = message.from().id;
    if (commands.flags["show"]) {
        let ret = `WhiteList of ${message.from().name()} in ${topic}\n`;
        ret += `User Ids\n`;
        for (const user of botSettings["groups"][id]["monitors"][userId]["whitelist"]["users"]) ret += user + `\n`;
        ret += `\nMessage Filter Rules\n`;
        for (const rule of botSettings["groups"][id]["monitors"][userId]["whitelist"]["rules"]) ret += rule + `\n`;
        message.from().say(ret);
        return "";
    }
    if (commands.flags["u"]) {
        const user = await message.room().member(commands.flags["u"]);
        if (user) {
            const pos = botSettings["groups"][id]["monitors"][userId]["whitelist"]["users"].indexOf(user.id);
            if (!commands.flags["delete"]) {
                if (pos === -1) botSettings["groups"][id]["monitors"][userId]["whitelist"]["users"].push(user.id);
            } else {
                if (pos !== -1) botSettings["groups"][id]["monitors"][userId]["whitelist"]["users"].splice(pos, 1);
            }
        }
        return "";
    }
    if (commands.flags["m"]) {
        const pos = botSettings["groups"][id]["monitors"][userId]["whitelist"]["rules"].indexOf(commands.flags["m"]);
        if (!commands.flags["delete"]) {
            if (pos === -1) botSettings["groups"][id]["monitors"][userId]["whitelist"]["rules"].push(commands.flags["m"]);
        }else {
            if (pos !== -1) botSettings["groups"][id]["monitors"][userId]["whitelist"]["rules"].splice(pos, 1);
        }
        return "";
    }
}), "Manipulate WhiteList of Message Filter of Group Chat");

commandUnits.RegisterCommand(new Command(".blacklist",
[
    {flag:"delete", description: "Whether to delete rules instead of adding"},
    {flag:"show", description: "Display BlackList"}
],
[
    {flag:"u", description: "Add/Delete User to/from Black List"},
    {flag:"m", description: "Add/Delete Message Filter (Regex) to/from Black List"}
],
async function (commands, message, botSettings) {
    if (!botSettings["users"][message.from().id]) {
        console.log(`Invalid .blacklist command from unregistered user ${message.from().id}`);
        return registerPrompt;
    }
    if (!message.room()) return `.blacklist is invalid in Personal Chat. It is used in Group Chat`;
    if (!botSettings["groups"][message.room().id]["monitors"][message.from().id]) return `.blacklist requires user to turn on Monitor once in Group Chat first. You can type in '.monitor' to do it.`;
    if (!commands.flags["u"] && !commands.flags["m"] && !commands.flags["show"]) return `.blacklist require at least one valid argument ( -u <something> or -m <something> or --show ).`;
    
    const topic = await message.room().topic();
    const id = message.room().id;
    const userId = message.from().id;
    if (commands.flags["show"]) {
        let ret = `BlackList of ${message.from().name()} in ${topic}\n`;
        ret += `User Ids\n`;
        for (const user of botSettings["groups"][id]["monitors"][userId]["blacklist"]["users"]) ret += user + `\n`;
        ret += `\nMessage Filter Rules\n`;
        for (const rule of botSettings["groups"][id]["monitors"][userId]["blacklist"]["rules"]) ret += rule + `\n`;
        message.from().say(ret);
        return "";
    }
    if (commands.flags["u"]) {
        const user = await message.room().member(commands.flags["u"]);
        if (user) {
            const pos = botSettings["groups"][id]["monitors"][userId]["blacklist"]["users"].indexOf(user.id);
            if (!commands.flags["delete"]) {
                if (pos === -1) botSettings["groups"][id]["monitors"][userId]["blacklist"]["users"].push(user.id);
            } else {
                if (pos !== -1) botSettings["groups"][id]["monitors"][userId]["blacklist"]["users"].splice(pos, 1);
            }
        }
        return "";
    }
    if (commands.flags["m"]) {
        const pos = botSettings["groups"][id]["monitors"][userId]["blacklist"]["rules"].indexOf(commands.flags["m"]);
        if (!commands.flags["delete"]) {
            if (pos === -1) botSettings["groups"][id]["monitors"][userId]["blacklist"]["rules"].push(commands.flags["m"]);
        }else {
            if (pos !== -1) botSettings["groups"][id]["monitors"][userId]["blacklist"]["rules"].splice(pos, 1);
        }
        return "";
    }
}), "Manipulate BlackList of Message Filter of Group Chat");

commandUnits.Ready();

module.exports = commandUnits;