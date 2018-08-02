const enums = require('./enum.js');
const numeral = require('numeral');
const sql = require('./sql.js');
const Discord = require("discord.js");
const fs = require('fs');
const hour = (60 * 60 * 1000);

module.exports = {
	// Gets an Embed showing a player's status.
	async getPlayerDescription(channel, username) {
		return this.generatePlayerDescription(await sql.getPlayerByUsername(channel, username));
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
		let now = new Date().getTime();
		embed.setTitle(player.name.toUpperCase())
			.setColor(0x00AE86);

		if(player.isNemesis) {
			embed.setDescription('NEMESIS');
		} else if(this.isFusion(player)) {
			embed.setDescription(`Fusion between ${player.fusionNames[0]} and ${player.fusionNames[1]}`);
		} else if(player.isHenchman) {
			let energyPercent = Math.max(100 - 20 * player.henchmanDefeats, 0)
			embed.setDescription(`HENCHMAN\nProtecting the Nemesis at ${energyPercent}% power`);
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
		
		if(player.status.find(s => s.type == enums.StatusTypes.Fern)) {
			stats += 'Unknown';
		} else {
			let level = this.getPowerLevel(player);
			stats += numeral(level.toPrecision(2)).format('0,0');
			if(player.status.find(s => s.type == enums.StatusTypes.Training)) {
				stats += '?';
			}
		}
		if(player.gardenLevel >= 1) {
			stats += '\nGardening Level: ' + Math.floor(player.gardenLevel);
		}
		
		if(player.actionLevel >= 1) {
			stats += '\nAction Level: ' + Math.floor(player.actionLevel);
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
					case 3:
						statuses.push(`Energized (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case 4:
						statuses.push(`Overdriving (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case 5:
						statuses.push(`Ready to train`);
						break;
					case 6:
						statuses.push(`Enhanced senses (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case 7:
						statuses.push(`Power boosted (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case 8:
						statuses.push(`Power level hidden (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case 10:
						statuses.push(`Blessed with power`);
						break;
					case 11:
						statuses.push(`Immortal`);
						break;
					case 12:
						statuses.push(`Berserk (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
				}
			}
		}
		if(player.gardenTime > now) {
			statuses.push(`Ready to garden in ${this.getTimeString(player.gardenTime - now)}`);
		}
		if(player.actionTime > now) {
			statuses.push(`Ready to act in ${this.getTimeString(player.actionTime - now)}`);
		}
		if(player.isNemesis) {
			let nemesis = await sql.getNemesis(player.channel);
			if(nemesis.attackTime > now) {
				statuses.push(`Ready to attack in ${this.getTimeString(nemesis.attackTime - now)}`);
			}
			if(nemesis.destroyTime > now) {
				statuses.push(`Ready to destroy in ${this.getTimeString(nemesis.destroyTime - now)}`);
			}
			if(nemesis.burnTime > now) {
				statuses.push(`Ready to burn in ${this.getTimeString(nemesis.burnTime - now)}`);
			}
			if(nemesis.energizeTime > now) {
				statuses.push(`Ready to energize a henchman in ${this.getTimeString(nemesis.energizeTime - now)}`);
			}
			if(nemesis.reviveTime > now) {
				statuses.push(`Ready to revive a henchman in ${this.getTimeString(nemesis.reviveTime - now)}`);
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
					case enums.OfferTypes.Fight:
						offers.push(`${o.name} wants to \`!fight\` ${o.targetId ? 'you' : 'anyone'} (expires in ${this.getTimeString(o.expires - now)})`);
						break;
					case enums.OfferTypes.Fusion:
						offers.push(`${o.name} wants to \`!fuse\` with you (expires in ${this.getTimeString(o.expires - now)})`);
						break;
					case enums.OfferTypes.Recruit:
						if(o.targetId) {
							offers.push(`${o.name} wants you to \`!join\` them (expires in ${this.getTimeString(o.expires - now)})`);
						} else {
							offers.push(`${o.name} wants someone to \`!join\` them (expires in ${this.getTimeString(o.expires - now)})`);
						}
						break;
					case enums.OfferTypes.Taunt:
						offers.push(`${o.name} taunted you to \`!fight\` them (expires in ${this.getTimeString(o.expires - now)})`);
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
		let training = player.status.find(s => s.type == enums.StatusTypes.Training);
		let trainingTime = now - (training ? training.startTime : 0);
		if(player.status.find(s => s.type == enums.StatusTypes.Fern)) {
			stats += 'Unknown';
		} else {
			let seenLevel = this.getPowerLevel(player);
			if(training) {
				// Estimate post-training power level
				let world = await sql.getWorld(player.channel);
				const hours = trainingTime / hour;
				if (hours > 72) {
					hours = 72;
				}
				const newPowerLevel = Math.pow(100, 1 + (world.heat + hours) / 1200);
				if (this.isFusion(player)) {
					newPowerLevel *= 1.3;
				}
				if (player.status.find(s => s.type == 10)) {
					newPowerLevel *= 1.5;
				}
				if (hours <= 16) {
					seenLevel += newPowerLevel * (hours / 16);
				} else {
					seenLevel += newPowerLevel * (1 + 0.01 * (hours / 16));
				}
			}
			let level = numeral(seenLevel.toPrecision(2));
			stats += level.format('0,0');
		}
		if(training) {
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
			if (p.fusionId && p.fusionId != p.id) {
				continue;
			}
			if(p.lastActive + 24 * hour < now) {
				continue;
			}

			let row = [];
			row.push(p.name);
			if(p.name.length > headers[0]) headers[0] = p.name.length;
			
			let rank = '-';
			if(p.glory >= 1000) {
				rank = 'U';
			} else if(p.glory >= 700) {
				rank = 'SSS';
			} else if(p.glory >= 400) {
				rank = 'SS';
			} else if(p.glory >= 250) {
				rank = 'S';
			} else if(p.glory >= 150) {
				rank = 'A';
			} else if(p.glory >= 100) {
				rank = 'B';
			} else if(p.glory >= 50) {
				rank = 'C';
			}
			row.push(rank);
			
			p.status.sort((a,b) => b.priority - a.priority);
			let statuses = p.status.filter(s => s.priority > 0);
			
			let status = statuses.length > 0 ? statuses[0].name : 'Normal';
			
			row.push(status);
			if(status.length > headers[2]) headers[2] = status.length;
			
			let seenLevel = this.getPowerLevel(p);
			let level = numeral(seenLevel.toPrecision(2)).format('0,0');
			
			if(p.status.find(s => s.type == 8)) {
				level = 'Unknown'
			} else if(p.status.find(s => s.type == 2)) {
				level += '?'
			}
			if(p.isNemesis) {
				level += ' [NEMESIS]';
			}
			if(p.isHenchman) {
				level += ' [HENCHMAN]';
			}
			if(this.isFusion(p)) {
				level += ' [FUSION]';
			}
			let orbs = p.items.find(i => i.type == 0);
			if(orbs && orbs.count > 0) {
				level += ` [${'*'.repeat(orbs.count)}]`;
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
	async unfight(channel, username) {
		let player = await sql.getPlayerByUsername(channel, username);
		await sql.unfightOffers(player.id);
		return `${player.name} no longer wants to fight anyone.`;
	},
	async taunt(channel, player, target) {

	},
	// Either fights a player or sends them a challenge, depending on whether or not they've issued a challenge.
    async tryFight(channel, player, target) {
		let player1 = await sql.getPlayerByUsername(channel, player);
		let embed = new Discord.RichEmbed();
		
		if(target) {
			let player2 = await sql.getPlayer(channel, target);
			if(!player1.offers.find(o => o.playerId == player2.id) && !player2.isNemesis && !player2.isHenchman) {
				// If they haven't offered, send a challenge
				embed.setTitle('BATTLE CHALLENGE')
					.setColor(0x00AE86)
					.setDescription(`**${player1.name}** has issued a battle challenge to **${player2.name}**! ${player2.name}, enter \`!fight ${player1.name}\` to accept the challenge and begin the battle.`);
				await sql.addOffer(player1, player2, 0);
				return {embed: embed};
			} else {
				// FIGHT
				embed.setTitle(`${player1.name.toUpperCase()} vs ${player2.name.toUpperCase()}`)
						.setColor(0x00AE86);
				return this.fight(player1, player2, embed);
			}
		} else {
			await sql.addOffer(player1, null, 0);
			embed.setTitle('BATTLE CHALLENGE')
				.setColor(0x00AE86)
				.setDescription(`**${player1.name}** wants to fight anyone! The next person to enter \`!fight ${player1.name}\` will accept the challenge and begin the battle.`);
			return {embed: embed};
		}
	},
	// End training and power up a player. Will do nothing if player is not training.
	async completeTraining(player) {
		let world = await sql.getWorld(player.channel);
		const now = new Date().getTime();
		const trainingState = player.status.find(s => s.type == 2);
		if (! trainingState) {
			// Not training, so no need to do anything
			return;
		}
		await sql.deleteStatus(player.channel, player.id, 2);
		const hours = (now - trainingState.startTime) / hour;
		if (hours > 1000) {
			hours = 1000;
		}
		this.addHeat(world, hours);
		const newPowerLevel = this.newPowerLevel(world.heat);
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

		await sql.setWorld(world);
	},
	// Fight between two players.
    async fight(player1, player2, embed) {
		let channel = player1.channel;	
		let world = await sql.getWorld(channel);

		// Give the attacked player a ping if they want one
		let ping = null;
		if(player2.config.ping) {
			ping = player2.userId;
		}
		
		// If fighters are training - take them out of training and power them up
		await this.completeTraining(player1);
		await this.completeTraining(player2);

		// Bean bonuses
		let level1 = this.getPowerLevel(player1);
		let level2 = this.getPowerLevel(player2);
		if(player1.status.find(s => s.type == 7)) {
			level1 *= 1.12;
		}
		if(player2.status.find(s => s.type == 7)) {
			level2 *= 1.12;
		}

		if(player2.isNemesis) {
			// Someone attacked the Nemesis, summon henchmen!
			let henchmenMessages = [];
			let henchmen = await sql.getHenchmen(channel);
			for(let i in henchmen) {
				let h = await sql.getPlayerById(henchmen[i].id);
				if(!h.status.find(s => s.type == 0) && h.id != player1.id) {
					// Living henchman, send energy
					let boost = this.getPowerLevel(h) * (1 - 0.2 * henchmen[i].defeats);
					if(boost > 0) {
						henchmenMessages.push(`${h.name} boosts ${player2.name}'s energy by ${numeral(boost.toPrecision(2)).format('0,0')}!`);
					}
					level2 += boost;
				}
			}
			if(henchmenMessages.length > 0) {
				embed.addField('The Nemesis summons henchmen!', henchmenMessages.join('\n'));
			}
		}
		embed.addField('Power Levels', `${player1.name}: ${numeral(level1.toPrecision(2)).format('0,0')}\n${player2.name}: ${numeral(level2.toPrecision(2)).format('0,0')}`);
		
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
		
		console.log(`${player1.name}: PL ${Math.floor(level1 * 10) / 10}, Skill ${Math.floor(skill1 * 10) / 10}`);
		console.log(`${player2.name}: PL ${Math.floor(level2 * 10) / 10}, Skill ${Math.floor(skill2 * 10) / 10}`);
		
		// Final battle scores!
		let score1 = Math.sqrt(level1 * skill1);
		let score2 = Math.sqrt(level2 * skill2);
		
		let battleLog = '';
		if(skill1 < 0.8) {
			battleLog += `${player1.name} underestimates ${this.their(player1.config.pronoun)} foe!`;
		} else if(skill1 > 1.2) {
			battleLog += `${player1.name} surpasses ${this.their(player1.config.pronoun)} limits!`;
		} else if(skill1 > 1.5) {
			battleLog += `${player1.name} goes *even further beyond!*`;
		} else {
			battleLog += `${player1.name} fights hard!`;
		}
		battleLog += ` Battle rating: ${numeral(score1.toPrecision(2)).format('0,0')}\n`;
		
		if(skill2 < 0.8) {
			battleLog += `${player2.name} underestimates ${this.their(player2.config.pronoun)} foe!`;
		} else if(skill2 > 1.2) {
			battleLog += `${player2.name} surpasses ${this.their(player2.config.pronoun)} limits!`;
		} else if(skill2 > 1.5) {
			battleLog += `${player2.name} goes *even further beyond!*`;
		} else {
			battleLog += `${player2.name} fights hard!`;
		}
		battleLog += ` Battle rating: ${numeral(score2.toPrecision(2)).format('0,0')}\n`;
		
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
		
		let nemesisHistory = players[1].isNemesis ? await sql.getNemesisHistory(channel) : null;
		let output = await this.handleFightOutcome(world, players[0], players[1], skills[0], skills[1], nemesisHistory);
		embed.addField('Results', output);

		return {
			embed: embed,
			ping: ping
		};
	},
	// Process updates based on who won and lost a fight.
	async handleFightOutcome(data, winner, loser, winnerSkill, loserSkill, nemesisHistory) {
		let now = new Date().getTime();
		let output = '';
		
		// Loser gains the Ready status, winner loses ready status if training
		if(winner.status.find(s => s.type == 2)) {
			await sql.deleteStatus(data.channel, winner.id, 2);
		}
		await sql.deleteStatus(data.channel, loser.id, 12);
		
		// Determine length of KO
		let difference = winnerSkill - loserSkill + 1; 	// Effective 0-2
		let intensity = Math.max(winnerSkill, loserSkill); // Effective 0-2
		let hours = Math.ceil(difference * intensity * 3);
		hours = Math.max(hours, Math.min(hours, 12), 1);
		
		let trueForm = false;
		let winnerLevel = this.getPowerLevel(winner);
		let loserLevel = this.getPowerLevel(loser);
		if(nemesisHistory) {
			// The Nemesis is dead!
			let nemesis = await sql.getNemesis(winner.channel);
			if(nemesis.type == 1) {
				// Reveal true form
				output += `For a moment, it seemed like ${loser.name} had lost... but then ${loser.config.pronoun} revealed ${this.their(loser.config.pronoun)} true form!\n` +
					`The real battle begins here!\n`;
				nemesis.type = 2;
				loser.level = nemesis.basePower * (Math.random() + 2.5);
				nemesis.attackTime = now;
				nemesis.destroyTime = now;
				nemesis.energizeTime = now;
				nemesis.reviveTime = now;
				hours = 0;
				trueForm = true;
			} else {
				// End the nemesis
				nemesis.id = null;
				nemesis.cooldown = now + 24 * hour;
				await sql.deleteRecruitOffers(channel);
				await sql.deleteHenchmen(nemesis.channel);
				loser.level = this.newPowerLevel(data.heat * 0.8);
				hours = 24;
				output += `${winner.name} defeated the Nemesis!`
				if(nemesisHistory.length > 1 && !winner.isHenchman) {
					output +=  `Everyone's sacrifices were not in vain!`;
				}
				output += `\n`;

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
					output += `${g.name} gains ${g.glory} glory! Totals glory: ${g.oldGlory + g.glory}\n`;
					if(rankUp) {
						output += `${g.name}'s Rank has increased!\n`;
					}
				}
			}

			await sql.setNemesis(nemesis.channel, nemesis);
		}
		
		// Award glory to the winner
		let glory = Math.ceil(Math.min(loserLevel / winnerLevel * 10, 100));
		if(loser.isNemesis) glory *= 3;
		let rankUp = this.rankUp(winner.glory, glory);
		winner.glory += glory;
		if(trueForm) {
			output += `${winner.name} gains ${glory} glory. Total glory: ${winner.glory}`;
		} else {
			output += `${winner.name} is the winner! +${glory} glory. Total glory: ${winner.glory}`;
		}
		if(rankUp) {
			output += `\n${winner.name}'s Rank has increased!`;
		}
		
		if(winner.isNemesis) {
			// Longer KO, but the Nemesis is weakened
			hours = 12;
			let maxPowerLoss = (loserSkill < 0.8 ? 0.025 : (loserSkill > 1.2 ? 0.075 : 0.05)) * this.getPowerLevel(loser);
			let powerLoss = Math.min(maxPowerLoss, this.getPowerLevel(loser) * 0.5);
			output += `\nThe Nemesis is weakened, losing ${numeral(powerLoss.toPrecision(2)).format('0,0')} Power.`;
			winner.level -= powerLoss;
		}
		
		// Orb transfers
		if(!trueForm) {
			let loserOrbs = loser.items.find(i => i.type == 0);
			let winnerOrbs = winner.items.find(i => i.type == 0);
			if(loserOrbs) {
				output += `\n${winner.name} took ${loserOrbs.count} magic orbs from ${loser.name}!`;
				await sql.addItems(winner.channel, winner.id, 0, loserOrbs.count);
				await sql.addItems(loser.channel, loser.id, 0, -loserOrbs.count);
				if(loserOrbs.count + (winnerOrbs ? winnerOrbs.count : 0) == 7) {
					output += `\n${winner.name} has gathered all seven magic orbs! Enter \`!help wish\` to learn about your new options.`;
				}
			}
			// Overdrive penalty
			if(loser.status.find(s => s.type == 4)) {
				hours += 3;
			}

			// Immortality
			if(loser.status.find(s => s.type == 11)) {
				hours = 1;
			}
		}

		// Log henchman defeats
		if(loser.isHenchman) {
			await sql.recordHenchmanDefeat(loser.channel, loser.id);
			if(winner.isNemesis) {
				output += `\n${loser.name} betrayed the Nemesis, and paid for it with exile!`;
				await sql.setHenchman(loser.channel, loser.id, false);
			}
		}

		// Nemesis hijack
		if(winner.isHenchman && loser.isNemesis && !trueForm) {
			output += `\n${winner.name} has betrayed ${this.their(winner.config.pronoun)} master and become the new Nemesis! The nightmare continues!`;
			await sql.setPlayer(winner);
			await this.setNemesis(winner.channel, winner.username);
			winner = await sql.getPlayer(winner.channel, winner.username);
		}
		
		// Death timer
		if(hours) {
			output += `\n${loser.name} will be able to fight again in ${hours} ${hours > 1 ? 'hours' : 'hour'}.`;
			await sql.addStatus(loser.channel, loser.id, 0, now + hours * hour);
		}
        
		// Delete challenges
		await sql.deleteOffersFromFight(winner.id, loser.id);
		if(winner.status.find(s => s.type == 12)) {
			// Winner is berserk - re-challenge the world
			await sql.addOffer(winner, null, 0);
		}
		
		// Add new row to history
		await sql.addHistory(winner.channel, winner.id, this.getPowerLevel(winner), winnerSkill, loser.id, this.getPowerLevel(loser), loserSkill);
		
		// Reset fight clock
		loser.lastFought = now;
		winner.lastFought = now;

		// Save changes
		await sql.setPlayer(loser);
		await sql.setPlayer(winner);
		
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
	// Sends a player a recruitment offer to join the Nemesis.
    async recruit(channel, targetName) {
		let nemesis = await sql.getNemesis(channel);
		let player = await sql.getPlayerById(nemesis.id);
		let embed = new Discord.RichEmbed();
		
		if(targetName) {
			let target = await sql.getPlayer(channel, targetName);
			// Send an offer
			embed.setTitle('HENCHMAN RECRUITMENT')
				.setColor(0x00AE86)
				.setDescription(`**${player.name}** wishes for **${target.name}** to join ${this.their(player.config.pronoun)} army of evil! ` +
				`If you join, you'll become more powerful, and your power will make the Nemesis stronger. ` +
				`${target.name}, enter \`!join ${player.name}\` to accept the offer and serve the Nemesis in battle.`);
			await sql.addOffer(player, target, 2);
			return {embed: embed};
		} else {
			await sql.addOffer(player, null, 2);
			embed.setTitle('HENCHMAN RECRUITMENT')
				.setColor(0x00AE86)
				.setDescription(`**${player.name}** wishes for anyone to join ${this.their(player.config.pronoun)} army of evil! ` +
				`If you join, you'll become more powerful, and your power will make the Nemesis stronger. ` +
				`the next person to enter \`!join ${player.name}\` will accept the offer and serve the Nemesis in battle.`);
			return {embed: embed};
		}
	},
	// Boot a player from the Henchmen list.
    async exile(channel, targetName) {
		let target = await sql.getPlayer(channel, targetName);
		let nemesis = await sql.getNemesis(channel);
		let nemesisPlayer = await sql.getPlayerById(nemesis.id);
		
		await sql.setHenchman(channel, target.id, false);
		await sql.deleteStatus(channel, target.id, 3);

		return `**${target.name}** is no longer ${nemesisPlayer.name}'s henchman!`;
	},
	// Power up a henchman.
    async energize(channel, targetName) {
		let target = await sql.getPlayer(channel, targetName);
		let nemesis = await sql.getNemesis(channel);
		let nemesisPlayer = await sql.getPlayerById(nemesis.id);
		let now = new Date().getTime();
		
		let increase = this.getPowerLevel(target) * .3;
		await sql.addStatus(channel, target.id, 3, now + hour * 3);
		nemesis.energizeTime = now + hour * 3;
		await sql.setNemesis(channel, nemesis);

		return `**${nemesisPlayer.name}** grants **${target.name}** a fragment of their mighty power!\n` +
			`${target.name}'s power level increases by ${numeral(increase.toPrecision(2)).format('0,0')}!`;
	},
	// Revive a dead henchman.
    async revive(channel, targetName) {
		let target = await sql.getPlayer(channel, targetName);
		let nemesis = await sql.getNemesis(channel);
		let nemesisPlayer = await sql.getPlayerById(nemesis.id);
		let now = new Date().getTime();
		
		await sql.deleteStatus(channel, target.id, 0);
		await sql.addStatus(channel, target.id, 5);
		nemesis.reviveTime = now + hour * 24;
		await sql.setNemesis(channel, nemesis);

		return `**${nemesisPlayer.name}** breathes new life into **${target.name}**!`;
	},
	// Sends a player a recruitment offer to join the Nemesis.
    async joinNemesis(channel, name) {
		let player = await sql.getPlayerByUsername(channel, name);
		let nemesis = await sql.getNemesis(channel);
		let nemesisPlayer = await sql.getPlayerById(nemesis.id);
		let henchmen = await sql.getHenchmen(channel);
		let world = await sql.getWorld(channel);
		
		await sql.setHenchman(channel, player.id, true);

		// If we just hit max henchmen, delete all outstanding recruitment offers
		let maxHenchmen = Math.floor(world.maxPopulation / 5) - 1;
		if(henchmen.length + 1 >= maxHenchmen) {
			await sql.deleteRecruitOffers(channel);
		}
		return `**${player.name}** has joined the Nemesis in ${this.their(nemesisPlayer.config.pronoun)} campaign of destruction!\n` +
			`Your power level is increased, and you automatically boost the Nemesis's power when they come under attack. For more info, enter \`!help henchmen\`.`;
	},
	// Destroy command.
	async destroy(channel) {
		let players = await sql.getPlayers(channel);
		let nemesis = await sql.getNemesis(channel);
		let nemesisPlayer = await sql.getPlayerById(nemesis.id);
		let now = new Date().getTime();
		let embed = new Discord.RichEmbed();
		
		embed.setTitle('DESTRUCTION')
			.setDescription(`The Nemesis uses ${this.their(nemesisPlayer.config.pronoun)} full power to destroy an entire planet!`)
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
		
		let output = '';
		for(let i = 0; i < targets; i++) {
			let target = targetPlayers[(firstTarget + i) % targetPlayers.length];
			await this.completeTraining(target);
			
			if(target.status.find(s => s.type == 11)) {
				await sql.addStatus(target.channel, target.id, 0, now + hour * 1);
				output += `${target.name} cannot fight for another 1 hour!\n`;
			} else {
				await sql.addStatus(target.channel, target.id, 0, now + hour * 12);
				output += `${target.name} cannot fight for another 12 hours!\n`;
			}
			await sql.setPlayer(target);
		}
		
		nemesis.destroyTime = now + 24 * hour;
		await sql.setNemesis(channel, nemesis);
		
		if(output.length > 0) {
			embed.addField('Damage Report', output);
			return embed;
		} else {
			return null;
		}
	},
	async burn(channel) {
		let nemesis = await sql.getNemesis(channel);
		let garden = await sql.getGarden(channel);
		let now = new Date().getTime();
		let embed = new Discord.RichEmbed();

		let firstPick = Math.floor(Math.random() * 3);
		for(let i = 0; i < 3; i++) {
			let index = (i + firstPick) % 3;
			if(garden.plants[index]) {
				// Found a plant, burn it
				let plant = garden.plants[index];
				await sql.deletePlant(plant.id);

				nemesis.burnTime = now + 12 * hour;
				await sql.setNemesis(channel, nemesis);
				
				return `The Nemesis lays waste to the garden, destroying a ${plant.name.toLowerCase()}!`;
			}
		}

		return `No plants were found to burn!`
	},
	// Attempt to create a new Fusion.
    async fuse(channel, sourcePlayerName, targetPlayerName, fusionName) {

		const sourcePlayer = await sql.getPlayerByUsername(channel, sourcePlayerName);
		sourcePlayerName = sourcePlayer.name;
		const targetPlayer = await sql.getPlayer(channel, targetPlayerName);
		targetPlayerName = targetPlayer.name;
		const now = new Date().getTime();
		const world = await sql.getWorld(channel);

		// Check to see if we're accepting an offer
		let fusionOffer = sourcePlayer.offers.find(o => o.type == 1 && o.playerId == targetPlayer.id && fusionName == o.extra);
		if(fusionOffer) {
			await this.completeTraining(sourcePlayer);
			await this.completeTraining(targetPlayer);
			const name = fusionName ? fusionName : sourcePlayer.name + '|' + targetPlayer.name;
			const fusedPlayer = {
				name: name,
				channel: channel,
				level: (sourcePlayer.level + targetPlayer.level) / 2 + this.newPowerLevel(world.heat),
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
					alwaysPrivate: sourcePlayer.config.alwaysPrivate && targetPlayer.config.alwaysPrivate,
					ping: sourcePlayer.config.ping && targetPlayer.config.ping,
					pronoun: sourcePlayer.config.pronoun == targetPlayer.config.pronoun ? sourcePlayer.config.pronoun : 'they'
				}
			};
			const fusionId = await sql.addPlayer(fusedPlayer);
			fusedPlayer.id = fusionId;
			await sql.setFusionId(fusionId, fusionId);
			await sql.setFusionId(sourcePlayer.id, fusionId);
			await sql.setFusionId(targetPlayer.id, fusionId);
			await sql.deleteAllFusionOffers(sourcePlayer.id);
			await sql.deleteAllFusionOffers(targetPlayer.id);
			await sql.addStatus(channel, fusionId, 9, now + 24 * hour);
			for (const item of sourcePlayer.items) {
				await sql.addItems(channel, fusionId, item.type, item.count);
				await sql.addItems(channel, sourcePlayer.id, item.type, -item.count);
			}
			for (const item of targetPlayer.items) {
				await sql.addItems(channel, fusionId, item.type, item.count);
				await sql.addItems(channel, targetPlayer.id, item.type, -item.count);
			}
			console.log(`Created fusion of ${sourcePlayerName} and ${targetPlayerName} as ${name}`);
			
			return {embed: await this.getPlayerDescriptionById(fusionId), message: 'The two warriors pulsate with a strange power as they perform an elaborate dance. Suddenly, there is a flash of light!' };
		}

		// Send an offer to the other player
		const expiration = now + hour * 6;
		const fuseCommand = `!fuse ${sourcePlayerName}` + (fusionName ? ' ' + fusionName : '');
		sql.addOffer(sourcePlayer, targetPlayer, 1, fusionName);
		console.log(`'New fusion offer from ${sourcePlayerName} for player ${targetPlayerName} expires at ${new Date(expiration)}`);
		
		embed.setTitle('FUSION OFFER')
			.setColor(0x00AE86)
			.setDescription(`**${sourcePlayerName}** wants to fuse with **${targetPlayerName}**! ${targetPlayerName}, enter ${fuseCommand} to accept the offer and fuse.\n` +
			'**Warning**: You can only fuse once per game! Fusion lasts 24 hours before you split again.\n' + 
			'The offer will expire in six hours.');
		return { embed: null, message: message };
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
		await sql.deleteStatus(channel, player.id, 5);
		
		if(nemesis) {
			nemesis.id = player.id;
			nemesis.startTime = now;
			nemesis.attackTime = now;
			nemesis.destroyTime = now;
			nemesis.reviveTime = now;
			nemesis.energizeTime = now;
			nemesis.burnTime = now;
		} else {
			nemesis = {
				id: player.id,
				startTime: now,
				attackTime: now,
				destroyTime: now,
				reviveTime: now,
				burnTime: now,
				energizeTime: now,
				cooldown: now
			};
		}
		
		if(Math.random() < 0.25) {
			// A very special Nemesis
			player.level = this.newPowerLevel(data.heat) * 4;
			nemesis.type = 1;
		} else {
			// A normal Nemesis
			player.level = this.newPowerLevel(data.heat) * 10;
			nemesis.type = 0;
		}
		player.level *= Math.max(10, data.maxPopulation) / 10;
		nemesis.basePower = player.level;
		
		await sql.setHeat(channel, data.heat);
		await sql.setPlayer(player);
		await sql.setNemesis(channel, nemesis);
		return `**${player.name}** has become a Nemesis, and has declared war on the whole galaxy! ` +
			`Their rampage will continue until ${player.config.pronoun} are defeated in battle.\n` + 
			`The Nemesis can no longer use most peaceful actions, but in exchange, ` +
			`${player.config.pronoun} ${this.have(player.config.pronoun)} access to several powerful new abilities. ` + 
			`For more information, enter \`!help nemesis\`.`;
	},
	// Check whether or not a player is a fusion.
    isFusion(player) {
        return player.fusionNames.length == 2;
	},
	// Generates a new power level based on the current Heat.
    newPowerLevel(heat) {
        let base = Math.ceil((1 + Math.random()) * 100);
        let level = Math.pow(base, 1 + heat / 1200);
        if(level > 1000000000000000000) level = 1000000000000000000; // JS craps out if we go higher than this
        return level;
	},
	// Increase Heat, modified by reset count.
    addHeat(data, heat) {
		if(!data) return;
		let multiplier = 10 / Math.max(10, data.maxPopulation);
        let addedHeat = heat * Math.pow(1.05, data.resets) * multiplier;
        data.heat += addedHeat;
        console.log(`Heat increased by ${heat} to ${data.heat}`);
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

		let plantId = Object.values(enums.ItemTypes).find(t => enums.ItemTypes.Name[t] == plantName.toLowerCase());
		if(!plantId) plantId = -1;
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
	async water(channel, name, fixedTime) {
		let player = await sql.getPlayerByUsername(channel, name);
		let garden = await sql.getGarden(channel);
		let now = new Date().getTime();

		let time = player ? ((Math.random() * 20 + 5) * 60 * 1000) * (1 + 0.09 * player.gardenLevel)
			: fixedTime;
		let output = player ? `${player.name} works on the garden.` : '';
		for(let i in garden.plants) {
			let plant = garden.plants[i];
			if(plant) {
				let duration = plant.endTime - plant.startTime;
				let oldProgress = ((now - plant.startTime) / duration) * 100;
				if(oldProgress < 100) {
					plant.startTime -= time;
					let newProgress = ((now - plant.startTime) / duration) * 100;
					let growth = Math.ceil((newProgress - oldProgress) * 10) / 10;
					output += `\n${plant.name} growth increases by ${growth}%.`;
					if(newProgress >= 100) {
						output += ` It's ready to be picked!`;
					}
					await sql.setPlant(plant);
				}
			}
		}
		
		// Update garden level
		if(player) {
			if(!player.gardenLevel) player.gardenLevel = 0;
			let oldGardenLevel = Math.floor(player.gardenLevel);
			player.gardenLevel += 1 / (1 + player.gardenLevel);
			let newGardenLevel = Math.floor(player.gardenLevel);
			if(newGardenLevel > oldGardenLevel) {
				output += '\nGardening level increased!';
			}
			player.gardenTime = now + hour;
			await sql.setPlayer(player);
		}

		return output;
	},
	async pick(channel, name, plantType) {
		let player = await sql.getPlayerByUsername(channel, name);
		let garden = await sql.getGarden(channel);
		let now = new Date().getTime();

		// Find the plant
		let plant = plantType ?
			garden.plants.find(p => p && p.name.toLowerCase() == plantType.toLowerCase() && p.endTime < now) :
			garden.plants.find(p => p && p.endTime < now);
		if(!plant) return;

		// Transfer it into the inventory
		await sql.addItems(channel, player.id, plant.type, 1);
		await sql.deletePlant(plant.id);

		return `${player.name} picks a ${plant.name.toLowerCase()}.`;
	},
	async useItem(channel, name, plantType, targetName) {
		let player = await sql.getPlayerByUsername(channel, name);
		let target = await sql.getPlayer(channel, targetName);
		let plantItem = player.items.find(i => i.name.toLowerCase() == plantType.toLowerCase());
		let now = new Date().getTime();

		if(!target && plantItem.type != 5) {
			return;
		}
		if(!plantItem) {
			return;
		}

		let output = '';
		let defeatedState;
		switch(plantItem.type) {
			case enums.ItemTypes.Flower:
				// Flower
				defeatedState = target.status.find(s => s.type == 0);
				if(defeatedState) {
					defeatedState.endTime -= 6 * hour;
					if(defeatedState.endTime < now) {
						await sql.deleteStatus(channel, target.id, 0);
						output = `**${player.name}** heals **${target.name}** back to fighting shape!`;
					} else {
						await sql.setStatus(defeatedState);
						let duration = defeatedState.endTime - now;
						output = `**${player.name}** heals **${target.name}**, but ${target.config.pronoun} still won't be able to fight for ${this.getTimeString(duration)}.`;
					}
				}
				break;
			case 2:
				// Rose
				defeatedState = target.status.find(s => s.type == 0);
				if(defeatedState) {
					defeatedState.endTime -= 12 * hour;
					if(defeatedState.endTime < now) {
						await sql.deleteStatus(channel, target.id, 0);
						output = `**${player.name}** heals **${target.name}** back to fighting shape!`;
					} else {
						await sql.setStatus(defeated);
						let duration = defeatedState.endTime - now;
						output = `**${player.name}** heals **${target.name}**, but ${target.config.pronoun} still won't be able to fight for ${this.getTimeString(duration)}.`;
					}
				}
				break;
			case 3:
				// Carrot
				await sql.addStatus(channel, target.id, 6, now + hour * 6);
				output = `**${target.name}** eats the carrot, and ${this.their(target.config.pronoun)} senses feel sharper!`;
				break;
			case 4:
				// Bean
				await sql.addStatus(channel, target.id, 7, now + hour);
				let levelBoost = this.getPowerLevel(target) * .12;
				output = `**${target.name}** eats the bean, and ${this.their(target.config.pronoun)} power increases by ${numeral(levelBoost.toPrecision(2)).format('0,0')}!`;
				break;
			case 5:
				// Sedge
				output = await this.water(channel, null, 2.3 * hour);
				let garden = await sql.getGarden(channel);
				let expansion = (Math.random() * 15 + 15) * 10 / (100 * (3 + garden.growthLevel));
				let percent = Math.floor(1000 * expansion) / 10;
				console.log(`Sedge advanced garden level by ${percent}%`);
				output += `\nThe garden's growth level increases with a rating of ${percent}%.`;
				garden.growthLevel += expansion;
				let gardenEfficiency = 1 + 0.1 * garden.growthLevel;
				let rate = Math.floor(1000 / gardenEfficiency) / 10;
				output += `\nYour plants now take ${rate}% the usual time to grow.`;
				await sql.setGarden(garden);
				break;
			case 6:
				// Fern
				await sql.addStatus(channel, target.id, 8, now + hour * 12);
				output = `**${target.name}** eats the fern, and ${this.their(target.config.pronoun)} power is hidden!`;
				break;
		}

		if(target && target.config.ping) {
			output += `\n<@${target.userId}>`;
		}
		await sql.addItems(channel, player.id, plantItem.type, -1);
		return output;
	},
	// Expand the garden.
	async expand(channel, name) {
		let player = await sql.getPlayerByUsername(channel, name);
		let garden = await sql.getGarden(channel);
		let now = new Date().getTime();

		let output = '';

		let expansion = (Math.random() * 25 + 5) * (1 + 0.09 * player.gardenLevel) / (100 * (3 + garden.growthLevel));
		console.log(`${player.name} advanced garden level by ${Math.floor(expansion * 100) / 100}`);
		let percent = Math.floor(100 * expansion);
		output += `**${player.name}** works on the garden, with a gardening rating of ${percent}%.`;
		garden.growthLevel += expansion;
		
		let gardenEfficiency = 1 + 0.1 * garden.growthLevel;
		let rate = Math.floor(1000 / gardenEfficiency) / 10;
		output += `\nYour plants now take ${rate}% the usual time to grow.`;
		
		// Update garden level
		if(player) {
			if(!player.gardenLevel) player.gardenLevel = 0;
			let oldGardenLevel = Math.floor(player.gardenLevel);
			player.gardenLevel += 1 / (1 + player.gardenLevel);
			let newGardenLevel = Math.floor(player.gardenLevel);
			if(newGardenLevel > oldGardenLevel) {
				output += '\nGardening level increased!';
			}
			player.gardenTime = now + hour;
			await sql.setPlayer(player);
		}

		await sql.setGarden(garden);

		return output;
	},
	// Research new plants.
	async research(channel, name) {
		let player = await sql.getPlayerByUsername(channel, name);
		let garden = await sql.getGarden(channel);
		let now = new Date().getTime();

		let output = '';

		let research = (Math.random() * 15 + 5) * (1 + 0.075 * player.gardenLevel) / (100 * (3 + garden.researchLevel));
		console.log(`${player.name} advanced plant research by ${Math.floor(research * 100) / 100}`);
		let percent = Math.floor(100 * research);
		output += `**${player.name}** researches new kinds of plants, with a rating of ${percent}%.`;
		let oldResearchLevel = garden.researchLevel;
		garden.researchLevel += research;
		
		if(Math.floor(oldResearchLevel) < Math.floor(garden.researchLevel)) {
			// Research max!
			if(garden.growthLevel < 3) {
				// Garden growth required
				output += "\nResearch can't continue until Growth Level is 3 or higher.";
				garden.researchLevel = Math.floor(garden.researchLevel) - 0.01;
			} else {
				// Discover a new plant species
				let unknownPlants = await sql.getUnknownPlants(channel);
				if(unknownPlants.length > 0) {
					let newPlant = unknownPlants[Math.floor(Math.random() * unknownPlants.length)];
					output += `\nResearch level increased! New plant "${newPlant.name}" can now be planted in the garden.`;
					garden.growthLevel -= 3;
					await sql.researchPlant(channel, newPlant.id);
				}
			}
		}
		
		// Update garden level
		if(player) {
			if(!player.gardenLevel) player.gardenLevel = 0;
			let oldGardenLevel = Math.floor(player.gardenLevel);
			player.gardenLevel += 1 / (1 + player.gardenLevel);
			let newGardenLevel = Math.floor(player.gardenLevel);
			if(newGardenLevel > oldGardenLevel) {
				output += '\nGardening level increased!';
			}
			player.gardenTime = now + hour;
			await sql.setPlayer(player);
		}

		await sql.setGarden(garden);

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
				player.level = this.newPowerLevel(0);
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
	async registerPlayer(channel, username, userId, name) {
		let world = await sql.getWorld(channel);
		let now = new Date().getTime();
		this.addHeat(world, 10);
		let player = {
			name: name,
			username: username,
			userId: userId,
			channel: channel,
			glory: 0,
			level: this.newPowerLevel(world.heat),
			lastActive: now,
			lastFought: now,
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

		let growthLevel = Math.floor(garden.growthLevel);
		let growthProgress = Math.floor((garden.growthLevel - Math.floor(growthLevel)) * 100);
		let researchLevel = Math.floor(garden.researchLevel);
		let researchProgress = Math.floor((garden.researchLevel - Math.floor(researchLevel)) * 100);

		plantStatus += `\nGrowth Level: ${growthLevel} (${growthProgress}%)\nResearch Level: ${researchLevel} (${researchProgress}%)`
		embed.setDescription(plantStatus);

		return embed;
	},
	getPlantStatus(plant) {
		let now = new Date().getTime();
		let output = '';
		if(plant) {
			let duration = plant.endTime - plant.startTime;
			if(now > plant.endTime) {
				return `${plant.name} (ready to pick)`;
			} else {
				let progress = Math.floor(((now - plant.startTime) / duration) * 100 );
				return `${plant.name} (${progress}% complete)`;
			}
		} else {
			return '(Nothing planted)';
		}
	},
	// Search for orbs.
	async search(channel, name) {
		let player = await sql.getPlayerByUsername(channel, name);
		let garden = await sql.getGarden(channel);
		let world = await sql.getWorld(channel);
		let now = new Date().getTime();
		let output = '';

		let effectiveTime = Math.min(now - world.lastWish, hour * 72);
		let searchModifier = effectiveTime / (hour * 72);
		searchModifier *= 10 / Math.max(world.maxPopulation, 10)
		let searchChance = (0.03 + 0.01 * player.actionLevel) * searchModifier;
		if(player.isHenchman) searchChance *= 2;
		if(world.lostOrbs == 0) searchChance = 0;
		let roll = Math.random();
		if(roll < searchChance) {
			console.log(`${player.name} found an orb on roll ${Math.floor(roll * 1000) / 10} out of chance ${Math.floor(searchChance * 1000) / 10}`);
			// They found an orb!
			await sql.addItems(channel, player.id, 0, 1);
			world.lostOrbs--;
			output = `${player.name} searches the world, and finds a magic orb!`;
			let existingOrbs = player.items.find(i => i.type == 0);
			if(!existingOrbs) {
				// Start the fight timer
				player.lastFought = now;
			}
			if(existingOrbs && existingOrbs.count == 6) {
				output += "\nYou've gathered all seven magic orbs! Enter `!help wish` to learn about your new options.";
			}
		} else {
			searchChance = (0.03 + 0.01 * player.actionLevel) * searchModifier;
			if(Math.random() < 0.05) {
				//They found a plant!
				let plantType = Math.floor(Math.random() % 6) + 1;
				let plantName;
				switch(plantType) {
					case 1:
						plantName = 'flower';
						break;
					case 2:
						plantName = 'rose';
						break;
					case 3:
						plantName = 'carrot';
						break;
					case 4:
						plantName = 'bean';
						break;
					case 5:
						plantName = 'sedge';
						break;
					case 6:
						plantName = 'fern';
						break;
				}
				console.log(`${player.name} found a plant on roll ${Math.floor(roll * 1000) / 10} out of chance ${Math.floor(searchChance * 1000) / 10}`);
				output = `${player.name} searches the world, and finds a ${plantName}!`;
				let existingPlants = player.items.find(i => i.type == plantType);
				if(existingPlants && existingPlants.count >= 3) {
					output += ` But you can't carry any more.`;
				} else {
					await sql.addItems(channel, player.id, plantType, 1);
				}
			} else {
				if(Math.random() < 0.1) {
					// They found some junk!
					const junkItems = [
						'a magic orb?! ...Nope, just a coconut.',
						"a time machine... but it's broken.",
						"a chaos emerald. Only hedgehogs can use it.",
						"a power star. Someone find a plumber.",
						"a Pokémon.",
						"a missile capacity upgrade.",
						"a heart piece.",
						"a clow card.",
						"a dojo sign.",
						"a gym badge.",
						"a golden banana.",
						"a korok seed. Yahaha!",
						"the Holy Grail... wait, it's a fake.",
						"a limited edition magic orb model.",
						"a hotspring! Sadly, it has no healing properties.",
						"a dinosaur egg.",
						"a single delicious muffin.",
						"a giant catfish.",
						"two huge snakes."
					];
					let junk = junkItems[Math.floor(Math.random() * junkItems.length)];
					console.log(`${player.name} found junk on roll ${Math.floor(roll * 1000) / 10} out of chance ${Math.floor(searchChance * 1000) / 10}`);
					output = `${player.name} searches the world, and finds ${junk}`;
				} else {
					console.log(`${player.name} found nothing on roll ${Math.floor(roll * 1000) / 10} out of chance ${Math.floor(searchChance * 1000) / 10}`);
					if(world.lostOrbs == 0) {
						output = `${player.name} searches the world, but there are no orbs left to find.`;
					} else {
						output = `${player.name} searches the world, but finds nothing of value.`;
					}
				}
			}
		}
		
		if(!player.actionLevel) player.actionLevel = 0;
		let oldActionLevel = Math.floor(player.actionLevel);
		player.actionLevel += 1 / (1 + player.actionLevel);
		let newActionLevel = Math.floor(player.actionLevel);
		if(newActionLevel > oldActionLevel) {
			output += '\nAction level increased!';
		}
		player.actionTime = now + hour;
		await sql.setPlayer(player);
		await sql.setWorld(world);
		
		return output;
	},
	async wish(channel, name, wish) {
		let player = await sql.getPlayerByUsername(channel, name);
		let world = await sql.getWorld(channel);
		let now = new Date().getTime();
		let output = `**${player.name}** makes a wish, and the orbs shine with power...!`
		
		switch(wish.toLowerCase()) {
			case 'power':
				player.level *= Math.random() + 1.5;
				await sql.addStatus(channel, player.id, 10);
				output += '\nYou can feel great power surging within you!';
				break;
			case 'resurrection':
				let players = await sql.getPlayers(channel);
				for(let i in players) {
					let p = players[i];
					let defeatedState = p.status.find(s => s.type == 0);
					if(defeatedState) {
						output += `\n${p.name} is revived!`;
						await sql.deleteStatus(channel, p.id, 0);
						p.level *= 1.2;
						await sql.setPlayer(p);
					}
				}
				break;
			case 'immortality':
				output += '\nNo matter how great of an injury, you suffer, you will always swiftly return!';
				let defeatedState = player.status.find(s => s.type == 0);
				if(defeatedState) {
					await sql.deleteStatus(channel, player.id, 0);
				}
				await sql.addStatus(channel, player.id, 11);
				break;
			case 'gardening':
				output += '\nYou have become the master of gardening!';
				player.gardenLevel += 12;
				await sql.setPlayer(player);
				break;
			case 'ruin':
				output += '**The countdown to the destruction of the galaxy has begun!**\n'
					+ 'You have 24 hours to defeat the Nemesis! If the Nemesis is still alive when time runs out, everything will be destroyed.';
				let nemesis = await sql.getNemesis(channel);
				nemesis.ruinTime = now + 24 * hour;
				nemesis.lastRuinUpdate = now;
				await sql.setNemesis(channel, nemesis);
				break;
		}
		
		await sql.addItems(channel, player.id, 0, -7);
		output += `\nThe orbs scatter to the furthest reaches of the world!`;
		player.wishFlag = 1;
		await sql.setPlayer(player);

		world.lostOrbs = 7;
		world.lastWish = now;
		await sql.setWorld(world);
		
		return output;
	},
	async train(channel, name) {
		let player = await sql.getPlayerByUsername(channel, name);
		await sql.deleteStatus(channel, player.id, 5);
		await sql.addStatus(channel, player.id, 2);
	},
	async updateGarden(channel, lastUpdate) {
		let garden = await sql.getGarden(channel);
		let now = new Date().getTime();
		let messages = [];

		for(let i in garden.plants) {
			let p = garden.plants[i];
			if(p && p.endTime > lastUpdate && p.endTime <= now) {
				messages.push(`A ${p.name} has finished growing in the garden!`);
			}
		}

		return messages;
	},
	async updatePlayerActivity(channel, lastUpdate, pings) {
		let world = await sql.getWorld(channel);
		let players = await sql.getPlayers(channel);
		let now = new Date().getTime();
		let messages = [];

		let activePlayers = 0;
		for(let i in players) {
			let p = players[i];
			if(p.lastActive + 24 * hour > now) {
				// Player is active
				activePlayers++;
				if(p.lastFought + 24 * hour < now) {
					// Player has gone 24 hours without fighting
					let orbs = p.items.find(i => i.type == 0);
					if(orbs) {
						await sql.addItems(channel, p.id, 0, -1);
						world.lostOrbs++;
						messages.push(`${p.name} has gone for too long without fighting; one of their orbs vanishes.`);
					}
					p.lastFought += 24 * hour;
				} else if(p.lastFought + 23 * hour <= now &&
						  p.lastFought + 23 * hour > lastUpdate) {
					let orbs = p.items.find(i => i.type == 0);
					if(orbs) {
						messages.push(`${p.name} must fight someone in the next hour or lose an orb.`);
					}
					if(p.config.ping) {
						pings.push(p.userId);
					}
				}
				if(p.lastActive + 23 * hour < now &&
				   p.lastActive + 23 * hour > lastUpdate) {
					messages.push(`${p.name} will idle out in 1 hour.`);
				}
			} else if(p.lastActive + 24 * hour > lastUpdate) {
				// Player has become inactive
				let orbs = p.items.find(i => i.type == 0);
				if(orbs) {
					console.log(`${p.name} logged idle; last activity recorded at ${new Date(p.lastActive).toLocaleString('en-US')}`);
					await sql.addItems(channel, p.id, 0, -orbs.count);
					world.lostOrbs += orbs.count;
					messages.push(`${p.name} has been idle for too long; ` + 
						`${this.their(p.config.pronoun)} ${orbs.count} ${orbs.count > 1 ? 'orbs vanish' : 'orb vanishes'}.`);
				}
			}
		}

		if(activePlayers > world.maxPopulation) {
			console.log(`Updating world max active population for ${activePlayers} active players`);
			world.maxPopulation = activePlayers;
		}
		await sql.setWorld(world);

		return messages;
	},
	async ruinAlert(channel, lastUpdate) {
		let nemesis = await sql.getNemesis(channel);
		if(nemesis && nemesis.ruinTime > 0) {
			let now = new Date().getTime();
			let nemesisStartTime = nemesis.ruinTime - 24 * hour;
			let hours = Math.floor((lastUpdate - nemesisStartTime) / hour);
			let nextUpdateTime = nemesisStartTime + (hours + 1) * hour;
			if(nextUpdateTime > lastUpdate && nextUpdateTime <= now) {
				// Reminder the players about their impending doom
				let hoursLeft = 24 - hours - 1;
				if(hoursLeft > 0) {
					return { message: `${hoursLeft} hours until the galaxy is destroyed!`, abort: false };
				} else {
					let player = await sql.getPlayerById(nemesis.playerId);
					return { message: `It's too late! ${player.name} finishes charging, and destroys the universe.`, abort: true };
				}
			}
		}
		return null;
	},
	// Process updating passive changes in the world - offers and statuses expiring, garden updating, etc.
	async updateWorld(channel) {
		let world = await sql.getWorld(channel);
		let messages = [];
		let pings = [];
		let abort = false;

		messages = messages.concat(await sql.deleteExpired(channel, pings));
		messages = messages.concat(await this.updatePlayerActivity(channel, world.lastUpdate, pings));
		messages = messages.concat(await this.updateGarden(channel, world.lastUpdate));
		let ruinStatus = await this.ruinAlert(channel);
		if(ruinStatus) {
			messages.push(ruinStatus.message);
			abort = ruinStatus.abort;
		}

		await sql.setUpdateTime(channel);
		
		if(messages.length > 0) {
			let embed = new Discord.RichEmbed();
			embed.setTitle('Status Update')
				.setColor(0x00AE86)
				.setDescription(messages.join('\n'));
	
			return {embed: embed, abort: abort, pings: pings};
		} else {
			return {embed: null, abort: false, pings: []};
		}
	},
	async config(channel, name, configFlag, value) {
		let player = await sql.getPlayerByUsername(channel, name);
		if(configFlag) {
			// Update the config
			switch(configFlag.toLowerCase()) {
				case 'alwaysprivate':
					player.config.alwaysPrivate = this.readConfigBoolean(value);
					break;
				case 'ping':
					player.config.ping = this.readConfigBoolean(value);
					break;
				case 'pronoun':
					if(value.toLowerCase() == 'he') {
						player.config.pronoun = 'he';
					} else if(value.toLowerCase() == 'she') {
						player.config.pronoun = 'she';
					} else {
						player.config.pronoun = 'they';
					}
					player.config.alwaysPrivate = this.readConfigBoolean(value, player.config.alwaysPrivate);
					break;
			}
		}

		await sql.setPlayer(player);
		return this.displayConfig(player);
	},
	async displayConfig(player) {
		let embed = new Discord.RichEmbed();
		let now = new Date().getTime();
		let config = player.config;
		embed.setTitle(`${player.name} Config`)
			.setColor(0x00AE86);
		//
		let output = `AlwaysPrivate: ${config.alwaysPrivate ? 'On' : 'Off'}\n`;
		output += `Ping: ${config.ping ? 'On' : 'Off'}\n`;
		output += `Pronoun: ${config.pronoun}`;
		embed.setDescription(output);

		return embed;
	},
	getPowerLevel(player) {
		let level = player.level;
		// Overdrive
		let overdrive = player.status.find(s => s.type == 4);
		if(overdrive) {
			level *= overdrive.rating;
		}
		// Power Wish
		if(player.status.find(s => s.type == 10)) {
			level *= 1.5;
		}
		// Fusion
		if(player.status.find(s => s.type == 9)) {
			level *= 1.3;
		}
		// Bean
		if(player.status.find(s => s.type == 7)) {
			level *= 1.12;
		}
		// Energized
		if(player.status.find(s => s.type == 3)) {
			level *= 1.3;
		}
		// Henchmen
		if(player.isHenchman) {
			level *= 1.2;
		}
		return level;
	},
	readConfigBoolean(value, oldValue) {
		let v = value.toLowerCase();
		if(v == 'off' || v == '0' || v == 'false') {
			return false;
		} else if(v == 'on' || v == '1' || v == 'true') {
			return true;
		}
		return oldValue;
	},
	their(pronoun) {
		switch(pronoun) {
			case 'he':
				return 'his';
			case 'she':
				return 'her';
			default:
				return 'their';
		}
	},
	them(pronoun) {
		switch(pronoun) {
			case 'he':
				return 'him';
			case 'she':
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
	async give(channel, name, targetName) {
		let player = await sql.getPlayerByUsername(channel, name);
		let target = await sql.getPlayer(channel, targetName);

		await sql.addItems(channel, player.id, 0, -1);
		await sql.addItems(channel, target.id, 0, 1);

		let output = `${player.name} gives a magic orb to ${target.name}.`;
		let existingOrbs = target.items.find(i => i.type == 0);
		if(existingOrbs && existingOrbs.count == 6) {
			output += `\n${target.name} has gathered all seven magic orbs! Enter \`!help wish\` to learn about your new options.`;
		}

		return output;
	},
	async history(channel, name1, name2) {
		let player1 = await sql.getPlayerByUsername(channel, name1);
		let player2 = await sql.getPlayer(channel, name2);
		let history = await sql.getHistory(player1.id, player2 ? player2.id : null);
		let embed = new Discord.RichEmbed();
		let twoPlayers = player2 && player2.id != player1.id;

		if(twoPlayers) {
			embed.setTitle(`${player1.name} VS ${player2.name} Battle History`);
		} else {
			embed.setTitle(`${player1.name} Battle History`);
		}
		embed.setColor(0x00AE86);
		
		let description = '';
		if(twoPlayers) {
			if(history.length == 0) {
				embed.setDescription(`${player1.name} and ${player2.name} have never fought.`);
			} else {
				let player1wins = history.filter(h => h.winnerId == player1.id).length;
				let player2wins = history.filter(h => h.winnerId == player2.id).length;
				if(player1wins > 1) {
					description += `${player1.name} has beaten ${player2.name} ${player1wins} times.\n`;
				} else if(player1wins == 1) {
					description += `${player1.name} has beaten ${player2.name} once.\n`;
				} else {
					description += `${player1.name} has never beaten ${player2.name}.\n`;
				}
				if(player2wins > 1) {
					description += `${player2.name} has beaten ${player1.name} ${player2wins} times.\n`;
				} else if(player2wins == 1) {
					description += `${player2.name} has beaten ${player1.name} once.\n`;
				} else {
					description += `${player2.name} has never beaten ${player1.name}.\n`;
				}
			}
		} else {
			if(history.length == 0) {
				embed.setDescription(`${player1.name} has never fought.`);
			} else {
				let player1wins = history.filter(h => h.winnerId == player1.id).length;
				let player1losses = history.length - player1wins;
				description += `${player1.name} has won ${player1wins} ${player1wins == 1 ? 'time' : 'times'} and lost ${player1losses} ${player1losses == 1 ? 'time' : 'times'}.\n`;
			}
		}
		embed.setDescription(description);

		let output = '';
		if(history.length > 20) history = history.slice(0, 20);
		for(let i in history) {
			let h = history[i];
			let battleTime = new Date(h.battleTime).toLocaleString('en-US');

			if(output.length > 0) output += '\n';

			let loserRating = Math.sqrt(h.loserLevel * h.loserSkill);
			let winnerRating = Math.sqrt(h.winnerLevel * h.winnerSkill);

			output += `${battleTime}: ${h.winnerName} defeated ${h.loserName}, ${numeral(winnerRating.toPrecision(2)).format('0,0')} to ${numeral(loserRating.toPrecision(2)).format('0,0')}.`;
		}
		embed.addField(`Last ${history.length} ${history.length == 1 ? 'fight' : 'fights'}`, output);

		return embed;
	},
	async empower(channel, name, targetName) {
		let player = await sql.getPlayerByUsername(channel, name);
		let target = await sql.getPlayer(channel, targetName);
		let now = new Date().getTime();

		let transfer = Math.min(player.level * 0.1, target.level * 0.25);

		player.level -= transfer;
		target.level += transfer;

		let output = `${player.name} sends ${this.their(player.config.pronoun)} energy to ${target.name}, ` +
			`increasing ${this.their(target.config.pronoun)} power level by ${numeral(transfer.toPrecision(2)).format('0,0')}!`;
		
		if(!player.actionLevel) player.actionLevel = 0;
		let oldActionLevel = Math.floor(player.actionLevel);
		player.actionLevel += 1 / (1 + player.actionLevel);
		let newActionLevel = Math.floor(player.actionLevel);
		if(newActionLevel > oldActionLevel) {
			output += '\nAction level increased!';
		}

		player.actionTime = now + hour;
		await sql.setPlayer(player);
		await sql.setPlayer(target);

		return output;
	},
	async graveyard(channel) {
		let players = await sql.getPlayers(channel);
		let deadPlayers = players.filter(p => p.status.find(s => s.type == 0));
		deadPlayers.sort((a, b) => {
			let aDeath = a.status.find(s => s.type == 0);
			let bDeath = b.status.find(s => s.type == 0);
			return aDeath.endTime - bDeath.endTime;
		});
		let now = new Date().getTime();
		let output = '';

		let embed = new Discord.RichEmbed();
		embed.setTitle(`Defeated Players`)
			.setColor(0x00AE86);
		
		for(let i in deadPlayers) {
			let p = deadPlayers[i];
			let s = p.status.find(s => s.type == 0);
			
			if(output.length > 0) output += '\n';
			output += `${p.name} (Recovers in ${this.getTimeString(s.endTime - now)})`;
		}

		if(output.length == 0) {
			output = `No players are in need of healing right now.`;
		}

		embed.setDescription(output);

		return embed;
	},
	async overdrive(channel, name) {
		let player = await sql.getPlayerByUsername(channel, name);
		let now = new Date().getTime();
		let output = '';
		let rating = 1 + ((Math.random() * 10 + 15) * (1 + 0.075 * player.actionLevel)) / 100;
		let increase = this.getPowerLevel(player) * (rating - 1);
		await sql.addStatus(channel, player.id, 4, now + hour, rating);
		output += `${player.name} pushes past ${this.their(player.config.pronoun)} limits, increasing ${this.their(player.config.pronoun)} power level by ${numeral(increase.toPrecision(2)).format('0,0')}!`;

		if(Math.random() < player.overdriveCount / 100) {
			output += `\nA mighty roar! The surge in power makes ${player.config.pronoun} go berserk!`;
			player.overdriveCount = 0;
			await sql.addOffer(player, null, 0);
			await sql.addStatus(channel, player.id, 12, now + hour);
		}
		if(!player.actionLevel) player.actionLevel = 0;
		let oldActionLevel = Math.floor(player.actionLevel);
		player.actionLevel += 1 / (1 + player.actionLevel);
		let newActionLevel = Math.floor(player.actionLevel);
		if(newActionLevel > oldActionLevel) {
			output += '\nAction level increased!';
		}
		player.overdriveCount++;
		player.actionTime = now + hour;
		await sql.setPlayer(player);

		return output;
	},
	async link(channel, username, id) {
		let player = await sql.getPlayerByUsername(channel, username);
		player.userId = id;
		await sql.setPlayer(player);

		return `Character ${player.name} linked to user ${username}.`;
	},
	async import() {
		let now = new Date().getTime();
		await sql.initializeGame();

		let files = fs.readdirSync('./data');
		for(let i in files) {
			let file = files[i];
			let contents = fs.readFileSync(`./data/${file}`, 'utf8');
			let channel = file.substring(0, file.length - 4);
			console.log(`Importing channel ${channel}`);
			await sql.initializeChannel(channel);
			let data = JSON.parse(contents);
			// Import players
			for(let username in data.players) {
				let playerData = data.players[username];
				let player = {
					name: playerData.name,
					username: username,
					userId: null,
					channel: channel,
					glory: Math.floor(playerData.wins * 2.5),
					level: this.newPowerLevel(0),
					lastActive: now,
					lastFought: now,
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
				console.log(`Successfully imported player ${player.name}`);
			}
		}
	}
}
