const numeral = require('numeral');
const sql = require('./sql.js');
const Discord = require("discord.js");
const hour = (60 * 60 * 1000);

module.exports = {
	// Gets an Embed showing a player's status.
    getPlayerDescription(channel, username, callback) {
		sql.getPlayerByUsername(channel, username, player => {
			if(!player) {
				console.log('Player not found');
				callback(null);
				return;
			}
			var embed = new Discord.RichEmbed();
			var now = new Date().getTime();
			embed.setTitle(player.name.toUpperCase())
				  .setColor(0x00AE86);

			if(player.isNemesis) {
				embed.setDescription('NEMESIS');
			} else if(module.exports.isFusion(player)) {
				embed.setDescription(`Fusion between ${player.fusionNames[0]} and ${player.fusionNames[1]}`);
			}
			
			// Display Glory/Rank
			var stats = `${player.glory} Glory\n`;
			var glory = player.glory;
			if(module.exports.isFusion(player)) glory = Math.floor(glory / 2);
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
			var level = numeral(player.level.toPrecision(2));
			stats += level.format('0,0');
			if(player.status.find(s => s.type == 2) > -1) {
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
			var statuses = [];
			for(var i in player.status) {
				var s = player.status[i];
				if(!s.ends || s.endTime > now) {
					switch(s.type) {
						case 0:
							statuses.push(`Defeated (${module.exports.getTimeString(s.endTime - now)} remaining)`);
							break;
						case 2:
							statuses.push(`Training (${module.exports.getTimeString(now - s.startTime)} so far)`);
							break;
						case 4:
							statuses.push(`Overdriving (${module.exports.getTimeString(s.endTime - now)} remaining)`);
							break;
						case 5:
							statuses.push(`Ready to train`);
							break;
					}
				}
				if(player.gardenTime > now) {
					statuses.push(`Ready to garden in ${module.exports.getTimeString(now - gardenTime)}`);
				}
				if(player.actionTime > now) {
					statuses.push(`Ready to act in ${module.exports.getTimeString(now - actionTime)}`);
				}
			}
			if(statuses.length > 0) {
				embed.addField('Status', statuses.join('\n'));
			}

			// Display Inventory
			var items = [];
			for(var i in player.items) {
				var item = player.items[i];
				items.push(`${item.name} (${item.count} held)`);
			}
			if(items.length > 0) {
				embed.addField('Inventory', items.join('\n'));
			}

			// Display Offers
			var offers = [];
			for(var i in player.offers) {
				var o = player.offers[i];
				if(o.expires > now) {
					switch(o.type) {
						case 0:
							offers.push(`${o.name} wants to \`!fight\` ${o.targetId ? 'you' : 'anyone'} (expires in ${module.exports.getTimeString(o.expires - now)})`);
							break;
					}
				}
			}
			if(offers.length > 0) {
				embed.addField('Offers', offers.join('\n'));
			}
			
			callback(embed);
		});
	},
	// Scout a player's estimated power level and status.
	// TODO: Needs to be rewritten for SQL DB.
    scoutPlayer(data, player) {
        var output = '';
        output += player.name + '\n';
        if(player.isNemesis) {
            output += 'NEMESIS\n';
        }
		if(module.exports.isFusion(player)) {
            output += `Fusion between ${player.fusion[0]} and ${player.fusion[1]}\n`;
		}
		
        output += 'Power Level: '
        var level = numeral(player.level.toPrecision(2));
        output += level.format('0,0');
				
		if(player.trainingState == 2) {
			var now = new Date().getTime();
			output += '?\nTraining for ' + module.exports.getTimeString(now - player.trainingDate) + '\nEstimated True Power: ';
			// Estimate power level
			var levelGuess = player.level;
            var hours = Math.ceil((now - player.trainingDate) / hour);
            if(hours > 1000) hours = 1000;
            
			var newLevel = Math.pow(100, 1 + (data.heat + hours) / 1200);
			if(newLevel > 1000000000000000000) newLevel = 1000000000000000000;
			if(module.exports.isFusion(player)) {
				newLevel *= 1.3;
			}
            if(hours <= 16) {
                levelGuess += newLevel * (hours / 16);
            } else {
                levelGuess += newLevel * (1 + 0.01 * (hours / 16));
            }
			level = numeral(levelGuess.toPrecision(2));
			output += level.format('0,0');
		}

        return output;
    },
	// Converts a time in milliseconds into a readable string.
    getTimeString(milliseconds) {
        var seconds = Math.ceil(milliseconds / 1000);
        var minutes = Math.floor(seconds / 60);
        seconds -= minutes * 60;
        var hours = Math.floor(minutes / 60);
        minutes -= hours * 60;
        
        var output = '';
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
    displayRoster(channel, callback) {
		sql.getPlayers(channel, players => {
			var now = new Date().getTime();
			
			// Build the table out in advance so we can get column widths
			var headers = [4, 4, 6, 11];
			var rows = [];
			for(var i in players) {
				var p = players[i];
				var row = [];
				row.push(p.name);
				if(p.name.length > headers[0]) headers[0] = p.name.length;
				
				var rank = '-';
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
				
				var status = p.status.length > 0 ? p.status[0].name : 'Normal';
				
				row.push(status);
				if(status.length > headers[2]) headers[2] = status.length;
				
				var level = numeral(p.level.toPrecision(2)).format('0,0');
				if(p.status.find(s => s.type == 2)) {
					level += '?'
				}
				if(p.isNemesis) {
					level += ' [NEMESIS]';
				}
				if(module.exports.isFusion(p)) {
					level += ' [FUSION]';
				}
				var orbs = p.items.find(i => i.type == 0);
				if(orbs > 0) {
					level += `[${'*'.repeat(orbs)}]`;
				}
				
				row.push(level);
				if(level.length > headers[3]) headers[3] = level.length;
				
				rows.push(row);
			}
			
			// Print out the table
			var output = '';
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
			
			for(var i in rows) {
				var row = rows[i];
				output += row[0].padEnd(headers[0] + 1);
				output += row[1].padEnd(headers[1] + 1);
				output += row[2].padEnd(headers[2] + 1);
				output += row[3].padEnd(headers[3] + 1);
				output += '\n';
			}
			
			callback(output);
		});
	},
	// Nemesis attack command.
	attack(channel, player, target, callback) {
		sql.getPlayerByUsername(channel, player, player1 => {
			sql.getPlayer(channel, target, player2 => {
				sql.getNemesis(channel, nemesis => {
					var embed = new Discord.RichEmbed();
					var now = new Date().getTime();
					
					embed.setTitle(`NEMESIS INVASION`)
						  .setColor(0x00AE86);
					embed.setDescription(`**${player1.name}** attacks without warning, targeting **${player2.name}!**`);
					
					nemesis.attackTime = now + hour * 3;
					sql.setNemesis(channel, nemesis);
					
					module.exports.fight(player1, player2, embed, callback);
				});
			});
		});
	},
	// Either fights a player or sends them a challenge, depending on whether or not they've issued a challenge.
    tryFight(channel, player, target, callback) {
		sql.getPlayerByUsername(channel, player, player1 => {
			var embed = new Discord.RichEmbed();
			var now = new Date().getTime();
			
			if(target) {
				sql.getPlayer(channel, target, player2 => {
					if(!player1.offers.find(o => o.playerId == player2.id)) {
						// If they haven't offered, send a challenge
						embed.setTitle('BATTLE CHALLENGE')
							.setDescription(`**${player1.name}** has issued a battle challenge to **${player2.name}**! ${player2.name}, enter \`!fight ${player1.name}\` to accept the challenge and begin the battle.`);
						sql.addOffer(player1, player2, 0, () => {
							callback(embed);
						});
					} else {
						// FIGHT
						embed.setTitle(`${player1.name.toUpperCase()} vs ${player2.name.toUpperCase()}`)
							  .setColor(0x00AE86);
						module.exports.fight(player1, player2, embed, callback);
					}
				});
			} else {
				sql.addOffer(player1, null, 0, () => {
					embed.setTitle('BATTLE CHALLENGE')
						.setDescription(`**${player1.name}** wants to fight anyone! The next person to enter \`!fight ${player1.name}\` will accept the challenge and begin the battle.`);
					callback(embed);
				});
			}
		});
	},
	// Fight between two players.
    fight(player1, player2, embed, callback) {
		var channel = player1.channel;
		sql.getWorld(channel, data => {
			// If fighters are training - take them out of training and power them up
			var trainingState1 = player1.status.find(s => s.type == 2);
			if(trainingState1) {
				sql.deleteStatus(player1.id, 2);
				var hours = (now - trainingState1.startTime) / hour;
				if(hours > 1000) hours = 1000;
				module.exports.addHeat(data, hours);
				var newPowerLevel = module.exports.getPowerLevel(data.heat);
				if(module.exports.isFusion(player1)) {
					newPowerLevel *= 1.3;
				}
				if(player1.status.find(s => s.type == 10)) {
					newPowerLevel *= 1.5;
				}
				console.log(`Upgrading ${player1.name}'s power level after ${hours} hours of training, +${newPowerLevel}`);
				if(hours <= 16) {
					player1.level += newPowerLevel * (hours / 16);
				} else {
					player1.level += newPowerLevel * (1 + 0.01 * (hours / 16));
				}
			}
			
			var trainingState2 = player2.status.find(s => s.type == 2);
			if(trainingState2) {
				sql.deleteStatus(player2.id, 2);
				var hours = (now - trainingState1.startTime) / hour;
				if(hours > 1000) hours = 1000;
				module.exports.addHeat(data, hours);
				var newPowerLevel = module.exports.getPowerLevel(data.heat);
				if(module.exports.isFusion(player2)) {
					newPowerLevel *= 1.3;
				}
				if(player2.status.find(s => s.type == 10)) {
					newPowerLevel *= 1.5;
				}
				console.log(`Upgrading ${player2.name}'s power level after ${Math.ceil(hours)} hours of training, +${newPowerLevel}`);
				if(hours <= 16) {
					player2.level += newPowerLevel * (hours / 16);
				} else {
					player2.level += newPowerLevel * (1 + 0.01 * (hours / 16));
				}
			}
			
			embed.addField('Power Levels', `${player1.name}: ${numeral(player1.level.toPrecision(2)).format('0,0')}\n${player2.name}: ${numeral(player2.level.toPrecision(2)).format('0,0')}`);
			
			// Randomize, then adjust skill ratings
			var skill1 = (Math.random() + Math.random() + Math.random() + Math.random()) / 2;
			var skill2 = (Math.random() + Math.random() + Math.random() + Math.random()) / 2;
			
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
			var score1 = Math.sqrt(player1.level * skill1);
			var score2 = Math.sqrt(player2.level * skill2);
			
			var battleLog = '';
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
			var players = [];
			if(score1 > score2) {
				players = [player1, player2];
				skills = [skill1, skill2];
			} else {
				players = [player2, player1];
				skills = [skill2, skill1];
			}
			
			if(players[1].isNemesis) {
				sql.getNemesisHistory(channel, history => {
					module.exports.handleFightOutcome(data, players[0], players[1], skills[0], skills[1], history, embed, output => {
						embed.addField('Results', output);
						callback(embed);
					});
				});
			} else {
				module.exports.handleFightOutcome(data, players[0], players[1], skills[0], skills[1], null, embed, output => {
					embed.addField('Results', output);
					callback(embed);
				});
			}
		});
	},
	// Process updates based on who won and lost a fight.
	handleFightOutcome(data, winner, loser, winnerSkill, loserSkill, nemesisHistory, embed, callback) {
		var now = new Date().getTime();
		var output = '';
		
		// Loser gains the Ready status, winner loses ready status if training
		if(winner.status.find(s => s.type == 2)) {
			sql.deleteStatus(winner.id, 2);
		}
		sql.addStatus(loser, 5);
		
		// Determine length of KO
		var difference = winnerSkill - loserSkill + 1; 	// Effective 0-2
		var intensity = Math.max(winnerSkill, loserSkill); // Effective 0-2
		var hours = Math.ceil(difference * intensity * 3);
		hours = Math.max(hours, Math.min(hours, 12), 1);
		
		if(nemesisHistory) {
			// The Nemesis is dead!
			// TODO: Special Nemesis
			// Delete Nemesis, punish player
			loser.isNemesis = false;
			loser.level = module.exports.getPowerLevel(data.heat * 0.8);
			hours = 24;
			output += `${winner.name} defeated the Nemesis! Everyone's sacrifices were not in vain!`;

			// Give 20 Glory for each failed fight against this Nemesis
			var gloryGains = {};
			for(var i in nemesisHistory) {
				var h = nemesisHistory[i];
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
			for(var key in gloryGains) {
				var g = gloryGains[key];
				var rankUp = module.exports.rankUp(g.oldGlory, g.glory);
				output += `\n${g.name} gains ${g.glory} glory! Totals glory: ${g.oldGlory + g.glory}`;
				if(rankUp) {
					output += `\n${g.name}'s Rank has increased!`;
				}
			}
			data.nemesis = null;
			data.nemesisDate = new Date().getTime();
		}
		
		// Award glory to the winner
		var glory = Math.ceil(Math.min((loser.level / winner.level) * 10, 100));
		var rankUp = module.exports.rankUp(winner.glory, glory);
		winner.glory += glory;
		output += `${winner.name} is the winner! +${glory} glory. Total glory: ${winner.glory}`;
		if(rankUp) {
			output += `\n${winner.name}'s Rank has increased!`;
		}
		
		if(winner.isNemesis) {
			// Longer KO, but the Nemesis is weakened
			hours = 12;
			var maxPowerLoss = (loserSkill < 0.8 ? 0.025 : (loserSkill > 1.2 ? 0.075 : 0.05)) * loser.level;
			var powerLoss = Math.min(maxPowerLoss, loser.level * 0.5);
			output += `\nThe Nemesis is weakened, losing ${numeral(powerLoss.toPrecision(2)).format('0,0')} Power.`;
			winner.level -= powerLoss;
		}
		
		// Orb transfers
		var loserOrbs = loser.items.find(i => i.type == 0);
		var winnerOrbs = winner.items.find(i => i.type == 0);
		if(loserOrbs) {
			output += `\n${winner.name} took ${loserOrbs.count} magic orbs from ${loser.name}!`;
			sql.addItems(winner.id, 0, loserOrbs.count);
			sql.takeItems(winner.id, 0, loserOrbs.count);
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
		sql.addStatus(loser, 0, now + hours * hour);
        
		// Delete challenges
		sql.deleteOffersForDeath(loser);
        
		// Save changes
		sql.setPlayer(loser);
		sql.setPlayer(winner);
		
		// TODO: Update battle history

		callback(output);
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
	destroy(channel) {
		sql.getWorld(channel, data => {
			sql.getPlayers(channel, players => {
				sql.getNemesis(channel, nemesis => {
					var now = new Date().getTime();
					var embed = new Discord.RichEmbed();
					
					embed.setTitle('DESTRUCTION')
						.setDescription('The Nemesis uses their full power to destroy an entire planet!')
						.setColor(0x00AE86);
					
					var targetPlayers = [];
					for(var i in players) {
						var p = players[i];
						if(p && !p.isNemesis && !p.status.find(s => s.type == 0)) {
							targetPlayers.push(p);
						}
					}
					var targets = Math.min(targetPlayers.length, 3);
					var firstTarget = Math.floor(Math.random() * targetPlayers.length);
					
					for(var i = 0; i < targets; i++) {
						var target = targetPlayers[(firstTarget + i) % targetPlayers.length];
						var trainingState = target.status.find(s => s.type == 2);
						if(trainingState) {
							sql.deleteStatus(target.id, 2);
							var hours = (now - trainingState.startTime) / hour;
							if(hours > 72) hours = 72;
							module.exports.addHeat(data, hours);
							var newPowerLevel = module.exports.getPowerLevel(data.heat);
							if(module.exports.isFusion(player1)) {
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
						
						var output = '';
						if(target.status.find(s => s.type == 11)) {
							addStatus(target, 0, now + hour * 1);
							output += `${target.name} cannot fight for another 1 hour!\n`;
						} else {
							addStatus(target, 0, now + hour * 12);
							output += `${target.name} cannot fight for another 12 hours!\n`;
						}
						sql.setPlayer(target);
					}
					
					nemesis.destroyTime = now + 24 * hour;
					sql.setNemesis(nemesis);
					
					embed.addField('Damage Report', output);
					callback(embed);
				});
			});
		});
	},
	// Create a new Fusion.
	// TODO: Needs to be rewritten for SQL DB.
    fuse(data, player1, player2, fusionName) {
        if(player1.trainingState == 2) {
            player1.trainingState = 0;
            var hours = Math.ceil((new Date().getTime() - player1.trainingDate) / hour);
            if(hours > 1000) hours = 1000;
            module.exports.addHeat(data, hours);
        }
        
        if(player2.trainingState == 2) {
            player2.trainingState = 0;
            var hours = Math.floor((new Date().getTime() - player2.trainingDate) / hour);
            if(hours > 1000) hours = 1000;
            module.exports.addHeat(data, hours);
        }
    
		var now = new Date().getTime();
        var name = fusionName ? fusionName : player1.name + '|' + player2.name;
        var fusedPlayer = {
            name: name,
            level: module.exports.getPowerLevel(data.heat) + module.exports.getPowerLevel(data.heat),
			powerWish: player1.powerWish || player2.powerWish,
            glory: player1.glory + player2.glory,
            challenges: {},
            lastActive: now,
            aliveDate: now,
            trainingState: 0,
            trainingDate: now,
            gardenLevel: player1.gardenLevel + player2.gardenLevel,
			flowers: player1.flowers + player2.flowers,
			orbs: player1.orbs + player2.orbs,
            fusion: [player1.name, player2.name],
			fusionTime: now
        };
		
        data.players[fusedPlayer.name] = fusedPlayer;
        player1.fusion = [name];
        player2.fusion = [name];
		player1.fusionTime = now;
		player2.fusionTime = now;
		player1.hasFused = true;
		player2.hasFused = true;
        
        return module.exports.getPlayerDescription(data, fusedPlayer);
	},
	// Establish a character as a new Nemesis.
    setNemesis(channel, username, callback) {
		sql.getWorld(channel, data => {
			sql.getPlayerByUsername(channel, username, player => {
				sql.getNemesis(channel, nemesis => {
					if(!player) {
						console.log('Player not found');
						callback(null);
						return;
					}
					
					var embed = new Discord.RichEmbed();
					var now = new Date().getTime();
					embed.setTitle(player.name.toUpperCase())
						  .setColor(0x00AE86);
					
					// Raise heat, abort training
					module.exports.addHeat(data, 100);
					sql.deleteStatus(player.id, 5);
					
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
						player.level = module.exports.getPowerLevel(data.heat) * 4;
						nemesis.type = 1;
					} else {
						// A normal Nemesis
						player.level = module.exports.getPowerLevel(data.heat) * 10;
						nemesis.type = 0;
					}
					
					sql.setHeat(channel, data.heat);
					sql.setPlayer(player, () => {
						sql.setNemesis(channel, nemesis, () => {
							embed.setDescription(`**${player.name}** has become a Nemesis, and is invading the whole galaxy! Their rampage will continue until they are defeated in battle.\nThe Nemesis can no longer use most peaceful actions, but in exchange, they have access to several powerful new abilities. For more information, enter \`!help nemesis\`.`);
							callback(embed);
						});
					});
				});
			});
		});
	},
	// Check whether or not a player is a Nemesis.
	// TODO: Needs to be rewritten for SQL DB.
    isFusion(player) {
        return player.fusionNames.length == 2;
	},
	// Request to fuse with another player.
	// TODO: Needs to be rewritten for SQL DB.
    sendFusionOffer(player, target, fusionName) {
        var expirationDate = new Date();
        expirationDate.setHours(expirationDate.getHours() + 6);

        if(!target) return;
        if(!target.fuseOffers) target.fuseOffers = {};
        var offer = {
            fuser: player.name,
            expires: expirationDate.getTime(),
			fusionName: fusionName
        }
        target.fuseOffers[player.name] = offer;
		delete player.fuseOffers[target.name];
        console.log('New fusion offer for player ' + target.name + ' expires at ' + new Date(offer.expires));
	},
	// Generates a new power level based on the current Heat.
    getPowerLevel(heat) {
        var base = Math.ceil((1 + Math.random()) * 100);
        var level = Math.pow(base, 1 + heat / 1200);
        if(level > 1000000000000000000) level = 1000000000000000000; // JS craps out if we go higher than this
        return level;
	},
	// Increase Heat, modified by reset count.
    addHeat(data, heat) {
		if(!data) return;
        var addedHeat = heat * Math.pow(1.05, data.resets);
        data.heat += addedHeat;
        console.log('Heat increased by ' + heat + ' to ' + data.heat);
	},
	// End a fusion.
	// TODO: Needs to be rewritten for SQL DB.
	breakFusion(data, fusion) {
		var player1 = module.exports.loadPlayer(data, fusion.fusion[0], true);
		var player2 = module.exports.loadPlayer(data, fusion.fusion[1], true);
		if(!player1 || !player2) {
			console.log("Fusion break failed - a player doesn't exist");
			return;
		}
		var fusionWins = fusion.glory - player1.glory - player2.glory;
		var fusionGardening = fusion.gardenLevel - player1.gardenLevel - player2.gardenLevel;
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
	// Update the garden for !plant.
	// TODO: Needs to be rewritten for SQL DB.
	plant(data, player) {
		var output = '';
		var time = (Math.random() * 25 + 5) * (1 + 0.09 * player.gardenLevel) * 1000 * 60;
		console.log(`${player.name} advanced flower clock by ${Math.floor(time / (1000 * 60))} minutes`);
		var oldFlowers = data.flowers;
		data.gardenTime -= time;
		
		module.exports.updateGarden(data);
		
		var newFlowers = data.flowers;
		var percent = Math.floor((100 * time * Math.pow(1.05, data.gardenLevel)) / (6 * hour));
		
		output += `**${player.name}** works on the garden, with a gardening rating of ${percent}%. `;
		var flowers = newFlowers - oldFlowers;
		if(flowers) {
			output += '\n' + flowers > 1 ? (flowers + ' healing flowers grew!') : 'A healing flower grew!';
		}
		
		var oldGardenLevel = Math.floor(player.gardenLevel);
		player.gardenLevel += 1 / (1 + player.gardenLevel);
		var newGardenLevel = Math.floor(player.gardenLevel);
		if(newGardenLevel > oldGardenLevel) {
			output += '\nGardening level increased!';
		}
		return output;
	},
	// Expand the garden.
	// TODO: Needs to be rewritten for SQL DB.
	expand(data, player) {
		var output = '';
		var expansion = (Math.random() * 25 + 5) * (1 + 0.09 * player.gardenLevel) / (100 * (3 + data.gardenLevel));
		console.log(`${player.name} advanced garden level by ${Math.floor(expansion * 10) / 10}`);
		var percent = Math.floor(100 * expansion);
		output += `**${player.name}** works on the garden, with a gardening rating of ${percent}%.`;
		data.gardenLevel += expansion;
		module.exports.updateGarden(data);
		
		var gardenTime = hour * 6 / Math.pow(1.05, data.gardenLevel);
		output += `\nThe garden will now grow a healing flower every ${module.exports.getTimeString(gardenTime)}.`;
		
		var oldGardenLevel = Math.floor(player.gardenLevel);
		player.gardenLevel += 1 / (1 + player.gardenLevel);
		var newGardenLevel = Math.floor(player.gardenLevel);
		if(newGardenLevel > oldGardenLevel) {
			output += '\nGardening level increased!';
		}
		return output;
	},
	// Reset the universe.
	// TODO: Needs to be rewritten for SQL DB.
	resetData(data) {
		var now = new Date().getTime();
		data.heat = 0;
		for(var key in data.players) {
			var player = data.players[key];
			if(module.exports.isFusion(player)) {
				module.exports.breakFusion(data, player);
				delete player;
			}
		}
		for(var key in data.players) {
			var player = data.players[key];
			player.level = module.exports.getPowerLevel(data.heat);
			player.trainingState = 0;
			player.trainingDate = now;
			player.aliveDate = now;
			player.challenges = {};
			player.flowers = 0;
			player.orbs = 0;
			player.actionTime = 0;
			player.gardenLevel = 0;
			player.searchLevel = 0;
			player.fusion = [];
			player.powerWish = false;
			data.isNemesis = false;
		}
		data.flowers = 0;
		data.nemesis = null;
		data.gardenTime = now;
		data.gardenLevel = 0;
		data.lostOrbs = 7;
		data.orbs = 0;
		data.wishTime = now;
		data.resets++;
	},
	// Register a new player.
	registerPlayer(channel, username, name, callback) {
		sql.getWorld(channel, data => {
			var now = new Date().getTime();
			module.exports.addHeat(data, 10);
			var player = {
				name: name,
				username: username,
				channel: channel,
				glory: 0,
				level: module.exports.getPowerLevel(data.heat),
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
			sql.addPlayer(player, () => {
				console.log(`Registered ${username} as ${name}`);
				callback();
			});
		});
	},
	// Display the garden status.
	// TODO: Needs to be rewritten for SQL DB.
	displayGarden(data) {
		module.exports.updateGarden(data);
		var output = '';
		output += 'GARDEN STATUS\n'
		output += 'Healing Flowers: ' + data.flowers + '/3\n';
		
		var maxTime = (6 * hour) / Math.pow(1.05, data.gardenLevel);
		var timeLeft = maxTime - (new Date().getTime() - data.gardenTime);
		var timePercent = 100 - Math.ceil(timeLeft * 100 / maxTime);
		output += 'Next flower is ' + timePercent + '% complete\n';
		output += 'A flower grows every ' + module.exports.getTimeString(maxTime)
		return output;
	},
	// Update the garden based on time passing.
	// TODO: Needs to be rewritten for SQL DB.
	updateGarden(data) {
		var now = new Date().getTime();
		var maxTime = (6 * hour) / Math.pow(1.05, data.gardenLevel);
		
		var oneFlowerAgo = now - maxTime;
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
		var output = '';
		var now = new Date().getTime();
		if(!data.wishTime) data.wishTime = now;
		var effectiveTime = Math.min(now - data.wishTime, hour * 72);
		var searchModifier = effectiveTime / (hour * 72);
		var searchChance = (0.03 + 0.01 * player.searchLevel) * searchModifier;
		if (data.lostOrbs > 0) {
			var roll = Math.random();
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
		
		var oldSearchLevel = Math.floor(player.searchLevel);
		player.searchLevel += 1 / (1 + player.searchLevel);
		var newSearchLevel = Math.floor(player.searchLevel);
		if(newSearchLevel > oldSearchLevel) {
			output += '\nSearch level increased!';
		}
		
		return output;
	},
	// Make a wish on the orbs.
	// TODO: Needs to be rewritten for SQL DB.
	wish(data, player, wish) {
		var output = '';
		var now = new Date().getTime();
		
		switch(wish) {
			case 'power':
				player.level *= Math.random() + 2.5;
				player.powerWish = true;
				output += 'You can feel great power surging within you!';
				break;
			case 'resurrection':
				for(var i in data.players) {
					var p = data.players[i];
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
	}
}