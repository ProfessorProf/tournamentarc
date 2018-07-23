const numeral = require('numeral');
const sql = require('./sql.js');
const Discord = require("discord.js");
const hour = (60 * 60 * 1000);

module.exports = {
	// Gets an Embed showing a player's status.
	async getPlayerDescription(channel, username) {
		return this.generatePlayerDescription(await sql.getPlayerByUsername(channel, username));
	},
	async getPlayerDescriptionByID(channel, id) {
		return this.generatePlayerDescription(await sql.getPlayerById(channel, id));
	},
	async generatePlayerDescription(player) {
		if(! player) {
			console.log('Player not found');
			return null;
		}
		let embed = new Discord.RichEmbed();
		let now = new Date().getTime();
		embed.setTitle(player.name.toUpperCase())
			.setColor(0x00AE86);

		if(player.isNemesis) {
			embed.setDescription('NEMESIS');
		} else if(this.isFusion(player)) {
			embed.setDescription(`Fusion between ${player.fusionNames[0]} and ${player.fusionNames[1]}`);
		}
		
		// Display Glory/Rank
		let stats = `${player.glory} Glory\n`;
		let glory = player.glory;
		if(this.isFusion(player)) glory = Math.floor(glory / 2);
		if(glory < 50) {
			stats += 'Unranked Warrior\n';
		} else if(glory< 100) {
			stats += 'Rank C Warrior\n';
		} else if(glory < 150) {
			stats += 'Rank B Warrior\n';
		} else if(glory < 250) {
			stats += 'Rank A Warrior\n';
		} else if(glory < 400) {
			stats += 'Rank S Warrior\n';
		} else if(glory < 600) {
			stats += 'Rank SS Warrior\n';
		} else if(glory < 1000) {
			stats += 'Rank SSS Warrior\n';
		} else {
			stats += 'Ultimate Warrior\n';
		}
		
		stats += 'Power Level: '
		let level = numeral(player.level.toPrecision(2));
		stats += level.format('0,0');
		if(player.status.find(s => s.type == 2)) {
			stats += '?';
		}
		
		if(player.gardenLevel >= 1) {
			stats += '\nGardening Level: ' + Math.floor(player.gardenLevel);
		}
		
		if(player.searchLevel >= 1) {
			stats += '\nSearch Level: ' + Math.floor(player.actionLevel);
		}

		embed.addField('Stats', stats);

		// Display Status
		let statuses = [];
		for(let i in player.status) {
			let s = player.status[i];
			if(!s.ends || s.endTime > now) {
				switch(s.type) {
					case 0:
						statuses.push(`Defeated (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case 2:
						statuses.push(`Training (${this.getTimeString(now - s.startTime)} so far)`);
						break;
					case 4:
						statuses.push(`Overdriving (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case 5:
						statuses.push(`Ready to train`);
						break;
				}
			}
			if(player.gardenTime > now) {
				statuses.push(`Ready to garden in ${this.getTimeString(now - gardenTime)}`);
			}
			if(player.actionTime > now) {
				statuses.push(`Ready to act in ${this.getTimeString(now - actionTime)}`);
			}
		}
		if(statuses.length > 0) {
			embed.addField('Status', statuses.join('\n'));
		}

		// Display Inventory
		let items = [];
		for(let i in player.items) {
			let item = player.items[i];
			items.push(`${item.name} (${item.count} held)`);
		}
		if(items.length > 0) {
			embed.addField('Inventory', items.join('\n'));
		}

		// Display Offers
		let offers = [];
		for(let i in player.offers) {
			let o = player.offers[i];
			if(o.expires > now) {
				switch(o.type) {
					case 0:
						offers.push(`${o.name} wants to \`!fight\` ${o.targetId ? 'you' : 'anyone'} (expires in ${this.getTimeString(o.expires - now)})`);
						break;
				}
			}
		}
		if(offers.length > 0) {
			embed.addField('Offers', offers.join('\n'));
		}
		
		return embed;
	},
	// Scout a player's estimated power level and status.
    async scoutPlayer(channel, target) {
		let now = new Date().getTime();
		let player = await sql.getPlayer(channel, target);
		if(!player) {
			console.log('Player not found');
			return null;
		}
		let embed = new Discord.RichEmbed();
		embed.setTitle(`SCANNING ${player.name.toUpperCase()}...`)
			.setColor(0x00AE86);

		if(player.isNemesis) {
			embed.setDescription('NEMESIS');
		} else if(this.isFusion(player)) {
			embed.setDescription(`Fusion between ${player.fusionNames[0]} and ${player.fusionNames[1]}`);
		}
		
		stats = 'Power Level: '
		let level = numeral(player.level.toPrecision(2));
		stats += level.format('0,0');
		let training = player.status.find(s => s.type == 2);
		if(training) {
			stats += '?';

			let trainingTime = now - training.startTime;
			stats += `\nTraining for ${this.getTimeString(trainingTime)}`;
		}
		embed.addField('Stats', stats);

		return embed;
    },
	// Converts a time in milliseconds into a readable string.
    getTimeString(milliseconds) {
        let seconds = Math.ceil(milliseconds / 1000);
        let minutes = Math.floor(seconds / 60);
        seconds -= minutes * 60;
        let hours = Math.floor(minutes / 60);
        minutes -= hours * 60;
        
        let output = '';
        if(hours) {
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
    async displayRoster(channel) {
		let players = await sql.getPlayers(channel);
		let now = new Date().getTime();
		
		// Build the table out in advance so we can get column widths
		let headers = [4, 4, 6, 11];
		let rows = [];
		for(let i in players) {
			let p = players[i];
			let row = [];
			row.push(p.name);
			if(p.name.length > headers[0]) headers[0] = p.name.length;
			
			let rank = '-';
			if(p.glory > 1000) {
				rank = 'U';
			} else if(p.glory > 700) {
				rank = 'SSS';
			} else if(p.glory > 400) {
				rank = 'SS';
			} else if(p.glory > 250) {
				rank = 'S';
			} else if(p.glory > 150) {
				rank = 'A';
			} else if(p.glory > 100) {
				rank = 'B';
			} else if(p.glory > 50) {
				rank = 'C';
			}
			row.push(rank);
			
			p.status.sort((a,b) => b.priority - a.priority).filter(s => s.priority > 0);
			
			let status = p.status.length > 0 ? p.status[0].name : 'Normal';
			
			row.push(status);
			if(status.length > headers[2]) headers[2] = status.length;
			
			let level = numeral(p.level.toPrecision(2)).format('0,0');
			if(p.status.find(s => s.type == 2)) {
				level += '?'
			}
			if(p.isNemesis) {
				level += ' [NEMESIS]';
			}
			if(this.isFusion(p)) {
				level += ' [FUSION]';
			}
			let orbs = p.items.find(i => i.type == 0);
			if(orbs > 0) {
				level += `[${'*'.repeat(orbs)}]`;
			}
			
			row.push(level);
			if(level.length > headers[3]) headers[3] = level.length;
			
			rows.push(row);
		}
		
		// Print out the table
		let output = '';
		output += 'NAME' + ' '.repeat(headers[0] - 3);
		output += 'RANK' + ' '.repeat(headers[1] - 3);
		output += 'STATUS' + ' '.repeat(headers[2] - 5);
		output += 'POWER LEVEL' + ' '.repeat(headers[3] - 10);
		output += '\n';
		output += '-'.repeat(headers[0]) + ' ';
		output += '-'.repeat(headers[1]) + ' ';
		output += '-'.repeat(headers[2]) + ' ';
		output += '-'.repeat(headers[3]) + ' ';
		output += '\n';
		
		for(let i in rows) {
			let row = rows[i];
			output += row[0].padEnd(headers[0] + 1);
			output += row[1].padEnd(headers[1] + 1);
			output += row[2].padEnd(headers[2] + 1);
			output += row[3].padEnd(headers[3] + 1);
			output += '\n';
		}
		
		return output;
	},
	// Nemesis attack command.
	async attack(channel, player, target) {
		let player1 = await sql.getPlayerByUsername(channel, player);
		let player2 = await sql.getPlayer(channel, target);
		let nemesis = await sql.getNemesis(channel);
		let embed = new Discord.RichEmbed();
		let now = new Date().getTime();
		
		embed.setTitle(`NEMESIS INVASION`)
			.setColor(0x00AE86);
		embed.setDescription(`**${player1.name}** attacks without warning, targeting **${player2.name}!**`);
		
		nemesis.attackTime = now + hour * 3;
		await sql.setNemesis(channel, nemesis);
		
		return await this.fight(player1, player2, embed);
	},
	// Either fights a player or sends them a challenge, depending on whether or not they've issued a challenge.
    async tryFight(channel, player, target) {
		let player1 = await sql.getPlayerByUsername(channel, player);
		let embed = new Discord.RichEmbed();
		let now = new Date().getTime();
		
		if(target) {
			let player2 = await sql.getPlayer(channel, target);
			if(!player1.offers.find(o => o.playerId == player2.id)) {
				// If they haven't offered, send a challenge
				embed.setTitle('BATTLE CHALLENGE')
					.setDescription(`**${player1.name}** has issued a battle challenge to **${player2.name}**! ${player2.name}, enter \`!fight ${player1.name}\` to accept the challenge and begin the battle.`);
				await sql.addOffer(player1, player2, 0);
				return embed;
			} else {
				// FIGHT
				embed.setTitle(`${player1.name.toUpperCase()} vs ${player2.name.toUpperCase()}`)
						.setColor(0x00AE86);
				return this.fight(player1, player2, embed);
			}
		} else {
			await sql.addOffer(player1, null, 0);
			embed.setTitle('BATTLE CHALLENGE')
				.setDescription(`**${player1.name}** wants to fight anyone! The next person to enter \`!fight ${player1.name}\` will accept the challenge and begin the battle.`);
			return embed;
		}
	},
	// End training and power up a player. Will do nothing if player is not training.
	async completeTraining(player) {
		const now = new Date().getTime();
		const trainingState = player.status.find(s => s.type == 2);
		if (! trainingState) {
			// Not training, so no need to do anything
			return;
		}
		await sql.deleteStatus(player.id, 2);
		const hours = (now - trainingState.startTime) / hour;
		if (hours > 1000) {
			hours = 1000;
		}
		this.addHeat(world, hours);
		const newPowerLevel = this.getPowerLevel(world.heat);
		if (this.isFusion(player)) {
			newPowerLevel *= 1.3;
		}
		if (player.status.find(s => s.type == 10)) {
			newPowerLevel *= 1.5;
		}
		console.log(`Upgrading ${player.name}'s power level after ${hours} hours of training, +${newPowerLevel}`);
		if (hours <= 16) {
			player.level += newPowerLevel * (hours / 16);
		} else {
			player.level += newPowerLevel * (1 + 0.01 * (hours / 16));
		}
	},
	// Fight between two players.
    async fight(player1, player2, embed) {
		let channel = player1.channel;
		let world = await sql.getWorld(channel);
		let now = new Date().getTime();
		
		// If fighters are training - take them out of training and power them up
		await this.completeTraining(player1);
		await this.completeTraining(player2);

		embed.addField('Power Levels', `${player1.name}: ${numeral(player1.level.toPrecision(2)).format('0,0')}\n${player2.name}: ${numeral(player2.level.toPrecision(2)).format('0,0')}`);
		
		// Randomize, then adjust skill ratings
		let skill1 = (Math.random() + Math.random() + Math.random() + Math.random()) / 2;
		let skill2 = (Math.random() + Math.random() + Math.random() + Math.random()) / 2;
		
		// TODO: Support Revenge bonuses via History table
		if(player1.revenge && player1.revenge[player2.name]) {
			console.log(`${player1.name} revenge bonus ${player1.revenge[player2.name]}`);
			skill1 *= 1 + 0.1 * player1.revenge[player2.name];
		}
		if(player2.revenge && player2.revenge[player1.name]) {
			console.log(`${player2.name} revenge bonus ${player2.revenge[player1.name]}`);
			skill2 *= 1 + 0.1 * player2.revenge[player1.name];
		}
		if(player1.isNemesis) {
			skill2 *= 1.15;
		}
		if(player2.isNemesis) {
			skill1 *= 1.15;
		}
		
		console.log(`${player1.name}: PL ${Math.floor(player1.level * 10) / 10}, Skill ${Math.floor(skill1 * 10) / 10}`);
		console.log(`${player2.name}: PL ${Math.floor(player2.level * 10) / 10}, Skill ${Math.floor(skill2 * 10) / 10}`);
		
		// Final battle scores!
		let score1 = Math.sqrt(player1.level * skill1);
		let score2 = Math.sqrt(player2.level * skill2);
		
		let battleLog = '';
		if(skill1 < 0.8) {
			battleLog += player1.name + ' underestimates their foe!';
		} else if(skill1 > 1.2) {
			battleLog += player1.name + ' surpasses their limits!';
		} else if(skill1 > 1.5) {
			battleLog += player1.name + ' goes even *further beyond!*';
		} else {
			battleLog += player1.name + ' fights hard!';
		}
		battleLog += ' Battle rating: ' + numeral(score1.toPrecision(2)).format('0,0') + '\n';
		
		if(skill2 < 0.8) {
			battleLog += player2.name + ' underestimates their foe!';
		} else if(skill2 > 1.2) {
			battleLog += player2.name + ' surpasses their limits!';
		} else if(skill2 > 1.5) {
			battleLog += player2.name + ' goes *even further beyond!*';
		} else {
			battleLog += player2.name + ' fights hard!';
		}
		battleLog += ' Battle rating: ' + numeral(score2.toPrecision(2)).format('0,0') + '\n';
		
		embed.addField('Ready? Fight!', battleLog);
	
		// Determine winner - player[0] defeats player[1]
		let players = [];
		if(score1 > score2) {
			players = [player1, player2];
			skills = [skill1, skill2];
		} else {
			players = [player2, player1];
			skills = [skill2, skill1];
		}
		
		let history = players[1].isNemesis ? await sql.getNemesisHistory(channel) : null;
		let output = await this.handleFightOutcome(world, players[0], players[1], skills[0], skills[1], history, embed);
		embed.addField('Results', output);
		return embed;
	},
	// Process updates based on who won and lost a fight.
	async handleFightOutcome(data, winner, loser, winnerSkill, loserSkill, nemesisHistory) {
		let now = new Date().getTime();
		let output = '';
		
		// Loser gains the Ready status, winner loses ready status if training
		if(winner.status.find(s => s.type == 2)) {
			await sql.deleteStatus(winner.id, 2);
		}
		
		// Determine length of KO
		let difference = winnerSkill - loserSkill + 1; 	// Effective 0-2
		let intensity = Math.max(winnerSkill, loserSkill); // Effective 0-2
		let hours = Math.ceil(difference * intensity * 3);
		hours = Math.max(hours, Math.min(hours, 12), 1);
		
		if(nemesisHistory) {
			// The Nemesis is dead!
			// TODO: Special Nemesis
			// Delete Nemesis, punish player
			loser.isNemesis = false;
			loser.level = this.getPowerLevel(data.heat * 0.8);
			hours = 24;
			output += `${winner.name} defeated the Nemesis! Everyone's sacrifices were not in vain!`;

			// Give 20 Glory for each failed fight against this Nemesis
			let gloryGains = {};
			for(let i in nemesisHistory) {
				let h = nemesisHistory[i];
				if(gloryGains[h.id]) {
					gloryGains[h.id].glory += 20;
				} else {
					gloryGains[h.id] = {
						name: h.name,
						oldGlory: h.glory,
						glory: 20
					};
				}
			}
			for(let key in gloryGains) {
				let g = gloryGains[key];
				let rankUp = this.rankUp(g.oldGlory, g.glory);
				output += `\n${g.name} gains ${g.glory} glory! Totals glory: ${g.oldGlory + g.glory}`;
				if(rankUp) {
					output += `\n${g.name}'s Rank has increased!`;
				}
			}
			data.nemesis = null;
			data.nemesisDate = new Date().getTime();
		}
		
		// Award glory to the winner
		let glory = Math.ceil(Math.min((loser.level / winner.level) * 10, 100));
		let rankUp = this.rankUp(winner.glory, glory);
		winner.glory += glory;
		output += `${winner.name} is the winner! +${glory} glory. Total glory: ${winner.glory}`;
		if(rankUp) {
			output += `\n${winner.name}'s Rank has increased!`;
		}
		
		if(winner.isNemesis) {
			// Longer KO, but the Nemesis is weakened
			hours = 12;
			let maxPowerLoss = (loserSkill < 0.8 ? 0.025 : (loserSkill > 1.2 ? 0.075 : 0.05)) * loser.level;
			let powerLoss = Math.min(maxPowerLoss, loser.level * 0.5);
			output += `\nThe Nemesis is weakened, losing ${numeral(powerLoss.toPrecision(2)).format('0,0')} Power.`;
			winner.level -= powerLoss;
		}
		
		// Orb transfers
		let loserOrbs = loser.items.find(i => i.type == 0);
		let winnerOrbs = winner.items.find(i => i.type == 0);
		if(loserOrbs) {
			output += `\n${winner.name} took ${loserOrbs.count} magic orbs from ${loser.name}!`;
			await sql.addItems(winner.id, 0, loserOrbs.count);
			await sql.takeItems(winner.id, 0, loserOrbs.count);
			if(loserOrbs.count + winnerOrbs.count == 7) {
				output += `\n${winner.name} has gathered all seven magic orbs!`;
			}
		}
		
		// Immortality processing
		if(loser.status.find(s => s.type == 11)) {
			hours = 1;
		}
		
		// Death timer
		output += `\n${loser.name} will be able to fight again in ${hours} ${hours > 1 ? 'hours' : 'hour'}.`;
		await sql.addStatus(loser.channel, loser.id, 0, now + hours * hour);
        
		// Delete challenges
		await sql.deleteOffersFromFight(winner.id, loser.id);
        
		// Save changes
		await sql.setPlayer(loser);
		await sql.setPlayer(winner);
		
		// TODO: Update battle history

		return output;
	},
	// Determines whether or not a glory increase resulted in a rank increase.
	rankUp(glory, gloryIncrease) {
		return (glory < 50 && glory + gloryIncrease >= 50) ||
			   (glory < 100 && glory + gloryIncrease >= 100) ||
			   (glory < 150 && glory + gloryIncrease >= 150) ||
			   (glory < 250 && glory + gloryIncrease >= 250) ||
			   (glory < 400 && glory + gloryIncrease >= 400) ||
			   (glory < 700 && glory + gloryIncrease >= 700) ||
			   (glory < 1000 && glory + gloryIncrease >= 1000);
	},
	// Destroy command.
	// TODO: Make sure this works.
	async destroy(channel) {
		let data = await sql.getWorld(channel);
		let players = await sql.getPlayers(channel);
		let nemesis = await sql.getNemesis(channel);
		let now = new Date().getTime();
		let embed = new Discord.RichEmbed();
		
		embed.setTitle('DESTRUCTION')
			.setDescription('The Nemesis uses their full power to destroy an entire planet!')
			.setColor(0x00AE86);
		
		let targetPlayers = [];
		for(let i in players) {
			let p = players[i];
			if(p && !p.isNemesis && !p.status.find(s => s.type == 0)) {
				targetPlayers.push(p);
			}
		}
		let targets = Math.min(targetPlayers.length, 3);
		let firstTarget = Math.floor(Math.random() * targetPlayers.length);
		
		for(let i = 0; i < targets; i++) {
			let target = targetPlayers[(firstTarget + i) % targetPlayers.length];
			let trainingState = target.status.find(s => s.type == 2);
			if(trainingState) {
				await sql.deleteStatus(target.id, 2);
				let hours = (now - trainingState.startTime) / hour;
				if(hours > 72) hours = 72;
				this.addHeat(data, hours);
				let newPowerLevel = this.getPowerLevel(data.heat);
				if(this.isFusion(player1)) {
					newPowerLevel *= 1.3;
				}
				if(target.status.find(s => s.type == 10)) {
					newPowerLevel *= 1.5;
				}
				console.log(`Upgrading ${player1.name}'s power level after ${hours} hours of training, +${newPowerLevel}`);
				if(hours <= 16) {
					target.level += newPowerLevel * (hours / 16);
				} else {
					target.level += newPowerLevel * (1 + 0.01 * (hours / 16));
				}
			}
			
			let output = '';
			if(target.status.find(s => s.type == 11)) {
				addStatus(target.channel, target.id, 0, now + hour * 1);
				output += `${target.name} cannot fight for another 1 hour!\n`;
			} else {
				addStatus(target.channel, target.id, 0, now + hour * 12);
				output += `${target.name} cannot fight for another 12 hours!\n`;
			}
			await sql.setPlayer(target);
		}
		
		nemesis.destroyTime = now + 24 * hour;
		await sql.setNemesis(nemesis);
		
		embed.addField('Damage Report', output);
		return embed;
	},
	// Attempt to create a new Fusion.
    async fuse(channel, message, sourcePlayerName, targetPlayerName, fusionName) {

		const sourcePlayer = await sql.getPlayerByUsername(channel, sourcePlayerName);
		sourcePlayerName = sourcePlayer.name;

		// Make sure the requestor isn't already a fusion.
		if (sourcePlayer.fusionId === sourcePlayer.id) {
			return 'Your fusion can\'t support any more members.';
		} else if (sourcePlayer.fusionId) {
			return 'You are already a member of a fusion! Also, how did you even manage to see this message?';
		}

		const targetPlayer = await sql.getPlayer(channel, targetPlayerName);
		targetPlayerName = targetPlayer.name;
		const now = new Date().getTime();

		// Make sure the target actually exists
		if (! targetPlayer || ! targetPlayer.id) {
			return 'Player not found.';
		}

		// Make sure the player isn't trying to fuse with themselves.
		if (targetPlayer.id == sourcePlayer.id) {
			return 'You can\'t fuse with yourself! This is a PG game!';
		}

		// Make sure the target isn't already a fusion.
		if (targetPlayer.fusionId === targetPlayer.id) {
			return 'That is already a fusion! Their combined power repels you.';
		} else if (targetPlayer.fusionId) {
			return 'That person is already a member of a fusion! Their combined power repels you.';
		}

		const world = await sql.getWorld(channel);

		// Check to see if we're accepting an offer
		for (const offer of sourcePlayer.offers) {
			if (offer.type === 1 && offer.targetId === sourcePlayer.id && fusionName === offer.extra) {
				await this.completeTraining(sourcePlayer);
				await this.completeTraining(targetPlayer);
				const name = fusionName ? fusionName : sourcePlayer.name + '|' + targetPlayer.name;
				const fusedPlayer = {
					name: name,
					channel: channel,
					level: Math.max(sourcePlayer.level, this.getPowerLevel(world.heat)) + Math.max(targetPlayer.level, this.getPowerLevel(world.heat)),
					powerWish: sourcePlayer.powerWish || targetPlayer.powerWish,
					glory: sourcePlayer.glory + targetPlayer.glory,
					challenges: {},
					lastActive: now,
					aliveDate: now,
					trainingState: 0,
					trainingDate: now,
					gardenTime: now - hour,
					actionTime: now - hour,
					gardenLevel: sourcePlayer.gardenLevel + targetPlayer.gardenLevel,
					flowers: sourcePlayer.flowers + targetPlayer.flowers,
					orbs: sourcePlayer.orbs + targetPlayer.orbs,
					fusionTime: now,
					nemesisFlag: false,
					fusionFlag: true,
					wishFlag: false,
					config: {
						alwaysPrivate: false,
						ping: false,
						pronoun: 'they'
					}
				};
				const fusionId = await sql.addPlayer(fusedPlayer);
				await sql.setFusionId(fusionId, fusionId);
				await sql.setFusionId(sourcePlayer.id, fusionId);
				await sql.setFusionId(targetPlayer.id, fusionId);
				await sql.deleteAllFusionOffers(sourcePlayer.id);
				await sql.deleteAllFusionOffers(targetPlayer.id);
				await sql.addStatus(channel, fusionId, 9, now + 24 * hour);
				console.log(`Created fusion of ${sourcePlayerName} and ${targetPlayerName} as ${name}`);
				message.channel.send('The two warriors pulsate with a strange power as they perform an elaborate dance. Suddenly, there is a flash of light!');
				return this.getPlayerDescriptionById(channel, fusionId);
			}
		}

		// Send an offer to the other player
		
		const expiration = now + hour * 6;
		const fuseCommand = `!fuse ${sourcePlayerName}` + (fusionName ? ' ' + fusionName : '');
		sql.addOffer(sourcePlayer, targetPlayer, 1, fusionName);
		console.log(`'New fusion offer from ${sourcePlayerName} for player ${targetPlayerName} expires at ${new Date(expiration)}`);
		return `**${sourcePlayerName}** wants to fuse with **${targetPlayerName}**! ${targetPlayerName}, enter ${fuseCommand} to accept the offer and fuse.\n` +
			'**Warning**: You can only fuse once per game! Fusion lasts 24 hours before you split again.\n' + 
			'The offer will expire in six hours.';
	},
	// Establish a character as a new Nemesis.
    async setNemesis(channel, username) {
		let data = await sql.getWorld(channel);
		let player = await sql.getPlayerByUsername(channel, username)
		let nemesis = await sql.getNemesis(channel);
		if(!player) {
			console.log('Player not found');
			return null;
		}
		
		let embed = new Discord.RichEmbed();
		let now = new Date().getTime();
		embed.setTitle(player.name.toUpperCase())
			.setColor(0x00AE86);
		
		// Raise heat, abort training
		this.addHeat(data, 100);
		await sql.deleteStatus(player.id, 5);
		
		if(!nemesis) {
			nemesis = {
				id: player.id,
				startTime: now,
				attackTime: now,
				destroyTime: now,
				reviveTime: now,
				cooldown: now
			};
		}
		
		if(Math.random() < 0.25) {
			// A very special Nemesis
			player.level = this.getPowerLevel(data.heat) * 4;
			nemesis.type = 1;
		} else {
			// A normal Nemesis
			player.level = this.getPowerLevel(data.heat) * 10;
			nemesis.type = 0;
		}
		
		await sql.setHeat(channel, data.heat);
		await sql.setPlayer(player);
		await sql.setNemesis(channel, nemesis);
		embed.setDescription(`**${player.name}** has become a Nemesis, and is invading the whole galaxy! Their rampage will continue until they are defeated in battle.\nThe Nemesis can no longer use most peaceful actions, but in exchange, they have access to several powerful new abilities. For more information, enter \`!help nemesis\`.`);
		return embed;
	},
	// Check whether or not a player is a fusion.
    isFusion(player) {
        return player.fusionNames.length == 2;
	},
	// Generates a new power level based on the current Heat.
    getPowerLevel(heat) {
        let base = Math.ceil((1 + Math.random()) * 100);
        let level = Math.pow(base, 1 + heat / 1200);
        if(level > 1000000000000000000) level = 1000000000000000000; // JS craps out if we go higher than this
        return level;
	},
	// Increase Heat, modified by reset count.
    addHeat(data, heat) {
		if(!data) return;
        let addedHeat = heat * Math.pow(1.05, data.resets);
        data.heat += addedHeat;
        console.log('Heat increased by ' + heat + ' to ' + data.heat);
	},
	// End a fusion.
	// TODO: Needs to be rewritten for SQL DB.
	breakFusion(data, fusion) {
		let player1 = this.loadPlayer(data, fusion.fusion[0], true);
		let player2 = this.loadPlayer(data, fusion.fusion[1], true);
		if(!player1 || !player2) {
			console.log("Fusion break failed - a player doesn't exist");
			return;
		}
		let fusionWins = fusion.glory - player1.glory - player2.glory;
		let fusionGardening = fusion.gardenLevel - player1.gardenLevel - player2.gardenLevel;
		player1.level = fusion.level / 2;
		player2.level = fusion.level / 2;
		player1.glory += Math.floor(fusionWins / 2);
		player2.glory += Math.floor(fusionWins / 2);
		player1.gardenLevel += fusionGardening / 2;
		player2.gardenLevel += fusionGardening / 2;
		player1.fusion = null;
		player2.fusion = null;
		player1.lastActive = new Date().getTime();
		player2.lastActive = new Date().getTime();

		// Semi-randomly distribute orbs
		while(fusion.orbs > 0) {
			if(Math.random() > 0.5) {
				player1.orbs++;
			} else {
				player2.orbs++;
			}
			fusion.orbs--;
		}
		delete data.players[fusion.name];
	},
	// Add a new plant to the garden.
	async plant(channel, name, plantName) {
		let player = await sql.getPlayerByUsername(channel, name);
		let garden = await sql.getGarden(channel);
		let now = new Date().getTime();

		// Which spot is open?
		let slot = 0;
		while(slot < 3 && garden.plants[slot]) {
			slot++;
		}
		if(slot == 3) {
			return;
		}

		if(!plantName) {
			plantName = 'flower';
		}

		let plantId = -1;
		switch(plantName.toLowerCase()) {
			case 'flower':
				plantId = 1;
				break;
			case 'rose':
				plantId = 2;
				break;
			case 'carrot':
				plantId = 3;
				break;
			case 'bean':
				plantId = 4;
				break;
			case 'algae':
				plantId = 5;
				break;
			case 'fern':
				plantId = 6;
				break;
		}
		if(plantId == -1) {
			return;
		}

		await sql.addPlant(channel, plantId, slot);
		let output = `${player.name} plants a ${plantName.toLowerCase()} in the garden.`;
		
		// Update garden level
		if(!player.gardenLevel) player.gardenLevel = 0;
		let oldGardenLevel = Math.floor(player.gardenLevel);
		player.gardenLevel += 1 / (1 + player.gardenLevel);
		let newGardenLevel = Math.floor(player.gardenLevel);
		if(newGardenLevel > oldGardenLevel) {
			output += '\nGardening level increased!';
		}
		player.gardenTime = now + hour;
		await sql.setPlayer(player);

		return output;
	},
	async water(channel, name) {
		let player = await sql.getPlayerByUsername(channel, name);
		let garden = await sql.getGarden(channel);
		let now = new Date().getTime();

		let time = ((Math.random() * 20 + 5) * 60 * 1000) * (1 + 0.09 * player.gardenLevel);
		let output = `${player.name} works on the garden.`;
		for(let i in garden.plants) {
			let plant = garden.plants[i];
			if(plant) {
				let duration = plant.growTime * hour;
				let oldProgress = ((now - plant.startTime) / duration) * 100;
				if(oldProgress < 100) {
					plant.startTime -= time;
					let newProgress = ((now - plant.startTime) / duration) * 100;
					let growth = Math.ceil(newProgress - oldProgress);
					output += `\n${plant.name} growth increases by ${growth}%.`;
					if(newProgress >= 100) {
						output += ` It's ready to be picked!`;
					}
					await sql.setPlant(plant);
				}
			}
		}
		
		// Update garden level
		if(!player.gardenLevel) player.gardenLevel = 0;
		let oldGardenLevel = Math.floor(player.gardenLevel);
		player.gardenLevel += 1 / (1 + player.gardenLevel);
		let newGardenLevel = Math.floor(player.gardenLevel);
		if(newGardenLevel > oldGardenLevel) {
			output += '\nGardening level increased!';
		}
		player.gardenTime = now + hour;
		await sql.setPlayer(player);

		return output;
	},
	async pick(channel, name, plantType) {
		let player = await sql.getPlayerByUsername(channel, name);
		let garden = await sql.getGarden(channel);
		let now = new Date().getTime();

		// Find the plant
		let plant = plantType ?
			garden.plants.find(p => p && p.name.toLowerCase() == plantType.toLowerCase() && p.startTime + p.growTime * hour < now) :
			garden.plants.find(p => p && p.startTime + p.growTime * hour < now);
		if(!plant) return;

		// Transfer it into the inventory
		await sql.addItems(channel, player.id, plant.type, 1);
		await sql.deletePlant(plant.id);

		return `${player.name} picks a ${plant.name.toLowerCase()}.`;
	},
	async useItem(channel, name, plantType, targetName) {
		// TODO
	},
	// Expand the garden.
	// TODO: Needs to be rewritten for SQL DB.
	expand(data, player) {
		let output = '';
		let expansion = (Math.random() * 25 + 5) * (1 + 0.09 * player.gardenLevel) / (100 * (3 + data.gardenLevel));
		console.log(`${player.name} advanced garden level by ${Math.floor(expansion * 10) / 10}`);
		let percent = Math.floor(100 * expansion);
		output += `**${player.name}** works on the garden, with a gardening rating of ${percent}%.`;
		data.gardenLevel += expansion;
		this.updateGarden(data);
		
		let gardenTime = hour * 6 / Math.pow(1.05, data.gardenLevel);
		output += `\nThe garden will now grow a healing flower every ${this.getTimeString(gardenTime)}.`;
		
		let oldGardenLevel = Math.floor(player.gardenLevel);
		player.gardenLevel += 1 / (1 + player.gardenLevel);
		let newGardenLevel = Math.floor(player.gardenLevel);
		if(newGardenLevel > oldGardenLevel) {
			output += '\nGardening level increased!';
		}
		return output;
	},
	// Reset the universe.
	async resetData(channel) {
		await sql.resetWorld(channel);
		let players = await sql.getPlayers(channel);
		for(let i in players) {
			let player = players[i];
			if(this.isFusion(player)) {
				await sql.deletePlayer(player.id);
			} else {
				player.glory = Math.floor(player.glory / 2);
				player.level = this.getPowerLevel(0);
				player.gardenTime = now;
				player.gardenLevel = 0;
				player.actionTime = now;
				player.actionLevel = 0;
				player.fusionId = null;
				player.nemesisFlag = false;
				player.fusionFlag = false;
				player.wishFlag = false;
				await sql.setPlayer(player);
			}
		}
	},
	// Register a new player.
	async registerPlayer(channel, username, name) {
		let world = await sql.getWorld(channel);
		let now = new Date().getTime();
		this.addHeat(world, 10);
		let player = {
			name: name,
			username: username,
			channel: channel,
			glory: 0,
			level: this.getPowerLevel(world.heat),
			lastActive: now,
			gardenTime: now - hour,
			gardenLevel: 0,
			actionTime: now - hour,
			actionLevel: 0,
			fusionId: null,
			nemesisFlag: false,
			fusionFlag: false,
			wishFlag: false,
			config: {
				alwaysPrivate: false,
				ping: false,
				pronoun: 'they'
			}
		};
		await sql.addPlayer(player);
		console.log(`Registered ${username} as ${name}`);
	},
	// Display the garden status.
	async displayGarden(channel) {
		let embed = new Discord.RichEmbed();
		let garden = await sql.getGarden(channel);

		embed.setTitle('The Garden')
			.setColor(0x00AE86);
		
		let plants = garden.plants.map(p => this.getPlantStatus(p));
		let plantStatus = '';
		for(let i = 0; i < 3; i++) {
			plantStatus += `Plant #${i+1}: ${plants[i]}\n`
		}

		let gardenLevel = Math.floor(garden.gardenLevel);
		let gardenProgress = Math.floor((gardenLevel - Math.floor(gardenLevel)) * 100);
		let researchLevel = Math.floor(garden.researchLevel);
		let researchProgress = Math.floor((researchLevel - Math.floor(researchLevel)) * 100);

		plantStatus += `\nGarden Level: ${gardenLevel} (${gardenProgress}%)\nResearch Level: ${researchLevel} (${researchProgress}%)`
		embed.setDescription(plantStatus);

		return embed;
	},
	getPlantStatus(plant) {
		let now = new Date().getTime();
		let output = '';
		if(plant) {
			let duration = plant.growTime * hour;
			let endTime = plant.startTime + duration;
			if(now > endTime) {
				return `${plant.name} (ready to pick)`;
			} else {
				console.log(now - plant.startTime);
				console.log((now - plant.startTime) / duration);
				let progress = Math.floor(((now - plant.startTime) / duration) * 100 );
				return `${plant.name} (${progress}% complete)`;
			}
		} else {
			return '(Nothing planted)';
		}
	},
	// Update the garden based on time passing.
	// TODO: Needs to be rewritten for SQL DB.
	updateGarden(data) {
		let now = new Date().getTime();
		let maxTime = (6 * hour) / Math.pow(1.05, data.gardenLevel);
		
		let oneFlowerAgo = now - maxTime;
		while(data.gardenTime < oneFlowerAgo) {
			data.gardenTime += maxTime;
			data.flowers++;
		}
		if(data.flowers >= Math.floor(3)) {
			data.flowers = 3;
			data.gardenTime = now;
		}
	},
	// Search for orbs.
	// TODO: Needs to be rewritten for SQL DB.
	search(data, player) {
		let output = '';
		let now = new Date().getTime();
		if(!data.wishTime) data.wishTime = now;
		let effectiveTime = Math.min(now - data.wishTime, hour * 72);
		let searchModifier = effectiveTime / (hour * 72);
		let searchChance = (0.03 + 0.01 * player.searchLevel) * searchModifier;
		if (data.lostOrbs > 0) {
			let roll = Math.random();
			if(roll < searchChance) {
				console.log(`${player.name} found an orb on roll ${Math.floor(roll * 1000) / 10} out of chance ${Math.floor(searchChance * 1000) / 10}`);
				// They found an orb!
				player.orbs++;
				data.lostOrbs--;
				output = `${player.name} searches the world, and finds a magic orb!`;
				if(player.orbs == 7) {
					output += "\nYou've gathered all seven magic orbs! Enter `!help wish` to learn about your new options.";
				}
			} else {
				console.log(`${player.name} found nothing on roll ${Math.floor(roll * 1000) / 10} out of chance ${Math.floor(searchChance * 1000) / 10}`);
				output = `${player.name} searches the world, but finds nothing of value.`;
			} 
		} else {
			output += `${player.name} searches the world, but there are no orbs left to find.`;
		}
		
		let oldSearchLevel = Math.floor(player.searchLevel);
		player.searchLevel += 1 / (1 + player.searchLevel);
		let newSearchLevel = Math.floor(player.searchLevel);
		if(newSearchLevel > oldSearchLevel) {
			output += '\nSearch level increased!';
		}
		
		return output;
	},
	// Make a wish on the orbs.
	// TODO: Needs to be rewritten for SQL DB.
	wish(data, player, wish) {
		let output = '';
		let now = new Date().getTime();
		
		switch(wish) {
			case 'power':
				player.level *= Math.random() + 2.5;
				player.powerWish = true;
				output += 'You can feel great power surging within you!';
				break;
			case 'resurrection':
				for(let i in data.players) {
					let p = data.players[i];
					if(p && p.aliveDate > now) {
						output += `${p.name} is revived!\n`;
						p.aliveDate = now;
						p.level *= 1.2;
					}
				}
				break;
			case 'immortality':
				output += 'No matter how great of an injury, you suffer, you will always swiftly return!';
				player.immortalityWish = true;
				player.aliveDate = now;
				break;
			case 'gardening':
				output += 'You have become the master of gardening!';
				player.gardenLevel += 12;
				break;
			case 'ruin':
				output += '**The countdown to the destruction of the galaxy has begun!**\n'
					+ 'You have 24 hours to defeat the Nemesis! If the Nemesis is still alive when time runs out, everything will be destroyed.';
				data.nemesis.ruinTime = now;
				data.nemesis.ruinCheckTime = now;
				break;
		}
		
		player.orbs = 0;
		data.wishTime = now;
		data.lostOrbs = 7;
		
		return output;
	},
	async train(channel, name) {
		let player = await sql.getPlayerByUsername(channel, name);
		await sql.deleteStatus(player.id, 5);
		await sql.addStatus(channel, player.id, 2);
	}
}