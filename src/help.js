const Discord = require("discord.js");
const sql = require('./sql.js');

// Logic for displaying help topics.
// TODO: Add help data for plants, actions, fusion, nemesis, henchmen, wish, tournament
// TODO: Update rank help for Glory mechanics
module.exports = {
    async showHelp(channel, topic) {
        let output = new Discord.RichEmbed();
        output.setTitle('Help!')
            .setColor(0x00AE86);

        if(!topic) {
            output.setDescription('Basic Commands:')
                .addField('!reg name', 'Registers a new player! Name must be unique and contain no spaces.')
                .addField('!roster', 'Displays the status and power levels of all active players.')
                .addField('!check', 'Displays your current stats.')
                .addField('!scan name', "Displays another player's power level. However, it's not always right.")
                .addField('!graveyard', "Displays all currently-defeated players.")
                .addField('!history name', 'Displays your battle history with another player.')
                .addField('!fight name', "Challenge someone else to a fight! If they fight you back, you will  clash in a battle of power levels. If you don't include a name, you will send an open challenge to the whole channel to fight.")
                .addField('!unfight', 'Cancel all your outgoing challenges.')
                .addField('!train', "Begin training! You must lose a fight before you can train. The longer you train, the bigger the jump in power - but after a point, there will be diminishing returns, and after 48 hours, training doesn't help at all. Train hard, and you can always catch up with the strongest fighters!")
                .addField('!help topic', 'Learn more about specific topics.')
                .addField('Private commands', 'For certain informational commands, you can start it with `!!` instead of `!` and it will only show you the result.')
                .addField('Available Help Topics', 'config, rank, garden, plants, actions, fusion, nemesis, henchmen, wish, tournament');
        } else {
            switch(topic.toLowerCase()) {
                case 'config':
                    output.setDescription('Configuration Commands:')
                        .addField('!config', 'Displays your current config options.')
                        .addField('!config flag value', 'Set a config setting to a value.')
                        .addField('Config Flags:', 'AlwaysPrivate: Valid values: "on"/"off". Sends messages via DM by default. If you want a specific message to send via DM, preface it with "!!" instead of "!". Commands this works with: check, scan, garden, roster, tournament, config, help. Default: Off.\n' +
                            'PingMe: Valid values: "on"/"off". Pings you in the channel when you revive or when someone accepts your challenge. Default: Off.\n' + 
                            'Pronoun: Valid values: "he"/"she"/"they". Determines what pronouns the game uses for messages about you. Default: They.');
                    break;
                case 'rank':
                    output.addField('Player Ranks', "Rank is determined by the number of battles you've won. This number carries over even when the world is reset.")
                        .addField('Rank Thresholds:', `\`\`\`\n
Rank C   5 wins
Rank B   10 wins
Rank A   15 wins
Rank S   25 wins
Rank SS  40 wins
Rank SSS 70 wins
Rank ??? 100 wins
\`\`\``);
                    break;
                case 'garden':
                    output.addField('Gardening', 'The garden is shared by the whole server - you can grow plants, then harvest them for various special abilities!\nAfter using any gardening command, you must wait an hour before using another. Using !water, !expand, or !research boosts your Garden Level.')
                        .addField('!garden', 'Displays the status of the garden.')
                        .addField('!plant plantname', 'Begin growing a new plant in the garden. If plant name is left out, plants a healing flower.')
                        .addField('!water', 'Water the garden, causing all plants to advance towards being ready. Effect increases based on your gardening level.')
                        .addField('!expand', 'Increase Garden Level, raising the rate that the garden grows plants. Effect increases based on your gardening level.')
                        .addField('!research', 'Requires Rank C. Study new kinds of plants that you can add to the garden! When research reaches 100% and Garden Level is at least 3, a new plant will be discovered and Garden Level will fall by 3.')
                        .addField('!pick plantname', "Pick a plant from the garden. If you don't include a plant name, then you'll plant a flower.")
                        .addField('!use plant name', 'Use a plant on a player. You must have one in your inventory.');
                    break;
                case 'plants':
                    output.addField('Plants', 'Enter `!help garden` for more info on growing, using and discovering plants.');
                    let plants = await sql.getKnownPlants(channel);
                    for(var i in plants) {
                        let p = plants[i];
                        switch(p.id) {
                            case 1:
                                output.addField('Flower (18 hours)', "Easy to grow, the standard plant for beginners. Use to reduce someone's recovery timer by six hours.");
                                break;
                            case 2:
                                output.addField('Rose (24 hours)', "Harder to grow, but more powerful. Use to reduce someone's recovery timer by twelve hours.");
                                break;
                            case 3:
                                output.addField('Carrot (12 hours)', "Good for your eyes. Increases someone's search level for six hours.");
                                break;
                            case 4: 
                                output.addField('Bean (18 hours)', "Magic bean full of energy. Increases someone's power level for one hour.");
                                break;
                            case 5:
                                output.addField('Sedge (6 hours)', "Nitrogen filter for healthier plants. Increases the Garden Level and helps all current plants grow.");
                                break;
                            case 6:
                                output.addField('Fern (12 hours)', "Magic properties conceal power. Hides someone's power level for twelve hours.");
                                break;
                        }
                    }
                    break;
                default:
                    output.addField('Available Help Topics', 'config, rank, garden, plants, actions, fusion, nemesis, henchmen, wish, tournament');
            }
        }

        return output;
    }
}