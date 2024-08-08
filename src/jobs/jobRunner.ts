// src/jobs/jobRunner.ts
import { fetchSports, fetchOdds, fetchScores } from './fetchOdds';

const startJobs = () => {
    // Fetch sports data immediately and then every 40 seconds
    fetchSports();
    setInterval(() => {
        fetchSports();
    }, 40000);

    // Fetch odds and scores for specific sports
    const sports = ['soccer', 'basketball', 'tennis']; // Add the sports you are interested in

    sports.forEach((sport) => {
        fetchOdds(sport);
        setInterval(() => {
            fetchOdds(sport);
        }, 40000);

        fetchScores(sport);
        setInterval(() => {
            fetchScores(sport);
        }, 40000);
    });
};

export default startJobs;