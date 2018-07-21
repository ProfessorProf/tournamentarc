const tools = require('./tools.js');
const sql = require('./sql.js');
const auth = require('../auth.json');

let hour = (60 * 60 * 1000);

module.exports = {
    // Returns an error string if the command is illegal
    async validate(channel, name, cmd, args) {
		let player = await sql.getPlayerByUsername(channel, name);
		let targetName;
		if(cmd == 'use') {
			targetName = args.length > 1 ? args[1] : null;
		} else {
			targetName = args.length > 0 ? args[0] : null;
		}
		let target = await sql.getPlayer(channel, targetName);
		let nemesis = await sql.getNemesis(channel)
		let garden = await sql.getGarden(channel)
		let errors = [];
		let now = new Date().getTime();
		
		switch(cmd) {
			case 'reg':
				// !reg validation rules:
				// - Player must not already be registered
				// - Name must not be taken
				// - Name must not contain spaces
				if(player) {
					errors.push('You have already registered!');
				}
				if(!targetName) {
					errors.push('You must specify a character name.');
				}
				if(args.length > 1) {
					errors.push('Name must not contain spaces.');
				} else {
					if(target) {
						errors.push(`There is already a character named ${player.name}.`);
					}
				}
				break;
			case 'fight':
				// !fight validation rules:
				// - Target must exist if specified
				// - Player and Target must be different people
				// - Player and Target must both be alive
				module.exports.validatePlayerRegistered(errors, player);
				if(player) {
					let defeated = player.status.find(s => s.type == 0);
					if(defeated) {
						let timeString = tools.getTimeString(defeated.endTime - now);
						errors.push('**' + player.name + '** cannot fight for another ' + timeString + '.');
					}
					if(target) {
						if(player.name == target.name) {
							errors.push('You cannot fight yourself!');
						}
						let targetDefeated = target.status.find(s => s.type == 0);
						if(targetDefeated) {
							let timeString = tools.getTimeString(targetDefeated.endTime - now);
							errors.push('**' + target.name + '** cannot fight for another ' + timeString + '.');
						}
					} else if(targetName) {
						errors.push('The player "' + targetName + '" could not be found.');
					}
				}
				break;
			case 'attack':
				// !attack validation rules:
				// - Must specify target
				// - Target must be alive
				// - Target must exist
				// - Player and Target must be different people
				// - Target must be alive
				// - Player must be Nemesis
				// - Nemesis attack cooldown must be off
				module.exports.validatePlayerRegistered(errors, player);
				if(player) {
					module.exports.validateNemesis(errors, player);
					if(nemesis) {
						if(nemesis.attackTime > now) {
							let timeString = tools.getTimeString(nemesis.attackTime - now);
							errors.push('**' + player.name + '** cannot attack indiscriminately for another ' + timeString + '.');
						}
						if(target) {
							if(player.name == target.name) {
								errors.push('You cannot attack yourself!');
							}
							let targetDefeated = target.status.find(s => s.type == 0);
							if(targetDefeated) {
								let timeString = tools.getTimeString(targetDefeated.endTime - now);
								errors.push('**' + target.name + '** cannot fight for another ' + timeString + '.');
							}
						} else {
							errors.push('Must specify a valid target.');
						}
					}
				}
				break;
			case 'destroy':
				// !destroy validation rules:
				// - Player must be Nemesis
				// - Nemesis destroy cooldown must be off
				module.exports.validatePlayerRegistered(errors, player);
				if(!player) {
					module.exports.validateNemesis(errors, player);
					if(nemesis) {
						if(nemesis.attackTime > now) {
							let timeString = tools.getTimeString(nemesis.attackTime - now);
							errors.push('**' + player.name + '** cannot destroy a planet for another ' + timeString + '.');
						}
						if(player.glory < 400) {
							errors.push(`**${player.name}** must be at least Rank SS to use destruction.`);
						}
					}
				}
				break;
			case 'train':
				// !train validation rules:
				// - Must be alive
				// - Must have lost a fight since they last stopped training
				// - Must not be training
				module.exports.validatePlayerRegistered(errors, player);
				if(player) {
					module.exports.validateNotNemesis(errors, player);
					let defeated = player.status.find(s => s.type == 0);
					if(defeated) {
						let timeString = tools.getTimeString(defeated.endTime - now);
						errors.push('**' + player.name + '** cannot train for another ' + timeString + '.');
					}
					if(!player.status.find(s => s.type == 5)) {
						errors.push('**' + player.name + '** must lose a fight before they can begin training.');
					}
					if(player.status.find(s => s.type == 2)) {
						errors.push('**' + player.name + '** is already training.');
					}
				}
				break;
			case 'reset':
				// !reset validation rules:
				// - Must be Prof
				if(player.name != auth.admin) {
					errors.push('Only the game master can reset the world.');
				}
				break;
			case 'debug':
				// !debug validation rules:
				// - Must be Prof
				if(name != auth.admin) {
					errors.push('Only the game master can use debug commands.');
				}
				break;
			case 'pick':
				// !pick validation rules:
				// - Must be at least one plant in the garden
				// - Must be carrying fewer than 3 of the plant in question
				// TODO: Only react to discovered plants
				module.exports.validatePlayerRegistered(errors, player);
				if(player) module.exports.validateNotNemesis(errors, player);
				if(targetName) {
					let plantType = module.exports.getPlantType(targetName);
					let plantCount = garden.plants.filter(p => p && p.type == plantType && p.growTime < now).length;
					if(plantType == -1) {
						errors.push("You've never heard of that plant.");
					} else if(plantCount == 0) {
						errors.push("That plant isn't in the garden.");
					}
				} else {
					let plantCount = garden.plants.filter(p => p && p.growTime < now).length;
					if(plantCount == 0) {
						errors.push('There are no finished plants in the garden.');
					}
				}
				break;
			case 'use':
				// !use validation
				// - Must list a plant type
				// - Must list a target
				// - Must have the plant
				// - For healing plants, target must be dead
				// - For other plants, target must be alive
				// - Player and Target must be different people
				module.exports.validatePlayerRegistered(errors, player);
				if(player) {
					module.exports.validateNotNemesis(errors, player);
					if(args.length > 1) {
						let plantType = module.exports.getPlantType(targetName);
						if(plantType == -1) {
							errors.push("You've never heard of that plant.");
						}
						if(player.items.find(i => i.type == plantType)) {
							if(target) {
								if(target.name == player.name) {
									errors.push("You can't use plants on yourself.");
								}
								let targetDefeated = target.status.find(s => s.type == 0);
								switch(plantType) {
									case 1:
									case 2:
										if(!targetDefeated) {
											errors.push('**' + target.name + '** is already healthy.');
										}
										break;
									case 3:
									case 4:
									case 6:
										if(targetDefeated) {
											errors.push('**' + target.name + '** cannot eat that for another ' + timeString + '.');
										}
										break;
								}
							} else {
								errors.push('Must specify a valid target.');
							}
						} else {
							errors.push("You don't have any of that plant.");
						}
					} else {
						errors.push("Syntax: `!use planttype target`");
					}
				}
				break;
			case 'plant':
				// !plant validation rules:
				// - Must not have done any gardening/searching in past hour
				// - Must be room in the garden for a new plant
				// - TODO: Must be a known plant
				module.exports.validatePlayerRegistered(errors, player);
				if(player) {
					module.exports.validateNotNemesis(errors, player);
					module.exports.validateGardenTime(errors, player);
					let plantCount = garden.plants.filter(p => p).length;
					if(plantCount == 3) {
						errors.push("There isn't room to plant anything new in the garden - try `!pick` to take something from it first.");
					}
				}
				break;
			case 'expand':
				// !plant validation rules:
				// - Must not have done any gardening/searching in past hour
				module.exports.validatePlayerRegistered(errors, player);
				if(player) {
					module.exports.validateNotNemesis(errors, player);
					module.exports.validateGardenTime(errors, player);
				}
			case 'water':
				// !plant validation rules:
				// - Must not have done any gardening/searching in past hour
				// - Must be at least one waterable plant
				module.exports.validatePlayerRegistered(errors, player);
				if(player) {
					module.exports.validateNotNemesis(errors, player);
					module.exports.validateGardenTime(errors, player);
					let plantCount = garden.plants.filter(p => p && p.growTime > now).length;
					if(plantCount == 0) {
						errors.push("There aren't any plants that need watering right now.");
					}
				}
				break;
			case 'research':
				// !plant validation rules:
				// - Must not have done any gardening/searching in past hour
				// - Must not be over the limit
				module.exports.validatePlayerRegistered(errors, player);
				if(player) {
					module.exports.validateNotNemesis(errors, player);
					module.exports.validateGardenTime(errors, player);
					let knownPlants = garden.plantTypes.filter(t => t.known).length;
					if(garden.researchLevel >= knownPlants) {
						errors.push("You can't research further right now - try `!expand` to work on the garden instead.");
					}
				}
			case 'search':
				// !search validation rules:
				// - Must not have done any gardening/searching in past hour
				module.exports.validatePlayerRegistered(errors, player);
				if(player) {
					module.exports.validateNotNemesis(errors, player);
					module.exports.validateActionTime(errors, player);
				}
				break;
			case 'fuse':
				// !fuse validation rules:
				// - Target must exist
				// - Player and Target must be different people
				// - Both must be alive
				// - Both must be Rank B+
				// - Both must not be fusions
				module.exports.validatePlayerRegistered(errors, player);
				if(player) {
					module.exports.validateNotNemesis(errors, player);
					if(args.length > 2) {
						errors.push('Fusion Name must not contain spaces.');
					}
					if(player.fusionFlag) {
						errors.push(`**${player.name} can't fuse again until the game resets.`);
					}
					let defeated = player.status.find(s => s.type == 0);
					if(defeated) {
						let timeString = tools.getTimeString(defeated.endTime - now);
						errors.push('**' + player.name + '** cannot fuse for another ' + timeString + '.');
					}
					if(player.glory < 100) {
						errors.push(`**${player.name}** must be at least Rank B to use Fusion.`);
					}
					if(target) {
						if(target.fusionFlag) {
							errors.push(`**${target.name} can't fuse again until the game resets.`);
						}
						if(player.name == target.name) {
							errors.push("You can't fuse with yourself!");
						}
						let targetDefeated = target.status.find(s => s.type == 0);
						if(targetDefeated) {
							let timeString = tools.getTimeString(targetDefeated.endTime - now);
							errors.push('**' + target.name + '** cannot fuse for another ' + timeString + '.');
						}
						if(target.glory < 100) {
							errors.push(`**${target.name}** must be at least Rank B to use Fusion.`);
						}
					} else {
						errors.push('Must specify a valid target.');
					}
					if(tools.isFusion(player) || tools.isFusion(target)) {
						errors.push("Fused players can't fuse again.");
					}
				}
				break;
			case 'nemesis':
				// !nemesis validation rules:
				// - Player must be alive
				// - Player must be at least Rank S
				// - There must not be a Nemesis
				// - 24 hours must have passed since the previous Nemesis died
				module.exports.validatePlayerRegistered(errors, player);
				if(player) {
					if(nemesis.cooldown > now) {
						let timeString = tools.getTimeString(nemesis.cooldown - now);
						errors.push(`A new nemesis won't rise for at least ${timeString}.`);
					}
					if(player.isNemesis) {
						errors.push(`**${player.name}** is already a nemesis.`);
					}
					if(player.nemesisFlag) {
						errors.push(`**${player.name}** cannot become a nemesis again.`);
					}
					let defeated = player.status.find(s => s.type == 0);
					if(defeated) {
						let timeString = tools.getTimeString(defeated.endTime - now);
						errors.push('**' + player.name + '** cannot become a nemesis for another ' + timeString + '.');
					}
					if(tools.isFusion(player)) {
						errors.push("A fusion can't become a nemesis.");
					}
					if(player.glory < 250) {
						errors.push(`**${player.name}** must be at least Rank S to become a nemesis.`);
					}
				}
				break;
			case 'scan':
				// !scan validation
				// - Must specify a valid target
				module.exports.validatePlayerRegistered(errors, player);
				if(player) {
					module.exports.validateNotNemesis(errors, player);
					if(target) {
						if(player.name == target.name) {
							errors.push('You cannot scan yourself!');
						}
					} else {
						errors.push('Must specify a valid target.');
					}
				}
				break;
			case 'wish':
				// !wish validation
				// - Must not have wished before
				// - Must have all seven orbs
				// - Nemesis can only wish for ruin
				module.exports.validatePlayerRegistered(errors, player);
				if(player) {
					if(args.length == 0) {
						errors.push('Enter `!help wish` for more information.');
					}
					let orbs = player.items.find(i => i.type == 0);
					if(!orbs || orbs.count < 7) {
						errors.push('Insufficient orbs.');
					}
					if(player.wishFlag) {
						errors.push("You can only wish upon the orbs once per season.");
					}
					let wish = args[0].toLowerCase();
					switch(wish) {
						case 'power':
						case 'immortality':
						case 'gardening':
							if(player.isNemesis) {
								errors.push('The Nemesis can only wish for ruin.');
							}
							break;
						case 'resurrection':
							if(player.isNemesis) {
								errors.push('The Nemesis can only wish for ruin.');
							}
							break;
						case 'ruin':
							if(!player.isNemesis) {
								errors.push('Only the Nemesis can wish for ruin.');
							}
							if(player.glory < 400) {
								errors.push('requires Rank SS.');
							}
							break;
						default:
							errors.push('Unrecognized wish.');
					}
				}
				break;
		}

		if(errors.length > 0) {
			return errors;
		} else {
			return null;
		}
	},
	validatePlayerRegistered(errors, player) {
		if(!player) {
			errors.push('Enter `!reg Name` to start playing! You must be registered to use this cmd.');
		}
	},
	validateNemesis(errors, player) {
		if(!player.isNemesis) {
			errors.push('Only the Nemesis can use this command.');
		}
	},
	validateNotNemesis(errors, player) {
		if(player.isNemesis) {
			errors.push('The Nemesis knows only battle.');
		}
	},
	validateActionTime(errors, player) {
		let now = new Date().getTime();
		if(player.actionTime > now) {
			let timeString = tools.getTimeString(player.actionTime - now);
			errors.push(`**${player.name}** cannot act for another ${timeString}.'`);
		}
	},
	validateGardenTime(errors, player) {
		let now = new Date().getTime();
		if(player.gardenTime > now) {
			let timeString = tools.getTimeString(player.gardenTime - now);
			errors.push(`**${player.name}** cannot garden for another ${timeString}.'`);
		}
	},
	getPlantType(plantName) {
		switch(plantName.toLowerCase()) {
			case 'flower':
				return 0;
				break;
			case 'rose':
				return 1;
				break;
			case 'carrot':
				return 2;
				break;
			case 'bean':
				return 3;
				break;
			case 'algae':
				return 4;
				break;
			case 'fern':
				return 5;
				break;
			default:
				return -1;
				break;
		}
	}
}