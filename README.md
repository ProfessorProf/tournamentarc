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

# New features for S5:
- Garden: "!plant" no longer takes a garden action.
- Garden: You can no longer use plants while defeated.
- Garden: That aside, all plants can now be given to others or used on yourself.
- Garden: Players are limited to one plant planted by them in the garden at a time.
- Garden: If you don't use a plant for 3 days, it will decay.
- Garden: Size limit reduced to 8 slots.
- Garden: When your Power Level is hidden by a fern, you can still see it with a private "!check".
- Garden: New plant "gourd".
- Garden: New plant "peach".
- Actions: "!filler" now splits its healing between every named player.
- Actions: "!search" rebalanced so that underlings with carrots no longer have 70%+ search rates.
- Actions: "!search" can sometimes begin a channel-wide special event.
- Actions: New "!event" command that does different things based on what kind of world event is going on.
- Nemesis: Instead of once per season, you can become Nemesis once every 7 days.
- Nemesis: Using "!wish snap" now ends your reign as the Nemesis.
- Nemesis: Once a ruin timer starts, anyone on a journey can use "!return" to abandon it early.
- Nemesis: Defeating an Immortal player as the Nemesis drops them for 3 hours instead of 1.
- Fusion: Instead of once per season, you can now use !fuse once every 7 days.
- Fusion: Certain actions now require both players to enter the command.
- Wishes: Instead of once per season, you can now use !wish once every 7 days.
- New: A new mysterious attribute has been added to all players.
- New: !steal command can steal orbs from the nemesis or their underlings.
- New: Effects that scale by channel size now go by the current active population instead of the historical maximum.
- New: !transform command replacing overdrive.
New: !tournament command to run in-game battle tournaments.
- Bugfix: Glory gained for defeating the Nemesis was wrong.
- Bugfix: "Totals Glory" should say "Total Glory".
- Bugfix: The case of a fusion using !selfdestruct is now addressed.
- Bugfix: When defeating a Zorb, all its items are properly transferred to you.
- Bugfix: Destroyed monsters no longer remember each other's battle history.