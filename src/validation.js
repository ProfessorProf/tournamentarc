const tools = require('./tools.js');
const sql = require('./sql.js');
const auth = require('../auth.json');
const enums = require('./enum.js');

let hour = (60 * 60 * 1000);

module.exports = {
    // Returns an error string if the command is illegal
    async validate(channel, name, cmd, args) {
		let world = await sql.getWorld(channel);
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
		if((!world || !world.startTime) &&
			cmd != 'scores' && cmd != 'debug') {
			errors.push(`A new universe is waiting to be born.`);
			return errors;
		}
		if(world && world.startTime > now &&
			cmd != 'scores' && cmd != 'debug') {
			let duration = world.startTime - now;
			errors.push(`A new universe will be born in ${tools.getTimeString(duration)}.`);
			return errors;
		}
		
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
				if(targetName && (targetName.startsWith('Zorb') || targetName.startsWith('Zedge') ||
					targetName.startsWith('Zlower') || targetName.startsWith('Zarrot'))) {
					errors.push('Invalid name.');
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
					this.validateAnnihilation(errors, player);
					this.validateJourney(errors, player);
					let defeated = player.status.find(s => s.type == enums.Statuses.Dead);
					if(defeated) {
						let timeString = tools.getTimeString(defeated.endTime - now);
						errors.push('**' + player.name + '** cannot fight for another ' + timeString + '.');
					}
					if(target) {
						this.validateAnnihilation(errors, target);
						this.validateJourney(errors, target);
						if(player.name == target.name) {
							errors.push('You cannot fight yourself!');
						}
						let targetDefeated = target.status.find(s => s.type == enums.Statuses.Dead);
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
						const cooldown = player.cooldowns.find(c => c.type == enums.Cooldowns.Attack);
						if(cooldown) {
							let timeString = tools.getTimeString(cooldown.endTime - now);
							errors.push(`**${player.name}** cannot attack indiscriminately for another ${timeString}.`);
						}
						if(target) {
							this.validateAnnihilation(errors, target);
							this.validateJourney(errors, target);
							if(player.name == target.name) {
								errors.push('You cannot attack yourself!');
							}
							let targetDefeated = target.status.find(s => s.type == enums.Statuses.Dead);
							if(targetDefeated) {
								let timeString = tools.getTimeString(targetDefeated.endTime - now);
								errors.push(`**${target.name}** cannot fight for another ${timeString}.`);
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
						const cooldown = player.cooldowns.find(c => c.type == enums.Cooldowns.Destroy);
						if(cooldown) {
							let timeString = tools.getTimeString(cooldown.endTime - now);
							errors.push(`**${player.name}** cannot attack destroy a planet for another ${timeString}.`);
						}
						if(glory < 400) {
							errors.push(`**${player.name}** must be at least Rank S+ to use destruction.`);
						}
						const players = await sql.getPlayers(channel);
						let targetPlayers = [];
						for(const i in players) {
							let p = players[i];
							if(p && !p.isNemesis && !p.status.find(s => s.type == enums.Statuses.Dead)) {
								targetPlayers.push(p);
							}
						}
						if(targetPlayers.length == 0) {
							errors.push(`There are no available targets to destroy.`);
						}
					}
				}
				break;
			case 'burn':
				// !burn validation rules:
				// - Player must be Nemesis
				// - Must be at least one plant in the garden
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateNemesis(errors, player);
					if(nemesis) {
						if(!garden.plants.find(p => p)) {
							errors.push('There are no plants in the garden to burn!');
						}
						const cooldown = player.cooldowns.find(c => c.type == enums.Cooldowns.Burn);
						if(cooldown) {
							let timeString = tools.getTimeString(cooldown.endTime - now);
							errors.push(`**${player.name}** cannot attack the garden for another ${timeString}.`);
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
					this.validateAnnihilation(errors, player);
					this.validateNotNemesis(errors, player);
					this.validateJourney(errors, player);
					let defeated = player.status.find(s => s.type == enums.Statuses.Dead);
					if(defeated) {
						let timeString = tools.getTimeString(defeated.endTime - now);
						errors.push(`**${player.name}** cannot train for another ${timeString}.`);
					} else {
						if(!player.status.find(s => s.type == enums.Statuses.Ready)) {
							errors.push(`**${player.name}** must lose a fight before they can begin training.`);
						}
					}
					if(player.status.find(s => s.type == enums.Statuses.Training)) {
						errors.push(`**${player.name}** is already training.`);
					}
				}
				break;
			case 'journey':
				// !journey validation rules:
				// - Must be alive
				// - Must have lost a fight since they last stopped training
				// - Must not be training
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateAnnihilation(errors, player);
					this.validateNotNemesis(errors, player);
					let defeated = player.status.find(s => s.type == enums.Statuses.Dead);
					if(defeated) {
						let timeString = tools.getTimeString(defeated.endTime - now);
						errors.push(`**${player.name}** cannot train for another ${timeString}.`);
					} else {
						if(!player.status.find(s => s.type == enums.Statuses.Ready) &&
						   !player.status.find(s => s.type == enums.Statuses.Training)) {
							errors.push(`**${player.name}** must lose a fight before they can begin training.`);
						}
					}
					if(player.status.find(s => s.type == enums.Statuses.Journey)) {
						errors.push(`**${player.name}** is already on a journey.`);
					}
					const orbs = player.items.find(i => i.type == enums.Items.Orb);
					if(orbs && orbs.count > 0) {
						errors.push("You can't take orbs with you on a journey.");
					}
					const hours = parseInt(targetName);
					if(!targetName || hours != hours) {
						errors.push(`Must specify the number of hours.`);
					} else {
						if(hours < 2) {
							errors.push(`Can't journey for less than 2 hours.`);
						} else if(hours > 24) {
							errors.push(`Can't journey for more than 24 hours.`);
						}
					}
				}
				break;
			case 'reset':
				// !reset validation rules:
				// - Must be admin
				if(player.name != auth.admin) {
					errors.push('Only the game master can reset the world.');
				}
				break;
			case 'debug':
				// !debug validation rules:
				// - Must be admin
				if(name != auth.admin) {
					errors.push('Only the game master can use debug commands.');
				}
				break;
			case 'clone':
				// !clone validation rules:
				// - Must be admin
				if(name != auth.admin) {
					errors.push('Only the game master can use debug commands.');
				}
				break;
			case 'pick':
				// !pick validation rules:
				// - Must be at least one plant in the garden
				// - Must be carrying fewer than 3 of the plant in question
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateAnnihilation(errors, player);
					this.validateJourney(errors, player);
					if(targetName) {
						const knownPlants = garden.plantTypes.filter(t => t.known);
						const plantType = this.getPlantType(targetName);
						const plantKnown = knownPlants.find(p => p.id == plantType);
						const darkPlantType = this.getDarkPlantType(targetName);
						if(plantType == -1 && darkPlantType != -1 && !player.isNemesis) {
							errors.push("That plant was sealed away thousands of years ago.");
						}
						if(plantType != -1 && darkPlantType == -1 && player.isNemesis) {
							errors.push("You have no need of such a pathetic plant.");
						}
						let heldPlants = player.items.find(i => i.type == plantType);
						if(heldPlants && heldPlants.count >= 3) {
							errors.push("You can't carry any more of that plant.");
						}
						const plantCount = garden.plants.filter(p => p && (p.type == plantType || p.type == darkPlantType) && p.endTime < now).length;
						if((plantType == -1 || !plantKnown) && darkPlantType == -1) {
							errors.push("You've never heard of that plant.");
						} else if(plantCount == 0) {
							errors.push("None of those are ready to be picked.");
						}
					} else {
						// If there's no plant specified, then it defaults to picking the first thing in the garden
						let plant = garden.plants.find(p => p && p.endTime < now);
						if(plant) {
							let heldPlants = player.items.find(i => i.type == plant.type);
							if(heldPlants && heldPlants.count >= 3) {
								errors.push("You can't carry any more of that plant.");
							}
						}
						let plantCount = garden.plants.filter(p => p && p.endTime < now).length;
						if(plantCount == 0) {
							errors.push('There are no finished plants in the garden.');
						}
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
					this.validateAnnihilation(errors, player);
					this.validateNotNemesis(errors, player);
					this.validateJourney(errors, player);
					const knownPlants = garden.plantTypes.filter(t => t.known);
					const plantType = this.getPlantType(args[0]);
					const hasPlant = player.items.find(i => i.type == plantType);
					const plantExists = plantType != -1;
					const plantKnown = knownPlants.find(p => p.id == plantType);
					if(args.length > 1) {
						if(!plantExists || !hasPlant && !plantKnown) {
							errors.push("You've never heard of that plant.");
						} else {
							if(hasPlant) {
								if(target) {
									this.validateAnnihilation(errors, target);
									this.validateJourney(errors, target);
									if(target.id == player.id && enums.Items.CanUseOnSelf[plantType]) {
										errors.push("You can't use this plant on yourself.");
									}
									let targetDefeated = target.status.find(s => s.type == enums.Statuses.Dead);
									switch(plantType) {
										case enums.Items.Flower:
										case enums.Items.Rose:
											if(!targetDefeated) {
												errors.push(`**${target.name}** is already healthy.`);
											}
											break;
										case enums.Items.Bean:
										case enums.Items.Fern:
											if(targetDefeated) {
												let timeString = tools.getTimeString(targetDefeated.endTime - now);
												errors.push(`**${target.name}** cannot eat that for another ${timeString}.`);
											}
											break;
									}
									if(player.isUnderling && !target.isNemesis && !target.isUnderling) {
										errors.push('A underling can only use plants on their allies.');
									}
								} else {
									errors.push('Must specify a valid target.');
								}
							} else {
								errors.push("You don't have any of that plant.");
							}
						}
					} else {
						if (args.length > 0 && !enums.Items.NeedsTarget[plantType]) {
							if(plantKnown && !hasPlant) {
								errors.push("You don't have any of that plant.");
							}
							let plantCount = garden.plants.filter(p => p && p.endTime > now).length;
							if(plantCount == 0 && plantType == enums.Items.Sedge) {
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
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateAnnihilation(errors, player);
					this.validateJourney(errors, player);
					this.validateGardenTime(errors, player);
					let knownPlants = garden.plantTypes.filter(t => t.known);
					const plantType = this.getPlantType(targetName);
					const plantKnown = knownPlants.find(p => p.id == plantType);
					const darkPlantType = this.getDarkPlantType(targetName);
					if(plantType == -1 && darkPlantType != -1 && !player.isNemesis) {
						errors.push("That plant was sealed away thousands of years ago.");
					}
					if(plantType != -1 && darkPlantType == -1 && player.isNemesis) {
						errors.push("You have no need of such a pathetic plant.");
					}
					if((plantType == -1 || !plantKnown) && darkPlantType == -1 && targetName) {
						errors.push("You've never heard of that plant.");
					}
					let plantCount = garden.plants.filter(p => p).length;
					if(plantType != -1 && plantCount >= garden.slots) {
						errors.push("There isn't room to plant anything new in the garden - try `!pick` to take something from it first.");
					}
					if(darkPlantType != -1 && garden.plants.find(p => p.slot == 99)) {
						errors.push("There can only be one dark plant in the garden at a time.");
					}
				}
				break;
			case 'expand':
				// !plant validation rules:
				// - Must not have done any gardening in past hour
				// - Must pick a type
				// - Must not be on a journey
				// - Must not be the Nemesis
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateAnnihilation(errors, player);
					this.validateNotNemesis(errors, player);
					this.validateGardenTime(errors, player);
					this.validateJourney(errors, player);
					if(!targetName) {
						errors.push("Your options are: `!expand growth`, `!expand size`, or `!expand research`.");
					}
					if(glory < 50) {
						errors.push(`**${player.name}** must be at least Rank C to expand the garden.`);
					}
				}
				break;
			case 'water':
				// !plant validation rules:
				// - Must not have done any gardening in past hour
				// - Must be at least one waterable plant
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateAnnihilation(errors, player);
					this.validateNotNemesis(errors, player);
					this.validateGardenTime(errors, player);
					this.validateJourney(errors, player);
					let plantCount = garden.plants.filter(p => p && p.endTime > now).length;
					if(plantCount == 0) {
						errors.push("There aren't any plants that need watering right now.");
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
					this.validateAnnihilation(errors, player);
					this.validateNotNemesis(errors, player);
					this.validateActionTime(errors, player);
					this.validateJourney(errors, player);
				}
				break;
			case 'overdrive':
				// !overdrive validation rules:
				// - Must be registered
				// - Must not be the Nemesis
				// - Must not have done any world actions in past hour
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateAnnihilation(errors, player);
					this.validateNotNemesis(errors, player);
					this.validateActionTime(errors, player);
					this.validateJourney(errors, player);
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
					this.validateAnnihilation(errors, player);
					this.validateNotNemesis(errors, player);
					this.validateActionTime(errors, player);
					this.validateJourney(errors, player);
					if(target) {
						this.validateAnnihilation(errors, target);
						this.validateJourney(errors, target);
						if(glory < 50) {
							errors.push(`**${player.name}** must be at least Rank C to send energy.`);
						}
						if(player.isUnderling && !target.isNemesis) {
							errors.push('A underling can only send energy to the Nemesis.');
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
				if (!player) {
					break;
				}
				this.validateAnnihilation(errors, player);
				this.validateNotNemesis(errors, player);
				this.validateJourney(errors, player);
				if(args.length == 1) {
					errors.push('Must include a fusion name.');
				}
				if(args.length > 2) {
					errors.push('Fusion Name must not contain spaces.');
				}
				if(player.fusionFlag) {
					errors.push(`**${player.name} can't fuse again until the game resets.`);
				}
				let defeated = player.status.find(s => s.type == enums.Statuses.Dead);
				if(defeated) {
					let timeString = tools.getTimeString(defeated.endTime - now);
					errors.push(`**${player.name}** cannot fuse for another ${timeString}.`);
				}
				if(glory < 100) {
					errors.push(`**${player.name}** must be at least Rank B to use Fusion.`);
				}
				if(target) {
					this.validateAnnihilation(errors, target);
					this.validateJourney(errors, target);
					this.validateNotNpc(errors, target);
					if(target.fusionFlag) {
						errors.push(`**${target.name} can't fuse again until the game resets.`);
					}
					if(player.name == target.name) {
						errors.push("You can't fuse with yourself!");
					} else {
						let targetDefeated = target.status.find(s => s.type == enums.Statuses.Dead);
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
						if(player.isUnderling || target.isUnderling) {
							errors.push("Servants of the Nemesis cannot fuse.");
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
					this.validateAnnihilation(errors, player);
					this.validateJourney(errors, player);
					let cooldown = world.cooldowns.find(c => c.type == enums.Cooldowns.NextNemesis);
					if(cooldown) {
						let timeString = tools.getTimeString(cooldown.endTime - now);
						errors.push(`A new Nemesis won't rise for at least ${timeString}.`);
					}
					if(player.isNemesis) {
						errors.push(`**${player.name}** is already a Nemesis.`);
					}
					if(player.nemesisFlag) {
						errors.push(`**${player.name}** cannot become a Nemesis again.`);
					}
					let defeated = player.status.find(s => s.type == enums.Statuses.Dead);
					if(defeated) {
						let timeString = tools.getTimeString(defeated.endTime - now);
						errors.push(`**${player.name}** cannot become a Nemesis for another ${timeString}.`);
					}
					if(tools.isFusion(player)) {
						errors.push("A fusion can't become a Nemesis.");
					}
					if(glory < 250) {
						errors.push(`**${player.name}** must be at least Rank S to become a Nemesis.`);
					}
					if(world.lostOrbs < 5) {
						errors.push(`The power of the orbs is preventing the rise of a new Nemesis.`)
					}
				}
				break;
			case 'scan':
				// !scan validation
				// - Must specify a valid target
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateAnnihilation(errors, player);
					this.validateNotNemesis(errors, player);
					if(target) {
						this.validateAnnihilation(errors, target);
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
					this.validateAnnihilation(errors, player);
					this.validateJourney(errors, player);
					if(args.length == 0) {
						errors.push('Enter `!help wish` for more information.');
					}
					let orbs = player.items.find(i => i.type == enums.Items.Orb);
					let orbCount = orbs ? orbs.count : 0;
					if(player.isNemesis) {
						const underlings = await sql.getUnderlings(channel);
						for(const underling of underlings) {
							const underlingPlayer = await sql.getPlayerById(underling.id);
							if(underlingPlayer) {
								const underlingOrbs = underlingPlayer.items.find(i => i.type == enums.Items.Orb);
								if(underlingOrbs) {
									orbCount += underlingOrbs.count;
								}
							}
						}
					}
					if(orbCount < 7) {
						errors.push('Insufficient orbs.');
					}
					if(player.wishFlag) {
						errors.push("You can only wish upon the orbs once per season.");
					}
					if(player.fusionFlag) {
						errors.push("Fusions can't wish.");
					}
					if(args.length > 0) {
						let wish = args[0].toLowerCase();
						switch(wish) {
							case 'power':
							case 'immortality':
							case 'gardening':
							case 'resurrection':
								if(player.isNemesis) {
									errors.push("The Nemesis can't wish for that.");
								}
								break;
							case 'ruin':
							case 'snap':
								if(!player.isNemesis) {
									errors.push('Only the Nemesis can wish for that.');
								}
								if(glory < 400) {
									errors.push('Requires Rank S+.');
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
				if(player) {
					this.validateAnnihilation(errors, player);
					const offers = await sql.getOutgoingOffers(player.id);
					if((player.isNemesis || player.status.find(s => s.type == enums.Statuses.Berserk)) &&
						!offers.find(o => o.type == enums.OfferTypes.Taunt)) {
						errors.push("You can't stop fighting!");
					}
				}
				break;
			case 'give':
				// !give validation
				// - Must be registered
				// - Target must exist
				// - Target must be alive
				// - Target must not be you
				// - Must have at least one orb
				// - Must have used up your wish, or must be an underling
				// - If underling, target must be nemesis
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateAnnihilation(errors, player);
					this.validateJourney(errors, player);
					if(!player.items.find(i => i.type == enums.Items.Orb)) {
						errors.push("You don't have any orbs to give!");
					}
					if(target) {
						this.validateAnnihilation(errors, target);
						this.validateJourney(errors, target);
						if(player.name == target.name) {
							errors.push("You can't give yourself orbs!");
						}
						let targetDefeated = target.status.find(s => s.type == enums.Statuses.Dead);
						if(targetDefeated) {
							let timeString = tools.getTimeString(targetDefeated.endTime - now);
							errors.push(`**${target.name}** cannot take orbs for another ${timeString}`);
						}
						if(!player.isUnderling && !player.wishFlag) {
							errors.push('In order to give orbs, you must either be an underling or have already used up your wish.');
						}
						if(player.isUnderling && !target.isNemesis) {
							errors.push('A underling can only give orbs to the Nemesis.');
						}
						if(target.wishFlag) {
							errors.push("That person doesn't need any orbs.");
						}
					} else {
						errors.push('Must specify a valid target.');
					}
				}
				break;
			case 'history':
				// !history validation
				// - Must be registered
				// - Must specify a valid target
				this.validatePlayerRegistered(errors, player);
				if(player && targetName && !target) {
					errors.push('Must specify a valid target.');
				}
				break;
			case 'recruit':
				// !recruit validation
				// - Must be registered
				// - Must be the Nemesis
				// - Must not be capped out on underlings
				// - Target must exist and not be you
				// - Target must not already be an underling
				this.validatePlayerRegistered(errors, player);
				this.validateNemesis(errors, player);
				if(target) {
					this.validateAnnihilation(errors, target);
					this.validateJourney(errors, target);
					this.validateNotNpc(errors, target);
					let underlings = await sql.getUnderlings(channel);
					let maxUnderlings = Math.floor(world.maxPopulation / 5) - 1;
					if(underlings.length >= maxUnderlings) {
						errors.push("You can't recruit more underlings.");
					}
					if(target.isUnderling) {
						errors.push(`${target.name} already works for you.`);
					}
					if(target.id == player.id) {
						errors.push(`That's not what "be your own boss" means.`);
					}
					if(target.fusionNames.length == 2) {
						errors.push("You can't recruit a fusion.");
					}
					if(target.npc) {
						errors.push("You can't recruit NPCs.");
					}
				}
				break;
			case 'join':
				// !join validation
				// - Must be registered
				// - Offer must be presented
				// - Must not be a Underling
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateAnnihilation(errors, player);
					this.validateJourney(errors, player);
					if(player.isUnderling) {
						errors.push("You already serve the Nemesis.");
					} else {
						if(!player.offers.find(o => o.type == enums.OfferTypes.Recruit)) {
							errors.push("The Nemesis needs to \`!recruit\` you first.");
						}
						let underlings = await sql.getUnderlings(channel);
						let maxUnderlings = Math.floor(world.maxPopulation / 5);
						if(underlings.length >= maxUnderlings) {
							errors.push("The Nemesis already has too many underlings.");
						}
						if(player.fusionNames.length == 2) {
							errors.push("A Fusion can't join the Nemesis.");
						}
					}
				}
				break;
			case 'exile':
				// !exile validation
				// - Must be registered
				// - Must be the Nemesis
				// - Target must exist
				// - Target must be an underling
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateNemesis(errors, player);
					if(target) {
						this.validateAnnihilation(errors, target);
						if(target.id == player.id) {
							errors.push(`The only escape from being the Nemesis is death.`);
						} else {
							if(!target.isUnderling) {
								errors.push(`${target.name} doesn't work for you.`);
							}
						}
					} else {
						errors.push('Must specify a valid target.');
					}
				}
				break;
			case 'energize':
				// !energize validation
				// - Must be registered
				// - Must be the Nemesis
				// - Target must exist
				// - Target must be an underling
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateNemesis(errors, player);
					this.validateJourney(errors, player);
					if(target) {
						this.validateAnnihilation(errors, target);
						this.validateJourney(errors, target);
						if(target.id == player.id) {
							errors.push(`You cannot energize yourself.`);
						} else {
							if(!target.isUnderling) {
								errors.push(`${target.name} doesn't work for you.`);
							}
						}
						const cooldown = player.cooldowns.find(c => c.type == enums.Cooldowns.Energize);
						if(cooldown) {
							let timeString = tools.getTimeString(cooldown.endTime - now);
							errors.push(`**${player.name}** cannot energize an underling for another ${timeString}.`);
						}
					} else {
						errors.push('Must specify a valid target.');
					}
				}
				break;
			case 'revive':
				// !revive validation
				// - Must be registered
				// - Must be the Nemesis
				// - Target must exist
				// - Target must be an underling
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateNemesis(errors, player);
					if(target) {
						this.validateAnnihilation(errors, target);
						this.validateJourney(errors, target);
						if(target.id == player.id) {
							errors.push(`You cannot revive yourself.`);
						} else {
							if(!target.isUnderling) {
								errors.push(`${target.name} doesn't work for you.`);
							}
						}
						if(!target.status.find(s => s.type == enums.Statuses.Dead)) {
							errors.push(`${target.name} doesn't need to be revived right now.`);
						}
						const cooldown = player.cooldowns.find(c => c.type == enums.Cooldowns.Revive);
						if(cooldown) {
							let timeString = tools.getTimeString(cooldown.endTime - now);
							errors.push(`**${player.name}** cannot revive an underling for another ${timeString}.`);
						}
					} else {
						errors.push('Must specify a valid target.');
					}
				}
				break;
			case 'taunt':
				// !taunt validation rules:
				// - Target must exist if specified
				// - Player and Target must be different people
				// - Player and Target must both be alive
				// - Target must not have a received taunt
				// - Player must not have a sent taunt
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateAnnihilation(errors, player);
					this.validateJourney(errors, player);
					let defeated = player.status.find(s => s.type == enums.Statuses.Dead);
					if(defeated) {
						let timeString = tools.getTimeString(defeated.endTime - now);
						errors.push(`**${player.name}** cannot fight for another ${timeString}.`);
					}
					if(target) {
						this.validateAnnihilation(errors, target);
						this.validateJourney(errors, target);
						if(player.name == target.name) {
							errors.push('You cannot taunt yourself!');
						}
						let targetDefeated = target.status.find(s => s.type == enums.Statuses.Dead);
						if(targetDefeated) {
							let timeString = tools.getTimeString(targetDefeated.endTime - now);
							errors.push('**' + target.name + '** cannot fight for another ' + timeString + '.');
						}
						let playerTaunt = player.offers.find(o => o.type == enums.OfferTypes.Taunt);
						let targetTaunt = target.offers.find(o => o.type == enums.OfferTypes.Taunt);
						if(playerTaunt) {
							errors.push('You have already taunted someone.');
						}
						if(targetTaunt) {
							errors.push(`${target.name} has already been taunted.`);
						}
					} else {
						errors.push('Must specify a valid target.');
					}
				}
				break;
			case 'scores':
				// !scores validation rules:
				// - World must have ended
				if(world && world.startTime && world.startTime < now) {
					errors.push('Scores are only available after the season ends.');
				}
				break;
			case 'selfdestruct':
				// !selfdestruct validation rules:
				// - Rank A
				// - Must not be the Nemesis
				// - Must not be on a Journey
				// - Target must be valid
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateAnnihilation(errors, player);
					this.validateNotNemesis(errors, player);
					this.validateJourney(errors, player);
					if(glory < 150) {
						errors.push(`**${player.name}** must be at least Rank A to self-destruct.`);
					}
					let defeated = player.status.find(s => s.type == enums.Statuses.Dead);
					if(defeated) {
						let timeString = tools.getTimeString(defeated.endTime - now);
						errors.push(`**${player.name}** cannot fight for another ${timeString}.`);
					}
					if(target) {
						this.validateAnnihilation(errors, target);
						this.validateJourney(errors, target);
						if(player.name == target.name) {
							errors.push("If you're going to explode, at least take someone else out with you.");
						}
						let targetDefeated = target.status.find(s => s.type == enums.Statuses.Dead);
						if(targetDefeated) {
							let timeString = tools.getTimeString(targetDefeated.endTime - now);
							errors.push(`**${target.name}** cannot fight for another ${timeString}.`);
						}
					} else {
						errors.push(`Must specify a valid target.`);
					}
				}
				break;
			case 'filler':
				// !journey validation rules:
				// - Must be alive
				// - Must have lost a fight since they last stopped training
				// - Must not be training
				this.validatePlayerRegistered(errors, player);
				if(player) {
					this.validateActionTime(errors, player);
					const players = await sql.getPlayers(channel);
					if(players.length < 4) {
						errors.push(`There must be at least four players before filler episodes can begin.`);
					}
				}
				break;
			case 'tournament':
				if(targetName) {
					this.validatePlayerRegistered(errors, player);
					const tournament = await sql.getTournament(channel);
					switch(targetName) {
						case 'single':
						case 'royale':
							const players = await sql.getPlayers(channel);
							if(players.length < 4) {
								errors.push(`You need at least four players for a tournament.`);
							}
							if(glory < 100) {
								errors.push(`**${player.name}** must be at least Rank B to organize a tournament.`);
							}
							break;
						case 'join':
							this.validateNotNemesis(errors, player);
							if(tournament.players.find(p => p.id == player.id)) {
								errors.push("You've already joined this tournament.");
							}
							break;
						case 'start':
							if(tournament.organizerId != player.id) {
								errors.push('Only the organizer can start the tournament.');
							}
							if(tournament.players.length < 4) {
								errors.push(`You need at least four players for a tournament..`);
							}
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
	validateJourney(errors, player) {
		if(player.status.find(s => s.type == enums.Statuses.Journey)) {
			errors.push(`**${player.name}** is away on a journey.`);
		}
	},
	validateAnnihilation(errors, player) {
		if(player.status.find(s => s.type == enums.Statuses.Annihilation)) {
			errors.push(`**${player.name}** no longer exists in this world.`);
		}
	},
	validateNotNpc(errors, player) {
		if(player.npc) {
			errors.push(`That action can't target an NPC.`);
		}
	},
	validateActionTime(errors, player) {
		let now = new Date().getTime();
		const cooldown = player.cooldowns.find(c => c.type == enums.Cooldowns.Action);
		if(cooldown) {
			let timeString = tools.getTimeString(cooldown.endTime - now);
			errors.push(`**${player.name}** cannot act for another ${timeString}.`);
		}
	},
	validateGardenTime(errors, player) {
		const now = new Date().getTime();
		const cooldown = player.cooldowns.find(c => c.type == enums.Cooldowns.Garden);
		if(cooldown) {
			let timeString = tools.getTimeString(cooldown.endTime - now);
			errors.push(`**${player.name}** cannot garden for another ${timeString}.`);
		}
	},
	getPlantType(plantName) {
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
			case 'zlower':
				plantType = 7;
				break;
			case 'zarrot':
				plantType = 8;
				break;
			case 'zedge':
				plantType = 9;
			default:
				plantType = -1;
				break;
		}
		return plantType;
	},
	getDarkPlantType(plantName) {
		if(!plantName) return -1;
		switch(plantName.toLowerCase()) {
			case 'zlower':
				return 7;
			case 'zarrot':
				return 8;
			case 'zedge':
				return 9;
			default:
				return -1;
		}
	}
}
