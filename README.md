# Power Level Bot
A Discord Bot where you power up and have DBZ fights with each other.

# How to Use
Expanding this later:
- Download code.
- Update auth.json with your username.
- Maybe invite bot to server?
- `node bot.js`
- Run `!init` before doing anything else.
- If you want a fresh start, delete `data.sqlite`.

# Database spec
Writing this later.

# Remaining Work for S3
- Port all old commands over to the Sqlite data schema.
- As players join the game, track the largest number of active players at once as Max_Population.
- AddHeat needs to be updated to scale based on the size of the server - Heat /= 1 + (Math.Max(10, MaxPop) / 10)
- !unfight command - deletes all Fight offers from that player.
- !give command - transfers one orb to another player.
- !journey command - details later.
- Garden restructure.
- !recruit and !join commands for the Nemesis to recruit henchmen.
- !energize command to power up henchmen.
- Honor henchmen properties in other places.
- !revive command to revive henchmen.
- !burn command to destroy plants.
- !tournament command - details later.
- !history command - displays past battle history between two players.
- Indicate in !check when further training won't make you any stronger.
- !config command.
- !empower command.
- !overdrive command.

# Working with SQLite async nonsense
Old:
```
var info = data.info;
actOnInfo(info);
```
New:
```
sql.getInfo(channel, info => {
    actOnInfo(info);
});
```
It's more of a hassle, but the program is much more powerful and flexible now.