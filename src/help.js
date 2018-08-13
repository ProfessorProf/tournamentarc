const Discord = require("discord.js");
const sql = require('./sql.js');

// Logic for displaying help topics.
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
                .addField('!taunt name', "Like `!fight`, but if they refuse to fight, they'll lose Glory. Be careful, though - if you lose, you'll lose Glory instead!")
                .addField('!unfight', 'Cancel all your outgoing challenges.')
                .addField('!train', "Begin training! You must lose a fight before you can train. The longer you train, the bigger the jump in power - but after a point, there will be diminishing returns, and after 48 hours, training doesn't help at all. Train hard, and you can always catch up with the strongest fighters!")
                .addField('!journey hours', "Go on a journey! You set the duration in advance, and can't take any actions until it ends. When you return, your power level might increase dramatically!")
                .addField('!help topic', 'Learn more about specific topics.')
                .addField('Private commands', 'For certain informational commands, you can start it with `!!` instead of `!` and it will send the information in a DM.')
                .addField('Available Help Topics', 'config, rank, garden, plants, actions, fusion, nemesis, henchmen, wish');
        } else {
            switch(topic.toLowerCase()) {
                case 'config':
                    output.setDescription('Configuration Commands:')
                        .addField('!config', 'Displays your current config options.')
                        .addField('!config flag value', 'Set a config setting to a value.')
                        .addField('Config Flags:', '**AlwaysPrivate**: Valid values: "on"/"off". Sends messages via DM by default. If you want a specific message to send via DM, preface it with "!!" instead of "!". Commands this works with: check, scan, garden, roster, tournament, config, help. Default: Off.\n' +
                            '**Ping**: Valid values: "on"/"off". Mentions you in the channel when you revive or when someone accepts your challenge. Default: Off.\n' + 
                            '**Pronoun**: Valid values: "he"/"she"/"they". Determines what pronouns the game uses for messages about you. Default: They.');
                    break;
                case 'rank':
                    output.addField('Player Ranks', "Rank is determined by accumulating Glory. Glory is gained by winning battles, especially against foes stronger than yourself. As your Rank increases, you gain access to various new features.")
                        .addField('Rank Thresholds:', `\`\`\`\n
Rank C   50 glory
Rank B   100 glory
Rank A   150 glory
Rank S   250 glory
Rank SS  400 glory
Rank SSS 700 glory
Rank ??? 1000 glory
\`\`\``);
                    break;
                case 'garden':
                    output.addField('Gardening', 'The garden is shared by the whole server - you can grow plants, then harvest them for various special abilities!\nAfter using any gardening command, you must wait an hour before using another. Using !water, !expand, or !research boosts your Garden Level.')
                        .addField('!garden', 'Displays the status of the garden.')
                        .addField('!plant plantname', 'Begin growing a new plant in the garden. If plant name is left out, plants a healing flower.')
                        .addField('!water', 'Water the garden, causing all plants to advance towards being ready. Effect increases based on your gardening level.')
                        .addField('!expand', 'Increase Garden Level, raising the rate that the garden grows plants. Effect increases based on your gardening level.')
                        .addField('!research', 'Requires Rank C. Study new kinds of plants that you can add to the garden! When research reaches 100% and Garden Level is at least 3, a new plant will be discovered and Garden Level will fall by 3.')
                        .addField('!pick plantname', "Pick a plant from the garden. If you don't include a plant name, then you'll pick the one closest to the top of the list.")
                        .addField('!use plant name', 'Use a plant on a player. You must have one in your inventory.');
                    break;
                case 'plants':
                    output.addField('Plants', 'Enter `!help garden` for more info on growing, using and discovering plants.');
                    let garden = await sql.getGarden(channel);
					let plants = garden.plantTypes.filter(t => t.known);
                    for(const i in plants) {
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
                case 'actions':
                    output.setDescription('After using any action command, you must wait an hour before using another. Using !search, !empower, or !overdrive boosts your Action Level.')
                        .addField('!search', 'Searches the world for something mysterious. Rate of success increases based on your action level.')
                        .addField('!empower name', "Requires Rank C. Send another player your energy! Reduces your Power Level, but increases the target's Power Level by the same amount..")
                        .addField('!overdrive', "Requires Rank A. Go beyond the impossible! Increases your Power Level by an amount depending on your Action Level. However, after it ends, your Power Level falls lower than it was before, and using it too often might be dangerous...");
                    break;
                case 'fusion':
                    output.setDescription('Fusion:')
                        .addField('!fuse name fusionname', "Send a fusion offer to another player. Name is their name, fusionname is your proposed name for your fusion. If they offered to fuse already, then you'll combine! Fusion lasts for 24 hours.")
                        .addField('Fusion requirements', 'Must both be Rank B or higher.\nMust both be alive.\nMust not be the Nemesis.\nMust not be a fusion.\nEach player can only fuse once per season.')
                        .addField('Fusion effects', 'Your power level increases dramatically.\nYour action and gardening levels are combined.\nYou need twice as much glory to rank up.\nWish bonuses carry over into the fusion.')
                        .addField('When a Fusion ends', 'You each gain half of the glory you earned while fused.\nYou each gain half of the gardening and action levels you gained while fused.\nYour inventories are split between you at random.');
                    break;
                case 'nemesis':
                    output.setDescription('The Nemesis:')
                        .addField('!nemesis', 'Become the Nemesis, a scourge who terrorize the galaxy! You gain new abilities, but lose access to non-combat actions. Power increases dramatically, but every time you lose a battle your power level falls. Lasts until you are finally defeated.')
                        .addField('Nemesis requirements', 'Must be Rank S or higher.\nMust be alive.\nThere can only be one Nemesis at a time.\nNo Nemesis can appear for 24 hours after a Nemesis is defeated.')
                        .addField('Nemesis effects', "Power level is immense.\nEach time you win a battle, your power level will fall slightly.\nCannot use: !train, !pick, !use, !plant, !expand, !water, !research, !search, !overdrive, !empower, !fuse, !scan.\nCan use: !attack, !destroy, !burn, !recruit, !exile, !energize, !revive.\nCan wish for ruin.\nCan't wish for anything other than ruin.")
                        .addField('!recruit name', "Send a player an offer to join your army of evil! If they enter !join, then they'll become one of your henchmen. For more info, enter `!help henchmen`.")
                        .addField('!exile name', 'Fire one of your henchmen! They will go back to being normal players.')
                        .addField('!energize name', "Give a power boost to one of your henchmen! Lasts for 3 hours. Can be used once every 3 hours.")
                        .addField('!revive name', 'Bring one of your fallen henchmen back to life! Can be used once every 24 hours.')
                        .addField('!attack', "Fight another player immediately, whether or not they've issued you a challenge. Can be used once every 3 hours.")
                        .addField('!destroy', 'Destroys a planet, causing damage on a massive scale. Can be used once every 24 hours, requires rank SS or higher.')
                        .addField('!burn', 'Destroys a random garden slot, rendering it unusable for 6 hours. Can be used once every 12 hours.');
                    break;
                case 'henchmen':
                    output.setDescription('Henchmen:')
                        .addField('!join', 'Accept a recruitment offer from the Nemesis, and become one of their henchmen!')
                        .addField('Henchman properties', "When you join the Nemesis, you get a considerable boost to your Power Level.\nThe Nemesis can energize their henchmen, boosting their Power Level even further.\nThe Nemesis can bring fallen henchmen back to life.\nHenchmen have increased chances to find orbs while searching the world.\nIf the Nemesis is attacked, their power is increased for each active henchman.\nEach time a henchman falls in battle, the amount of power they grant to the Nemesis decreases by 20%.\nHenchmen can only use the commands !use, !empower and !give on the Nemesis.")
                    break;
                case 'wish':
                    output.setDescription('Wishes:')
                        .addField('Orbs', "Seven magic orbs are waiting to be found! If you collect all seven, then you can make a wish, giving you incredible powers. You can only make a wish once per game.")
                        .addField('!give', 'Gives one of your magic orbs to another player.')
                        .addField('!wish power', 'Become incredibly powerful! Your Power Level rises dramatically, and you gain a bonus to the results of training until the next season.')
                        .addField('!wish immortality', "Become immortal! No matter how you die, you'll revive in one hour. Lasts until the next season.")
                        .addField('!wish resurrection', 'Raise the dead! All fallen players are instantly revived, and their Power Levels increase by 20%.')
                        .addField('!wish gardening', 'Become the master of gardening! Gardening Level increases by 12.')
                        .addField('!wish ruin', 'Requires rank SS. You must prevent this at any cost.');
                    break;
                default:
                    output.addField('Available Help Topics', 'config, rank, garden, plants, actions, fusion, nemesis, henchmen, wish');
            }
        }

        return output;
    }
}