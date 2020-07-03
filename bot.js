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
    if (msg.content.substring(0, 1) === "!") {

        let message = msg.content.substring(1);

        //retrieve hunger value stored for user
        if (message === "hunger" && (hungermap.get(msg.author.id) !== undefined)) {
            msg.reply("your hunger is " + hungermap.get(msg.author.id));
        }
        //increment hunger value(if less than 5, or if undefined set to 1)
        else if (message === "increment") {
            let hunger = hungermap.get(msg.author.id);
            let hungerinc = 1;
            if (hunger === undefined) {
                hungermap.set(msg.author.id, 1);
                msg.reply("hunger set to 1");
            }
            else if (hunger === 5)
                msg.reply("oh no! your hunger is already 5");
            else {
                hungerinc += hunger;
                hungermap.delete(msg.author.id);
                hungermap.set(msg.author.id, hungerinc);
                msg.reply("hunger incremented to " + hungerinc);
            }
        }
        //set hunger to a value between 0 and 5
        else if (/set\s*\d/.test(message)) {
            let hunger = parseInt(message.split(/\D/).filter(function (num) { return num.length > 0 }));
            if (hunger > 5)
                msg.reply("too thorsty, try again");
            else {
                hungermap.set(msg.author.id, hunger);
                msg.reply("hunger set to " + hunger);
            }
        }
        //roll dice
        else if (exp.test(message)) {
            //split on non-digit characters to get array of numbers
            let nums = message.split(/\D/).filter(function (num) { return num.length > 0 });

            console.log(msg.author)

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
                        emojistring += "<:bestialfail:" + process.env.IMG_BESTIALFAIL + ">";
                    else if (res < 6)
                        emojistring += "<:redfail:" + process.env.IMG_REDFAIL + ">";
                    else if (res < 10)
                        emojistring += "<:redsuccess:" + process.env.IMG_REDSUCCESS + ">";
                    else
                        emojistring += "<:redcrit:" + process.env.IMG_REDCRIT + ">";
                }
                for (let i = 0; i < normalResults.length; i++) {
                    let res = normalResults[i];
                    if (res < 6)
                        emojistring += "<:normalfail:" + process.env.IMG_NORMALFAIL + ">";
                    else if (res < 10)
                        emojistring += "<:normalsuccess:" + process.env.IMG_NORMALSUCCESS + ">";
                    else
                        emojistring += "<:normalcrit:" + process.env.IMG_NORMALCRIT + ">";
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
                let returnMessage = successes + " successes";
                if (successes === 0 && hungerResults.includes(1))
                    returnMessage = "bestial failure";
                else if (hungerResults.includes(1))
                    returnMessage += ", possible bestial failure";
                if (critPairFound && hungerResults.includes(10))
                    returnMessage += ", possible messy crit";

                //format message, add emojis, and send
                returnMessage += "\n";
                returnMessage += emojistring
                msg.reply(returnMessage);
            }
        }
    }
});