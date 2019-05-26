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
                .addField('!help info', 'Help with informational commands: !check, !fighter, !fighters, !players, !next, !tournament.')
                .addField('!help actions', 'Help with other commands: !aid, !bet, !give.')
                .addField('!help battle', 'Help with the mechanics of combat.')
                .addField('Private commands', 'For info commands, you can start the command with `!!` instead of `!` ' +
                    'and it will send the information in a DM.')
        } else {
            switch(topic.toLowerCase()) {
                case 'basic':
                    output.setTitle('Help: Basic Commands')
                        .setDescription('To get more info on any command, enter `!help commandname`.')
                        .addField('!reg name', 'Register to start playing the game.')
                        .addField('!config', 'Display or set various configuration flags.')
                        .addField('!check', 'Display information about yourself.');
                    break;
                case 'actions':
                    output.setTitle('Help: Actions')
                        .setDescription('To get more info on any command, enter `!help commandname`.')
                        .addField('!bet name amount', `Bet coins on a fighter's victory.`)
                        .addField('!aid name amount', `Invest coins in a fighter's training.`)
                        .addField('!give name amount', `Give coins to another player.`);
                    break;
                case 'info':
                    output.setTitle('Help: Info Commands')
                        .setDescription('To get more info on any command, enter `!help commandname`.')
                        .addField('!check', 'Display information about yourself.')
                        .addField('!fighter', 'Display information about a fighter.')
                        .addField('!fighters', 'Display basic info on all fighters.')
                        .addField('!players', 'Display basic info on all active players.')
                        .addField('!next', 'Display information on the fighters in the next match.')
                        .addField('!tournament', 'Display the current tournament status.')
                        .addField('!bet', 'Display betting info on the next match.');
                    break;
                case 'config':
                    output.setTitle('Help: Configuration Commands')
                        .addField('!config', 'Displays your current config options.')
                        .addField('!config flag value', 'Set a config setting to a value.')
                        .addField('Config Flags:', '**AlwaysPrivate**: Valid values: "on"/"off". Sends messages via DM by default. If you want a specific message to send via DM, preface it with "!!" instead of "!". ' +
                            'For a list of commands that can be made private, enter `!help info`. Default: Off.\n' +
                            '**Ping**: Valid values: "on"/"off". Mentions you when various important events happen related to your character. Default: Off.\n' + 
                            '**Pronoun**: Valid values: "he"/"she"/"they". Determines what pronouns the game uses for messages about you. Default: They.');
                    break;
                case 'battle':
                    output.setTitle('Help: Battle')
                        .setDescription('Battles will occur automatically between fighters in the tournament. Each minute, each fighter ' +
                            'will make an attempt to attack the other, and whoever wins will score one or two points. A match ends at three points.')
                        .addField('Battle Power', 'Each attack will have a specific Battle Power. This is based on strength, mood, and other hidden factors, ' +
                            'plus a random value between 1 and 20.\n' +
                            'If the difference in battle power is 0-1, nobody scores a point.\n' +
                            'If the difference in battle power is 2-9, the winner scores one point.\n' +
                            'If the difference in battle power is 10 or more, the winner scores two points.')
                        .addField('Battle Factors', "The basic modifier to Battle Power is the fighter's strength. However, there are many other factors:\n" +
                            "A fighter in a good mood will fight harder than one in a bad mood.\n" +
                            "Some fighting styles are extra effective against certain other fighting styles, resulting in a power boost.\n" +
                            "A fighter's relationship with their opponent will affect their battle power.")
                        .addField('Relationships', "Depending on a fighter's relationiship with their opponent, they may become stronger or weaker.\n" +
                            "**Love:** The fighter will be reluctant to go all-out, and their power will be significantly lower. Also, they may come to hate anyone who defeats this fighter.\n" +
                            "**Hate:** The fighter will be eager to attack, and their power will be significantly higher Also, their mood will improve if this fighter loses.\n" +
                            "**Rival:** The fighter will fight hard to surpass their rival, and their power will be slightly higher.\n" +
                            "**Friend:** No effect on combat, but whenever their friend wins a fight, this fighter's mood will improve slightly.");
                    break;
                default:
                    if(this.addHelpField(output, topic)) {
                        return output;
                    } else {
                        output.addField('Available Help Topics', 'basic, info, action, battle');
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
            case 'fighter':
                embed.addField('!fighter', 'Displays info about a fighter: Strength, style, mood, relationships. Usable by anyone.\n' +
                    'Requirements: Must be registered.');
                break;
            case 'players':
                embed.addField('!players', 'Displays basic info about all players - name and current coin count. Usable by anyone.');
                break;
            case 'fighters':
                embed.addField('!fighters', 'Displays basic info about all fighters - strength, gender, style, mood. Usable by anyone.');
                break;
            case 'next':
                embed.addField('!next', 'Displays info about both fighters in the next upcoming match. Usable by anyone.');
                break;
            case 'tourney':
            case 'tournament':
                embed.addField('!tournament/tourney', 'Displays info about the ongoing tournament. Usable by anyone.');
                break;
            case 'bet':
                embed.addField('!bet', 'Displays info about betting odds on the upcoming match.');
                embed.addField('!bet name amount', 'Bet coins on a fighter in the upcoming match.');
                break;
            case 'aid':
                embed.addField('!aid name amount', `Invest coins in a fighter's training, boosting their strength in their next battle.`);
                break;
            case 'give':
                embed.addField('!give name amount', `Give coins to another player`);
                break;
            case 'scores':
                embed.addField('!score', "Displays the top ten richers players of the previous season. Can be used by anyone, but only after the season ends.");
                break;
            default:
                return false;
        }
        return true;
    }
}