module.exports = {
    Items: {
        Orb: 0,
        Flower: 1,
        Rose: 2,
        Carrot: 3,
        Bean: 4,
        Sedge: 5,
        Fern: 6,
        Zlower: 7,
        Zarrot: 8,
        Zedge: 9,
        Name: {
            0: 'orb',
            1: 'flower',
            2: 'rose',
            3: 'carrot',
            4: 'bean',
            5: 'sedge',
            6: 'fern',
            7: 'zlower',
            8: 'zarrot',
            9: 'zedge'
        },
        Type: {
            0: 0,
            1: 1,
            2: 1,
            3: 1,
            4: 1,
            5: 1,
            6: 1,
            7: 2,
            8: 2,
            9: 2
        },
        GrowTime: {
            1: 18,
            2: 24,
            3: 12,
            4: 18,
            5: 6,
            6: 12,
            7: 3,
            8: 3,
            9: 3
        },
        NeedsTarget: {
            1: true,
            2: true,
            3: true,
            4: true,
            6: true
        }
    },
    ItemTypes: {
        Orb: 0,
        Plant: 1,
        DarkPlant: 2
    },
    OfferTypes: {
        Fight: 0,
        Fusion: 1,
        Recruit: 2,
        Taunt: 3
    },
    Statuses: {
        Dead: 0,
        Journey: 1,
        Training: 2,
        Energized: 3,
        Overdrive: 4,
        Ready: 5,
        Carrot: 6,
        Bean: 7,
        Fern: 8,
        Fused: 9,
        PowerWish: 10,
        ImmortalityWish: 11,
        Berserk: 12,
        Cooldown: 13,
        SelfDestruct: 14,
        Annihilation: 15,
        TrainingComplete: 16,
        Name: {
            0: 'Defeated',
            1: 'Journey',
            2: 'Training',
            3: 'Energized',
            4: 'Overdrive',
            5: 'Ready',
            6: 'Carrot',
            7: 'Bean',
            8: 'Fern',
            9: 'Fusion',
            10: 'Power',
            11: 'Immortal',
            12: 'Berserk',
            13: 'Cooldown',
            14: 'Self Destruct',
            15: 'Annihilation',
            16: 'Training Complete'
        },
        Ends: {
            0: true,
            1: true,
            3: true,
            4: true,
            6: true,
            7: true,
            8: true,
            9: true,
            12: true,
            13: true
        },
        Priority: {
            0: 600,
            1: 500,
            2: 400,
            3: 300,
            4: 200,
            5: 100,
            12: 250
        }
    },
    NemesisTypes: {
        Basic: 0,
        FirstForm: 1,
        FinalForm: 2
    },
    NpcTypes: {
        Zorb: 1,
        Zorbmaster: 2,
        Zlower: 3,
        Zarrot: 4,
        Zedge: 5
    },
    Cooldowns: {
        Action: 0,
        Garden: 1,
        Attack: 2,
        Destroy: 3,
        Energize: 4,
        Revive: 5,
        Burn: 6,
        Search: 7, // For Zarrots
        Empower: 8, // For Zlowers
        Unwater: 9, // For Zedge
        NextNemesis: 10,
        NextTournament: 11,
        Ruin: 12,
        Journey: 13,
        NextRound: 14,
        Name: {
            0: 'World Actions',
            1: 'Garden Actions',
            2: 'Attack',
            3: 'Destroy',
            4: 'Energize',
            5: 'Revive',
            6: 'Burn',
            7: 'Auto-Search',
            8: 'Auto-Empower',
            9: 'Drain Garden',
            13: 'Journey'
        }
    },
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
    FightSummaries: {
        ExpectedWin: 0,
        UnexpectedWin: 1,
        NemesisWin: 2,
        NemesisLoss: 3,
        NemesisBetrayal: 4,
        NemesisTrueForm: 5,
        NemesisSelfDestruct: 6
    },
    TournamentTypes: {
        SingleElimination: 0,
        BattleRoyale: 1,
        Name: {
            0: 'single elimination',
            1: 'battle royale'
        }
    },
    TournamentStatuses: {
        Off: 0,
        Recruiting: 1,
        Active: 2,
        Complete: 3
    },
    TournamentPlayerStatuses: {
        Pending: 0,
        Won: 1,
        Lost: 2,
        Idle: 3
    }
}