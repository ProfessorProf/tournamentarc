const Discord = require("discord.js");
const client = new Discord.Client();
const auth = require('../auth.json');
const tools = require('./tools.js');
const validation = require('./validation.js');
const sql = require ('./sql.js');
const help = require('./help.js');

client.on('ready', () => {
	console.log(`Logged in as ${client.user.username}!`);

	sql.getChannels().then(channels => {;
		if(channels.length > 0) {
			for(let i in channels) {
				let c = channels[i];
				let channel = client.channels.find(x => x.id == c);
				channel.send(`Bot online! Greetings, ${channel.name}.`);
			}
		}
	});
	
    setInterval(async function() {
		let channels = await sql.getChannels();
		for(let i in channels) {
			let c = channels[i];
			
			let update = await tools.updateWorld(c);
			if(update.embed) {
				console.log(update.embed);
				let channel = client.channels.find(x => x.id == c);
				channel.send({embed: update.embed});
			} else {
				console.log('Nothing to report');
			}
		}
    }, 60000);
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

	if(cmd == 'as' && name == auth.admin) {
		name = args[0];
		cmd = args[1].toLowerCase();
		args = args.splice(2);
	}

	if(cmd == 'init' ) {
		message.channel.send('Beginning initialization...');
		await sql.initializeGame()
		await sql.initializeChannel(message.channel.id);
		message.channel.send('Initialization complete.');
		let endTime = new Date().getTime();
		let duration = (endTime - now) / 1000;
		console.log(`${message.channel.id}: Command "${message.content}" completed for player ${name} in ${duration} seconds`);
		return;
	}

	let errors = await validation.validate(channel, name, cmd, args);
	if(errors) {
		message.channel.send({embed: {
			title: 'Error',
			description: errors.join('\n')
		}});
		return;
	}
	
	let update = await tools.updateWorld(channel);
	if(update.embed) { 
		message.channel.send({embed: update.embed});
	}
	if(update.abort) return;
	
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
			const result = await tools.tryFight(channel, name, targetName);
			outputMessage.embed = result.embed;
			if(result.ping) {
				outputMessage.print.push(`<@${result.ping}>`);
			}
			break;
		case 'unfight':
			outputMessage.print.push(await tools.unfight(channel, name));
			break;
		case 'attack':
			outputMessage.embed = await tools.attack(channel, name, targetName);
			break;
		case 'destroy':
			outputMessage.embed = await tools.destroy(channel);
			break;
		case 'burn':
			// TODO
			break;
		case 'recruit':
			// TODO
			break;
		case 'join':
			// TODO
			break;
		case 'banish':
			// TODO
			break;
		case 'energize':
			// TODO
			break;
		case 'revive':
			// TODO
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
			output.informational = true;
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
			// TODO
			break;
		case 'empower':
			outputMessage.print.push(await tools.empower(channel, name, targetName));
			break;
		case 'give':
			outputMessage.print.push(await tools.give(channel, name, args[0]));
			break;
		case 'journey':
			// TODO
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
			// TODO
			break;
		case 'config':
			outputMessage.embed = await tools.config(channel, name, args[0], args[1]);
			outputMessage.informational = true;
			break;
		case 'help':
			outputMessage.embed = await help.showHelp(channel, args[0]);
			outputMessage.informational = true;
			break;
		case 'debug':
			await sql.execute(args[0], args.slice(1).join(' '));
			break;
		case 'clone':
			// Delete this before S3 starts
			await sql.clone(channel, name, targetName);
			break;
		case 'autofight':
			// Delete this before S3 starts
			await sql.autofight(channel, targetName);
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
	let endTime = new Date().getTime();
	let duration = (endTime - now) / 1000;
	console.log(`${message.channel.id}: Command "${message.content}" completed for player ${name} in ${duration} seconds`);
}

client.login(auth.token);
