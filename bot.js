// Run dotenv
require('dotenv').config();

const Discord = require('discord.js');
const client = new Discord.Client();

//map of hunger based on userid as keys
const hungermap = new Map();

//unused map of of recent rolls to be used for reroll based on userid as keys
const rerollmap = new Map();

const DEBUG = true;

client.on('ready', () => {
    if (DEBUG)
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

//rolls a d10
function rolldie() {
    return (Math.floor(Math.random() * 10) + 1);
}

//returns a sorted array with length equal to the parameter of rngs 1-10 
function rolldice(num) {
    let res = [];
    for (let i = 0; i < num; i++)
        res.push(rolldie());
    res.sort(function (a, b) {
        return b - a;
    });
    return res;
}

//gets the hunger die emoji corresponding to the parameter value
function getHungerEmoji(num) {
    if (num === 1)
        return "<:bestialfail:" + process.env.IMG_BESTIALFAIL + ">";
    else if (num < 6)
        return "<:redfail:" + process.env.IMG_REDFAIL + ">";
    else if (num < 10)
        return "<:redsuccess:" + process.env.IMG_REDSUCCESS + ">";
    else
        return "<:redcrit:" + process.env.IMG_REDCRIT + ">";
}

//gets the normal die emoji corresponding to the parameter value
function getNormalEmoji(num) {
    if (num < 6)
        return "<:normalfail:" + process.env.IMG_NORMALFAIL + ">";
    else if (num < 10)
        return "<:normalsuccess:" + process.env.IMG_NORMALSUCCESS + ">";
    else
        return "<:normalcrit:" + process.env.IMG_NORMALCRIT + ">";
}

//counts successes and whether a crit was found in the array and returns those values
function countSuccesses(arr) {
    let successes = 0;
    let critPair = false;
    let critPairFound = false;
    for (let i = 0; i < arr.length; i++) {
        let res = arr[i];
        if (res === 10 && critPair) {
            successes += 3;
            critPair = false;
            critPairFound = true;
        }
        else if (res === 10 && !critPair) {
            successes++;
            critPair = true;
        }
        else if (res > 5)
            successes++;
    }
    return { successes: successes, critPairFound: critPairFound };
}

//create result string based on successes and whether crit pair includes hunger crit
function resultString(res, hungerResults) {
    let returnMessage = res.successes + " successes";
    if (res.successes === 0 && hungerResults.includes(1))
        returnMessage = "bestial failure";
    else if (hungerResults.includes(1))
        returnMessage += ", possible bestial failure";
    if (res.critPairFound && hungerResults.includes(10))
        returnMessage += ", possible messy crit";
    return returnMessage;
}

client.on('message', msg => {
    //message must start with ! to trigger bot
    if (msg.content.substring(0, 1) === "!") {

        //remove ! for further processing
        let message = msg.content.substring(1);

        //retrieve hunger value stored for user if query is "hunger"
        if (message === "hunger" && (hungermap.get(msg.author.id) !== undefined))
            getHunger(msg)

        //increment hunger value (if less than 5, or if undefined set to 1) if query is "increment"
        else if (message === "increment") {
            let hunger = hungermap.get(msg.author.id);
            if (hunger === undefined)
                setHungerMsg(msg, 1);
            else if (hunger >= 5)
                msg.reply("oh no! your hunger is already 5. it may be time for a frenzy check (difficulty 4) or you could fall into torpor");
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
                setHunger(msg, 1);
            }

            //generate check result
            let res = rolldie();

            //default assume success
            let returnMessage = "success! no beast for you, your hunger remains at " + hunger;
            let emoji = "\n<:redsuccess:" + process.env.IMG_REDSUCCESS + ">";

            //if already at hunger 5, must immediately test for frenzy or enter torpor and cannot increment
            if (hunger >= 5) {
                returnMessage = "oh no! your hunger is already 5. it may be time for a frenzy check (difficulty 4)";
                if (res < 6) {
                    returnMessage += " or you could fall into torpor";
                    emoji = "\n<:redfail:" + process.env.IMG_REDFAIL + ">";
                }
            }

            //if failure, handle and increment
            else if (res < 6) {
                hunger++;
                setHunger(msg, hunger);
                emoji = "\n<:redfail:" + process.env.IMG_REDFAIL + ">";
                returnMessage = "failure. your hunger increases by 1 to " + hunger;
            }

            //structure and send reply
            if (hungerUndef)
                returnMessage = "you don't have a hunger value so we assumed a hunger of 1\n" + returnMessage;
            msg.reply(returnMessage + emoji);
        }

        //todo willpower reroll using indices
        else if (/reroll(\s+\d{1,2}){1,3}/.test(message)) {

            //if no previous roll, cannot reroll
            let prevRoll = rerollmap.get(msg.author.id);
            if (prevRoll === undefined) {
                msg.reply("cannot reroll- no recent roll found");
                return;
            }
            //if no normal dice, cannot reroll
            if (prevRoll.normalDice.length === 0) {
                msg.reply("no normal dice to reroll");
                return;
            }

            //if no indices or >3 indices, cannot reroll
            let split = message.split(" ");
            let indices = [];
            for (let i = 0; i < split.length; i++)
                if (/\d+/.test(split[i]))
                    indices.push(parseInt(split[i]));
            if (indices.length === 0 || indices.length > 3) {
                msg.reply("invalid entry, try again in the format !reroll ind1 ind2 ind3");
                return;
            }

            //if indices out of bounds, cannot reroll
            let invalidIndex = false;
            for (let i = 0; i < indices.length; i++)
                if (indices[i] < 1 || indices[i] > prevRoll.hungerDice.length + prevRoll.normalDice.length)
                    invalidIndex = true;
            if (invalidIndex) {
                msg.reply("one of the indices you entered was invalid. valid indices are between " + (prevRoll.hungerDice.length + 1) + " and " + (prevRoll.hungerDice.length + prevRoll.normalDice.length));
                return;
            }

            //if any indices repeated, cannot reroll
            let repeatedIndex = false;
            for (let i = 0; i < indices.length; i++)
                for (let j = i + 1; j < indices.length; j++)
                    if (indices[i] === indices[j])
                        repeatedIndex = true;
            if (repeatedIndex) {
                msg.reply("one of the indices you entered was repeated. try again");
                return;
            }

            //reroll
            for (let i = 0; i < indices.length; i++)
                prevRoll.normalDice[indices[i] - 1 - prevRoll.hungerDice.length] = rolldie();

            //build result set and reply
            let emojiString = '\n';
            for (let i = 0; i < prevRoll.hungerDice.length; i++)
                emojiString += getHungerEmoji(prevRoll.hungerDice[i]);
            for (let i = 0; i < prevRoll.normalDice.length; i++)
                emojiString += getNormalEmoji(prevRoll.normalDice[i]);
            let res = countSuccesses(prevRoll.hungerDice.concat(prevRoll.normalDice));
            let str = resultString(res, prevRoll.hungerDice);
            msg.reply(str + emojiString);

            //remove roll from ability to be rerolled
            rerollmap.delete(msg.author.id);
        }

        //roll dice if query is "roll" followed by any or no whitespace, and the number of dice in the pool
        else if (/roll\s*\d+/.test(message)) {
            //split on non-digit characters to get number of dice in pool
            let totalDice = parseInt(message.split(/\D/).filter(function (num) { return num.length > 0 }));

            if (totalDice > 20)
                msg.reply("can only roll a pool of up to 20 dice, try again");

            else {
                let hungerDice, normalDice = 0;

                //lookup hunger, if no value flag and use 1
                hungerDice = hungermap.get(msg.author.id);
                let hungerUndef = false;
                if (hungerDice === undefined) {
                    hungerUndef = true;
                    hungerDice = 1;
                    setHunger(msg, 1);
                }

                //cannot have hunger of more than 5
                if (hungerDice > 5)
                    msg.reply("your hunger value is too high (max 5). !set your hunger to a valid value and try again");
                else {
                    //if more hunger dice than pool, use all hunger dice
                    if (hungerDice >= totalDice)
                        hungerDice = totalDice;
                    //if not, have a number of normal dice
                    else
                        normalDice = totalDice - hungerDice;

                    //roll dice by collecting rng 1-10 results in arrays for each die type
                    let hungerResults = rolldice(hungerDice);
                    let normalResults = rolldice(normalDice);

                    //construct string of emoji for each die
                    let emojistring = "\n";
                    for (let i = 0; i < hungerResults.length; i++)
                        emojistring += getHungerEmoji(hungerResults[i]);
                    for (let i = 0; i < normalResults.length; i++)
                        emojistring += getNormalEmoji(normalResults[i])

                    //count total successes, counting 4 for 2 crits
                    let res = countSuccesses(hungerResults.concat(normalResults));

                    rerollmap.delete(msg.author.id);
                    rerollmap.set(msg.author.id, { normalDice: normalResults, hungerDice: hungerResults });

                    //create summary string with number of successes and noting possible messy crits/bestial failures
                    let returnMessage = resultString(res, hungerResults);
                    if (hungerUndef)
                        returnMessage = "you don't have a hunger value so we assumed a hunger of 1\n" + returnMessage;

                    //add emojis and send
                    returnMessage += emojistring;
                    msg.reply(returnMessage);
                }
            }
        }

        //todo timer for auto incrementing hunger
        else if(/timer\s*start\s*\d{1,3}/.test(message)){

        }
        
        else if(message === 'timer stop'){
            
        }

        //todo keyword incrementer
        else if(/tick\s*word ([a-z]|[A-Z])+/.test(message)){

        }
    }
});