import axios from "axios"
import { config } from "../config/config"

const fetchSports = async () => {
    try {
        const response = await axios.get('https://api.the-odds-api.com/v4/sports', {
            params: {
                apiKey: config.oddsApiKey
            },
        });
        const sportsData = response.data;
        console.log(sportsData);
        // Save the data to your database or perform other actions
    } catch (error) {
        console.error('Error fetching sports data:', error);
    }
};


const fetchOdds = async (sport: string) => {
    try {
        const response = await axios.get(`https://api.the-odds-api.com/v4/sports/${sport}/odds`, {
            params: {
                apiKey: config.oddsApiKey
            },
        });
        const oddsData = response.data;
        console.log(oddsData);
        // Save the data to your database or perform other actions
    } catch (error) {
        console.error(`Error fetching odds data for sport ${sport}:`, error);
    }
};

const fetchScores = async (sport: string) => {
    try {
        const response = await axios.get(`https://api.the-odds-api.com/v4/sports/${sport}/scores`, {
            params: {
                apiKey: config.oddsApiKey
            },
        });
        const scoresData = response.data;
        console.log(scoresData);
        // Save the data to your database or perform other actions
    } catch (error) {
        console.error(`Error fetching scores data for sport ${sport}:`, error);
    }
};

export { fetchSports, fetchOdds, fetchScores };