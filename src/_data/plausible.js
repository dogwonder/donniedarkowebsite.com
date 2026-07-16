const EleventyFetch = require("@11ty/eleventy-fetch");

//See more here: https://www.jjude.com/tech-notes/plausible-and-11ty/

module.exports = async function () {
    try {

        // Determine the authorization key based on the environment
        const authKey = process.env.PLAUSIBLE_KEY;
        const siteKey = process.env.PLAUSIBLE_SITE;

        // Plausible Stats API v2 — all-time visitors (v1 aggregate maxes out at a
        // rolling 12mo window; v2 supports date_range: "all").
        // https://plausible.io/docs/stats-api
        let json = await EleventyFetch(`https://plausible.io/api/v2/query`, {
            duration: "1d", // 1 day
            type: "json", // also supports "text" or "buffer"
            fetchOptions: {
                method: "POST",
                headers: {
                    'Authorization': `Bearer ${authKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    site_id: siteKey,
                    metrics: ["visitors"],
                    date_range: "all"
                })
            }
        });

        // console.log("Got Plausible visitors count", json.results[0].metrics[0]);

        return {
            visitors: json.results[0].metrics[0]
        };
    } catch (e) {
        console.log("Failed getting Plausible visitors count, returning 0");
        return {
            visitors: 0
        };
    }
};