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
		const now = new Date().getTime();
		if(channels.length > 0) {
			for(const i in channels) {
				const c = channels[i];
				const channel = client.channels.find(x => x.id == c);
				if(channel && channel.name == auth.channel) {
					if(debugmode) {
						channel.send(`Bot in debug mode. Only the admin can use commands.`);
					} else {
						channel.send(`Bot online! Greetings, ${channel.name}.`);
						let world = await sql.getWorld(c);
						const downtime = now - world.lastUpdate
						console.log(`(${c}) Downtime ${tools.getTimeString(downtime)}`);
						if(world && world.lastUpdate && downtime > 5 * 1000 * 60) {
							await sql.fastForward(c, downtime);
							channel.send(`Bot was offline for about ${tools.getTimeString(downtime)}.`);
						}
					}
				}
			}
		}
	});
	
    setInterval(async function() {
		const channels = await sql.getChannels();
		let updatedChannels = [];
		for(const i in channels) {
			const c = channels[i];
			
			const update = await tools.updateWorld(c);
			if(update.updates) {
				updatedChannels.push(c);
				const channel = client.channels.find(x => x.id == c);
				if(channel) {
					if(channel.name == auth.channel) {
						for(var u of update.updates) {
							channel.send(u);
						}
						if(update.pings) {
							channel.send(pings);
						}
					}
				} else {
					console.log(`Unrecognized channel ${c}`);
				}
			}
		}
		const now = new Date();
		if(updatedChannels.length > 0) {
			console.log(`${now.toLocaleString('en-US')}: Update completed for channels ${updatedChannels.join(', ')}`);
		}
    }, 60000);
});

client.on('disconnect', function(msg, code) {
	const now = new Date();
	console.log(`Disconnected at ${now.toLocaleString("en-US")}`);
	if (code === 0) return console.error(msg);
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
		handleMessage(message).then(() => {}, 
			(err) => {
				let errorMessage = `Error: ${err.message}`;
				if(auth.adminId) errorMessage += ` <@${auth.adminId}>\n The admin has been notified. If possible, try not to touch this feature until they get here.`;
				message.channel.send(errorMessage);
				console.log(err);
			}
		);
	}
});

async function handleMessage(message) {
	if(debugmode && message.author.username != auth.admin) {
		return;
	}
	const now = new Date().getTime();
	let name = message.author.username;
	let args = message.content.substring(1).split(' ');
	let cmd = args[0].toLowerCase();
	args = args.splice(1);

	const channel = message.channel.id;

	let output = {
		messages: [],
		private: false,
		informational: false
	};

    if (cmd.substring(0, 1) == '!') {
		output.private = true;
		cmd = cmd.substring(1);
	}

	if(cmd == 'as' && name == auth.admin && debugmode) {
		name = args[0];
		cmd = args[1].toLowerCase();
		args = args.splice(2);
	}

	if(cmd == 'init' ) {
		message.channel.send('Beginning initialization...');
		try {
		await sql.initializeGame()
		} catch (e) {
			console.log(e);
		}
		await sql.initializeChannel(channel);
		message.channel.send('Initialization complete.');
		const endTime = new Date().getTime();
		const duration = (endTime - now) / 1000;
		console.log(`${channel}: Command "${message.content}" completed for player ${name} in ${duration} seconds`);
		return;
	}

	if(cmd != 'debug') {
		const update = await tools.updateWorld(channel);

		if(update.updates) {
			for(var u of update.updates) {
				message.channel.send(u);
			}
			if(update.pings) {
				message.channel.send(pings);
			}
		}
		
		if(update.abort) return;
	}

	const errors = await validation.validate(channel, name, cmd, args);
	if(errors) {
		message.channel.send({embed: {
			title: 'Error',
			description: errors.join('\n')
		}});
		return;
	}
	
	const targetName = args[0];
	switch(cmd) {
		case 'reg':
			output.messages = await tools.registerPlayer(channel, name, message.author.id, targetName);
			break;
		case 'check':
			output.messages = await tools.getPlayerDescription(channel, name);
			output.informational = true;
			break;
		case 'roster':
			output.messages = await tools.displayRoster(channel);
			output.informational = true;
			break;
		case 'scan':
			output.messages = await tools.scoutPlayer(channel, targetName);
			output.informational = true;
			break;
		case 'fight':
			output.messages = await tools.tryFight(channel, name, targetName);
			break;
		case 'unfight':
			output.messages = await tools.unfight(channel, name);
			break;
		case 'garden':
			output.messages = await tools.displayGarden(channel);
			output.informational = true;
			break;
		case 'plant':
			output.messages = await tools.plant(channel, name, targetName);
			output.informational = true;
			break;
		case 'water':
			output.messages = await tools.water(channel, name);
			break;
		case 'pick':
			output.messages = await tools.pick(channel, name, targetName);
			break;
		case 'use':
			output.messages = await tools.useItem(channel, name, args[0], args[1]);
			break;
		case 'expand':
			output.messages = await tools.expand(channel, name, args[0]);
			break;
		case 'nemesis':
			output.messages = await tools.setNemesis(channel, name);
			break;
		case 'attack':
			output.messages = await tools.attack(channel, name, targetName);
			break;
		case 'destroy':
			output.messages = await tools.destroy(channel);
			break;
		case 'burn':
			output.messages = await tools.burn(channel);
			break;
		case 'recruit':
			output.messages = await tools.recruit(channel, targetName);
			break;
		case 'join':
			output.messages = await tools.joinNemesis(channel, name);
			break;
		case 'exile':
			output.messages = await tools.exile(channel, targetName);
			break;
		case 'energize':
			output.messages = await tools.energize(channel, targetName);
			break;
		case 'revive':
			output.messages = await tools.revive(channel, targetName);
			break;
		case 'train':
			output.messages = await tools.train(channel, name);
			break;
		case 'reset':
			output.messages = await tools.resetData(channel);
			break;
		case 'search':
			output.messages = await tools.search(channel, name);
			break;
		case 'scores':
			output.messages = await tools.displayScores(channel);
			outputMessage.informational = true;
			break;
		case 'fuse':
			output.messages = await tools.fuse(channel, name, targetName, args[1]);
			break;
		case 'wish':
			output.messages = await tools.wish(channel, name, args[0]);
			break;
		case 'research':
			output.messages = await tools.expand(channel, name, 'research');
			break;
		case 'overdrive':
			output.messages = await tools.overdrive(channel, name);
			break;
		case 'empower':
			output.messages = await tools.empower(channel, name, targetName);
			break;
		case 'give':
			output.messages = await tools.give(channel, name, args[0]);
			break;
		case 'history':
			output.messages = await tools.history(channel, name, targetName);
			output.informational = true;
			break;
		case 'graveyard':
			output.messages = await tools.graveyard(channel);
			output.informational = true;
			break;
		case 'world':
			output.messages = await tools.worldInfo(channel);
			output.informational = true;
			break;
		case 'taunt':
			output.messages = await tools.taunt(channel, name, targetName);
			break;
		case 'journey':
			output.messages = await tools.startJourney(channel, name, args[0]);
			break;
		case 'config':
			output.messages = await tools.config(channel, name, args[0], args[1]);
			output.informational = true;
			break;
		case 'help':
			output.messages = await help.showHelp(channel, name, args[0]);
			output.informational = true;
			break;
		case 'debug':
			await sql.execute(args.join(' '));
			break;
		case 'clone':
			await sql.clone(channel, name, targetName);
			break;
		case 'ending':
			outputMessage.print.push(await tools.ending(channel));
			break;
	}

	if(output.informational) {
		let player = await sql.getPlayerByUsername(channel, name);
		// Check if the user has AlwaysPrivate enabled
		if(player && player.config && player.config.AlwaysPrivate) {
			output.private = !output.private;
		}
	}
	// Display the output
	if(output.messages && !Array.isArray(output.messages)) {
		output.messages = [output.messages];
	}
	if(output.messages && output.messages.length > 0) {
		for(const i in output.messages) {
			const m = output.messages[i];
			if(m) {
				if(output.informational && output.private) {
					message.author.send(m);
				} else {
					message.channel.send(m);
				}
			}
		}
	}
	await sql.playerActivity(channel, name);
	const endTime = new Date();
	const duration = (endTime.getTime() - now) / 1000;
	console.log(`(${channel}) ${endTime.toLocaleString("en-US")}: Command "${message.content}" completed for player ${name} in ${duration} seconds`);
}

client.login(auth.token);
