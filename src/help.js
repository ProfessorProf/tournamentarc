const Discord = require("discord.js");
const sql = require('./sql.js');
const enums = require('./enum.js');

// Logic for displaying help topics.
module.exports = {
    async showHelp(player, topic) {
        let output = new Discord.RichEmbed();
        output.setTitle('Help!')
            .setColor(0x00AE86);

        if(!topic) {
            output.setDescription('To start playing right away, enter `!reg name`! To learn more about a command, enter `!help command`. For more game info:')
                .addField('!help basic', "Help with the game's basic commands: !reg, !check, !config.")
                .addField('!help info', 'Help with informational commands: !check, !scan, !roster, !episode, !graveyard, !history.')
                .addField('!help actions', 'Help with commands related to world actions: !search, !empower, !transform, !filler.')
                .addField('!help garden', 'Help with commands related to the garden: !garden, !expand, !water, !plant, !pick, !use.')
                .addField('!help battle', 'Help with commands related to combat: !fight, !unfight, !taunt, !train, !journey.')
                .addField('!help nemesis', 'Help with commands related to the Nemesis: !nemesis, !recruit, !exile, !attack, !destroy, !burn, !energize, !revive.')
                .addField('!help underlings', 'Help with commands related to underlings: !join, !recruit, !exile.')
                .addField('!help wish', 'Help with commands related to orbs and wishes: !search, !give, !wish.')
                .addField('!help rank', 'Help with Rank, Glory, and how to increase them.')
                .addField('!help arcs', 'Help with the Arc system.')
                .addField('!help tournament', 'Help with commands related to martial arts tournaments.')
                .addField('Private commands', 'For info commands, you can start the command with `!!` instead of `!` ' +
                    'and it will send the information in a DM.')
        } else {
            switch(topic.toLowerCase()) {
                case 'basic':
                    output.setTitle('Help: Basic Commands')
                        .setDescription('To get more info on any command, enter `!help commandname`.')
                        .addField('!reg name', 'Register to start playing the game.')
                        .addField('!config', 'Display or set various configuration flags.')
                        .addField('!check', 'Display information about your character.');
                    break;
                case 'info':
                    output.setTitle('Help: Info Commands')
                        .setDescription('To get more info on any command, enter `!help commandname`.')
                        .addField('!check', 'Display information about your character.')
                        .addField('!scan target', 'Scan another player to learn their basic stats.')
                        .addField('!roster', 'Display basic info on all active players.')
                        .addField('!graveyard', 'Display all defeated players.')
                        .addField('!history', 'Display your battle history.')
                        .addField('episode', 'Display a summary of a past episode.');
                    break;
                case 'config':
                    output.setTitle('Help: Configuration Commands')
                        .addField('!config', 'Displays your current config options.')
                        .addField('!config flag value', 'Set a config setting to a value.')
                        .addField('Config Flags:', '**AlwaysPrivate**: Valid values: "on"/"off". Sends messages via DM by default. If you want a specific message to send via DM, preface it with "!!" instead of "!". ' +
                            'For a list of commands that can be made private, enter `!help info`. Default: Off.\n' +
                            '**Ping**: Valid values: "on"/"off". Mentions you when various important events happen related to your character. Default: Off.\n' + 
                            '**AutoTrain**: Valid Values: "on"/"off". When active, you will automatically start training whenever you come back from a defeat. Default: On.\n' +
                            '**Pronoun**: Valid values: "he"/"she"/"they". Determines what pronouns the game uses for messages about you. Default: They.');
                    break;
                case 'rank':
                    output.setTitle('Help: Player Ranks');
                    output.setDescription("Rank is determined by accumulating Glory. Glory is gained by winning battles, especially against foes stronger than yourself. As your Rank increases, you gain access to various new features.")
                        .addField('Rank Thresholds:', `\`\`\`\n
Rank C   50 Glory
Rank B   100 Glory
Rank A   150 Glory
Rank S   250 Glory
Rank S+  400 Glory
Rank S++ 700 Glory
Rank ??? 1000 Glory
\`\`\``);
                    break;
                case 'garden':
                    if(player && player.isNemesis) {
                        output.setTitle('Help: The Garden')
                            .setDescription('The garden is shared by the whole server - you can grow plants, then harvest them for various special abilities!\n' +
                                'After using most gardening commands, you must wait three hours before using another.\n' +
                                'Enter `!help plants` for more info on available plant types.')
                            .addField('!garden', 'Display info about the garden.')
                            .addField('!plant', 'Plant a new plant in the garden.')
                            .addField('!pick', 'Pick a finished plant from the garden.');
                    } else {
                        output.setTitle('Help: The Garden')
                            .setDescription('The garden is shared by the whole server - you can grow plants, then harvest them for various special abilities!\n' +
                                'Each player gets one personal garden slot, and you can expand garden size to add new slots anyone can use.\n' +
                                'After using most gardening commands, you must wait an hour before using another.\n' +
                                'Watering plants or expanding the garden boosts your Garden Level.\n' +
                                'Enter `!help plants` for more info on available plant types.')
                            .addField('!garden', 'Display info about the garden.')
                            .addField('!plant', 'Plant a new plant in the garden.')
                            .addField('!pick', 'Pick a finished plant from the garden.')
                            .addField('!expand', "Improve the garden's overall attributes.")
                            .addField('!water', 'Water all plants in the garden.')
                            .addField('!use plantname target', 'Use a plant on someone.');
                    }
                    break;
                case 'plants':
                    output.setTitle('Help: Plants')
                    output.setDescription('Enter `!help garden` for more info on growing, using and discovering plants.');
                    if(player && player.isNemesis) {
                        output.addField('Zlower (3 hours)', 'Dark plant available only to the Nemesis. Spawns a plant underling that periodically send the Nemesis energy.')
                        output.addField('Zarrot (3 hours)', 'Dark plant available only to the Nemesis. Spawns a plant underling that periodically search for orbs.')
                        output.addField('Zedge (3 hours)', 'Dark plant available only to the Nemesis. Spawns a plant underling that periodically decays all plants in the garden.')
                        output.addField('Zeach (12 hours)', 'Dark plant available only to the Nemesis. Spawns a plant underling that stops the Nemesis from losing power in battle.')
                    } else {
                        let garden = await sql.getGarden(player.channel);
                        let plants = garden.plantTypes.filter(t => t.known);
                        for(const i in plants) {
                            let p = plants[i];
                            switch(p.id) {
                                case enums.Items.Flower:
                                    output.addField('Flower (18 hours)', "Easy to grow, the standard plant for beginners. Use to reduce someone's recovery timer by six hours.");
                                    break;
                                case enums.Items.Rose:
                                    output.addField('Rose (24 hours)', "Harder to grow, but more powerful. Use to reduce someone's recovery timer by twelve hours.");
                                    break;
                                case enums.Items.Carrot:
                                    output.addField('Carrot (12 hours)', "Good for your eyes. Increases someone's search level for six hours.");
                                    break;
                                case enums.Items.Bean: 
                                    output.addField('Bean (18 hours)', "Magic bean full of energy. Increases someone's power level for one hour.");
                                    break;
                                case enums.Items.Sedge:
                                    output.addField('Sedge (6 hours)', "Nitrogen filter for healthier plants. Increases the Garden Level and helps all current plants grow.");
                                    break;
                                case enums.Items.Fern:
                                    output.addField('Fern (12 hours)', "Magic properties conceal power. Hides someone's power level for twelve hours.");
                                    break;
                                case enums.Items.Gourd:
                                    output.addField('Gourd (18 hours)', "Distorts time and boosts your motivation. Instantly adds an hour to your training time.");
                                    break;
                                case enums.Items.Peach:
                                    output.addField('Peach (36 hours)', "Gain a glimpse of the eternal. For six hours, grants immortality.");
                                    break;
                            }
                        }
                    }
                    break;
                case 'battle':
                    output.setTitle('Help: Battle')
                        .setDescription('To get more info on any command, enter `!help commandname`.')
                        .addField('!fight target', 'Challenge a player to a battle.')
                        .addField('!taunt target', 'Challenge a player to a battle with Glory at stake.')
                        .addField('!unfight', 'Cancel all outgoing battle challenges.')
                        .addField('!train', 'Begin training to increase your power level.')
                        .addField('!journey hours', 'Go on a long journey to hone your skills.')
                        .addField('!selfdestruct', 'Sacrifice yourself to defeat a powerful foe.');
                    break;
                case 'actions':
                    output.setTitle('Help: World Actions')
                        .setDescription('After using any action command, you must wait an hour before using another. Using any Action boosts your Action Level.')
                        .addField('!search', 'Seek out interesting things in the world.')
                        .addField('!empower', 'Send another player your energy.')
                        .addField('!transform', 'Unleash your true power.')
                        .addField('!filler', 'Engage in a relaxing filler episode.')
                        .addField('!steal itemname target', 'Attempt to steal an item from an evil player.');
                    break;
                case 'fusion':
                    output.setDescription('Fusion:')
                        .addField('!fuse name fusionname', "Send a fusion offer to another player. Name is their name, fusionname is your proposed name for your fusion. If they offered to fuse already, then you'll combine! Fusion lasts for 24 hours.")
                        .addField('Fusion requirements', 'Must both be Rank B or higher.\nMust both be alive.\nMust not be the Nemesis.\nMust not be a fusion.\nEach player can only fuse once every 7 days.')
                        .addField('Fusion effects', 'Your power level increases dramatically.\nYour action and gardening levels are combined.\nYou need twice as much glory to rank up.\nWish bonuses carry over into the fusion.')
                        .addField('When a Fusion ends', 'You each gain half of the glory you earned while fused.\nYou each gain half of the gardening and action levels you gained while fused.\nYour inventories are split between you at random.');
                    break;
                case 'nemesis':
                    output.setDescription('The Nemesis:')
                        .addField('!nemesis', 'Become the Nemesis, a scourge who terrorize the galaxy! You gain new abilities, but lose access to non-combat actions. Power increases dramatically, and the whole server must band together to defeat you.')
                        .addField('Nemesis requirements', 'Must be Rank S or higher.\nMust be alive.\nThere can only be one Nemesis at a time.\n' +
                            "You can't have two Nemesis Arcs in a row.\nNo Nemesis can appear during an Orb Hunt or Tournament Arc.")
                        .addField('Nemesis effects', "Power level is immense.\n" +
                            "Each time you win a battle, your power level will fall slightly. The harder the enemy fights, the more they'll weaken you.\n" +
                            "Anyone can fight you, even without a challenge.\n" +
                            "When you defeat someone, they'll remain defeated for 12 hours." +
                            "Can recruit underlings.\n" +
                            "Cannot upgrade the garden.\n" +
                            "Cannot use: !train, !pick, !use, !water, !search, !transform, !empower, !fuse, !scan.\n" + 
                            "Can use: !attack, !destroy, !burn, !recruit, !exile, !energize, !revive.\n" +
                            "Can't make normal wishes.\n" + 
                            "Can make Nemesis wishes.")
                        .addField('Nemesis-only commands:', '!recruit: Ask a player to join you as an underling.\n' +
                            '**!exile**: Fire an underling.\n' +
                            '**!energize**: Power up an underling.\n' +
                            '**!revive**: Resurrect a defeated underling.\n' +
                            "**!attack**: Fight a player, even if they haven't challenged you.\n" +
                            '**!destroy**: Destroy a planet.\n' +
                            '**!burn**: Attack the garden.');
                    break;
                case 'underling':
                case 'underlings':
                    output.setDescription('Underlings:')
                        .addField('!join', 'Accept a recruitment offer from the Nemesis, and become one of their underlings!')
                        .addField('Underling properties', "When you join the Nemesis, you get a considerable boost to your Power Level.\n" +
                            "The Nemesis can energize their underlings, boosting their Power Level even further.\n" +
                            "The Nemesis can bring fallen underlings back to life.\nUnderlings have increased chances to find orbs while searching the world.\n" +
                            "If the Nemesis is attacked, their power is increased for each active underling.\n" +
                            "Each time an underling falls in battle, their power increases, but the amount of power they grant to the Nemesis decreases by 20%.\n" +
                            "Underlings can only use the commands !use, !empower and !give on the Nemesis.");
                    break;
                case 'wish':
                    output.setTitle('Help: Wishes')
                        .setDescription("Seven magic orbs are waiting to be found! If you collect all seven, then you can make a wish, giving you incredible powers. " +
                            "You can only make a wish once every seven days, and after you do, the orbs are lost again. After someone makes a wish, the orbs are harder to find for three days.")
                        .addField('!give', "Gives one of your magic orbs to another player. You can only do this if you've already used up your wish, or if you're an underling.")
                        .addField('!steal itemname target', 'Attempt to steal an item from an evil player.')
                        .addField('!wish power', 'Become incredibly powerful! Your Power Level increases dramatically, and you gain a huge bonus to your Latent Power.')
                        .addField('!wish immortality', "Become immortal! No matter how you die, you'll revive in one hour. Lasts until the next season.")
                        .addField('!wish resurrection', 'Raise the dead! All fallen players are instantly revived, and their Power Levels increase by 20%.')
                        .addField('!wish gardening', 'Become the master of gardening! Gardening Level increases by 12.')
                        .addField('!wish ruin', 'Requires rank S+. Only the Nemesis can make this wish. Prevent this at any cost.')
                        .addField('!wish snap', 'Requires rank S+. Only the Nemesis can make this wish. Prevent this at any cost.')
                        .addField('!wish games', 'Requires rank S+. Only the Nemesis can make this wish. Prevent this at any cost.');
                    break;
                case 'tournament':
                    output.setTitle('Help: Tournaments')
                        .setDescription("Thrilling battle tournaments, organized by players, with glory and treasure as the stakes!")
                        .addField('!tourney', "Also accepts `!tournament`. Displays the status of the current tournament.")
                        .addField('!tourney single', "Begin recruiting players for a single-elimination tournament. A new tournament can only start when it's been 24 hours since the last tournament.\n" +
                            "Once a single elimination tournament starts, each round lasts for 24 hours or until every match in the round is resolved.")
                        .addField('!tourney join', "Sign up for a tournament that's recruiting for players. A tournament requires at least four players, but can't have more than sixteen.")
                        .addField('!tourney start', "Start the tournament with the current set of players!");
                case 'arcs':
                    output.setTitle('Help: Arcs')
                        .setDescription("The flow of the game is now divided into different kinds of arcs! Depending on the current arc, certain actions may be prohibited.")
                        .addField('Filler Arc', "Nothing special. A new arc will begin based on your actions!")
                        .addField('Orb Hunt Arc', "Once the third orb is found, an Orb Hunt Arc begins! Nemesis and Tournament actions are blocked until someone gathers the orbs and makes a wish. " +
                            "If you gather all seven, you can make a wish or you can start a tournament with the orbs as the prize!")
                        .addField('Nemesis Arc', "A nemesis rises to menace the galaxy! Tournament actions are blocked until the Nemesis is defeated or makes a wish.")
                        .addField('Tournament Arc', "Fight to determine the strongest! A Nemesis can't rise and orbs can't be found until the tournament ends.")
                        .addField('??? Arc', "There may be other kinds of arcs yet to be discovered...");
                default:
                    if(this.addHelpField(output, topic)) {
                        return output;
                    } else {
                        output.addField('Available Help Topics', 'config, rank, garden, plants, actions, fusion, nemesis, underlings, wish');
                    }
                    break;
            }
        }

        return output;
    },
    addHelpField(embed, topic) {
        switch(topic.toLowerCase()) {
            case 'reg':
                embed.addField('!reg charactername', 'Registers a new player with the name "charactername".\n' +
                    'Requirements: Character name required. Must not have a character registered on this channel. Name must not contain spaces.');
                break;
            case 'check':
                embed.addField('!check', 'Displays info about your character - current power level, Glory, action levels, status, offers, and cooldowns. Usable by anyone.\n' +
                    'Requirements: Must be registered.');
                break;
            case 'scan':
                embed.addField('!scan target', 'Displays basic info about a character - current Power Level, training time. Usable by anyone.\n' +
                    'If the target is training, then it will estimate their power level, but the number may be wrong.\n' +
                    'Requirements: Must be registered.');
                break;
            case 'roster':
                embed.addField('!roster', 'Displays basic info about all - current Power Level, Rank, status. Usable by anyone.');
                break;
            case 'fight':
                embed.addField('!fight target', "Challenges another player to a fight! If the player has already challenged you, " +
                    "a battle will begin, and the loser will be taken out for a few hours. If you don't specify a target, then you'll deliver an open challenge to fight anyone in the channel.\n\n" +
                    "Factors towards who wins a battle:\nThe higher Power Level usually wins.\n" +
                    "If you're attacking the Nemesis, their underlings will boost their power.\n" +
                    "If you lose to someone repeatedly, you'll fight harder when fighting them in the future.\n" +
                    "You'll fight harder when facing the Nemesis or their underlings.\n\n" +
                    "Requirements: Must be registered. Target name must be a player in this channel. You and the target must both be alive.");
                break;
            case 'taunt':
                embed.addField('!taunt target', "Challenges another player to a fight, and shames them if they decline!\n" +
                    "If the target ignores the taunt for six hours, then they'll lose Glory. If they accept, and fight you, then *you'll* lose Glory.\n" +
                    "Requirements: Must be registered. You can only have one outstanding taunt at a time. Multiple people can't taunt the same target.");
                break;
            case 'unfight':
                embed.addField('!unfight', "Cancels all your outgoing fight offers or taunts.\n" +
                    "Requirements: Must be registered. Must have challenged someone to a fight. If you're the Nemesis, you can only unfight taunts.");
                break;
            case 'attack':
                embed.addField('!attack target', "Attack a player without warning, forcing a battle even if they haven't challenged you.\n" +
                    "Requirements: Must be the Nemesis. Target must be alive. Can only be used once every 3 hours.");
                break;
            case 'destroy':
                embed.addField('!destroy', "Destroys a planet, killing multiple players at once. " +
                    "The larger the channel, the more people this will take out.\n" +
                    "Anyone affected will be defeated for 12 hours, and any orbs they have will be lost.\n" +
                    "Requirements: Must be the Nemesis. Can only be used once every 24 hours.");
                break;
            case 'burn':
                embed.addField('!burn', "Attacks the Garden, destroying a random plant within it.\n" +
                    "Requirements: Must be the Nemesis. Can only be used once every 12 hours.");
                break;
            case 'recruit':
                embed.addField('!recruit target', "Sends someone an offer to join you as an underling. " +
                    "The name can be omitted, in which case you'll send an open invite to anyone in the channel to join you.\n" +
                    "The number of underlings you can have is based on the largest number of players who have been online at once - " +
                    "one underling at ten players, and one more for each five.\n" +
                    "Requirements: Must be the Nemesis. Must not be at the underling cap.");
                break;
            case 'join':
                embed.addField('!join', "Accepts an offer to join the Nemesis. For more information, enter `!help underlings`.");
                break;
            case 'exile':
                embed.addField('!exile', "Exiles an underling, turning them back into a normal player. Any benefits they gained from being your underling are lost.\n" +
                    "Requirements: Must be the Nemesis. Target must be an underling.");
                break;
            case 'energize':
                embed.addField('!energize target', "Imbues an underling with power, boosting their power level by 30% for 3 hours.\n" +
                    "Requirements: Must be the Nemesis. Target must be an underling. Can only be used once every 3 hours.");
                break;
            case 'revive':
                embed.addField('!revive target', "Resurrects a fallen underling immediately, and increases their power level by 20%.\n" +
                    "Requirements: Must be the Nemesis. Target must be an underling. Can only be used once every 24 hours.");
                break;
            case 'expand':
                embed.addField('!expand type', 'Requires Rank C. Work on upgrading the garden! Amount is based on your Garden Level. ' +
                    "If you try to expand a garden level that's already higher than the other levels, it will advance more slowly.\n" +
                    'Effect is different based on what you put for type:\n' +
                    '**!expand size:** Allows the Garden to hold more plants at a time.\n' +
                    '**!expand growth:** Makes all plants in the garden grow faster. Max is 10 slots.\n' +
                    '**!expand research:** Unlocks new types of plants to plant.\n');
                break;
            case 'plant':
                embed.addField('!plant type', 'Adds a plant to the garden. When it finishes growing, you can then use `!pick type` to collect it. ' +
                    'However, a given player can only have one plant growing in the garden at a time.\n' +
                    'Requirements: Must be registered. Must be an empty space in the garden.');
                break;
            case 'water':
                embed.addField('!water', 'Advances every plant in the garden a little bit closer to being ready to pick.\n' +
                    'Effect is increased by your Gardening Level, and decreased by the size of the garden.\n' +
                    'Requirements: Must be registered. Must have your gardening action ready. Must be at least one plant in the garden.');
                break;
            case 'pick':
                embed.addField('!pick type', 'Pick a finished plant from the garden, and adds it to your inventory.' +
                    "If you don't specify a type, you'll just pick the first plant you see. " +
                    'Requirements: Must be registered. Specified plant must be ready to pick.');
                break;
            case 'use':
                embed.addField('!use type target', 'Use a plant in your inventory on someone! Effect depends on the type of plant.\n' +
                    "Requirements: Must be registered. Must have the plant in your inventory. Must not be defeated.");
                break;
            case 'train':
                embed.addField('!train', "Begin training! The longer you train, the stronger you'll be when you finish." +
                    " However, there's a certain degree of diminishing returns - after 16 hours, training gains slow down, " +
                    "and after 72 hours, training gains stop completely.\n" +
                    "Requirements: Must be registered. Must be alive. Must have lost a battle since last time you trained.");
                break;
            case 'journey':
                embed.addField('!journey hours', "Embark on a training journey! You specify the length of the journey in advance," +
                    " and you can't take any actions until the journey ends. Others can't interact with you, either, aside from the most extreme circumstances.\n" +
                    "When you return from your journey, your power will increase dramatically! It's the same as normal training, but the effect is anywhere from 80% to 180% of normal.\n" +
                    "Requirements: Must qualify for !train. Can't journey for more than 24 hours. Can't journey while carrying orbs. Must wait at least 12 hours between journeys.");
                break;
            case 'return':
                embed.addField('!return', "Ends your journey instantly, abandoning all rewards for it.\n" +
                    "Requirements: Must be on a journey. The universe must be in great peril.");
                break;
            case 'search':
                embed.addField('!search', "Search the world for something interesting! " +
                    "Maybe you'll find an orb, maybe you'll find some plants, maybe you'll find nothing... or maybe you'll find a real surprise.\n" +
                    "Modifiers to the chance of finding something:\n" +
                    "Each Action Level increases chances by 1 percentage point.\n" +
                    "If you've eaten a carrot, your chances are increased.\n" +
                    "If you're an Underling, your chances are increased.\n" +
                    "If the Nemesis is at large, your chances are increased.\n" +
                    "Requirements: Must be registered. Must not have used any world actions in the past hour.");
                break;
            case 'event':
                embed.addField('!event', "Engages with the current event, if there is one. Use `!world` to check for events.\n" +
                    "Requirements: Must be registered. Must be alive. Must have your world action ready. Must be an event going on.");
                break;
            case 'transform':
                embed.addField('!transform', "Go beyond your limits and assume a new, more powerful temporary form! " +
                    "While transformed, your power level spikes dramatically, but once it ends, you'll collapse, and be unable to fight for a few hours. " +
                    "The duration of the transformation is based on your Action Level, and its strength is based on your Latent Power. " +
                    "Requirements: Must be registered. Must not have used any world actions in the past hour. Must be Rank A or above. Must not be the Nemesis.");
                break;
            case 'empower':
                embed.addField('!empower target', "Send someone your energy, raising their power level permanently! " +
                    "Amount is the lower of 10% of your power level and 25% of the target's power level. Your power level permanently falls by the same amount.\n" +
                    "Requirements: Must be registered. Must not have used any world actions in the past hour. Must be Rank C or above.");
                break;
            case 'give':
                embed.addField('!give itemtype target', "Give one item to someone else!\n" +
                    "Requirements: Must be registered. Must have the item. You and the target must both be alive. " +
                    "If giving orbs, must either be an underling or have already used your wish for this week. " + 
                    "If you're an underling, you can only give orbs to the Nemesis.");
                break;
            case 'steal':
                embed.addField('!steal itemtype target', "Attempt to steal an item from an enemy player!\n" +
                    "If you succeed, the item will be yours. However, if you get caught, you'll be thrust into a fight, and your power will be reduced. " +
                    "The chance of success is slim, but the stronger your foe, the more likely they are to overlook you.\n" +
                    "Requirements: Must be alive. Must have a world action ready. Target must be an Underling or the Nemesis.");
                break;
            case 'world':
                embed.addField('!world', "Displays basic info about the world - age, countdown timers, how many orbs are still in hiding. Can be used by anyone.");
                break;
            case 'scores':
                embed.addField('!score', "Displays the top ten greatest warriors of the previous season, sorted by Glory. Can be used by anyone, but only after the season ends.");
                break;
            case 'selfdestruct':
                embed.addField('!selfdestruct target', "Uses all of your remaining life force for one last fight. " +
                    "Your power is increased massively, but you won't come back from this one with a simple rest...\n" +
                    "**Do not use this command unless you are comfortable with being gone for a long time!**\n" +
                    "Requirements: Must be Rank A. Must be alive. Target must be alive. Must not be the Nemesis.");
                break;
            case 'filler':
                embed.addField('!filler target', "Creates a randomized filler episode! If you specify a target, they'll be " +
                    "involved in the episode as well. If any of the named players are injured, their timers will " +
                    "fast forward by a few minutes.");
                break;
            case 'episode':
                embed.addField('!episode number', "Shows the air date and summary of a specific episode.");
                break;
            default:
                return false;
        }
        return true;
    }
}