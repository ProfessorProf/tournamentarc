const Discord = require("discord.js");
const client = new Discord.Client();
const auth = require('../auth.json');
const tools = require('./tools.js');
const validation = require('./validation.js');
const sql = require ('./sql.js');
const help = require('./help.js');

let debugmode = false;
process.argv.forEach((val, index) => {
	if(val == '--debug') {
		debugmode = true;
	}
});
  
client.on('ready', () => {
	console.log(`Logged in as ${client.user.username}!`);

	sql.getChannels().then(async channels => {;
		let now = new Date().getTime();
		if(channels.length > 0) {
			for(let i in channels) {
				let c = channels[i];
				let channel = client.channels.find(x => x.id == c);
				if(channel && channel.name == auth.channel) {
					if(debugmode) {
						channel.send(`Bot in debug mode. Only the admin can use commands.`);
					} else {
						channel.send(`Bot online! Greetings, ${channel.name}.`);
					}

					let world = await sql.getWorld(c);
					let downtime = now - world.lastUpdate
					console.log(`(${c}) Downtime ${tools.getTimeString(downtime)}`);
					if(world && world.lastUpdate && downtime > 5 * 1000 * 60) {
						await sql.fastForward(c, downtime);
						channel.send(`Bot was offline for about ${tools.getTimeString(downtime)}.`);
					}
				}
			}
		}
	});
	
    setInterval(async function() {
		let channels = await sql.getChannels();
		let updatedChannels = [];
		for(let i in channels) {
			let c = channels[i];
			
			let update = await tools.updateWorld(c);
			if(update.embed) {
				updatedChannels.push(c);
				let channel = client.channels.find(x => x.id == c);
				if(channel) {
					channel.send({embed: update.embed});
				} else {
					console.log(`Unrecognized channel ${c}`);
				}
				if(update.pings.length > 0) {
					let pings = update.pings.map(ping => `<@${ping}>`);
					channel.send(pings.join(', '));
				}
			}
		}
		let now = new Date();
		if(updatedChannels.length > 0) {
			console.log(`${now.toLocaleString('en-US')}: Update completed for channels ${updatedChannels.join(', ')}`);
		}
    }, 60000);
});

client.on('disconnect', function(msg, code) {
	let now = new Date();
	console.log(`Disconnected at ${now.toLocaleString("en-US")}`);
	if (code === 0) return console.error(msg);
	bot.connect();
});

client.on('error', (e) => {
	console.log(e);
});

client.on('message', message => {
    // Our bot needs to know if it will execute a command
	// It will listen for messages that will start with `!`
	if(message.author.bot) return;

    if (message.channel.name == auth.channel &&
        message.content.substring(0, 1) == '!') {
		try {
			handleMessage(message);
		} catch (e) {
			console.log(e);
		}
	}
});

async function handleMessage(message) {
	if(debugmode && message.author.username != auth.admin) {
		return;
	}
	let now = new Date().getTime();
	let name = message.author.username;
	let args = message.content.substring(1).split(' ');
	let cmd = args[0].toLowerCase();
	args = args.splice(1);

	let channel = message.channel.id;

	let outputMessage = {
		print: [],
		embed: null,
		private: false,
		informational: false
	};

    if (cmd.substring(0, 1) == '!') {
		outputMessage.private = true;
		cmd = cmd.substring(1);
	}

	if(cmd == 'as' && name == auth.admin && debugmode) {
		name = args[0];
		cmd = args[1].toLowerCase();
		args = args.splice(2);
	}

	if(cmd == 'init' ) {
		message.channel.send('Beginning initialization...');
		await sql.initializeGame()
		await sql.initializeChannel(channel);
		message.channel.send('Initialization complete.');
		let endTime = new Date().getTime();
		let duration = (endTime - now) / 1000;
		console.log(`${channel}: Command "${message.content}" completed for player ${name} in ${duration} seconds`);
		return;
	}
	if(cmd == 'import') {
		message.channel.send(`Importing data...`);
		await tools.import();
		outputMessage.print.push(`Complete`);
	}

	let update = await tools.updateWorld(channel);
	if(update.embed) { 
		message.channel.send({embed: update.embed});
	}
	if(update.abort) return;
	
	let errors = await validation.validate(channel, name, cmd, args);
	if(errors) {
		message.channel.send({embed: {
			title: 'Error',
			description: errors.join('\n')
		}});
		return;
	}
	
	let targetName = args[0];
	switch(cmd) {
		case 'reg':
			// Add a new player
			await tools.registerPlayer(channel, name, message.author.id, targetName);
			outputMessage.embed = await tools.getPlayerDescription(channel, name);
			outputMessage.print.push(`Registered player ${name}!`);
			break;
		case 'check':
			outputMessage.embed = await tools.getPlayerDescription(channel, name);
			outputMessage.informational = true;
			break;
		case 'fight':
			const fightResult = await tools.tryFight(channel, name, targetName);
			outputMessage.embed = fightResult.embed;
			if(fightResult.ping) {
				outputMessage.print.push(`<@${fightResult.ping}>`);
			}
			break;
		case 'unfight':
			outputMessage.print.push(await tools.unfight(channel, name));
			break;
		case 'attack':
			const attackResult = await tools.attack(channel, name, targetName);
			outputMessage.embed = attackResult.embed;
			if(attackResult.ping) {
				outputMessage.print.push(`<@${attackResult.ping}>`);
			}
			break;
		case 'destroy':
			outputMessage.embed = await tools.destroy(channel);
			break;
		case 'burn':
			outputMessage.print.push(await tools.burn(channel, name));
			break;
		case 'recruit':
			outputMessage.print.push(await tools.recruit(channel, targetName));
			break;
		case 'join':
			outputMessage.print.push(await tools.joinNemesis(channel, name));
			break;
		case 'exile':
			outputMessage.print.push(await tools.exile(channel, targetName));
			break;
		case 'energize':
			outputMessage.print.push(await tools.energize(channel, targetName));
			break;
		case 'revive':
			outputMessage.print.push(await tools.revive(channel, targetName));
			break;
		case 'train':
			await tools.train(channel, name);
			outputMessage.print.push(`**${name}** has begun training.`);
			break;
		case 'scan':
			outputMessage.embed = await tools.scoutPlayer(channel, targetName);
			outputMessage.informational = true;
			break;
		case 'reset':
			await tools.resetData(channel);
			outputMessage.print.push('Onwards, to a new universe...! Some Glory is preserved, but all Power Levels and player status has been reverted.');
			break;
		case 'garden':
			outputMessage.embed = await tools.displayGarden(channel);
			outputMessage.informational = true;
			break;
		case 'plant':
			outputMessage.print.push(await tools.plant(channel, name, targetName));
			break;
		case 'water':
			outputMessage.print.push(await tools.water(channel, name));
			break;
		case 'pick':
			outputMessage.print.push(await tools.pick(channel, name, targetName));
			break;
		case 'use':
			outputMessage.print.push(await tools.useItem(channel, name, args[0], args[1]));
			break;
		case 'expand':
			outputMessage.print.push(await tools.expand(channel, name));
			break;
		case 'search':
			outputMessage.print.push(await tools.search(channel, name));
			break;
		case 'roster':
			const output = await tools.displayRoster(channel);
			outputMessage.print.push(`\`\`\`\n${output}\`\`\``);;
			outputMessage.informational = true;
			break;
		case 'fuse':
			const fusionName = args.length > 1 ? args[1] : null;
			const fusionResult = await tools.fuse(channel, name, targetName, fusionName);
			if(fusionResult.message) outputMessage.print.push(fusionResult.message);
			if(fusionResult.embed) outputMessage.embed = fusionResult.embed;
			break;
		case 'nemesis':
			outputMessage.print.push(await tools.setNemesis(channel, name));
			outputMessage.embed = await tools.getPlayerDescription(channel, name);
			break;
		case 'wish':
			outputMessage.print.push(await tools.wish(channel, name, args[0]));
			break;
		case 'research':
			outputMessage.print.push(await tools.research(channel, name));
			break;
		case 'overdrive':
			outputMessage.print.push(await tools.overdrive(channel, name));
			break;
		case 'empower':
			outputMessage.print.push(await tools.empower(channel, name, targetName));
			break;
		case 'give':
			outputMessage.print.push(await tools.give(channel, name, args[0]));
			break;
		case 'history':
			outputMessage.embed = await tools.history(channel, name, targetName);
			outputMessage.informational = true;
			break;
		case 'graveyard':
			outputMessage.embed = await tools.graveyard(channel);
			outputMessage.informational = true;
			break;
		case 'taunt':
			const tauntResult = await tools.taunt(channel, name, targetName);
			outputMessage.embed = tauntResult.embed;
			if(tauntResult.ping) {
				outputMessage.print.push(`<@${tauntResult.ping}>`);
			}
			break;
		case 'config':
			outputMessage.embed = await tools.config(channel, name, args[0], args[1]);
			outputMessage.informational = true;
			break;
		case 'help':
			outputMessage.embed = await help.showHelp(channel, args[0]);
			outputMessage.informational = true;
			break;
		case 'link':
			outputMessage.print.push(await tools.link(channel, name, message.author.id));
			break;
		case 'debug':
			await sql.execute(args[0], args.slice(1).join(' '));
			break;
		case 'clone':
			await sql.clone(channel, name, targetName);
			break;
	}

	if(outputMessage.informational) {
		let player = await sql.getPlayerByUsername(channel, name);
		// Check if the user has AlwaysPrivate enabled
		if(player && player.config && player.config.alwaysPrivate) {
			outputMessage.private = !outputMessage.private;
		}
	}
	// Display the output
	if(outputMessage.embed) {
		if(outputMessage.informational && outputMessage.private) {
			message.author.sendMessage({embed: outputMessage.embed});
		} else {
			message.channel.send({embed: outputMessage.embed});
		}
	}

	for(let i in outputMessage.print) {
		let text = outputMessage.print[i];
		if(outputMessage.informational && outputMessage.private) {
			message.author.sendMessage(text);
		} else {
			message.channel.send(text);
		}
	}
	await sql.playerActivity(channel, name);
	let endTime = new Date();
	let duration = (endTime.getTime() - now) / 1000;
	console.log(`(${channel}) ${endTime.toLocaleString("en-US")}: Command "${message.content}" completed for player ${name} in ${duration} seconds`);
}

client.login(auth.token);
