const enums = require('./enum.js');
const sql = require ('sqlite');
sql.open('./data.sqlite');

const hour = (60 * 60 * 1000);

const updateSql = `CREATE TABLE IF NOT EXISTS Techniques (ID INTEGER PRIMARY KEY, Channel TEXT, Name TEXT, Style_ID INTEGER, Power INTEGER);
CREATE TABLE IF NOT EXISTS FighterTechniques (ID INTEGER PRIMARY KEY, Fighter_ID INTEGER, Technique_ID INTEGER);
ALTER TABLE Fighters ADD Potential INTEGER;
ALTER TABLE Fighters ADD Age INTEGER`;

const initTablesSql = `CREATE TABLE IF NOT EXISTS Worlds (ID INTEGER PRIMARY KEY, Channel TEXT, Start_Time INTEGER, Last_Update INTEGER, Offset INTEGER);
CREATE TABLE IF NOT EXISTS Players (ID INTEGER PRIMARY KEY, Username TEXT, User_ID TEXT, Name TEXT, Channel TEXT, Coins INTEGER, Last_Active INTEGER);
CREATE TABLE IF NOT EXISTS Config (ID INTEGER PRIMARY KEY, Channel TEXT, Player_ID INTEGER, Key TEXT, Value TEXT);
CREATE TABLE IF NOT EXISTS Fighters (ID INTEGER PRIMARY KEY, Channel TEXT, Name TEXT, Strength INTEGER, Gender TEXT, Orientation TEXT, Style INTEGER, 
	Sponsors INTEGER, Preferred_Mood INTEGER, Mood INTEGER, Potential INTEGER, Age INTEGER);
CREATE TABLE IF NOT EXISTS FighterRelationships (Fighter_ID INTEGER, Related_Fighter_ID INTEGER, Type INTEGER);
CREATE TABLE IF NOT EXISTS Styles (ID INTEGER PRIMARY KEY, Channel TEXT, Name TEXT);
CREATE TABLE IF NOT EXISTS StyleMatchups (Attacker_ID INTEGER, Defender_ID INTEGER, Matchup INTEGER);
CREATE TABLE IF NOT EXISTS Tournaments (Channel TEXT, Status INTEGER, Round INTEGER, Next_Match INTEGER, Next_Attack INTEGER);
CREATE TABLE IF NOT EXISTS TournamentFighters (Channel TEXT, Fighter_ID INTEGER, Position INTEGER, Status INTEGER, Score INTEGER, Odds REAL, Bracket INTEGER);
CREATE TABLE IF NOT EXISTS History (ID INTEGER PRIMARY KEY, Fight_Time INTEGER, Winner_ID INTEGER, Loser_ID INTEGER, Winner_Score INTEGER, Loser_Score INTEGER);
CREATE TABLE IF NOT EXISTS Bets (ID INTEGER PRIMARY KEY, Channel TEXT, Player_ID INTEGER, Fighter_ID INTEGER, Amount INTEGER);
CREATE TABLE IF NOT EXISTS Sponsorships (ID INTEGER PRIMARY KEY, Channel TEXT, Player_ID INTEGER, Fighter_ID INTEGER);
CREATE TABLE IF NOT EXISTS Techniques (ID INTEGER PRIMARY KEY, Channel TEXT, Name TEXT, Style_ID INT, Power INT);
CREATE TABLE IF NOT EXISTS FighterTechniques (ID INTEGER PRIMARY KEY, Fighter_ID, Technique_ID);
CREATE UNIQUE INDEX IF NOT EXISTS Worlds_Channel ON Worlds(Channel);
CREATE UNIQUE INDEX IF NOT EXISTS Players_ID ON Players(ID); 
CREATE UNIQUE INDEX IF NOT EXISTS Fighter_ID ON Players(ID); 
CREATE UNIQUE INDEX IF NOT EXISTS Config_PlayerKey ON Config(Player_ID, Key);
CREATE UNIQUE INDEX IF NOT EXISTS FighterRelationships_FighterFighter ON FighterRelationships(Fighter_ID, Related_Fighter_ID);
CREATE UNIQUE INDEX IF NOT EXISTS Styles_ID ON Styles(ID);
CREATE UNIQUE INDEX IF NOT EXISTS StyleMatchups_StyleStyle ON StyleMatchups(Attacker_ID, Defender_ID);
CREATE UNIQUE INDEX IF NOT EXISTS Tournaments_Channel ON Tournaments(Channel);
CREATE UNIQUE INDEX IF NOT EXISTS History_ID ON History(ID);
CREATE UNIQUE INDEX IF NOT EXISTS Bet_Player ON Bets(Player_ID);
CREATE UNIQUE INDEX IF NOT EXISTS Sponsor_Player ON Sponsorships(Player_ID)`

const newChannelSql = `DELETE FROM Worlds WHERE Channel = $channel;
INSERT OR REPLACE INTO Worlds (Channel, Start_Time, Last_Update) VALUES ($channel, $now, $now)`;

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
		if(row) {
			const world = {
				id: (row.ID * 739 + row.Offset) % 1000, // Human-usable ID for up to 1000 worlds
				startTime: row.Start_Time,
				lastUpdate: row.Last_Update,
				channel: channel,
				population: players.length
			};
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
	//Worlds (ID INTEGER PRIMARY KEY, Channel TEXT, Start_Time INTEGER, Last_Update INTEGER, Offset INTEGER);
	async setWorld(world) {
		await sql.run(`UPDATE Worlds SET Start_Time = $startTime, Last_Update = $lastUpdate WHERE ID = $id`,
			{
				$startTime: world.startTime,
				$lastUpdate: world.lastUpdate,
				$id: world.id
			});
	},
	// Creates a new player in the DB.
    async setPlayer(player) {
		const existingPlayer = await sql.get(`SELECT ID FROM Players WHERE ID = $id`, { $id: player.id });
		if(existingPlayer) {
			await sql.run(`UPDATE Players SET Username = $username, User_ID = $userId, Name = $name, Channel = $channel, Coins = $coins, Last_Active = $lastActive
				WHERE ID = $id`,
				{
					$id: player.id,
					$username: player.username, 
					$userId: player.userId, 
					$name: player.name, 
					$channel: player.channel, 
					$coins: player.coins,
					$lastActive: player.lastActive
				});
			for(var i in player.config) {
				this.setConfig(player.channel, player.id, i, player.config[i]);
			}
			return player.id;
		} else {
			const result = await sql.run(`INSERT INTO Players (Username, User_ID, Name, Channel, Coins, Last_Active)
				VALUES ($username, $userId, $name, $channel, $coins, $lastActive)`,
				{
					$username: player.username, 
					$userId: player.userId, 
					$name: player.name, 
					$channel: player.channel, 
					$coins: player.coins,
					$lastActive: player.lastActive
				});
			let playerId = result.lastID;
			for(var i in player.config) {
				this.setConfig(player.channel, playerId, i, player.config[i]);
			}
			return playerId;
		}
	},
	// Creates a new fighter in the DB.
    async setFighter(fighter) {
		const existingFighter = await sql.get(`SELECT ID FROM Fighters WHERE ID = $id`, { $id: fighter.id });
		if(existingFighter) {
			await sql.run(`UPDATE Fighters SET Channel = $channel, Name = $name, Strength = $strength, Preferred_Mood = $preferredMood,
				Mood = $mood, Style = $style, Gender = $gender, Orientation = $orientation, Potential = $potential, Age = $age
				WHERE ID = $id`,
				{
					$id: fighter.id,
					$channel: fighter.channel,
					$name: fighter.name,
					$strength: fighter.strength,
					$preferredMood: fighter.preferredMood,
					$mood: fighter.mood,
					$style: fighter.style.id,
					$gender: fighter.gender,
					$orientation: fighter.orientation,
					$potential: fighter.potential,
					$age: fighter.age
				});
			return fighter.id;
		} else {
			const result = await sql.run(`INSERT INTO Fighters (Channel, Name, Strength, Preferred_Mood, Mood, Style, Gender, Orientation, Potential, Age)
				VALUES ($channel, $name, $strength, $preferredMood, $mood, $style, $gender, $orientation, $potential, $age)`,
				{
					$channel: fighter.channel,
					$name: fighter.name,
					$strength: fighter.strength,
					$preferredMood: fighter.preferredMood,
					$mood: fighter.mood,
					$style: fighter.style.id,
					$gender: fighter.gender,
					$orientation: fighter.orientation,
					$potential: fighter.potential,
					$age: fighter.age
				});
			let fighterId = result.lastID;
			return fighterId;
		}
	},
	async getFighter(channel, name) {
		if(!name) return null;
		
        // Exact name match
		let fighterRow = await sql.get(`SELECT f.*, s.ID AS StyleId, s.Name AS StyleName FROM Fighters f
			LEFT JOIN Styles s ON s.ID = f.Style
			WHERE f.Channel = $channel AND UPPER(f.Name) = $name`, { $channel: channel, $name: name.toUpperCase() });
		
		if(!fighterRow) {
			// Starts With name match
			fighterRow = await sql.get(`SELECT f.*, s.ID AS StyleId, s.Name AS StyleName FROM Fighters f
			LEFT JOIN Styles s ON s.ID = f.Style
			WHERE f.Channel = $channel AND UPPER(f.Name) LIKE $name`, { $channel: channel, $name: name.toUpperCase() + '%' });
		}

		if(!fighterRow) {
			// Contains name match
			fighterRow = await sql.get(`SELECT f.*, s.ID AS StyleId, s.Name AS StyleName FROM Fighters f
			LEFT JOIN Styles s ON s.ID = f.Style
			WHERE f.Channel = $channel AND UPPER(f.Name) LIKE $name`, { $channel: channel, $name: '%' + name.toUpperCase() + '%' });
		}

		return await this.getFighterInternal(fighterRow);
	},
	async getFighterById(fighterId) {
		let fighterRow = await sql.get(`SELECT f.*, s.ID AS StyleId, s.Name AS StyleName FROM Fighters f
			LEFT JOIN Styles s ON s.ID = f.Style
			WHERE f.ID = $id`, { $id: fighterId });
		
		return await this.getFighterInternal(fighterRow);
	},
	async getFighters(channel) {
		let fighterRows = await sql.all(`SELECT f.*, s.ID AS StyleId, s.Name AS StyleName FROM Fighters f
			LEFT JOIN Styles s ON s.ID = f.Style
			WHERE f.Channel = $channel`, { $channel: channel });

		let fighters = [];
		for(const i in fighterRows) {
			fighters.push(await this.getFighterInternal(fighterRows[i]));
		}
		
		return fighters;
	},
	async getFighterInternal(fighterRow) {
		if(fighterRow) {
			const styleMatchups = await sql.all(`SELECT * FROM StyleMatchups WHERE Attacker_ID = $id`, { $id: fighterRow.Style });
			const relationshipRows = await sql.all(`SELECT fr.*, f.Name FROM FighterRelationships fr
				JOIN Fighters f ON fr.Related_Fighter_ID = f.ID
				WHERE Fighter_ID = $id
				ORDER BY fr.Type`, { $id: fighterRow.ID });
			const sponsorshipRows = await sql.all(`SELECT s.*, p.Name FROM Sponsorships s
				JOIN Players p ON s.Player_ID = p.ID
				WHERE s.Fighter_ID = $id`, { $id: fighterRow.ID });
			const techRows = await sql.all(`SELECT t.* FROM FighterTechniques ft
				JOIN Techniques t ON t.ID = ft.Technique_ID
				WHERE ft.Fighter_ID = $id`, { $id: fighterRow.ID });
			let fighter = {
				id: fighterRow.ID,
				channel: fighterRow.Channel,
				name: fighterRow.Name,
				strength: fighterRow.Strength,
				preferredMood: fighterRow.Preferred_Mood,
				mood: fighterRow.Mood,
				gender: fighterRow.Gender,
				orientation: fighterRow.Orientation,
				potential: fighterRow.Potential,
				age: fighterRow.Age,
				techs: [],
				style: {
					id: fighterRow.StyleId,
					name: fighterRow.StyleName,
					matchups: []
				},
				relationships: [],
				sponsorships: []
			}

			for(const i in styleMatchups) {
				const matchup = styleMatchups[i];
				fighter.style.matchups.push({
					id: matchup.Defender_ID,
					effect: matchup.Matchup
				});
			}

			for(const i in relationshipRows) {
				const relationship = relationshipRows[i];
				fighter.relationships.push({
					id: relationship.Related_Fighter_ID,
					type: relationship.Type,
					name: relationship.Name
				});
			}

			for(const i in sponsorshipRows) {
				const sponsorship = sponsorshipRows[i];
				fighter.sponsorships.push({
					id: sponsorship.Player_ID,
					name: sponsorship.Name
				});
			}

			for(const i in techRows) {
				const tech = techRows[i];
				fighter.techs.push({
					id: tech.ID,
					name: tech.Name,
					power: tech.Power,
					styleId: tech.Style_ID,
					channel: tech.Channel
				});
			}

			return fighter;
		} else {
			return null;
		}
	},
	async setConfig(channel, playerId, key, value) {
		let storageValue = value;
		switch(enums.Configs.Type) {
			case 'bool':
				storageValue = value ? 1 : 0;
				break;
		}
		let existingRow = await sql.get(`SELECT * FROM Config WHERE Player_ID = $playerId AND Key = $key`, { $playerId: playerId, $key: key});
		if(existingRow) {
			await sql.run(`DELETE FROM Config WHERE Player_ID = $playerId AND Key = $key`, { $playerId: playerId, $key: key});
		}
		await sql.run(`INSERT INTO Config (Channel, Player_ID, Key, Value) VALUES ($channel, $playerId, $key, $value)`,
			{
				$channel: channel,
				$playerId: playerId,
				$key: key,
				$value: storageValue
			});
	},
	async addRelationship(fighter, targetId, type) {
		const existingRelationship = await sql.get(`SELECT * FROM FighterRelationships WHERE Fighter_ID = $fighterId AND Related_Fighter_ID = $targetId`,
			{ $fighterId: fighter.id, $targetId: targetId });
		
		if(existingRelationship) {
			await sql.run(`UPDATE FighterRelationships 
				SET Type = $type
				WHERE Fighter_ID = $fighterId AND Related_Fighter_ID = $targetId`,
			{ $fighterId: fighter.id, $targetId: targetId, $type: type });
		} else {
			await sql.run(`INSERT OR REPLACE INTO FighterRelationships (Fighter_ID, Related_Fighter_ID, Type) VALUES ($id, $relatedId, $type)`,
			{
				$id: fighter.id,
				$relatedId: targetId,
				$type: type
			});
		}
	},
	async deleteRelationship(fighter, targetId) {
		await sql.run(`DELETE FROM FighterRelationships WHERE Fighter_ID = $id AND Related_Fighter_ID = $relatedId`,
		{
			$id: fighter.id,
			$relatedId: targetId
		});
	},
	async addTechnique(fighter, tech) {
		const existingTech = await sql.get(`SELECT * FROM FighterTechniques WHERE Fighter_ID = $fighterId AND Technique_ID = $techniqueId`,
			{ $fighterId: fighter.id, $techniqueId: tech.id });
		
		if(!existingTech) {
			await sql.run(`INSERT INTO FighterTechniques (Fighter_ID, Technique_ID) VALUES ($fighterId, $techniqueId)`,
			{ $fighterId: fighter.id, $techniqueId: tech.id });
		}
	},
	// Fetches a player from the database by character name.
    async getPlayer(channel, name) {
		if(!name) {
			return null;
		}
        // Exact name match
		let row = await sql.get(this.generatePlayerQuery(`UPPER(p.name) = $name`), {$name: name.toUpperCase(), $channel: channel});
		if(!row) {
			// Starts With name match
			row = await sql.get(this.generatePlayerQuery(`UPPER(p.name) LIKE ($namePattern)`), {$namePattern: name.toUpperCase() + '%', $channel: channel});
		}
		if(!row) {
			// Contains name match
			row = await sql.get(this.generatePlayerQuery(`UPPER(p.name) LIKE ($namePattern)`), {$namePattern: '%' + name.toUpperCase() + '%', $channel: channel});
		}

		if(row) {
			return await this.getPlayerInternal(row);
		}
	},
	generatePlayerQuery(pattern) {
		return `SELECT p.* FROM Players p
				WHERE p.Channel = $channel
					AND ${pattern}`;
	},
	// Fetches a player from the database by user name.
    async getPlayerByUsername(channel, name) {
        // Get a player by username
        const row = await sql.get(`SELECT * FROM Players WHERE Channel = $channel AND username = $username`, {$channel: channel, $username: name});
		if(row) {
			return await this.getPlayerInternal(row);
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
	// Add Offers, Statuses and Items to a player and return it as a player object.
    async getPlayerInternal(row) {
		const now = new Date().getTime();
		const configRows = await sql.all(`SELECT * FROM Config WHERE Player_ID = $id`, {$id: row.ID});
		const sponsorshipRow = await sql.get(`SELECT s.ID, f.Name FROM Sponsorships s
			LEFT JOIN Fighters f ON f.ID = s.Fighter_ID WHERE Player_ID = $id`, {$id: row.ID});

		let player = {
			id: row.ID,
			username: row.Username,
			userId: row.User_ID,
			name: row.Name,
			channel: row.Channel,
			coins: row.Coins,
			lastActive: row.Last_Update,
			config: {}
		};

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

		if(sponsorshipRow) {
			player.sponsored = {
				id: sponsorshipRow.ID,
				name: sponsorshipRow.Name
			};
		}
		
		return player;
	},
	// Delete a Player and all associated items/statuses.
	async deletePlayer(playerId) {
		await sql.run(`DELETE FROM Players WHERE ID = $playerId`, {$playerId: playerId});
	},
	// Get all Players in a channel.
	async getPlayers(channel) {
		const rows = await sql.all(`SELECT ID, Name FROM Players WHERE Channel = $channel ORDER BY UPPER(Name)`, {$channel: channel});
		let players = [];
		for(const row of rows) {
			const player = await this.getPlayerById(row.ID);
			players.push(player);
		}
		return players;
	},
	async getStyle(channel, name) {
		const row = await sql.get(`SELECT * FROM Styles WHERE Channel = $channel AND Name = $name`, { $channel: channel, $name: name });
		
		if(!row) return null;

		return await this.getStyleInternal(row);
	},
	async getStyles(channel) {
		const styleRows = await sql.all(`SELECT * FROM Styles WHERE Channel = $channel`, { $channel: channel });
		
		let styles = [];
		for(const i in styleRows) {
			styles.push(await this.getStyleInternal(styleRows[i]));
		}
		return styles;
	},
	async getStyleInternal(styleRow) {

		const matchupRows = await sql.all(`SELECT * FROM StyleMatchups WHERE Attacker_ID = $id`, {$id: styleRow.ID});
		const techRows = await sql.all(`SELECT * FROM Techniques WHERE Style_ID = $id ORDER BY Power`, {$id: styleRow.ID});

		let style = {
			id: styleRow.ID,
			channel: styleRow.Channel,
			name: styleRow.Name,
			matchups: [],
			techs: []
		};

		for(const matchup of matchupRows) {
			style.matchups.push({
				id: matchup.Defender_ID,
				effect: matchup.Matchup
			});
		}

		for(const tech of techRows) {
			style.techs.push({
				id: tech.ID,
				styleId: style.id,
				name: tech.Name,
				power: tech.Power
			});
		}

		return style;
	},
	async setStyle(style) {
		const existingStyle = await sql.get(`SELECT * FROM Styles WHERE ID = $id`, { $id: style.id });
		
		let styleId = 0;
		let result = null;
		if(existingStyle) {
			result = await sql.run(`UPDATE Styles SET Channel = $channel, Name = $name WHERE ID = $id`,
				{ $id: style.id, $channel: style.channel, $name: style.name });
			styleId = result.lastID;
		} else {
			result = await sql.run(`INSERT INTO Styles (Channel, Name) VALUES ($channel, $name)`,
				{ $id: style.id, $channel: style.channel, $name: style.name });
			styleId = result.lastID;
		}

		for(let i in style.matchups) {
			const matchup = style.matchups[i];
			const existingMatchup = await sql.run(`SELECT * FROM StyleMatchups WHERE Attacker_ID = $attackerId AND Defender_ID = $defenderId`,
				{ $attackerId: style.id, $defenderId: matchup.id });
			if(existingMatchup) {
				await sql.run(`UPDATE StyleMatchups SET Matchup = $matchup WHERE Attacker_ID = $attackerId AND Defender_ID = $defenderId`,
					{ $attackerId: style.id, $defenderId: matchup.id, $matchup: matchup.effect });
			} else {
				await sql.run(`INSERT INTO StyleMatchups (Attacker_ID, Defender_ID, Matchup) VALUES ($attackerId, $defenderId, $matchup)`,
					{ $attackerId: style.id, $defenderId: matchup.id, $matchup: matchup.effect });
			}
		}

		for(let i in style.techs) {
			const tech = style.techs[i];
			await this.setTechnique(tech);
		}

		return styleId;
	},
	async getTechniqueByName(channel, name) {
		const techRow = await sql.get(`SELECT * FROM Techniques WHERE Channel = $channel AND Name = $name`, { $channel: channel, $name: name });
		if(techRow) {
			return {
				id: techRow.ID,
				name: techRow.Name,
				power: techRow.Power
			};
		} else {
			return null;
		}
	},
	async setTechnique(tech) {
		const existingTechRow = tech.id ? await sql.get(`SELECT * FROM Techniques WHERE ID = $id`, { $id: tech.id }) : null;
		if(existingTechRow) {
			await sql.run(`UPDATE Techniques SET Channel = $channel, Style_ID = $styleId, Name = $name, Power = $power
				WHERE ID = $id`, 
				{ $channel: tech.channel, $styleId: tech.styleId, $name: tech.name, $power: tech.power, $id: tech.id });
		} else {
			const result = await sql.run(`INSERT INTO Techniques (Channel, Style_ID, Name, Power)
				VALUES ($channel, $styleId, $name, $power)`,
				{ $channel: tech.channel, $styleId: tech.styleId, $name: tech.name, $power: tech.power });
			tech.id = result.lastID;
		}

		return tech;
	},
	async addHistory(winnerId, loserId, winnerScore, loserScore) {
		const now = new Date().getTime();
		await sql.run(`INSERT INTO History (Winner_ID, Winner_Score, Loser_ID, Loser_Score, Fight_Time)
			VALUES ($winnerId, $winnerScore, $loserId, $loserScore, $time)`, 
			{ $winnerId: winnerId, $winnerScore: winnerScore, $loserId: loserId, $loserScore: loserScore, $time: now });
	},
	async resetWorld(channel) {
		const now = new Date().getTime();
		await sql.run(`UPDATE Worlds SET Start_Time = $now WHERE Channel = $channel`,
			{$channel: channel, $now: now});
		await sql.run(`DELETE FROM History WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Tournaments WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM TournamentPlayers WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Fighters WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM FighterRelationships WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM Styles WHERE Channel = $channel`, {$channel: channel});
		await sql.run(`DELETE FROM StyleMatchups WHERE Channel = $channel`, {$channel: channel});

		console.log(`Channel ${channel} initialized`);
	},
	async clone(player, targetName) {
		player.name = targetName;
		player.username = targetName;
		player.id += 10000;
		await this.setPlayer(player);
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
	async getHistory(fighter1Id, fighter2Id) {
		const history = fighter2Id
			? await sql.all(`SELECT h.*, fw.Name AS Winner_Name, fl.Name AS Loser_Name FROM History h 
				LEFT JOIN Fighters fw ON h.Winner_ID = fw.ID
				LEFT JOIN Fighters fl ON h.Loser_ID = fl.ID
				WHERE (Winner_ID = $id1 AND Loser_ID = $id2) OR (Winner_ID = $id2 AND Loser_ID = $id1)`, { $id1: fighter1Id, $id2: fighter2Id })
			: await sql.all(`SELECT h.*, fw.Name AS Winner_Name, fl.Name AS Loser_Name FROM History h 
				LEFT JOIN Fighters fw ON h.Winner_ID = fw.ID
				LEFT JOIN Fighters fl ON h.Loser_ID = fl.ID
				WHERE Winner_ID = $id1 OR Loser_ID = $id1`, { $id1: fighter1Id });
		
		return history.map(h => { return {
			winner: {
				id: h.Winner_ID,
				score: h.Winner_Score,
				name: h.Winner_Name
			},
			loser: {
				id: h.Loser_ID,
				score: h.Loser_Score,
				name: h.Loser_Name
			},
			date: h.Fight_Time
		}});
	},
	async fastForward(channel, time) {
		await sql.run(`UPDATE Worlds SET Last_Update = Last_Update + $time WHERE Channel = $channel`,
			{$channel: channel, $time: time});
		await sql.run(`UPDATE Tournaments SET Next_Attack = Next_Attack + $time,
			Next_Match = Next_Match + $time WHERE Channel = $channel`,
			{$channel: channel, $time: time});
	},
	// Ends the universe.
	async endWorld(channel) {
		await sql.run(`UPDATE Worlds SET Start_Time = NULL WHERE Channel = $channel`, {$channel: channel});
	},
	async getTournament(channel) {
		const tournamentRow = await sql.get(`SELECT * FROM Tournaments WHERE Channel = $channel`, {$channel: channel});
		const fighterRows = await sql.all(`SELECT t.*, f.Name FROM TournamentFighters t
			LEFT JOIN Fighters f ON f.ID = t.Fighter_ID
			WHERE t.Channel = $channel ORDER BY t.Bracket, t.Position`, {$channel: channel});

		if(!tournamentRow) {
			return null;
		}

		let fighters = []
		for(const row of fighterRows) {
			while(fighters.length < row.Position) {
				fighters.push(null);
			}
			fighters.push({
				id: row.Fighter_ID,
				name: row.Name,
				position: row.Position,
				status: row.Status,
				score: row.Score,
				odds: row.Odds,
				bracket: row.Bracket
			});
		}

		let tournament = {
			channel: tournamentRow.Channel,
			status: tournamentRow.Status,
			round: tournamentRow.Round,
			nextMatch: tournamentRow.Next_Match,
			nextAttack: tournamentRow.Next_Attack,
			fighters: fighters
		};

		return tournament;
	},
	async setTournament(tournament) {
		await sql.run(`INSERT OR REPLACE INTO Tournaments (Channel, Status, Round, Next_Match, Next_Attack) VALUES ` +
			`($channel, $status, $round, $nextMatch, $nextAttack)`, {
				$channel: tournament.channel,
				$status: tournament.status,
				$round: tournament.round,
				$nextMatch: tournament.nextMatch,
				$nextAttack: tournament.nextAttack
			});
		if(tournament.fighters) {
			await sql.run(`DELETE FROM TournamentFighters WHERE Channel = $channel`, { $channel: tournament.channel });
			for(const fighter of tournament.fighters) {
				await this.joinTournament(tournament.channel, fighter);
			}
		}
	},
	async joinTournament(channel, fighter) {
		await sql.run(`INSERT INTO TournamentFighters (Channel, Fighter_ID, Position, Score, Status, Odds, Bracket) 
			VALUES ($channel, $id, $position, $score, $status, $odds, $bracket)`, 
			{ $channel: channel, $id: fighter.id, $position: fighter.position, $odds: fighter.odds, $bracket: fighter.bracket, $score: fighter.score, $status: fighter.status });
	},
	async eliminateFighter(fighter) {
		await sql.run(`DELETE FROM TournamentFighters WHERE Fighter_ID = $id AND Bracket = $bracket AND Position = $position`, 
		{ $id: fighter.id, $bracket: fighter.bracket, $position: fighter.position });
	},
	async addBet(channel, playerId, fighterId, amount) {
		const existingBet = await sql.get(`SELECT * FROM Bets WHERE Player_ID = $playerId`,
			{ $playerId: playerId });
		if(existingBet) {
			await sql.run(`UPDATE Players SET Coins = Coins + $amount WHERE ID = $id`, 
				{ $id: playerId, $amount: existingBet.Amount });
			await sql.run(`DELETE FROM Bets WHERE ID = $id`, { $id: existingBet.ID });
		}

		await sql.run(`UPDATE Players SET Coins = Coins - $amount WHERE ID = $id`, 
			{ $id: playerId, $amount: amount });
		if(amount > 0) {
			await sql.run(`INSERT INTO Bets (Channel, Player_ID, Fighter_ID, Amount) VALUES ($channel, $playerId, $fighterId, $amount)`,
				{ $channel: channel, $playerId: playerId, $fighterId: fighterId, $amount: amount });
		}
	},
	async addSponsor(playerId, fighterId) {
		const existingSponsorship = await sql.get(`SELECT * FROM Sponsorships WHERE Player_ID = $playerId`,
			{ $playerId: playerId });
		if(existingSponsorship) {
			await sql.run(`DELETE FROM Sponsorships WHERE ID = $id`, { $id: existingSponsorship.ID });
		}

		await sql.run(`INSERT INTO Sponsorships (Player_ID, Fighter_ID) VALUES ($playerId, $fighterId)`,
			{ $playerId: playerId, $fighterId: fighterId });
	},
	async getBets(channel) {
		const betRows = await sql.all(`SELECT * FROM Bets WHERE Channel = $channel`, { $channel: channel });
		return betRows.map(row => {
			return {
				id: row.ID,
				playerId: row.Player_ID,
				fighterId: row.Fighter_ID,
				amount: row.Amount
			};
		});
	},
	async deleteBets(channel) {
		await sql.run(`DELETE FROM Bets WHERE Channel = $channel`, { $channel: channel });
	},
	async worldExists(channel) {
		const dbExists = await sql.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='Worlds'`);
		if(dbExists) {
			const world = await sql.get(`SELECT * FROM Worlds WHERE Channel = $channel`, {$channel: channel});
			return world;
		}
		return false;
	}
}