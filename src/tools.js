const enums = require('./enum.js');
const settings = require('./settings.js');
const sql = require('./sql.js');
const templates = require('./templates.js');
const Discord = require("discord.js");
const moment = require("moment");
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

		if(player.sponsored) {
			stats += `\nSponsored Fighter: ${player.sponsored.name}`;
		}

		embed.addField('Stats', stats);

		return embed;
	},
	// Scout a fighter's status.
    async scanFighter(fighter) {
		if(!fighter) {
			console.log('Fighter not found');
			return null;
		}
		let embed = new Discord.RichEmbed();
		embed.setTitle(`${fighter.name.toUpperCase()}`)
			.setColor(0x00AE86);

		let stats = '';
		stats += `Gender: ${fighter.gender}`;
		stats += `\nAge: ${fighter.age}`;
		stats += `\nAttracted to: ${fighter.orientation}`;
		stats += `\nMood: ${enums.Moods.Name[fighter.mood]}`;
		stats += `\nStrength: ${fighter.strength}`;
		if(fighter.sponsorships.length > 0) {
			stats += ` + ${Math.min(3, fighter.sponsorships.length)}`;
		}

		stats += `\nStyle: ${fighter.style.name}`;
		if(fighter.techs.length > 0) {
			stats += `\nTechniques: ${fighter.techs.map(t => t.name).join(', ')}`;
		}

		const history = await sql.getHistory(fighter.id);
		const wins = history.filter(h => h.winner.id == fighter.id).length;
		const losses = history.filter(h => h.loser.id == fighter.id).length;
		stats += `\nRecord: ${wins}-${losses}`;

		if(fighter.sponsorships.length > 0) {
			stats += `\n${fighter.sponsorships.length == 1 ? 'Sponsor' : 'Sponsors'}: ${fighter.sponsorships.map(s => s.name)}`;
		}

		embed.setDescription(stats);

		let relationships = [];

		for(const r of fighter.relationships.filter(r => r.fromId == fighter.id)) {
			let relationship = '';
			switch(r.type) {
				case enums.Relationships.Love: 
					relationship += 'Loves ';
					break;
				case enums.Relationships.Friend: 
					relationship += 'Friends with ';
					break;
				case enums.Relationships.Rival: 
					relationship += 'Rival of ';
					break;
				case enums.Relationships.Hate: 
					relationship += 'Hates ';
					break;
			}
			relationship += r.toName;
			relationships.push(relationship);
		}

		for(const r of fighter.relationships.filter(r => r.toId == fighter.id)) {
			let relationship = '';
			switch(r.type) {
				case enums.Relationships.Love: 
					relationship += 'Loved by ';
					break;
				case enums.Relationships.Hate: 
					relationship += 'Hated by ';
					break;
			}
			if(relationship.length > 0) {
				relationship += r.fromName;
				relationships.push(relationship);
			}
		}

		relationships.sort();
		embed.addField('Relationships',  relationships.join('\n'));

		return embed;
	},
	async history(fighter) {
		if(!fighter) {
			console.log('Fighter not found');
			return null;
		}
		let embed = new Discord.RichEmbed();
		embed.setTitle(`${fighter.name.toUpperCase()} HISTORY`)
			.setColor(0x00AE86);

		let output = '';
		const history = await sql.getHistory(fighter.id);
		const wins = history.filter(h => h.winner.id == fighter.id).length;
		const losses = history.filter(h => h.loser.id == fighter.id).length;
		output += `Record: ${wins}-${losses}\n`;

		for(const match of history) {
			if(output.length > 1950) {
				output += '\n...';
				break;
			}
			const fightDate = moment(match.date).format('MMM Do');
			if(match.winner.id == fighter.id) {
				output += `\n${fightDate}: Beat ${match.loser.name} (${match.winner.score}-${match.loser.score})`;
			} else {
				output += `\n${fightDate}: Lost to ${match.winner.name} (${match.loser.score}-${match.winner.score})`;
			}
		}

		embed.setDescription(output);

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
		if(output) output += ' and ';
		output += seconds + (seconds != 1 ? ' seconds' : ' second');
        
        return output;
	},
	// Creates a table displaying the name, rank, status and power level of all active players.
    async displayPlayers(channel) {
		let players = await sql.getPlayers(channel);
		const now = new Date().getTime();
		
		// Build the table out in advance so we can get column widths
		let headers = [4, 5, 9];
		let rows = [];
		for(const i in players) {
			let p = players[i];
			if(p.lastActive + 24 * hour < now) {
				continue;
			}

			let row = [];
			row.push(p.name);
			if(p.name.length > headers[0]) headers[0] = p.name.length;
			
			const coins = '' + p.coins;
 			
			row.push(coins);
			if(coins.length > headers[1]) headers[1] = coins.length;
			
			const sponsored = p.sponsored ? p.sponsored.name : '';
			row.push(sponsored);
			if(sponsored.length > headers[2]) headers[2] = sponsored.length;

			rows.push(row);
		}
		
		// Print out the table
		let output = '';
		output += 'NAME' + ' '.repeat(headers[0] - 3);
		output += 'COINS' + ' '.repeat(headers[1] - 4);
		output += 'SPONSORED' + ' '.repeat(headers[2] - 8);
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
		let headers = [7, 3, 5, 4, 8];
		let rows = [];
		for(const i in tournament.fighters) {
			if(tournament.fighters[i].status == enums.TournamentFighterStatuses.Lost) {
				continue;
			}
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
			
			let sponsors = fighter.sponsorships.map(s => s.name).join(', ');
			row.push(sponsors);
			if(sponsors.length > headers[4]) headers[4] = sponsors.length;
			
			rows.push(row);
		}
		
		// Print out the table
		let output = '';
		output += 'FIGHTER' + ' '.repeat(headers[0] - 6);
		output += 'STR' + ' '.repeat(headers[1] - 2);
		output += 'STYLE' + ' '.repeat(headers[2] - 4);
		output += 'MOOD' + ' '.repeat(headers[3] - 3);
		output += 'SPONSORS' + ' '.repeat(headers[4] - 7);
		output += '\n';
		output += '-'.repeat(headers[0]) + ' ';
		output += '-'.repeat(headers[1]) + ' ';
		output += '-'.repeat(headers[2]) + ' ';
		output += '-'.repeat(headers[3]) + ' ';
		output += '-'.repeat(headers[4]) + ' ';
		output += '\n';
		
		for(const i in rows) {
			let row = rows[i];
			output += row[0].padEnd(headers[0] + 1);
			output += row[1].padEnd(headers[1] + 1);
			output += row[2].padEnd(headers[2] + 1);
			output += row[3].padEnd(headers[3] + 1);
			output += row[4].padEnd(headers[4] + 1);
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
		output += 'PLACE' + ' '.repeat(headers[0] - 4);
		output += 'NAME' + ' '.repeat(headers[1] - 3);
		output += 'COINS' + ' '.repeat(headers[2] - 4);
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
		let tournament = await sql.getTournament(channel);

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

		power1 = fighter1.strength + fighter1.mood + Math.min(3, fighter1.sponsorships.length);
		power2 = fighter2.strength + fighter2.mood + Math.min(3, fighter2.sponsorships.length);

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
		const relationship1 = fighter1.relationships.find(r => r.toId == fighter2.id);
		const relationship2 = fighter2.relationships.find(r => r.toId == fighter1.id);

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
		let score1 = Math.max(0, power1 + this.roll());
		let score2 = Math.max(0, power2 + this.roll());
		
		let battleLog = '';
		battleLog += `${fighter1.name} Battle Power: ${score1}\n${fighter2.name} Battle Power: ${score2}\n`

		// Check for potential spark
		if(fighter1.potential > 0 && fighter1.strength < fighter2.strength && this.roll() == 20) {
			fighter1.strength += fighter1.potential;
			score1 += fighter1.potential;
			fighter1.potential = 0;
			battleLog += `**Burst!** ${fighter1.name}'s true potential awakened, raising ${this.their(fighter1.gender)} strength to ${fighter1.strength} `
				+ `and ${this.their(fighter1.gender)} battle power to ${score1}!`;
		}
		if(fighter2.potential > 0 && fighter2.strength < fighter1.strength && this.roll() == 20) {
			fighter2.strength += fighter2.potential;
			score2 += fighter2.potential;
			fighter2.potential = 0;
			battleLog += `**Burst!** ${fighter2.name}'s true potential awakened, raising ${this.their(fighter2.gender)} strength to ${fighter2.strength} `
				+ `and ${this.their(fighter2.gender)} battle power to ${score2}!`;
		}

		// Check for techniques
		let tournamentFighter1 = tournament.fighters.find(f => f.id == fighter1.id && f.status == enums.TournamentFighterStatuses.Pending);
		let tournamentFighter2 = tournament.fighters.find(f => f.id == fighter2.id && f.status == enums.TournamentFighterStatuses.Pending);
		let spark1 = fighter1.techs.length < 3 && Math.random() < 0.02;
		let spark2 = fighter2.techs.length < 3 && Math.random() < 0.02;
		if(fighter1.techs.length > 0 || spark1) {
			let techOdds = 3;
			if(tournamentFighter1.score == 2 && tournamentFighter2.score == 2) {
				techOdds = 12;
			} else if(tournamentFighter1.score < tournamentFighter2.score) {
				techOdds = 8;
			}
			if(this.roll() <= techOdds) {
				// Use tech!
				if(spark1) {
					// Sparking!
					const style = await sql.getStyle(channel, fighter1.style.name);
					tech = style.techs[fighter1.techs.length];
					fighter1.techs.push(tech);
					await sql.addTechnique(fighter1, tech);
					score1 += (matchup2 && matchup2.effect == enums.MatchupTypes.Strong) ? Math.ceil(tech.power / 3) : tech.power;
					battleLog += `**Sparking!** ${fighter1.name} finally mastered the ${tech.name} technique, raising ${this.their(fighter1.gender)} battle power to ${score1}!\n`;
				} else {
					const tech = fighter1.techs[Math.floor(Math.random() & fighter1.techs.length)];
					score1 += (matchup2 && matchup2.effect == enums.MatchupTypes.Strong) ? Math.ceil(tech.power / 3) : tech.power;
					battleLog += `${fighter1.name} uses the ${tech.name} technique, raising ${this.their(fighter1.gender)} battle power to ${score1}!\n`;
				}
			}
		}
		if(fighter2.techs.length > 0 || spark2) {
			let techOdds = 3;
			if(tournamentFighter1.score == 2 && tournamentFighter2.score == 2) {
				techOdds = 12;
			} else if(tournamentFighter2.score < tournamentFighter1.score) {
				techOdds = 8;
			}
			if(this.roll() <= techOdds) {
				// Use tech!
				if(spark2) {
					// Sparking!
					const style = await sql.getStyle(channel, fighter2.style.name);
					const tech = style.techs[fighter2.techs.length];
					fighter2.techs.push(tech);
					await sql.addTechnique(fighter2, tech);
					score2 += (matchup1 && matchup1.effect == enums.MatchupTypes.Strong) ? Math.ceil(tech.power / 3) : tech.power;
					battleLog += `**Sparking!** ${fighter2.name} finally mastered the ${tech.name} technique, raising ${this.their(fighter2.gender)} battle power to ${score2}!\n`;
				} else {
					const tech = fighter2.techs[Math.floor(Math.random() & fighter2.techs.length)];
					score2 += (matchup1 && matchup1.effect == enums.MatchupTypes.Strong) ? Math.ceil(tech.power / 3) : tech.power;
					battleLog += `${fighter2.name} uses the ${tech.name} technique, raising ${this.their(fighter2.gender)} battle power to ${score2}!\n`;
				}
			}
		}

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
		if(difference < 2) {
			battleLog += `\nNeither fighter is able to gain ground...`;
		} else if(difference < 10) {
			battleLog += `\n${fighters[0].name} lands a direct hit on ${fighters[1].name} for 1 point!`;
		} else {
			battleLog += `\n${fighters[0].name} inflicts a critical strike on ${fighters[1].name} for 2 points!`;
		}

		embed.addField('Ready? Fight!', battleLog);
	
		const outcome = await this.handleFightOutcome(channel, fighters[0], fighters[1], scores[0], scores[1]);
		if(outcome) {
			embed.addField('Results', outcome);
		}

		return embed;
	},
	// Process updates based on who won and lost a fight.
	async handleFightOutcome(channel, winner, loser, winnerScore, loserScore,) {
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
					const rightFighter = tournament.fighters[i + 1];

					if(leftFighter && rightFighter && leftFighter.status == enums.TournamentFighterStatuses.Pending) {
						// Fight!
						return await this.fight(await sql.getFighterById(leftFighter.id), await sql.getFighterById(rightFighter.id));
					}
				}
			}
		} else if(tournament && now > tournament.nextEvent) {
			tournament.nextEvent = now + (settings.EventTimerMinMinutes + Math.random() * (settings.EventTimerMaxMinutes - settings.EventTimerMinMinutes)) * 60 * 1000;
			await sql.setTournament(tournament);
			return await this.event(tournament);
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
				return 'they';
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
			let names = [...new Set(tournament.fighters.filter(f => f).map(f => f.name))];
			switch(tournament.status) {
				case enums.TournamentStatuses.Active:
					let winnerMatches = [];
					let loserMatches = [];
					let nextMatch = true;
					let winnerBracket = tournament.fighters.filter(f => f && f.bracket == enums.Brackets.Winners);
					let loserBracket = tournament.fighters.filter(f => f && f.bracket == enums.Brackets.Losers);
					
					output += enums.Rounds.Name[tournament.round].toUpperCase() + '\n';
					output += `Remaining Fighters: ${names.join(', ')}\n\n`;


					for(let i = 0; i < winnerBracket.length; i += 2) {
						const leftFighter = winnerBracket.find(f => f.position == i);
						const rightFighter = winnerBracket.find(f => f.position == i + 1);

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
							winnerMatches.push(match);
						}
					}
					embed.addField(`Winner's Bracket`, winnerMatches.join('\n'));

					if(loserBracket.length > 0) {
						for(let i = 0; i < Math.max(...loserBracket.map(f => f.position)) + 1; i += 2) {
							const leftFighter = loserBracket.find(f => f.position == i);
							const rightFighter = loserBracket.find(f => f.position == i + 1);
	
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
								loserMatches.push(match);
							} else if(leftFighter || rightFighter) {
								let fighter = leftFighter ? leftFighter : rightFighter;
								loserMatches.push(`${fighter.name}: Waiting for opponent`);
							}
						}
						if(loserMatches.length > 0) {
							embed.addField(`Loser's Bracket`, loserMatches.join('\n'));
						}
					}
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
		if(genderRoll < 9) {
			gender = "Male";
		} else if(genderRoll < 17) {
			gender = "Female";
		}

		let age = 0;
		const ageRoll = this.roll();
		if(ageRoll <= 3) {
			age = 14 + Math.ceil(Math.random() * 6);
		} else if(ageRoll <= 16) {
			age = 20 + Math.ceil(Math.random() * 10);
		} else if(ageRoll <= 19) {
			age = 30 + Math.ceil(Math.random() * 15);
		} else {
			age = 45 + Math.ceil(Math.random() * 20);
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
			potential: 0,
			age: age,
			relationships: [],
			sponsorships: [],
			techs: []
		}

		if(fighter.strength < 4 && this.roll() < 5) {
			fighter.potential = Math.floor(Math.random() * 8) + 3;
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
			matchups: [],
			techs: []
		}

		const id = await sql.setStyle(style);
		style.id = id;

		return style;
	},
	async newTech(style, power) {
		let name;
		let nameUnique = false;
		while(!nameUnique) {
			let nameParts = [];
			nameParts.push(templates.TechniqueQualifiers[Math.floor(Math.random() * templates.TechniqueQualifiers.length)]);
			if(power >= 8) {
				nameParts.push(templates.TechniqueQualifiers[Math.floor(Math.random() * templates.TechniqueQualifiers.length)]);
				while(nameParts[0] == nameParts[1]) {
					nameParts[1] = templates.TechniqueQualifiers[Math.floor(Math.random() * templates.TechniqueQualifiers.length)];
				}
			}
			nameParts.push(templates.TechniqueNouns[Math.floor(Math.random() * templates.TechniqueNouns.length)]);

			name = nameParts.join(' ');
			if(!(await sql.getTechniqueByName(style.channel, name))) {
				nameUnique = true;
			}
		}

		let tech = {
			name: name,
			styleId: style.id,
			power: power,
			channel: style.channel
		};

		return await sql.setTechnique(tech);
	},
	async startTournament(channel) {
		const now = new Date().getTime();

		let fighters = await sql.getFighters(channel);
		let tournament = {
			channel: channel
		};

		tournament.status = enums.TournamentStatuses.Active;
		tournament.fighters = [];

		// Generate styles
		let styles = await sql.getStyles(channel);
		if(styles.length == 0) {
			for(let i = 0; i < 5; i++) {
				styles.push(await this.newStyle(channel));
			}
			
			// Generate style matchups
			for(let i = 0; i < 5; i++) {
				const strongAgainst = (i + 1) % 5;
				const weakAgainst = i < 0 ? i + 5 : i
				styles[i].matchups.push({
					id: styles[strongAgainst].id,
					effect: enums.MatchupTypes.Strong
				});
				styles[i].matchups.push({
					id: styles[weakAgainst].id,
					effect: enums.MatchupTypes.Weak
				});
			}
	
			for(const style of styles) {
				style.techs.push(await this.newTech(style, 3 + Math.floor(Math.random() * 3)));
				style.techs.push(await this.newTech(style, 6 + Math.floor(Math.random() * 3)));
				style.techs.push(await this.newTech(style, 9 + Math.floor(Math.random() * 3)));
				await sql.setStyle(style);
			}
	
		}

		// Generate fighters
		for(let i = 0; i < fighters.length; i++) {
			if(this.roll() < 9) {
				// Add a returning fighter!
				tournament.fighters.push(fighters[i]);
				if(tournament.fighters.length > 8) {
					break;
				}
			}
		}

		for(let i = tournament.fighters.length; i < 16; i++) {
			tournament.fighters.push(await this.newFighter(channel));
		}

		// Set fighter techniques
		for(const fighter of tournament.fighters) {
			if(fighter.techs.length < 3 && this.roll() < 11) {
				// Learn a new technique!
				const fighterStyle = styles.find(s => s.id == fighter.style.id);
				const newTech = fighterStyle.techs[fighter.techs.length]
				fighter.techs.push(newTech);
				await sql.addTechnique(fighter, newTech);
			}
		}

		// Generate fighter relationships
		for(const fighter of tournament.fighters) {
			if(fighter.relationships.length == 0) {
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
									if(targetFighter.gender == 'Female') validRelationship = false;
									break;
								case 'Women':
									if(targetFighter.gender == 'Male') validRelationship = false;
									break;
							}
							if(mutual) {
								switch(targetFighter.orientation) {
									case 'Men':
										if(fighter.gender == 'Female') validRelationship = false;
										break;
									case 'Women':
										if(fighter.gender == 'Male') validRelationship = false;
										break;
									case 'Nobody':
										validRelationship = false;
										break;
								}
							}

							// Don't allow major age differences in ships
							let ageVariance = Math.max(Math.ceil(fighter.age * .15), 2);
							if(fighter.age + ageVariance < targetFighter.age || 
								fighter.age - ageVariance > targetFighter.age) {
								validRelationship = false;
							}
						}
					}

					if(tries == 100) continue;

					// Create the relationship
					fighter.relationships.push({
						fromId: fighter.id,
						toId: targetFighter.id,
						type: relationshipType
					});
					await sql.addRelationship(fighter, targetFighter.id, relationshipType);
					if(mutual) {
						targetFighter.relationships.push({
							fromId: targetFighter.id,
							toId: fighter.id,
							type: relationshipType
						});
						await sql.addRelationship(targetFighter, fighter.id, relationshipType);
					}
				}
			}
		}

		// Generate seed list
		let seeds = this.getTournamentSeeds(tournament.fighters.length);

		tournament.fighters = this.shuffle(tournament.fighters);

		for(const i in seeds) {
			if(seeds[i] <= tournament.fighters.length) {
				tournament.fighters[seeds[i] - 1].position = i;
				tournament.fighters[seeds[i] - 1].bracket = enums.Brackets.Winners;
				tournament.fighters[seeds[i] - 1].status = enums.TournamentFighterStatuses.Pending;
				tournament.fighters[seeds[i] - 1].score = 0;
			}
		}

		// Generate odds
		for(let i = 0; i < 16; i += 2) {
			const mistake = this.roll() < 3;
			const thisFighter = tournament.fighters.find(f => f.position == i);
			const otherFighter = tournament.fighters.find(f => f.position == i + 1);
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
		tournament.nextMatch = (now - (now % (hour * 24))) + settings.StartTime + 24 * hour;
		tournament.nextAttack = tournament.nextMatch;
		tournament.nextEvent = now + (settings.EventTimerMinMinutes + Math.random() * (settings.EventTimerMaxMinutes - settings.EventTimerMinMinutes)) * 60 * 1000;
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
		let winner = tournament.fighters.find(f => f && f.id == winnerFighter.id && f.status == enums.TournamentFighterStatuses.Pending);
		let loser = tournament.fighters.find(f => f && f.id == loserFighter.id && f.status == enums.TournamentFighterStatuses.Pending);

		let output = '';

		if(powerDifference > 9) {
			winner.score += 2;
		
			if(Math.random() < 0.02) {
				// Permanent injury
				output += `${loser.name} suffered a serious injury, and ${this.their(loser.gender)} strength has been permanently reduced.\n`;
				loser.strength = Math.max(0, loser.strength - 1);
			}
		} else if(powerDifference > 1) {
			winner.score += 1;
		}

		output += `Score: ${winnerFighter.name} ${winner.score}, ${loserFighter.name} ${loser.score}\n`;

		if(winner.score >= 3) {
			// Battle over!
			winner.status = enums.TournamentFighterStatuses.Won;

			if(loser.bracket == enums.Brackets.Winners && tournament.round < 3) {
				// Add loser to loser's bracket match list
				const losers = tournament.fighters.filter(f => f && f.bracket == enums.Brackets.Losers);
				let loserPosition = 0;
				while(losers.find(f => f.position == loserPosition)) {
					loserPosition++;
				}

				let loserBracketMatch = {
					id: loser.id,
					position: loserPosition,
					bracket: enums.Brackets.Losers,
					status: enums.TournamentFighterStatuses.Pending,
					score: 0
				};
				tournament.fighters.push(loserBracketMatch);
				if(loserPosition % 2 == 1) {
					// Set odds on new match
					const foe = tournament.fighters.find(f => f && f.position == loserPosition - 1 && f.bracket == enums.Brackets.Losers);
					
					const mistake = this.roll() < 3;
					loserBracketMatch.odds = this.getOdds(await sql.getFighterById(loserBracketMatch.id), 
						await sql.getFighterById(foe.id), tournament.round, mistake);
					foe.odds = this.getOdds(await sql.getFighterById(foe.id), 
						await sql.getFighterById(loserBracketMatch.id), tournament.round, mistake);
				}
			} else if(winner.bracket == enums.Brackets.Losers && tournament.round > 2) {
				// If there's any unpaired winner's bracket losers, add a new match for them
				let unpairedFighters = tournament.fighters.filter(f => f && f.bracket == enums.Brackets.Winners && f.status == enums.TournamentFighterStatuses.Lost
					&& !tournament.fighters.find(f2 => f2 && f2.bracket == enums.Brackets.Losers && f2.id == f.id));
				if(unpairedFighters.length > 0) {
					const losers = tournament.fighters.filter(f => f && f.bracket == enums.Brackets.Losers);
					let nextPosition = 0;
					while(losers.find(f => f.position == nextPosition)) {
						nextPosition++;
					}
					const nextFighter = unpairedFighters[0];
					const winnerTournamentFighter = {
						id: winner.id,
						position: nextPosition,
						bracket: enums.Brackets.Losers,
						status: enums.TournamentFighterStatuses.Pending,
						score: 0
					};
					const nextTournamentFighter = {
						id: nextFighter.id,
						position: nextPosition + 1,
						bracket: enums.Brackets.Losers,
						status: enums.TournamentFighterStatuses.Pending,
						score: 0
					};
					// Set odds on new match
					const mistake = this.roll() < 3;
					winnerTournamentFighter.odds = this.getOdds(await sql.getFighterById(winnerTournamentFighter.id), 
						await sql.getFighterById(nextTournamentFighter.id), tournament.round, mistake);
					nextTournamentFighter.odds = this.getOdds(await sql.getFighterById(nextTournamentFighter.id), 
						await sql.getFighterById(winnerTournamentFighter.id), tournament.round, mistake);

					tournament.fighters.push(winnerTournamentFighter);
					tournament.fighters.push(nextTournamentFighter);
				}
			}
			loser.status = enums.TournamentFighterStatuses.Lost;

			if(tournament.fighters.length == 2) {
				await sql.eliminateFighter(loser);
				tournament.fighters = [winner];
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

			const sponsorReward = tournament.round * 20;
			for(const sponsor of winnerFighter.sponsorships) {
				let player = await sql.getPlayerById(sponsor.id);
				output += `\nSponsor ${player.name} earns ${sponsorReward} coins!`;
				player.coins += sponsorReward;
				await sql.setPlayer(player);
			}

			await sql.deleteBets(tournament.channel);
			await sql.addHistory(winnerFighter.id, loserFighter.id, winner.score, loser.score);

			// Update fighter moods and relationships
			if(loser.score == 2) {
				const winnerLoserRelationship = winnerFighter.relationships.find(r => r.id == loser.id);
				const loserWinnerRelationship = loserFighter.relationships.find(r => r.id == winner.id);
				
				// Declared rivalries
				if(!loserWinnerRelationship
					&& this.roll() < 5) {
					output += `\n${loser.name} declared ${winner.name} ${this.their(loser.gender)} rival!`;
					await sql.addRelationship(loser, winner.id, enums.Relationships.Rival);
				}

				if(!winnerLoserRelationship
					&& this.roll() < 5) {
					output += `\n${winner.name} declared ${loser.name} ${this.their(winner.gender)} rival!`;
					await sql.addRelationship(winner, loser.id, enums.Relationships.Rival);
				}

				// Love confessions
				if(winnerLoserRelationship &&
					winnerLoserRelationship.type == enums.Relationships.Love &&
					(!loserWinnerRelationship || loserWinnerRelationship.type != enums.Relationships.Love) &&
					this.roll() < 15) {
					output += `\n${winner.name} confessed ${this.their(winnerFighter.gender)} feelings for ${loser.name}! What a shock!`;

					let loveOdds = 12;
					loveOdds += loserFighter.mood - 3; // Odds are affected by the confessee's mood

					switch(loserFighter.orientation) {
						case 'Men':
							if(winnerFighter.gender == 'Female') {
								loveOdds = 0;
							}
							break;
						case 'Women':
							if(winnerFighter.gender == 'Male') {
								loveOdds = 0;
							}
							break;
						case 'Nobody':
							loveOdds = 0;
							break;
					}

					if(loserWinnerRelationship && loserWinnerRelationship.type == enums.Relationships.Hate) {
						loveOdds -= 12;
					}

					if(this.roll() < loveOdds) {
						output += `\n${loser.name} accepted ${winner.name}'s feelings!`;
						await sql.addRelationship(loser, winner.id, enums.Relationships.Love);
					} else {
						output += `\n${loser.name} didn't accept ${winner.name}'s feelings...`
					}
				}

				if(loserWinnerRelationship &&
					loserWinnerRelationship.type == enums.Relationships.Love &&
					(!winnerLoserRelationship || winnerLoserRelationship.type != enums.Relationships.Love) &&
					this.roll() < 15) {
					output += `\n${loser.name} confessed ${this.their(loserFighter.gender)} feelings for ${winner.name}! What a shock!`;
	
					let loveOdds = 16;
					loveOdds += winnerFighter.mood - 3; // Odds are affected by the confessee's mood
	
					switch(winnerFighter.orientation) {
						case 'Men':
							if(loserFighter.gender == 'Female') {
								loveOdds = 0;
							}
							break;
						case 'Women':
							if(loserFighter.gender == 'Male') {
								loveOdds = 0;
							}
							break;
						case 'Nobody':
							loveOdds = 0;
							break;
					}
	
					if(winnerLoserRelationship && winnerLoserRelationship.type == enums.Relationships.Hate) {
						loveOdds -= 12;
					}
	
					if(this.roll() < loveOdds) {
						output += `\n${winner.name} accepted ${loser.name}'s feelings!`;
						await sql.addRelationship(loser, winner.id, enums.Relationships.Love);
					} else {
						output += `\n${winner.name} didn't accept ${loser.name}'s feelings...`
					}
				}
			}

			for(let i = 0; i < tournament.fighters.length; i++) {
				if(!tournament.fighters[i]) continue;
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
							f.mood = Math.min(6, f.mood + 1);
							break;
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
			let outdated = false;
			if(tournament.fighters.find(f => f.id == leftFighter.id && f.bracket == leftFighter.bracket && f.position > leftFighter.position)) {
				outdated = true;
			}
			if(tournament.fighters.find(f => f.id == rightFighter.id && f.bracket == rightFighter.bracket && f.position > rightFighter.position)) {
				outdated = true;
			}
			if(outdated) {
				oldFighters.push(leftFighter);
				oldFighters.push(rightFighter);
			} else {
				if((leftFighter && leftFighter.status == enums.TournamentFighterStatuses.Won) ||
					(!rightFighter)) {
					newFighters.push(leftFighter);
					oldFighters.push(rightFighter);
				} else {
					newFighters.push(rightFighter);
					oldFighters.push(leftFighter);
				}
			}
		}

		for(const f of oldFighters) {
			if(f) {
				await sql.eliminateFighter(f);
			}
		}

		if(newFighters[0].bracket != newFighters[1].bracket) {
			// It's time for the championship finals!
			newFighters[0].position = 0;
			newFighters[1].position = 1;
			newFighters[0].bracket = enums.Brackets.Winners;
			newFighters[1].bracket = enums.Brackets.Winners;
			newFighters[0].score = 0;
			newFighters[1].score = 0;
			newFighters[0].status = enums.TournamentFighterStatuses.Pending;
			newFighters[1].status = enums.TournamentFighterStatuses.Pending;
		} else {
			let nextPosition = 0;
			for(let f of newFighters) {
				if(f) {
					if(f.bracket == enums.Brackets.Losers) {
						if(tournament.round == 1) {
							f.position -= f.position % 2;
						} else {
							while(newFighters.find(f => f.bracket == enums.Brackets.Losers && f.position == nextPosition)) {
								nextPosition++;
							}
							f.position = nextPosition;
							nextPosition++;
						}
					} else {
						f.position = Math.floor(f.position / 2);
					}
					f.status = enums.TournamentFighterStatuses.Pending;
					f.score = 0;
				}
			}
		}
		tournament.fighters = newFighters;
		tournament.round++;

		// Generate odds
		for(let i = 0; i < tournament.fighters.length; i += 2) {
			const mistake = this.roll() < 3;
			const thisFighter = tournament.fighters[i];
			const otherFighter = tournament.fighters.find(f => f.position == thisFighter.position + 1 && f.bracket == thisFighter.bracket);
			if(thisFighter && otherFighter) {
				const thisF = await sql.getFighterById(thisFighter.id);
				const otherF = await sql.getFighterById(otherFighter.id);
				thisFighter.odds = this.getOdds(thisF, otherF, tournament.round, mistake);
				otherFighter.odds = this.getOdds(otherF, thisF, tournament.round, mistake);
			}
		}

		// Give money to broke players
		let players = await sql.getPlayers(tournament.channel);
		for(const player of players) {
			if(player.coins < tournament.round * 10) {
				player.coins = tournament.round * 10;
				await sql.setPlayer(player);
			}
		}

		if(tournament.fighters.length == 2) {
			return `\nIt's time for the tournament finals!`;
		} else {
			return `\nIt's time for the next round of the tournament!`;
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
			let embed = new Discord.RichEmbed();
			
			for(let i = 0; i < tournament.fighters.length; i += 2) {
				const leftFighter = tournament.fighters[i];
				const rightFighter = tournament.fighters[i+1];
	
				embed.setTitle(`Betting: ${leftFighter.name} VS ${rightFighter.name}`)
				.setColor(0x00AE86);

				if(leftFighter && rightFighter) {
					if(leftFighter.status == enums.TournamentFighterStatuses.Pending) {
						let description = '';
						description += `Bet on ${leftFighter.name}: x${leftFighter.odds} returns`;
						description += `\nBet on ${rightFighter.name}: x${rightFighter.odds} returns`;
						description += `\nMinimum bet: ${tournament.round * 10} coins`;

						embed.setDescription(description);
						break;
					}
				}
			}
			const bets = await sql.getBets(player.channel);
			let betLines = [];
			for(const bet of bets) {
				const p = await sql.getPlayerById(bet.playerId);
				const f = await sql.getFighterById(bet.fighterId);
				betLines.push(`${p.name}: ${bet.amount} coins on ${f.name}`);
			}
			if(betLines.length > 0) {
				embed.addField('Outstanding Bets', betLines.join('\n'));
			}
			return embed;
		}
	},
	async sponsor(player, target) {
		await sql.addSponsor(player.id, target.id);
		return `${player.name} has become ${target.name}'s sponsor.`;
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
	async event(tournament) {
		let embed = new Discord.RichEmbed();
		embed.setTitle('MEANWHILE...')
			.setColor(0x00AE86);

		// Select a fighter to act
		let tournamentFighter = tournament.fighters[Math.floor(Math.random() * tournament.fighters.length)];
		let fighter = await sql.getFighterById(tournamentFighter.id);

		let output = '';
		let outgoingRelationships = fighter.relationships.filter(r => r.fromId == fighter.id && tournament.fighters.find(f => f.id == r.toId));
		const eventRoll = this.roll();
		if(this.roll() < 7 || outgoingRelationships.length == 0) {
			// Solo event!
			if(eventRoll < 11) {
				// Training event
				output = templates.TrainingScenes[Math.floor(Math.random() * templates.TrainingScenes.length)];
				if(this.roll() < 3) {
					// Strength up
					fighter.strength++;
					output += `\n$0's Strength increases to ${fighter.strength}!`;
				} else if (this.roll() < 3 && fighter.techs.length < 3) {
					// New technique
					const style = await sql.getStyle(channel, fighter1.style.name);
					tech = style.techs[fighter.techs.length];
					fighter.techs.push(tech);
					await sql.addTechnique(fighter, tech);
					output += `\n$0 masters the ${tech.name} technique!`;
				}
			} else {
				// Mood event
				output = templates.MoodScenes[Math.floor(Math.random() * templates.MoodScenes.length)];
				if(this.roll() < 11 && fighter.mood < enums.Moods.Determined) {
					fighter.mood++;
					output += `\n$0's mood improves!`;
				}
			}
			await sql.setFighter(fighter);
		} else {
			// Relationship event!
			const relationship = outgoingRelationships[Math.floor(Math.random() * outgoingRelationships.length)];
			let targetFighter = await sql.getFighterById(relationship.toId);
			if(targetFighter) {
				switch(relationship.type) {
					case enums.Relationships.Friend:
						output = templates.FriendshipScenes[Math.floor(Math.random() * templates.FriendshipScenes.length)];
						if(this.roll() < 11 && fighter.mood < enums.Moods.Determined) {
							fighter.mood++;
							output += `\n$0's mood improves!`;
						}
						if(this.roll() < 11 && targetFighter.mood < enums.Moods.Determined) {
							targetFighter.mood++;
							output += `\n$1's mood improves!`;
						}
						break;
					case enums.Relationships.Hate:
						output = templates.HateScenes[Math.floor(Math.random() * templates.HateScenes.length)];
						if(this.roll() < 11 && fighter.mood > enums.Moods.Depressed) {
							fighter.mood--;
							output += `\n$0's mood worsens.`;
						}
						break;
					case enums.Relationships.Rival:
						if(this.roll() < 7) {
							// Fight
							output = templates.FightScenes[Math.floor(Math.random() * templates.FightScenes.length)];
							let score1 = fighter.strength + this.roll();
							let score2 = targetFighter.strength + this.roll();
							// Determine winner - fighters[0] defeats fighters[1]
							let fighters = [];
							let scores = [];
							if(score1 > score2) {
								fighters = [fighter, targetFighter];
								scores = [score1, score2];
							} else {
								fighters = [targetFighter, fighter];
								scores = [score2, score1];
							}
							let difference = scores[0] - scores[1];
							if(difference < 2) {
								output += `\nThe fight ends without a clear winner...`;
							} else {
								battleLog += `\n${fighters[0].name} wins the fight!`;
								if(this.roll() < 16 && fighters[0].mood < enums.Moods.Determined) {
									fighters[0].mood++;
									output += `\n${fighters[0].name}'s mood improves!`;
								}
								if(this.roll() < 16 && fighters[1].mood > enums.Moods.Depressed) {
									fighters[0].mood++;
									output += `\n${fighters[1].name}'s mood worsens.`;
								}
							}
						} else {
							// No change
							output = templates.RivalScenes[Math.floor(Math.random() * templates.RivalScenes.length)];
						}
						break;
					case enums.Relationships.Love:
						let mutual = fighter.relationships.find(r => r.toId == fighter.id && r.fromId == targetFighter.id && r.type == enums.Relationships.Love);
						if(mutual) {
							output = templates.LoveScenes[Math.floor(Math.random() * templates.LoveScenes.length)];
							if(this.roll() < 16 && fighter.mood < enums.Moods.Determined) {
								fighter.mood++;
								output += `\n$0's mood improves!`;
							}
							if(this.roll() < 16 && targetFighter.mood < enums.Moods.Determined) {
								targetFighter.mood++;
								output += `\n$1's mood improves!`;
							}
						} else {
							if(this.roll() < 6) {
								// Confession!
								output = `$0 confessed ${this.their(fighter.gender)} feelings for ${targetFighter.name}!`;

								let loveOdds = 16;
								loveOdds += loserFighter.mood - 3; // Odds are affected by the confessee's mood

								let returnRelationship = fighter.relationships.find(r => r.toId == fighter.id && r.fromId == targetFighter.id);

								switch(targetFighter.orientation) {
									case 'Men':
										if(fighter.gender == 'Female') {
											loveOdds = 0;
										}
										break;
									case 'Women':
										if(fighter.gender == 'Male') {
											loveOdds = 0;
										}
										break;
									case 'Nobody':
										loveOdds = 0;
										break;
								}

								if(returnRelationship && returnRelationship.type == enums.Relationships.Hate) {
									loveOdds -= 12;
								}

								if(this.roll() < loveOdds) {
									output += `\n${targetFighter.name} accepted ${fighter.name}'s feelings!`;
									await sql.addRelationship(targetFighter, fighter.id, enums.Relationships.Love);
									if(this.roll() < 16 && fighter.mood < enums.Moods.Determined) {
										fighter.mood++;
										output += `\n$0's mood improves!`;
									}
								} else {
									output += `\n${targetFighter.name} didn't accept ${fighter.name}'s feelings...`
									if(this.roll() < 16 && fighter.mood > enums.Moods.Depressed) {
										fighter.mood--;
										output += `\n$0's mood worsens.`;
									}
								}
							} else {
								// No change
								output = templates.CrushScenes[Math.floor(Math.random() * templates.CrushScenes.length)];
							}
						}
						break;
				}

				await sql.setFighter(fighter);
				await sql.setFighter(targetFighter);
			}
		}

		output.replace(/\$0they/g, this.they(fighter.gender));
		output.replace(/\$0their/g, this.their(fighter.gender));
		output.replace(/\$0/g, fighter.name);
		output.replace(/\$1/g, targetFighter.name);

		if(output.length == 0) {
			return null;
		} else {
			embed.setDescription(output);
			return embed;
		}
	},
	async testMethod(player, param) {
		let styles = await sql.getStyles(player.channel);
		
		for(const style of styles) {
			style.techs.push(await this.newTech(style, 3 + Math.floor(Math.random() * 3)));
			style.techs.push(await this.newTech(style, 6 + Math.floor(Math.random() * 3)));
			style.techs.push(await this.newTech(style, 9 + Math.floor(Math.random() * 3)));
			await sql.setStyle(style);
		}
	},
	roll() {
		return Math.floor(Math.random() * 20) + 1;
	}
}
