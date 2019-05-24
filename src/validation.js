const tools = require('./tools.js');
const sql = require('./sql.js');
const auth = require('../auth.json');
const enums = require('./enum.js');

let hour = (60 * 60 * 1000);

module.exports = {
    // Returns an error string if the command is illegal
    async validate(channel, player, target, cmd, args) {
		let world = await sql.getWorld(channel);
		const tournament = await sql.getTournament(channel);
		let errors = [];
		let now = new Date().getTime();
		if((!world || !world.startTime) &&
			cmd != 'scores' && cmd != 'debug' && cmd != 'season') {
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
				const regName = args[0];
				if(player) {
					errors.push('You have already registered!');
				}
				if(!regName) {
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
			case 'reset':
			case 'debug':
			case 'clone':
			case 'test':
				// !clone validation rules:
				// - Must be admin
				if(player.username != auth.admin) {
					errors.push('Only the game master can use debug commands.');
				}
				break;
			case 'tourney':
			case 'tournament':
				if(args.length > 0) {
					this.validatePlayerRegistered(errors, player);
					switch(args[0]) {
						case 'start':
							if(player.username != auth.admin) {
								errors.push('Only the game master can begin the first tournament.');
							}
							if(tournament && tournament.status == enums.TournamentStatuses.Active) {
								errors.push(`The tournament has already begun.`);
							}
							break;
					}
				}
				break;
			case 'bet':
				let amount = 0;
				if(args.length > 0) {
					this.validatePlayerRegistered(errors, player);
					amount = parseInt(args[1]);
					if(amount != amount || amount < 0) {
						errors.push('Invalid amount of coins.');
					} else if(amount != Math.floor(amount)) {
						errors.push('Amount must be an integer.');
					}
					if(!target) {
						errors.push(`Couldn't find that fighter.`);
					}
					if(args.length == 1) {
						errors.push('Format: `!bet amount fighter`');
					}
				}
				if(tournament) {
					if(tournament.status == enums.TournamentStatuses.Complete) {
						errors.push(`The tournament is already over.`);
					}
					if(target) {
						if(amount > 0 && amount < tournament.round * 10) {
							errors.push(`Minimum bet is ${tournament.round * 10} coins.`);
						}
						if(tournament.status == enums.TournamentStatuses.Active &&
							tournament.nextAttack != tournament.nextMatch) {
							errors.push(`You can't place any bets once the battle has started.`);
						}
						for(let i = 0; i < tournament.fighters.length; i += 2) {
							const leftFighter = tournament.fighters[i];
							const rightFighter = tournament.fighters[i+1];
				
							if(leftFighter && rightFighter) {
								if(leftFighter.status == enums.TournamentFighterStatuses.Pending) {
									// This is the next battle
									if(target.id != leftFighter.id && target.id != rightFighter.id) {
										errors.push(`That fighter isn't participating in the next battle.`);
									}
									break;
								}
							}
						}
					}
				} else {
					errors.push(`There isn't a tournament going on.`);
				}
				break;
			case 'aid':
				if(args.length > 0) {
					this.validatePlayerRegistered(errors, player);
					const amount = parseInt(args[1]);
					if(amount != amount || amount < 0) {
						errors.push('Invalid amount of coins.');
					} else if(amount != Math.floor(amount)) {
						errors.push('Amount must be an integer.');
					}
					if(!target) {
						errors.push(`Couldn't find that fighter.`);
					}
					if(args.length == 1) {
						errors.push('Format: `!aid amount fighter`');
					}
				}
				if(tournament) {
					if(tournament.status == enums.TournamentStatuses.Complete) {
						errors.push(`The tournament is already over.`);
					}
					if(target) {
						if(tournament.status == enums.TournamentStatuses.Active &&
							tournament.nextAttack != tournament.nextMatch) {
							errors.push(`You can't aid while a battle is ongoing.`);
						}
						if(!tournament.fighters.find(f => f.id == target.id)) {
							errors.push(`That fighter isn't in the tournament.`);
						}
					}
				} else {
					errors.push(`There isn't a tournament going on.`);
				}
				break;
			case 'give':
				if(args.length > 0) {
					this.validatePlayerRegistered(errors, player);
					const amount = parseInt(args[1]);
					if(amount != amount || amount < 0) {
						errors.push('Invalid amount of coins.');
					} else if(amount != Math.floor(amount)) {
						errors.push('Amount must be an integer.');
					}
					if(args.length == 1) {
						errors.push('Format: `!give amount player`')
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
	}
}
