const EleventyFetch = require("@11ty/eleventy-fetch");

module.exports = async function () {
    try {

         // Determine the authorization key based on the environment
         const authKey = process.env.PLAUSIBLE_KEY;


        // https://developer.github.com/v3/repos/#get
        let json = await EleventyFetch("https://plausible.io/api/v1/stats/aggregate/?site_id=donniedarkowebsite.com&period=12mo", {
            duration: "1d", // 1 day
            type: "json", // also supports "text" or "buffer"
            fetchOptions: {
                headers: {
                    'Authorization': `Bearer ${authKey}`
                }
            }
        });
        
        // console.log("Got Plausible visitors count", json.results.visitors.value);

        return {
            visitors: json.results.visitors.value
        };
    } catch (e) {
        console.log("Failed getting Plausible visitors count, returning 0");
        return {
            visitors: 0
        };
    }
};