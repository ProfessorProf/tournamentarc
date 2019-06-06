module.exports = {
    Configs: {
        AlwaysPrivate: 'AlwaysPrivate',
        Ping: 'Ping',
        Pronoun: 'Pronoun',
        Defaults: {
            AlwaysPrivate: false,
            Ping: false,
            Pronoun: 'they'
        },
        Type: {
            AlwaysPrivate: 'bool',
            Ping: 'bool',
            Pronoun: 'text'
        }
    },
    TournamentStatuses: {
        Off: 0,
        Active: 1,
        Complete: 2
    },
    TournamentFighterStatuses: {
        Pending: 0,
        Ongoing: 1,
        Won: 2,
        Lost: 3
    },
    MatchupTypes: {
        Normal: 0,
        Weak: 1,
        Strong: 2
    },
    Moods: {
        Depressed: 0,
        Anxious: 1,
        Nervous: 2,
        Calm: 3,
        Happy: 4,
        Confident: 5,
        Determined: 6,
        Name: {
            0: 'Depressed',
            1: 'Anxious',
            2: 'Nervous',
            3: 'Calm',
            4: 'Happy',
            5: 'Confident',
            6: 'Determined'
        }
    },
    Relationships: {
        Love: 0,
        Hate: 1,
        Rival: 2,
        Friend: 3
    },
    Brackets: {
        Winners: 0,
        Losers: 1
    }
}