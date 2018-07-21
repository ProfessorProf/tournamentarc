const Discord = require("discord.js");
const client = new Discord.Client();
const auth = require('../auth.json');
const fs = require('fs');
const tools = require('./tools.js');
const validation = require('./validation.js');
const sql = require ('./sql.js');
const help = require('./help.js');

const hour = (60 * 60 * 1000);
let globalData = {};

client.on('ready', () => {
    console.log(`Logged in as ${client.user.username}!`);
});

client.on('error', (e) => {
	console.log(e);
});

client.on('message', message => {
    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
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

	if(cmd == 'init' ) {
		await sql.initializeGame()
		await sql.initializeChannel(message.channel.id);
		message.channel.send('Initialization complete.');
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
	
	let updateEmbed = await sql.updateWorld(channel);
	if(updateEmbed) message.channel.send({embed: updateEmbed});
	
	let targetName = args[0];
	switch(cmd) {
		case 'reg':
			// Add a new player
			await tools.registerPlayer(channel, name, targetName);
			message.channel.send(`Registered player ${name}!`);
			message.channel.send({embed: await tools.getPlayerDescription(channel, name)});
			break;
		case 'check':
			message.channel.send({embed: await tools.getPlayerDescription(channel, name)});
			break;
		case 'fight':
			message.channel.send({embed: await tools.tryFight(channel, name, targetName)});
			break;
		case 'attack':
			message.channel.send({embed: await tools.attack(channel, name, targetName)});
			break;
		case 'destroy':
			message.channel.send({embed: await tools.destroy(channel)});
			break;
		case 'train':
			await tools.train(channel, name);
			message.channel.send(`**${name}** has begun training.`);
			break;
		case 'scan':
			// Incomplete
			message.channel.send('Scanning...');
			message.channel.send('```\n' + tools.scoutPlayer(data, target) + '```');
			break;
		case 'reset':
			// Incomplete
			resetData();
			message.channel.send('Onwards, to a new universe...! Wins carry over, but all Power Levels and player status has been reverted.');
			break;
		case 'garden':
			// Incomplete
			message.channel.send('```\n' + tools.displayGarden(data) + '```');
			break;
		case 'pick':
			// Incomplete
			if(!player.flowers) player.flowers = 0;
			data.flowers--;
			player.flowers++;
			message.channel.send('**' + name + '** is now carrying ' + player.flowers + (player.flowers > 1 ? ' flowers.' : ' flower.'));				
			break;
		case 'heal':
			// Incomplete
			player.flowers--;
			target.aliveDate -= 6 * hour;
			if(target.aliveDate < now) {
				message.channel.send(`**${name}** heals **${target.name}** back to fighting shape!`);
			} else {
				let timeString = tools.getTimeString(target.aliveDate - now);
				message.channel.send(`**${name}** heals **${target.name}**, but they still won't be able to fight for ${timeString}.`);
			}
			break;
		case 'plant':
			// Incomplete
			player.actionTime = now;
			message.channel.send(tools.plant(data, player));
			break;
		case 'expand':
			// Incomplete
			player.actionTime = now;
			message.channel.send(tools.expand(data, player));
			break;
		case 'search':
			// Incomplete
			player.actionTime = now;
			message.channel.send(tools.search(data, player));
			break;
		case 'roster':
			let output = await tools.displayRoster(channel);
			message.channel.send(`\`\`\`\n${output}\`\`\``);;
			break;
		case 'fuse':
			// Incomplete
			let fusionName = args.length > 1 ? args[1] : null;
			if(player.fuseOffers[target.name] && player.fuseOffers[target.name].expires > now && player.fuseOffers[target.name].fusionName == fusionName) {
				// They've issued you a fusion offer recently - fight them!
				message.channel.send('```\n' + tools.fuse(data, player, target, fusionName) + '```');
			} else {
				// No valid offer was found - send one!
				tools.sendFusionOffer(player, target, fusionName);
				let fuseCommand = '!fuse ' + name;
				if(fusionName) fuseCommand += ' ' + fusionName;
				message.channel.send('**' + name + '** wants to fuse with **' + target.name + '**! ' + target.name + ', enter `' + fuseCommand + '` to accept the offer and fuse.\n' +
					"**Warning**: You can only fuse once per game! Fusion lasts 24 hours before you split again.\n" + 
					'The offer will expire in six hours.');
			}
			break;
		case 'nemesis':
			message.channel.send({embed: await tools.setNemesis(channel, name)});
			message.channel.send({embed: await tools.getPlayerDescription(channel, name)});
			break;
		case 'wish':
			// Incomplete
			message.channel.send('**' + name + '** makes a wish, and the orbs shine with power...!\n' + tools.wish(data, player, args[0]));
			message.channel.send('The magic orbs have been lost once more.');
			break;
		case 'help':
			message.channel.send({embed: await help.showHelp(args[0])});
			break;
		case 'debug':
			await sql.execute(args[0], args.slice(1).join(' '));
			break;
		case 'clone':
			// Delete this before S3 starts
			await sql.clone(channel, name, targetName);
			break;
	}
	let endTime = new Date().getTime();
	let duration = (endTime - now) / 1000;
	console.log(`${message.channel.id}: Command "${message.content}" completed for player ${name}`);
}

function loadData() {
	fs.readdir('./data', function(err, files) {
		for(let i = 0; i < files.length; i++) {
			fs.readFile('./data/' + files[i], 'utf8', function(err, json) {
				if(!err && json) {
					let now = new Date().getTime();
					let data = JSON.parse(json);
					for(let player in data.players) {
						for(let challenge in data.players[player].challenges) {
							if(!data.players[player].challenges[challenge] || data.players[player].challenges[challenge].expires < now) {
								delete data.players[player].challenges[challenge];
							}
							if(!data.players[player].revenge) {
								data.players[player].revenge = {};
							}
						}
					}
					globalData[data.id] = data;
					console.log(`Loaded data for channel ID ${data.id}`);
				}
			});
		}
	});
}

function saveData(data) {
	if(!data) return;
	let json = JSON.stringify(data);
	fs.writeFile(`./data/${data.id}.txt`, json, function(err) {
		if(err) {
			console.log(err);
		}
	});
}

//loadData();

client.login(auth.token);
