const enums = require('./enum.js');
const sql = require ('sqlite');
sql.open('./data.sqlite');

const hour = (60 * 60 * 1000);

const initTablesSql = `
CREATE TABLE IF NOT EXISTS Worlds (ID INTEGER PRIMARY KEY, Channel TEXT, Heat REAL, Resets INTEGER, Max_Population INTEGER, 
	Lost_Orbs INTEGER, Last_Wish INTEGER, Last_Update INTEGER, Start_Time INTEGER, Episode INTEGER);
CREATE TABLE IF NOT EXISTS Episodes (ID INTEGER, Channel TEXT, Air_Date INTEGER, Summary TEXT);
CREATE TABLE IF NOT EXISTS Players (ID INTEGER PRIMARY KEY, Username TEXT, User_ID TEXT, Name TEXT, Channel TEXT, Power_Level REAL, Fusion_ID INTEGER,
    Action_Level REAL, Garden_Level REAL, Glory INTEGER, Last_Active INTEGER, Last_Fought INTEGER, 
	Overdrive_Count INTEGER, Nemesis_Flag INTEGER, Fusion_Flag INTEGER, Wish_Flag INTEGER, 
	NPC INTEGER, AlwaysPrivate_Flag INTEGER, Ping_Flag INTEGER, Pronoun INTEGER);
CREATE TABLE IF NOT EXISTS Config (ID INTEGER PRIMARY KEY, Channel TEXT, Player_ID INTEGER, Key TEXT, Value TEXT);
CREATE TABLE IF NOT EXISTS Status (ID INTEGER PRIMARY KEY, Channel TEXT, Player_ID INTEGER, Type INTEGER,
	StartTime INTEGER, EndTime INTEGER, Rating REAL);
CREATE TABLE IF NOT EXISTS HeldItems (Channel TEXT, Player_ID INTEGER, Item_ID INTEGER, Count INTEGER);
CREATE TABLE IF NOT EXISTS Items (ID INTEGER, Channel TEXT, Known INTEGER);
CREATE TABLE IF NOT EXISTS Offers (ID INTEGER PRIMARY KEY, Channel TEXT, Player_ID INTEGER, Target_ID INTEGER, Type INTEGER, Extra TEXT, Expires INTEGER);
CREATE TABLE IF NOT EXISTS Gardens (Channel TEXT, Size_Level REAL, Growth_Level REAL, Research_Level REAL);
CREATE TABLE IF NOT EXISTS Plants (ID INTEGER PRIMARY KEY, Channel TEXT, Plant_Type INTEGER, StartTime INTEGER, Slot INTEGER);
CREATE TABLE IF NOT EXISTS Nemesis (Channel TEXT, Player_ID INTEGER, Start_Time INTEGER, Nemesis_Type INTEGER, Last_Ruin_Update INTEGER, Base_Power REAL);
CREATE TABLE IF NOT EXISTS Underlings (Channel TEXT, Player_ID INTEGER, Defeats INTEGER);
CREATE TABLE IF NOT EXISTS History (Channel TEXT, Battle_Time INTEGER, Winner_ID INTEGER, Loser_ID INTEGER,
    Winner_Level REAL, Loser_Level REAL,
	Winner_Skill REAL, Loser_Skill REAL,
	Winner_Name TEXT, Loser_Name TEXT);
CREATE TABLE IF NOT EXISTS Tournaments (Channel TEXT, Organizer_ID INTEGER, Status INTEGER, Type INTEGER, 
    Round INTEGER, Round_Time INTEGER, Next_Tournament_Time INTEGER);
CREATE TABLE IF NOT EXISTS TournamentPlayers (Channel TEXT, Player_ID INTEGER);
CREATE TABLE IF NOT EXISTS TournamentMatches (ID INTEGER, Left_Parent_ID INTEGER, Right_Parent_ID INTEGER, 
    Left_Player_ID INTEGER, Right_Player_ID INTEGER);
CREATE UNIQUE INDEX IF NOT EXISTS Worlds_Channel ON Worlds(Channel);
CREATE UNIQUE INDEX IF NOT EXISTS Players_ID ON Players(ID); 
CREATE UNIQUE INDEX IF NOT EXISTS Status_ChannelStatusRating ON Status(Channel, Player_ID, Type, Rating);
CREATE UNIQUE INDEX IF NOT EXISTS HeldItems_ChannelPlayerItem ON HeldItems(Channel, Player_ID, Item_ID);
CREATE UNIQUE INDEX IF NOT EXISTS Items_IDChannel ON Items(ID, Channel);
CREATE UNIQUE INDEX IF NOT EXISTS Offers_ChannelPlayerTargetType ON Offers(Channel, Player_ID, Target_ID, Type);
CREATE UNIQUE INDEX IF NOT EXISTS Gardens_Channel ON Gardens(Channel);
CREATE UNIQUE INDEX IF NOT EXISTS Plants_ID ON Plants(ID);
CREATE UNIQUE INDEX IF NOT EXISTS Nemesis_Channel ON Nemesis(Channel);
CREATE UNIQUE INDEX IF NOT EXISTS Underlings_ChannelPlayer ON Underlings(Channel, Player_ID);
CREATE UNIQUE INDEX IF NOT EXISTS Tournaments_Channel ON Tournaments(Channel);
CREATE UNIQUE INDEX IF NOT EXISTS TournamentPlayers_ChannelPlayer ON TournamentPlayers(Channel, Player_ID);
CREATE UNIQUE INDEX IF NOT EXISTS Config_PlayerKey ON Config(Player_ID, Key);
`

const newChannelSql = `DELETE FROM Worlds WHERE Channel = $channel;
DELETE FROM Gardens WHERE Channel = $channel;
DELETE FROM Items WHERE Channel = $channel;
INSERT OR REPLACE INTO Worlds (Channel, Heat, Resets, Max_Population, Lost_Orbs, Last_Wish, Start_Time) VALUES ($channel, 0, 0, 0, 7, 0, $now);
INSERT OR REPLACE INTO Items (ID, Channel, Known) VALUES (0, $channel, 0);
INSERT OR REPLACE INTO Items (ID, Channel, Known) VALUES (1, $channel, 1);
INSERT OR REPLACE INTO Items (ID, Channel, Known) VALUES (2, $channel, 0);
INSERT OR REPLACE INTO Items (ID, Channel, Known) VALUES (3, $channel, 0);
INSERT OR REPLACE INTO Items (ID, Channel, Known) VALUES (4, $channel, 0);
INSERT OR REPLACE INTO Items (ID, Channel, Known) VALUES (5, $channel, 0);
INSERT OR REPLACE INTO Items (ID, Channel, Known) VALUES (6, $channel, 0);
INSERT OR REPLACE INTO Gardens (Channel) VALUES ($channel)`;

const updatePlayerSql = `UPDATE Players SET
    Username = $username, 
	Name = $name,
	User_ID = $userId,
    Channel = $channel,
    Power_Level = $powerLevel,
    Garden_Level = $gardenLevel,
    Action_Level = $actionLevel,
    Garden_Level = $gardenLevel,
    Glory = $glory,
	Last_Active = $lastActive,
	Last_Fought = $lastFought,
	Overdrive_Count = $overdriveCount,
    Nemesis_Flag = $nemesisFlag,
    Fusion_Flag = $fusionFlag,
    Wish_Flag = $wishFlag,
    NPC = $npc
WHERE ID = $id AND Channel = $channel`;

const insertPlayerSql = `INSERT INTO Players (Username, User_ID, Name, Channel, Power_Level,
	Action_Level, Garden_Level, Glory, Last_Active, Last_Fought, Overdrive_Count,
	Nemesis_Flag, Fusion_Flag, Wish_Flag, NPC) 
VALUES ($username, $userId, $name, $channel, $powerLevel, $actionLevel, $gardenLevel, $glory, 
	$lastActive, $lastFought, $overdriveCount, $nemesisFlag, $fusionFlag, $wishFlag, $npc)`;

const updateNemesisSql = `INSERT OR REPLACE INTO Nemesis 
(Channel, Player_ID, Nemesis_Type, Start_Time, Last_Ruin_Update, Base_Power)
VALUES ($channel, $playerId, $type, $startTime, $lastRuinUpdate, $basePower)`;

module.exports = {
	// Sets up tables and such for an empty DB.
    async initializeGame() {
		const queries = initTablesSql.split(';');
		for(const i in queries) {
			const query = queries[i];
			await sql.run(query);
		}
	},
	// Sets up basic Status/Item/Garden info for a new channel.
    async initializeChannel(channel) {
		const now = new Date().getTime();
        const queries = newChannelSql.split(';');
		for(const i in queries) {
			const query = queries[i];
			let params = {};
			if(query.indexOf('$channel') > -1) {
				params['$channel'] = channel;
			}
			if(query.indexOf('$now') > -1) {
				params['$now'] = now;
			}
			await sql.run(query, params);
		}

		// Make one random plant known
		const knownPlant = Math.floor(Math.random() * 5) + 2;
		await sql.run(`UPDATE Items SET Known = 1 WHERE ID = $id AND Channel = $channel`, {$id: knownPlant, $channel: channel});
		console.log(`Channel ${channel} initialized`);
	},
	// Debug commands to run arbitrary SQL. Be careful, admin.
    async execute(command) {
		if(command.startsWith('run') || command.startsWith('get') || command.startsWith('all')) {
			command = command.substring(4);
		}
		if(command.toUpperCase().indexOf('SELECT') > -1) {
			console.log(await sql.all(command));
		} else {
            const result = await sql.run(command);
			console.log(`Query complete, ${result.changes} rows updated`);
		}
	},
	// Fetches basic world data.
	async getWorld(channel) {
		const row = await sql.get(`SELECT * FROM Worlds WHERE Channel = $channel`, {$channel: channel});
		const statusRows = await sql.all(`SELECT * FROM Status WHERE Channel = $channel AND Type = $type AND Player_ID IS NULL`, 
			{$channel: channel, $type: enums.Statuses.Cooldown});
		if(row) {
			const world = {
				channel: channel,
				heat: row.Heat,
				resets: row.Resets,
				maxPopulation: row.Max_Population,
				lostOrbs: row.Lost_Orbs,
				lastWish: row.Last_Wish,
				lastUpdate: row.Last_Update,
				startTime: row.Start_Time,
				episode: row.Episode,
				cooldowns: statusRows.map(c => { return {
					type: c.Rating,
					endTime: c.EndTime
				}})
			};
			
			return world;
		} else {
			return null;
		}
	},
	async setWorld(world) {
		await sql.run(`UPDATE Worlds SET Heat = $heat, Resets = $resets, Max_Population = $maxPopulation, 
			Lost_Orbs = $lostOrbs, Last_Wish = $lastWish, Start_Time = $startTime WHERE Channel = $channel`,
		{
			$heat: world.heat,
			$resets: world.resets,
			$maxPopulation: world.maxPopulation,
			$lostOrbs: world.lostOrbs,
			$lastWish: world.lastWish,
			$channel: world.channel,
			$startTime: world.startTime
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
				$gardenLevel: player.gardenLevel, 
				$glory: player.glory, 
				$lastActive: player.lastActive,
				$lastFought: player.lastFought,
				$overdriveCount: player.overdriveCount,
				$nemesisFlag:  player.nemesisFlag ? 1 : 0,
				$fusionFlag: player.fusionFlag ? 1 : 0, 
				$wishFlag: player.wishFlag ? 1 : 0, 
				$npc: player.npc,
			});
		let playerId = result.lastID;
		for(var i in player.config) {
			this.setConfig(player.channel, playerId, i, player.config[i]);
		}
		return playerId;
	},
	async setConfig(channel, playerId, key, value) {
		let storageValue = value;
		switch(enums.Configs.Type) {
			case 'bool':
				storageValue = value ? 1 : 0;
				break;
		}
		await sql.run(`INSERT OR REPLACE INTO Config (Channel, Player_ID, Key, Value) VALUES ($channel, $playerId, $key, $value)`,
			{
				$channel: channel,
				$playerId: playerId,
				$key: key,
				$value: storageValue
			});
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
            $glory: player.glory,
			$lastActive: player.lastActive,
			$lastFought: player.lastFought,
			$overdriveCount: player.overdriveCount,
            $nemesisFlag: player.nemesisFlag ? 1 : 0,
            $fusionFlag: player.fusionFlag ? 1 : 0,
            $wishFlag: player.wishFlag ? 1 : 0,
            $npc: player.npc,
		});
		for(var i in player.config) {
			await this.setConfig(player.channel, player.id, i, player.config[i]);
		}
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
        const row = await sql.get(`SELECT * FROM Players WHERE Channel = $channel AND username = $username`, {$channel: channel, $username: name});
		if(row) {
			return await this.fusionCheck(row);
		} else {
			return null;
		}
    },
	// Fetches a player from the database by player ID.
    async getPlayerById(id) {
        const row = await sql.get(`SELECT * FROM Players p WHERE p.ID = $id`, {$id: id});
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
        const offerRows = await sql.all(`SELECT o.*, p.Name FROM Offers o 
			LEFT JOIN Players p ON o.Player_ID = p.ID
			WHERE o.Target_ID = $id OR (o.Target_ID IS NULL AND o.Player_ID <> $id AND o.Channel = $channel)`, {$id: row.ID, $channel: row.Channel});
		const itemRows = await sql.all(`SELECT DISTINCT * FROM HeldItems WHERE Player_ID = $id`, {$id: row.ID});
		const statusRows = await sql.all(`SELECT * FROM Status WHERE Player_ID = $id`, {$id: row.ID});
		const nemesisRow = await sql.get(`SELECT * FROM Nemesis WHERE Channel = $channel`, {$channel: row.Channel});
		const fusionRows = await sql.all(`SELECT * FROM Players WHERE Fusion_ID = $id AND ID != $id`, {$id: row.ID});
		const configRows = await sql.all(`SELECT * FROM Config WHERE Player_ID = $id`, {$id: row.ID});
		const underlingsRows = await this.getUnderlings(row.Channel);

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
			overdriveCount: row.Overdrive_Count,
			nemesisFlag: row.Nemesis_Flag != 0,
			fusionFlag: row.Fusion_Flag != 0,
			wishFlag: row.Wish_Flag != 0,
			npc: row.NPC,
			config: {},
			cooldowns: statusRows.filter(s => s.Type == enums.Statuses.Cooldown).map(c => { return {
				id: c.ID,
				type: c.Rating,
				endTime: c.EndTime
			}}),
			offers: offerRows.map(o => { return {
				id: o.ID,
				playerId: o.Player_ID,
				targetId: o.Target_ID,
				type: o.Type,
				expires: o.Expires,
				name: o.Name,
				extra: o.Extra
			}}),
			status: statusRows.filter(s => s.Type != enums.Statuses.Cooldown).map(s => { return {
				id: s.ID,
				type: s.Type,
				name: enums.Statuses.Name[s.Type],
				priority: enums.Statuses.Priority[s.Type],
				startTime: s.StartTime,
				endTime: s.EndTime,
				rating: s.Rating
			}}),
			items: itemRows.map(i => { return {
				type: i.Item_ID,
				count: i.Count
			}}),
			fusionId: row.Fusion_ID,
			fusionNames: [],
			fusionIDs: []
		};

		for(var i in enums.Configs) {
			if(i == 'Defaults') continue;
			var configValue = configRows.find(row => row.Key == i);
			if(configValue && configValue.Value) {
				switch(enums.Configs.Type[i]) {
					case 'bool':
						player.config[i] = configValue.Value == true;
						break;
					default:
						player.config[i] = configValue.Value;
						break;
				}
			} else {
				player.config[i] = enums.Configs.Defaults[i];
			}
		}

		if(fusionRows.length == 2) {
			player.fusionNames.push(fusionRows[0].Name);
			player.fusionIDs.push(fusionRows[0].ID);
			player.fusionNames.push(fusionRows[1].Name);
			player.fusionIDs.push(fusionRows[1].ID);
		}
		
		player.isNemesis = nemesisRow && nemesisRow.Player_ID == player.id;
		const underling = underlingsRows.find(h => h.id == player.id);
		if(underling) {
			player.isUnderling = true;
			player.underlingDefeats = underling.defeats;
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
	async addStatus(channel, playerId, statusId, duration, rating) {
		await sql.run(`INSERT OR REPLACE INTO Status (Channel, Player_ID, Type, StartTime, EndTime, Rating) 
			VALUES ($channel, $playerId, $statusId, $startTime, $endTime, $rating)`,
			{
				$channel: channel,
				$playerId: playerId,
				$statusId: statusId,
				$startTime: new Date().getTime(),
				$endTime: new Date().getTime() + duration,
				$rating: rating ? rating : 0 // Null doesn't index properly
			});
	},
	// Start a new plant.
	async addPlant(channel, plantType, slot) {
		const now = new Date().getTime();
		await sql.run(`INSERT INTO Plants (Channel, Plant_Type, StartTime, Slot) VALUES ($channel, $type, $startTime, $slot)`, 
			{$channel: channel, $type: plantType, $startTime: now, $slot: slot});
	},
	// Gives a new item to a player
	async addItems(channel, playerId, itemId, count) {
		const existingItem = await sql.get(`SELECT Count FROM HeldItems WHERE Player_ID = $playerId AND Item_ID = $itemId`,
			{$playerId: playerId, $itemId: itemId});
		if(existingItem) {
			const newCount = existingItem.Count + count;
			if(newCount <= 0) {
				await sql.run(`DELETE FROM HeldItems WHERE Player_ID = $playerId AND Item_ID = $itemId`, 
					{$playerId: playerId, $itemId: itemId});
			} else {
				await sql.run(`UPDATE HeldItems SET Count = $count WHERE Player_ID = $playerId AND Item_ID = $itemId`, 
					{$playerId: playerId, $itemId: itemId, $count: newCount});
			}
		} else if(count > 0) {
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
		await sql.run(`UPDATE Gardens SET Growth_Level = $growthLevel, Research_Level = $researchLevel,
			Size_Level = $sizeLevel WHERE Channel = $channel`, 
			{$growthLevel: garden.growthLevel, $researchLevel: garden.researchLevel, $sizeLevel: garden.sizeLevel, $channel: garden.channel});
	},
	async setStatus(status) {
		await sql.run(`UPDATE Status SET StartTime = $startTime, EndTime = $endTime WHERE ID = $id`, 
			{$startTime: status.startTime, $endTime: status.endTime, $id: status.id});
	},
	// Delete an Offer.
	async deleteOffer(playerId, targetId, type) {
		await sql.run(`DELETE FROM Offers WHERE Player_ID = $playerId AND Target_ID = $targetId AND Type = $type`, {$playerId: playerId, $targetId: targetId, $type: type});
	},
	// Delete a Status.
	async deleteStatus(channel, playerId, type) {
		await sql.run(`DELETE FROM Status WHERE Player_ID = $playerId AND Type = $type`, {$playerId: playerId, $type: type});
		if(type == 0) {
			// Ending a KO status = become capable of training
			await this.addStatus(channel, playerId, 5);
		}
	},
	// Delete all Status for a player.
	async annihilatePlayer(channel, playerId) {
		const orbs = await sql.get(`SELECT Count FROM HeldItems WHERE Player_ID = $playerId AND Item_ID = 0`, {$playerId: playerId});
		if(orbs) {
			await sql.get(`UPDATE Worlds SET Lost_Orbs = Lost_Orbs + $orbs WHERE Channel = $channel`, {$channel: channel, $orbs: orbs.Count});
		}
		await sql.run(`DELETE FROM Status WHERE Player_ID = $playerId`, {$playerId: playerId});
		await sql.run(`DELETE FROM Offers WHERE Player_ID = $playerId OR Target_ID = $playerId`, {$playerId: playerId});
		await sql.run(`DELETE FROM HeldItems WHERE Player_ID = $playerId`, {$playerId: playerId});
	},
	// Delete a Status.
	async deleteStatusById(channel, id) {
		const row = await sql.get(`SELECT * FROM Status WHERE ID = $id`, {$id: id});
		await sql.run(`DELETE FROM Status WHERE ID = $id`, {$id: id});
		if(row && row.Type == 0) {
			// Ending a KO status = become capable of training
			await this.addStatus(channel, row.Player_ID, 5);
		}
	},
	// Delete a Player and all associated items/statuses.
	async deletePlayer(playerId) {
		await sql.run(`DELETE FROM Players WHERE ID = $playerId`, {$playerId: playerId});
		await sql.run(`DELETE FROM HeldItems WHERE Player_ID = $playerId`, {$playerId: playerId});
		await sql.run(`DELETE FROM Status WHERE Player_ID = $playerId`, {$playerId: playerId});
		await sql.run(`DELETE FROM Offers WHERE Player_ID = $playerId OR Target_ID = $playerId`, {$playerId: playerId});
	},
	// Delete a Plant.
	async deletePlant(plantId) {
		await sql.run(`DELETE FROM Plants WHERE ID = $plantId`, {$plantId: plantId});
	},
	// Get Nemesis info for a channel.
	async getNemesis(channel) {
		const row = await sql.get(`SELECT * FROM Nemesis WHERE Channel = $channel`, {$channel: channel});
		if(row) {
			const nemesis = {
				id: row.Player_ID,
				channel: row.Channel,
				type: row.Nemesis_Type,
				startTime: row.Start_Time,
				lastRuinUpdate: row.Last_Ruin_Update,
				basePower: row.Base_Power
			};
			return nemesis;
		} else {
			return null;
		}
	},
	// Get the history of players who fought the Nemesis.
	async getNemesisHistory(channel) {
		const nemesis = await sql.get(`SELECT * FROM Nemesis WHERE Channel = $channel`, {$channel: channel});
		if(nemesis) {
			const rows = await sql.all(`SELECT h.*, l.Name, l.Glory FROM History h
			LEFT JOIN Players l ON l.ID = h.Loser_ID
			WHERE h.Winner_ID = $nemesisId AND h.Battle_Time > $nemesisTime`, {$nemesisId: nemesis.Player_ID, $nemesisTime: nemesis.Start_Time});
			const history = rows.map(r => {
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
			$lastRuinUpdate: nemesis.lastRuinUpdate,
			$basePower: nemesis.basePower
        });
	},
	// Get Garden info.
	async getGarden(channel) {
		const gardenRow = await sql.get(`SELECT * FROM Gardens WHERE Channel = $channel`, {$channel: channel});
		const plantRows = await sql.all(`SELECT * FROM Plants WHERE Channel = $channel ORDER BY Slot`, {$channel: channel});
		const itemRows = await sql.all(`SELECT * FROM Items WHERE Channel = $channel`, {$channel: channel});
		if(gardenRow) {
			let garden = {
				channel: channel,
				growthLevel: gardenRow.Growth_Level ? gardenRow.Growth_Level : 0,
				researchLevel: gardenRow.Research_Level ? gardenRow.Research_Level : 0,
				sizeLevel: gardenRow.Size_Level ? gardenRow.Size_Level : 0,
			};
			garden.plants = plantRows.map(p => { return {
				id: p.ID,
				slot: p.Slot,
				type: p.Plant_Type,
				name: enums.Items.Name[p.Plant_Type],
				growTime: enums.Items.GrowTime[p.Plant_Type],
				startTime: p.StartTime,
				endTime: p.StartTime + (enums.Items.GrowTime[p.Plant_Type] * hour / (1 + 0.1 * garden.growthLevel))
			}});
			garden.plantTypes = itemRows.map(i => { return {
				id: i.ID,
				known: i.Known
			}});
			garden.slots = Math.floor(garden.sizeLevel + 3);

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
		const rows = await sql.all(`SELECT ID, Name FROM Players WHERE Channel = $channel ORDER BY UPPER(Name)`, {$channel: channel});
		let players = [];
		for(const i in rows) {
			const row = rows[i];
			const player = await this.getPlayerById(row.ID);
			players.push(player);
		}
		return players;
	},
	// Get all Offers in a channel.
	async getOffers(channel) {
		const offers = await sql.all(`SELECT o.*, p.Name AS PlayerName, t.Name AS TargetName FROM Offers o
			LEFT JOIN Players p ON o.Player_ID = p.ID
			LEFT JOIN Players t ON o.Target_ID = t.ID
			WHERE o.Channel = $channel`, {$channel: channel});
		return offers;
	},
	// Returns all expired statuses, expired offers, and offers that are within 5 minutes of expiring.
	async getExpired(channel, pings) {
		const now = new Date().getTime();
		const offerRows = await sql.all(`SELECT * FROM Offers
			WHERE Channel = $channel AND Expires < $fivemins`, {$channel: channel, $fivemins: now - (5 * 60 * 1000)});
		const statusRows = (await sql.all(`SELECT * FROM Status
			WHERE Channel = $channel`, {$channel: channel})).filter(row => enums.Statuses.Ends[row.Type] && row.EndTime < now);
		
		return {
			offers: offerRows.map(o => { return {
				id: o.ID,
				channel: o.Channel,
				type: o.Type,
				expires: o.Expires,
				playerId: o.Player_ID,
				targetId: o.Target_ID,
				extra: o.Extra
			}}),
			statuses: statusRows.map(s => { return {
				id: s.ID,
				channel: s.Channel,
				type: s.Type,
				playerId: s.Player_ID,
				startTime: s.StartTime,
				endTime: s.EndTime,
				rating: s.Rating
			}})
		};
	},
	async addHistory(channel, winnerId, winnerLevel, winnerSkill, loserId, loserLevel, loserSkill) {
		const winner = sql.get(`SELECT * FROM Players WHERE ID = $id`, {$id: winnerId});
		const loser = sql.get(`SELECT * FROM Players WHERE ID = $id`, {$id: loserId});
		await sql.run(`INSERT INTO History (Channel, Battle_Time, Winner_Id, Loser_ID, Winner_Level, Loser_Level, Winner_Skill, Loser_Skill, Winner_Name, Loser_Name)
			VALUES ($channel, $battleTime, $winnerId, $loserId, $winnerLevel, $loserLevel, $winnerSkill, $loserSkill, $winnerName, $loserName)`, {
			$channel: channel,
			$battleTime: new Date().getTime(),
			$winnerId: winnerId,
			$winnerSkill: winnerSkill,
			$winnerLevel: winnerLevel,
			$winnerName: winner.Name,
			$loserId: loserId,
			$loserSkill: loserSkill,
			$loserLevel: loserLevel,
			$loserName: loser.Name
		});
	},
	async resetWorld(channel) {
		const now = new Date().getTime();
		await sql.run(`UPDATE Worlds SET Heat = 0, Resets = Resets + 1, Start_Time = $now WHERE Channel = $channel`,
			{$channel: channel, $now: now});
		await sql.run(`UPDATE Gardens SET Growth_Level = 0, Research_Level = 0, Size_Level = 0
			WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Status WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Offers WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM HeldItems WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Nemesis WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Underlings WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Tournaments WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Tournament_Players WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Tournament_Brackets WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`UPDATE Items SET Known = 0 WHERE Channel = $channel`, {$channel: channel});

		// Make one random plant known
		const knownPlant = Math.floor(Math.random() * 5) + 2;
		await sql.run(`UPDATE Items SET Known = 1 WHERE ID = $id AND Channel = $channel`, {$id: knownPlant, $channel: channel});
		console.log(`Channel ${channel} initialized`);
	},
	async clone(channel, name, targetName) {
		let player = await this.getPlayerByUsername(channel, name);
		player.name = targetName;
		player.username = targetName;
		await this.addPlayer(player);
	},
	// THIS IS HIGHLY DESTRUCTIVE. ONLY RUN WITH BACKUP DATA YOU ARE PREPARED TO LOSE.
	async importChannel(channel, importChannel) {
		if(!channel || !importCHannel) return;
		await sql.run(`DELETE FROM Worlds WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Players WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Items WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM HeldItems WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Offers WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Status WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Gardens WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Plants WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Nemesis WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Underlings WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM History WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`UPDATE Worlds SET Channel = $channel WHERE Channel = $importChannel`, {$channel: channel, $importChannel: importChannel});
		await sql.run(`UPDATE Players SET Channel = $channel WHERE Channel = $importChannel`, {$channel: channel, $importChannel: importChannel});
		await sql.run(`UPDATE Items SET Channel = $channel WHERE Channel = $importChannel`, {$channel: channel, $importChannel: importChannel});
		await sql.run(`UPDATE HeldItems SET Channel = $channel WHERE Channel = $importChannel`, {$channel: channel, $importChannel: importChannel});
		await sql.run(`UPDATE Offers SET Channel = $channel WHERE Channel = $importChannel`, {$channel: channel, $importChannel: importChannel});
		await sql.run(`UPDATE Status SET Channel = $channel WHERE Channel = $importChannel`, {$channel: channel, $importChannel: importChannel});
		await sql.run(`UPDATE Gardens SET Channel = $channel WHERE Channel = $importChannel`, {$channel: channel, $importChannel: importChannel});
		await sql.run(`UPDATE Plants SET Channel = $channel WHERE Channel = $importChannel`, {$channel: channel, $importChannel: importChannel});
		await sql.run(`UPDATE Nemesis SET Channel = $channel WHERE Channel = $importChannel`, {$channel: channel, $importChannel: importChannel});
		await sql.run(`UPDATE Underlings SET Channel = $channel WHERE Channel = $importChannel`, {$channel: channel, $importChannel: importChannel});
		await sql.run(`UPDATE History SET Channel = $channel WHERE Channel = $importChannel`, {$channel: channel, $importChannel: importChannel});
	},
	async autofight(channel, targetName) {
		const player = await this.getPlayer(channel, targetName);
		await this.addOffer(player, null, enums.OfferTypes.Fight);
	},
	async getChannels() {
		const initialized = await sql.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='Worlds'`);
		if(!initialized) {
			return [];
		}
		const worlds = await sql.all(`SELECT Channel FROM Worlds`);
		return worlds.map(w => w.Channel);
	},
	async setUpdateTime(channel) {
		const now = new Date().getTime();
		await sql.run(`UPDATE Worlds SET Last_Update = $now WHERE Channel = $channel`, {$now: now, $channel: channel});
	},
	async playerActivity(channel, username) {
		const now = new Date().getTime();
		const player = await this.getPlayerByUsername(channel, username);
		if(!player) return;
		player.lastActive = now;
		await this.setPlayer(player);
	},
	async unfightOffers(id) {
		await sql.run(`DELETE FROM Offers WHERE Player_ID = $id AND Type IN (0, 3)`, {$id: id});
	},
	async getOutgoingOffers(id) {
		return await sql.all(`SELECT * FROM Offers WHERE Player_ID = $id`, {$id: id}).map(row => { return {
			id: row.ID,
			playerId: row.Player_ID,
			targetId: row.Target_ID,
			type: row.Type
		}});
	},
	async getHistory(player1Id, player2Id) {
		let history = [];
		if(player2Id && player1Id != player2Id) {
			history = await sql.all(`SELECT * FROM History 
				WHERE (Winner_ID = $player1Id AND Loser_ID = $player2Id) 
				OR (Winner_ID = $player2Id AND Loser_ID = $player1Id) ORDER BY Battle_Time DESC`, {
				$player1Id: player1Id,
				$player2Id: player2Id
			});
		} else {
			history = await sql.all(`SELECT * FROM History
			WHERE Winner_ID = $player1Id OR Loser_ID = $player1Id ORDER BY Battle_Time DESC`, {
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
	async researchPlant(channel, plantId) {
		await sql.run(`UPDATE Items SET Known = 1 WHERE Channel = $channel AND ID = $id`, {$channel: channel, $id: plantId});
	},
	async setUnderling(channel, playerId, isUnderling) {
		if(isUnderling) {
			await sql.run(`INSERT OR REPLACE INTO Underlings (Channel, Player_ID, Defeats) VALUES ($channel, $id, 0)`, {$channel: channel, $id: playerId});
		} else {
			await sql.run(`DELETE FROM Underlings WHERE Channel = $channel AND Player_ID = $id`, {$channel: channel, $id: playerId});
		}
	},
	async getUnderlings(channel) {
		return await sql.all(`SELECT Player_ID AS id, Defeats as defeats FROM Underlings WHERE Channel = $channel`, {$channel: channel});
	},
	async endNemesis(channel) {
		await sql.run(`DELETE FROM Underlings WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Status WHERE Channel = $channel AND Type = 3`, {$channel: channel});
		await sql.run(`DELETE FROM Status WHERE Channel = $channel AND Type = 13 AND Player_ID IS NULL AND Rating = 12`, {$channel: channel});
		await sql.run(`UPDATE Nemesis SET Player_ID = NULL WHERE Channel = $channel`, {$channel: channel});
		await this.deleteRecruitOffers(channel);
	},
	async deleteRecruitOffers(channel) {
		await sql.run(`DELETE FROM Offers WHERE Channel = $channel AND Type = 2`, {$channel: channel});
	},
	async recordUnderlingDefeat(channel, playerId) {
		return await sql.all(`UPDATE Underlings SET Defeats = Defeats + 1 WHERE Channel = $channel AND Player_ID = $id`, {$channel: channel, $id: playerId});
	},
	async fastForward(channel, time) {
		await sql.run(`UPDATE Worlds SET Last_Update = Last_Update + $time WHERE Channel = $channel`,
			{$channel: channel, $time: time});
		await sql.run(`UPDATE Players SET Last_Active = Last_Active + $time, Last_Fought = Last_Fought + $time
			WHERE Channel = $channel`,
			{$channel: channel, $time: time});
		await sql.run(`UPDATE Status SET StartTime = StartTime + $time, EndTime = EndTime + $time WHERE Channel = $channel`,
			{$channel: channel, $time: time});
		await sql.run(`UPDATE Offers SET Expires = Expires + $time WHERE Channel = $channel`,
			{$channel: channel, $time: time});
		await sql.run(`UPDATE Plants SET StartTime = StartTime + $time WHERE Channel = $channel`,
			{$channel: channel, $time: time});
		await sql.run(`UPDATE Nemesis SET Start_Time = Start_Time + $time WHERE Channel = $channel`,
			{$channel: channel, $time: time});
		await sql.run(`UPDATE Tournaments SET Round_Time = Round_Time + $time WHERE Channel = $channel`,
			{$channel: channel, $time: time});
	},
	async delayOffer(channel, playerId, targetId, type) {
		const delayTime = new Date().getTime() + 5 * 60 * 1000;
		await sql.run(`UPDATE Offers SET Expires = $time WHERE Channel = $channel AND Player_ID = $playerId AND Target_ID = $targetId AND Type = $type`,
			{
				$time: delayTime,
				$channel: channel,
				$playerId: playerId,
				$targetId: targetId, 
				$type: type
			});
	},
	// Ends the universe.
	async endWorld(channel) {
		await sql.run(`UPDATE Worlds SET Start_Time = NULL WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Offers WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`UPDATE Status SET EndTime = $now - 1 WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`UPDATE Nemesis SET Ruin_Time = NULL WHERE CHannel = $channel`, {$channel: channel});
	},
	async scatterOrbs(channel) {
		await sql.run(`DELETE FROM HeldItems WHERE Channel = $channel AND Item_ID = 0`, {$channel: channel});
		await sql.run(`UPDATE Worlds SET Lost_Orbs = 7 WHERE Channel = $channel`, {$channel: channel});
	},
	async getEpisode(channel, episode) {
		return await sql.get(`SELECT ID as id, Air_Date as airDate, Summary as summary FROM Episodes WHERE ID = $episode AND Channel = $channel`,
			{$channel: channel, $episode: episode});
	},
	async addEpisode(channel, summary) {
		const row = await sql.get(`SELECT Episode FROM Worlds WHERE Channel = $channel`, {$channel: channel});
		const episodeNumber = row ? row.Episode : 1;
		await sql.run(`INSERT INTO Episodes (ID, Channel, Air_Date, Summary) VALUES ($id, $channel, $airDate, $summary)`, 
			{$id: episodeNumber, $channel: channel, $airDate: new Date().getTime(), $summary: summary});
		await sql.run(`UPDATE Worlds SET Episode = $episode WHERE Channel = $channel`, {$channel: channel, $episode: episodeNumber + 1});
	}
}