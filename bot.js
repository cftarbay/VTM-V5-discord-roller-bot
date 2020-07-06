// Run dotenv
require('dotenv').config();

const Discord = require('discord.js');
const client = new Discord.Client();

//regex to match "r" followed by any or no whitespace, and then the number of dice in the pool
const exp = /r\s*\d+/;

//map of hunger based on userid as keys
const hungermap = new Map();

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.login(process.env.DISCORD_TOKEN);


//replies with the hunger value of the user who queried
function getHunger(msg) {
    msg.reply("your hunger is " + hungermap.get(msg.author.id));
}

//sets hunger value for the user who queried
function setHunger(msg, value) {
    hungermap.delete(msg.author.id);
    hungermap.set(msg.author.id, value);
}

//sets hunger value for user who queried, replies with it
function setHungerMsg(msg, value) {
    setHunger(msg, value);
    msg.reply("hunger set to " + value);
}

//increments hunger for user who queried, replies with it
function incrementHunger(msg, value) {
    value++;
    setHunger(msg, value);
    msg.reply("hunger incremented to " + value);
}

function rolldie() {
    return (Math.floor(Math.random() * 10) + 1);
}

client.on('message', msg => {
    //message must start with ! to trigger bot
    if (msg.content.substring(0, 1) === "!") {

        //remove ! for further processing
        let message = msg.content.substring(1);

        //retrieve hunger value stored for user if query is "hunger"
        if (message === "hunger" && (hungermap.get(msg.author.id) !== undefined))
            getHunger(msg)
        //increment hunger value(if less than 5, or if undefined set to 1) if query is "increment"
        else if (message === "increment") {
            let hunger = hungermap.get(msg.author.id);
            if (hunger === undefined)
                setHungerMsg(msg, 1);
            else if (hunger >= 5)
                msg.reply("oh no! your hunger is already 5");
            else
                incrementHunger(msg, hunger);
        }
        //set hunger to a value between 0 and 5 if query is "set" followed by a number 0-5
        else if (/set\s*\d/.test(message)) {
            let hunger = parseInt(message.split(/\D/).filter(function (num) { return num.length > 0 }));
            if (hunger > 5)
                msg.reply("invalid hunger (max is 5), try again");
            else
                setHungerMsg(msg, hunger)
        }
        //rouse check to possibly increment hunger if query is "rouse"
        else if (message === 'rouse') {
            //get hunger, if undefined set to 1 and flag
            let hunger = hungermap.get(msg.author.id);
            let hungerUndef = false;
            if (hunger === undefined) {
                hungerUndef = true;
                hunger = 1;
            }

            //generate check result
            let res = rolldie();

            //default assume success
            let returnMessage = "success! no beast for you, your hunger remains at " + hunger + " \n";
            let emoji = "<:redsuccess:" + process.env.IMG_REDSUCCESS + ">";

            //if already at hunger 5, must immediately test for frenzy regardless of any result and cannot increment
            if (hunger >= 5) {
                returnMessage = "oh no! your hunger is already 5! better test for frenzy (difficulty 4)";
                emoji = "";
            }
            //if failure, handle and increment
            else if (res < 6) {
                hunger++;
                setHunger(msg, hunger);
                emoji = "<:redfail:" + process.env.IMG_REDFAIL + ">";
                returnMessage = "failure. your hunger increases by 1 to " + hunger + "\n";
            }

            //structure and send reply
            if (hungerUndef)
                returnMessage = "you don't have a hunger value so we assumed a hunger of 1\n" + returnMessage;
            msg.reply(returnMessage + emoji);
        }
        //roll dice if query is "r" followed by a number
        else if (exp.test(message)) {
            //split on non-digit characters to get number of dice in pool
            let totalDice = parseInt(message.split(/\D/).filter(function (num) { return num.length > 0 }));

            if (totalDice > 20) {
                msg.reply("can only roll a pool of up to 20 dice, try again");
            }
            else {
                let hungerDice, normalDice = 0;

                //lookup hunger, if no value flag and use 1
                hungerDice = hungermap.get(msg.author.id);

                let hungerUndef = false;
                if (hungerDice === undefined) {
                    hungerUndef = true;
                    hungerDice = 1;
                }

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

                    //count total successes, doubling for 2 crits
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
                    if (hungerUndef)
                        returnMessage = "you don't have a hunger value so we assumed a hunger of 1\n" + returnMessage;

                    //format message, add emojis, and send
                    returnMessage += "\n";
                    returnMessage += emojistring;
                    msg.reply(returnMessage);
                }
            }
        }
    }
});