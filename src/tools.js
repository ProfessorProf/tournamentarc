const enums = require('./enum.js');
const settings = require('./settings.js');
const numeral = require('numeral');
const sql = require('./sql.js');
const templates = require('./templates.js');
const Discord = require("discord.js");
const hour = (60 * 60 * 1000);

module.exports = {
	// Gets an Embed showing a player's status.
	async getPlayerDescription(player) {
		return this.generatePlayerDescription(player);
	},
	async getPlayerDescriptionById(id) {
		return this.generatePlayerDescription(await sql.getPlayerById(id));
	},
	async generatePlayerDescription(player) {
		if(!player) {
			console.log('Player not found');
			return null;
		}
		let embed = new Discord.RichEmbed();
		embed.setTitle(player.name.toUpperCase())
			.setColor(0x00AE86);

		let stats = '';
		stats += `Coins: ${player.coins}`;
		embed.addField('Stats', stats);

		return embed;
	},
	// Scout a fighter's status.
    async scanFighter(fighter) {
		if(!fighter) {
			console.log('Fighter not found');
			return null;
		}
		const now = new Date().getTime();
		let embed = new Discord.RichEmbed();
		embed.setTitle(`${fighter.name.toUpperCase()}`)
			.setColor(0x00AE86);

		let stats = '';
		stats += `Gender: ${fighter.gender}`;
		stats += `\nMood: ${enums.Moods.Name[fighter.mood]}`;
		stats += `\nStrength: ${fighter.strength}`;
		stats += `\nStyle: ${fighter.style.name}`;
		stats += '\nRecord: 0-0\n';

		for(const r of fighter.relationships) {
			stats += '\n'
			switch(r.type) {
				case enums.Relationships.Love: 
					stats += 'Loves ';
					break;
				case enums.Relationships.Friend: 
					stats += 'Friends with ';
					break;
				case enums.Relationships.Rival: 
					stats += 'Rival of ';
					break;
				case enums.Relationships.Hate: 
					stats += 'Hates ';
					break;
			}
			stats += r.name;
		}

		embed.setDescription(stats);

		return embed;
	},
	async nextFighters(channel) {
		const tournament = await sql.getTournament(channel);
		if(!tournament) return;

		for(let i = 0; i < tournament.fighters.length; i += 2) {
			const leftFighter = tournament.fighters[i];
			const rightFighter = tournament.fighters[i+1];

			if(leftFighter && rightFighter) {
				if(leftFighter.status == enums.TournamentFighterStatuses.Pending) {
					const fighter1 = await sql.getFighterById(leftFighter.id);
					const fighter2 = await sql.getFighterById(rightFighter.id);
					return [await this.scanFighter(fighter1), await this.scanFighter(fighter2)];
				}
			}
		}
	},
	// Converts a time in milliseconds into a readable string.
    getTimeString(milliseconds) {
		if(milliseconds < 0) milliseconds = 0;
        let seconds = Math.ceil(milliseconds / 1000);
        let minutes = Math.floor(seconds / 60);
        seconds -= minutes * 60;
        let hours = Math.floor(minutes / 60);
        minutes -= hours * 60;
        let days = Math.floor(hours / 24);
        hours -= days * 24;
        
        let output = '';
        if(days) {
            output += days + (days > 1 ? ' days' : ' day');
        }
        if(hours) {
            if(output) {
                output += ((seconds || minutes) ? ', ' : ' and ');
            }
            output += hours + (hours > 1 ? ' hours' : ' hour');
        }
        if(minutes) {
            if(output) {
                output += (seconds ? ', ' : ' and ');
            }
            output += minutes + (minutes > 1 ? ' minutes' : ' minute');
        }
        if(seconds) {
            if(output) output += ' and ';
            output += seconds + (seconds > 1 ? ' seconds' : ' second');
        }
        
        return output;
	},
	// Creates a table displaying the name, rank, status and power level of all active players.
    async displayPlayers(channel) {
		let players = await sql.getPlayers(channel);
		const now = new Date().getTime();
		
		// Build the table out in advance so we can get column widths
		let headers = [4, 5];
		let rows = [];
		for(const i in players) {
			let p = players[i];
			if(p.lastActive + 24 * hour < now) {
				continue;
			}

			let row = [];
			row.push(p.name);
			if(p.name.length > headers[0]) headers[0] = p.name.length;
			
			let coins = '' + p.coins;
 			
			row.push(coins);
			if(coins.length > headers[1]) headers[1] = coins.length;
			
			rows.push(row);
		}
		
		// Print out the table
		let output = '';
		output += 'NAME' + ' '.repeat(headers[0] - 3);
		output += 'COINS' + ' '.repeat(headers[1] - 3);
		output += '\n';
		output += '-'.repeat(headers[0]) + ' ';
		output += '-'.repeat(headers[1]) + ' ';
		output += '\n';
		
		for(const i in rows) {
			let row = rows[i];
			output += row[0].padEnd(headers[0] + 1);
			output += row[1].padEnd(headers[1] + 1);
			output += '\n';
			if(output.length > 1950) {
				output += '...\n';
				break;
			}
		}
		
		return `\`\`\`\n${output}\`\`\``;
	},
	// Creates a table displaying the name, rank, status and power level of all active players.
    async displayFighters(channel) {
		let tournament = await sql.getTournament(channel);
		
		// Build the table out in advance so we can get column widths
		let headers = [7, 3, 5, 4];
		let rows = [];
		for(const i in tournament.fighters) {
			const fighter = await sql.getFighterById(tournament.fighters[i].id);
			
			let row = [];

			let name = fighter.name;
			switch(fighter.gender) {
				case 'Male':
					name += ' (♂)';
					break;
				case 'Female':
					name += ' (♀)';
					break;
			}

			row.push(name);
			if(name.length > headers[0]) headers[0] = name.length;
			
			let str = '' + fighter.strength;
			row.push(str);
			if(str.length > headers[1]) headers[1] = str.length;

			row.push(fighter.style.name);
			if(fighter.style.name.length > headers[2]) headers[2] = fighter.style.name.length;
			
			let mood = enums.Moods.Name[fighter.mood];
			row.push(mood);
			if(mood.length > headers[3]) headers[3] = mood.length;
			
			rows.push(row);
		}
		
		// Print out the table
		let output = '';
		output += 'FIGHTER' + ' '.repeat(headers[0] - 6);
		output += 'STR' + ' '.repeat(headers[1] - 2);
		output += 'STYLE' + ' '.repeat(headers[2] - 4);
		output += 'MOOD' + ' '.repeat(headers[3] - 3);
		output += '\n';
		output += '-'.repeat(headers[0]) + ' ';
		output += '-'.repeat(headers[1]) + ' ';
		output += '-'.repeat(headers[2]) + ' ';
		output += '-'.repeat(headers[3]) + ' ';
		output += '\n';
		
		for(const i in rows) {
			let row = rows[i];
			output += row[0].padEnd(headers[0] + 1);
			output += row[1].padEnd(headers[1] + 1);
			output += row[2].padEnd(headers[2] + 1);
			output += row[3].padEnd(headers[3] + 1);
			output += '\n';
			if(output.length > 1950) {
				output += '...\n';
				break;
			}
		}
		
		return `\`\`\`\n${output}\`\`\``;
	},
	// Creates a table displaying the high scores at the end of a game.
    async displayScores(channel) {
		let players = await sql.getPlayers(channel, true);
		
		// Build the table out in advance so we can get column widths
		let headers = [5, 4, 5];
		let place = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
		let rows = [];
		players.sort((a,b) => b.coins - a.coins);
		if(players.length > 10) {
			players = players.slice(0, 10);
		}
		for(const i in players) {
			let p = players[i];

			let row = [];
			row.push(place[i]);
			row.push(p.name);
			let coins = p.coins.toString();
			row.push(coins);
			if(p.name.length > headers[1]) headers[1] = p.name.length;
			if(coins.length > headers[2]) headers[2] = coins.length;

			rows.push(row);
		}
		
		// Print out the table
		let output = '';
		output += 'PLACE' + ' '.repeat(headers[0] - 5);
		output += 'NAME' + ' '.repeat(headers[1] - 3);
		output += 'COINS' + ' '.repeat(headers[2] - 5);
		output += '\n';
		output += '-'.repeat(headers[0]) + ' ';
		output += '-'.repeat(headers[1]) + ' ';
		output += '-'.repeat(headers[2]) + ' ';
		output += '\n';
		
		for(const i in rows) {
			let row = rows[i];
			output += row[0].padEnd(headers[0] + 1);
			output += row[1].padEnd(headers[1] + 1);
			output += row[2].padEnd(headers[2] + 1);
			output += '\n';
		}
		
		return `\`\`\`\n${output}\`\`\``;
	},
	// Fight between two players.
    async fight(fighter1, fighter2) {
		let channel = fighter1.channel;

		let embed = new Discord.RichEmbed();
		embed.setTitle(`${fighter1.name.toUpperCase()} VS ${fighter2.name.toUpperCase()}`)
			.setColor(0xff8040);

		let prepText = '';
		let power1 = 0;
		let power2 = 0;

		// Get strength
		if(fighter1.strength > fighter2.strength + 4) {
			prepText += `${fighter1.name} has an overwhelming advantage in strength!`;
		} else if(fighter1.strength > fighter2.strength + 1) {
			prepText += `${fighter1.name} has the advantage in strength!`;
		} else if(fighter2.strength > fighter1.strength + 4) {
			prepText += `${fighter2.name} has an overwhelming advantage in strength!`;
		} else if(fighter2.strength > fighter1.strength + 1) {
			prepText += `${fighter2.name} has the advantage in strength!`;
		} else {
			prepText += 'The fighters are equals in strength!';
		}

		power1 = fighter1.strength + fighter1.mood;
		power2 = fighter2.strength + fighter2.mood;

		// Get aid modifiers
		const aid1 = fighter1.aidLevel + 50;
		const aid2 = fighter2.aidLevel + 50;
		const aidBonus1 = Math.floor(aid1/aid2) * 5;
		const aidBonus2 = Math.floor(aid2/aid1) * 5;
		if(aidBonus1 > aidBonus2) {
			prepText += `${fighter1.name} reaps the benefits of ${this.their(fighter1.gender)} special training!`;
			power1 += Math.min(5, aidBonus1 - aidBonus2);
		} else if(aidBonus2 > aidBonus1) {
			prepText += `${fighter2.name} reaps the benefits of ${this.their(fighter2.gender)} special training!`;
			power2 += Math.min(5, aidBonus2 - aidBonus1);
		}

		// Get style modifiers
		const matchup1 = fighter1.style.matchups.find(m => m.id == fighter2.style.id);
		const matchup2 = fighter2.style.matchups.find(m => m.id == fighter1.style.id);
		if(matchup1 && matchup1.effect == enums.MatchupTypes.Strong) {
			prepText += `\n${fighter1.name}'s ${fighter1.style.name} Style is effective against ${fighter2.name}'s ${fighter2.style.name} Style!`;
			power1 += 4;
		} else if(matchup2 && matchup2.effect == enums.MatchupTypes.Strong) {
			prepText += `\n${fighter2.name}'s ${fighter2.style.name} Style is effective against ${fighter1.name}'s ${fighter1.style.name} Style!`;
			power2 += 4;
		}

		// Get relationship modifiers
		const relationship1 = fighter1.relationships.find(r => r.id == fighter2.id);
		const relationship2 = fighter2.relationships.find(r => r.id == fighter1.id);

		if(relationship1) {
			switch(relationship1.type) {
				case enums.Relationships.Love:
					prepText += `\n${fighter1.name} is reluctant to go all out against ${fighter2.name}...`;
					power1 -= 4;
					break;
				case enums.Relationships.Hate:
					prepText += `\n${fighter1.name} swears that ${this.they(fighter1.gender)} will defeat ${fighter2.name}!`;
					power1 += 4;
					break;
				case enums.Relationships.Rival:
					prepText += `\n${fighter1.name} is determined to beat ${this.their(fighter1.gender)} rival!`;
					power1 += 2;
					break;
			}
		}

		if(relationship2) {
			switch(relationship2.type) {
				case enums.Relationships.Love:
					prepText += `\n${fighter2.name} is reluctant to go all out against ${fighter1.name}...`;
					power2 -= 4;
					break;
				case enums.Relationships.Hate:
					prepText += `\n${fighter2.name} swears that ${this.they(fighter2.gender)} will defeat ${fighter1.name}!`;
					power2 += 4;
					break;
				case enums.Relationships.Rival:
					prepText += `\n${fighter2.name} is determined to beat ${this.their(fighter2.gender)} rival!`;
					power2 += 2;
					break;
			}
		}

		embed.addField('Get Ready...', prepText);
		
		// Final battle scores!
		const score1 = Math.max(0, power1 + this.roll());
		const score2 = Math.max(0, power2 + this.roll());
		
		// Determine winner - fighters[0] defeats fighters[1]
		let fighters = [];
		if(score1 > score2) {
			fighters = [fighter1, fighter2];
			scores = [score1, score2];
		} else {
			fighters = [fighter2, fighter1];
			scores = [score2, score1];
		}

		let difference = scores[0] - scores[1];
		
		let battleLog = '';
		battleLog += `${fighter1.name} Battle Power: ${score1}\n${fighter2.name} Battle Power: ${score2}\n\n`
		if(difference < 2) {
			battleLog += `Neither fighter is able to gain ground...`;
		} else if(difference < 10) {
			battleLog += `${fighters[0].name} lands a direct hit on ${fighters[1].name} for 1 point!`;
		} else {
			battleLog += `${fighters[0].name} inflicts a critical strike on ${fighters[1].name} for 2 points!`;
		}

		embed.addField('Ready? Fight!', battleLog);
	
		const outcome = await this.handleFightOutcome(channel, fighters[0], fighters[1], scores[0], scores[1]);
		if(outcome) {
			embed.addField('Results', outcome);
		}

		return embed;
	},
	// Process updates based on who won and lost a fight.
	async handleFightOutcome(channel, winner, loser, winnerScore, loserScore) {
		const tournament = await sql.getTournament(channel);

		let output = await this.tournamentMatch(tournament, winner, loser, winnerScore - loserScore);
		
		// Save changes
		await sql.setFighter(loser);
		await sql.setFighter(winner);
		
		return output;
	},
	// Reset the universe.
	async resetData(channel) {
		const now = new Date().getTime();
		await sql.resetWorld(channel);
		let players = await sql.getPlayers(channel, true);
		for(const i in players) {
			let player = players[i];
			if(this.isFusion(player)) {
				await sql.deletePlayer(player.id);
			} else {
				player.coins = 100;
				player.lastActive = now - 24 * hour;
				await sql.setPlayer(player);
			}
		}

		return 'Onwards, to a new adventure...! All coins and player status has been reverted.';
	},
	// Register a new player.
	async registerPlayer(channel, username, userId, name) {
		let output = [];
		let world = await sql.getWorld(channel);
		const now = new Date().getTime();
		let player = {
			name: name,
			username: username,
			userId: userId,
			channel: channel,
			coins: 100
		};
		await sql.setPlayer(player);
		console.log(`Registered ${username} as ${name}`);
		output.push(`Registered player ${name}!`);
		output.push(await this.getPlayerDescription(await sql.getPlayerByUsername(channel, username), username, false));

		return output;
	},
	async updatePlayerActivity(channel, lastUpdate) {
		let world = await sql.getWorld(channel);
		let players = await sql.getPlayers(channel);
		const now = new Date().getTime();
		let messages = [];

		let activePlayers = 0;
		for(const i in players) {
			const p = players[i];
			
			if(p.lastActive > now) {
				p.lastActive = now;
				await sql.setPlayer(p);
			}

			if(p.lastActive + 24 * hour > now) {
				// Player is active
				activePlayers++;
				if(p.lastActive + 23 * hour < now &&
				   p.lastActive + 23 * hour > lastUpdate) {
					messages.push(`${p.name} will idle out in 1 hour.`);
				}
			} else if(p.lastActive + 24 * hour > lastUpdate) {
				// Player has become inactive
				console.log(`${p.name} logged idle; last activity recorded at ${new Date(p.lastActive).toLocaleString('en-US')}`);
			}
		}

		if(activePlayers > world.population) {
			console.log(`Updating world max active population for ${activePlayers} active players`);
			world.population = activePlayers;
		}
		await sql.setWorld(world);

		return messages;
	},
	async updateTournament(channel) {
		const now = new Date().getTime();
		let tournament = await sql.getTournament(channel);
		if(tournament && now > tournament.nextAttack) {
			if(tournament.status == enums.TournamentStatuses.Complete) {
				// Start the new tournament
				return this.startTournament(channel);
			} else {
				// Find the next match
				for(let i = 0; i < tournament.fighters.length; i += 2) {
					const leftFighter = tournament.fighters[i];
					const rightFighter = tournament.fighters[i+1];

					if(leftFighter && rightFighter && leftFighter.status == enums.TournamentFighterStatuses.Pending) {
						// Fight!
						return await this.fight(await sql.getFighterById(leftFighter.id), await sql.getFighterById(rightFighter.id));
					}
				}
			}
		}
	},
	// Process updating passive changes in the world - offers and statuses expiring, garden updating, etc.
	async updateWorld(channel) {
		const now = new Date().getTime();
		let world = await sql.getWorld(channel);
		if(!world) {
			return {embed: null, abort: false, pings: []};
		}

		let messages = [];
		let pings = [];
		let abort = false;

		if(world.startTime && world.startTime < now) {
			messages = messages.concat(await this.updatePlayerActivity(channel, world.lastUpdate, pings));
			messages = messages.concat(await this.updateTournament(channel, world.lastUpdate, pings));
		}

		await sql.setUpdateTime(channel);
		
		// Combine single-line messages
		const lineUpdates = messages.filter(m => m && (typeof m == 'string' || m instanceof String));
		const embedUpdates = messages.filter(m => m && (typeof m == 'object' || m instanceof Discord.RichEmbed) && !m.target);

		if(lineUpdates.length > 0) {
			let embed = new Discord.RichEmbed();
			embed.setTitle('Status Update')
				.setColor(0x00AE86)
				.setDescription(lineUpdates.join('\n'));
			embedUpdates.push(embed);
		}

		return {updates: embedUpdates, abort: abort, pings: pings.join(', ')};
	},
	async config(player, configFlag, value) {
		if(configFlag) {
			// Update the config
			switch(configFlag.toLowerCase()) {
				case 'alwaysprivate':
					player.config.AlwaysPrivate = this.readConfigBoolean(value, player.config.AlwaysPrivate);
					break;
				case 'ping':
					player.config.Ping = this.readConfigBoolean(value, player.config.Ping);
					break;
				case 'pronoun':
					if(value.toLowerCase() == 'he') {
						player.config.Pronoun = 'he';
					} else if(value.toLowerCase() == 'she') {
						player.config.Pronoun = 'she';
					} else {
						player.config.Pronoun = 'they';
					}
					break;
			}
		}

		await sql.setPlayer(player);
		return this.displayConfig(player);
	},
	async displayConfig(player) {
		let embed = new Discord.RichEmbed();
		const config = player.config;
		embed.setTitle(`${player.name} Config`)
			.setColor(0x00AE86);
		let output = `AlwaysPrivate: ${config.AlwaysPrivate ? 'On' : 'Off'}\n`;
		output += `Ping: ${config.Ping ? 'On' : 'Off'}\n`;
		output += `Pronoun: ${config.Pronoun}`;
		embed.setDescription(output);

		return embed;
	},
	readConfigBoolean(value, oldValue) {
		const v = value ? value.toLowerCase() : null;
		if(v == 'off' || v == '0' || v == 'false') {
			return false;
		} else if(v == 'on' || v == '1' || v == 'true') {
			return true;
		}
		return oldValue;
	},
	they(pronoun) {
		switch(pronoun) {
			case 'he':
			case 'Male':
				return 'he';
			case 'she':
			case 'Female':
				return 'she';
			default:
				return 'their';
		}
	},
	their(pronoun) {
		switch(pronoun) {
			case 'he':
			case 'Male':
				return 'his';
			case 'she':
			case 'Female':
				return 'her';
			default:
				return 'their';
		}
	},
	them(pronoun) {
		switch(pronoun) {
			case 'he':
			case 'Male':
				return 'him';
			case 'she':
			case 'Female':
				return 'her';
			default:
				return 'them';
		}
	},
	are(pronoun) {
		switch(pronoun) {
			case 'he':
				return 'is';
			case 'she':
				return 'is';
			default:
				return 'are';
		}
	},
	have(pronoun) {
		switch(pronoun) {
			case 'he':
				return 'have';
			case 'she':
				return 'have';
			default:
				return 'has';
		}
	},
	async worldInfo(channel) {
		const world = await sql.getWorld(channel);
		const now = new Date().getTime();
		let embed = new Discord.RichEmbed();
		let output = `This world has existed for ${this.getTimeString(now - world.startTime)}.`;

		if(world.resets > 0) {
			output += ` It has been reset ${world.resets} ${world.resets == 1 ? 'time' : 'times'}.`;
		}

		if(world.arc) {
			const arcType = enums.ArcTypes.Name[world.arc.type];
			output += `\nThe current arc is a **${arcType} Arc**, and has been ongoing for ${this.getTimeString(now - world.arc.startTime)}.`;
		}

		if(world.lastArc && world.lastArc.type != enums.ArcTypes.Filler) {
			const arcType = enums.ArcTypes.Name[world.lastArc.type];
			output += `\nThe previous arc was a **${arcType} Arc**, and lasted for ${this.getTimeString(world.lastArc.endTime - world.lastArc.startTime)}.`;
		}

		if(world.lostOrbs == 0) {
			output += '\nThere are no magic orbs hidden in the wild.';
		} else if(world.lostOrbs == 1) {
			output += '\nThere is 1 magic orb hidden in the wild.';
		} else {
			output += `\nThere are ${world.lostOrbs} magic orbs hidden in the wild.`;
		}
		output += `\nThere are currently ${world.population} active players in this universe.`;

		for(var cooldown of world.cooldowns) {
			switch(cooldown.type) {
				case enums.Cooldowns.Ruin:
					output += `\nUnless the Nemesis is defeated, the universe will end in ${this.getTimeString(cooldown.endTime - now)}!`;
					break;
				case enums.Cooldowns.HotSpringEvent:
					output += `\n**Hot Spring Event**: For the next ${this.getTimeString(cooldown.endTime - now)}, ` +
						`\`!event\` will reduce your defeat timer.`;
					break;
				case enums.Cooldowns.DojoEvent:
					output += `\n**Mountain Dojo Event**: For the next ${this.getTimeString(cooldown.endTime - now)}, ` +
						`\`!event\` will boost your training time.`;
					break;
				case enums.Cooldowns.GuruEvent:
					output += `\n**Mystic Guru Event**: For the next ${this.getTimeString(cooldown.endTime - now)}, ` +
						`\`!event\` will knock you out, but boost your Gardening Level.`;
					break;
				case enums.Cooldowns.Portal:
					const portal = await sql.getPortal(world.channel);
					const otherWorld = await sql.getWorld(portal.targetChannel);
					output += `\n**Portal Event**: For the next ${this.getTimeString(cooldown.endTime - now)}, ` +
						`\`!event\` will send energy into the portal, or \`!event message\` will send a message to Universe ${otherWorld.id}.`;
					break;
			}
		}

		embed.setTitle(`UNIVERSE ${world.id}`)
			.setColor(0x00AE86)
			.setDescription(output);
		return embed;
	},
	async ending(channel) {
		await this.endWorld(channel);
		return 'This story has reached an ending, but there are more adventures on the horizon. Onwards, to a new universe...!\n' +
			'To see the final standing, enter \`!scores\`.';
	},
	shuffle(a) {
		var j, x, i;
		for (i = a.length - 1; i > 0; i--) {
			j = Math.floor(Math.random() * (i + 1));
			x = a[i];
			a[i] = a[j];
			a[j] = x;
		}
		return a;
	},
	async getPings(player) {
		if(this.isFusion(player)) {
			const fusedPlayer1 = await sql.getPlayerById(player.fusedPlayers[0].id);
			const fusedPlayer2 = await sql.getPlayerById(player.fusedPlayers[1].id);
			return `<@${fusedPlayer1.userId}>, <@${fusedPlayer2.userId}>`;
		} else {
			return `<@${player.userId}>`;
		}
	},
	async tournament(player, command) {
		let tournament = await sql.getTournament(player.channel);
		if(!command) {
			return this.displayTournament(tournament);
		}
		switch(command) {
			case 'start':
				return this.startTournament(player.channel);
		}
	},
	async displayTournament(tournament) {
		let embed = new Discord.RichEmbed();
		embed.setTitle(`Tournament Status`)
			.setColor(0x4f0a93)
		const now = new Date().getTime();
		let output = '';

		if(!tournament || tournament.status == enums.TournamentStatuses.Off) {
			output = "There isn't a tournament going on.";
		} else {
			let names = tournament.fighters.filter(f => f).map(f => f.name);
			switch(tournament.status) {
				case enums.TournamentStatuses.Active:
					if(tournament.fighters.length == 2) {
						output += `FINAL ROUND\n`;
					} else if(tournament.fighters.length == 4) {
						output += `SEMIFINAL ROUND\n`;
					} else {
						output += `ROUND ${tournament.round}\n`;
					}
					output += `Remaining Fighters: ${names.join(', ')}\n\n`;

					let matches = [];
					let nextMatch = true;
					for(let i = 0; i < tournament.fighters.length; i += 2) {
						const leftFighter = tournament.fighters[i];
						const rightFighter = tournament.fighters[i+1];

						if(leftFighter && rightFighter) {
							let match = '';
							if(nextMatch && leftFighter.status == enums.TournamentFighterStatuses.Pending) {
								match += '**';
							}
							match += `${leftFighter.name} VS ${rightFighter.name} `;
							switch(leftFighter.status) {
								case enums.TournamentFighterStatuses.Pending:
									if(nextMatch) {
										if(tournament.nextAttack == tournament.nextMatch) {
											match += `** (Up Next! Starting in ${this.getTimeString(tournament.nextAttack - now)})`;
										} else {
											match += `** (Live! Score: ${leftFighter.score}-${rightFighter.score})`;
										}
										nextMatch = false;
									} else {
										match += ` (Pending)`;
									}
									break;
								case enums.TournamentFighterStatuses.Won:
									match += ` (${leftFighter.name} won)`;
									break;
								case enums.TournamentFighterStatuses.Lost:
									match += ` (${rightFighter.name} won)`;
							}
							matches.push(match);
						}
					}
					output += `This round's matches:\n` + ( matches.join(`\n`));
					break;
				case enums.TournamentStatuses.Complete:
					output += `TOURNAMENT COMPLETE\n`;
					output += `The grand champion was **${tournament.fighters[0].name}!**\n`;
					output += `The next tournament will begin in ${this.getTimeString(tournament.nextAttack - now)}.`;
					break;
			}
		}

		embed.setDescription(output);

		return embed;
	},
	getTournamentSeeds(numPlayers) {
		var rounds = Math.log(numPlayers) / Math.log(2) - 1;
		var seeds = [1, 2];
		for(var i = 0; i < rounds; i++){
			seeds = nextLayer(seeds);
		}
		return seeds;
		function nextLayer(seeds){
			var out=[];
			var length = seeds.length * 2 + 1;
			seeds.forEach(d => {
				out.push(d);
				out.push(length - d);
			});
			return out;
		}
	},
	async newFighter(channel) {
		let name;
		let nameUnique = false;
		while(!nameUnique) {
			name = '';
			const syllables = Math.floor(Math.random() * 2) + Math.floor(Math.random() * 2) + 1;
			for(let i = 0; i < syllables; i++) {
				name += templates.NameSyllables[Math.floor(Math.random() * templates.NameSyllables.length)];
			}
			if((Math.random() > 0.5 || syllables == 1) && syllables < 3) {
				name += templates.NameEndings[Math.floor(Math.random() * templates.NameEndings.length)];
			}
			if(!(await sql.getFighter(channel, name))) {
				nameUnique = true;
			}
		}

		const preferredMood = Math.floor(Math.random() * 7);

		const genderRoll = this.roll();
		let gender = "Other";
		if(genderRoll < 10) {
			gender = "Male";
		} else if(genderRoll < 19) {
			gender = "Female";
		}
		
		const orientationRoll = Math.random();
		let orientation = "Nobody";
		if(orientationRoll < 0.3) orientation = "Men";
		else if(orientationRoll < 0.6) orientation = "Women";
		else if(orientationRoll < 0.9) orientation = "Anyone";
		
		let fighter = {
			channel: channel,
			name: name.substring(0, 1).toUpperCase() + name.substring(1),
			strength: Math.floor(Math.random() * 10) + 1,
			preferredMood: preferredMood,
			mood: Math.max(0, Math.min(6, preferredMood + Math.floor(Math.random() * 5) - 2)),
			style: {
				id: Math.floor(Math.random() * 5) + 1,
			},
			gender: gender,
			orientation: orientation,
			aidLevel: 0,
			relationships: []
		}

		const id = await sql.setFighter(fighter);
		fighter.id = id;

		return fighter;
	},
	async newStyle(channel) {
		let name;
		let nameUnique = false;
		while(!nameUnique) {
			name = `${templates.StyleAdjectives[Math.floor(Math.random() * templates.StyleAdjectives.length)]} ${templates.StyleNouns[Math.floor(Math.random() * templates.StyleNouns.length)]}`;
			if(!(await sql.getStyle(channel, name))) {
				nameUnique = true;
			}
		}

		let style = {
			channel: channel,
			name: name,
			matchups: []
		}

		const id = await sql.setStyle(style);
		style.id = id;

		return style;
	},
	async startTournament(channel) {
		const now = new Date().getTime();

		let tournament = {
			channel: channel
		};

		tournament.status = enums.TournamentStatuses.Active;
		tournament.fighters = [];

		// Generate styles
		let styles = [];
		for(let i = 0; i < 5; i++) {
			styles.push(await this.newStyle(channel));
		}
		// Generate style matchups
		for(let i = 0; i < 5; i++) {
			for(let j = 0; j < i; j++) {
				if(i == j) continue;
				const roll = this.roll();
				if(roll < 7) { 
					styles[i].matchups.push({
						id: styles[j].id,
						effect: enums.MatchupTypes.Strong
					});
					styles[j].matchups.push({
						id: styles[i].id,
						effect: enums.MatchupTypes.Weak
					});
				} else if(roll > 13) {
					styles[i].matchups.push({
						id: styles[j].id,
						effect: enums.MatchupTypes.Weak
					});
					styles[j].matchups.push({
						id: styles[i].id,
						effect: enums.MatchupTypes.Strong
					});
				} else {
					styles[i].matchups.push({
						id: styles[j].id,
						effect: enums.MatchupTypes.Normal
					});
					styles[j].matchups.push({
						id: styles[i].id,
						effect: enums.MatchupTypes.Normal
					});
				}
			}
		}
		for(const style of styles) {
			await sql.setStyle(style);
		}

		// Generate fighters
		for(let i = 0; i < 16; i++) {
			tournament.fighters.push(await this.newFighter(channel));
		}

		// Generate fighter relationships
		for(const fighter of tournament.fighters) {
			const numRelationships = Math.floor(Math.random() * 3) + 1;
			for(let i = 0; i < numRelationships; i++) {
				const relationshipRoll = this.roll();
				let relationshipType = 0;
				if(relationshipRoll < 6 && fighter.orientation != 'Nobody') {
					relationshipType = enums.Relationships.Love;
				} else if(relationshipRoll < 11) {
					relationshipType = enums.Relationships.Friend;
				} else if(relationshipRoll < 16) {
					relationshipType = enums.Relationships.Rival;
				} else {
					relationshipType = enums.Relationships.Hate;
				}

				let validRelationship = false;
				let tries = 0;
				const mutual = this.roll() < 11 || relationshipType == enums.Relationships.Friend;
				while(!validRelationship && tries < 100) {
					tries++;
					targetFighter = tournament.fighters[Math.floor(Math.random() * 16)];
					if(fighter.id == targetFighter.id) {
						validRelationship = false;
						continue;
					}

					validRelationship = true;
					if(relationshipType == enums.Relationships.Love) {
						switch(fighter.orientation) {
							case 'Men':
								if(targetFighter.gender = 'Female') validRelationship = false;
								break;
							case 'Women':
								if(targetFighter.gender = 'Male') validRelationship = false;
								break;
						}
						if(mutual) {
							switch(targetFighter.orientation) {
								case 'Men':
									if(fighter.gender = 'Female') validRelationship = false;
									break;
								case 'Women':
									if(fighter.gender = 'Male') validRelationship = false;
									break;
							}
						}
					}
				}

				if(tries == 100) continue;

				// Create the relationship
				fighter.relationships.push({
					id: targetFighter.id,
					type: relationshipType
				});
				await sql.addRelationship(fighter, targetFighter.id, relationshipType);
				if(mutual) {
					targetFighter.relationships.push({
						id: fighter.id,
						type: relationshipType
					});
					await sql.addRelationship(targetFighter, fighter.id, relationshipType);
				}
			}
		}

		// Generate seed list
		let seeds = this.getTournamentSeeds(tournament.fighters.length);
		let fighters = tournament.fighters;

		fighters = this.shuffle(fighters);

		for(const i in seeds) {
			if(seeds[i] <= fighters.length) {
				fighters[seeds[i] - 1].position = i;
				fighters[seeds[i] - 1].status = enums.TournamentFighterStatuses.Pending;
				fighters[seeds[i] - 1].score = 0;
			}
		}

		// Generate odds
		for(let i = 0; i < 16; i += 2) {
			const mistake = this.roll() < 3;
			const thisFighter = fighters.find(f => f.position == i);
			const otherFighter = fighters.find(f => f.position == i + 1);
			const thisF = await sql.getFighterById(thisFighter.id);
			const otherF = await sql.getFighterById(otherFighter.id);
			thisFighter.odds = this.getOdds(thisF, otherF, 1, mistake);
			otherFighter.odds = this.getOdds(otherF, thisF, 1, mistake);
		}

		// Give money to players
		let players = await sql.getPlayers(channel);
		for(const player of players) {
			player.coins = 100;
			await sql.setPlayer(player);
		}

		tournament.status = enums.TournamentStatuses.Active;
		tournament.round = 1;
		tournament.nextMatch = now + settings.MatchMinutes * 1000 * 60;
		tournament.nextAttack = tournament.nextMatch;
		await sql.setTournament(tournament);

		return this.displayTournament(await sql.getTournament(tournament.channel));
	},
	getOdds(fighter, opponent, round, mistake) {
		
		let fighterPower = fighter.strength;
		let opponentPower = opponent.strength;

		if(mistake) {
			// The house makes a mistake
			const swap = fighterPower;
			fighterPower = opponentPower;
			opponentPower = swap;
		}

		// Math
		fighterOdds = (fighterPower < opponentPower) ?
			(fighterPower - opponentPower + 19) * (fighterPower - opponentPower + 20) / 800 :
			1 - (opponentPower - fighterPower + 19) * (opponentPower - fighterPower + 20) / 800;
		opponentOdds = (opponentPower < fighterPower) ?
			(opponentPower - fighterPower + 19) * (opponentPower - fighterPower + 20) / 800 :
			1 - (fighterPower - opponentPower + 19) * (fighterPower - opponentPower + 20) / 800;
		
		opponentOdds = (opponentPower - fighterPower + 19) * (opponentPower - fighterPower + 20) / 800;
		if(fighterOdds < 0.05) fighterOdds = 0.05;
		const totalWin = Math.pow(fighterOdds, 3) + 3 * (Math.pow(fighterOdds, 2) * opponentOdds);
		const ratio = 1 / totalWin * (1 + Math.random() * 0.15 * round);
		let odds = Math.min(20, Math.max(1.1, Math.floor(ratio * 10) / 10));
		return odds;
	},
	async tournamentMatch(tournament, winnerFighter, loserFighter, powerDifference) {
		let winner = tournament.fighters.find(f => f && f.id == winnerFighter.id);
		const winnerPosition = winner.position;
		const loserPosition = winnerPosition % 2 == 0 ? winnerPosition + 1 : winnerPosition - 1;
		let loser = tournament.fighters[loserPosition];
		const loserFighter = await sql.getFighterById(loser.id);

		if(powerDifference > 9) {
			winner.score += 2;
		
			if(Math.random() < 0.01) {
				// Permanent injury
				output += `${loser.name} suffered a serious injury, and ${this.their(loser.gender)} strength has been permanently reduced.\n`;
				loser.strength = Math.max(0, loser.strength - 1);
			}
		} else if(powerDifference > 1) {
			winner.score += 1;
		}

		let output = `Score: ${winnerFighter.name} ${winner.score}, ${loserFighter.name} ${loser.score}\n`;

		if(winner.score >= 3) {
			// Battle over!
			winner.status = enums.TournamentFighterStatuses.Won;
			loser.status = enums.TournamentFighterStatuses.Lost;

			winnerFighter.aidLevel = 0;
			loserFighter.aidLevel = 0;

			if(tournament.fighters.length == 2) {
				await sql.eliminateFighter(loser.id);
				tournament.fighters.splice(loserPosition, 1);
				winner.position = 0
				output += `The tournament is over! ${winner.name} is the world's strongest warrior!`;
				tournament.status = enums.TournamentStatuses.Complete;
				tournament.nextMatch += settings.MatchMinutes * 60 * 1000 * 2;
				tournament.nextAttack = tournament.nextMatch;
			} else {
				output += `${winner.name} claims victory, and advances to the next round of the tournament!`;
			}

			const bets = await sql.getBets(tournament.channel);
			for(const bet of bets) {
				let player = await sql.getPlayerById(bet.playerId);
				if(bet.fighterId == winner.id) {
					const reward = Math.floor(bet.amount * winner.odds);
					output += `\n${player.name} wins ${reward} coins!`;
					player.coins += reward;
					await sql.setPlayer(player);
				} else if(bet.fighterId == loser.id) {
					output += `\n${player.name} didn't win anything...`;
				}
			}

			await sql.deleteBets(tournament.channel);

			// Update fighter moods and relationships
			for(let i = 0; i < tournament.fighters.length; i++) {
				let f = await sql.getFighterById(tournament.fighters[i].id);
				const moodRoll = this.roll();
				if(moodRoll < 3) {
					f.mood = Math.max(0, f.mood - 2);
				} else if(moodRoll < 7) {
					f.mood = Math.max(0, f.mood - 1);
				} else if(moodRoll > 14) {
					f.mood = Math.min(6, f.mood + 1);
				} else if(moodRoll > 18) {
					f.mood = Math.min(6, f.mood + 2);
				}
				
				if(this.roll() < 6) {
					if(f.mood < f.preferredMood) f.mood++;
					if(f.mood > f.preferredMood) f.mood--;
				}

				const winnerRelationship = f.relationships.find(r => r.id == winner.id);
				const loserRelationship = f.relationships.find(r => r.id == loser.id);
				if(winnerRelationship) {
					switch(winnerRelationship.type) {
						case enums.Relationships.Love:
						case enums.Relationships.Friend:
							f.mood = Math.min(6, f.mood + 1);
							break;
						case enums.Relationships.Hate:
							f.mood = Math.max(0, f.mood - 1);
							break;
					}
				}

				if(loserRelationship) {
					switch(loserRelationship.type) {
						case enums.Relationships.Hate:
							f.mood = Math.min(6, f.mood + 1);
							break;
						case enums.Relationships.Love:
							f.mood = Math.max(0, f.mood - 1);
							if(this.roll() < 11 && !winnerRelationship && winner.id != f.id) {
								await sql.addRelationship(f, winner.id, enums.Relationships.Hate);
								output += `\n${f.name} won't forgive ${winnerFighter.name} for this...`;
							}
							break;
					}
				}
				
				await sql.setFighter(f);
			}
	
			let remainingMatches = false;
			for(let i = 0; i < tournament.fighters.length; i += 2) {
				const leftFighter = tournament.fighters[i];
				const rightFighter = tournament.fighters[i+1];
				if(leftFighter && rightFighter && 
					(leftFighter.status == enums.TournamentFighterStatuses.Pending || rightFighter.status == enums.TournamentFighterStatuses.Pending)) {
					remainingMatches = true;
				}
			}
			if(!remainingMatches && tournament.fighters.length > 2) {
				output += await this.advanceTournament(tournament);
			}

			tournament.nextMatch += settings.MatchMinutes * 60 * 1000;
			tournament.nextAttack = tournament.nextMatch;
		} else {
			// Battle continues
			tournament.nextAttack += 60 * 1000;
			output += `The battle continues...`;
		}

		await sql.setTournament(tournament);

		return output;
	},
	async advanceTournament(tournament) {
		let newFighters = [];
		let oldFighters = [];
		for(let i = 0; i < tournament.fighters.length; i += 2) {
			const leftFighter = tournament.fighters[i];
			const rightFighter = tournament.fighters[i+1];
			if((leftFighter && leftFighter.status == enums.TournamentFighterStatuses.Won) ||
				(!rightFighter)) {
				newFighters.push(leftFighter);
				oldFighters.push(rightFighter);
			} else {
				newFighters.push(rightFighter);
				oldFighters.push(leftFighter);
			}
		}

		for(const f of oldFighters) {
			if(f) {
				await sql.eliminateFighter(f.id);
			}
		}
		for(const f of newFighters) {
			if(f) {
				f.position = Math.floor(f.position / 2);
				f.status = enums.TournamentFighterStatuses.Pending;
				f.score = 0;
			}
		}
		tournament.fighters = newFighters;
		tournament.round++;

		// Generate odds
		for(let i = 0; i < tournament.fighters.length; i += 2) {
			const mistake = this.roll() < 3;
			const thisFighter = tournament.fighters.find(f => f.position == i);
			const otherFighter = tournament.fighters.find(f => f.position == i + 1);
			const thisF = await sql.getFighterById(thisFighter.id);
			const otherF = await sql.getFighterById(otherFighter.id);
			thisFighter.odds = this.getOdds(thisF, otherF, tournament.round, mistake);
			otherFighter.odds = this.getOdds(otherF, thisF, tournament.round, mistake);
		}

		if(tournament.fighters.length == 2) {
			return ` It's time for the tournament finals!`;
		} else {
			return ` It's time for the next round of the tournament!`;
		}

		// Give money to broke players
		let players = await sql.getPlayers(channel);
		for(const player of players) {
			if(player.coins < tournament.round * 10) {
				player.coins = tournament.round * 10;
				await sql.setPlayer(player);
			}
		}
	},
	async bet(player, fighter, amount) {
		const tournament = await sql.getTournament(player.channel);
		if(fighter) {
			if(amount > player.coins) amount = player.coins;
			await sql.addBet(player.channel, player.id, fighter.id, amount);
			return `${player.name} has bet ${amount} coins on ${fighter.name}'s victory.`;
		} else {
			// Display betting info
			for(let i = 0; i < tournament.fighters.length; i += 2) {
				const leftFighter = tournament.fighters[i];
				const rightFighter = tournament.fighters[i+1];
	
				if(leftFighter && rightFighter) {
					if(leftFighter.status == enums.TournamentFighterStatuses.Pending) {
						let embed = new Discord.RichEmbed();
						embed.setTitle(`Betting Rates: ${leftFighter.name} VS ${rightFighter.name}`)
							.setColor(0x00AE86);
						
						let description = '';
						description += `Bet on ${leftFighter.name}: x${leftFighter.odds} returns`;
						description += `\nBet on ${rightFighter.name}: x${rightFighter.odds} returns`;
						description += `\nMinimum bet: ${tournament.round * 10} coins`;

						embed.setDescription(description);
						return embed;
					}
				}
			}
		}
	},
	async aid(player, fighter, amount) {
		if(fighter) {
			if(amount > player.coins) amount = player.coins;
			player.coins -= amount;
			fighter.aidLevel += amount;
			await sql.setPlayer(player);
			await sql.setFighter(fighter);
			return `${player.name} has invested ${amount} coins in ${fighter.name}'s training.`;3
		}
	},
	async give(player, targetName, amount) {
		let target = await sql.getPlayer(player.channel, targetName);
		if(target) {
			if(amount > player.coins) amount = player.coins;
			player.coins -= parseInt(amount);
			target.coins += parseInt(amount);
			await sql.setPlayer(player);
			await sql.setPlayer(target);
			return `${player.name} donates ${amount} ${amount == 1 ? 'coin' : 'coins'} to ${target.name}!`;
		}
	},
	async testMethod(player, param) {
		let output = '';
		
		let flawLibrary = [
			{ cost: 2, levelUp: 1, speed: 1, id: 'slow', namePattern: '^slow$' },
			{ cost: 3, levelUp: 2, speed: 0, id: 'weakPhysicalAttacker', namePattern: '^weak physical attack' },
			{ cost: 3, levelUp: 2, speed: 0, id: 'weakEnergyAttacker', namePattern: '^weak energy attack' }
		];
		let techFlawList = ['slow', 'weak physical attack'];
		for(const flawName in techFlawList) {
			const flawData = flawLibrary.find(f => {
				return flawName.match(f.namePattern);
			});
			if(flawData) techflaws.push(flawData);
		}
		return output;
	},
	roll() {
		return Math.floor(Math.random() * 20) + 1;
	}
}
