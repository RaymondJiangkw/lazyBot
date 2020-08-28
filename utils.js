module.exports = {
    /**
     * Test whether message is a command
     * @param {string} message 
     * @returns {boolean}
     */
    isCommand: function(message) {
        return message[0] === '.';
    },
    /**
     * Parse message as command
     * ' ', which is not between '' or "", is perceived as separator
     * subCommand beginning with '-' is perceived as non-boolean flag
     * subCommand beginning with '--' is perceived as boolean flag
     * @param {string} message 
     */
    parseCommand: function(message) {
        const booleanFlag = (command) => {
            return command.length > 2 && command[0] === '-' && command[1] === '-';
        };
        const nonBooleanFlag = (command) => {
            return !booleanFlag(command) && command.length >= 2 && command[0] === '-';
        };
        const ret = {
            mainCommand:"",
            flags:{

            },
            args:[],
            err: ""
        };
        const _commands = message.split(' ');
        const commands = [];
        // Merge command, like "a b"
        let index = 0;
        let lastSep = "";
        while (index < _commands.length) {
            commands.push(_commands[index]);
            if ((_commands[index][0] === `'` || _commands[index][0] === `"`) && _commands[index][_commands[index].length - 1] !== _commands[index][0]) {
                lastSep = _commands[index][0];
                do {
                    ++index;
                    commands[commands.length - 1] += " " + _commands[index];
                } while (index < _commands.length && _commands[index][_commands[index].length - 1] !== lastSep);
                if (commands[commands.length - 1][commands[commands.length - 1].length - 1] !== lastSep) {
                    ret.err = `Mismatched Separator ${lastSep}`;
                    return ret;
                }
            }
            // Exclude Preceding '' or ""
            if (commands[commands.length - 1][0] === `'` || commands[commands.length - 1][0] === `"`) commands[commands.length - 1] = commands[commands.length - 1].slice(1, commands[commands.length - 1].length - 1).trim();
            ++index;
        }
        let lastFlag = "";
        ret["mainCommand"] = commands[0];
        for (let i = 1; i < commands.length; ++i) {
            switch(true){
            case booleanFlag(commands[i]):ret["flags"][commands[i].slice(2)] = true;break;
            case nonBooleanFlag(commands[i]):ret["flags"][commands[i].slice(1)] = "";lastFlag = commands[i].slice(1);break;
            default:
                if (lastFlag == "") ret.args.push(commands[i]);
                else {
                    ret["flags"][lastFlag] = commands[i];
                    lastFlag = "";
                }
            }
        }
        return ret;
    }
}