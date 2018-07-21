const Discord = require("discord.js");
const client = new Discord.Client();
const auth = require('./auth.json');
const fs = require('fs');
const tools = require('./tools.js');
const validation = require('./validation.js');
const sql = require ('./sql.js');
const help = require('./help.js');

const hour = (60 * 60 * 1000);
var globalData = {};

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
		var startTime = new Date().getTime();
		var name = message.author.username;
		var args = message.content.substring(1).split(' ');
		var cmd = args[0].toLowerCase();
		args = args.splice(1);

		var channel = message.channel.id;

		if(cmd == 'init' ) {
			sql.initializeGame(() => sql.initializeChannel(message.channel.id, () => {
				message.channel.send('Initialization complete.');
			}));
			return;
		}
		validation.validate(channel, name, cmd, args, errors => {
			if(errors) {
				message.channel.send({embed: {
					title: 'Error',
					description: errors.join('\n')
				}});
				return;
			}
			
			sql.updateWorld(channel, update => {
				if(update) message.channel.send({embed: update});
				
				var targetName = args[0];
				switch(cmd) {
					case 'reg':
						// Add a new player
						player = tools.registerPlayer(channel, name, targetName, () => {
							message.channel.send(`Registered player ${name}!`);
							tools.getPlayerDescription(channel, name, embed => {
								message.channel.send({embed: embed});
							});
						});
						break;
					case 'check':
						tools.getPlayerDescription(channel, name, embed => {
							message.channel.send({embed: embed});
						});
						break;
					case 'fight':
						tools.tryFight(channel, name, targetName, embed => {
							message.channel.send({embed: embed});
						});
						break;
					case 'attack':
						tools.attack(channel, name, targetName, embed => {
							message.channel.send({embed: embed});
						});
						break;
					case 'destroy':
						tools.destroy(channel, embed => {
							message.channel.send({embed: embed});
						});
						break;
					case 'train':
						player.trainingState = 2;
						player.trainingDate = startTime;
						message.channel.send(`**${name}** has begun training.`);
						break;
					case 'scan':
						message.channel.send('Scanning...');
						message.channel.send('```\n' + tools.scoutPlayer(data, target) + '```');
						break;
					case 'reset':
						resetData();
						message.channel.send('Onwards, to a new universe...! Wins carry over, but all Power Levels and player status has been reverted.');
						break;
					case 'garden':
						message.channel.send('```\n' + tools.displayGarden(data) + '```');
						break;
					case 'pick':
						if(!player.flowers) player.flowers = 0;
						data.flowers--;
						player.flowers++;
						message.channel.send('**' + name + '** is now carrying ' + player.flowers + (player.flowers > 1 ? ' flowers.' : ' flower.'));				
						break;
					case 'heal':
						player.flowers--;
						target.aliveDate -= 6 * hour;
						if(target.aliveDate < startTime) {
							message.channel.send(`**${name}** heals **${target.name}** back to fighting shape!`);
						} else {
							var timeString = tools.getTimeString(target.aliveDate - startTime);
							message.channel.send(`**${name}** heals **${target.name}**, but they still won't be able to fight for ${timeString}.`);
						}
						break;
					case 'plant':
						var now = startTime;
						player.actionTime = now;
						message.channel.send(tools.plant(data, player));
						break;
					case 'expand':
						var now = startTime;
						player.actionTime = now;
						message.channel.send(tools.expand(data, player));
						break;
					case 'search':
						var now = startTime;
						player.actionTime = now;
						message.channel.send(tools.search(data, player));
						break;
					case 'roster':
						tools.displayRoster(channel, output => {
							message.channel.send(`\`\`\`\n${output}\`\`\``);
						});
						break;
					case 'fuse':
						var fusionName = args.length > 1 ? args[1] : null;
						if(player.fuseOffers[target.name] && player.fuseOffers[target.name].expires > startTime && player.fuseOffers[target.name].fusionName == fusionName) {
							// They've issued you a fusion offer recently - fight them!
							message.channel.send('```\n' + tools.fuse(data, player, target, fusionName) + '```');
						} else {
							// No valid offer was found - send one!
							tools.sendFusionOffer(player, target, fusionName);
							var fuseCommand = '!fuse ' + name;
							if(fusionName) fuseCommand += ' ' + fusionName;
							message.channel.send('**' + name + '** wants to fuse with **' + target.name + '**! ' + target.name + ', enter `' + fuseCommand + '` to accept the offer and fuse.\n' +
								"**Warning**: You can only fuse once per game! Fusion lasts 24 hours before you split again.\n" + 
								'The offer will expire in six hours.');
						}
						break;
					case 'nemesis':
						tools.setNemesis(channel, name, embed => {
							message.channel.send({embed: embed});
							tools.getPlayerDescription(channel, name, embed => {
								message.channel.send({embed: embed});
							});
						});
						break;
					case 'wish':
						message.channel.send('**' + name + '** makes a wish, and the orbs shine with power...!\n' + tools.wish(data, player, args[0]));
						message.channel.send('The magic orbs have been lost once more.');
						break;
					case 'help':
						message.channel.send({embed: help.showHelp(args[0])});
						break;
					case 'debug':
						console.log(1);
						sql.execute(args[0], args.slice(1).join(' '));
						break;
				}
				var endTime = new Date().getTime();
				var duration = (endTime - startTime) / 1000;
				console.log(`${message.channel.id}: Command "${message.content}" completed for player ${name}`);
			});
		});
    }
});

function loadData() {
	fs.readdir('./data', function(err, files) {
		for(var i = 0; i < files.length; i++) {
			fs.readFile('./data/' + files[i], 'utf8', function(err, json) {
				if(!err && json) {
					var now = new Date().getTime();
					var data = JSON.parse(json);
					for(var player in data.players) {
						for(var challenge in data.players[player].challenges) {
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
	var json = JSON.stringify(data);
	fs.writeFile(`./data/${data.id}.txt`, json, function(err) {
		if(err) {
			console.log(err);
		}
	});
}

//loadData();

client.login(auth.token);
