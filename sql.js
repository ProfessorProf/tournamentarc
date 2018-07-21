const sql = require ('sqlite');
const uuid = require('uuid/v4');
const Discord = require('discord.js');
sql.open('./data.sqlite');

const hour = (60 * 60 * 1000);

const initTablesSql = `
CREATE TABLE IF NOT EXISTS Worlds (Channel TEXT, Heat REAL, Resets INTEGER, Max_Population INTEGER);
CREATE TABLE IF NOT EXISTS Players (ID INTEGER, Username TEXT, Name TEXT, Channel TEXT, Power_Level REAL, Fusion_ID INTEGER,
    Action_Level REAL, Action_Time INTEGER, Garden_Level REAL, Garden_Time INTEGER, Glory INTEGER,
    Life_Time INTEGER, Active_Time INTEGER, Nemesis_Flag INTEGER, Fusion_Flag INTEGER, Wish_Flag INTEGER, 
    NPC_Flag INTEGER, AlwaysPrivate_Flag INTEGER, Ping_Flag INTEGER, Pronoun INTEGER);
CREATE TABLE IF NOT EXISTS PlayerStatus (ID TEXT, Channel TEXT, Player_ID INTEGER, Status_ID INTEGER, StartTime INTEGER, EndTime INTEGER);
CREATE TABLE IF NOT EXISTS Statuses (ID INTEGER, Name TEXT, Ends INTEGER, Priority INTEGER);
CREATE TABLE IF NOT EXISTS HeldItems (Channel TEXT, Player_ID INTEGER, Item_ID INTEGER, Count INTEGER);
CREATE TABLE IF NOT EXISTS Items (ID TEXT, Channel TEXT, Type_Name TEXT, Known_Flag INTEGER, Plant_Flag INTEGER, Grow_Time INTEGER);
CREATE TABLE IF NOT EXISTS Offers (ID INTEGER, Channel TEXT, Player_ID INTEGER, Target_ID INTEGER, Type INTEGER, Expires INTEGER);
CREATE TABLE IF NOT EXISTS Gardens (Channel TEXT, Plant1_ID INTEGER, Plant2_ID INTEGER, Plant3_ID INTEGER,
    Garden_Level REAL, Reseach_Level REAL);
CREATE TABLE IF NOT EXISTS Plants (ID INTEGER, Channel TEXT, Plant_Type INTEGER, Grow_Time INTEGER);
CREATE TABLE IF NOT EXISTS Nemesis (Channel TEXT, Player_ID INTEGER, Nemesis_Type INTEGER, Nemesis_Time INTEGER, Attack_Time INTEGER, 
    Destroy_Time INTEGER, Revive_Time INTEGER, Base_Power REAL, Nemesis_Cooldown INTEGER);
CREATE TABLE IF NOT EXISTS Underlings (Channel TEXT, Player_ID INTEGER);
CREATE TABLE IF NOT EXISTS History (Channel TEXT, Battle_Time INTEGER, Winner_ID INTEGER, Loser_ID INTEGER,
    Winner_Rating REAL, Loser_Rating REAL,
    Winner_Skill REAL, Loser_Skill REAL);
CREATE TABLE IF NOT EXISTS Tournaments (Channel TEXT, Organizer_ID INTEGER, Status INTEGER, Type INTEGER, 
    Round INTEGER, Round_Time INTEGER, Next_Tournament_Time INTEGER);
CREATE TABLE IF NOT EXISTS TournamentPlayers (Channel TEXT, Player_ID INTEGER);
CREATE TABLE IF NOT EXISTS TournamentMatches (ID INTEGER, Left_Parent_ID INTEGER, Right_Parent_ID INTEGER, 
    Left_Player_ID INTEGER, Right_Player_ID INTEGER)
`

const initIndicesSql = `
CREATE UNIQUE INDEX IF NOT EXISTS Worlds_Channel ON Worlds(Channel);
CREATE UNIQUE INDEX IF NOT EXISTS Players_ID ON Players(ID); 
CREATE UNIQUE INDEX IF NOT EXISTS PlayerStatus_ChannelPlayerStatus ON PlayerStatus(Channel, Player_ID, Status_ID);
CREATE UNIQUE INDEX IF NOT EXISTS Statuses_ID ON Statuses(ID);
CREATE UNIQUE INDEX IF NOT EXISTS HeldItems_ChannelPlayerItem ON HeldItems(Channel, Player_ID, Item_ID);
CREATE UNIQUE INDEX IF NOT EXISTS Items_IDChannel ON Items(ID, Channel);
CREATE UNIQUE INDEX IF NOT EXISTS Offers_ChannelPlayerTargetType ON Offers(Channel, Player_ID, Target_ID, Type);
CREATE UNIQUE INDEX IF NOT EXISTS Gardens_Channel ON Gardens(Channel);
CREATE UNIQUE INDEX IF NOT EXISTS Plants_ID ON Plants(ID);
CREATE UNIQUE INDEX IF NOT EXISTS Nemesis_Channel ON Nemesis(Channel);
CREATE UNIQUE INDEX IF NOT EXISTS Underlings_ChannelPlayer ON Underlings(Channel, Player_ID);
CREATE UNIQUE INDEX IF NOT EXISTS Tournaments_Channel ON Tournaments(Channel);
CREATE UNIQUE INDEX IF NOT EXISTS TournamentPlayers_ChannelPlayer ON TournamentPlayers(Channel, Player_ID)
`

var newChannelSql = `DELETE FROM Worlds WHERE Channel = $channel;
DELETE FROM Gardens WHERE Channel = $channel;
DELETE FROM Items WHERE Channel = $channel;
INSERT OR REPLACE INTO Worlds (Channel, Heat, Resets, Max_Population) VALUES ($channel, 0, 0, 0);
INSERT OR REPLACE INTO Items (ID, Channel, Type_Name, Grow_Time, Known_Flag) VALUES (0, $channel, "Orb", 0, 0);
INSERT OR REPLACE INTO Items (ID, Channel, Type_Name, Grow_Time, Known_Flag) VALUES (1, $channel, "Flower", 18, 1);
INSERT OR REPLACE INTO Items (ID, Channel, Type_Name, Grow_Time, Known_Flag) VALUES (2, $channel, "Rose", 24, 0);
INSERT OR REPLACE INTO Items (ID, Channel, Type_Name, Grow_Time, Known_Flag) VALUES (3, $channel, "Carrot", 12, 0);
INSERT OR REPLACE INTO Items (ID, Channel, Type_Name, Grow_Time, Known_Flag) VALUES (4, $channel, "Bean", 18, 0);
INSERT OR REPLACE INTO Items (ID, Channel, Type_Name, Grow_Time, Known_Flag) VALUES (5, $channel, "Algae", 6, 0);
INSERT OR REPLACE INTO Items (ID, Channel, Type_Name, Grow_Time, Known_Flag) VALUES (6, $channel, "Fern", 12, 0);
INSERT OR REPLACE INTO Statuses (ID, Name, Ends, Priority) VALUES (0, "Dead", 1, 600);
INSERT OR REPLACE INTO Statuses (ID, Name, Ends, Priority) VALUES (1, "Journey", 1, 500);
INSERT OR REPLACE INTO Statuses (ID, Name, Ends, Priority) VALUES (2, "Training", 0, 400);
INSERT OR REPLACE INTO Statuses (ID, Name, Ends, Priority) VALUES (3, "Energized", 1, 300);
INSERT OR REPLACE INTO Statuses (ID, Name, Ends, Priority) VALUES (4, "Overdrive", 1, 200);
INSERT OR REPLACE INTO Statuses (ID, Name, Ends, Priority) VALUES (5, "Ready", 0, 100);
INSERT OR REPLACE INTO Statuses (ID, Name, Ends, Priority) VALUES (6, "Carrot", 1, 0);
INSERT OR REPLACE INTO Statuses (ID, Name, Ends, Priority) VALUES (7, "Bean", 1, 0);
INSERT OR REPLACE INTO Statuses (ID, Name, Ends, Priority) VALUES (8, "Fern", 1, 0);
INSERT OR REPLACE INTO Statuses (ID, Name, Ends, Priority) VALUES (9, "Fused", 1, 0);
INSERT OR REPLACE INTO Statuses (ID, Name, Ends, Priority) VALUES (10, "PowerWish", 0, 0);
INSERT OR REPLACE INTO Statuses (ID, Name, Ends, Priority) VALUES (11, "ImmortalityWish", 0, 0);
INSERT OR REPLACE INTO Gardens (Channel) VALUES ($channel)`;

var updatePlayerSql = `UPDATE Players SET
    Username = $username, 
    Name = $name,
    Channel = $channel,
    Power_Level = $powerLevel,
    Garden_Level = $gardenLevel,
    Action_Level = $actionLevel,
    Action_Time = $actionTime,
    Garden_Level = $gardenLevel,
    Garden_Time = $gardenTime,
    Glory = $glory,
    Life_Time = $lifeTime,
    Active_Time = $activeTime,
    Nemesis_Flag = $nemesisFlag,
    Fusion_Flag = $fusionFlag,
    Wish_Flag = $wishFlag,
    NPC_Flag = $npcFlag,
    AlwaysPrivate_Flag = $alwaysPrivateFlag,
    Ping_Flag = $pingFlag,
    Pronoun = $pronoun
WHERE ID = $id`;

var insertPlayerSql = `INSERT INTO Players (ID, Username, Name, Channel, Power_Level,
Action_Level, Action_Time, Garden_Level, Garden_Time, Glory, Life_Time, Active_Time, 
Nemesis_Flag, Fusion_Flag, Wish_Flag, NPC_Flag, AlwaysPrivate_Flag, Ping_Flag, Pronoun) 
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

var updateNemesisSql = `INSERT OR REPLACE INTO Nemesis 
(Channel, Player_ID, Nemesis_Type, Nemesis_Time, Attack_Time, Destroy_Time, Revive_Time, Base_Power, Nemesis_Cooldown)
VALUES ($channel, $playerId, $type, $startTime, $attackTime, $destroyTime, $reviveTime, $basePower, $cooldown)`;

module.exports = {
	// Sets up tables and such for an empty DB.
    initializeGame(callback) {
        var tableQueries = initTablesSql.split(';');
        Promise.all(tableQueries.map(q => sql.run(q))).then(() => {
            var indexQueries = initIndicesSql.split(';');
            Promise.all(indexQueries.map(q => sql.run(q))).then(() => {
                console.log('SQL database initialized');
                callback();
            });
        });
	},
	// Sets up basic Status/Item/Garden info for a new channel.
    initializeChannel(channel, callback) {
        var queries = newChannelSql.split(';');
        Promise.all(queries.map(q => {
            if(q.indexOf('$channel') > -1) {
                sql.run(q, {$channel: channel});
            } else {
                sql.run(q);
            }
        })).then(() => {
            console.log(`Channel ${channel} initialized`);
			callback();
        });
	},
	// Debug commands to run arbitrary SQL. Be careful, admin.
    execute(type, command) {
        switch(type) {
        case 'get':
            sql.get(command).then((row) => {
                console.log(row);
            });
            break;
        case 'all':
            sql.all(command).then((row) => {
                console.log(row);
            });
            break;
        case 'run':
            sql.run(command).then(() => {
                console.log('Executed: ' + command);
            });
            break;
        }
	},
	// Fetches basic world data.
	getWorld(channel, callback) {
		sql.get(`SELECT * FROM Worlds WHERE Channel = $channel`, {$channel: channel}).then(row => {
			if(row) {
				var world = {
					channel: channel,
					heat: row.Heat,
					resets: row.Resets,
					maxPopulation: row.Max_Population
				};
				
				callback(world);
			} else {
				callback(null);
			}
		});
	},
	// Creates a new player in the DB.
    addPlayer(player, callback) {
        sql.get("SELECT COUNT(*) AS PlayerCount FROM Players").then(row => {
            var id = row.PlayerCount + 1;
            sql.run(insertPlayerSql,
                [id, player.username, player.name, player.channel, player.level,
                    player.actionLevel, player.actionTime, player.gardenLevel, player.gardenTime, 
                    player.glory, player.aliveTime, player.lastActive,
                    player.nemesisFlag, player.fusionFlag, player.wishFlag, player.npcFlag, 
                    player.config.alwaysPrivate, player.config.ping, player.config.pronoun])
            .then(callback);
        });
	},
	// Updates a player's attributes.
    setPlayer(player, callback) {
        // Update a player in the DB
        sql.run(updatePlayerSql, {
            $id: player.id,
            $username: player.username,
            $name: player.name,
            $channel: player.channel,
            $powerLevel: player.level,
            $gardenLevel: player.gardenLevel,
            $actionLevel: player.actionLevel,
            $gardenTime: player.gardenTime,
            $actionTime: player.actionTime,
            $glory: player.glory,
            $lifeTime: player.aliveTime,
            $activeTime: player.lastActive,
            $nemesisFlag: player.nemesisFlag ? 1 : 0,
            $fusionFlag: player.fusionFlag ? 1 : 0,
            $wishFlag: player.wishFlag ? 1 : 0,
            $npcFlag: player.npcFlag ? 1 : 0,
            $alwaysPrivateFlag: player.config.alwaysPrivate ? 1 : 0,
            $pingFlag: player.config.ping ? 1 : 0,
            $pronoun: player.config.pronoun
        }).then(callback);
	},
	// Fetches a player from the database by character name.
    getPlayer(channel, name, callback) {
		if(!name) {
			callback(null);
			return;
		}
        // Exact name match
        sql.get(`SELECT * FROM Players p WHERE UPPER(p.name) = $name`, {$name: name.toUpperCase()}).then(row1 => {
            if(row1) {
                this.fusionCheck(row1, callback);
            } else {
                // Starts With name match
				sql.get(`SELECT * FROM Players p WHERE UPPER(p.name) LIKE ($namePattern)`, {$namePattern: name.toUpperCase() + '%'}).then(row2 => {
					if(row2) {
						this.fusionCheck(row2, callback);
					} else {
						// Contains name match
						sql.get(`SELECT * FROM Players p WHERE UPPER(p.name) LIKE ($namePattern)`, {$namePattern: '%' + name.toUpperCase() + '%'}).then(row3 => {
							if(row3) {
								this.fusionCheck(row3, callback);
							} else {
								callback(null);
							}
						});
					}
				});
            }
        });
    },
	// Fetches a player from the database by user name.
    getPlayerByUsername(channel, name, callback) {
        // Get a player by username
        sql.get(`SELECT * FROM Players WHERE Channel = $channel AND username = $username`, {$channel: channel, $username: name}).then(row => {
            if(row) {
                this.fusionCheck(row, callback);
            } else {
				callback(null);
            }
        });
    },
	// Fetches a player from the database by player ID.
    getPlayerById(id, callback) {
        sql.get(`SELECT * FROM Players p WHERE p.ID = $id`, {$id: id}).then(row => {
            if(row) {
                this.getPlayerInternal(row, callback);
            } else {
				callback(null);
			}
        });
    },
	// If the player has a fusion ID, load the fusion instead of the base player.
	fusionCheck(row, callback) {
		if(row.Fusion_ID && row.Fusion_ID != row.ID) {
			this.getPlayerById(row.Fusion_ID, callback);
		} else {
			this.getPlayerInternal(row, callback);
		}
	},
	// Add Offers, Statuses and Items to a player and return it as a player object.
    getPlayerInternal(row, callback) {
        sql.all(`SELECT o.*, p.Name FROM Offers o 
                 LEFT JOIN Players p ON o.Player_ID = p.ID
                 WHERE o.Target_ID = $id OR o.Target_ID IS NULL AND o.Player_ID <> $id`, {$id: row.ID}).then(offerRows => {
            sql.all(`SELECT ps.*, s.Ends, s.Priority, s.Name FROM PlayerStatus ps
                     LEFT JOIN Statuses s ON s.ID = ps.Status_Id
                     WHERE Player_ID = $id`, {$id: row.ID}).then(statusRows => {
                sql.all(`SELECT hi.*, i.Type_Name FROM HeldItems hi
						 LEFT JOIN Items i ON hi.Item_ID = i.ID
                         WHERE hi.Player_ID = $id`, {$id: row.ID}).then(itemRows => {
					sql.get(`SELECT * FROM Nemesis WHERE Channel = $channel`, {$channel: row.Channel}).then(nemesisRow => {
						sql.all(`SELECT * FROM Players WHERE Fusion_ID = $id`, {$id: row.ID}).then(fusionRows => {
							var player = {
								id: row.ID,
								username: row.Username,
								name: row.Name,
								channel: row.Channel,
								level: row.Power_Level,
								glory: row.Glory,
								aliveTime: row.Life_Time,
								lastActive: row.Active_Time,
								nemesisFlag: row.Nemesis_Flag != 0,
								fusionFlag: row.Fusion_Flag != 0,
								wishFlag: row.Wish_Flag != 0,
								npcFlag: row.NPC_Flag != 0,
								config: {
									alwaysPrivate: row.AlwaysPrivate_Flag != 0,
									ping: row.Ping_Flag != 0,
									pronoun: row.Pronoun
								},
								offers: [],
								status: [],
								items: [],
								fusionId: row.Fusion_ID,
								fusionNames: []
							};
				
							for(var i in offerRows) {
								var o = offerRows[i];
								player.offers.push({
									playerId: o.Player_ID,
									targetId: o.Target_ID,
									type: o.Type,
									expires: o.Expires,
									name: o.Name
								});
							}
							for(var i in statusRows) {
								var s = statusRows[i];
								player.status.push({
									type: s.Status_ID,
									name: s.Name,
									startTime: s.StartTime,
									endTime: s.EndTime,
									ends: s.Ends != 0,
									priority: s.Priority
								});
							}
							for(var i in itemRows) {
								var item = itemRows[i];
								player.items.push({
									type: item.Item_ID,
									name: item.Type_Name,
									count: item.Count
								});
							}
							
							if(fusionRows.length == 2) {
								fusionNames.push(fusionRows[0].Name);
								fusionNames.push(fusionRows[1].Name);
							}
							
							player.isNemesis = nemesisRow && nemesisRow.Player_ID == player.id;
							
							callback(player);
						});
					});
                });
            });
        });
	},
	// Create a new offer.
	addOffer(player, target, type, callback) {
		var id = uuidv4();
		if(!target) {
			sql.run(`DELETE FROM Offers WHERE Player_ID = $playerId AND Target_ID IS NULL AND Type = $type`, {$playerId: player.id, $type: type}).then(() => {	
				sql.run(`INSERT INTO Offers (ID, Channel, Player_ID, Type, Expires) VALUES ($id, $channel, $playerId, $type, $expires)`,
				{
					$id: id,
					$channel: player.channel,
					$playerId: player.id,
					$type: type,
					$expires: new Date().getTime() + hour * 6
				}).then(callback);
			});
		} else {
			sql.run(`INSERT OR REPLACE INTO Offers (ID, Channel, Player_ID, Target_ID, Type, Expires) VALUES ($id, $channel, $playerId, $targetId, $type, $expires)`,
			{
				$id: id,
				$channel: player.channel,
				$playerId: player.id,
				$targetId: target.id,
				$type: type,
				$expires: new Date().getTime() + hour * 6
			}).then(callback);
		}
	},
	// Create a new Status.
	addStatus(player, statusId, endTime, callback) {
		var id = uuidv4();
		sql.run(`INSERT OR REPLACE INTO PlayerStatus (ID, Channel, Player_ID, Status_ID, StartTime, EndTime) VALUES ($id, $channel, $playerId, $statusId, $startTime, $endTime)`,
		{
			$id: id,
			$channel: player.channel,
			$playerId: player.id,
			$statusId: statusId,
			$startTime: new Date().getTime(),
			$endTime: endTime
		}).then(callback);
	},
	// Delete an Offer.
	deleteOffer(playerId, targetId, type, callback) {
		sql.run(`DELETE FROM Offers WHERE Player_ID = $playerId AND Target_ID = $targetId AND Type = $type`, {$playerId: playerId, $targetId: targetId, $type: type}).then(callback);
	},
	// Delete a Status.
	deleteStatus(playerId, type, callback) {
		sql.run(`DELETE FROM PlayerStatus WHERE Player_ID = $playerId AND Status_ID = $type`, {$playerId: playerId, $type: type}).then(callback);
	},
	// Get Nemesis info for a channel.
	getNemesis(channel, callback) {
		sql.get(`SELECT * FROM Nemesis WHERE Channel = $channel`, {$channel: channel}).then(row => {
			if(row) {
				var nemesis = {
					id: row.Player_ID,
					type: row.Nemesis_Type,
					startTime: row.Nemesis_Time,
					attackTime: row.Attack_Time,
					destroyTime: row.Destroy_Time,
					reviveTime: row.Revive_Time,
					basePower: row.Base_Power,
					cooldown: row.Nemesis_Cooldown
				};
				callback(nemesis);
			} else {
				callback(null);
			}
		});
	},
	// Get the history of players who fought the Nemesis.
	getNemesisHistory(channel, callback) {
		sql.get(`SELECT * FROM Nemesis WHERE Channel = $channel`, {$channel: channel}).then(nemesis => {
			if(nemesis) {
				sql.all(`SELECT h.*, l.Name, l.Glory FROM History h
				LEFT JOIN Players l ON l.ID = h.Loser_ID
				WHERE h.Winner_ID = $nemesisId AND h.Battle_Time > $nemesisTime`, {$nemesisId: nemesis.ID, $nemesisTime: nemesis.Nemesis_Time}).then(rows => {
					var history = rows.map(r => {
						return {
							name: r.Name,
							glory: r.Glory,
							id: r.Loser_ID
						};
					});
					
					callback(history);
				});
			} else {
				callback([]);
			}
		});
	},
	// Update Nemesis data.
    setNemesis(channel, nemesis, callback) {
        // Update the nemesis in the DB
        sql.run(updateNemesisSql, {
			$channel: channel,
            $playerId: nemesis.id,
			$type: nemesis.type,
			$startTime: nemesis.startTime,
			$attackTime: nemesis.attackTime,
			$destroyTime: nemesis.destroyTime,
			$reviveTime: nemesis.reviveTime,
			$cooldown: nemesis.cooldown,
			$basePower: nemesis.basePower
        }).then(callback);
	},
	// Get Garden info.
	getGarden(channel, callback) {
		sql.get(`SELECT * FROM Gardens WHERE Channel = $channel`, {$channel: channel}).then(gardenRow => {
			sql.all(`SELECT * FROM Plants WHERE Channel = $channel`, {$channel: channel}).then(plantRows => {
				sql.all(`SELECT * FROM Items WHERE Channel = $channel AND Plant_Flag <> 0`, {$channel: channel}).then(itemRows => {
					if(gardenRow) {
						var garden = {
							plants: [null, null, null],
							plantTypes: [],
							gardenLevel: 0,
							researchLevel: 0
						};
						if(garden.Plant1_ID) {
							var plantRow = plantRows.find(p => p.ID == garden.Plant1_ID);
							if(plantRow) {
								garden.plants[0] = {
									id: plantRow.id,
									type: plantRow.Plant_Type,
									growTime: plantRow.Grow_Time
								};
							}
						}
						if(garden.Plant2_ID) {
							var plantRow = plantRows.find(p => p.ID == garden.Plant2_ID);
							if(plantRow) {
								garden.plants[1] = {
									id: plantRow.id,
									type: plantRow.Plant_Type,
									growTime: plantRow.Grow_Time
								};
							}
						}
						if(garden.Plant3_ID) {
							var plantRow = plantRows.find(p => p.ID == garden.Plant3_ID);
							if(plantRow) {
								garden.plants[2] = {
									id: plantRow.id,
									type: plantRow.Plant_Type,
									growTime: plantRow.Grow_Time
								};
							}
						}
						for(var i in itemRows) {
							var plant = itemRows[i];
							garden.plantTypes.push({
								id: plant.ID,
								known: plant.Known_Flag
							});
						}
						callback(garden);
					} else {
						callback(null);
					}
				});
			});
		});
	},
	// Delete all offers for a player who was just defeated.
	deleteOffersForDeath(player, callback) {
		sql.run(`DELETE FROM Offers WHERE Player_ID = $playerId OR Target_ID = $playerId`, {$playerId: player.id}).then(callback);
	},
	// Update channel heat.
	setHeat(channel, heat, callback) {
		sql.run(`UPDATE Worlds SET Heat = $heat WHERE Channel = $channel`, {$channel: channel, $heat: heat}).then(callback);
	},
	// Get all Players in a channel.
	getPlayers(channel, callback) {
		sql.all(`SELECT ID, Name FROM Players WHERE Channel = $channel ORDER BY Name`, {$channel: channel}).then(rows => {
            var promises = rows.map(row => {
				return new Promise((resolve, reject) => {
					module.exports.getPlayerById(row.ID, player => {
						resolve(player);
					});
				});
			});
			Promise.all(promises).then(players => {
				callback(players);
			});
		});
	},
	// Get all Offers in a channel.
	getOffers(channel, callback) {
		sql.all(`SELECT o.*, p.Name AS PlayerName, t.Name AS TargetName FROM Offers o
		LEFT JOIN Players p ON o.Player_ID = p.ID
		LEFT JOIN Players t ON o.Target_ID = t.ID
		WHERE o.Channel = $channel`, {$channel: channel}).then(callback);
	},
	// Get all player Statuses in a channel.
	getStatuses(channel, callback) {
		sql.all(`SELECT ps.*, p.Name, s.Ends FROM PlayerStatus ps
		LEFT JOIN Statuses s ON s.ID = ps.Status_ID
		LEFT JOIN Players p ON ps.Player_ID = p.ID
		WHERE ps.Channel = $channel`, {$channel: channel}).then(callback);
	},
	// Delete all expired offers and statuses, and message the channel accordingly.
	// TODO: This is incomplete.
	deleteExpired(channel, callback) {
		var now = new Date().getTime();
		sql.all(`SELECT * FROM Offers WHERE Channel = $channel AND Expires < $now`, {$channel: channel, $now: now}).then(offerRows => {
			sql.all(`SELECT ps.*, p.Name FROM PlayerStatus ps
					LEFT JOIN Players p ON p.ID = ps.Player_ID
					LEFT JOIN Statuses s ON s.ID = ps.Status_ID
					WHERE ps.Channel = $channel AND s.Ends <> 0 AND ps.EndTime < $now`, {$channel: channel, $now: now}).then(statusRows => {
				var messages = [];
				for(var i in statusRows) {
					// React to statuses ending
					messages.push(`**${status.PlayerName}** is ready to fight.`);
				}
				for(var i in offerRows) {
					// React to offers ending
				}
				
				// Delete 'em
				var offerIds = offerRows.map(row => row.ID).join(',');
				var statusIds = statusRows.map(row => row.ID).join(',');
				sql.run(`DELETE FROM Offers WHERE ID IN ($offerIds)`, {$offerIds: offerIds}).then(() => {
					sql.run(`DELETE FROM Statuses WHERE ID IN ($statusIds)`, {$statusIds: statusIds}).then(() => {
						if(messages.length > 0) {
							var embed = new Discord.RichEmbed();
							embed.setTitle('Status Update')
								  .setColor(0x00AE86)
								  .setDescription(messages.join('\n'));
							  callback(embed);
						} else {
							callback(null);
						}
					});
				});
			});
		});
	},
	// Process updating passive changes in the world - offers and statuses expiring, garden updating, etc.
	updateWorld(channel, callback) {
		module.exports.deleteExpired(channel, callback);
		// TODO: Update the garden
		// TODO: Check for idle players to take their orbs
		// TODO: Update Max_Population based on activity
		// TODO: Check the Ruin clock
		// TODO: Combine all the messages from these into one big status update
		callback(null);
	},
}