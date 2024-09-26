"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/jobs/jobRunner.ts
const fetchOdds_1 = require("./fetchOdds");
const startJobs = () => {
    // Fetch sports data immediately and then every 40 seconds
    (0, fetchOdds_1.fetchSports)();
    setInterval(() => {
        (0, fetchOdds_1.fetchSports)();
    }, 40000);
    // Fetch odds and scores for specific sports
    const sports = ['soccer', 'basketball', 'tennis']; // Add the sports you are interested in
    sports.forEach((sport) => {
        (0, fetchOdds_1.fetchOdds)(sport);
        setInterval(() => {
            (0, fetchOdds_1.fetchOdds)(sport);
        }, 40000);
        (0, fetchOdds_1.fetchScores)(sport);
        setInterval(() => {
            (0, fetchOdds_1.fetchScores)(sport);
        }, 40000);
    });
};
exports.default = startJobs;
