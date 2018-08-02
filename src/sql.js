const enums = require('./enum.js');
const sql = require ('sqlite');
const numeral = require('numeral');
sql.open('./data.sqlite');

const hour = (60 * 60 * 1000);

const initTablesSql = `
CREATE TABLE IF NOT EXISTS Worlds (Channel TEXT, Heat REAL, Resets INTEGER, Max_Population INTEGER, 
	Lost_Orbs INTEGER, Last_Wish INTEGER, Last_Update INTEGER);
CREATE TABLE IF NOT EXISTS Players (ID INTEGER PRIMARY KEY, Username TEXT, User_ID TEXT, Name TEXT, Channel TEXT, Power_Level REAL, Fusion_ID INTEGER,
    Action_Level REAL, Action_Time INTEGER, Garden_Level REAL, Garden_Time INTEGER, Glory INTEGER,
    Last_Active INTEGER, Last_Fought INTEGER, Overdrive_Count INTEGER, Nemesis_Flag INTEGER, Fusion_Flag INTEGER, Wish_Flag INTEGER, 
    NPC_Flag INTEGER, AlwaysPrivate_Flag INTEGER, Ping_Flag INTEGER, Pronoun INTEGER);
CREATE TABLE IF NOT EXISTS PlayerStatus (ID INTEGER PRIMARY KEY, Channel TEXT, Player_ID INTEGER, Status_ID INTEGER,
	StartTime INTEGER, EndTime INTEGER, Rating REAL);
CREATE TABLE IF NOT EXISTS Statuses (ID INTEGER, Name TEXT, Ends INTEGER, Priority INTEGER);
CREATE TABLE IF NOT EXISTS HeldItems (Channel TEXT, Player_ID INTEGER, Item_ID INTEGER, Count INTEGER);
CREATE TABLE IF NOT EXISTS Items (ID INTEGER, Channel TEXT, Type_Name TEXT, Known_Flag INTEGER, Plant_Flag INTEGER, Grow_Time INTEGER);
CREATE TABLE IF NOT EXISTS Offers (ID INTEGER PRIMARY KEY, Channel TEXT, Player_ID INTEGER, Target_ID INTEGER, Type INTEGER, Extra TEXT, Expires INTEGER);
CREATE TABLE IF NOT EXISTS Gardens (Channel TEXT, Plant1_ID INTEGER, Plant2_ID INTEGER, Plant3_ID INTEGER,
    Growth_Level REAL, Research_Level REAL);
CREATE TABLE IF NOT EXISTS Plants (ID INTEGER PRIMARY KEY, Channel TEXT, Plant_Type INTEGER, StartTime INTEGER);
CREATE TABLE IF NOT EXISTS Nemesis (Channel TEXT, Player_ID INTEGER, Nemesis_Type INTEGER, Nemesis_Time INTEGER, Attack_Time INTEGER, 
    Destroy_Time INTEGER, Energize_Time INTEGER, Revive_Time INTEGER, Burn_Time INTEGER, Ruin_Time INTEGER, Base_Power REAL, Nemesis_Cooldown INTEGER);
CREATE TABLE IF NOT EXISTS Henchmen (Channel TEXT, Player_ID INTEGER, Defeats INTEGER);
CREATE TABLE IF NOT EXISTS History (Channel TEXT, Battle_Time INTEGER, Winner_ID INTEGER, Loser_ID INTEGER,
    Winner_Level REAL, Loser_Level REAL,
    Winner_Skill REAL, Loser_Skill REAL);
CREATE TABLE IF NOT EXISTS Tournaments (Channel TEXT, Organizer_ID INTEGER, Status INTEGER, Type INTEGER, 
    Round INTEGER, Round_Time INTEGER, Next_Tournament_Time INTEGER);
CREATE TABLE IF NOT EXISTS TournamentPlayers (Channel TEXT, Player_ID INTEGER);
CREATE TABLE IF NOT EXISTS TournamentMatches (ID INTEGER, Left_Parent_ID INTEGER, Right_Parent_ID INTEGER, 
    Left_Player_ID INTEGER, Right_Player_ID INTEGER);
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
CREATE UNIQUE INDEX IF NOT EXISTS Henchmen_ChannelPlayer ON Henchmen(Channel, Player_ID);
CREATE UNIQUE INDEX IF NOT EXISTS Tournaments_Channel ON Tournaments(Channel);
CREATE UNIQUE INDEX IF NOT EXISTS TournamentPlayers_ChannelPlayer ON TournamentPlayers(Channel, Player_ID)
`

const newChannelSql = `DELETE FROM Worlds WHERE Channel = $channel;
DELETE FROM Gardens WHERE Channel = $channel;
DELETE FROM Items WHERE Channel = $channel;
INSERT OR REPLACE INTO Worlds (Channel, Heat, Resets, Max_Population, Lost_Orbs, Last_Wish) VALUES ($channel, 0, 0, 0, 7, 0);
INSERT OR REPLACE INTO Items (ID, Channel, Type_Name, Grow_Time, Known_Flag, Plant_Flag) VALUES (0, $channel, "Orb", 0, 0, 0);
INSERT OR REPLACE INTO Items (ID, Channel, Type_Name, Grow_Time, Known_Flag, Plant_Flag) VALUES (1, $channel, "Flower", 18, 1, 1);
INSERT OR REPLACE INTO Items (ID, Channel, Type_Name, Grow_Time, Known_Flag, Plant_Flag) VALUES (2, $channel, "Rose", 24, 0, 1);
INSERT OR REPLACE INTO Items (ID, Channel, Type_Name, Grow_Time, Known_Flag, Plant_Flag) VALUES (3, $channel, "Carrot", 12, 0, 1);
INSERT OR REPLACE INTO Items (ID, Channel, Type_Name, Grow_Time, Known_Flag, Plant_Flag) VALUES (4, $channel, "Bean", 18, 0, 1);
INSERT OR REPLACE INTO Items (ID, Channel, Type_Name, Grow_Time, Known_Flag, Plant_Flag) VALUES (5, $channel, "Sedge", 6, 0, 1);
INSERT OR REPLACE INTO Items (ID, Channel, Type_Name, Grow_Time, Known_Flag, Plant_Flag) VALUES (6, $channel, "Fern", 12, 0, 1);
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
INSERT OR REPLACE INTO Statuses (ID, Name, Ends, Priority) VALUES (12, "Berserk", 1, 250);
INSERT OR REPLACE INTO Gardens (Channel) VALUES ($channel)`;

const updatePlayerSql = `UPDATE Players SET
    Username = $username, 
	Name = $name,
	User_ID = $userId,
    Channel = $channel,
    Power_Level = $powerLevel,
    Garden_Level = $gardenLevel,
    Action_Level = $actionLevel,
    Action_Time = $actionTime,
    Garden_Level = $gardenLevel,
    Garden_Time = $gardenTime,
    Glory = $glory,
	Last_Active = $lastActive,
	Last_Fought = $lastFought,
	Overdrive_Count = $overdriveCount,
    Nemesis_Flag = $nemesisFlag,
    Fusion_Flag = $fusionFlag,
    Wish_Flag = $wishFlag,
    NPC_Flag = $npcFlag,
    AlwaysPrivate_Flag = $alwaysPrivateFlag,
    Ping_Flag = $pingFlag,
    Pronoun = $pronoun
WHERE ID = $id AND Channel = $channel`;

const insertPlayerSql = `INSERT INTO Players (Username, User_ID, Name, Channel, Power_Level,
	Action_Level, Action_Time, Garden_Level, Garden_Time, Glory, Last_Active, Last_Fought, Overdrive_Count,
	Nemesis_Flag, Fusion_Flag, Wish_Flag, NPC_Flag, AlwaysPrivate_Flag, Ping_Flag, Pronoun) 
VALUES ($username, $userId, $name, $channel, $powerLevel, $actionLevel, $actionTime, $gardenLevel, $gardenTime, $glory, 
	$lastActive, $lastFought, $overdriveCount, $nemesisFlag, $fusionFlag, $wishFlag, $npcFlag, $alwaysPrivate, $ping, $pronoun)`;

const updateNemesisSql = `INSERT OR REPLACE INTO Nemesis 
(Channel, Player_ID, Nemesis_Type, Nemesis_Time, Attack_Time, Destroy_Time, Energize_Time, Revive_Time, Burn_Time, Ruin_Time, Base_Power, Nemesis_Cooldown)
VALUES ($channel, $playerId, $type, $startTime, $attackTime, $destroyTime, $energizeTime, $reviveTime, $burnTime, $ruinTime, $basePower, $cooldown)`;

module.exports = {
	// Sets up tables and such for an empty DB.
    async initializeGame() {
		let queries = initTablesSql.split(';');
		for(let i in queries) {
			let query = queries[i];
			await sql.run(query);
		}
	},
	// Sets up basic Status/Item/Garden info for a new channel.
    async initializeChannel(channel) {
        let queries = newChannelSql.split(';');
		for(let i in queries) {
			let query = queries[i];
			if(query.indexOf('$channel') > -1) {
				await sql.run(query, {$channel: channel});
			} else {
				await sql.run(query);
			}
		}

		// Make one random plant known
		let knownPlant = Math.floor(Math.random() * 5);
		await sql.run(`UPDATE Items SET Known_Flag = 1 WHERE ID = $id`, {$id: knownPlant});
		console.log(`Channel ${channel} initialized`);
	},
	// Debug commands to run arbitrary SQL. Be careful, admin.
    async execute(type, command) {
        switch(type) {
        case 'get':
			console.log(await sql.get(command));
            break;
        case 'all':
			console.log(await sql.all(command));
            break;
        case 'run':
            await sql.run(command);
			console.log('Executed: ' + command);
            break;
        }
	},
	// Fetches basic world data.
	async getWorld(channel) {
		let row = await sql.get(`SELECT * FROM Worlds WHERE Channel = $channel`, {$channel: channel});
		if(row) {
			let world = {
				channel: channel,
				heat: row.Heat,
				resets: row.Resets,
				maxPopulation: row.Max_Population,
				lostOrbs: row.Lost_Orbs,
				lastWish: row.Last_Wish,
				lastUpdate: row.Last_Update
			};
			
			return world;
		} else {
			return null;
		}
	},
	async setWorld(world) {
		await sql.run(`UPDATE Worlds SET Heat = $heat, Resets = $resets, Max_Population = $maxPopulation, 
			Lost_Orbs = $lostOrbs, Last_Wish = $lastWish WHERE Channel = $channel`,
		{
			$heat: world.heat,
			$resets: world.resets,
			$maxPopulation: world.maxPopulation,
			$lostOrbs: world.lostOrbs,
			$lastWish: world.lastWish,
			$channel: world.channel
		});
	},
	// Creates a new player in the DB.
    async addPlayer(player) {
		const result = await sql.run(insertPlayerSql,
			{
				$username: player.username, 
				$userId: player.userId, 
				$name: player.name, 
				$channel: player.channel, 
				$powerLevel: player.level,
				$actionLevel: player.actionLevel, 
				$actionTime: player.actionTime, 
				$gardenLevel: player.gardenLevel, 
				$gardenTime: player.gardenTime, 
				$glory: player.glory, 
				$lastActive: player.lastActive,
				$lastFought: player.lastFought,
				$overdriveCount: player.overdriveCount,
				$nemesisFlag:  player.nemesisFlag ? 1 : 0,
				$fusionFlag: player.fusionFlag ? 1 : 0, 
				$wishFlag: player.wishFlag ? 1 : 0, 
				$npcFlag: player.npcFlag ? 1 : 0,
				$alwaysPrivate: player.config.alwaysPrivate ? 1 : 0, 
				$ping: player.config.ping ? 1 : 0, 
				$pronoun: player.config.pronoun
			});
		return result.lastID;
	},
	// Updates a player's attributes.
    async setPlayer(player) {
        // Update a player in the DB
        await sql.run(updatePlayerSql, {
            $id: player.id,
			$username: player.username,
			$userId: player.userId,
            $name: player.name,
            $channel: player.channel,
            $powerLevel: player.level,
            $gardenLevel: player.gardenLevel,
            $actionLevel: player.actionLevel,
            $gardenTime: player.gardenTime,
            $actionTime: player.actionTime,
            $glory: player.glory,
			$lastActive: player.lastActive,
			$lastFought: player.lastFought,
			$overdriveCount: player.overdriveCount,
            $nemesisFlag: player.nemesisFlag ? 1 : 0,
            $fusionFlag: player.fusionFlag ? 1 : 0,
            $wishFlag: player.wishFlag ? 1 : 0,
            $npcFlag: player.npcFlag ? 1 : 0,
            $alwaysPrivateFlag: player.config.alwaysPrivate ? 1 : 0,
            $pingFlag: player.config.ping ? 1 : 0,
            $pronoun: player.config.pronoun
        });
	},
	// Fetches a player from the database by character name.
    async getPlayer(channel, name) {
		if(!name) {
			return null;
		}
        // Exact name match
		let row = await sql.get(`SELECT * FROM Players p WHERE Channel = $channel AND UPPER(p.name) = $name`, {$name: name.toUpperCase(), $channel: channel});
		if(!row) {
			// Starts With name match
			row = await sql.get(`SELECT * FROM Players p WHERE Channel = $channel AND UPPER(p.name) LIKE ($namePattern)`, {$namePattern: name.toUpperCase() + '%', $channel: channel});
		}
		if(!row) {
			// Contains name match
			row = await sql.get(`SELECT * FROM Players p WHERE Channel = $channel AND UPPER(p.name) LIKE ($namePattern)`, {$namePattern: '%' + name.toUpperCase() + '%', $channel: channel});
		}
		if(row) {
			return await this.fusionCheck(row);
		}
    },
	// Fetches a player from the database by user name.
    async getPlayerByUsername(channel, name) {
        // Get a player by username
        let row = await sql.get(`SELECT * FROM Players WHERE Channel = $channel AND username = $username`, {$channel: channel, $username: name});
		if(row) {
			return await this.fusionCheck(row);
		} else {
			return null;
		}
    },
	// Fetches a player from the database by player ID.
    async getPlayerById(id) {
        let row = await sql.get(`SELECT * FROM Players p WHERE p.ID = $id`, {$id: id});
		if(row) {
			return await this.getPlayerInternal(row);
		} else {
			return null;
		}
    },
	// If the player has a fusion ID, load the fusion instead of the base player.
	async fusionCheck(row) {
		if(row.Fusion_ID && row.Fusion_ID != row.ID) {
			return await this.getPlayerById(row.Fusion_ID);
		} else {
			return await this.getPlayerInternal(row);
		}
	},
	// Add Offers, Statuses and Items to a player and return it as a player object.
    async getPlayerInternal(row) {
        let offerRows = await sql.all(`SELECT o.*, p.Name FROM Offers o 
			LEFT JOIN Players p ON o.Player_ID = p.ID
			WHERE o.Target_ID = $id OR (o.Target_ID IS NULL AND o.Player_ID <> $id AND o.Channel = $channel)`, {$id: row.ID, $channel: row.Channel});
		let statusRows = await sql.all(`SELECT ps.*, s.Ends, s.Priority, s.Name FROM PlayerStatus ps
			LEFT JOIN Statuses s ON s.ID = ps.Status_Id
			WHERE Player_ID = $id`, {$id: row.ID});
		let itemRows = await sql.all(`SELECT DISTINCT hi.*, i.Type_Name FROM HeldItems hi
			LEFT JOIN Items i ON hi.Item_ID = i.ID
			WHERE hi.Player_ID = $id`, {$id: row.ID});
		let nemesisRow = await sql.get(`SELECT * FROM Nemesis WHERE Channel = $channel`, {$channel: row.Channel});
		let fusionRows = await sql.all(`SELECT * FROM Players WHERE Fusion_ID = $id AND ID != $id`, {$id: row.ID});
		let henchmenRows = await this.getHenchmen(row.Channel);

		let player = {
			id: row.ID,
			username: row.Username,
			userId: row.User_ID,
			name: row.Name,
			channel: row.Channel,
			level: row.Power_Level,
			glory: row.Glory,
			lastActive: row.Last_Active,
			lastFought: row.Last_Fought,
			gardenLevel: row.Garden_Level,
			actionLevel: row.Action_Level,
			gardenTime: row.Garden_Time,
			actionTime: row.Action_Time,
			overdriveCount: row.Overdrive_Count,
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
			fusionNames: [],
			fusionIDs: []
		};

		// Offer types:
		// 0 = fight
		// 1 = fusion
		// 2 = henchman
		// 3 = taunt
		for(let i in offerRows) {
			let o = offerRows[i];
			player.offers.push({
				playerId: o.Player_ID,
				targetId: o.Target_ID,
				type: o.Type,
				expires: o.Expires,
				name: o.Name,
				extra: o.Extra
			});
		}
		for(let i in statusRows) {
			let s = statusRows[i];
			player.status.push({
				id: s.ID,
				type: s.Status_ID,
				name: s.Name,
				startTime: s.StartTime,
				endTime: s.EndTime,
				ends: s.Ends != 0,
				priority: s.Priority,
				rating: s.Rating
			});
		}
		for(let i in itemRows) {
			let item = itemRows[i];
			player.items.push({
				type: item.Item_ID,
				name: item.Type_Name,
				count: item.Count
			});
		}
		
		if(fusionRows.length == 2) {
			player.fusionNames.push(fusionRows[0].Name);
			player.fusionIDs.push(fusionRows[0].ID);
			player.fusionNames.push(fusionRows[1].Name);
			player.fusionIDs.push(fusionRows[1].ID);
		}
		
		player.isNemesis = nemesisRow && nemesisRow.Player_ID == player.id;
		let h = henchmenRows.find(h => h.id == player.id);
		if(h) {
			player.isHenchman = true;
			player.henchmanDefeats = h.defeats;
		}
		
		return player;
	},
	// Create a new offer.
	async addOffer(player, target, type, extra) {
		if(!target) {
			await sql.run(`DELETE FROM Offers WHERE Player_ID = $playerId AND Target_ID IS NULL AND Type = $type`, {$playerId: player.id, $type: type});
			await sql.run(`INSERT INTO Offers (Channel, Player_ID, Type, Extra, Expires) VALUES ($channel, $playerId, $type, $extra, $expires)`,
				{
					$channel: player.channel,
					$playerId: player.id,
					$type: type,
					$extra: extra,
					$expires: new Date().getTime() + hour * 6
				});
		} else {
			await sql.run(`INSERT OR REPLACE INTO Offers (Channel, Player_ID, Target_ID, Type, Extra, Expires) VALUES ($channel, $playerId, $targetId, $type, $extra, $expires)`,
			{
				$channel: player.channel,
				$playerId: player.id,
				$targetId: target.id,
				$type: type,
				$extra: extra,
				$expires: new Date().getTime() + hour * 6
			});
		}
	},
	// Create a new Status.
	async addStatus(channel, playerId, statusId, endTime, rating) {
		await sql.run(`INSERT OR REPLACE INTO PlayerStatus (Channel, Player_ID, Status_ID, StartTime, EndTime, Rating) 
			VALUES ($channel, $playerId, $statusId, $startTime, $endTime, $rating)`,
			{
				$channel: channel,
				$playerId: playerId,
				$statusId: statusId,
				$startTime: new Date().getTime(),
				$endTime: endTime,
				$rating: rating
			});
	},
	// Start a new plant.
	async addPlant(channel, plantType, slot) {
		let now = new Date().getTime();
		await sql.run(`INSERT INTO Plants (Channel, Plant_Type, StartTime) VALUES ($channel, $type, $startTime)`, 
			{$channel: channel, $type: plantType, $startTime: now});
		let plantId = await sql.get(`SELECT last_insert_rowid() as id`);
		switch(slot) {
			case 0:
				await sql.run(`UPDATE Gardens SET Plant1_ID = $id WHERE Channel = $channel`, {$id: plantId.id, $channel: channel});
				break;
			case 1:
				await sql.run(`UPDATE Gardens SET Plant2_ID = $id WHERE Channel = $channel`, {$id: plantId.id, $channel: channel});
				break;
			case 2:
				await sql.run(`UPDATE Gardens SET Plant3_ID = $id WHERE Channel = $channel`, {$id: plantId.id, $channel: channel});
				break;
		}
	},
	// Gives a new item to a player
	async addItems(channel, playerId, itemId, count) {
		let existingItem = await sql.get(`SELECT Count FROM HeldItems WHERE Player_ID = $playerId AND Item_ID = $itemId`,
			{$playerId: playerId, $itemId: itemId});
		if(existingItem) {
			let newCount = existingItem.Count + count;
			if(newCount <= 0) {
				await sql.run(`DELETE FROM HeldItems WHERE Player_ID = $playerId AND Item_ID = $itemId`, 
					{$playerId: playerId, $itemId: itemId});
			} else {
				await sql.run(`UPDATE HeldItems SET Count = $count WHERE Player_ID = $playerId AND Item_ID = $itemId`, 
					{$playerId: playerId, $itemId: itemId, $count: existingItem.Count + count});
			}
		} else {
			await sql.run(`INSERT INTO HeldItems (Channel, Player_ID, Item_ID, Count) VALUES
				($channel, $playerId, $itemId, $count)`,
				{$channel: channel, $playerId: playerId, $itemId: itemId, $count: count});
		}
	},
	async setPlant(plant) {
		await sql.run(`UPDATE Plants SET Plant_Type = $type, StartTime = $startTime WHERE ID = $id`, 
			{$type: plant.type, $startTime: plant.startTime, $id: plant.id});
	},
	async setGarden(garden) {
		await sql.run(`UPDATE Gardens SET Growth_Level = $growthLevel, Research_Level = $researchLevel WHERE Channel = $channel`, 
			{$growthLevel: garden.growthLevel, $researchLevel: garden.researchLevel, $channel: garden.channel});
	},
	async setStatus(status) {
		await sql.run(`UPDATE PlayerStatus SET StartTime = $startTime, EndTime = $endTime WHERE ID = $id`, 
			{$startTime: status.startTime, $endTime: status.endTime, $id: status.id});
	},
	// Delete an Offer.
	async deleteOffer(playerId, targetId, type) {
		await sql.run(`DELETE FROM Offers WHERE Player_ID = $playerId AND Target_ID = $targetId AND Type = $type`, {$playerId: playerId, $targetId: targetId, $type: type});
	},
	// Delete a Status.
	async deleteStatus(channel, playerId, type) {
		await sql.run(`DELETE FROM PlayerStatus WHERE Player_ID = $playerId AND Status_ID = $type`, {$playerId: playerId, $type: type});
		if(type == 0) {
			// Ending a KO status = become capable of training
			await this.addStatus(channel, playerId, 5);
		}
	},
	// Delete a Status.
	async deletePlayer(playerId) {
		await sql.run(`DELETE FROM Players WHERE ID = $playerId`, {$playerId: playerId});
		await sql.run(`DELETE FROM HeldItems WHERE Player_ID = $playerId`, {$playerId: playerId});
		await sql.run(`DELETE FROM PlayerStatus WHERE Player_ID = $playerId`, {$playerId: playerId});
	},
	// Delete a Plant.
	async deletePlant(plantId) {
		await sql.run(`DELETE FROM Plants WHERE ID = $plantId`, {$plantId: plantId});
		await sql.run(`UPDATE Gardens SET Plant1_ID = 0 WHERE Plant1_ID = $plantId`, {$plantId: plantId});
		await sql.run(`UPDATE Gardens SET Plant2_ID = 0 WHERE Plant2_ID = $plantId`, {$plantId: plantId});
		await sql.run(`UPDATE Gardens SET Plant3_ID = 0 WHERE Plant3_ID = $plantId`, {$plantId: plantId});
	},
	// Get Nemesis info for a channel.
	async getNemesis(channel) {
		let row = await sql.get(`SELECT * FROM Nemesis WHERE Channel = $channel`, {$channel: channel});
		if(row) {
			let nemesis = {
				id: row.Player_ID,
				channel: row.Channel,
				type: row.Nemesis_Type,
				startTime: row.Nemesis_Time,
				attackTime: row.Attack_Time,
				destroyTime: row.Destroy_Time,
				energizeTime: row.Energize_Time,
				reviveTime: row.Revive_Time,
				burnTime: row.Burn_Time,
				ruinTime: row.Ruin_Time,
				basePower: row.Base_Power,
				cooldown: row.Nemesis_Cooldown
			};
			return nemesis;
		} else {
			return null;
		}
	},
	// Get the history of players who fought the Nemesis.
	async getNemesisHistory(channel) {
		let nemesis = await sql.get(`SELECT * FROM Nemesis WHERE Channel = $channel`, {$channel: channel});
		if(nemesis) {
			let rows = await sql.all(`SELECT h.*, l.Name, l.Glory FROM History h
			LEFT JOIN Players l ON l.ID = h.Loser_ID
			WHERE h.Winner_ID = $nemesisId AND h.Battle_Time > $nemesisTime`, {$nemesisId: nemesis.ID, $nemesisTime: nemesis.Nemesis_Time});
			let history = rows.map(r => {
				return {
					name: r.Name,
					glory: r.Glory,
					id: r.Loser_ID
				};
			});
			
			return history;
		} else {
			return [];
		}
	},
	// Update Nemesis data.
    async setNemesis(channel, nemesis) {
        // Update the nemesis in the DB
        await sql.run(updateNemesisSql, {
			$channel: channel,
            $playerId: nemesis.id,
			$type: nemesis.type,
			$startTime: nemesis.startTime,
			$attackTime: nemesis.attackTime,
			$destroyTime: nemesis.destroyTime,
			$reviveTime: nemesis.reviveTime,
			$burnTime: nemesis.burnTime,
			$ruinTime: nemesis.ruinTime,
			$cooldown: nemesis.cooldown,
			$basePower: nemesis.basePower
        });
	},
	// Get Garden info.
	async getGarden(channel) {
		let now = new Date().getTime();
		let gardenRow = await sql.get(`SELECT * FROM Gardens WHERE Channel = $channel`, {$channel: channel});
		let plantRows = await sql.all(`SELECT * FROM Plants WHERE Channel = $channel`, {$channel: channel});
		let itemRows = await sql.all(`SELECT * FROM Items WHERE Channel = $channel AND Plant_Flag <> 0`, {$channel: channel});
		if(gardenRow) {
			let garden = {
				channel: channel,
				plants: [null, null, null],
				plantTypes: [],
				growthLevel: gardenRow.Growth_Level ? gardenRow.Growth_Level : 0,
				researchLevel: gardenRow.Research_Level ? gardenRow.Research_Level : 0
			};
			if(gardenRow.Plant1_ID) {
				let plantRow = plantRows.find(p => p.ID == gardenRow.Plant1_ID);
				let plantInfo = itemRows.find(i => i.ID == plantRow.Plant_Type);
				if(plantRow) {
					let growTime = plantInfo ? plantInfo.Grow_Time : 0;
					garden.plants[0] = {
						id: plantRow.ID,
						type: plantRow.Plant_Type,
						name: plantInfo ? plantInfo.Type_Name : null,
						growTime: growTime,
						startTime: plantRow.StartTime,
						endTime: plantRow.StartTime + (growTime * hour / (1 + 0.1 * garden.growthLevel))
					};
				}
			}
			if(gardenRow.Plant2_ID) {
				let plantRow = plantRows.find(p => p.ID == gardenRow.Plant2_ID);
				let plantInfo = itemRows.find(i => i.ID == plantRow.Plant_Type);
				if(plantRow) {
					let growTime = plantInfo ? plantInfo.Grow_Time : 0;
					garden.plants[1] = {
						id: plantRow.ID,
						type: plantRow.Plant_Type,
						name: plantInfo ? plantInfo.Type_Name : null,
						growTime: growTime,
						startTime: plantRow.StartTime,
						endTime: plantRow.StartTime + (growTime * hour / (1 + 0.1 * garden.growthLevel))
					};
				}
			}
			if(gardenRow.Plant3_ID) {
				let plantRow = plantRows.find(p => p.ID == gardenRow.Plant3_ID);
				let plantInfo = itemRows.find(i => i.ID == plantRow.Plant_Type);
				if(plantRow) {
					let growTime = plantInfo ? plantInfo.Grow_Time : 0;
					garden.plants[2] = {
						id: plantRow.ID,
						type: plantRow.Plant_Type,
						name: plantInfo ? plantInfo.Type_Name : null,
						growTime: growTime,
						startTime: plantRow.StartTime,
						endTime: plantRow.StartTime + (growTime * hour / (1 + 0.1 * garden.growthLevel))
					};
				}
			}
			for(let i in itemRows) {
				let plant = itemRows[i];
				garden.plantTypes.push({
					id: plant.ID,
					known: plant.Known_Flag
				});
			}
			return garden;
		} else {
			null;
		}
	},
	// Delete all offers for a player who was just defeated.
	async deleteOffersFromFight(winnerId, loserId) {
		await sql.run(`DELETE FROM Offers WHERE Player_ID = $playerId OR Target_ID = $playerId`, {$playerId: loserId});
		await sql.run(`DELETE FROM Offers WHERE Player_ID = $playerId AND Target_ID IS NULL`, {$playerId: winnerId});
	},
	// Delete all fusion offers (for instance, for a player that just fused).
	async deleteAllFusionOffers(playerId) {
		await sql.run(`DELETE FROM Offers WHERE Player_ID = $playerId AND type = 1`, {$playerId: playerId});
	},
	// Set fusion ID (when creating or removing fusions)
	async setFusionId(playerId, fusionId) {
		await sql.run(`UPDATE Players SET Fusion_ID = $fusionId WHERE ID = $playerId`, {$playerId: playerId, $fusionId: fusionId});
	},
	// Update channel heat.
	async setHeat(channel, heat) {
		await sql.run(`UPDATE Worlds SET Heat = $heat WHERE Channel = $channel`, {$channel: channel, $heat: heat});
	},
	// Get all Players in a channel.
	async getPlayers(channel) {
		let rows = await sql.all(`SELECT ID, Name FROM Players WHERE Channel = $channel ORDER BY UPPER(Name)`, {$channel: channel});
		let players = [];
		for(let i in rows) {
			let row = rows[i];
			let player = await this.getPlayerById(row.ID);
			players.push(player);
		}
		return players;
	},
	// Get all Offers in a channel.
	async getOffers(channel) {
		let offers = await sql.all(`SELECT o.*, p.Name AS PlayerName, t.Name AS TargetName FROM Offers o
			LEFT JOIN Players p ON o.Player_ID = p.ID
			LEFT JOIN Players t ON o.Target_ID = t.ID
			WHERE o.Channel = $channel`, {$channel: channel});
		return offers;
	},
	// Get all player Statuses in a channel.
	async getStatuses(channel) {
		let statuses = await sql.all(`SELECT ps.*, p.Name, s.Ends FROM PlayerStatus ps
			LEFT JOIN Statuses s ON s.ID = ps.Status_ID
			LEFT JOIN Players p ON ps.Player_ID = p.ID
			WHERE ps.Channel = $channel`, {$channel: channel});
		return statuses;
	},
	// Delete all expired offers and statuses, and message the channel accordingly.
	async deleteExpired(channel, pings) {
		let now = new Date().getTime();
		let offerRows = await sql.all(`SELECT o.*, p.Last_Active FROM Offers o
			LEFT JOIN Players p ON p.ID = o.Player_ID
			WHERE o.Channel = $channel AND Expires < $now`, {$channel: channel, $now: now});
		let statusRows = await sql.all(`SELECT ps.*, p.Name, p.User_ID, p.Ping_Flag, p.Power_Level FROM PlayerStatus ps
			LEFT JOIN Players p ON p.ID = ps.Player_ID
			LEFT JOIN Statuses s ON s.ID = ps.Status_ID
			WHERE ps.Channel = $channel AND s.Ends <> 0 AND ps.EndTime < $now`, {$channel: channel, $now: now});
		let messages = [];
		for(let i in statusRows) {
			// React to statuses ending
			let status = statusRows[i];
			let decrease;
			switch(status.Status_ID) {
				case 0:
				    // Death
					messages.push(`**${status.Name}** is ready to fight.`);
					await this.addStatus(channel, status.Player_ID, 5);
					if(pings && status.Ping_Flag) pings.push(status.User_ID);
					break;
				case 3:
					// Energize
					decrease = status.Power_Level - status.Power_Level / 1.3;
					messages.push(`**${status.Name}** is no longer energized; power level fell by ${numeral(decrease.toPrecision(2)).format('0,0')}.`);
					break;
				case 4: 
					// Overdrive - reduce power level
					decrease = status.Power_Level * 0.1;
					let powerLevel = status.Power_Level - decrease;
					await sql.run(`UPDATE Players SET Power_Level = $level WHERE ID = $id`, {$id: status.Player_ID, $level: powerLevel});
					messages.push(`**${status.Name}** is no longer overdriving; power level fell by ${numeral(decrease.toPrecision(2)).format('0,0')}.`);
					break;
				case 7: 
					// Bean
					decrease = status.Power_Level - status.Power_Level / 1.12;
					messages.push(`**${status.Name}** is no longer bean boosted; power level fell by ${numeral(decrease.toPrecision(2)).format('0,0')}.`);
					break;
				case 9:
					// Fusion
					const fusedCharacter = await this.getPlayerById(status.Player_ID);
					const fusedPlayer1 = await this.getPlayerById(fusedCharacter.fusionIDs[0]);
					const fusedPlayer2 = await this.getPlayerById(fusedCharacter.fusionIDs[1]);

					// Divvy up skill and glory gains
					const preGarden = fusedPlayer1.gardenLevel + fusedPlayer2.gardenLevel;
					const gardenDiff = (fusedCharacter.gardenLevel - preGarden) / 2;
					fusedPlayer1.gardenLevel += gardenDiff;
					fusedPlayer2.gardenLevel += gardenDiff;

					const preAction = fusedPlayer1.actionLevel + fusedPlayer2.actionLevel;
					const actionDiff = (fusedCharacter.actionLevel - preAction) / 2;
					fusedPlayer1.actionLevel += actionDiff;
					fusedPlayer2.actionLevel += actionDiff;

					const preLevel = fusedPlayer1.level + fusedPlayer2.level;
					const levelDiff = (fusedCharacter.level - preLevel) / 2;
					fusedPlayer1.level += levelDiff;
					fusedPlayer2.level += levelDiff;

					const preGlory = fusedPlayer1.glory + fusedPlayer2.glory;
					const gloryDiff = Math.floor((fusedCharacter.glory - preGlory) / 2);
					fusedPlayer1.glory += gloryDiff;
					fusedPlayer2.glory += gloryDiff;

					await this.setPlayer(fusedPlayer1);
					await this.setPlayer(fusedPlayer2);

					// Roll for items like this is some kind of old-school MMO raid
					for (const item of fusedCharacter.items) {
						for (let i = 0; i < item.count; i++) {
							if (Math.random() >= 0.5) {
								await this.addItems(channel, fusedPlayer1.id, item.type, 1);
							} else {
								await this.addItems(channel, fusedPlayer2.id, item.type, 1);
							}
						}
					}

					// Unfuse
					await this.setFusionId(fusedPlayer1.id, 0);
					await this.setFusionId(fusedPlayer2.id, 0);

					// Clean up the fusion player
					await this.deletePlayer(fusedCharacter.id);

					messages.push(`**${status.Name}** disappears in a flash of light, leaving two warriors behind.`);
					if(pings && fusedPlayer1.config.ping) {
						pings.push(fusedPlayer1.userId);
					}
					if(pings && fusedPlayer2.config.ping) {
						pings.push(fusedPlayer2.userId);
					}
					break;
				
				case 12:
				    // Berserk
					messages.push(`**${status.Name}** calms down from their battle frenzy.`);
					break;
			}
		}
		let offerIds = []
		for(let i in offerRows) {
			let offer = offerRows[i];
			if(offer.Last_Active + hour < now && offer.Last_Active + 24 * hour > now) {
				// The player is idle, but not SUPER idle - stall their offer timers
				await sql.run(`UPDATE Offers SET Expires = $now WHERE ID = $id`, {$now: now, $id: offer.ID});
			} else {
				offerIds.push(offer.ID);
			}
		}
		
		// Delete 'em
		let statusIds = statusRows.map(row => row.ID);
		await sql.run(`DELETE FROM Offers WHERE ID IN (${offerIds.join(',')})`);
		await sql.run(`DELETE FROM PlayerStatus WHERE ID IN (${statusIds.join(',')})`);

		return messages;
	},
	async addHistory(channel, winnerId, winnerLevel, winnerSkill, loserId, loserLevel, loserSkill) {
		await sql.run(`INSERT INTO History (Channel, Battle_Time, Winner_Id, Loser_ID, Winner_Level, Loser_Level, Winner_Skill, Loser_Skill)
			VALUES ($channel, $battleTime, $winnerId, $loserId, $winnerLevel, $loserLevel, $winnerSkill, $loserSkill)`, {
			$channel: channel,
			$battleTime: new Date().getTime(),
			$winnerId: winnerId,
			$winnerSkill: winnerSkill,
			$winnerLevel: winnerLevel,
			$loserId: loserId,
			$loserLevel: loserLevel,
			$loserSkill: loserSkill
		});
	},
	async resetWorld(channel) {
		await sql.run(`UPDATE Worlds SET Heat = 0, Resets = Resets + 1 WHERE Channel = $channel`, {$channel: channel, $resets: row.Resets + 1});
		await sql.run(`UPDATE Gardens SET Plant1_ID = 0, Plant2_ID = 0, Plant3_ID = 0, Garden_Level = 0, Research_Level = 0 
			WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM PlayerStatus WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Offers WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM HeldItems WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Nemesis WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Henchmen WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Tournaments WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Tournament_Players WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Tournament_Brackets WHERE Channel = $channel`, {$channel: channel});
		// TODO: Reset known plants
	},
	async clone(channel, name, targetName) {
		let player = await this.getPlayerByUsername(channel, name);
		player.name = targetName;
		player.username = targetName;
		await this.addPlayer(player);
	},
	async autofight(channel, targetName) {
		let player = await this.getPlayer(channel, targetName);
		await this.addOffer(player, null, 0);
	},
	async getChannels() {
		let initialized = await sql.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='Worlds'`);
		if(!initialized) {
			return [];
		}
		let worlds = await sql.all(`SELECT Channel FROM Worlds`);
		return worlds.map(w => w.Channel);
	},
	async setUpdateTime(channel) {
		let now = new Date().getTime();
		await sql.run(`UPDATE Worlds SET Last_Update = $now WHERE Channel = $channel`, {$now: now, $channel: channel});
	},
	async playerActivity(channel, username) {
		let now = new Date().getTime();
		await sql.run(`UPDATE Players SET Last_Active = $now WHERE Channel = $channel AND Username = $name`, {$now: now, $channel: channel, $name: username});
	},
	async unfightOffers(id) {
		await sql.run(`DELETE FROM Offers WHERE Player_ID = $id`, {$id: id});
	},
	async getHistory(player1Id, player2Id) {
		let history = [];
		if(player2Id && player1Id != player2Id) {
			history = await sql.all(`SELECT h.*, wp.Name AS Winner_Name, lp.Name AS Loser_Name FROM History h 
				LEFT JOIN Players wp ON h.Winner_ID = wp.ID
				LEFT JOIN Players lp ON h.Loser_ID = lp.ID
				WHERE (Winner_ID = $player1Id AND Loser_ID = $player2Id) 
				OR (Winner_ID = $player2Id AND Loser_ID = $player1Id) ORDER BY Battle_Time DESC`, {
				$player1Id: player1Id,
				$player2Id: player2Id
			});
		} else {
			history = await sql.all(`SELECT h.*, wp.Name AS Winner_Name, lp.Name AS Loser_Name FROM History h 
			LEFT JOIN Players wp ON h.Winner_ID = wp.ID
			LEFT JOIN Players lp ON h.Loser_ID = lp.ID
			WHERE Winner_ID = $player1Id OR Loser_ID = $player1Id`, {
				$player1Id: player1Id
			});
		}

		if(history) {
			return history.map(h => { return {
				battleTime: h.Battle_Time,
				winnerId: h.Winner_ID,
				winnerLevel: h.Winner_Level,
				winnerSkill: h.Winner_Skill,
				winnerName: h.Winner_Name,
				loserId: h.Loser_ID,
				loserLevel: h.Loser_Level,
				loserSkill: h.Loser_Skill,
				loserName: h.Loser_Name
			}});
		} else {
			return [];
		}
	},
	async getKnownPlants(channel) {
		let rows = await sql.all(`SELECT * FROM Items WHERE Plant_Flag <> 0 AND Known_Flag <> 0 AND Channel = $channel
			ORDER BY ID`, {$channel: channel});
		if(rows) {
			return rows.map(r => { return {
				id: r.ID,
				name: r.Type_Name
			}});
		} else {
			return [];
		}
	},
	async getUnknownPlants(channel) {
		let rows = await sql.all(`SELECT * FROM Items WHERE Plant_Flag <> 0 AND Known_Flag = 0 AND Channel = $channel
			ORDER BY ID`, {$channel: channel});
		if(rows) {
			return rows.map(r => { return {
				id: r.ID,
				name: r.Type_Name
			}});
		} else {
			return [];
		}
	},
	async researchPlant(channel, plantId) {
		await sql.run(`UPDATE Items SET Known_Flag = 1 WHERE Channel = $channel AND ID = $id`, {$channel: channel, $id: plantId});
	},
	async setHenchman(channel, playerId, isHenchman) {
		if(isHenchman) {
			await sql.run(`INSERT OR REPLACE INTO Henchmen (Channel, Player_ID, Defeats) VALUES ($channel, $id, 0)`, {$channel: channel, $id: playerId});
		} else {
			await sql.run(`DELETE FROM Henchmen WHERE Channel = $channel AND Player_ID = $id`, {$channel: channel, $id: playerId});
		}
	},
	async getHenchmen(channel) {
		return await sql.all(`SELECT Player_ID AS id, Defeats as defeats FROM Henchmen WHERE Channel = $channel`, {$channel: channel});
	},
	async deleteHenchmen(channel) {
		await sql.run(`DELETE FROM Henchmen WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM PlayerStatus WHERE Channel = $channel AND Type = 3`, {$channel: channel});
	},
	async deleteRecruitOffers(channel) {
		await sql.run(`DELETE FROM Offers WHERE Channel = $channel AND Type = 2`, {$channel: channel});
	},
	async recordHenchmanDefeat(channel, playerId) {
		return await sql.all(`UPDATE Henchmen SET Defeats = Defeats + 1 WHERE Channel = $channel AND Player_ID = $id`, {$channel: channel, $id: playerId});
	},
	async fastForward(channel, time) {
		await sql.run(`UPDATE Worlds SET Last_Update = Last_Update + $time WHERE Channel = $channel`,
			{$channel: channel, $time: time});
		await sql.run(`UPDATE Players SET Action_Time = Action_Time + $time, Garden_Time = Garden_Time + $time,
			Last_Active = Last_Active + $channel, Last_Fought = Last_Fought + $channel
			WHERE Channel = $channel`,
			{$channel: channel, $time: time});
		await sql.run(`UPDATE PlayerStatus SET StartTime = StartTime + $time, EndTime = EndTime + $time WHERE Channel = $channel`,
			{$channel: channel, $time: time});
		await sql.run(`UPDATE Offers SET Expires = Expires + $time WHERE Channel = $channel`,
			{$channel: channel, $time: time});
		await sql.run(`UPDATE Plants SET StartTime = StartTime + $time WHERE Channel = $channel`,
			{$channel: channel, $time: time});
		await sql.run(`UPDATE Nemesis SET Nemesis_Time = Nemesis_Time + $time, Attack_Time = Attack_Time + $time,
			Destroy_Time = Destroy_Time + $time, Energize_Time = Energize_Time + $time, Revive_Time = Revive_Time + $time,
			Burn_Time = Burn_Time + $time, Ruin_Time = Ruin_Time + $time, Nemesis_Cooldown = Nemesis_Cooldown + $time WHERE Channel = $channel`,
			{$channel: channel, $time: time});
		await sql.run(`UPDATE Tournaments SET Round_Time = Round_Time + $time WHERE Channel = $channel`,
			{$channel: channel, $time: time});
	}
	
}