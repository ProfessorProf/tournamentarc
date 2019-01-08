const enums = require('./enum.js');
const sql = require ('sqlite');
sql.open('./data.sqlite');

const hour = (60 * 60 * 1000);

const updateSql = `
ALTER TABLE Players ADD COLUMN Legacy_Glory INTEGER`;

const initTablesSql = `
CREATE TABLE IF NOT EXISTS Worlds (ID INTEGER PRIMARY KEY, Channel TEXT, Heat REAL, Resets INTEGER,
	Last_Wish INTEGER, Last_Update INTEGER, Start_Time INTEGER, Episode INTEGER, Offset INTEGER, Arc INTEGER, LastArc INTEGER);
CREATE TABLE IF NOT EXISTS Episodes (ID INTEGER, Channel TEXT, Air_Date INTEGER, Summary TEXT, Arc INTEGER);
CREATE TABLE IF NOT EXISTS Players (ID INTEGER PRIMARY KEY, Username TEXT, User_ID TEXT, Name TEXT, Channel TEXT, Power_Level REAL, Fusion_ID INTEGER,
    Action_Level REAL, Garden_Level REAL, Glory INTEGER, Legacy_Glory INTEGER, Last_Active INTEGER, Last_Fought INTEGER, 
	NPC INTEGER);
CREATE TABLE IF NOT EXISTS Config (ID INTEGER PRIMARY KEY, Channel TEXT, Player_ID INTEGER, Key TEXT, Value TEXT);
CREATE TABLE IF NOT EXISTS Status (ID INTEGER PRIMARY KEY, Channel TEXT, Player_ID INTEGER, Type INTEGER,
	StartTime INTEGER, EndTime INTEGER, Rating REAL);
CREATE TABLE IF NOT EXISTS HeldItems (Channel TEXT, Player_ID INTEGER, Item_ID INTEGER, Count INTEGER, Decay_Time INTEGER);
CREATE TABLE IF NOT EXISTS Items (ID INTEGER, Channel TEXT, Known INTEGER);
CREATE TABLE IF NOT EXISTS Offers (ID INTEGER PRIMARY KEY, Channel TEXT, Player_ID INTEGER, Target_ID INTEGER, Type INTEGER, Extra TEXT, Expires INTEGER);
CREATE TABLE IF NOT EXISTS Gardens (Channel TEXT, Size_Level REAL, Growth_Level REAL, Research_Level REAL);
CREATE TABLE IF NOT EXISTS Plants (ID INTEGER PRIMARY KEY, Channel TEXT, Plant_Type INTEGER, StartTime INTEGER, Slot INTEGER, Planter_ID INTEGER);
CREATE TABLE IF NOT EXISTS Nemesis (Channel TEXT, Player_ID INTEGER, Start_Time INTEGER, Form INTEGER, Max_Forms INTEGER, Last_Ruin_Update INTEGER, Base_Power REAL);
CREATE TABLE IF NOT EXISTS Underlings (Channel TEXT, Player_ID INTEGER, Defeats INTEGER);
CREATE TABLE IF NOT EXISTS History (Channel TEXT, Battle_Time INTEGER, Episode INTEGER, Winner_ID INTEGER, Loser_ID INTEGER,
    Winner_Level REAL, Loser_Level REAL,
	Winner_Skill REAL, Loser_Skill REAL,
	Winner_Name TEXT, Loser_Name TEXT);
CREATE TABLE IF NOT EXISTS Tournaments (Channel TEXT, Organizer_ID INTEGER, Status INTEGER, Type INTEGER, 
    Round INTEGER, Reward INTEGER);
CREATE TABLE IF NOT EXISTS TournamentPlayers (Channel TEXT, Player_ID INTEGER, Position INTEGER, Status INTEGER);
CREATE TABLE IF NOT EXISTS Arcs (ID INTEGER PRIMARY KEY, Channel TEXT, Number INTEGER, Type INTEGER, Start_Time INTEGER, End_Time INTEGER);
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
INSERT OR REPLACE INTO Worlds (Channel, Heat, Resets, Last_Wish, Start_Time, Episode) VALUES ($channel, 0, 0, 0, $now, 1);
INSERT OR REPLACE INTO Items (ID, Channel, Known) VALUES (0, $channel, 0);
INSERT OR REPLACE INTO Items (ID, Channel, Known) VALUES (1, $channel, 1);
INSERT OR REPLACE INTO Items (ID, Channel, Known) VALUES (2, $channel, 0);
INSERT OR REPLACE INTO Items (ID, Channel, Known) VALUES (3, $channel, 0);
INSERT OR REPLACE INTO Items (ID, Channel, Known) VALUES (4, $channel, 0);
INSERT OR REPLACE INTO Items (ID, Channel, Known) VALUES (5, $channel, 0);
INSERT OR REPLACE INTO Items (ID, Channel, Known) VALUES (6, $channel, 0);
INSERT OR REPLACE INTO Items (ID, Channel, Known) VALUES (10, $channel, 0);
INSERT OR REPLACE INTO Items (ID, Channel, Known) VALUES (11, $channel, 0);
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
	Legacy_Glory = $legacyGlory,
	Last_Active = $lastActive,
	Last_Fought = $lastFought,
	NPC = $npc
WHERE ID = $id AND Channel = $channel`;

const insertPlayerSql = `INSERT INTO Players (Username, User_ID, Name, Channel, Power_Level,
	Action_Level, Garden_Level, Glory, Last_Active, Last_Fought,
	NPC) 
VALUES ($username, $userId, $name, $channel, $powerLevel, $actionLevel, $gardenLevel, $glory, 
	$lastActive, $lastFought, $npc)`;

const updateNemesisSql = `INSERT OR REPLACE INTO Nemesis 
(Channel, Player_ID, Form, Max_Forms, Start_Time, Last_Ruin_Update, Base_Power)
VALUES ($channel, $playerId, $form, $maxForms, $startTime, $lastRuinUpdate, $basePower)`;

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

		let offset = (await sql.get(`SELECT Offset FROM Worlds ORDER BY ID`)).Offset;
		if(!offset) offset = Math.floor(Math.random() * 1000);
		await sql.run(`UPDATE Worlds SET Offset = $offset WHERE Channel = $channel`, {$offset: offset, $channel: channel});

		// Make one random plant known
		const knownPlant = Math.floor(Math.random() * 5) + 2;
		await sql.run(`UPDATE Items SET Known = 1 WHERE ID = $id AND Channel = $channel`, {$id: knownPlant, $channel: channel});
		console.log(`Channel ${channel} initialized`);
		return await this.getWorld(channel);
	},
	async update() {
		const queries = updateSql.split(';');
		for(const query of queries) {
			try {
				await sql.run(query);
			} catch(e) {
				console.log(e);
			}
		}

		let offset = (await sql.get(`SELECT Offset FROM Worlds ORDER BY ID`)).Offset;
		await sql.run(`UPDATE Worlds SET Offset = $offset`, {$offset: offset});
		if(!offset) offset = Math.floor(Math.random() * 1000);

		const channels = (await sql.all(`SELECT Channel FROM Worlds`)).map(row => row.Channel);
		for(const channel of channels) {
			await sql.run(`INSERT OR REPLACE INTO Items (ID, Channel, Known) VALUES (10, $channel, 0)`, {$channel: channel});
			await sql.run(`INSERT OR REPLACE INTO Items (ID, Channel, Known) VALUES (11, $channel, 0)`, {$channel: channel});
		}
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
		const players = await this.getPlayers(channel);
		const statusRows = await sql.all(`SELECT * FROM Status WHERE Channel = $channel AND Type = $type AND Player_ID IS NULL`, 
			{$channel: channel, $type: enums.Statuses.Cooldown});
		const orbRows = await sql.get(`SELECT SUM(Count) as Count FROM HeldItems WHERE Channel = $channel AND Item_ID = $type`,
			{$channel: channel, $type: enums.Items.Orb});
		if(row) {
			const arcRow = await sql.get(`SELECT * FROM Arcs WHERE ID = $arc`, {$arc: row.Arc});
			const lastArcRow = await sql.get(`SELECT * FROM Arcs WHERE ID = $arc`, {$arc: row.LastArc});
			const world = {
				id: (row.ID * 739 + row.Offset) % 1000, // Human-usable ID for up to 1000 worlds
				channel: channel,
				heat: row.Heat,
				resets: row.Resets,
				population: players.length,
				lostOrbs: orbRows ? 7 - orbRows.Count : 7,
				lastWish: row.Last_Wish,
				lastUpdate: row.Last_Update,
				startTime: row.Start_Time,
				episode: row.Episode,
				cooldowns: statusRows.map(c => { return {
					id: c.ID,
					type: c.Rating,
					endTime: c.EndTime
				}})
			};

			if(arcRow) {
				world.arc = {
					id: arcRow.ID,
					number: arcRow.Number,
					type: arcRow.Type, 
					startTime: arcRow.Start_Time
				};
			} else {
				world.arc = {
					id: null,
					number: 1,
					type: enums.ArcTypes.Filler,
					startTime: world.startTime
				};
			}
			
			if(lastArcRow) {
				world.lastArc = {
					id: lastArcRow.ID,
					number: lastArcRow.Number,
					type: lastArcRow.Type, 
					startTime: lastArcRow.Start_Time,
					endTime: lastArcRow.End_Time
				};
			} else {
				world.lastArc = {
					id: null,
					number: 1,
					type: enums.ArcTypes.Filler,
					startTime: world.startTime
				};
			}
			
			return world;
		} else {
			return null;
		}
	},
	async getWorlds() {
		const worldRows = await sql.all(`SELECT Channel FROM Worlds`);
		let worlds = [];
		for(let i in worldRows) {
			const worldRow = worldRows[i];
			worlds.push(await this.getWorld(worldRow.Channel));
		}
		return worlds;
	},
	async setWorld(world) {
		await sql.run(`UPDATE Worlds SET Heat = $heat, Resets = $resets, 
			Last_Wish = $lastWish, Start_Time = $startTime WHERE Channel = $channel`,
		{
			$heat: world.heat,
			$resets: world.resets,
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
				$npc: player.npc
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
			$legacyGlory: player.legacyGlory,
			$lastActive: player.lastActive,
			$lastFought: player.lastFought,
			$npc: player.npc
		});
		for(var i in player.config) {
			await this.setConfig(player.channel, player.id, i, player.config[i]);
		}
	},
	// Fetches a player from the database by character name.
    async getPlayer(channel, name, includeAnnihilated) {
		if(!name) {
			return null;
		}
        // Exact name match
		let row = await sql.get(this.generatePlayerQuery(includeAnnihilated, `UPPER(p.name) = $name`), {$name: name.toUpperCase(), $channel: channel});
		if(!row) {
			// Starts With name match
			row = await sql.get(this.generatePlayerQuery(includeAnnihilated, `UPPER(p.name) LIKE ($namePattern)`), {$namePattern: name.toUpperCase() + '%', $channel: channel});
		}
		if(!row) {
			// Contains name match
			row = await sql.get(this.generatePlayerQuery(includeAnnihilated, `UPPER(p.name) LIKE ($namePattern)`), {$namePattern: '%' + name.toUpperCase() + '%', $channel: channel});
		}

		if(!includeAnnihilated && !row) {
			return await this.getPlayer(channel, name, true);
		}

		if(row) {
			return await this.fusionCheck(row);
		}
	},
	generatePlayerQuery(includeAnnihilated, pattern) {
		if(includeAnnihilated) {
			return `SELECT * FROM Players p WHERE Channel = $channel AND ${pattern}`;
		} else {
			return `SELECT p.* FROM Players p
					LEFT JOIN Status s ON s.Player_ID = p.ID
						AND s.Type = 15
					WHERE p.Channel = $channel
						AND s.ID IS NULL
						AND ${pattern}`;
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
		const now = new Date().getTime();
        const offerRows = await sql.all(`SELECT o.*, p.Name FROM Offers o 
			LEFT JOIN Players p ON o.Player_ID = p.ID
			WHERE o.Target_ID = $id OR (o.Target_ID IS NULL AND o.Player_ID <> $id AND o.Channel = $channel)`, {$id: row.ID, $channel: row.Channel});
		const itemRows = await sql.all(`SELECT DISTINCT * FROM HeldItems WHERE Player_ID = $id`, {$id: row.ID});
		const statusRows = await sql.all(`SELECT * FROM Status WHERE Player_ID = $id`, {$id: row.ID});
		const nemesisRow = await sql.get(`SELECT * FROM Nemesis WHERE Channel = $channel`, {$channel: row.Channel});
		const configRows = await sql.all(`SELECT * FROM Config WHERE Player_ID = $id`, {$id: row.ID});
		const fusionIds = (await sql.all(`SELECT ID FROM Players WHERE Fusion_ID = $id AND ID != $id`, {$id: row.ID})).map(row => row.ID);
		const underlingsRows = await this.getUnderlings(row.Channel);

		let player = {
			id: row.ID,
			username: row.Username,
			userId: row.User_ID,
			name: row.Name,
			channel: row.Channel,
			level: row.Power_Level,
			glory: row.Glory,
			legacyGlory: row.Legacy_Glory,
			lastActive: row.NPC ? now : row.Last_Active,
			lastFought: row.NPC ? now : row.Last_Fought,
			gardenLevel: row.Garden_Level,
			actionLevel: row.Action_Level,
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
			fusedPlayers: []
		};

		if(fusionIds && fusionIds.length > 0) {
			for(const id of fusionIds) {
				if(id != row.ID) {
					player.fusedPlayers.push(await this.getPlayerById(id));
				}
			}
		}

		player.idle = player.lastActive < now - 24 * hour;

		for(var i in enums.Configs) {
			if(i == 'Defaults' || i == 'Type') continue;
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
	async addPlant(player, plantType, slot) {
		const now = new Date().getTime();
		await sql.run(`INSERT INTO Plants (Channel, Planter_ID, Plant_Type, StartTime, Slot) VALUES ($channel, $planterId, $type, $startTime, $slot)`, 
			{$channel: player.channel, $planterId: player.id, $type: plantType, $startTime: now, $slot: slot});
	},
	// Gives a new item to a player
	async addItems(channel, playerId, itemId, count) {
		const now = new Date().getTime();
		if(count == 0) return;
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
	async deleteStatus(playerId, type) {
		await sql.run(`DELETE FROM Status WHERE Player_ID = $playerId AND Type = $type`, {$playerId: playerId, $type: type});
	},
	// Delete all Status for a player.
	async annihilatePlayer(playerId) {
		await sql.run(`DELETE FROM Status WHERE Player_ID = $playerId`, {$playerId: playerId});
		await sql.run(`DELETE FROM Offers WHERE Player_ID = $playerId OR Target_ID = $playerId`, {$playerId: playerId});
		await sql.run(`DELETE FROM HeldItems WHERE Player_ID = $playerId`, {$playerId: playerId});
		await sql.run(`UPDATE Players SET Fusion_ID = NULL WHERE Fusion_ID = $playerId`, {$playerId: playerId});
	},
	// Delete a Status.
	async deleteStatusById(id) {
		await sql.run(`DELETE FROM Status WHERE ID = $id`, {$id: id});
	},
	// Delete an Offer.
	async deleteOfferById(id) {
		await sql.run(`DELETE FROM Offers WHERE ID = $id`, {$id: id});
	},
	// Delete a Player and all associated items/statuses.
	async deletePlayer(playerId) {
		await sql.run(`DELETE FROM Players WHERE ID = $playerId`, {$playerId: playerId});
		await sql.run(`DELETE FROM HeldItems WHERE Player_ID = $playerId`, {$playerId: playerId});
		await sql.run(`DELETE FROM Status WHERE Player_ID = $playerId`, {$playerId: playerId});
		await sql.run(`DELETE FROM Underlings WHERE Player_ID = $playerId`, {$playerId: playerId});
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
				form: row.Form,
				maxForms: row.Max_Forms,
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
			$form: nemesis.form,
			$maxForms: nemesis.maxForms,
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
				planterId: p.Planter_ID,
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
			garden.slots = Math.min(Math.floor(garden.sizeLevel), 6);

			return garden;
		} else {
			null;
		}
	},
	// Delete all offers for a player who was just defeated.
	async deleteOffersForPlayer(playerId) {
		await sql.run(`DELETE FROM Offers WHERE Player_ID = $playerId OR Target_ID = $playerId`, {$playerId: playerId});
	},
	// Delete all guarding of or from a player who was just defeated.
	async deleteGuardingForPlayer(playerId) {
		await sql.run(`DELETE FROM Status WHERE Type = $type AND (Player_ID = $playerId OR Rating = $playerId)`, 
			{$playerId: playerId, $type: enums.Statuses.Guarded});
	},
	// Delete all open offers of a given type
	async deleteOpenOffers(playerId, type) {
		await sql.run(`DELETE FROM Offers WHERE Player_ID = $playerId AND Type = $type AND Target_ID IS NULL`, 
			{$playerId: playerId, $type: type});
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
	async getPlayers(channel, includeAnnihilated) {
		const rows = await sql.all(`SELECT ID, Name FROM Players WHERE Channel = $channel ORDER BY UPPER(Name)`, {$channel: channel});
		let players = [];
		for(const row of rows) {
			const player = await this.getPlayerById(row.ID);
			if(includeAnnihilated || !player.status.find(s => s.type == enums.Statuses.Annihilation)) {
				players.push(player);
			}
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
			WHERE Channel = $channel`, {$channel: channel})).filter(row => row.EndTime && row.EndTime < now);
		
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
		const episodeRow = await sql.get(`SELECT Episode FROM Worlds WHERE Channel = $channel`, {$channel: channel});
		const winner = await sql.get(`SELECT * FROM Players WHERE ID = $id`, {$id: winnerId});
		const loser = await sql.get(`SELECT * FROM Players WHERE ID = $id`, {$id: loserId});
		const episodeNumber = episodeRow ? episodeRow.Episode : 1;
		await sql.run(`INSERT INTO History (Channel, Episode, Battle_Time, Winner_Id, Loser_ID, Winner_Level, Loser_Level, Winner_Skill, Loser_Skill, Winner_Name, Loser_Name)
			VALUES ($channel, $episode, $battleTime, $winnerId, $loserId, $winnerLevel, $loserLevel, $winnerSkill, $loserSkill, $winnerName, $loserName)`, {
			$channel: channel,
			$episode: episodeNumber,
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
		await sql.run(`UPDATE Worlds SET Heat = 0, Resets = Resets + 1, Episode = 1, Start_Time = $now WHERE Channel = $channel`,
			{$channel: channel, $now: now});
		await sql.run(`UPDATE Gardens SET Growth_Level = 0, Research_Level = 0, Size_Level = 0
			WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Status WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Offers WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM HeldItems WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Nemesis WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Underlings WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM History WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Tournaments WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM TournamentPlayers WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Plants WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Players WHERE Channel = $channel AND NPC > 0`, {$channel: channel});
		await sql.run(`DELETE FROM Episodes WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`UPDATE Items SET Known = 0 WHERE Channel = $channel`, {$channel: channel});

		// Make one random plant known
		const knownPlant = Math.floor(Math.random() * 5) + 2;
		await sql.run(`UPDATE Items SET Known = 1 WHERE ID = $id AND Channel = $channel`, {$id: knownPlant, $channel: channel});
		await sql.run(`UPDATE Items SET Known = 1 WHERE ID = 1 AND Channel = $channel`, {$channel: channel});

		// Start the first arc
		const result = await sql.run('INSERT INTO Arcs (Channel, Number, Type, Start_Time) VALUES ($channel, 1, 0, $now)',
			{$channel: channel, $now: now});
		await sql.run(`UPDATE Worlds SET Arc = $arcId`, {$arcId: result.lastID});

		console.log(`Channel ${channel} initialized`);
	},
	async clone(player, targetName) {
		const name = player.name;
		const username = player.username;
		player.name = targetName;
		player.username = targetName;
		await this.addPlayer(player);
		player.name = name;
		player.username = username;
	},
	// THIS IS HIGHLY DESTRUCTIVE. ONLY RUN WITH BACKUP DATA YOU ARE PREPARED TO LOSE.
	async importChannel(channel, importChannel) {
		if(!channel || !importChannel) return;
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
	async playerActivity(channel, name) {
		let player = await this.getPlayerByUsername(channel, name);
		const now = new Date().getTime();
		if(!player) return;
		await sql.run(`UPDATE Players SET Last_Active = $now WHERE ID = $id`, {$id: player.id, $now: now});
	},
	async unfightOffers(id) {
		await sql.run(`DELETE FROM Offers WHERE Player_ID = $id AND Type IN (0, 3)`, {$id: id});
	},
	async getOutgoingOffers(id) {
		return (await sql.all(`SELECT * FROM Offers WHERE Player_ID = $id`, {$id: id})).map(row => { return {
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
				episode: h.Episode,
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
		await sql.run(`UPDATE Arcs SET Start_Time = Start_Time + $time WHERE Channel = $channel`,
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
	},
	async scatterOrbs(channel) {
		await sql.run(`DELETE FROM HeldItems WHERE Channel = $channel AND Item_ID = 0`, {$channel: channel});
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
	},
	async getTournament(channel) {
		const tournamentRow = await sql.get(`SELECT * FROM Tournaments WHERE Channel = $channel`, {$channel: channel});
		const playerRows = await sql.all(`SELECT t.*, p.Name FROM TournamentPlayers t
			LEFT JOIN Players p ON p.ID = t.Player_ID
			WHERE t.Channel = $channel ORDER BY t.Position`, {$channel: channel});

		if(!tournamentRow) {
			return null;
		}

		let players = []
		for(const row of playerRows) {
			while(players.length < row.Position) {
				players.push(null);
			}
			players.push({
				id: row.Player_ID,
				name: row.Name,
				position: row.Position,
				status: row.Status
			});
		}

		let tournament = {
			channel: tournamentRow.Channel,
			organizerId: tournamentRow.Organizer_ID,
			status: tournamentRow.Status,
			type: tournamentRow.Type,
			round: tournamentRow.Round,
			reward: tournamentRow.Reward,
			players: players
		};

		return tournament;
	},
	async setTournament(tournament) {
		await sql.run(`INSERT OR REPLACE INTO Tournaments (Channel, Organizer_ID, Status, Type, Round, Reward) VALUES ` +
			`($channel, $organizerId, $status, $type, $round, $reward)`, {
				$channel: tournament.channel,
				$organizerId: tournament.organizerId,
				$status: tournament.status,
				$type: tournament.type,
				$round: tournament.round,
				$reward: tournament.reward
			});
		if(tournament.players) {
			for(const player of tournament.players) {
				if(player) {
					const existingPlayer = await sql.get(`SELECT * FROM TournamentPlayers WHERE Player_ID = $id`, {$id: player.id});
					if(existingPlayer) {
						await sql.run(`UPDATE TournamentPlayers SET Position = $position, Status = $status WHERE Player_ID = $id`, 
							{$id: player.id, $position: player.position, $status: player.status});
					} else {
						await this.joinTournament(tournament.channel, player.id, player.position);
					}
				}
			}
		} else {
			await sql.run(`DELETE FROM TournamentPlayers WHERE Channel = $channel`, {$channel: tournament.channel});
		}
	},
	async joinTournament(channel, id, position) {
		await sql.run(`INSERT OR REPLACE INTO TournamentPlayers (Channel, Player_ID, Position) VALUES ($channel, $id, $position)`, 
			{$channel: channel, $id: id, $position: position});
	},
	async eliminatePlayer(id) {
		await sql.run(`DELETE FROM TournamentPlayers WHERE Player_ID = $id`, {$id: id});
	},
	async worldExists(channel) {
		const dbExists = await sql.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='Worlds'`);
		if(dbExists) {
			const world = await sql.get(`SELECT * FROM Worlds WHERE Channel = $channel`, {$channel: channel});
			return world;
		}
		return false;
	},
	async newArc(channel, type) {
		const now = new Date().getTime();

		// Get the current arc
		const world = await sql.get(`SELECT * FROM Worlds WHERE Channel = $channel`, {$channel: channel});
		const oldArc = await sql.get(`SELECT * FROM Arcs WHERE ID = $id`, {$id: world.Arc});

		let number = oldArc ? oldArc.Number : 1;

		if(oldArc) {
			if(oldArc.Type == enums.ArcTypes.Filler && oldArc.Start_Time + 1 * hour > now) {
				// Filler arcs under an hour aren't saved
				await sql.run(`DELETE FROM Arcs WHERE ID = $id`, {$id: oldArc.ID});
			} else {
				await sql.run(`UPDATE Arcs SET End_Time = $now WHERE ID = $id`, 
					{$id: oldArc.ID, $now: now});
				number++;
			}

			if(type == enums.ArcTypes.Filler && oldArc.Type != enums.ArcTypes.Filler) {
				// Record the last arc type
				await sql.run(`UPDATE Worlds SET LastArc = $arc WHERE Channel = $channel`, {$arc: oldArc.ID, $channel: channel});
			}
		}

		const result = await sql.run(`INSERT INTO Arcs (Channel, Number, Type, Start_Time) VALUES ($channel, $number, $type, $now)`,
			{$channel: channel, $number: number, $type: type, $now: now});
		await sql.run(`UPDATE Worlds SET Arc = $arc WHERE Channel = $channel`, {$arc: result.lastID, $channel: channel});
	},
	async getPortal(channel) {
		const portal = await sql.get(`SELECT * FROM Portals WHERE Channel = $channel`, {$channel: channel});
		if(!portal) return null;
		return {
			id: portal.ID,
			channel: portal.Channel,
			targetChannel: portal.TargetChannel,
			energyBuffs: portal.EnergyBuffs
		};
	},
	async newPortal(channel, targetChannel) {
		await sql.run(`INSERT OR REPLACE INTO Portals (Channel, TargetChannel, EnergyBuffs) VALUES ($channel, $targetChannel, 0)`,
			{$channel: channel, $targetChannel: targetChannel});
		await sql.run(`INSERT OR REPLACE INTO Portals (Channel, TargetChannel, EnergyBuffs) VALUES ($channel, $targetChannel, 0)`,
			{$channel: targetChannel, $targetChannel: channel});
	},
	async setPortal(portal) {
		await sql.run(`UPDATE Portals SET TargetChannel = $targetChannel, EnergyBuffs = $energyBuffs WHERE Channel = $channel`,
			{$targetChannel: portal.targetChannel, $energyBuffs: portal.energyBuffs, $channel: portal.channel});
	},
	async deletePortal(channel, targetChannel) {
		await sql.run(`DELETE FROM Portals WHERE Channel = $channel AND TargetChannel = $targetChannel`,
			{$channel: channel, $targetChannel: targetChannel});
		await sql.run(`DELETE FROM Portals WHERE Channel = $channel AND TargetChannel = $targetChannel`,
			{$channel: channel, $targetChannel: targetChannel});
	},
	async guarding(player) {
		const guarding = await sql.get(`SELECT * FROM Status WHERE Type = $type AND Rating = $rating`, {$type: enums.Statuses.Guarded, $rating: player.id});
		if(!guarding) return null;
		return await this.getPlayerById(player.channel, guarding.Player_ID);
	}
}