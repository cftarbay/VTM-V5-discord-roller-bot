// Run dotenv
require('dotenv').config();

const Discord = require('discord.js');
const client = new Discord.Client();

//regex to match "r" <number of dice in pool> "d" <number of hunger dice> "h"- hunger dice are optional
const exp = /r\d+d(\d*h){0,1}/;

//unused hunger map, will be used in next version.
const hungermap = new Map();

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.login(process.env.DISCORD_TOKEN);

client.on('message', msg => {
    //began new features of next iteration but want to commit first
    //if (msg.content.substring(0, 1) === "!") {

    //let message = msg.content.substring(1);
    //if(message.substring(0))

    if (exp.test(msg.content)) {
        //split on non-digit characters to get array of numbers
        let nums = msg.content.split(/\D/).filter(function (num) { return num.length > 0 });

        //console.log(msg.author)

        //first arg is total number of dice
        let totalDice = parseInt(nums[0]);
        let hungerDice, normalDice = 0;

        //second arg if it exists is number of hunger dice
        if (nums.length > 1)
            hungerDice = parseInt(nums[1]);
        //cannot have hunger of more than 5
        if (hungerDice > 5)
            msg.reply("too thorsty, try again");
        else {
            //if more hunger dice than pool, use all hunger dice
            if (hungerDice >= totalDice)
                hungerDice = totalDice;
            //if not, have a number of normal dice
            else
                normalDice = totalDice - hungerDice;

            //roll dice by collecting rng 1-10 results in arrays for each die type
            let hungerResults = [];
            let normalResults = [];
            for (let i = 0; i < hungerDice; i++)
                hungerResults.push(rolldie());
            for (let i = 0; i < normalDice; i++)
                normalResults.push(rolldie());

            function rolldie() {
                return (Math.floor(Math.random() * 10) + 1);
            }

            //sort each resultset
            hungerResults.sort(function (a, b) {
                return b - a;
            });
            normalResults.sort(function (a, b) {
                return b - a;
            });

            //construct string of emoji for each die
            let emojistring = "";
            for (let i = 0; i < hungerResults.length; i++) {
                let res = hungerResults[i];
                if (res === 1)
                    emojistring += "<:bestialfail:"+process.env.IMG_BESTIALFAIL+">";
                else if (res < 6)
                    emojistring += "<:redfail:"+process.env.IMG_REDFAIL+">";
                else if (res < 10)
                    emojistring += "<:redsuccess:"+process.env.IMG_REDSUCCESS+">";
                else
                    emojistring += "<:redcrit:"+process.env.IMG_REDCRIT+">";
            }
            for (let i = 0; i < normalResults.length; i++) {
                let res = normalResults[i];
                if (res < 6)
                    emojistring += "<:normalfail:"+process.env.IMG_NORMALFAIL+">";
                else if (res < 10)
                    emojistring += "<:normalsuccess:"+process.env.IMG_NORMALSUCCESS+">";
                else
                    emojistring += "<:normalcrit:"+process.env.IMG_NORMALCRIT+">";
            }

            //full list of results not separated by die type
            let totalResults = hungerResults.concat(normalResults);

            //total successes, doubling for 2 crits
            let successes = 0;
            let critPair = false;
            let critPairFound = false;
            for (let i = 0; i < totalResults.length; i++) {
                let res = totalResults[i];
                if (res === 10 && critPair) {
                    successes += 3;
                    critPair = false;
                    critPairFound = true;
                }
                else if (res === 10 && !critPair) {
                    successes += 1;
                    critPair = true;
                }
                else if (res > 5)
                    successes += 1;
            }

            //create summary string with number of successes and noting possible messy crits/bestial failures
            let message = successes + " successes";
            if (successes === 0 && hungerResults.includes(1))
                message = "bestial failure";
            else if (hungerResults.includes(1))
                message += ", possible bestial failure";
            if (critPairFound && hungerResults.includes(10))
                message += ", possible messy crit";

            //format message, add emojis, and send
            message += "\n";
            message += emojistring
            msg.reply(message);
        }
    }
    //}
});