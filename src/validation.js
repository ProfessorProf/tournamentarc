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
		let glory = player ? player.glory : 0;
		if(player && player.fusionNames.length == 2) {
			glory /= 2;
		}
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
			case 'check':
				this.validatePlayerRegistered(errors, player);
				break;
			case 'fight':
				// !fight validation rules:
				// - Target must exist if specified
				// - Player and Target must be different people
				// - Player and Target must both be alive
				this.validatePlayerRegistered(errors, player);
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
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateNemesis(errors, player);
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
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateNemesis(errors, player);
					if(nemesis) {
						if(nemesis.destroyTime > now) {
							let timeString = tools.getTimeString(nemesis.destroyTime - now);
							errors.push('**' + player.name + '** cannot destroy a planet for another ' + timeString + '.');
						}
						if(glory < 400) {
							errors.push(`**${player.name}** must be at least Rank SS to use destruction.`);
						}
					}
				}
				break;
			case 'burn':
				// !burn validation rules:
				// - Player must be Nemesis
				// - Nemesis burn cooldown must be off
				// - Must be at least one plant in the garden
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateNemesis(errors, player);
					if(nemesis) {
						if(!garden.plants.find(p => p)) {
							errors.push('There are no plants in the garden to burn!');
						}
						if(nemesis.burnTime > now) {
							let timeString = tools.getTimeString(nemesis.burnTime - now);
							errors.push('**' + player.name + '** cannot attack the garden for another ' + timeString + '.');
						}
					}
				}
				break;
			case 'train':
				// !train validation rules:
				// - Must be alive
				// - Must have lost a fight since they last stopped training
				// - Must not be training
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateNotNemesis(errors, player);
					let defeated = player.status.find(s => s.type == 0);
					if(defeated) {
						let timeString = tools.getTimeString(defeated.endTime - now);
						errors.push('**' + player.name + '** cannot train for another ' + timeString + '.');
					} else {
						if(!player.status.find(s => s.type == 5)) {
							errors.push('**' + player.name + '** must lose a fight before they can begin training.');
						}
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
				this.validatePlayerRegistered(errors, player);
				if(player) this.validateNotNemesis(errors, player);
				if(targetName) {
					let knownPlants = await sql.getKnownPlants(channel);
					let plantType = this.getPlantType(targetName, knownPlants);
					let heldPlants = player.items.find(i => i.type == plantType);
					if(heldPlants && heldPlants.count >= 3) {
						errors.push("You can't carry any more of that plant.");
					}
					let plantCount = garden.plants.filter(p => p && p.type == plantType && p.endTime < now).length;
					if(plantType == -1) {
						errors.push("You've never heard of that plant.");
					} else if(plantCount == 0) {
						errors.push("None of those are ready to be picked.");
					}
				} else {
					// If there's no plant specified, then it defaults to picking the first thing in the garden
					let plant = garden.plants.find(p => p && p.endTime < now);
					let heldPlants = player.items.find(i => i.type == plant.type);
					if(heldPlants && heldPlants.count >= 3) {
						errors.push("You can't carry any more of that plant.");
					}
					let plantCount = garden.plants.filter(p => p && p.endTime < now).length;
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
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateNotNemesis(errors, player);
					let knownPlants = await sql.getKnownPlants(channel);
					let plantType = this.getPlantType(args[0], knownPlants);
					if(args.length > 1) {
						if(plantType == -1) {
							errors.push("You've never heard of that plant.");
						} else {
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
									if(player.isHenchman && !target.isNemesis) {
										errors.push('A henchman can only use plants on the Nemesis.');
									}
								} else {
									errors.push('Must specify a valid target.');
								}
							} else {
								errors.push("You don't have any of that plant.");
							}
						}
					} else {
						if (plantType == 5) {
							if(!player.items.find(i => i.type == plantType)) {
								errors.push("You don't have any of that plant.");
							}
							let plantCount = garden.plants.filter(p => p && p.endTime > now).length;
							if(plantCount == 0) {
								errors.push("There aren't any growing plants right now.");
							}
						} else {
							errors.push("Syntax: `!use planttype target`");
						}
					}
				}
				break;
			case 'plant':
				// !plant validation rules:
				// - Must not have done any gardening in past hour
				// - Must be room in the garden for a new plant
				// - TODO: Must be a known plant
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateNotNemesis(errors, player);
					this.validateGardenTime(errors, player);
					let knownPlants = await sql.getKnownPlants(channel);
					let plantType = this.getPlantType(targetName, knownPlants);
					if(plantType == -1 && targetName) {
						errors.push("You've never heard of that plant.");
					}
					let plantCount = garden.plants.filter(p => p).length;
					if(plantCount == 3) {
						errors.push("There isn't room to plant anything new in the garden - try `!pick` to take something from it first.");
					}
				}
				break;
			case 'expand':
				// !plant validation rules:
				// - Must not have done any gardening in past hour
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateNotNemesis(errors, player);
					this.validateGardenTime(errors, player);
				}
				break;
			case 'water':
				// !plant validation rules:
				// - Must not have done any gardening in past hour
				// - Must be at least one waterable plant
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateNotNemesis(errors, player);
					this.validateGardenTime(errors, player);
					let plantCount = garden.plants.filter(p => p && p.endTime > now).length;
					if(plantCount == 0) {
						errors.push("There aren't any plants that need watering right now.");
					}
				}
				break;
			case 'research':
				// !plant validation rules:
				// - Must be registered
				// - Must not be the Nemesis
				// - Must not have done any world actions in past hour
				// - Must not be over the limit
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateNotNemesis(errors, player);
					this.validateGardenTime(errors, player);
					let knownPlants = garden.plantTypes.filter(t => t.known).length;
					let unknownPlants = garden.plantTypes.filter(t => !t.known).length;
					if(garden.researchLevel >= knownPlants - 1.01 && garden.growthLevel < 3) {
						errors.push("You can't research further right now - try `!expand` to work on the garden instead.");
					}
					if(unknownPlants == 0) {
						errors.push("There are no new plant species to discover.");
					}
					if(glory < 50) {
						errors.push(`**${player.name}** must be at least Rank C to research new plants.`);
					}
				}
				break;
			case 'search':
				// !search validation rules:
				// - Must be registered
				// - Must not be the Nemesis
				// - Must not have done any world actions in past hour
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateNotNemesis(errors, player);
					this.validateActionTime(errors, player);
				}
				break;
			case 'overdrive':
				// !overdrive validation rules:
				// - Must be registered
				// - Must not be the Nemesis
				// - Must not have done any world actions in past hour
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateNotNemesis(errors, player);
					this.validateActionTime(errors, player);
					if(glory < 150) {
						errors.push(`**${player.name}** must be at least Rank A to overdrive.`);
					}
				}
				break;
			case 'empower':
				// !empower validation rules:
				// - Must be registered
				// - Must not be the Nemesis
				// - Must not have done any world actions in past hour
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateNotNemesis(errors, player);
					this.validateActionTime(errors, player);
					if(target) {
						if(glory < 50) {
							errors.push(`**${player.name}** must be at least Rank C to send energy.`);
						}
						if(player.isHenchman && !target.isNemesis) {
							errors.push('A henchman can only send energy to the Nemesis.');
						}
					} else {
						errors.push('Must pick a valid target.');
					}
				}
				break;
			case 'fuse':
				// !fuse validation rules:
				// - Target must exist
				// - Player and Target must be different people
				// - Both must be alive
				// - Both must be Rank B+
				// - Both must not be fusions
				this.validatePlayerRegistered(errors, player);
				if (! player) {
					break;
				}
				this.validateNotNemesis(errors, player);
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
				if(glory < 100) {
					errors.push(`**${player.name}** must be at least Rank B to use Fusion.`);
				}
				if(target) {
					if(target.fusionFlag) {
						errors.push(`**${target.name} can't fuse again until the game resets.`);
					}
					if(player.name == target.name) {
						errors.push("You can't fuse with yourself!");
					} else {
						let targetDefeated = target.status.find(s => s.type == 0);
						if(targetDefeated) {
							let timeString = tools.getTimeString(targetDefeated.endTime - now);
							errors.push('**' + target.name + '** cannot fuse for another ' + timeString + '.');
						}
						if(target.glory < 100) {
							errors.push(`**${target.name}** must be at least Rank B to use Fusion.`);
						}
						if(tools.isFusion(target)) {
							errors.push("Fused players can't fuse again.");
						}
					}
				} else {
					errors.push('Must specify a valid target.');
				}
				if(tools.isFusion(player)) {
					errors.push("Fused players can't fuse again.");
				}
				break;
			case 'nemesis':
				// !nemesis validation rules:
				// - Player must be alive
				// - Player must be at least Rank S
				// - There must not be a Nemesis
				// - 24 hours must have passed since the previous Nemesis died
				this.validatePlayerRegistered(errors, player);
				if(player) {
					if(nemesis && nemesis.cooldown > now) {
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
					if(glory < 250) {
						errors.push(`**${player.name}** must be at least Rank S to become a nemesis.`);
					}
				}
				break;
			case 'scan':
				// !scan validation
				// - Must specify a valid target
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateNotNemesis(errors, player);
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
				this.validatePlayerRegistered(errors, player);
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
					if(args.length > 0) {
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
								if(glory < 400) {
									errors.push('Requires Rank SS.');
								}
								break;
							default:
								errors.push('Unrecognized wish.');
						}
					}
				}
				break;
			case 'unfight':
				// !unfight validation
				// - Must be registered
				// - Must not be the Nemesis
				// - Must not be Berserk
				this.validatePlayerRegistered(errors, player);
				if(player.isNemesis || player.status.find(s => s.type == 12)) {
					errors.push("You can't stop fighting!");
				}
				break;
			case 'give':
				// !give validation
				// - Must be registered
				// - Target must exist
				// - Target must not be you
				// - Must have at least one orb
				this.validatePlayerRegistered(errors, player);
				if(!player.items.find(i => i.type == 0)) {
					errors.push("You don't have any orbs to give!");
				}
				if(target) {
					if(player.name == target.name) {
						errors.push("You can't give yourself orbs!");
					}
				} else {
					errors.push('Must specify a valid target.');
				}
				if(player.isHenchman && !target.isNemesis) {
					errors.push('A henchman can only give orbs to the Nemesis.');
				}
				break;
			case 'history':
				// !history validation
				// - Must be registered
				// - Must specify a valid target
				this.validatePlayerRegistered(errors, player);
				if(player) {
					if(target) {
						if(player.name == target.name) {
							errors.push('When you fight yourself, you lose every time.');
						}
					} else {
						errors.push('Must specify a valid target.');
					}
				}
				break;
			case 'recruit':
				// !recruit validation
				// - Must be registered
				// - Must be the Nemesis
				// - Must not be capped out on henchmen
				// - Target must exist and not be you
				// - Target must not already be a henchman
				this.validatePlayerRegistered(errors, player);
				this.validateNemesis(errors, player);
				if(target) {
					let henchmen = await sql.getHenchmen(channel);
					let world = await sql.getWorld(channel);
					let maxHenchmen = Math.floor(world.maxPopulation / 5) - 1;
					if(henchmen.length >= maxHenchmen) {
						errors.push("You can't recruit more henchmen.");
					}
					if(target.isHenchman) {
						errors.push(`${target.name} already works for you.`);
					}
					if(target.id == player.id) {
						errors.push(`That's not what "be your own boss" means.`);
					}
				} else {
					errors.push('Must specify a valid target.');
				}
				break;
			case 'join':
				// !join validation
				// - Must be registered
				// - Offer must be presented
				// - Must not be a Henchman
				this.validatePlayerRegistered(errors, player);
				if(player.isHenchman) {
					errors.push("You already serve the Nemesis.");
				} else {
					if(!player.offers.find(o => o.type == 2)) {
						errors.push("The Nemesis needs to \`!recruit\` you first.");
					}
					let henchmen = await sql.getHenchmen(channel);
					let world = await sql.getWorld(channel);
					let maxHenchmen = Math.floor(world.maxPopulation / 5);
					if(henchmen.length >= maxHenchmen) {
						errors.push("The Nemesis already has too many henchmen.");
					}
				}
				break;
			case 'exile':
				// !exile validation
				// - Must be registered
				// - Must be the Nemesis
				// - Target must exist
				// - Target must be a henchman
				this.validatePlayerRegistered(errors, player);
				this.validateNemesis(errors, player);
				if(target) {
					if(target.id == player.id) {
						errors.push(`The only escape from being the Nemesis is death.`);
					} else {
						if(!target.isHenchman) {
							errors.push(`${target.name} doesn't work for you.`);
						}
					}
				} else {
					errors.push('Must specify a valid target.');
				}
				break;
			case 'energize':
				// !energize validation
				// - Must be registered
				// - Must be the Nemesis
				// - Target must exist
				// - Target must be a henchman
				this.validatePlayerRegistered(errors, player);
				this.validateNemesis(errors, player);
				if(target) {
					if(target.id == player.id) {
						errors.push(`You cannot energize yourself.`);
					} else {
						if(!target.isHenchman) {
							errors.push(`${target.name} doesn't work for you.`);
						}
					}
					if(nemesis.energizeTime > now) {
						let timeString = tools.getTimeString(nemesis.energizeTime - now);
						errors.push('**' + player.name + '** cannot energize a henchman for another ' + timeString + '.');
					}
				} else {
					errors.push('Must specify a valid target.');
				}
				break;
			case 'revive':
				// !revive validation
				// - Must be registered
				// - Must be the Nemesis
				// - Target must exist
				// - Target must be a henchman
				this.validatePlayerRegistered(errors, player);
				this.validateNemesis(errors, player);
				if(target) {
					if(target.id == player.id) {
						errors.push(`You cannot revive yourself.`);
					} else {
						if(!target.isHenchman) {
							errors.push(`${target.name} doesn't work for you.`);
						}
					}
					if(!target.status.find(s => s.type == 0)) {
						errors.push(`${target.name} doesn't need to be revived right now.`);
					}
					if(nemesis.reviveTime > now) {
						let timeString = tools.getTimeString(nemesis.reviveTime - now);
						errors.push('**' + player.name + '** cannot revive a henchman for another ' + timeString + '.');
					}
				} else {
					errors.push('Must specify a valid target.');
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
			errors.push(`**${player.name}** cannot act for another ${timeString}.`);
		}
	},
	validateGardenTime(errors, player) {
		let now = new Date().getTime();
		if(player.gardenTime > now) {
			let timeString = tools.getTimeString(player.gardenTime - now);
			errors.push(`**${player.name}** cannot garden for another ${timeString}.`);
		}
	},
	getPlantType(plantName, knownPlants) {
		let plantType = -1;
		if(!plantName) return -1;
		switch(plantName.toLowerCase()) {
			case 'flower':
				plantType = 1;
				break;
			case 'rose':
				plantType = 2;
				break;
			case 'carrot':
				plantType = 3;
				break;
			case 'bean':
				plantType = 4;
				break;
			case 'sedge':
				plantType = 5;
				break;
			case 'fern':
				plantType = 6;
				break;
			default:
				plantType = -1;
				break;
		}

		if(!knownPlants.find(p => p.id == plantType)) {
			return -1;
		}
		return plantType;
	}
}
