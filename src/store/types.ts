export interface Sport {
    key: string;
    active: boolean;
    group: string;
    description: string;
    title: string;
    has_outrights: boolean;
}

export interface Event {
    id: string;
    sport_key: string;
    sport_title: string;
    commence_time: string;
    home_team: string;
    away_team: string;
}