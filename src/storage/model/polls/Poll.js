/* eslint-disable new-cap */
"use strict";

// Dependencies
let uuid = require("uuid");
let moment = require("moment");
let {Model, DataTypes} = require("sequelize");

// Models
let DiscordPath = require("../DiscordPath");
let PollReaction = require("./PollReaction");

// Typedefs
/**
 * @typedef {Object} PollOptions
 * @property {Boolean?} isDelayed
 * @property {Boolean?} isAnonymous
 * @property {Boolean?} isExtendable
 * @property {Boolean?} isStrawpoll
 * @property {Date?} endDate
 */

/**
 * @typedef {import("./PollAnswer")} PollAnswer
 * @typedef {import("./PollReaction")} PollReaction
 * @typedef {import("./PollSettings")} PollSettings
 * @typedef {import("./PollReactionUser")} PollReactionUser
 */

const DEFAULT_EMOJI_MAPPING = [
    ["1️⃣", ":one:"],
    ["2️⃣", ":two:"],
    ["3️⃣", ":three:"],
    ["4️⃣", ":four:"],
    ["5️⃣", ":five:"],
    ["6️⃣", ":six:"],
    ["7️⃣", ":seven:"],
    ["8️⃣", ":eight:"],
    ["9️⃣", ":nine:"],
    ["🔟", ":keycap_ten:"]
];

class Poll extends Model {
    /**
     * Displays a poll in a specified channel
     * @param {import("discord.js").Client} client
     * @param {import("../DiscordPath")} discordPath discord path to channel
     */
    async showPoll(client, discordPath) {
        /** @type {PollSettings} */
        const pollSetting = await this.getPollSetting();
        const hasPath = Boolean(await pollSetting.getDiscordPath());

        if(hasPath)  {
            // This poll seems to be running already
            return false;
        }

        /** @type {import("discord.js").TextChannel} */
        let channel = await discordPath.resolveChannel(client);
        if(!channel) return false;

        let answers = await this.getPollAnswers({include: [PollReaction]});
        let msgToSend = await this.constructPollMessage(client);
        let sentMessage = await channel.send(msgToSend);

        await Promise.all(answers.map(x => x.PollReaction).map(reaction => sentMessage.react(reaction.emoji)));

        let newPath = await DiscordPath.getFromMessage(sentMessage);
        await pollSetting.setDiscordPath(newPath);
        pollSetting.delayBeginTime = new Date();
        await pollSetting.save();

        return true;
    }

    /**
     * @param {import("discord.js").Client} client
     * @returns {any}
     */
    async constructPollMessage(client) {
        /** @type {PollSettings} */
        const pollSetting = await this.getPollSetting();
        const initiator = await client.users.fetch(this.initiatorUid);
        const pollAnswers = await this.getPollAnswers({include: [PollReaction], order: [["nr", "ASC"]]});

        let optionstext = "";

        pollAnswers.forEach((pollAnswer) => (optionstext += `${pollAnswer.PollReaction.emojiText} - ${pollAnswer.text}\n`));

        if(pollSetting.isDelayed) {
            optionstext += `\nAbstimmen möglich bis ${new Date(pollSetting.delayEndTime.valueOf() + 60000).toLocaleTimeString("de").split(":").splice(0, 2).join(":")}`;
        }

        let footer = [];
        let color = null;

        if(pollSetting.isExtendable) {
            footer.push("Erweiterbar mit .extend als Reply");
        }

        if(pollSetting.isDelayed) {
            footer.push("⏳");
            color = "#a10083";
        }

        if(pollSetting.isStrawpoll) {
            footer.push("Mehrfachauswahl");
        }

        return {
            embed: {
                title: this.question,
                description: optionstext,
                timestamp: moment.utc().format(),
                author: {
                    name: `${pollSetting.isStrawpoll ? "Strawpoll" : "Umfrage"} von ${initiator.username}`,
                    icon_url: initiator.displayAvatarURL()
                },
                footer: {
                    text: footer.join(" • ")
                },
                color
            }
        };
    }

    /**
     * Creates a new Poll with everything you need
     * @param {string} question
     * @param {string[]} answers
     * @param {string} initiator
     * @param {PollOptions} options
     * @param {string[]} emojiMapping
     */
    static async newPoll(question, answers, initiator, options = {}, emojiMapping = DEFAULT_EMOJI_MAPPING) {
        if(!options) {
            throw new Error("No options specified");
        }

        if(answers.length > emojiMapping.length) {
            throw new Error("Can't have more answers than reaction emojis!");
        }

        /** @type {Poll} */
        const poll = await Poll.create({
            question,
            initiatorUid: initiator
        });

        const pollSetting = await poll.createPollSetting({
            isDelayed: options.isDelayed,
            isAnonymous: options.isAnonymous,
            isExtendable: options.isExtendable,
            delayEndTime: options.endDate
        });

        /** @type {PollAnswer[]} */
        const pollAnswers = await Promise.all(answers
            .map((answer, index) => poll.createPollAnswer({
                nr: index,
                text: answer
            })));

        /** @type {PollReaction[]} */
        const pollReactions = await Promise.all(pollAnswers
            .map((pollAnswer, index) => pollAnswer.createPollReaction({
                emoji: emojiMapping[index][0],
                emojiText: emojiMapping[index][1]
            })));

        return {
            poll,
            pollAnswers,
            pollReactions,
            pollSetting
        };
    }

    static initialize(sequelize) {
        this.init({
            id: {
                type: DataTypes.STRING(36),
                defaultValue: () => uuid.v4(),
                primaryKey: true
            },
            question: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            initiatorUid: {
                type: DataTypes.STRING(36),
                allowNull: false
            }
        }, {
            sequelize
        });
    }
}

module.exports = Poll;
