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

# Updates for S7:
- Tweaks: Heat escalation speed reduced from 80% to 50%.
- Tweaks: Event frequence reduced from 80% to 60%.
- Tweaks: Phantom power multiplier increased from 4 to 10.
- Tweaks: Battle Ratings are slightly less random.
- Tweaks: Power Level gains are slightly less random.
- Tweaks: Challenge timer reduced to 30 seconds.
- Journey: For some reason I took out the part that says what kind of journey you had, but it's back now.
- Journey: Returned journey gains to their pre-Latent Power levels.
- Garden: !water now only waters your plant and the public slot plants.
- Nemesis: Base power increased by 25%.
- Nemesis: New nemesis command "raid" added.
- Nemesis: New command "guard" to protect your friends from the nemesis.
- Wish: Wish "games" now gives 8 hours for signups, instead of 6.
- New: New command "deepcheck" lets you check more detailed information on your capabilities.
- New: Past glory is saved as Legacy Glory, which multiplies all Glory gains.

# Updates for S6:
- New: A Season is now split into Arcs based on player activity.
- Arcs: A Nemesis Arc begins when someone uses !nemesis, preventing tournaments.
- Arcs: A Tournament Arc begins when someone starts a tournament, preventing orb searching or nemesis uprisings.
- Arcs: An Orb Hunt Arc begins when someone finds the third magic orb, preventing tournaments or nemesis uprisings.
- Wish: "gardening" wish now works differently.
- Wish: Nemesis wish "burn" now destroys a random portion of all growing plants.
- Wish: New nemesis wish "games" added.
- Garden: Each player now has one free personal garden slot.
- Garden: Plants no longer decay.
- Garden: New dark plant "Zeach".
- Nemesis: Dark Plants now only spawn one per batch, but are more powerful to compensate.
- Nemesis: Underlings can no longer train, but come back stronger each time.
- Tournaments: If you have all seven orbs, you can start a tournament and wager all the orbs on the result.
- Events: Guru event now boosts gardening instead of latent power.
- Events: Special rare "portal" event added.
- Fighting: "Latent Power" mechanic removed.
- Fighting: Players now gain a bonus to power level based on their total number of defeats.
- Fighting: There is now a 5 minute cooldown on initiating fight challenges.
- Bugfix: Gourd trained the user, not the target.
- Bugfix: Permanent statuses now carry properly into and out of fusion.
- Bugfix: Nemesis timer was being displayed twice in some situations.
- Bugfix: Couldn't use plants on yourself while on a journey.
- Bugfix: History occasionally showed the wrong battle ratings for fights.
- Bugfix: Redundant error messages displaying for trying to !train while already training.
- Bugfix: !destroy crashed in some circumstances.
- Bugfix: AutoTrain occasionally caused unexpected output.
- Bugfix: Much cleaner logging.

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