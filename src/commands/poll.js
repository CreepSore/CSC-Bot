"use strict";

// ========================= //
// = Copyright (c) NullDev = //
// ========================= //

// Dependencies
let moment = require("moment");
let parseOptions = require("minimist");
let cron = require("node-cron");
let AdditionalMessageData = require("../storage/model/AdditionalMessageData");
let logger = require("../utils/logger");
let Poll = require("../storage/model/polls/Poll");
let { isDeepStrictEqual } = require("util");
let DiscordPath = require("../storage/model/DiscordPath");
const PollSettings = require("../storage/model/polls/PollSettings");

// Utils
let config = require("../utils/configHandler").getConfig();

const NUMBERS = [
    ":one:",
    ":two:",
    ":three:",
    ":four:",
    ":five:",
    ":six:",
    ":seven:",
    ":eight:",
    ":nine:",
    ":keycap_ten:"
];

const EMOJI = [
    "1️⃣",
    "2️⃣",
    "3️⃣",
    "4️⃣",
    "5️⃣",
    "6️⃣",
    "7️⃣",
    "8️⃣",
    "9️⃣",
    "🔟"
];

/**
 * @typedef {Object} DelayedPoll
 * @property {String} pollId
 * @property {Date} createdAt
 * @property {Date} finishesAt
 * @property {string[][]} reactions
 * @property {string[]} reactionMap
 */

/**
 * @type {DelayedPoll[]}
 */
exports.delayedPolls = [];

/**
 * Creates a new poll (multiple answers) or strawpoll (single selection)
 *
 * @param {import("discord.js").Client} client
 * @param {import("discord.js").Message} message
 * @param {Array} args
 * @param {Function} callback
 * @returns {Function} callback
 */
exports.run = (client, message, args, callback) => {
    let options = parseOptions(args, {
        "boolean": [
            "channel",
            "extendable",
            "straw"
        ],
        string: [
            "delayed"
        ],
        alias: {
            channel: "c",
            extendable: "e",
            straw: "s",
            delayed: "d"
        }
    });

    let parsedArgs = options._;
    let delayTime = Number(options.delayed);

    if (!parsedArgs.length) return callback("Bruder da ist keine Umfrage :c");

    let pollArray = parsedArgs.join(" ").split(";").map(e => e.trim()).filter(e => e.replace(/\s/g, "") !== "");
    let pollOptions = pollArray.slice(1);

    if (!pollOptions.length) return callback("Bruder da sind keine Antwortmöglichkeiten :c");
    else if (pollOptions.length < 2) return callback("Bruder du musst schon mehr als eine Antwortmöglichkeit geben 🙄");
    else if (pollOptions.length > 10) return callback("Bitte gib nicht mehr als 10 Antwortmöglichkeiten an!");

    let finishTime = new Date(new Date().valueOf() + (delayTime * 60 * 1000));
    if(options.delayed) {
        if(isNaN(delayTime) || delayTime <= 0) {
            return callback("Bruder keine ungültigen Zeiten angeben 🙄");
        }
        else if(delayTime > 60 * 1000 * 24 * 7) {
            return callback("Bruder du kannst maximal 7 Tage auf ein Ergebnis warten 🙄");
        }
    }

    let extendable = options.extendable && pollOptions.length < 10;

    if (extendable && options.delayed) {
        return callback("Bruder du kannst -e nicht mit -d kombinieren. 🙄");
    }

    let voteChannel = client.guilds.cache.get(config.ids.guild_id).channels.cache.get(config.ids.votes_channel_id);
    let channel = options.channel ? voteChannel : message.channel;
    if(options.delayed && channel !== voteChannel) {
        return callback("Du kannst keine verzögerte Abstimmung außerhalb des Umfragenchannels machen!");
    }

    Poll.newPoll(pollArray[0], pollOptions, message.author.id, {
        endDate: finishTime,
        isAnonymous: false, // TODO: implement
        isStrawpoll: Boolean(options.straw),
        isDelayed: options.delayed > 0,
        isExtendable: !options.delayed ? extendable : false
    }).then(async constructedPoll =>  {
        constructedPoll.poll.showPoll(client, await DiscordPath.getFromPath(null, channel.id, message.guild.id));
    });

    return callback();
};

/**
 * Initialized crons for delayed polls
 * @param {import("discord.js").Client} client
 */
exports.startCron = (client) => {
    cron.schedule("* * * * *", async() => {
        const currentDate = new Date();
        const pollsToFinish = Poll.findAll({
            include: [{
                model: PollSettings,
                where: {isFinished: false}
            }]
        });
        /** @type {import("discord.js").TextChannel} */
        const channel = client.guilds.cache.get(config.ids.guild_id).channels.cache.get(config.ids.votes_channel_id);

        for(let i = 0; i < pollsToFinish.length; i++) {
            const delayedPoll = pollsToFinish[i];
            const message = await channel.messages.fetch(delayedPoll.pollId);

            let users = {};
            await Promise.all(delayedPoll.reactions
                .flat()
                .filter((x, uidi) => delayedPoll.reactions.indexOf(x) !== uidi)
                .map(async uidToResolve => {
                    users[uidToResolve] = await client.users.fetch(uidToResolve);
                }));

            let toSend = {
                embed: {
                    title: `Zusammenfassung: ${message.embeds[0].title}`,
                    description: `${delayedPoll.reactions.map((x, index) => `${NUMBERS[index]} ${delayedPoll.reactionMap[index]} (${x.length}):
${x.map(uid => users[uid]).join("\n")}\n\n`).join("")}
`,
                    timestamp: moment.utc().format(),
                    author: {
                        name: `${message.embeds[0].author.name}`,
                        icon_url: message.embeds[0].author.iconURL
                    },
                    footer: {
                        text: `Gesamtabstimmungen: ${delayedPoll.reactions.map(x => x.length).reduce((a, b) => a + b)}`
                    }
                }
            };

            await channel.send(toSend);
            await Promise.all(message.reactions.cache.map(reaction => reaction.remove()));
            await message.react("✅");
            exports.delayedPolls.splice(exports.delayedPolls.indexOf(delayedPoll), 1);
        }
    });
};

exports.description = `Erstellt eine Umfrage mit mehreren Antwortmöglichkeiten (standardmäßig mit Mehrfachauswahl) (maximal 10).
Usage: ${config.bot_settings.prefix.command_prefix}poll [Optionen?] [Hier die Frage] ; [Antwort 1] ; [Antwort 2] ; [...]
Optionen:
\t-c, --channel
\t\t\tSendet die Umfrage in den Umfragenchannel, um den Slowmode zu umgehen
\t-e, --extendable
\t\t\tErlaubt die Erweiterung der Antwortmöglichkeiten durch jeden User mit .extend als Reply
\t-s, --straw
\t\t\tStatt mehrerer Antworten kann nur eine Antwort gewählt werden
\t-d <T>, --delayed <T>
\t\t\tErgebnisse der Umfrage wird erst nach <T> Minuten angezeigt. (Noch) inkompatibel mit -e`;
