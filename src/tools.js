const enums = require('./enum.js');
const settings = require('./settings.js');
const numeral = require('numeral');
const sql = require('./sql.js');
const templates = require('./templates.js');
const Discord = require("discord.js");
const moment = require("moment");
const hour = (60 * 60 * 1000);

module.exports = {
	// Gets an Embed showing a player's status.
	async getPlayerDescription(player, username, private) {
		return this.generatePlayerDescription(player, username, private);
	},
	async getPlayerDescriptionById(id, username) {
		return this.generatePlayerDescription(await sql.getPlayerById(id), username);
	},
	async generatePlayerDescription(player, username, private) {
		if(!player) {
			console.log('Player not found');
			return null;
		}
		let embed = new Discord.RichEmbed();
		const now = new Date().getTime();
		embed.setTitle(player.name.toUpperCase())
			.setColor(0x00AE86);

		if(player.isNemesis) {
			embed.setDescription('NEMESIS');
		} else if(this.isFusion(player)) {
			embed.setDescription(`Fusion between ${player.fusedPlayers[0].name} and ${player.fusedPlayers[1].name}`);
		} else if(player.npc) {
			embed.setDescription('MONSTER');
		} else if(player.isUnderling) {
			const energyPercent = Math.max(100 - 20 * player.underlingDefeats, 0)
			embed.setDescription(`UNDERLING\nProtecting the Nemesis at ${energyPercent}% power`);
		}
		
		let stats = '';
		if(!player.npc) {
			// Display Glory/Rank
			stats += `${player.glory} Glory\n`;
			let glory = player.glory;
			if(this.isFusion(player)) glory = Math.floor(glory / 2);
			if(glory < 50) {
				stats += 'Unranked Warrior\n';
			} else if(glory < 100) {
				stats += 'Rank C Warrior\n';
			} else if(glory < 150) {
				stats += 'Rank B Warrior\n';
			} else if(glory < 250) {
				stats += 'Rank A Warrior\n';
			} else if(glory < 400) {
				stats += 'Rank S Warrior\n';
			} else if(glory < 700) {
				stats += 'Rank S+ Warrior\n';
			} else if(glory < 1000) {
				stats += 'Rank S++ Warrior\n';
			} else {
				stats += 'Ultimate Warrior\n';
			}
		}
		
		stats += 'Power Level: '
		
		if(player.status.find(s => s.type == enums.Statuses.Fern) && !private) {
			stats += 'Unknown';
		} else {
			const level = this.getPowerLevel(player);
			stats += numeral(level.toPrecision(2)).format('0,0');
			if(player.status.find(s => s.type == enums.Statuses.Training)) {
				stats += '?';
			}
		}
		
		const gardenPercent = Math.floor((player.gardenLevel - Math.floor(player.gardenLevel)) * 100);
		stats += `\nGardening Level: ${Math.floor(player.gardenLevel)} (${gardenPercent}%)`;
		
		const actionPercent = Math.floor((player.actionLevel - Math.floor(player.actionLevel)) * 100);
		stats += `\nAction Level: ${Math.floor(player.actionLevel)} (${actionPercent}%)`;

		embed.addField('Stats', stats);

		// Display Status
		let statuses = [];
		let defeated = player.status.find(s => s.type == enums.Statuses.Dead);
		for(const i in player.status) {
			const s = player.status[i];
			if(!s.ends || s.endTime > now) {
				switch(s.type) {
					case enums.Statuses.Dead:
						statuses.push(`Defeated (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case enums.Statuses.Journey:
						statuses.push(`On a journey (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case enums.Statuses.Training:
						statuses.push(`Training (${this.getTimeString(now - s.startTime)} so far)`);
						break;
					case enums.Statuses.Energized:
						statuses.push(`Energized (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case enums.Statuses.Transform:
						statuses.push(`Transformed (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case enums.Statuses.SuperTransform:
						statuses.push(`Super Form (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case enums.Statuses.UltimateForm:
						statuses.push(`Ultimate Form (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case enums.Statuses.Ready:
						if(!defeated)
							statuses.push(`Ready to train`);
						break;
					case enums.Statuses.Carrot:
						statuses.push(`Enhanced senses (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case enums.Statuses.Bean:
						statuses.push(`Power boosted (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case enums.Statuses.Fern:
						statuses.push(`Power level hidden (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case enums.Statuses.Fused:
						statuses.push(`Fused (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case enums.Statuses.PowerWish:
						statuses.push(`Blessed with power`);
						break;
					case enums.Statuses.Immortal:
						if(s.endTime) {
							statuses.push(`Immortal (${this.getTimeString(s.endTime - now)} remaining)`);
						} else {
							statuses.push(`Immortal`);
						}
						break;
					case enums.Statuses.GardenWish:
						statuses.push(`Garden master`);
						break;
					case enums.Statuses.Berserk:
						statuses.push(`Berserk (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
					case enums.Statuses.Annihilation:
						statuses.push(`Annihilated`);
						break;
					case enums.Statuses.Guarded:
						const guardingPlayer = await sql.getPlayerById(s.rating);
						statuses.push(`Protected by ${guardingPlayer.name} (${this.getTimeString(s.endTime - now)} remaining)`);
						break;
				}
			}
		}
		if(statuses.length > 0) {
			embed.addField('Status', statuses.join('\n'));
		}
		const cooldowns = player.cooldowns.filter(c => enums.Cooldowns.Name[c.type]).map(c => {
			return `${enums.Cooldowns.Name[c.type]}: Ready in ${this.getTimeString(c.endTime - now)}`
		});
		if(cooldowns.length > 0) {
			embed.addField('Cooldowns', cooldowns.join('\n'));
		}

		let items = player.items;
		if(this.isFusion(player)) {
			let fusedPlayer = player.fusedPlayers.find(f => f.username == username);
			if(fusedPlayer) {
				items = items.concat(fusedPlayer.items);
			}
		}
		const itemDescriptions = items.map(i => {
			const name = enums.Items.Name[i.type].replace(/^\w/, c => c.toUpperCase());
			return `${name} (${i.count} held)`;
		});
		if(itemDescriptions.length > 0) {
			embed.addField('Inventory', itemDescriptions.join('\n'));
		}

		// Display Offers
		let offers = [];
		for(const i in player.offers) {
			const o = player.offers[i];
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
	// Give advanced data about a player
	async getPlayerDeepDescription(player) {
		if(!player) {
			console.log('Player not found');
			return null;
		}
		let embed = new Discord.RichEmbed();
		const now = new Date().getTime();
		embed.setTitle(player.name.toUpperCase())
			.setColor(0x00AE86);

		if(player.isNemesis) {
			embed.setDescription('NEMESIS');
		} else if(this.isFusion(player)) {
			embed.setDescription(`Fusion between ${player.fusedPlayers[0].name} and ${player.fusedPlayers[1].name}`);
		} else if(player.npc) {
			embed.setDescription('MONSTER');
		} else if(player.isUnderling) {
			const energyPercent = Math.max(100 - 20 * player.underlingDefeats, 0)
			embed.setDescription(`UNDERLING\nProtecting the Nemesis at ${energyPercent}% power`);
		}
		
		let stats = '';
		if(player.legacyGlory > 0) {
			// Display Legacy Glory
			const legacyBonus = Math.floor(Math.sqrt(player.legacyGlory / 750) * 100);
			stats += `\nYou have ${Math.floor(player.legacyGlory)} Legacy Glory, granting you +${legacyBonus}% to all Glory gains (rounded down).`;
		}
		
		const history = await sql.getHistory(player.id);
		const losses = history.filter(h => h.loserId == player.id).length;

		if(losses == 1) {
			stats += `\nYou have fallen in battle once, granting you a 5% bonus to training gains.`;
		} else if(losses == 2) {
			stats += `\nYou have fallen in battle twice, granting you a 10% bonus to training gains.`;
		} else if(losses > 2) {
			stats += `\nYou have fallen in battle ${losses} times, granting you a ${losses * 5}% bonus to training gains.`;
		}

		if(player.gardenLevel >= 1) {
			const gardenPercent = Math.floor((player.gardenLevel - Math.floor(player.gardenLevel)) * 100);
			stats += `\nGardening Level: ${Math.floor(player.gardenLevel)} (${gardenPercent}%)`;
			stats += `\n!water causes +${Math.floor(player.gardenLevel) * 8}% more growth than normal.` +
				`\n!expand advances progress by +${Math.floor(player.gardenLevel) * 8}% more than normal.`;
		}
		
		if(player.actionLevel >= 1) {
		const actionPercent = Math.floor((player.actionLevel - Math.floor(player.actionLevel)) * 100);
		stats += `\nAction Level: ${Math.floor(player.actionLevel)} (${actionPercent}%)`;
			stats += `\n!search is ${Math.floor(player.actionLevel * 100 / 6)}% more likely to find orbs, and ${Math.floor(player.actionLevel) * 20}% more likely to find flowers.` +
				`\n!filler heals injured players by ${Math.floor(player.actionLevel * 2.5)}% more than normal.` +
				`\n!transform lasts ${Math.floor(player.actionLevel * 100 / 60)}% longer than normal.`;
		}

		if(stats == '') {
			stats += 'You have no special traits yet.'
		}

		embed.addField('Stats', stats);

		const cooldowns = player.cooldowns.map(c => {
			switch(c.type) {
				case enums.Cooldowns.NemesisUsed:
					return `Nemesis: Ready in ${this.getTimeString(c.endTime - now)}`;
				case enums.Cooldowns.FusionUsed:
					return `Fusion: Ready in ${this.getTimeString(c.endTime - now)}`;
				case enums.Cooldowns.WishUsed:
					return `Wish: Ready in ${this.getTimeString(c.endTime - now)}`;
			}
			return null;
		}).filter(c => c);
		if(cooldowns.length > 0) {
			embed.addField('Cooldowns', cooldowns.join('\n'));
		}

		return embed;
	},
	// Scout a player's estimated power level and status.
    async scoutPlayer(player) {
		if(!player) {
			console.log('Player not found');
			return null;
		}
		const now = new Date().getTime();
		let embed = new Discord.RichEmbed();
		embed.setTitle(`SCANNING ${player.name.toUpperCase()}...`)
			.setColor(0x00AE86);

		if(player.isNemesis) {
			embed.setDescription('NEMESIS');
		} else if(this.isFusion(player)) {
			embed.setDescription(`Fusion between ${player.fusedPlayers[0].name} and ${player.fusedPlayers[1].name}`);
		} else if(player.npc) {
			embed.setDescription('MONSTER');
		} else if(player.isUnderling) {
			const energyPercent = Math.max(100 - 20 * player.underlingDefeats, 0)
			embed.setDescription(`UNDERLING\nProtecting the Nemesis at ${energyPercent}% power`);
		}
		
		stats = 'Power Level: '
		const training = player.status.find(s => s.type == enums.Statuses.Training);
		const trainingTime = now - (training ? training.startTime : 0);
		if(player.status.find(s => s.type == enums.Statuses.Fern)) {
			stats += 'Unknown';
		} else {
			let seenLevel = this.getPowerLevel(player);
			if(training) {
				// Estimate post-training power level
				const world = await sql.getWorld(player.channel);
				let hours = trainingTime / hour;
				if (hours > 72) {
					hours = 72;
				}
				let newPowerLevel = Math.pow(150, 1 + (world.heat + hours) / 1000);
				if (this.isFusion(player)) {
					newPowerLevel *= 1.3;
				}
				if (player.status.find(s => s.type == enums.Statuses.PowerWish)) {
					newPowerLevel *= 1.5;
				}
				if (hours <= 16) {
					seenLevel += newPowerLevel * (hours / 16);
				} else {
					seenLevel += newPowerLevel * (1 + 0.01 * (hours / 16));
				}
			}
			const level = numeral(seenLevel.toPrecision(2));
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
    async displayRoster(channel) {
		let players = await sql.getPlayers(channel);
		const now = new Date().getTime();
		
		// Build the table out in advance so we can get column widths
		let headers = [4, 4, 6, 11];
		let rows = [];
		for(const i in players) {
			let p = players[i];
			if (this.isFusionPart(p)) {
				continue;
			}
			if(p.lastActive + 24 * hour < now) {
				continue;
			}
			if(p.status.find(s => s.type == enums.Statuses.Annihilation)) {
				continue;
			}

			let row = [];
			row.push(p.name);
			if(p.name.length > headers[0]) headers[0] = p.name.length;
			
			let rank = '-';
			let glory = p.glory;
			if(this.isFusion(p)) glory /= 2;
			if(glory >= 1000) {
				rank = 'U';
			} else if(glory >= 700) {
				rank = 'S++';
			} else if(glory >= 400) {
				rank = 'S+';
			} else if(glory >= 250) {
				rank = 'S';
			} else if(glory >= 150) {
				rank = 'A';
			} else if(glory >= 100) {
				rank = 'B';
			} else if(glory >= 50) {
				rank = 'C';
			}
			row.push(rank);
			
			p.status.sort((a,b) => b.priority - a.priority);
			const statuses = p.status.filter(s => s.priority > 0);
			
			const status = statuses.length > 0 ? statuses[0].name : 'Normal';
			
			row.push(status);
			if(status.length > headers[2]) headers[2] = status.length;
			
			let seenLevel = this.getPowerLevel(p);
			let level = numeral(seenLevel.toPrecision(2)).format('0,0');
			
			if(p.status.find(s => s.type == enums.Statuses.Fern)) {
				level = 'Unknown'
			} else if(p.status.find(s => s.type == enums.Statuses.Training)) {
				level += '?'
			}
			if(p.npc) {
				level += ' [MONSTER]';
			}
			if(p.isNemesis) {
				level += ' [NEMESIS]';
			}
			if(p.isUnderling) {
				level += ' [UNDERLING]';
			}
			if(this.isFusion(p)) {
				level += ' [FUSION]';
			}
			const orbs = p.items.find(i => i.type == enums.Items.Orb);
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
		players.sort((a,b) => b.glory - a.glory);
		if(players.length > 10) {
			players = players.slice(0, 10);
		}
		for(const i in players) {
			let p = players[i];
			if (this.isFusionPart(p)) {
				continue;
			}

			let row = [];
			row.push(place[i]);
			row.push(p.name);
			let glory = p.glory.toString();
			row.push(glory);
			if(p.name.length > headers[1]) headers[1] = p.name.length;
			if(glory.length > headers[2]) headers[2] = glory.length;

			rows.push(row);
		}
		
		// Print out the table
		let output = '';
		output += 'PLACE' + ' '.repeat(headers[0] - 5);
		output += 'NAME' + ' '.repeat(headers[1] - 3);
		output += 'GLORY' + ' '.repeat(headers[2] - 5);
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
	// Nemesis attack command.
	async attack(player1, player2) {
		let description = `**${player1.name}** attacks without warning, targeting **${player2.name}!**`
		const guarded = player2.status.find(s => s.type == enums.Statuses.Guarded);
		if(guarded && guarded.rating) {
			let guard = await sql.getPlayerById(guarded.rating);
			description += `\nHowever, ${guard.name} jumps in the way to protect ${this.them(player2.config.pronoun)}!`;
			player2 = guard;
		}

		let embed = new Discord.RichEmbed();
		const title = player1.isNemesis ? 'NEMESIS INVASION' : 'MONSTER ATTACK'
		embed.setTitle(title)
			.setColor(0xff0000);
		embed.setDescription(description);
		
		if(!player1.npc) {
			await sql.addStatus(player1.channel, player1.id, enums.Statuses.Cooldown, 3 * hour, enums.Cooldowns.Attack);
		}
		
		await this.fight(player1, player2, false, embed);
		let output = [embed];
		if(player2.config.Ping) {
			output.push(await this.getPings(player2));
		}

		return output;
	},
	// Self-destruct command.
	async selfDestruct(player1, player2, username) {
		let embed = new Discord.RichEmbed();
		
		if(this.isFusion(player1) && !(await this.confirmCommand(player1, username, `!selfdestruct ${player2.name}`))) {
			const otherPlayer = player1.fusedPlayers.find(p => p.username != username);
			embed.setTitle('CONFIRM SELF DESTRUCT')
				.setColor(0xff8040)
				.setDescription(`**${player1.name}** needs the will of both ${this.their(player1.config.pronoun)} souls to perform this ultimate attack! ` +
					`${otherPlayer.name}, enter \`!selfdestruct ${player2.name}\` to confirm and begin your final battle.`);
			return embed;
		}

		embed.setTitle(`${player1.toUpperCase}'S FINAL MOMENTS`)
			.setColor(0xffffff);
		embed.setDescription(`**${player1.name}** channels all ${this.their(player1.config.pronoun)} life force into one final attack, targeting **${player2.name}!**`);
		
		player1.status.push({
			type: enums.Statuses.SelfDestruct
		});
		await this.fight(player1, player2, false, embed);
		let output = [embed];
		if(player2.config.Ping) {
			output.push(await this.getPings(player2));
		}

		return output;
	},
	async unfight(player) {
		await sql.unfightOffers(player.id);
		return `${player.name} no longer wants to fight anyone.`;
	},
	async taunt(player1, player2) {
		let embed = new Discord.RichEmbed();
		let output = [];
		
		if(player2) {
			const offer = player1.offers.find(o => o.playerId == player2.id && 
				(o.type == enums.OfferTypes.Fight || o.type == enums.OfferTypes.Taunt));
			if(!offer && !player2.isNemesis && !player2.isUnderling && !player2.npc) {
				// If there isn't a challenge, send a taunt
				const glory = Math.ceil(Math.min(player2.level / player1.level * 5, 50));
				embed.setTitle('BATTLE TAUNT')
					.setColor(0xff8040)
					.setDescription(`**${player1.name}** has issued a **taunt** to **${player2.name}**! ` +
						`${player2.name}, enter \`!fight ${player1.name}\` to accept the challenge and begin the battle.` +
						`\nIf you don't accept the challenge, you'll lose about ${glory} Glory.`);
				await sql.addOffer(player1, player2, enums.OfferTypes.Fight);
				output.push(embed);
			} else {
				// There's already a challenge here - just FIGHT
				embed.setTitle(`${player1.name.toUpperCase()} vs ${player2.name.toUpperCase()}`)
				.setColor(0xff8040);
				embed = await this.fight(player1, player2, offer ? offer.type == enums.OfferTypes.Taunt : false, embed);
				output.push(embed);
			}
			if(player2.config.Ping) {
				output.push(await this.getPings(player2));
			}
		}

		return output;
	},
	// Either fights a player or sends them a challenge, depending on whether or not they've issued a challenge.
    async tryFight(player1, player2) {
		let output = [];
		let embed = new Discord.RichEmbed();
		
		if(player2) {
			const offer = player1.offers.find(o => o.playerId == player2.id && 
				(o.type == enums.OfferTypes.Fight || o.type == enums.OfferTypes.Taunt));
			if(!offer) {
				await sql.addStatus(player1.channel, player1.id, enums.Statuses.Cooldown, 30 * 1000, enums.Cooldowns.Challenge);
			}
			if(!offer && !player2.isNemesis && !player2.isUnderling && !player2.npc) {
				// If they haven't offered, send a challenge
				embed.setTitle('BATTLE CHALLENGE')
					.setColor(0xff8040)
					.setDescription(`**${player1.name}** has issued a battle challenge to **${player2.name}**! ` +
						`${player2.name}, enter \`!fight ${player1.name}\` to accept the challenge and begin the battle.`);
				await sql.addOffer(player1, player2, enums.OfferTypes.Fight);
				output.push(embed);
			} else {
				// FIGHT
				embed.setTitle(`${player1.name.toUpperCase()} vs ${player2.name.toUpperCase()}`)
						.setColor(0xff8040);
				embed = await this.fight(player1, player2, offer ? offer.type == enums.OfferTypes.Taunt : false, embed);
				output.push(embed);
			}
			if(player2.config.Ping) {
				output.push(await this.getPings(player2));
			}
		} else {
			await sql.addOffer(player1, null, enums.OfferTypes.Fight);
			embed.setTitle('BATTLE CHALLENGE')
				.setColor(0xff8040)
				.setDescription(`**${player1.name}** wants to fight anyone! The next person to enter \`!fight ${player1.name}\` will accept the challenge and begin the battle.`);
			output.push(embed);
			await sql.addStatus(player1.channel, player1.id, enums.Statuses.Cooldown, 60 * 1000, enums.Cooldowns.Challenge);
		}
		return output;
	},
	// End training and power up a player. Will do nothing if player is not training.
	async completeTraining(player, forcedValue) {
		let world = await sql.getWorld(player.channel);
		const now = new Date().getTime();
		const trainingState = player.status.find(s => s.type == enums.Statuses.Training);
		if (!trainingState && !forcedValue) {
			// Not training, so no need to do anything
			return;
		}
		await this.deleteStatus(player, enums.Statuses.Journey);
		await this.deleteStatus(player, enums.Statuses.Training);
		await sql.addStatus(player.channel, player.id, enums.Statuses.TrainingComplete);
		player.status.push({
			type: enums.Statuses.TrainingComplete
		});

		const history = await sql.getHistory(player.id);
		const losses = history.filter(h => h.loserId == player.id).length;

		const time = forcedValue ? forcedValue : (now - trainingState.startTime);
		let hours = time / hour;
		if (hours > 72) {
			hours = 72;
		}
		this.addHeat(world, hours);
		let newPowerLevel = this.newPowerLevel(world.heat);
		newPowerLevel *= 1 + 0.05 * losses;
		console.log(`${player.name} power +${5 * losses}% due to defeats`);
		if (this.isFusion(player)) {
			newPowerLevel *= 1.3;
		}
		if (player.status.find(s => s.type == enums.Statuses.PowerWish)) {
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
    async fight(player1, player2, taunted, embed) {
		let channel = player1.channel;	
		let world = await sql.getWorld(channel);

		embed.setTitle(`EPISODE ${world.episode}: ${embed.title}`);

		// If fighters are training - take them out of training and power them up
		await this.completeTraining(player1);
		await this.completeTraining(player2);

		// Get our power levels
		let level1 = this.getPowerLevel(player1);
		let level2 = this.getPowerLevel(player2);

		let underlingPowered = false;
		if(player2.isNemesis) {
			// Someone attacked the Nemesis, summon underlings!
			let underlingsMessages = [];
			const underlings = await sql.getUnderlings(channel);
			for(const i in underlings) {
				const h = await sql.getPlayerById(underlings[i].id);
				if(!h) continue;
				if(!h.status.find(s => s.type == enums.Statuses.Dead) && 
					!h.status.find(s => s.type == enums.Statuses.Annihilation) && h.id != player1.id && 
					!h.status.find(s => s.type == enums.Statuses.Journey)) {
					// Living underling, send energy
					const boost = this.getPowerLevel(h) * (1 - 0.2 * underlings[i].defeats);
					if(boost > 0) {
						underlingsMessages.push(`${h.name} boosts ${player2.name}'s energy by ${numeral(boost.toPrecision(2)).format('0,0')}!`);
					}
					level2 += boost;
				}
			}
			if(underlingsMessages.length > 0) {
				underlingPowered = true;
				embed.addField('The Nemesis summons underlings!', underlingsMessages.join('\n'));
			}
		}
		embed.addField('Power Levels', `${player1.name}: ${numeral(level1.toPrecision(3)).format('0,0')}\n${player2.name}: ${numeral(level2.toPrecision(3)).format('0,0')}`);
		
		// Randomize, then adjust skill ratings
		let skill1 = 0;
		let skill2 = 0;
		for(let i = 0; i < settings.BattleDice; i++) {
			skill1 += Math.random();
			skill2 += Math.random();
		}
		skill1 *= 2 / settings.BattleDice;
		skill2 *= 2 / settings.BattleDice;
		
		const history = await sql.getHistory(player1.id, player2.id);
		if(history && history.length > 0) {
			// Calculate revenge bonus from losing streak
			const revengePlayerId = history[0].winnerId == player1.id ? player2.id : player1.id;
			let battles = 0;
			while(battles < history.length && history[battles].loserId == revengePlayerId) {
				battles++;
			}
			if(player1.id == revengePlayerId) {
				console.log(`${player1.name} skill +${battles}0% due to revenge bonus`);
				skill1 += 0.1 * battles;
			}
			if(player2.id == revengePlayerId) {
				console.log(`${player2.name} skill +${battles}0% due to revenge bonus`);
				skill2 += 0.1 * battles;
			}
		}

		if(player1.isNemesis) {
			skill2 += 0.15;
		}
		if(player2.isNemesis) {
			skill1 += 0.15;
		}
		
		if(player1.isUnderling) {
			skill2 += 0.075;
		}
		if(player2.isUnderling) {
			skill1 += 0.075;
		}

		if(player1.status.find(s => s.type == enums.Statuses.TrainingComplete && skill1 < 1)) {
			skill1 = 1;
		}
		if(player2.status.find(s => s.type == enums.Statuses.TrainingComplete && skill2 < 1)) {
			skill2 = 1;
		}
		
		console.log(`${player1.name}: PL ${Math.floor(level1 * 10) / 10}, Skill ${Math.floor(skill1 * 10) / 10}`);
		console.log(`${player2.name}: PL ${Math.floor(level2 * 10) / 10}, Skill ${Math.floor(skill2 * 10) / 10}`);
		
		// Final battle scores!
		const score1 = Math.sqrt(level1 * skill1);
		const score2 = Math.sqrt(level2 * skill2);
		
		let battleLog = '';
		if(skill1 < 0.8) {
			battleLog += `${player1.name} underestimates ${this.their(player1.config.Pronoun)} foe!`;
		} else if(skill1 > 1.6) {
			battleLog += `${player1.name} goes *even further beyond!*`;
		} else if(skill1 > 1.2) {
			battleLog += `${player1.name} surpasses ${this.their(player1.config.Pronoun)} limits!`;
		} else {
			battleLog += `${player1.name} fights hard!`;
		}
		battleLog += ` Battle rating: ${numeral(score1.toPrecision(2)).format('0,0')}\n`;
		
		if(skill2 < 0.8) {
			battleLog += `${player2.name} underestimates ${this.their(player2.config.Pronoun)} foe!`;
		} else if(skill2 > 1.6) {
			battleLog += `${player2.name} goes *even further beyond!*`;
		} else if(skill2 > 1.2) {
			battleLog += `${player2.name} surpasses ${this.their(player2.config.Pronoun)} limits!`;
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
		
		const nemesisHistory = players[1].isNemesis ? await sql.getNemesisHistory(channel) : null;
		const outcome = await this.handleFightOutcome(world, players[0], players[1], skills[0], skills[1], 
			taunted && players[1].id == player2.id, nemesisHistory, underlingPowered);
		embed.addField('Results', outcome);

		return embed;
	},
	// Process updates based on who won and lost a fight.
	async handleFightOutcome(data, winner, loser, winnerSkill, loserSkill, taunted, nemesisHistory, underlingPowered) {
		const now = new Date().getTime();
		const world = await sql.getWorld(winner.channel);
		let output = '';
		
		// Loser gains the Ready status, winner loses ready status if training
		if(winner.status.find(s => s.type == enums.Statuses.Training)) {
			await this.deleteStatus(winner, enums.Statuses.Training);
		}
		
		// Determine length of KO
		const difference = winnerSkill - loserSkill + 1; 		// Effective 0-2 (barring skill modifiers)
		const intensity = Math.max(winnerSkill, loserSkill);	// Effective 0-2
		let hours = Math.ceil(difference * intensity * 3);		// Effective 0-12
		hours = Math.max(Math.min(hours, 12), 1);				// Cap it at range 1-12 for now
		if(loser.glory < 250) {
			hours = Math.ceil(hours * loser.glory / 250);		// Reduce death time for low-glory players
		}
		
		let trueForm = false;
		let nemesisEnded = false;
		const winnerLevel = this.getPowerLevel(winner);
		const loserLevel = this.getPowerLevel(loser);
		let template = winnerLevel > loserLevel ? enums.FightSummaries.ExpectedWin : enums.FightSummaries.UnexpectedWin;
		if(winner.isNemesis) template = enums.FightSummaries.NemesisWin;
		if(nemesisHistory) {
			// The Nemesis is dead!
			let nemesis = await sql.getNemesis(winner.channel);
			if(nemesis.form < nemesis.maxForms && world.arc.type != enums.ArcTypes.DarkTournament) {
				// Reveal true form
				if(nemesis.form + 1 == nemesis.maxForms) {
					output += `For a moment, it seemed like ${loser.name} had lost... but then ${loser.config.Pronoun} revealed ${this.their(loser.config.Pronoun)} true final form!\n` +
						`The real battle begins here!\n`;
				} else {
					output += `For a moment, it seemed like ${loser.name} had lost... but then ${loser.config.Pronoun} revealed another, more powerful form!\n` +
						`The reign of the nemesis continues!\n`;
				}
				template = enums.FightSummaries.NemesisTrueForm;
				loser.level = nemesis.basePower * Math.max(Math.random() + 3.0 - nemesis.form * 0.5, 1.5);
				nemesis.form++;
				await this.deleteStatus(loser, enums.Statuses.Cooldown);
				hours = 0;
				trueForm = true;
				console.log(`Nemesis reveals true form after ${this.getTimeString(now - nemesis.startTime)}`);
			} else {
				// End the nemesis
				template = enums.FightSummaries.NemesisLoss;
				nemesisEnded = true;
				if(!winner.isUnderling) {
					await sql.newArc(winner.channel, enums.ArcTypes.Filler);
				}
				loser.level = this.newPowerLevel(data.heat * 0.8);
				hours = 24;
				output += `${winner.name} defeated the Nemesis!`;
				if(nemesisHistory.length > 2 && !winner.isUnderling) {
					output +=  ` Everyone's sacrifices were not in vain!`;
				}
				output += `\n`;

				// Give 10 Glory for each failed fight against this Nemesis
				let gloryGains = {};
				for(const i in nemesisHistory) {
					const h = nemesisHistory[i];
					if(gloryGains[h.id]) {
						gloryGains[h.id].glory += 10;
					} else {
						gloryGains[h.id] = {
							name: h.name,
							id: h.id,
							oldGlory: h.glory,
							glory: 10
						};
					}
				}
				for(const key in gloryGains) {
					const g = gloryGains[key];
					const gloryPlayer = await sql.getPlayerById(g.id);
					if(gloryPlayer && !gloryPlayer.isUnderling && !gloryPlayer.npc) {
						const rankUp = this.rankUp(g.oldGlory, g.glory);
						output += `${g.name} gains ${g.glory} glory! Total glory: ${g.oldGlory + g.glory}\n`;
						if(rankUp) {
							output += `${g.name}'s Rank has increased!\n`;
						}
						gloryPlayer.glory += this.getGlory(gloryPlayer, g.glory);
						if(winner.id == gloryPlayer.id) {
							winner.glory += this.getGlory(winner, g.glory);
						}
						await sql.setPlayer(gloryPlayer);
					}
				}
				console.log(`Nemesis defeated after ${this.getTimeString(now - nemesis.startTime)}`);
			}

			await sql.setNemesis(nemesis.channel, nemesis);
		}
		
		let glory = Math.ceil(Math.min(loserLevel / winnerLevel * 10, 100));
		// Award glory to the winner
		if(loser.isNemesis) glory *= 3;
		if(loser.npc == enums.NpcTypes.Phantom) glory *= 4;

		glory = this.getGlory(winner, glory);

		const rankUp = this.rankUp(winner.glory, glory);
		winner.glory += glory;
		if(trueForm) {
			output += `${winner.name} gains ${glory} Glory. Total Glory: ${winner.glory}`;
		} else {
			output += `${winner.name} is the winner! +${glory} Glory. Total Glory: ${winner.glory}`;
		}
		if(rankUp) {
			output += `\n${winner.name}'s Rank has increased!`;
		}

		// If the fight is in response to a taunt, and the taunter lost, reduce their Glory
		if(taunted) {
			const gloryPenalty = Math.ceil(Math.min(glory / 2, loser.glory));
			loser.glory -= gloryPenalty;
			output += `\n${loser.name} loses ${gloryPenalty} Glory.`
		}
		
		if((winner.isNemesis && !underlingPowered) || winner.isUnderling || winner.npc) {
			// Weaken the enemy
			if(winner.isNemesis || winner.npc == enums.NpcTypes.Zorbmaster) {
				hours = Math.max(hours, 6);
			}

			let underlings = await sql.getUnderlings(winner.channel);
			let vulnerable = true;
			for(var u of underlings) {
				var underling = await sql.getPlayerById(u.id);
				if(underling.npc == enums.NpcTypes.Zeach) {
					vulnerable = false;
					break;
				}
			}
			if(vulnerable) {
				let maxPowerLoss = 0.03;
				if(loserSkill < 0.8) maxPowerLoss = 0.015;
				else if(loserSkill > 1.6) maxPowerLoss = 0.06;
				else if(loserSkill > 1.2) maxPowerLoss = 0.045;
				const powerLoss = Math.min(maxPowerLoss * winnerLevel, loserLevel * 0.5);
				output += `\n**${winner.name}** is weakened, losing ${numeral(powerLoss.toPrecision(2)).format('0,0')} Power.`;
				winner.level -= powerLoss;
			} else {
				output += `\nA Zeach's energy field prevents ${winner.name} from losing any power!`;
			}
		}
		
		if(!trueForm) {
			const winnerOrbs = winner.items.find(i => i.type == enums.Items.Orb);
			if(loser.npc) {
				// Transfer all items
				for(const item of loser.items) {
					output += `\n${winner.name} took ${item.count} ${enums.Items.Name[item.type]}${item.count > 1 ? 's' : ''} from ${loser.name}!`;
					await sql.addItems(winner.channel, winner.id, item.type, item.count);
					await sql.addItems(loser.channel, loser.id, item.type, -item.count);
					if(item.type == enums.Items.Orb && item.count + (winnerOrbs ? winnerOrbs.count : 0) == 7) {
						output += `\n${winner.name} has gathered all seven magic orbs! Enter \`!help wish\` to learn about your new options.`;
					}
				}
			} else {
				// Orb transfers
				const loserOrbs = loser.items.find(i => i.type == enums.Items.Orb);
				const winnerOrbs = winner.items.find(i => i.type == enums.Items.Orb);
				if(loserOrbs && loserOrbs.count > 0) {
					output += `\n${winner.name} took ${loserOrbs.count} magic ${loserOrbs.count > 1 ? 'orbs' : 'orb'} from ${loser.name}!`;
					await sql.addItems(winner.channel, winner.id, enums.Items.Orb, loserOrbs.count);
					await sql.addItems(loser.channel, loser.id, enums.Items.Orb, -loserOrbs.count);
					if(loserOrbs.count + (winnerOrbs ? winnerOrbs.count : 0) == 7) {
						output += `\n${winner.name} has gathered all seven magic orbs! Enter \`!help wish\` to learn about your new options.`;
					}
				}
			}

			// Tournament processing
			const tournament = await sql.getTournament(winner.channel);
			if(tournament && tournament.status == enums.TournamentStatuses.Active) {
				const tourneyWinner = tournament.players.find(p => p && p.id == winner.id);
				const tourneyLoser = tournament.players.find(p => p && p.id == loser.id);
				if(tourneyWinner && tourneyLoser && 
					tourneyWinner.status == enums.TournamentPlayerStatuses.Pending &&
					((tourneyWinner.position % 2 == 0 && tourneyLoser.position == tourneyWinner.position + 1) ||
					(tourneyLoser.position % 2 == 0 && tourneyWinner.position == tourneyLoser.position + 1))) {
					// This was a tournament match!
					output += await this.tournamentMatch(tournament, winner);
				}
			}

			// End Nemesis
			if(nemesisEnded) {
				await sql.endNemesis(loser.channel);
			}
			// Berserk penalty
			if(loser.status.find(s => s.type == enums.Statuses.Berserk)) {
				hours += 3;
			}

			// Immortality
			if(loser.status.find(s => s.type == enums.Statuses.Immortal)) {
				hours = winner.isNemesis ? 3 : 1;
			}

			// Transformation penalty
			if(loser.status.find(s => s.type == enums.Statuses.Transform || 
				s.type == enums.Statuses.SuperTransform)) {
				await this.deleteStatus(loser, enums.Statuses.Transform);
				await this.deleteStatus(loser, enums.Statuses.SuperTransform);
				hours += 3;
			}

			// Ultimate Form
			if(loser.status.find(s => s.type == enums.Statuses.UltimateForm)) {
				hours = winner.isNemesis ? 3/12 : 1/12;
			}
		}

		// Log underling defeats
		if(loser.isUnderling) {
			await sql.recordUnderlingDefeat(loser.channel, loser.id);
			if(winner.isNemesis) {
				output += `\n${loser.name} is cast out by the Nemesis!`;
				await sql.setUnderling(loser.channel, loser.id, false);
			}
		}

		// Nemesis hijack
		if(winner.isUnderling && loser.isNemesis && !trueForm) {
			output += `\n${winner.name} has betrayed ${this.their(winner.config.Pronoun)} master and become the new Nemesis! The nightmare continues!`;
			await sql.setPlayer(winner);
			await this.setNemesis(winner);
			winner = await sql.getPlayerByUsername(winner.channel, winner.username);
			template = enums.FightSummaries.NemesisBetrayal;
		}
		
		// Delete open challenges for the winner
		await sql.deleteOpenOffers(winner.id, enums.OfferTypes.Fight);

		// Delete training complete status
		await this.deleteStatus(winner, enums.Statuses.TrainingComplete);
		await this.deleteStatus(loser, enums.Statuses.TrainingComplete);
		
		// Add new row to history
		await sql.addHistory(winner.channel, winner.id, winnerLevel, winnerSkill, loser.id, loserLevel, loserSkill);
		
		if(loser.npc) {
			output += `\n${loser.name} is slain, its body disintegrating in the wind!`;
		} else {
			// Death timer
			if(hours) {
				output += `\n${loser.name} will be able to fight again in ${this.getTimeString(hours * hour)}.`;
			}
		}

		if(winner.status.find(s => s.type == enums.Statuses.SelfDestruct)) {
			// Annihilate the winner
			output += `\n${winner.name} will be remembered fondly for ${this.their(winner.config.pronoun)} brave sacrifice...`;
			winner.level = 0;
			await sql.annihilatePlayer(winner.id);
			await sql.addStatus(winner.channel, winner.id, enums.Statuses.Annihilation);
			if(this.isFusion(winner)) {
				for(const p of winner.fusedPlayers) {
					await sql.annihilatePlayer(p.id);
					await sql.addStatus(p.channel, p.id, enums.Statuses.Annihilation);
				}
			}

			if(loser.isNemesis) {
				template = enums.FightSummaries.NemesisSelfDestruct;
			}
		}

		if(loser.status.find(s => s.type == enums.Statuses.SelfDestruct)) {
			// Annihilate the loser
			output += `\n${loser.name} gave ${this.their(loser.config.pronoun)} life, but it still wasn't enough...`;
			loser.level = 0;
			if(this.isFusion(loser)) {
				for(const p of loser.fusedPlayers) {
					await sql.annihilatePlayer(p.id);
					await sql.addStatus(p.channel, p.id, enums.Statuses.Annihilation);
				}
				await this.breakFusion(channel, loser.id, loser.fusedPlayers[0], loser.fusedPlayers[1]);
			} else {
				await sql.annihilatePlayer(loser.id);
				await sql.addStatus(loser.channel, loser.id, enums.Statuses.Annihilation);
			}
		}
        
		// Reset fight clock
		loser.lastFought = now;
		winner.lastFought = now;

		// Log an episode
		let templateList;
		switch(template) {
			case enums.FightSummaries.ExpectedWin:
				templateList = templates.FightTemplatesExpected;
				break;
			case enums.FightSummaries.UnexpectedWin:
				templateList = templates.FightTemplatesUnexpected;
				break;
			case enums.FightSummaries.NemesisWin:
				templateList = templates.FightTemplatesNemesisWins;
				break;
			case enums.FightSummaries.NemesisLoss:
				templateList = templates.FightTemplatesNemesisLoses;
				break;
			case enums.FightSummaries.NemesisTrueForm:
				templateList = templates.FightTemplatesNemesisTrueForm;
				break;
			case enums.FightSummaries.NemesisBetrayal:
				templateList = templates.FightTemplatesNemesisBetrayed;
				break;
			case enums.FightSummaries.NemesisSelfDestruct:
				templateList = templates.FightTemplatesNemesisSelfDestruct;
				break;
		}
		let summary = templateList[Math.floor(Math.random() * templateList.length)];
		summary = summary.replace(new RegExp('\\$winner', 'g'), winner.name)
			.replace(new RegExp('\\$loser', 'g'), loser.name)
			.replace(new RegExp('\\$wTheir', 'g'), this.their(winner.config.pronoun))
			.replace(new RegExp('\\$lTheir', 'g'), this.their(loser.config.pronoun));
		await sql.addEpisode(winner.channel, summary);

		// Save changes
		await this.killPlayer(loser, hours * hour + 1);
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
    async recruit(channel, target) {
		let nemesis = await sql.getNemesis(channel);
		let player = await sql.getPlayerById(nemesis.id);
		let embed = new Discord.RichEmbed();
		
		if(target) {
			// Send an offer
			embed.setTitle('UNDERLING RECRUITMENT')
				.setColor(0xff0000)
				.setDescription(`**${player.name}** wishes for **${target.name}** to join ${this.their(player.config.Pronoun)} army of evil! ` +
				`If you join, you'll become more powerful, and your power will make the Nemesis stronger. ` +
				`${target.name}, enter \`!join\` to accept the offer and serve the Nemesis in battle.`);
			await sql.addOffer(player, target, enums.OfferTypes.Recruit);
			return {embed: embed};
		} else {
			await sql.addOffer(player, null, enums.OfferTypes.Recruit);
			embed.setTitle('UNDERLING RECRUITMENT')
				.setColor(0xff0000)
				.setDescription(`**${player.name}** wishes for anyone to join ${this.their(player.config.Pronoun)} army of evil! ` +
				`If you join, you'll become more powerful, and your power will make the Nemesis stronger. ` +
				`the next person to enter \`!join\` will accept the offer and serve the Nemesis in battle.`);
			return {embed: embed};
		}
	},
	// Boot a player from the Underlings list.
    async exile(target) {
		const channel = target.channel;
		let nemesis = await sql.getNemesis(channel);
		let nemesisPlayer = await sql.getPlayerById(nemesis.id);
		
		await sql.setUnderling(channel, target.id, false);
		await this.deleteStatus(target, enums.Statuses.Energized);

		return `**${target.name}** is no longer ${nemesisPlayer.name}'s underling!`;
	},
	// Power up an underling.
    async energize(target) {
		const channel = target.channel;
		const nemesis = await sql.getNemesis(channel);
		const nemesisPlayer = await sql.getPlayerById(nemesis.id);
		
		const increase = this.getPowerLevel(target) * .3;
		await sql.addStatus(channel, target.id, enums.Statuses.Energized, hour * 3);
		await sql.addStatus(channel, nemesis.id, enums.Statuses.Cooldown, hour * 3, enums.Cooldowns.Energize);

		return `**${nemesisPlayer.name}** grants **${target.name}** a fragment of ${this.their(nemesisPlayer.pronoun)} mighty power!\n` +
			`${target.name}'s power level increases by ${numeral(increase.toPrecision(2)).format('0,0')}!`;
	},
	// Revive a dead underling.
    async revive(target) {
		const channel = target.channel;
		let nemesis = await sql.getNemesis(channel);
		let nemesisPlayer = await sql.getPlayerById(nemesis.id);
		
		await this.healPlayer(target);
		let increase = this.getPowerLevel(target) * 0.2;
		target.level *= 1.2;
		await sql.addStatus(channel, nemesisPlayer.id, enums.Statuses.Cooldown, 24 * hour, enums.Cooldowns.Revive);
		await sql.setPlayer(target);

		return `**${nemesisPlayer.name}** breathes new life into **${target.name}**, reviving ${this.them(target.config.pronoun)}` +
			` and increasing ${this.their(target.config.pronoun)} power level!`;
	},
	// Sends a player a recruitment offer to join the Nemesis.
    async joinNemesis(player) {
		const channel = player.channel;
		let nemesis = await sql.getNemesis(channel);
		let nemesisPlayer = await sql.getPlayerById(nemesis.id);
		let underlings = await sql.getUnderlings(channel);
		let world = await sql.getWorld(channel);
		
		await this.completeTraining(player);
		await sql.setUnderling(channel, player.id, true);
		await sql.deleteOffer(nemesis.id, player.id, enums.OfferTypes.Recruit);

		// If we just hit max underlings, delete all outstanding recruitment offers
		const maxUnderlings = Math.floor(world.population / 5) - 1;
		if(underlings.length + 1 >= maxUnderlings) {
			await sql.deleteRecruitOffers(channel);
		}
		return `**${player.name}** has joined the Nemesis in ${this.their(nemesisPlayer.config.Pronoun)} campaign of destruction!\n` +
			`Your power level is increased, and you automatically boost the Nemesis's power when they come under attack. For more info, enter \`!help underlings\`.`;
	},
	// Destroy command.
	async destroy(player) {
		const channel = player.channel;
		let players = await sql.getPlayers(channel);
		let embed = new Discord.RichEmbed();
		
		embed.setTitle('DESTRUCTION')
			.setDescription(`The Nemesis uses ${this.their(player.config.Pronoun)} full power to destroy an entire planet!`)
			.setColor(0xff0000);
		
		let output = '';
		let targetPlayers = [];
		for(const i in players) {
			let p = players[i];
			if(p && p.id != player.id && !p.status.find(s => s.type == enums.Statuses.Dead) && 
				!p.status.find(s => s.type == enums.Statuses.Annihilation) &&
				(!p.isUnderling || !player.isNemesis)) {
					targetPlayers.push(p);
			}
		}
		let targets = Math.max(2, Math.ceil(players.length / 4));
		targets = Math.min(targets, targetPlayers.length);
		let firstTarget = Math.floor(Math.random() * targetPlayers.length);
		firstTarget = 3;
		
		for(let i = 0; i < targets; i++) {
			let target = targetPlayers[(firstTarget + i) % targetPlayers.length];
			await this.completeTraining(target);
			
			if(target.npc) {
				if(target.npc == enums.NpcTypes.Zorbmaster) {
					output += `${target.name} emerges unscathed from the explosion!`;
				} else {
					await this.killPlayer(target);
					output += `${target.name} disintegrates with a roar!`;
				}
			} else {
				const guarded = target.status.find(s => s.type == enums.Statuses.Guarded);
				if(guarded && guarded.rating) {
					const guard = await sql.getPlayerById(guarded.rating);
					output += `${guard.name} jumps in the way to protect ${target.name}!\n`;
					const guardIndex = targetPlayers.findIndex(p => p.id == guard.id);
					if(guardIndex > -1) {
						targetPlayers.splice(guardIndex, 1);
					}
					target = guard;
				}
				if(target.status.find(s => s.type == enums.Statuses.UltimateForm)) {
					await this.killPlayer(target, hour / 4);
					output += `${target.name} cannot fight for another 15 minutes!`;
				} else {
					if(target.status.find(s => s.type == enums.Statuses.Immortal)) {
						await this.killPlayer(target, hour * 3);
						output += `${target.name} cannot fight for another 3 hours!`;
					} else {
						await this.killPlayer(target, hour * 12);
						output += `${target.name} cannot fight for another 12 hours!`;
					}
				}
			}

			let orbs = target.items.find(i => i.type == enums.Items.Orb);
			if(orbs && orbs.count > 0) {
				// Their orbs are scattered
				output += ` ${orbs.count} ${orbs.count == 1 ? 'orb is' : 'orbs are'} lost in the depths of space!`;
				await sql.addItems(channel, target.id, enums.Items.Orb, -orbs.count);
			}
			output += '\n';
		}
		
		if(!player.npc) {
			await sql.addStatus(channel, player.id, enums.Statuses.Cooldown, 24 * hour, enums.Cooldowns.Destroy);
		}
		
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

		const plants = garden.plants.filter(p => p.planterId != nemesis.id);
		plants.sort((a, b) => {
			return a.slot - b.slot;
		});

		let embed = new Discord.RichEmbed();
		embed.setTitle('INFERNO')
			.setColor(0xff0000);

		const firstPick = Math.floor(Math.random() * plants.length);
		const targets = Math.max(Math.floor(plants.length / 4), 2);
		let output = `The Nemesis lays waste to the garden!`;
		for(let i = 0; i < targets; i++) {
			const index = (i + firstPick) % plants.length;
			if(plants[index]) {
				// Found a plant, burn it
				let plant = plants[index];
				let planter = await sql.getPlayerById(plant.planterId);
				await sql.deletePlant(plant.id);

				output += `\n${planter ? planter.name : 'Someone'}'s ${plant.name} is burned to ashes!`;
			}
		}
		await sql.addStatus(channel, nemesis.id, enums.Statuses.Cooldown, 12 * hour, enums.Cooldowns.Burn);

		embed.setDescription(output);
		return embed;
	},
	// Attempt to create a new Fusion.
    async fuse(sourcePlayer, targetPlayer, fusionName) {
		const channel = sourcePlayer.channel;
		const now = new Date().getTime();
		const world = await sql.getWorld(channel);
		let output = [];

		// Check to see if we're accepting an offer
		let fusionOffer = sourcePlayer.offers.find(o => o.type == 1 && o.playerId == targetPlayer.id && fusionName == o.extra);
		if(fusionOffer) {
			await this.completeTraining(sourcePlayer);
			await this.completeTraining(targetPlayer);
			this.addHeat(world, 100);
			const name = fusionName;
			const fusedPlayer = {
				name: name,
				channel: channel,
				level: Math.max(sourcePlayer.level, targetPlayer.level) + this.newPowerLevel(world.heat),
				powerWish: sourcePlayer.powerWish || targetPlayer.powerWish,
				glory: sourcePlayer.glory + targetPlayer.glory,
				lastActive: now,
				lastFought: Math.max(sourcePlayer.lastFought, targetPlayer.lastFought),
				trainingDate: now,
				actionLevel: Math.max(sourcePlayer.actionLevel, targetPlayer.actionLevel),
				gardenLevel: Math.max(sourcePlayer.gardenLevel, targetPlayer.gardenLevel),
				config: {
					alwaysPrivate: sourcePlayer.config.alwaysPrivate && targetPlayer.config.alwaysPrivate,
					ping: sourcePlayer.config.ping && targetPlayer.config.ping,
					AutoTrain: sourcePlayer.config.AutoTrain && targetPlayer.config.AutoTrain,
					pronoun: sourcePlayer.config.Pronoun == targetPlayer.config.Pronoun ? sourcePlayer.config.Pronoun : 'they'
				}
			};
			const fusionId = await sql.addPlayer(fusedPlayer);
			fusedPlayer.id = fusionId;
			await sql.setFusionId(fusionId, fusionId);
			await sql.setFusionId(sourcePlayer.id, fusionId);
			await sql.setFusionId(targetPlayer.id, fusionId);
			await sql.deleteAllFusionOffers(sourcePlayer.id);
			await sql.deleteAllFusionOffers(targetPlayer.id);
			await sql.addStatus(channel, fusionId, enums.Statuses.Fused, 24 * hour);
			await sql.addStatus(channel, sourcePlayer.id, enums.Statuses.Cooldown, 7 * 24 * hour, enums.Cooldowns.FusionUsed);
			await sql.addStatus(channel, targetPlayer.id, enums.Statuses.Cooldown, 7 * 24 * hour, enums.Cooldowns.FusionUsed);
			for (const item of sourcePlayer.items) {
				await sql.addItems(channel, fusionId, item.type, item.count);
				await sql.addItems(channel, sourcePlayer.id, item.type, -item.count);
			}
			for (const item of targetPlayer.items) {
				if(item.type != enums.Items.Trophy) {
					await sql.addItems(channel, fusionId, item.type, item.count);
					await sql.addItems(channel, targetPlayer.id, item.type, -item.count);
				}
			}
			for(const status of sourcePlayer.status) {
				if(enums.Statuses.CopyToFusion[status.type]) {
					if(status.endTime) {
						await this.deleteStatusById(sourcePlayer, status.id);
					}
					await sql.addStatus(channel, fusionId, status.type, status.endTime ? (status.endTime - now) : null, status.rating);
				}
			}
			for(const status of targetPlayer.status) {
				if(enums.Statuses.CopyToFusion[status.type]) {
					if(status.endTime) {
						await this.deleteStatusById(targetPlayer, status.id);
					}
					await sql.addStatus(channel, fusionId, status.type, status.endTime ? (status.endTime - now) : null, status.endTime - now, status.rating);
				}
			}
			await sql.deleteOffersForPlayer(sourcePlayer.id);
			await sql.deleteOffersForPlayer(targetPlayer.id);
			console.log(`Created fusion of ${sourcePlayer.name} and ${targetPlayer.name} as ${name}`);
			
			return [`**${sourcePlayer.name}** and **${targetPlayer.name}** pulsate with a strange power as they perform an elaborate dance. Suddenly, there is a flash of light!`,
				await this.getPlayerDescriptionById(fusionId, sourcePlayer.username)];
		}

		// Send an offer to the other player
		const expiration = now + hour * 6;
		const fuseCommand = `!fuse ${sourcePlayer.name}` + (fusionName ? ' ' + fusionName : '');
		sql.addOffer(sourcePlayer, targetPlayer, enums.OfferTypes.Fusion, fusionName);
		console.log(`'New fusion offer from ${sourcePlayer.name} for player ${targetPlayer.name} expires at ${new Date(expiration)}`);
		
		let embed = new Discord.RichEmbed();
		embed.setTitle('FUSION OFFER')
			.setColor(0x8080ff)
			.setDescription(`**${sourcePlayer.name}** wants to fuse with **${targetPlayer.name}**! ${targetPlayer.name}, enter \`${fuseCommand}\` to accept the offer and fuse.\n` +
			'Fusion lasts 24 hours before you split again.\n' + 
			'The offer will expire in six hours.');
		const message = targetPlayer.config.Ping ? await this.getPings(targetPlayer) : null;
		output.push(embed);
		if(message) output.push(message);
		return output;
	},
	async breakFusion(channel, fusionId, playerId1, playerId2, pings, messages) {
		const fusionPlayer = await sql.getPlayerById(fusionId);
		const fusedPlayer1 = await sql.getPlayerById(playerId1);
		const fusedPlayer2 = await sql.getPlayerById(playerId2);
		const now = new Date().getTime();
		if(!fusionPlayer || !fusedPlayer1 || !fusedPlayer2) return;

		// Divvy up skill and glory gains
		const preGarden = Math.max(fusedPlayer1.gardenLevel, fusedPlayer2.gardenLevel);
		const gardenDiff = (fusionPlayer.gardenLevel - preGarden) / 2;
		fusedPlayer1.gardenLevel += gardenDiff;
		fusedPlayer2.gardenLevel += gardenDiff;

		const preAction = Math.max(fusedPlayer1.actionLevel, fusedPlayer2.actionLevel);
		const actionDiff = (fusionPlayer.actionLevel - preAction) / 2;
		fusedPlayer1.actionLevel += actionDiff;
		fusedPlayer2.actionLevel += actionDiff;

		fusedPlayer1.level = fusionPlayer.level / 2;
		fusedPlayer2.level = fusionPlayer.level / 2;

		const preGlory = fusedPlayer1.glory + fusedPlayer2.glory;
		const gloryDiff = Math.floor((fusionPlayer.glory - preGlory) / 2);
		fusedPlayer1.glory += gloryDiff;
		fusedPlayer2.glory += gloryDiff;

		fusedPlayer1.lastActive = fusionPlayer.lastActive;
		fusedPlayer2.lastActive = fusionPlayer.lastActive;
		fusedPlayer1.lastFought = fusionPlayer.lastFought;
		fusedPlayer2.lastFought = fusionPlayer.lastFought;

		await sql.setPlayer(fusedPlayer1);
		await sql.setPlayer(fusedPlayer2);

		// Roll for items like this is some kind of old-school MMO raid
		for (const item of fusionPlayer.items) {
			for (let i = 0; i < item.count; i++) {
				if (Math.random() >= 0.5) {
					await sql.addItems(channel, fusedPlayer1.id, item.type, 1);
				} else {
					await sql.addItems(channel, fusedPlayer2.id, item.type, 1);
				}
			}
		}

		// Unfuse
		await sql.setFusionId(fusedPlayer1.id, 0);
		await sql.setFusionId(fusedPlayer2.id, 0);

		// Update last active values for the players
		fusedPlayer1.lastActive = fusionPlayer.lastActive;
		fusedPlayer2.lastActive = fusionPlayer.lastActive;
		fusedPlayer1.lastFought = fusionPlayer.lastFought;
		fusedPlayer2.lastFought = fusionPlayer.lastFought;

		// Delete offers
		for(const offer of fusionPlayer.offers) {
			await sql.deleteOffer(offer.playerId, offer.targetId, offer.type);
		}

		// Split up statuses
		for(const status of fusionPlayer.status) {
			if(status.type != enums.Statuses.Fused) {
				if(status.endTime) {
					await sql.addStatus(channel, fusedPlayer1.id, status.type, (status.endTime - now) / 2, status.rating);
					await sql.addStatus(channel, fusedPlayer2.id, status.type, (status.endTime - now) / 2, status.rating);
				}
				await this.deleteStatusById(fusionPlayer, status.id);
			}
		}

		// Clean up the fusion player
		await sql.deletePlayer(fusionPlayer.id);

		if(messages) {
			messages.push(`**${fusionPlayer.name}** disappears in a flash of light, leaving two warriors behind.`);
		}

		if(pings && fusedPlayer1.config.Ping) {
			pings.push(await this.getPings(fusedPlayer1));
		}
		if(pings && fusedPlayer2.config.Ping) {
			pings.push(await this.getPings(fusedPlayer2));
		}
	},
	// Establish a character as a new Nemesis.
    async setNemesis(player) {
		const channel = player.channel;
		let world = await sql.getWorld(channel);
		let nemesis = await sql.getNemesis(channel);
		if(!player) {
			console.log('Player not found');
			return null;
		}
		
		let embed = new Discord.RichEmbed();
		const now = new Date().getTime();
		embed.setTitle(player.name.toUpperCase())
			.setColor(0xff0000);
		
		// Raise heat, abort training
		this.addHeat(world, 100);
		await this.deleteStatus(player, enums.Statuses.Training);
		await this.deleteStatus(player, enums.Statuses.Ready);
		
		if(nemesis) {
			nemesis.id = player.id;
			nemesis.startTime = now;
		} else {
			nemesis = {
				id: player.id,
				startTime: now
			};
		}
		
		let nemesisLevel = 0;
		if(Math.random() < 0.25) {
			// A very special Nemesis
			nemesisLevel = this.newPowerLevel(world.heat) * settings.NemesisPower;
			nemesis.maxForms = 3;
		} else {
			// A normal Nemesis
			nemesisLevel= this.newPowerLevel(world.heat) * settings.NemesisPower * 2.5;
			nemesis.maxForms = 2;
		}
		nemesis.form = 1;
		player.level += Math.max(10, world.population) / 10 * nemesisLevel;
		nemesis.basePower = player.level;
		
		await sql.setHeat(channel, world.heat);
		await sql.setPlayer(player);
		await sql.setNemesis(channel, nemesis);
		await sql.addStatus(channel, player.id, enums.Statuses.Cooldown, 7 * 24 * hour, enums.Cooldowns.NemesisUsed);
		await sql.newArc(channel, enums.ArcTypes.Nemesis);

		embed.setTitle('A NEMESIS RISES');
		embed.setDescription(`**${player.name}** has become a Nemesis, and has declared war on the whole galaxy! ` +
			`Their rampage will continue until ${player.config.Pronoun} are defeated in battle.\n` + 
			`The Nemesis can no longer use most peaceful actions, but in exchange, ` +
			`${player.config.Pronoun} ${this.have(player.config.Pronoun)} access to several powerful new abilities. ` + 
			`For more information, enter \`!help nemesis\`.`);
		
		let output = [];
		output.push(embed);
		output.push(await this.generatePlayerDescription(player));

		return output;
	},
	// Check whether or not a player is a fusion.
    isFusion(player) {
        return player && player.fusedPlayers && player.fusedPlayers.length == 2;
	},
	// Check whether or not a player is a part of a fusion.
    isFusionPart(player) {
        return player && player.fusedPlayers.length == 0 && player.fusionId;
	},
	// Generates a new power level based on the current Heat.
    newPowerLevel(heat) {
		let level = Math.pow(150, 1 + heat / 1000) * (1 + Math.random() * settings.PowerVariation);
        if(level > 1000000000000000000) level = 1000000000000000000; // JS craps out if we go higher than this
        return level;
	},
	// Increase Heat, modified by reset count.
    addHeat(world, heat) {
		if(!world) return;
		const multiplier = 10 / Math.max(10, world.population) * settings.HeatMultiplier;
        const addedHeat = heat * (1 + 0.05 * world.resets) * multiplier;
        world.heat += addedHeat;
        console.log(`Heat increased by ${heat} to ${world.heat}`);
	},
	// Add a new plant to the garden.
	async plant(player, username, plantName) {
		const name = player.name;
		if(this.isFusion(player)) {
			player = player.fusedPlayers.find(p => p.username == username);
		}
		let garden = await sql.getGarden(player.channel);

		if(!plantName) {
			plantName = player.isNemesis ? 'zlower' : 'flower';
		}

		let plantId = Object.values(enums.Items).find(t => enums.Items.Name[t] == plantName.toLowerCase());
		if(!plantId) plantId = -1;
		if(plantId == -1) {
			return;
		}

		let slot = -1;
		// Is the private slot occupied?
		let myPlant = garden.plants.find(p => p.planterId == player.id && p.slot == -1);
		if(myPlant) {
			// Which spot is open?
			slot = 0;
			while(slot < garden.slots && garden.plants.find(p => p.slot == slot)) {
				slot++;
			}
			if(slot == garden.slots) {
				return;
			}
		}

		await sql.addPlant(player, plantId, slot);
		let output = `${name} plants a ${plantName.toLowerCase()} in the garden.`;
		
		if(player.isNemesis) {
			await sql.addStatus(player.channel, player.id, enums.Statuses.Cooldown, 3 * hour, enums.Cooldowns.Garden);
		}

		await sql.setPlayer(player);

		return output;
	},
	async water(channel, player, fixedTime) {
		let garden = await sql.getGarden(channel);
		const world = await sql.getWorld(channel);
		const now = new Date().getTime();

		const plants = garden.plants.filter(p => p.slot != -1 || p.planterId == player.id ||
			player.fusedPlayers.find(f => f.id == p.planterId));
		const time = player ? ((Math.random() * 20 + 10) * 60 * 1000) * (1 + 0.08 * player.gardenLevel) * 
			(10 / (garden.slots + 10)) * (10 / Math.max(10, world.population)) * settings.GardenWaterSpeed
			: fixedTime * (10 / Math.max(10, world.population));
		let output = player ? `${player.name} works on the garden.` : '';
		let plantsUpdated = {};
		let plantsFinished = [];
		for(const i in plants) {
			let plant = plants[i];
			if(plant) {
				if(fixedTime && plant.type == enums.Items.Sedge) {
					// Sedges don't grow other Sedges
					continue;
				}
				const duration = plant.endTime - plant.startTime;
				const oldProgress = ((now - plant.startTime) / duration) * 100;
				if(oldProgress < 100) {
					plant.startTime -= time;
					const newProgress = ((now - plant.startTime) / duration) * 100;
					const growth = Math.ceil((newProgress - oldProgress) * 10) / 10;
					if(plantsUpdated[plant.name]) {
						plantsUpdated[plant.name].count++;
					} else {
						plantsUpdated[plant.name] = {
							name: plant.name,
							type: plant.type,
							count: 1,
							growth: growth
						};
					}
					if(newProgress >= 100) {
						plantsFinished.push(plant);
					}
					await sql.setPlant(plant);
				}
			}
		}

		for(const key in plantsUpdated) {
			const p = plantsUpdated[key];
			if(p.count == 1) {
				output += `\nGrowth increases by ${p.growth}% for ${enums.Items.An[p.type] ? 'an' : 'a'} ${enums.Items.Name[p.type]}.`;
			} else {
				output += `\nGrowth increases by ${p.growth}% for ${p.count} ${enums.Items.NamePlural[p.type]}.`;
			}
		}
		for(const p of plantsFinished) {
			const player = await sql.getPlayerById(p.planterId);
			if(player) {
				output += `\n${player.name}'s ${p.name} is ready to be picked!`;
			}
		}
		
		// Update garden level
		if(player) {
			if(await this.gardenLevelUp(player)) {
				output += '\nGardening level increased!';
			}
			await sql.setPlayer(player);
		}

		return output;
	},
	async unwater(channel, name) {
		let player = await sql.getPlayerByUsername(channel, name);
		const garden = await sql.getGarden(channel);
		const world = await sql.getWorld(channel);
		const now = new Date().getTime();
		
		let powerup = this.newPowerLevel(world.heat) * 0.1;
		let multiplier = 1;

		if(garden.plants.length == 0) {
			return null;
		}
		const time = hour * 2 / garden.plants.length;

		let output = `${player.name} drains energy from the garden!`;
		for(const plant of garden.plants) {
			if(plant) {
				const duration = plant.endTime - plant.startTime;
				const oldProgress = ((now - plant.startTime) / duration) * 100;
				if(oldProgress < 100) {
					plant.startTime += time;
					const newProgress = ((now - plant.startTime) / duration) * 100;
					const growth = Math.ceil((oldProgress - newProgress) * 10) / 10;
					output += `\n${plant.name.replace(/^\w/, c => c.toUpperCase())} growth decreases by ${growth}%.`;
					if(newProgress <= 0) {
						output += ` It shrivels away!`;
						await sql.deletePlant(plant.id);
						multiplier += 1;
					} else {
						await sql.setPlant(plant);
					}
				}
			}
		}

		powerup *= multiplier;
		output += `\nThe Zedge's power level increases by ${numeral(powerup.toPrecision(2)).format('0,0')}!`;
		player.level += powerup;
		await sql.setPlayer(player);
		
		return output;
	},
	async pick(player, username, plantType) {
		const name = player.name;
		if(this.isFusion(player)) {
			player = player.fusedPlayers.find(p => p.username == username);
		}

		const channel = player.channel;
		const garden = await sql.getGarden(channel);
		const now = new Date().getTime();

		// Find the plant
		const plantList = garden.plants.filter(p => p.slot > -1 || p.planterId == player.id ||
			player.fusedPlayers.find(f => f.id == p.planterId && f.username == username));
		plantList.sort((a, b) => {
			return a.slot - b.slot;
		});

		const plant = plantType ?
			plantList.find(p => p && p.name.toLowerCase() == plantType.toLowerCase() && p.endTime < now) :
			plantList.find(p => {
				if(p && p.endTime < now) {
					if(player.isNemesis && enums.Items.Type[p.type] != enums.ItemTypes.DarkPlant) {
						return false;
					}
					if(!player.isNemesis && enums.Items.Type[p.type] == enums.ItemTypes.DarkPlant) {
						return false;
					}
					let heldPlants = player.items.find(i => i.type == p.type);
					if(heldPlants && heldPlants.count >= 3) {
						return false;
					}
					return true;
				}
				return false;
			});
		if(!plant) return;

		await sql.deletePlant(plant.id);
		if(enums.Items.Type[plant.type] == enums.ItemTypes.DarkPlant) {
			// Spawn the appropriate monsters
			switch(plant.type) {
				case enums.Items.Zlower:
					await this.addNpc(channel, enums.NpcTypes.Zlower);
					return 'A misshapen Zlower claws its way out of the soil!';
				case enums.Items.Zarrot:
					await this.addNpc(channel, enums.NpcTypes.Zarrot);
					return 'A wriggling Zarrots claws its way out of the soil!';
				case enums.Items.Zedge:
					await this.addNpc(channel, enums.NpcTypes.Zedge);
					return 'A writhing Zedge claws its way out of the soil!';
				case enums.Items.Zeach:
					await this.addNpc(channel, enums.NpcTypes.Zeach);
					return 'A glowing Zeach claws its way out of the soil!';
			}
		} else {
			// Transfer it into the inventory
			await sql.addItems(channel, player.id, plant.type, 1);
			return `${name} picks a ${plant.name.toLowerCase()}.`;
		}
	},
	async useItem(player, username, target, plantType) {
		const name = player.name;
		if(this.isFusion(player)) {
			player = player.fusedPlayers.find(p => p.username == username);
		}
		const channel = player.channel;
		let plantItem = player.items.find(i => enums.Items.Name[i.type] == plantType.toLowerCase());
		const now = new Date().getTime();

		if(!target && plantItem.type != enums.Items.Sedge) {
			return;
		}
		if(!plantItem) {
			return;
		}

		let output = '';
		let defeatedState;
		switch(plantItem.type) {
			case enums.Items.Flower:
				defeatedState = await this.healPlayer(target, 6 * hour);
				if(defeatedState) {
					const duration = defeatedState.endTime - now;
					output = `**${name}** heals **${target.name}**, but ${target.config.Pronoun} still won't be able to fight for ${this.getTimeString(duration)}.`;
				} else {
					output = `**${name}** heals **${target.name}** back to fighting shape!`;
					if(target.config.AutoTrain && !target.isUnderling) {
						output += `\n**${target.name}** has started training.`;
					} else if(target.isUnderling) {
						output += await this.underlingPowerup(target);
					}
				}
				break;
			case enums.Items.Rose:
				defeatedState = await this.healPlayer(target, 12 * hour);
				if(defeatedState) {
					const duration = defeatedState.endTime - now;
					output = `**${name}** heals **${target.name}**, but ${target.config.Pronoun} still won't be able to fight for ${this.getTimeString(duration)}.`;
				} else {
					output = `**${name}** heals **${target.name}** back to fighting shape!`;
					if(target.config.AutoTrain && !target.isUnderling) {
						output += `\n**${target.name}** has started training.`;
					} else if(target.isUnderling) {
						output += await this.underlingPowerup(target);
					}
				}
				break;
			case enums.Items.Carrot:
				await sql.addStatus(channel, target.id, enums.Statuses.Carrot, hour * 6);
				output = `**${target.name}** eats the carrot, and ${this.their(target.config.Pronoun)} senses feel sharper!`;
				break;
			case enums.Items.Bean:
				await sql.addStatus(channel, target.id, enums.Statuses.Bean, hour);
				const levelBoost = this.getPowerLevel(target) * .12;
				output = `**${target.name}** eats the bean, and ${this.their(target.config.Pronoun)} power increases by ${numeral(levelBoost.toPrecision(2)).format('0,0')}!`;
				break;
			case enums.Items.Sedge:
				output = await this.water(channel, player, 2 * hour);
				let garden = await sql.getGarden(channel);
				const world = await sql.getWorld(channel);
				const expansion = ((Math.random() * 15 + 15) * 5 / (100 * (3 + garden.growthLevel))) * (10 / Math.max(10, world.population));
				const percent = Math.floor(1000 * expansion) / 10;
				console.log(`Sedge advanced garden level by ${percent}%`);
				output += `\nThe garden's growth level increases with a rating of ${percent}%.`;
				garden.growthLevel += expansion;
				const gardenEfficiency = 1 + 0.1 * garden.growthLevel;
				const rate = Math.floor(1000 / gardenEfficiency) / 10;
				output += `\nYour plants now take ${rate}% the usual time to grow.`;
				await sql.setGarden(garden);
				break;
			case enums.Items.Fern:
				await sql.addStatus(channel, target.id, enums.Statuses.Fern, hour * 12);
				output = `**${target.name}** eats the fern, and ${this.their(target.config.Pronoun)} power is hidden!`;
				break;
			case enums.Items.Gourd:
				let journey = target.status.find(s => s.type == enums.Statuses.Journey);
				let training = target.status.find(s => s.type == enums.Statuses.Training);
				if(journey) {
					journey.startTime -= settings.GourdHours * hour;
					await sql.setStatus(journey);
					output = `**${target.name}** eats the gourd, and ${this.their(target.config.Pronoun)} training becomes more potent!`;
				} else if(training) {
					training.startTime -= settings.GourdHours * hour;
					await sql.setStatus(training);
					output = `**${target.name}** eats the gourd, and ${this.their(target.config.Pronoun)} training becomes more potent!`;
				}
				break;
			case enums.Items.Peach:
				await sql.addStatus(channel, target.id, enums.Statuses.Immortal, hour * 6);
				output = `**${target.name}** eats the celestial peach, and ${this.their(target.config.Pronoun)} life force overflows!`;
				break;
		}

		if(target && target.config.Ping && target.id != player.id) {
			output += '\n' + await this.getPings(target);
		}
		await sql.addItems(channel, player.id, plantItem.type, -1);
		return output;
	},
	// Expand the garden.
	async expand(player, type) {
		let garden = await sql.getGarden(player.channel);
		let output = '';

		const averageLevel = (garden.growthLevel + garden.sizeLevel + garden.researchLevel) / 3;
		let expansion = (Math.random() * 2 + 4) * (1 + 0.08 * Math.floor(player.gardenLevel));
		let modifier = 1;
		let percent = 0;

		switch(type) {
			case 'growth':
				modifier = Math.min(1.5, Math.pow((averageLevel + 2) / (garden.growthLevel + 2), 3));
				expansion *= modifier * 3 / (100 * (3 + garden.growthLevel));
				garden.growthLevel += expansion;
				percent = Math.floor(1000 * expansion) / 10;
				console.log(`${player.name} advanced growth level by ${Math.floor(expansion * 100) / 100}, modifier was ${modifier}`);
				output += `**${player.name}** works on the garden's growth rate, with a rating of ${percent}%.`;

				const gardenEfficiency = 1 + 0.1 * garden.growthLevel;
				const rate = Math.floor(1000 / gardenEfficiency) / 10;
				output += `\nYour plants now take ${rate}% the usual time to grow.`;
				break;
			case 'size':
				modifier = Math.min(1.5, Math.pow((averageLevel + 2) / (garden.sizeLevel + 2), 3));
				expansion *= modifier * 2 / (100 * (2 + garden.sizeLevel));
				percent = Math.floor(1000 * expansion) / 10;
				if(garden.sizeLevel > 5) {
					output += `**${player.name}** works on the garden in general, with a rating of ${percent}%. Growth and Research levels are now easier to advance.`;
				} else {
					output += `**${player.name}** works on the garden's size, with a rating of ${percent}%.`;
				}
				garden.sizeLevel += expansion;
				console.log(`${player.name} advanced garden size by ${Math.floor(expansion * 100) / 100}, modifier was ${modifier}`);
				if(Math.floor(garden.sizeLevel) > Math.floor(garden.sizeLevel - expansion) && garden.sizeLevel <= 5) {
					// Level up!
					output += '\nThe garden now has an additional slot!'
					if(garden.sizeLevel >= 5) {
						output += '\nThis is the maximum size of the garden, but increasing this level further will make it easier to level up Growth and Research.';
					}
				}
				break;
			case 'research':
				modifier = Math.min(1.5, Math.pow((averageLevel + 2) / (garden.researchLevel + 2), 3));
				expansion *= modifier * 2 / (100 * (3 + garden.researchLevel));
				percent = Math.floor(1000 * expansion) / 10;
				const unknownPlants = garden.plantTypes.filter(t => !t.known && enums.Items.Type[t.id] == enums.ItemTypes.Plant);
				const unknownSuperPlants = garden.plantTypes.filter(t => !t.known && enums.Items.Type[t.id] == enums.ItemTypes.SuperPlant);
				console.log(`${player.name} advanced garden research by ${Math.floor(expansion * 100) / 100}, modifier was ${modifier}`);
				if(unknownPlants.length + unknownSuperPlants.length == 0) {
					output += `**${player.name}** works on researching gardening in general, with a rating of ${percent}%. Growth and Size levels are now easier to advance.`;
				} else {
					output += `**${player.name}** works on researching new plants, with a rating of ${percent}%.`;
				}
				garden.researchLevel += expansion;
				if(Math.floor(garden.researchLevel) > Math.floor(garden.researchLevel - expansion)) {
					// Level up!
					if(unknownPlants.length > 0) {
						let newPlant = unknownPlants[Math.floor(Math.random() * unknownPlants.length)];
						output += `\nResearch level increased! New plant "${enums.Items.Name[newPlant.id]}" can now be planted in the garden.`;
						await sql.researchPlant(player.channel, newPlant.id);
					} else if(unknownSuperPlants.length > 0) {
						let newPlant = unknownSuperPlants[Math.floor(Math.random() * unknownSuperPlants.length)];
						output += `\nResearch level increased! New plant "${enums.Items.Name[newPlant.id]}" can now be planted in the garden.`;
						await sql.researchPlant(player.channel, newPlant.id);
					}
					if(unknownPlants.length + unknownSuperPlants.length == 1) {
						output += `\nThere are no other plants for you to discover, but increasing this level further will make it easier to level up Growth and Size.`;
					}
				}
				break;
		}

		// Update garden level
		if(player) {
			if(await this.gardenLevelUp(player)) {
				output += '\nGardening level increased!';
			}
			await sql.setPlayer(player);
		}

		await sql.setGarden(garden);

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
				player.legacyGlory += player.glory;
				player.glory = 0;
				player.level = this.newPowerLevel(0);
				player.gardenLevel = 0;
				player.actionLevel = 0;
				player.fusionId = null;
				player.lastActive = now - 24 * hour;
				player.lastFought = now - 24 * hour;
				await sql.setPlayer(player);
			}
		}

		return 'Onwards, to a new adventure...! All Power Levels and player status has been reverted, but your Glory is preserved as Legacy Glory.';
	},
	// Register a new player.
	async registerPlayer(channel, username, userId, name) {
		let output = [];
		let world = await sql.getWorld(channel);
		const now = new Date().getTime();
		this.addHeat(world, 10);
		let player = {
			name: name,
			username: username,
			userId: userId,
			channel: channel,
			glory: 0,
			legacyGlory: 0,
			level: this.newPowerLevel(world.heat),
			lastActive: now,
			lastFought: now,
			gardenLevel: 0,
			actionLevel: 0,
			fusionId: null
		};
		await sql.addPlayer(player);
		console.log(`Registered ${username} as ${name}`);
		output.push(`Registered player ${name}!`);
		output.push(await this.getPlayerDescription(await sql.getPlayerByUsername(channel, username), username, false));

		return output;
	},
	// Display the garden status.
	async displayGarden(player, username) {
		if(this.isFusion(player)) {
			player = player.fusedPlayers.find(p => p.username == username);
		}
		let embed = new Discord.RichEmbed();
		let garden = await sql.getGarden(player.channel);

		embed.setTitle('The Garden')
			.setColor(0x00AE86);
		
		let plantStatus = '';
		// Add your personal slot
		const myPlant = garden.plants.find(p => p.planterId == player.id && p.slot == -1);
		plantStatus += `Your Garden: ${this.getPlantStatus(myPlant)}\n`;

		// Add the public plant slots
		if(garden.slots > 0) {
			plantStatus += '\n';
			for(let i = 0; i < garden.slots; i++) {
				const plant = garden.plants.find(p => p.slot == i);
				plantStatus += `Public Slot #${i + 1}: ${this.getPlantStatus(plant)}\n`;
			}
	
		}

		const growthLevel = Math.floor(garden.growthLevel);
		const growthProgress = Math.floor((garden.growthLevel - Math.floor(growthLevel)) * 100);
		const researchLevel = Math.floor(garden.researchLevel);
		const researchProgress = Math.floor((garden.researchLevel - Math.floor(researchLevel)) * 100);
		const sizeLevel = Math.floor(garden.sizeLevel);
		const sizeProgress = Math.floor((garden.sizeLevel - Math.floor(sizeLevel)) * 100);

		plantStatus += `\nGrowth Level: ${growthLevel} (${growthProgress}%)\n` +
			`Research Level: ${researchLevel} (${researchProgress}%)\n` +
			`Size Level: ${sizeLevel} (${sizeProgress}%)`;
		embed.setDescription(plantStatus);

		return embed;
	},
	getPlantStatus(plant) {
		const now = new Date().getTime();
		if(plant) {
			let displayName = plant.name.replace(/^\w/, c => c.toUpperCase());
			const duration = plant.endTime - plant.startTime;
			if(now > plant.endTime) {
				return `${displayName} (ready to pick)`;
			} else {
				const progress = Math.floor(((now - plant.startTime) / duration) * 100 );
				return `${displayName} (${progress}% complete)`;
			}
		} else {
			return '(Nothing planted)';
		}
	},
	// Search for orbs.
	async search(player) {
		const channel = player.channel;
		let world = await sql.getWorld(channel);
		let nemesis = await sql.getNemesis(channel);
		const now = new Date().getTime();
		let output = [];

		const effectiveTime = Math.min(now - world.lastWish, hour * 72);
		let searchMultiplier = 1;
		if(player.status.find(s => s.type == enums.Statuses.Carrot)) searchMultiplier += 1;
		if(player.isUnderling) searchMultiplier += 1;
		if(nemesis && nemesis.id) searchMultiplier += 1;
		searchMultiplier *= (10 / Math.max(world.population, 10)) * (effectiveTime / (hour * 72));
		let searchChance = (0.03 + player.actionLevel * 0.005) * searchMultiplier;
		if(world.lostOrbs == 0 || 
			world.arc.type == enums.ArcTypes.Tournament ||
			world.arc.type == enums.ArcTypes.DarkTournament ||
			(world.arc.type == enums.ArcTypes.Filler && world.lastArc.type == enums.ArcTypes.OrbHunt)) {
			searchChance = 0;
		}

		output = await this.searchOrbs(player, nemesis, searchChance, world);
		if(!output && !player.npc) {
			// Reset search multiplier with the orb-only modifiers removed - no bonus for underling or nemesis presence
			searchMultiplier = 1;
			if(player.status.find(s => s.type == enums.Statuses.Carrot)) searchMultiplier += 1;
			searchMultiplier *= (10 / Math.max(world.population, 10));
			searchChance = (0.05 + 0.01 * player.actionLevel) * searchMultiplier;
			output = await this.searchPlants(player, searchChance);
			if(!output) {
				// Reset search multiplier to be ONLY based on game population
				searchMultiplier = (10 / Math.max(world.population, 10));
				searchChance = 0.03 * searchMultiplier;
				output = await this.searchMonsters(player, searchChance);
			}
			if(!output) {
				searchChance = 0.02 * searchMultiplier * settings.EventFrequency;
				output = await this.searchEvents(player, world, searchChance);
			}
		}
		if(!output) {
			output = this.searchJunk(player, 0.1);
		}
		if(!output) {
			output = [];
			if(world.lostOrbs == 0) {
				output.push(`${player.name} searches the world, but there are no orbs left to find.`);
			} else if (world.arc.type == enums.ArcTypes.Tournament ||
				world.arc.type == enums.ArcTypes.DarkTournament ||
				(world.arc.type == enums.ArcTypes.Filler && world.lastArc.type == enums.ArcTypes.OrbHunt)) {
				output.push(`${player.name} searches the world, but the orbs have vanished from the world for now.`);
			} else {
				output.push(`${player.name} searches the world, but finds nothing of value.`);
			}
		}
		if(await this.actionLevelUp(player)) {
			output.push('Action level increased!');
		}
		
		await sql.setPlayer(player);
		await sql.setWorld(world);
		
		return output;
	},
	async searchOrbs(player, nemesis, searchChance, world) {
		const now = new Date().getTime();
		const roll = Math.random();
		let output = [];
		if(roll < searchChance) {
			console.log(`${player.name} found an orb on roll ${Math.floor(roll * 1000) / 10} out of chance ${Math.floor(searchChance * 1000) / 10}`);
			// They found an orb!
			if(player.npc && nemesis) {
				output.push(`${player.name} finds a magic orb, and delivers it to the Nemesis!`);
				await sql.addItems(player.channel, nemesis.id, enums.Items.Orb, 1);
			} else {
				output.push(`${player.name} searches the world, and finds a magic orb!`);
				await sql.addItems(player.channel, player.id, enums.Items.Orb, 1);
			}
			const existingOrbs = player.items.find(i => i.type == enums.Items.Orb);
			if(!existingOrbs) {
				// Start the fight timer
				player.lastFought = now;
			}
			if(existingOrbs && existingOrbs.count == 6) {
				output.push("You've gathered all seven magic orbs! Enter `!help wish` to learn about your new options.");
			}
			if(world.lostOrbs <= 5 && world.arc.type == enums.ArcTypes.Filler) {
				// This was the third orb - start a new Orb Hunt
				await sql.newArc(world.channel, enums.ArcTypes.OrbHunt);
				output.push("The hunt for the orbs is heating up! A new **Orb Hunt Arc** has begun!");
			}
		} else {
			console.log(`${player.name} failed to find an orb on roll ${Math.floor(roll * 1000) / 10} out of chance ${Math.floor(searchChance * 1000) / 10}`);			
		}

		if(output.length > 0) {
			return output;
		} else {
			return null;
		}
	},
	async searchPlants(player, searchChance) {
		const roll = Math.random();
		let output = [];

		if(roll < searchChance) {
			//They found a plant!
			const availablePlants = Object.values(enums.Items).filter(i => enums.Items.Type[i] == enums.ItemTypes.Plant);
			const plantType = availablePlants[Math.floor(Math.random() * availablePlants.length)];
			const plantName = enums.Items.Name[plantType];
			
			console.log(`${player.name} found a plant on roll ${Math.floor(roll * 1000) / 10} out of chance ${Math.floor(searchChance * 1000) / 10}`);
			let message = `${player.name} searches the world, and finds a ${plantName}!`;
			const existingPlants = player.items.find(i => i.type == plantType);
			if(existingPlants && existingPlants.count >= 3) {
				message += ` But you can't carry any more.`;
			} else {
				await sql.addItems(player.channel, player.id, plantType, 1);
			}
			output.push(message);
		} else {
			console.log(`${player.name} failed to find a plant on roll ${Math.floor(roll * 1000) / 10} out of chance ${Math.floor(searchChance * 1000) / 10}`);			
		}

		if(output.length > 0) {
			return output;
		} else {
			return null;
		}
	},
	async searchMonsters(player, searchChance) {
		const roll = Math.random();
		let output = [];

		if(roll < searchChance) {
			console.log(`${player.name} found a monster on roll ${Math.floor(roll * 1000) / 10} out of chance ${Math.floor(searchChance * 1000) / 10}`);
			if(Math.random() < 0.1) {
				// Zorbmaster discovered!
				output.push(`${player.name} searches the world, and awakens one of the ancient Zorbmasters! This world is surely doomed!`);
				const zorbmaster = await this.addNpc(player.channel, enums.NpcTypes.Zorbmaster);
				output.push(await this.generatePlayerDescription(await sql.getPlayerById(zorbmaster.id)));
			} else {
				// Zorb discovered!
				output.push(`${player.name} searches the world, and awakens an ancient Zorb!`);
				const zorb = await this.addNpc(player.channel, enums.NpcTypes.Zorb);
				output.push(await this.generatePlayerDescription(await sql.getPlayerById(zorb.id)));
			}
		} else {
			console.log(`${player.name} failed to find a monster on roll ${Math.floor(roll * 1000) / 10} out of chance ${Math.floor(searchChance * 1000) / 10}`);
		}

		if(output.length > 0) {
			return output;
		} else {
			return null;
		}
	},
	async searchEvents(player, world, searchChance) {
		const roll = Math.random();
		let output = [];

		const existingEvent = world.cooldowns.find(c => enums.Cooldowns.IsEvent[c.type]);
		const eventList = Object.keys(enums.Events).map(key => enums.Events[key]);
		if(roll < searchChance && !existingEvent) {
			let eventType = eventList[Math.floor(Math.random() * eventList.length)];
			switch(eventType) {
				case enums.Events.HotSpring:
					output.push(`${player.name} searches the world, and finds an enchanted hot spring! ` +
						`For the next 12 hours, injured players can use \`!event\` to recover faster.`);
					break;
				case enums.Events.Dojo:
					output.push(`${player.name} searches the world, and finds a training dojo in the mountains! ` +
						`For the next 12 hours, training players can use \`!event\` to boost the results of their training.`);
					break;
				case enums.Events.Guru:
					output.push(`${player.name} searches the world, and finds a mystical mountain garden guru! ` +
						`For the next 12 hours, active players can use \`!event\` to spar with the guru, suffering injuries but drawing out their latent gardening power.`);
					break;
				case enums.Events.Portal:
					// Can we form a portal?
					let worlds = await sql.getWorlds();
					const thisWorld = worlds.find(w => w.channel == player.channel);
					worlds = worlds.filter(w => w.channel != player.channel && !w.cooldowns.find(c => enums.Cooldowns.IsEvent[c.type]));
					if(worlds.length == 0) {
						return null;
					}

					// Pick a world to portal to
					const otherWorld = worlds[Math.floor(Math.random() * worlds.length)];
					await sql.newPortal(player.channel, otherWorld.channel);
					output.push(`${player.name} searches the world, and finds a portal to Universe ${otherWorld.id}! ` +
						`For the next 12 hours, active players can use \`!event\` to send energy through the portal or \`!event message\` to ` +
						`send a message along with the energy. At the end of the event, your energy will become a phantom warrior to test Universe ${otherWorld.id}'s power.`);
					output.push({
						target: otherWorld.channel,
						message: `A mysterious portal has appeared, leading to Universe ${thisWorld.id}! ` +
							`For the next 12 hours, active players can use \`!event\` to send energy through the portal or \`!event message\` to ` +
							`send a message along with the energy. At the end of the event, your energy will become a phantom warrior to test Universe ${thisWorld.id}'s power.`
					});
					await sql.addStatus(otherWorld.channel, null, enums.Statuses.Cooldown, 12 * hour, eventType);
					break;
			}
			await sql.addStatus(player.channel, null, enums.Statuses.Cooldown, 12 * hour, eventType);
		} else {
			console.log(`${player.name} failed to find an event on roll ${Math.floor(roll * 1000) / 10} out of chance ${Math.floor(searchChance * 1000) / 10}`);
		}

		if(output.length > 0) {
			return output;
		} else {
			return null;
		}
	},
	searchJunk(player, searchChance) {
		const roll = Math.random();
		let output = [];

		if(roll < searchChance) {
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
				"two huge snakes.",
				"a grief seed.",
				"a Zorb skeleton. Looks pretty fearsome..."
			];
			const junk = junkItems[Math.floor(Math.random() * junkItems.length)];
			console.log(`${player.name} found junk on roll ${Math.floor(roll * 1000) / 10} out of chance ${Math.floor(searchChance * 1000) / 10}`);
			output.push(`${player.name} searches the world, and finds ${junk}`);
		} else {
			console.log(`${player.name} found nothing on roll ${Math.floor(roll * 1000) / 10} out of chance ${Math.floor(searchChance * 1000) / 10}`);
		}

		if(output.length > 0) {
			return output;
		} else {
			return null;
		}
	},
	async wish(player, wish) {
		const channel = player.channel;
		let world = await sql.getWorld(channel);
		let players = await sql.getPlayers(channel, true);
		let nemesis = await sql.getNemesis(channel);
		const now = new Date().getTime();
		let messages = [];
		let output = `**${player.name}** makes a wish, and the orbs shine with power...!`;
		
		switch(wish.toLowerCase()) {
			case 'power':
				player.level *= Math.random() + 1.5;
				await sql.addStatus(channel, player.id, enums.Statuses.PowerWish);
				output += '\nYou can feel great power surging within you!';
				await sql.setPlayer(player);
				break;
			case 'resurrection':
				for(const p of players) {
					if(p.npc) continue;
					const annihilationState = p.status.find(s => s.type == enums.Statuses.Annihilation);
					if(annihilationState) {
						output += `\n${p.name} is brought back from the beyond!`;
						await this.deleteStatus(p, enums.Statuses.Annihilation);
						await sql.addStatus(channel, p.id, enums.Statuses.Dead, 12 * hour);
						p.level = 1;
						await sql.setPlayer(p);
					} else {
						const defeatedState = p.status.find(s => s.type == enums.Statuses.Dead);
						if(defeatedState) {
							output += `\n${p.name} is revived!`;
							await this.healPlayer(p);
							p.level *= 1.2;
							await sql.setPlayer(p);
						}
					}
				}
				break;
			case 'immortality':
				output += '\nNo matter how great of an injury you suffer, you will always swiftly return!';
				const defeatedState = player.status.find(s => s.type == enums.Statuses.Dead);
				if(defeatedState) {
					await this.healPlayer(player);
				}
				await sql.addStatus(channel, player.id, enums.Statuses.Immortal);
				break;
			case 'gardening':
				output += '\nYou have become the master of gardening!';
				await sql.addStatus(channel, player.id, enums.Statuses.GardenWish);
				await sql.setPlayer(player);
				break;
			case 'ruin':
				output += '\n**The countdown to the destruction of the universe has begun!**\n'
					+ 'You have 6 hours to defeat the Nemesis! If the Nemesis is still alive when time runs out, everything will be destroyed.';
				await sql.addStatus(channel, null, enums.Statuses.Cooldown, hour * 6, enums.Cooldowns.Ruin);
				nemesis.lastRuinUpdate = now;
				await sql.setNemesis(channel, nemesis);
				break;
			case 'snap':
				output += `\n${player.name} snaps ${this.their(player.config.Pronoun)} fingers, and half of the universe perishes!`;
				let snappedSelf = false;
				let snapPlayers = players.filter(p => !p.idle && !p.status.find(s => s.type == enums.Statuses.Annihilation));
				this.shuffle(snapPlayers);
				for(var i = 0; i < snapPlayers.length / 2; i++) {
					output += '\n';
					let target = snapPlayers[i];
					await this.completeTraining(target);
							
					if(target.npc) {
						await sql.deletePlayer(target.id);
						output += `${target.name} disintegrates with a roar!`;
					} else {
						if(target.status.find(s => s.type == enums.Statuses.UltimateForm)) {
							await this.killPlayer(target, hour / 2);
							output += `${target.name} cannot fight for another 30 minutes!`;
						} else {
							if(target.status.find(s => s.type == enums.Statuses.Immortal)) {
								await this.killPlayer(target, hour * 3);
								output += `${target.name} cannot fight for another 6 hours!`;
							} else {
								await this.killPlayer(target, hour * 12);
								output += `${target.name} cannot fight for another 24 hours!`;
							}
						}
					}

					if(target.isNemesis) {
						// The nemesis suicided
						snappedSelf = true;
						await sql.endNemesis(channel);
						target.level = this.newPowerLevel(world.heat * 0.8);
						await sql.setPlayer(target);
					}
				}

				if(!snappedSelf) {
					output += `${player.name}'s dark work is complete, and ${player.config.Pronoun} retires from the life of the Nemesis.`;
					await sql.endNemesis(channel);
					player.level = this.newPowerLevel(world.heat);
					await sql.setPlayer(player);
				}
				break;
			case 'games':
				// Exile all underilngs
				const underlings = await sql.getUnderlings(channel);
				for(const underling of underlings) {
					await sql.setUnderling(channel, underling.id, false);
				}

				// Shorten everyone's death timer to six hours
				for(const p of players) {
					const defeated = p.status.find(s => s.type == enums.Statuses.Dead);
					if(defeated && defeated.endTime > now + 6 * hour) {
						await this.healPlayer(p, (defeated.endTime - now) - 6 * hour);
					}
				}

				output += `\nThe Nemesis has called for a tournament to determine the fate of the universe! Enter \`!tourney join\` to join - ` +
					`the more contestants there are, the more time you'll have to save the universe! **Let the ${player.name} Games begin!**`;
				await this.createTournament(channel, player, enums.TournamentTypes.DarkTournament);
				await sql.addStatus(channel, null, enums.Statuses.Cooldown, 8 * hour, enums.Cooldowns.Ruin);
				await sql.newArc(channel, enums.ArcTypes.DarkTournament);
				nemesis.lastRuinUpdate = now;
				await sql.setNemesis(channel, nemesis);
				break;
		}

		if(world.arc.type == enums.ArcTypes.OrbHunt ||
			world.arc.type == enums.ArcTypes.Tournament) {
			await sql.newArc(channel, enums.ArcTypes.Filler);
		}
		
		await sql.scatterOrbs(channel);
		output += `\nThe orbs scatter to the furthest reaches of the world!`;
		
		await sql.addStatus(channel, player.id, enums.Statuses.Cooldown, 7 * 24 * hour, enums.Cooldowns.WishUsed);
		world.lastWish = now;
		await sql.setWorld(world);
		
		let embed = new Discord.RichEmbed();
		embed.setTitle(`${player.name}'s Wish`)
			.setColor(0x00AE86)
			.setDescription(output);
		
		return [embed].concat(messages);
	},
	async train(player) {
		await this.deleteStatus(player, enums.Statuses.Ready);
		await sql.addStatus(player.channel, player.id, enums.Statuses.Training);

		return `**${player.name}** has begun training.`;
	},
	async startJourney(player, hoursString, username) {
		if(this.isFusion(player) && !this.confirmCommand(player, username, `!journey ${hoursString}`)) {
			const otherPlayer = player.fusedPlayers.find(p => p.username != username);
			embed.setTitle('CONFIRM JOURNEY')
				.setColor(0xff8040)
				.setDescription(`**${player.name}** must be united in purpose before setting out on a journey!` +
					`${otherPlayer.name}, enter \`!journey ${hoursString}\` to confirm and depart.`);
			return embed;
		}

		const now = new Date().getTime();
		const hours = parseInt(hoursString);
		if(hours != hours) return;

		const training = player.status.find(s => s.type == enums.Statuses.Training);
		const trainingTime = training ? now - training.startTime : 0;

		await sql.deleteGuardingForPlayer(player.id); // Can't guard or be guarded while on a journey
		await sql.addStatus(player.channel, player.id, enums.Statuses.Journey, hours * hour, trainingTime);
		await this.deleteStatus(player, enums.Statuses.Ready);
		await this.deleteStatus(player, enums.Statuses.Training);

		const pronoun = player.config.Pronoun.replace(/^\w/, c => c.toUpperCase());
		return `**${player.name}** sets off on a journey to become stronger! ${pronoun} won't return for another ${hours} hours.`;
	},
	async updateGarden(channel, lastUpdate) {
		let garden = await sql.getGarden(channel);
		const now = new Date().getTime();
		let messages = [];

		for(const i in garden.plants) {
			const p = garden.plants[i];
			if(p && p.endTime > lastUpdate && p.endTime <= now) {
				const player = await sql.getPlayerById(p.planterId);
				if(p.slot == -1 && player) {
					messages.push(`${player.name}'s ${p.name} has finished growing!`);
				} else {
					messages.push(`A ${p.name} has finished growing in the garden!`);
				}
			}
		}

		return messages;
	},
	async updatePlayerActivity(channel, lastUpdate, pings) {
		let world = await sql.getWorld(channel);
		let players = await sql.getPlayers(channel);
		const now = new Date().getTime();
		let messages = [];

		let activePlayers = 0;
		for(const i in players) {
			const p = players[i];
			if(this.isFusionPart(p)) continue;
			if(p.npc) continue;
			
			if(p.lastActive > now) {
				p.lastActive = now;
				await sql.setPlayer(p);
			}
			if(p.lastFought > now) {
				p.lastFought = now;
				await sql.setPlayer(p);
			}
			if(p.lastActive + 24 * hour > now) {
				// Player is active
				activePlayers++;
				if(p.lastFought + 24 * hour < now) {
					// Player has gone 24 hours without fighting
					let orbs = p.items.find(i => i.type == enums.Statuses.Dead);
					if(orbs) {
						await sql.addItems(channel, p.id, enums.Items.Orb, -1);
						messages.push(`${p.name} has gone for too long without fighting; one of their orbs vanishes.`);
					}
					p.lastFought += 24 * hour;
				} else if(p.lastFought + 23 * hour <= now &&
						  p.lastFought + 23 * hour > lastUpdate) {
					let orbs = p.items.find(i => i.type == enums.Items.Orb);
					if(orbs) {
						messages.push(`${p.name} must fight someone in the next hour or lose an orb.`);
						if(p.config.Ping) {
							pings.push(await this.getPings(p));
						}
					}
				}
				if(p.lastActive + 23 * hour < now &&
				   p.lastActive + 23 * hour > lastUpdate) {
					messages.push(`${p.name} will idle out in 1 hour.`);
				}
			} else if(p.lastActive + 24 * hour > lastUpdate) {
				// Player has become inactive
				const orbs = p.items.find(i => i.type == enums.Items.Orb);
				console.log(`${p.name} logged idle; last activity recorded at ${new Date(p.lastActive).toLocaleString('en-US')}`);
				if(orbs) {
					await sql.addItems(channel, p.id, enums.Items.Orb, -orbs.count);
					messages.push(`${p.name} has been idle for too long; ` + 
						`${this.their(p.config.Pronoun)} ${orbs.count} ${orbs.count > 1 ? 'orbs vanish' : 'orb vanishes'}.`);
				}
			}
		}

		if(activePlayers > world.population) {
			console.log(`Updating world max active population for ${activePlayers} active players`);
			world.population = activePlayers;
		}
		await sql.setWorld(world);

		return messages;
	},
	async ruinAlert(channel) {
		const world = await sql.getWorld(channel);
		const ruinTime = world.cooldowns.find(c => c.type == enums.Cooldowns.Ruin);
		let nemesis = await sql.getNemesis(channel);
		let output = { messages: [], abort: false };
		if(nemesis && ruinTime) {
			const now = new Date().getTime();
			const hoursLeft = Math.ceil((ruinTime.endTime - now) / hour);
			const lastHoursLeft = Math.ceil((ruinTime.endTime - nemesis.lastRuinUpdate) / hour);
			const tournament = await sql.getTournament(channel);
			if(hoursLeft != lastHoursLeft) {
				// Reminder the players about their impending doom
				if(hoursLeft > 0 && (!tournament || tournament.status == enums.TournamentStatuses.Active)) {
					output.messages.push(`${hoursLeft} hours until the universe is destroyed!`);
				}
			}
			if(hoursLeft <= 0) {
				let player = await sql.getPlayerById(nemesis.id);
				if(world.arc.type == enums.ArcTypes.DarkTournament && tournament && tournament.status == enums.TournamentStatuses.Recruiting) {
					if(tournament.players.length >= 4) {
						// Dark tournament begins
						await this.startTournament(tournament);
						const hours = tournament.players.length * 1.5;
						await sql.deleteStatusById(ruinTime.id);
						await sql.addStatus(channel, null, enums.Statuses.Cooldown, hours * hour, enums.Cooldowns.Ruin);
						output.messages.push(await this.displayTournament(await sql.getTournament(channel)));
						output.messages.push(`The ${player.name} Games have begun! You have ${this.getTimeString(hours * hour)} to finish the tournament and defeat the Nemesis!`);
						nemesis.lastRuinUpdate = now;

						// Power up the Nemesis for the finale
						const heatPerHour = Math.min(world.heat / ((now - world.startTime) / hour), 10);
						console.log(`Heat per hour: ${heatPerHour}`);
						const nemesisLevel = await this.newPowerLevel(world.heat + heatPerHour * hours) * 1.5;
						player.level = Math.max(player.level + nemesisLevel / 4, nemesisLevel);
						await sql.setPlayer(player);
					} else {
						await this.endWorld(channel);
						output.message = `You failed to gather enough warriors! **${player.name}** finishes charging, and destroys the universe. May you fare better in the next life...` +
							`\nTo see the final standing, enter \`!scores\`.`;
						output.abort = true;
					}
				} else {
					await this.endWorld(channel);
					output.message = `It's too late! **${player.name}** finishes charging, and destroys the universe. May you fare better in the next life...` +
						`\nTo see the final standing, enter \`!scores\`.`;
					output.abort = true;
				}
			}
			nemesis.lastRuinUpdate = now;
			await sql.setNemesis(channel, nemesis);
		}
		return output;
	},
	async endWorld(channel) {
		const players = await sql.getPlayers(channel, true);
		for(const p of players) {
			if(this.isFusion(p)) {
				this.breakFusion(channel, p.id, p.fusedPlayers[0].id, p.fusedPlayers[1].id);
			}
		}
		await sql.endWorld(channel);
	},
	async deleteExpired(channel, pings) {
		let expired = await sql.getExpired(channel);
		const world = await sql.getWorld(channel);
		const nemesis = await sql.getNemesis(channel);
		const nemesisPlayer = nemesis ? await sql.getPlayerById(nemesis.id) : null;
		const now = new Date().getTime();		
		let messages = [];

		// React to statuses ending
		for(const i in expired.statuses) {
			let status = expired.statuses[i];
			let player = await sql.getPlayerById(status.playerId);
			let decrease;
			switch(status.type) {
				case enums.Statuses.Dead:
				    // Death
					messages.push(`**${player.name}** is ready to fight.`);
					if(player.config.AutoTrain && !player.isUnderling) {
						messages.push(`**${player.name}** has begun training.`);
						await this.deleteStatus(player, enums.Statuses.Ready);
						await sql.addStatus(channel, player.id, enums.Statuses.Training);
					} else if(player.isUnderling) {
						const message = await this.underlingPowerup(player);
						if(message) messages.push(message);
					} else {
						await sql.addStatus(channel, player.id, enums.Statuses.Ready);
					}
					if(pings && player.config.Ping) pings.push(await this.getPings(player));
					break;
				case enums.Statuses.Journey:
					// Journey
					const storedTrainingTime = status.rating;
					const journeyTime = status.endTime - status.startTime;
					let journeyEffect = (Math.random() + 0.8);
					if(nemesis) {
						// Journeys that end during a Nemesis reign are amazing
						journeyEffect += 0.5;
					}
					const time = journeyTime * journeyEffect + storedTrainingTime;
					await this.completeTraining(player, time);
					if(journeyEffect < 1) {
						messages.push(`**${player.name}** returns from a rough training journey!`);
					} else if(journeyEffect < 1.5) {
						messages.push(`**${player.name}** returns from an ordinary training journey!`);
					} else {
						messages.push(`**${player.name}** returns from a **legendary** training journey!`);
					}
					await sql.addStatus(channel, player.id, enums.Statuses.Cooldown, 12 * hour, enums.Cooldowns.Journey);
					await sql.setPlayer(player);
					break;
				case enums.Statuses.Energized:
					// Energize
					decrease = this.getPowerLevel(player) - this.getPowerLevel(player) / 1.3;
					messages.push(`**${player.name}** is no longer energized; power level fell by ${numeral(decrease.toPrecision(2)).format('0,0')}.`);
					break;
				case enums.Statuses.Transform: 
					// Transform - 4 hour KO
					if(!player.isNemesis) {
						await this.killPlayer(player, hour * 4);
						messages.push(`**${player.name}** is no longer transformed; ${player.config.Pronoun} can't fight for another 4 hours.`);
					}
					break;
				case enums.Statuses.SuperTransform: 
					// Super Transform - 8 hour KO
					if(!player.isNemesis) {
						await this.killPlayer(player, hour * 8);
						messages.push(`**${player.name}** is no longer transformed; ${player.config.Pronoun} can't fight for another 8 hours.`);
					}
					break;
				case enums.Statuses.UltimateForm: 
					// Ultimate Transform - bye
					messages.push(`**${player.name}** is no longer transformed; ${player.config.Pronoun} won't be coming back any time soon...`);
					await sql.annihilatePlayer(player.id);
					await sql.addStatus(channel, player.id, enums.Statuses.Annihilation);
					break;
				case enums.Statuses.Bean: 
					// Bean
					decrease = this.getPowerLevel(player) - this.getPowerLevel(player) / 1.12;
					messages.push(`**${player.name}** is no longer bean-boosted; power level fell by ${numeral(decrease.toPrecision(2)).format('0,0')}.`);
					break;
				case enums.Statuses.Fused:
					// Fusion
					await this.breakFusion(channel, player.id, player.fusedPlayers[0].id, player.fusedPlayers[1].id, pings, messages);
					break;
				case enums.Statuses.Berserk:
				    // Berserk
					messages.push(`**${player.name}** calms down from ${this.their(player.config.Pronoun)} battle frenzy.`);
					break;
				case enums.Statuses.Cooldown:
					// Cooldowns
					if(player && player.npc && !player.status.find(s => s.type == enums.Statuses.Dead) && !player.status.find(s => s.type == enums.Statuses.Annihilation)) {
						switch(status.rating) {
							case enums.Cooldowns.Attack:
								// Attack a random non-NPC
								const players = (await sql.getPlayers(channel)).filter(p => 
									!p.status.find(s => s.type == enums.Statuses.Dead) && 
									!p.status.find(s => s.type == enums.Statuses.Journey) && 
									!this.isFusionPart(p) &&
									!p.npc);
								if(players.length > 0) {
									let target = players[Math.floor(Math.random() * players.length)];
									messages = messages.concat(await this.attack(player, target));
								}
								break;
							case enums.Cooldowns.Destroy:
								// Cast destroy
								messages.push(await this.destroy(player));
								break;
							case enums.Cooldowns.Search:
								// Search for orbs
								if(nemesisPlayer && world.arc.type == enums.ArcTypes.Nemesis) {
									messages = messages.concat(await this.search(player));
									await sql.addStatus(channel, player.id, enums.Statuses.Cooldown, hour / 3, enums.Cooldowns.Search);
								} else if(!nemesisPlayer) {
									messages.push(`**${player.name}** searches for the Nemesis, to no avail.`);
								}
								break;
							case enums.Cooldowns.Empower:
								// Empower the Nemesis
								if(nemesisPlayer && world.arc.type == enums.ArcTypes.Nemesis) {
									messages.push(await this.empower(player, nemesisPlayer));
									await sql.addStatus(channel, player.id, enums.Statuses.Cooldown, hour / 2, enums.Cooldowns.Empower);
								} else if(!nemesisPlayer) {
									messages.push(`**${player.name}** searches for the Nemesis, to no avail.`);
								}
								break;
							case enums.Cooldowns.Unwater:
								// Drain life from the garden
								messages.push(await this.unwater(channel, player.username));
								await sql.addStatus(channel, player.id, enums.Statuses.Cooldown, 1 * hour, enums.Cooldowns.Unwater);
								break;
						}
					} else if(status.rating == enums.Cooldowns.Portal) {
						// Send phantom warriors!
						const portal = await sql.getPortal(channel);
						if(portal) {
							messages = messages.concat(await this.sendPhantom(channel, portal.targetChannel));
							await sql.deletePortal(channel, portal.targetChannel);
						}
					}
			}
		}

		let offerIds = []
		for(const i in expired.offers) {
			const offer = expired.offers[i];
			let player = await sql.getPlayerById(offer.playerId); 	
			if(player.lastActive + hour < now && player.lastActive + 24 * hour > now) {
				// The player is idle, but not SUPER idle - stall the offer timer
				await sql.delayOffer(channel, player.id, offer.targetId, offer.type);
			} else if(offer.expires < now) {
				// The offer has expired!
				switch(offer.type) {
					case enums.OfferTypes.Taunt:
						// Failed taunt - reduce their Glory
						let target = await sql.getPlayerById(offer.targetId);
						const glory = Math.ceil(Math.min(Math.min(target.level / player.level * 5, 50)), target.glory);
						target.glory -= glory;
						await sql.setPlayer(target);
						messages.push(`**${target.name}** failed to respond to **${player.name}**; Glory -${glory}.`);
						break;
				}
				offerIds.push(offer.ID);
			}
		}

		// Delete 'em
		for(const status of expired.statuses) {
			if(status.type != enums.Statuses.Cooldown || status.rating != enums.Cooldowns.Ruin) {
				await this.deleteStatusById(null, status.id);
			}
		}
		for(const i in offerIds) {
			const offer = expired.offers[i];
			await sql.deleteOffer(offer.playerId, offer.targetId, offer.type);
		}

		return messages;
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
			messages = messages.concat(await this.deleteExpired(channel, pings));
			messages = messages.concat(await this.updatePlayerActivity(channel, world.lastUpdate, pings));
			messages = messages.concat(await this.updateGarden(channel, world.lastUpdate));
			const ruinStatus = await this.ruinAlert(channel);
			if(ruinStatus && ruinStatus.messages && ruinStatus.messages.length > 0) {
				messages = messages.concat(ruinStatus.messages);
				abort = ruinStatus.abort;
			}
		}

		await sql.setUpdateTime(channel);
		
		// Combine single-line messages
		const lineUpdates = messages.filter(m => m && (typeof m == 'string' || m instanceof String));
		const embedUpdates = messages.filter(m => m && (typeof m == 'object' || m instanceof Discord.RichEmbed) && !m.target);
		const remoteUpdates = messages.filter(m => m && m.target);

		if(lineUpdates.length > 0) {
			let embed = new Discord.RichEmbed();
			embed.setTitle('Status Update')
				.setColor(0x00AE86)
				.setDescription(lineUpdates.join('\n'));
			embedUpdates.push(embed);
		}
		for(const remoteUpdate of remoteUpdates) {
			embedUpdates.push(remoteUpdate);
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
				case 'autotrain':
					player.config.AutoTrain = this.readConfigBoolean(value, player.config.autoTrain);
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
		output += `AutoTrain: ${config.AutoTrain ? 'On' : 'Off'}\n`;
		output += `Pronoun: ${config.Pronoun}`;
		embed.setDescription(output);

		return embed;
	},
	getPowerLevel(player) {
		let level = player.level;
		// Transformation
		const transform = player.status.find(s => s.type == enums.Statuses.Transform || s.type == enums.Statuses.SuperTransform || s.type == enums.Statuses.UltimateForm);
		if(transform) {
			level *= transform.rating;
		}
		// Power Wish
		if(player.status.find(s => s.type == enums.Statuses.PowerWish)) {
			level *= 1.5;
		}
		// Fusion
		if(player.status.find(s => s.type == enums.Statuses.Fused)) {
			level *= 1.3;
		}
		// Bean
		if(player.status.find(s => s.type == enums.Statuses.Bean)) {
			level *= 1.12;
		}
		// Energized
		if(player.status.find(s => s.type == enums.Statuses.Energized)) {
			level *= 1.3;
		}
		// Underlings
		if(player.isUnderling) {
			level *= 1.2;
		}
		// Self Destruct
		if(player.status.find(s => s.type == enums.Statuses.SelfDestruct)) {
			level *= 4;
		}
		// Self Destruct
		if(player.status.find(s => s.type == enums.Statuses.Caught)) {
			level *= 0.5;
		}

		return level;
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
	async give(player, target, itemType) {
		let playerItem = player.items.find(i => enums.Items.Name[i.type] == itemType.toLowerCase());
		let targetItem = target.items.find(i => enums.Items.Name[i.type] == itemType.toLowerCase());
		if(!playerItem) return;

		await sql.addItems(player.channel, player.id, playerItem.type, -1);
		await sql.addItems(target.channel, target.id, playerItem.type, 1);

		let output = `${player.name} gives ${enums.Items.An[playerItem.type] ? 'an' : 'a'} ${enums.Items.Name[playerItem.type]} to ${target.name}.`;
		if(playerItem.type == enums.Items.Orb) {
			if(targetItem && targetItem.count == 6) {
				output += `\n${target.name} has gathered all seven magic orbs! Enter \`!help wish\` to learn about your new options.`;
			} else if(!targetItem || targetItem.count == 0) {
				target.lastFought = new Date().getTime();
				await sql.setPlayer(player);
			}
		}

		return output;
	},
	async steal(player, target, itemType) {
		let playerItem = player.items.find(i => enums.Items.Name[i.type] == itemType.toLowerCase());
		let targetItem = target.items.find(i => enums.Items.Name[i.type] == itemType.toLowerCase());
		if(!targetItem) return;

		let stealChance = target.level / player.level * 0.0125;
		if(target.isUnderling) stealChance *= 5;
		if(stealChance > settings.MaxStealChance) stealChance = settings.MaxStealChance;

		let output = [];
		const roll = Math.random();
		if(roll < stealChance) {
			console.log(`${player.name} stole ${itemType} from ${target.name} on roll ${roll} out of chance ${stealChance}`);

			await sql.addItems(target.channel, target.id, targetItem.type, -1);
			await sql.addItems(player.channel, player.id, targetItem.type, 1);
			
			let message = `${player.name} snuck past the security and stole ${enums.Items.An[targetItem.type] ? 'an' : 'a'} ${enums.Items.Name[targetItem.type]} from ${target.name}!`;
			if(targetItem.type == enums.Items.Orb) {
				if(playerItem && playerItem.count == 6) {
					message += `\n${player.name} has gathered all seven magic orbs! Enter \`!help wish\` to learn about your new options.`;
				} else if(!playerItem || playerItem.count == 0) {
					player.lastFought = new Date().getTime();
					await sql.setPlayer(player);
				}
			}
			output.push(message);
		} else if(target.status.find(s => s.type == enums.Statuses.Dead)) {
			console.log(`${player.name} failed to steal ${itemType} from ${target.name} on roll ${roll} out of chance ${stealChance}`);
			output.push(`${player.name} couldn't make it past security, and escaped empty-handed.`);
		} else {
			console.log(`${player.name} failed to steal ${itemType} from ${target.name} on roll ${roll} out of chance ${stealChance}`);
			
			output.push(`${player.name} was caught in the act!`);
			let embed = new Discord.RichEmbed();
			embed.setTitle(`${player.name.toUpperCase()} WAS CAUGHT`)
				.setColor(0xff8040);
			
			player.status.push({
				type: enums.Statuses.Caught
			});
			await this.fight(player, target, false, embed);
			output.push(embed);
		}

		if(target.config.Ping) {
			output.push(await this.getPings(target));
		}
		return output;
	},
	async history(player1, player2) {
		let history = await sql.getHistory(player1.id, player2 ? player2.id : null);
		let embed = new Discord.RichEmbed();
		const twoPlayers = player2 && player2.id != player1.id;

		if(twoPlayers) {
			embed.setTitle(`${player1.name} VS ${player2.name} Battle History`);
		} else {
			embed.setTitle(`${player1.name} Battle History`);
		}
		embed.setColor(0x00AE86);
		
		let description = '';
		if(twoPlayers) {
			if(history.length == 0) {
				description += `${player1.name} and ${player2.name} have never fought.`;
			} else {
				const player1wins = history.filter(h => h.winnerId == player1.id).length;
				const player2wins = history.filter(h => h.winnerId == player2.id).length;
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
				description = `${player1.name} has never fought.`;
			} else {
				const player1wins = history.filter(h => h.winnerId == player1.id).length;
				const player1losses = history.length - player1wins;
				description += `${player1.name} has won ${player1wins} ${player1wins == 1 ? 'time' : 'times'} and lost ${player1losses} ${player1losses == 1 ? 'time' : 'times'}.\n`;
			}
		}
		embed.setDescription(description);

		let output = '';
		if(history.length > 10) history = history.slice(0, 10);
		for(const i in history) {
			const h = history[i];

			if(output.length > 0) output += '\n';

			const loserRating = Math.sqrt(h.loserLevel * h.loserSkill);
			const winnerRating = Math.sqrt(h.winnerLevel * h.winnerSkill);
			const winnerName = h.winnerName ? h.winnerName : 'Someone';
			const loserName = h.loserName ? h.loserName : 'Someone';
			output += `Episode ${h.episode}: ${winnerName} defeated ${loserName}, ${numeral(winnerRating.toPrecision(2)).format('0,0')} to ${numeral(loserRating.toPrecision(2)).format('0,0')}.`;
		}
		if(output) {
			embed.addField(`Last ${history.length} ${history.length == 1 ? 'fight' : 'fights'}`, output);
		}

		return embed;
	},
	async empower(player, target) {
		const transfer = Math.min(player.level * 0.1, target.level * 0.25);

		player.level -= transfer;
		target.level += transfer;

		let output = `${player.name} sends ${this.their(player.config.Pronoun)} energy to ${target.name}, ` +
			`increasing ${this.their(target.config.Pronoun)} power level by ${numeral(transfer.toPrecision(2)).format('0,0')}!`;
		
		if(await this.actionLevelUp(player)) {
			output += '\nAction level increased!';
		}

		await sql.setPlayer(player);
		await sql.setPlayer(target);

		return output;
	},
	async graveyard(channel) {
		let players = await sql.getPlayers(channel);
		const deadPlayers = players.filter(p => p.status.find(s => s.type == enums.Statuses.Dead));
		deadPlayers.sort((a, b) => {
			const aDeath = a.status.find(s => s.type == enums.Statuses.Dead);
			const bDeath = b.status.find(s => s.type == enums.Statuses.Dead);
			return aDeath.endTime - bDeath.endTime;
		});
		const now = new Date().getTime();
		let output = '';

		let embed = new Discord.RichEmbed();
		embed.setTitle(`Defeated Players`)
			.setColor(0x00AE86);
		
		for(const i in deadPlayers) {
			const p = deadPlayers[i];
			const s = p.status.find(s => s.type == enums.Statuses.Dead);
			
			if(output.length > 0) output += '\n';
			output += `${p.name} (Recovers in ${this.getTimeString(s.endTime - now)})`;
		}

		if(output.length == 0) {
			output = `No players are in need of healing right now.`;
		}

		embed.setDescription(output);

		return embed;
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
	async transform(player) {
		let output = '';
		const transform = player.status.find(s => s.type == enums.Statuses.Transform);
		const superForm = player.status.find(s => s.type == enums.Statuses.SuperTransform);

		if(superForm) {
			// Ultimate Form
			const roll = Math.random();
			if(roll < 0.5) {
				const rating = (2.5 + Math.random()) * superForm.rating;
				const duration = (60 + player.actionLevel) * 60 * 1000;
				const increase = this.getPowerLevel(player) * (rating - 1);
				await this.deleteStatus(player, enums.Statuses.SuperTransform);
				await sql.addStatus(player.channel, player.id, enums.Statuses.UltimateForm, duration, rating);
				output += `With a cry heard across the universe, ${player.name} ascends to the true pinnacle of transformation, increasing ${this.their(player.config.Pronoun)} power level by ${numeral(increase.toPrecision(2)).format('0,0')}!`;
			} else {
				await this.deleteStatus(player, enums.Statuses.Transform);
				await this.killPlayer(player, hour * 24);
				output += `${player.name} tries to push past ${this.their(player.config.Pronoun)} limitations, but it's too much! The power devastates ${this.their(player.config.Pronoun)} body.`;
			}
		} else if(transform) {
			// Super Form
			const roll = Math.random();
			if(roll < 0.5) {
				const rating = (1.5 + Math.random() * 0.5) * transform.rating;
				const duration = (60 + player.actionLevel) * 60 * 1000;
				const increase = this.getPowerLevel(player) * (rating - 1);
				await this.deleteStatus(player, enums.Statuses.Transform);
				await sql.addStatus(player.channel, player.id, enums.Statuses.SuperTransform, duration, rating);
				output += `With a blazing explosion, ${player.name} surpasses ${this.their(player.config.Pronoun)} old transformation with another, even stronger one, increasing ${this.their(player.config.Pronoun)} power level by ${numeral(increase.toPrecision(2)).format('0,0')}!`;
			} else {
				await this.deleteStatus(player, enums.Statuses.Transform);
				await this.killPlayer(player, hour * 24);
				output += `${player.name} tries to push past ${this.their(player.config.Pronoun)} limitations, but it's too much! The power devastates ${this.their(player.config.Pronoun)} body.`;
			}
		} else {
			const rating = 1.4 + Math.random() * 0.4;
			const duration = (60 + player.actionLevel) * 60 * 1000;
			const increase = this.getPowerLevel(player) * (rating - 1);
			await sql.addStatus(player.channel, player.id, enums.Statuses.Transform, duration, rating);
			output += `With a mighty roar, ${player.name} unleashes ${this.their(player.config.Pronoun)} transformed power, increasing ${this.their(player.config.Pronoun)} power level by ${numeral(increase.toPrecision(2)).format('0,0')}!`;
		}

		if(await this.actionLevelUp(player)) {
			output += '\nAction level increased!';
		}

		return output;
	},
	async ending(channel) {
		await this.endWorld(channel);
		return 'This story has reached an ending, but there are more adventures on the horizon. Onwards, to a new universe...!\n' +
			'To see the final standing, enter \`!scores\`.';
	},
	// Creates a new NPC character.
	async addNpc(channel, type, baseName) {
		const world = await sql.getWorld(channel);
		const players = await sql.getPlayers(channel, true);
		const now = new Date().getTime();
		const fiveMin = 60 * 1000 * 5;
		let npc = {
			channel: channel,
			glory: 0,
			lastActive: now,
			lastFought: now,
			npc: type,
			config: {}
		};

		// Base stats
		switch(type) {
			case enums.NpcTypes.Zorb:
				baseName = 'Zorb';
				await this.addHeat(world, 25);
				npc.level = this.newPowerLevel(world.heat) * 2;
				break;
			case enums.NpcTypes.Zorbmaster:
				baseName = 'Zorbmaster';
				await this.addHeat(world, 100);
				npc.level = this.newPowerLevel(world.heat) * 7;
				break;
			case enums.NpcTypes.Zlower:
				baseName = 'Zlower';
				await this.addHeat(world, 10);
				npc.level = this.newPowerLevel(world.heat) * 1.5;
				break;
			case enums.NpcTypes.Zarrot:
				baseName = 'Zarrot';
				await this.addHeat(world, 10);
				npc.level = this.newPowerLevel(world.heat) * 1.5;
				break;
			case enums.NpcTypes.Zedge:
				baseName = 'Zedge';
				await this.addHeat(world, 10);
				npc.level = this.newPowerLevel(world.heat) * 1.5;
				break;
			case enums.NpcTypes.Zeach:
				baseName = 'Zeach';
				await this.addHeat(world, 20);
				npc.level = this.newPowerLevel(world.heat) * 2;
				break;
		}

		name = baseName;
		let next = 1;
		while(players.find(p => p.name == name)) {
			next++;
			name = baseName + next;
		}
		npc.name = name;
		npc.username = `NPC#${name}`;
		npc.npc = type;

		const id = await sql.addPlayer(npc);
		npc.id = id;

		// Initial status
		switch(type) {
			case enums.NpcTypes.Zorbmaster:
				await sql.addStatus(channel, id, enums.Statuses.Cooldown, 24 * hour, enums.Cooldowns.Destroy);
				if(world.lostOrbs) {
					await sql.addItems(channel, id, enums.Items.Orb, 1);
					await sql.setWorld(world);
				}
				break;
			case enums.NpcTypes.Zlower:
				await sql.addStatus(channel, id, enums.Statuses.Cooldown, fiveMin, enums.Cooldowns.Empower);
				await sql.setUnderling(channel, id, true);
				break;
			case enums.NpcTypes.Zarrot:
				await sql.addStatus(channel, id, enums.Statuses.Cooldown, fiveMin, enums.Cooldowns.Search);
				await sql.setUnderling(channel, id, true);
				break;
			case enums.NpcTypes.Zedge:
				await sql.addStatus(channel, id, enums.Statuses.Cooldown, fiveMin, enums.Cooldowns.Unwater);
				await sql.setUnderling(channel, id, true);
				break;
			case enums.NpcTypes.Zeach:
				await sql.setUnderling(channel, id, true);
				break;
		}

		// Item drops
		const roll = Math.random();
		let plants = 0;
		let orbs = 0;
		switch(type) {
			case enums.NpcTypes.Zorb:
				if(roll < 0.1 && world.lostOrbs > 0) {
					orbs++;
				}
				if(roll < 0.3) {
					plants++;
				}
				if(roll < 0.6) {
					plants++;
				}
				break;
			case enums.NpcTypes.Zorbmaster:
				orbs++;
				plants++;
				if(roll < 0.1 && world.lostOrbs > 0) {
					orbs++;
				}
				if(roll < 0.3) {
					plants++;
				}
				if(roll < 0.5) {
					plants++;
				}
				if(roll < 0.7) {
					plants++;
				}
				break;
		}
		for(let i = 0; i < plants; i++) {
			const plantType = Math.floor(Math.random() % 6) + 1;
			await sql.addItems(channel, id, plantType, 1);
		}
		if(orbs > world.lostOrbs) {
			orbs = world.lostOrbs;
		}
		await sql.addItems(channel, id, enums.Items.Orb, orbs);

		await sql.setWorld(world);

		return npc;
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
	async filler(player, target) {
		const channel = player.channel;
		const players = await sql.getPlayers(channel);
		const world = await sql.getWorld(channel);
		const now = new Date().getTime();

		const fillerTemplates = templates.FillerTemplates;
		let summary = fillerTemplates[Math.floor(Math.random() * fillerTemplates.length)];

		let playerCount = 2;
		if(summary.indexOf('$3')) playerCount = 4;
		else if(summary.indexOf('$2')) playerCount = 3;

		// Gather our cast
		let cast = [player];
		if(target) cast.push(target);

		let remainingPlayers = players.filter(p => p.id != player.id && (!target || p.id != target.id) && !this.isFusionPart(p));
		this.shuffle(remainingPlayers);
		while(cast.length < playerCount) {
			cast.push(remainingPlayers[0]);
			remainingPlayers = remainingPlayers.slice(1);
		}

		// Fill in the template
		for(const i in cast) {
			const p = cast[i];
			summary = summary.replace(new RegExp(`\\$${i}their`, 'g'), this.their(p.config.pronoun));
			summary = summary.replace(new RegExp(`\\$${i}them`, 'g'), this.them(p.config.pronoun));
			summary = summary.replace(new RegExp(`\\$${i}`, 'g'), p.name);
		}

		let embed = new Discord.RichEmbed();
		embed.setTitle(`EPISODE ${world.episode}`)
			.setColor(0x00AE86)
			.setDescription(summary);
		
		await sql.addEpisode(channel, summary);

		let defeatedPlayers = cast.filter(p => p.status.find(s => s.type == enums.Statuses.Dead));
		if(defeatedPlayers) {
			const healing = 12 * 60 * 1000 / (defeatedPlayers.length + 1) * (1 + player.actionLevel * 0.025);
			for(const p of defeatedPlayers) {
				if(p.id == player.id) {
					await this.healPlayer(p, 2 * healing);
				} else {
					await this.healPlayer(p, healing);
				}
			}
		}
		await this.actionLevelUp(player);

		
		return embed;
	},
	async getEpisode(channel, number) {
		const episodeNumber = parseInt(number);

		const episode = await sql.getEpisode(channel, episodeNumber);
		if(!episode) return;

		const airDate = moment(episode.airDate).format('MMM Do');
		let embed = new Discord.RichEmbed();
		embed.setTitle(`EPISODE ${episodeNumber}`)
			.setColor(0x00AE86)
			.setDescription(`Original Air Date: ${airDate}`)
			.addField('Episode Summary', episode.summary);

		return embed;
	},
	async tournament(player, command) {
		let tournament = await sql.getTournament(player.channel);
		if(!command) {
			return this.displayTournament(tournament);
		}
		switch(command) {
			case 'single':
				return this.createTournament(player.channel, player, enums.TournamentTypes.SingleElimination);
			//case 'royale':
			//	return this.createTournament(player.channel, player, enums.TournamentTypes.BattleRoyale);
			case 'join':
				return this.joinTournament(player, tournament);
			case 'start':
				return this.startTournament(tournament);
		}
	},
	async displayTournament(tournament) {
		let embed = new Discord.RichEmbed();
		embed.setTitle(`Tournament Status`)
			.setColor(0x4f0a93)
		const now = new Date().getTime();
		let output = '';

		if(!tournament || tournament.status == enums.TournamentStatuses.Off) {
			output = "There isn't a tournament going on! Enter `!tourney single` to recruit for one.";
		} else {
			let names = tournament.players.filter(p => p).map(p => p.name);
			const world = await sql.getWorld(tournament.channel);
			let ruinTimer = world.cooldowns.find(c => c.type == enums.Cooldowns.Ruin);
			switch(tournament.status) {
				case enums.TournamentStatuses.Recruiting:
					if(tournament.type == enums.TournamentTypes.DarkTournament) {
						const nemesis = await sql.getNemesis(tournament.channel);
						const nemesisPlayer = await sql.getPlayerById(nemesis.id);
						embed.setTitle(`The ${nemesisPlayer.name} Games`);
					}
					const organizer = await sql.getPlayerById(tournament.organizerId);
					switch(tournament.type) {
						case enums.TournamentTypes.SingleElimination:
							output += 'Format: Single Elimination\n';
							output = `Sign-ups are open for ${organizer.name}'s tournament! To join, enter \`!tourney join\`. ${organizer.name}, enter \`!tourney start\` to begin.\n\n`;
							break;
						case enums.TournamentTypes.BattleRoyale:
							output += 'Format: Battle Royale\n';
							output = `Sign-ups are open for ${organizer.name}'s tournament! To join, enter \`!tourney join\`. ${organizer.name}, enter \`!tourney start\` to begin.\n\n`;
							break;
						case enums.TournamentTypes.DarkTournament:
							output += 'Format: Single Elminiation\n';
							if(ruinTimer) {
								output = `Sign-ups are open for ${organizer.name}'s tournament! To join, enter \`!tourney join\`.\n` +
									`In ${this.getTimeString(ruinTimer.endTime - now)}, if there are at least four players, the tournament will begin. ` +
									`If there are not, the universe will be destroyed.\n` +
									`The more people join the tournament, the longer you'll have to defeat the Nemesis...\n\n`;
							} else {
								output = `Sign-ups are open for ${organizer.name}'s tournament! To join, enter \`!tourney join\`. ${organizer.name}, enter \`!tourney start\` to begin.\n\n`;
							}
							break;
					}
					output += `Players: ${names.join(', ')} (${names.length}/16)`
					break;
				case enums.TournamentStatuses.Active:
					if(tournament.type == enums.TournamentTypes.DarkTournament) {
						const nemesis = await sql.getNemesis(tournament.channel);
						const nemesisPlayer = await sql.getPlayerById(nemesis.id);
						embed.setTitle(`The ${nemesisPlayer.name} Games`);
					}
					if(tournament.players.length == 2) {
						output += `FINAL ROUND\n`;
					} else if(tournament.players.length == 4) {
						output += `SEMIFINAL ROUND\n`;
					} else {
						output += `ROUND ${tournament.round}\n`;
					}
					output += `Remaining Players: ${names.join(', ')}\n`;
					let nextRound = world.cooldowns.find(c => c.type == enums.Cooldowns.NextRound);
					if(ruinTimer) {
						output += `Universe ends in ${this.getTimeString(ruinTimer.endTime - now)}.\n\n`;
					} else if(nextRound) {
						output += `Round ends in ${this.getTimeString(nextRound.endTime - now)}.\n\n`;
					}

					let matches = [];
					for(let i = 0; i < tournament.players.length; i += 2) {
						const leftPlayer = tournament.players[i];
						const rightPlayer = tournament.players[i+1];

						if(leftPlayer && rightPlayer) {
							let match = `${leftPlayer.name} VS ${rightPlayer.name} `;
							switch(leftPlayer.status) {
								case enums.TournamentPlayerStatuses.Pending:
									match += ` (Pending)`;
									break;
								case enums.TournamentPlayerStatuses.Won:
									match += ` (${leftPlayer.name} won)`;
									break;
								case enums.TournamentPlayerStatuses.Lost:
									match += ` (${rightPlayer.name} won)`;
							}
							matches.push(match);
						}
					}
					output += `This round's matches:\n` + ( matches.join(`\n`));
					break;
				case enums.TournamentStatuses.Complete:
					output += `TOURNAMENT COMPLETE\n`;
					output += `The grand champion was **${tournament.players[0].name}!**\n`;
					output += `Enter \`!tourney single\` to begin a new tournament.`;
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
	async createTournament(channel, player, type) {
		let tournament = await sql.getTournament(channel);

		if(!tournament) {
			tournament = {
				channel: channel
			};
		}

		tournament.organizerId = player.id;
		tournament.type = type;
		tournament.status = enums.TournamentStatuses.Recruiting;
		tournament.players = null;

		await sql.setTournament(tournament);

		if(type != enums.TournamentTypes.DarkTournament) {
			await sql.joinTournament(channel, player.id);
		}
		
		let embed = new Discord.RichEmbed();
		embed.setTitle(`Tournament Time!`)
			.setColor(0x4f0a93)
			.setDescription(`**${player.name}** is starting a ${enums.TournamentTypes.Name[type]} tournament! Enter \`!tourney join\`.\n` +
				`The tournament will begin when the organizer starts it with \`!tourney start\`. Up to 16 players can join.`);
		
		await sql.newArc(channel, enums.ArcTypes.Tournament);
		return embed;
	},
	async joinTournament(player, tournament) {
		await sql.joinTournament(tournament.channel, player.id);
		return `${player.name} has joined the tournament! There's room for ${15 - tournament.players.length} more players.`;
	},
	async startTournament(tournament) {
		// Generate seed list
		let seeds = this.getTournamentSeeds(tournament.players.length);
		let players = tournament.players;

		players = this.shuffle(players);

		for(const i in seeds) {
			if(seeds[i] <= players.length) {
				players[seeds[i] - 1].position = i;
				players[seeds[i] - 1].status = enums.TournamentPlayerStatuses.Pending;
			}
		}

		tournament.status = enums.TournamentStatuses.Active;
		tournament.reward = tournament.players.length * 10;
		tournament.round = 1;
		await sql.setTournament(tournament);
		await sql.addStatus(tournament.channel, null, enums.Statuses.Cooldown, 24 * hour, enums.Cooldowns.NextRound);

		return this.displayTournament(await sql.getTournament(tournament.channel));
	},
	async tournamentMatch(tournament, winnerPlayer) {
		let winner = tournament.players.find(p => p && p.id == winnerPlayer.id);
		const winnerPosition = winner.position;
		const loserPosition = winnerPosition % 2 == 0 ? winnerPosition + 1 : winnerPosition - 1;
		let loser = tournament.players[loserPosition];
		const loserPlayer = await sql.getPlayerById(loser.id);

		winner.status = enums.TournamentPlayerStatuses.Won;
		loser.status = enums.TournamentPlayerStatuses.Lost;

		if(tournament.players.length == 2) {
			await sql.eliminatePlayer(loser.id);
			tournament.players.splice(loserPosition, 1);
			winner.position = 0;
			if(tournament.type == enums.TournamentTypes.DarkTournament && !loserPlayer.isNemesis && !winnerPlayer.isNemesis) {
				// It's the finals, add the nemesis to the bracket
				const nemesis = await sql.getNemesis(tournament.channel);
				const nemesisPlayer = await sql.getPlayerById(nemesis.id);
				tournament.players.push({
					id: nemesisPlayer.id,
					name: nemesisPlayer.name,
					position: 1,
					status: enums.TournamentPlayerStatuses.Pending
				});
				winner.status = enums.TournamentPlayerStatuses.Pending;
				tournament.round++;
				output = `The tournament is over... but the true finale is yet to come! ${winner.name} must now face the Nemesis for the fate of the universe!`;
			} else {
				output = `The tournament is over! ${winner.name} is the world's strongest warrior!`;
				const world = await sql.getWorld(tournament.channel);
				if(world.lostOrbs) {
					const glory = this.getGlory(tournament.reward);
					output += ` The new champion is awarded ${glory} Glory and a magic orb!`;
					winnerPlayer.glory += glory;
					await sql.addItems(tournament.channel, winner.id, enums.Items.Orb, 1);
				} else {
					const glory = this.getGlory(tournament.reward * 2);
					output += ` The new champion is awarded ${glory} Glory!`;
					winnerPlayer.glory += glory;
				}
				if(tournament.type == enums.TournamentTypes.DarkTournament) {
					if(winnerPlayer.isNemesis) {
						output += `\n**The Nemesis stands victorious! Farewell, cruel universe...**`;
						this.endWorld(tournament.channel);
					} else if(loserPlayer.isNemesis) {
						const now = new Date().getTime();
						const ruin = await world.cooldowns.find(c => c.type == enums.Cooldowns.Ruin);
						if(ruin) {
							output += `\n**Congratulations! You saved the universe with ${this.getTimeString(ruin.endTime - now)} to spare!**`;
							await sql.deleteStatusById(ruin.id);
						}
					}
				}
				await sql.addItems(tournament.channel, winner.id, enums.Items.Trophy, 1);
				tournament.status = enums.TournamentStatuses.Complete;
				let roundTimer = world.cooldowns.find(c => c.type == enums.Cooldowns.NextRound);
				if(roundTimer) {
					await this.deleteStatusById(null, roundTimer.id);
				}
				if(world.lostOrbs > 0) {
					await sql.newArc(tournament.channel, enums.ArcTypes.Filler);
				}
			}
		} else {
			output = `${winner.name} advances to the next round of the tournament!`;
		}

		let remainingMatches = false;
		for(let i = 0; i < tournament.players.length; i += 2) {
			const leftPlayer = tournament.players[i];
			const rightPlayer = tournament.players[i+1];
			if(leftPlayer && rightPlayer && 
				(leftPlayer.status == enums.TournamentPlayerStatuses.Pending || rightPlayer.status == enums.TournamentPlayerStatuses.Pending)) {
				remainingMatches = true;
			}
		}
		if(!remainingMatches && tournament.players.length > 2) {
			output += await this.advanceTournament(tournament);
		}

		await sql.setTournament(tournament);
		if(output) {
			return '\n' + output;
		} else {
			return '';
		}
	},
	async advanceTournament(tournament) {
		let world = await sql.getWorld(tournament.channel);

		let newPlayers = [];
		let oldPlayers = [];
		for(let i = 0; i < tournament.players.length; i += 2) {
			const leftPlayer = tournament.players[i];
			const rightPlayer = tournament.players[i+1];
			if((leftPlayer && leftPlayer.status == enums.TournamentPlayerStatuses.Won) ||
				(!rightPlayer)) {
				newPlayers.push(leftPlayer);
				oldPlayers.push(rightPlayer);
			} else {
				newPlayers.push(rightPlayer);
				oldPlayers.push(leftPlayer);
			}
		}

		if(newPlayers.length == 0) {
			// We can't just let every player idle out
			return;
		}

		for(const p of oldPlayers) {
			if(p) {
				await sql.eliminatePlayer(p.id);
			}
		}
		for(const p of newPlayers) {
			if(p) {
				p.position = Math.floor(p.position / 2);
				p.status = enums.TournamentPlayerStatuses.Pending;
			}
		}
		tournament.players = newPlayers;
		tournament.round++;

		let roundTimer = world.cooldowns.find(c => c.type == enums.Cooldowns.NextRound);
		if(roundTimer) {
			await this.deleteStatusById(null, roundTimer.id);
		}
		await sql.addStatus(tournament.channel, null, enums.Statuses.Cooldown, 24 * hour, enums.Cooldowns.NextRound);

		if(tournament.players.length == 2) {
			return ` It's time for the tournament finals!`;
		} else {
			return ` It's time for the next round of the tournament!`;
		}
	},
	async healPlayer(player, amount) {
		const now = new Date().getTime();
		const channel = player.channel;
		let defeatedState = player.status.find(s => s.type == enums.Statuses.Dead);
		if(defeatedState) {
			const duration = defeatedState.endTime - now;
			if(amount && duration > amount) {
				// Reduce timer
				defeatedState.endTime -= amount;
				await sql.setStatus(defeatedState);
				return defeatedState;
			} else {
				// Revive
				await this.deleteStatusById(player, defeatedState.id);

				if(player.config.AutoTrain && !player.isUnderling) {
					await this.deleteStatus(player, enums.Statuses.Ready);
					await sql.addStatus(channel, player.id, enums.Statuses.Training);
				} else if(player.isUnderling) {
					await this.underlingPowerup(player);
				} else {
					await sql.addStatus(channel, player.id, enums.Statuses.Ready);
				}
				return null;
			}
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
	async actionLevelUp(player) {
		if(!player.npc) {
			if(!player.actionLevel) player.actionLevel = 0;
			const oldActionLevel = Math.floor(player.actionLevel);
			player.actionLevel += (settings.ActionLevelSpeed / (1 + player.actionLevel)) * (Math.random() * 0.4 + 0.8);
			const newActionLevel = Math.floor(player.actionLevel);
			if(player.status.find(s => s.type == enums.Statuses.UltimateForm)) {
				await sql.addStatus(player.channel, player.id, enums.Statuses.Cooldown, 10 * 60 * 1000, enums.Cooldowns.Action);
			} else {
				await sql.addStatus(player.channel, player.id, enums.Statuses.Cooldown, hour, enums.Cooldowns.Action);
			}
			return newActionLevel > oldActionLevel;
		}
	},
	async gardenLevelUp(player, multiplier, suppressCooldown) {
		if(!multiplier) multiplier = 1;
		if(!player.npc) {
			if(!player.gardenLevel) player.gardenLevel = 0;
			const oldGardenLevel = Math.floor(player.gardenLevel);
			player.gardenLevel += (settings.GardenLevelSpeed * multiplier / (1 + player.gardenLevel)) * (Math.random() * 0.4 + 0.8);
			const newGardenLevel = Math.floor(player.gardenLevel);
			let cooldown = hour;
			if(player.status.find(s => s.type == enums.Statuses.UltimateForm)) {
				cooldown /= 6;
			}
			if(player.status.find(s => s.type == enums.Statuses.GardenWish)) {
				cooldown /= 2;
			}
			if(player.isNemesis) {
				cooldown *= 3;
			}
			if(!suppressCooldown) {
				await sql.addStatus(player.channel, player.id, enums.Statuses.Cooldown, cooldown, enums.Cooldowns.Garden);
			}
			return newGardenLevel > oldGardenLevel;
		}
	},
	async event(player, arg) {
		const now = new Date().getTime();
		const world = await sql.getWorld(player.channel);
		const event = world.cooldowns.find(c => enums.Cooldowns.IsEvent[c.type]);
		let messages = [];
		let output = null;

		if(event) {
			switch(event.type) {
				case enums.Cooldowns.HotSpringEvent:
					const defeated = await this.healPlayer(player, settings.HotSpringHours * hour);
					if(defeated) {
						output = `${player.name} takes some time to relax in a magical hot spring, ` +
							`but still can't fight for another ${this.getTimeString(defeated.endTime - now)}.`;
					} else {
						output = `${player.name} takes some time to relax in a magical hot spring, and is once again ready to fight!`;
					}
				case enums.Cooldowns.DojoEvent:
					let training = player.status.find(s => s.type == enums.Statuses.Training);
					if(training) {
						training.startTime -= settings.DojoHours * hour;
						await sql.setStatus(training);
						output = `${player.name} visits the dojo and works hard, boosting the effects of ${this.their(player.config.Pronoun)} training!`;
					}
					break;
				case enums.Cooldowns.GuruEvent:
					await this.killPlayer(player, hour * 6);
					await this.gardenLevelUp(player, 2.5 + Math.random(), true);
					await sql.setPlayer(player);
					output = `${player.name} fights the guru, and is soundly thrashed! However, ${this.their(player.config.Pronoun)} gardening power may have awakened...`;
					break;
				case enums.Cooldowns.Portal:
					const portal = await sql.getPortal(player.channel);
					const otherWorld = await sql.getWorld(portal.targetChannel);
					if(arg) {
						// Send a message
						messages.push({
							target: otherWorld.channel,
							message: `${player.name} has sent a message from Universe ${world.id}: "${arg}"`
						});
						output = `${player.name} sends a message to Universe ${otherWorld.id}!`;
					}
					const energy = Math.floor(player.level / 100 * (10 / Math.max(10, world.population)) * settings.PhantomStrength);
					portal.energyBuffs += energy;
					player.level -= energy;
					await sql.setPlayer(player);
					await sql.setPortal(portal);
					output = `${player.name} sends ${numeral(energy.toPrecision(2)).format('0,0')} energy into the portal!`
					break;
			}

			await this.actionLevelUp(player);

			messages.push(output);
			return messages;
		}
	},
	async return(player) {
		await this.deleteStatus(player, enums.Statuses.Journey);
		return `${player.name} comes rushing back from ${this.their(player.config.Pronoun)} journey!`;
	},
	async confirmCommand(player, username, command) {
		const askingPlayer = player.fusedPlayers[0].username == username ? player.fusedPlayers[0] : player.fusedPlayers[1];
		const otherPlayer = player.fusedPlayers[0].username == username ? player.fusedPlayers[1] : player.fusedPlayers[0];
		const existingOffer = askingPlayer.offers.find(o => o.playerId == otherPlayer.id && 
			o.type == enums.OfferTypes.Confirmation &&
			o.extra.toLowerCase() == command.toLowerCase());
		if(existingOffer) { 
			await sql.deleteOfferById(existingOffer.id);
			return true;
		} else {
			await sql.addOffer(askingPlayer, otherPlayer, enums.OfferTypes.Confirmation, command);
			return false;
		}
	},
	async killPlayer(player, duration) {
		if(duration <= 0) return;

		const defeatedState = player.status.find(s => s.type == enums.Statuses.Dead);
		if(defeatedState) {
			const now = new Date().getTime();
			const newEndTime = now + duration;
			if(defeatedState.endTime < newEndTime) {
				defeatedState.endTime = newEndTime;
				await sql.setStatus(defeatedState);
				return;
			}
		}

		const training = player.status.find(s => s.type == enums.Statuses.Training);
		const journey = player.status.find(s => s.type == enums.Statuses.Journey);
		
		if(journey) {
			const nemesis = await sql.getNemesis(player.channel);
			const storedTrainingTime = journey.rating;
			const journeyTime = journey.endTime - journey.startTime;
			let journeyEffect = (Math.random() * 0.4 + 0.8);
			if(nemesis) {
				// Journeys that end during a Nemesis reign are amazing
				journeyEffect += 0.5;
			}
			const time = journeyTime * journeyEffect + storedTrainingTime;
			await this.completeTraining(player, time);
		} else if(training) {
			await this.completeTraining(player);
		}
		
		if(player.isNemesis) {
			const world = await sql.getWorld(player.channel);
			player.level = this.newPowerLevel(world.heat * 0.8);
			await sql.addStatus(player.channel, null, enums.Statuses.Cooldown, 24 * hour, enums.Cooldowns.NextNemesis);
			for(const cooldown of player.cooldowns) {
				if(enums.Cooldowns.IsNemesis[cooldown.type]) {
					await this.deleteStatusById(player, cooldown.id);
				}
			}
			const garden = await sql.getGarden(player.channel);
			const darkPlant = garden.plants.find(p => p.slot == 99);
			if(darkPlant) {
				await sql.deletePlant(darkPlant.id);
			}
		}
		if(player.isUnderling) {
			player.underlingDefeats++;
		}
		if(player.npc) {
			await sql.addStatus(player.channel, player.id, enums.Statuses.Annihilation);
		} else {
			await sql.addStatus(player.channel, player.id, enums.Statuses.Dead, duration);
		}
		await sql.deleteOffersForPlayer(player.id);
		await sql.deleteGuardingForPlayer(player.id);

		await sql.setPlayer(player);
	},
	async deleteStatus(player, type) {
		await sql.deleteStatus(player.id, type);
		for(let i = 0; i < player.status.length; i++) {
			const status = player.status[i];
			if(status.type == type) {
				player.status.splice(i, 1);
				return;
			}
		}
	},
	async deleteStatusById(player, statusId) {
		await sql.deleteStatusById(statusId);
		if(player) {
			for(let i = 0; i < player.status.length; i++) {
				const status = player.status[i];
				if(status.id == statusId) {
					player.status.splice(i, 1);
					return;
				}
			}
		}
	},
	async sendPhantom(channel, targetChannel) {
		const portal = await sql.getPortal(channel);
		const world = await sql.getWorld(channel);
		const otherWorld = await sql.getWorld(targetChannel);

		let messages = [];

		// Determine power level for the phantom
		let level = this.newPowerLevel(world.heat) + portal.energyBuffs / 10;
		
		let npc = await this.addNpc(targetChannel, enums.NpcTypes.Phantom, `Phantom${world.id}`);
		npc.level = level;
		await sql.setPlayer(npc);

		messages.push({
			target: channel,
			message: `As the portal closes, your universe sends a phantom with a power level of ${numeral(level.toPrecision(2)).format('0,0')} ` +
			` to Universe ${otherWorld.id}!`
		});
		messages.push({
			target: targetChannel,
			message: `As the portal closes, a phantom with a power level of ${numeral(level.toPrecision(2)).format('0,0')} ` +
				` from Universe ${otherWorld.id} emerges from the portal! Defeat it to gain massive Glory!`
		});
		return messages;
	},
	async underlingPowerup(player) {
		const revivePower = hour * (15 - 2.5 * player.underlingDefeats);
		if(revivePower > 0) {
			await this.completeTraining(player, revivePower);
			await sql.setPlayer(player);
			return `${player.name} returns to the fight, more powerful than ever!`;
		} else {
			return null;
		}
	},
	async raid(player) {
		await sql.addItems(player.channel, player.id, enums.Items.Orb, 1);
		await sql.addStatus(player.channel, player.id, enums.Statuses.Cooldown, 6 * hour, enums.Cooldowns.Raid);

		let embed = new Discord.RichEmbed();
		embed.setTitle(`NEMESIS RAID`)
			.setColor(0xff0000);
		embed.setDescription(`**${player.name}** invades a peaceful village, taking their orb by force!`);
		return embed;
	},
	async guard(player, target) {
		await sql.addStatus(player.channel, target.id, enums.Statuses.Guarded, 6 * hour, player.id);
		return `**${player.name}** swears to protect **${target.name}** from the nemesis! For the next six hours, ` +
			`using !attack or !destroy on **${target.name}** will target **${player.name}** instead.`;
	},
	getGlory(player, amount) {
		return Math.floor(amount * (1 + Math.sqrt(player.legacyGlory/750)));
	}
}
