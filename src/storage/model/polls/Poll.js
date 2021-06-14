/* eslint-disable new-cap */
"use strict";

// Dependencies
let uuid = require("uuid");
let moment = require("moment");
let {Model, DataTypes} = require("sequelize");
let logger = require("../../../utils/logger");

// Models
let DiscordPath = require("../DiscordPath");
let FadingMessage = require("../FadingMessage");
let PollReaction = require("./PollReaction");
let PollReactionUser = require("./PollReactionUser");

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
 * @typedef {Object} PollReactionEvent
 * @property {import("discord.js").Client} client discord client
 * @property {import("discord.js").User} user user that reacted to the poll
 * @property {import("discord.js").Message} message poll message that has been reacted to
 * @property {boolean} reactionState the new reaction state. keep in mind that this is always true for delayed polls
 * @property {string} emoji the emoji as string representation
 */

/**
 * @typedef {import("./PollSettings")} PollSettings
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

const DEFAULT_EMOJI_MAPPING_STRAWPOLL = [
    ["👍", ":thumbsup:"],
    ["👎", ":thumbsdown:"]
];

class Poll extends Model {
    /**
     * @param {PollReactionEvent} reactionEvent
     * @param {PollSettings} pollSettings
     */
    async onStrawpollReaction(reactionEvent, pollSettings) {
        /** @type {PollAnswer[]} */
        const pollAnswers = await this.getPollAnswers({
            include: [
                {
                    model: PollReaction,
                    include: [
                        {
                            model: PollReactionUser
                        }
                    ]
                }
            ]
        });
        const thisAnswer = pollAnswers.filter(x => x.PollReaction.emoji === reactionEvent.emoji)[0];
        const userPollAnswer = thisAnswer.PollReaction.PollReactionUsers.filter(x => x.uid === reactionEvent.user.id)[0];
        const isDelayed = pollSettings.get("isDelayed");
        // We don't care about negative reactionStates when we are a delayed poll
        if(isDelayed && !reactionEvent.reactionState) return;

        const emojis = pollAnswers.map(x => x.PollReaction.emoji);

        if(isDelayed) {
            if(reactionEvent.reactionState) {
                await Promise.all(reactionEvent.message.reactions.cache.filter(reaction =>
                    reaction.users.cache.has(reactionEvent.user.id) &&
                    emojis.includes(reactionEvent.emoji)
                ).map(reaction => reaction.users.remove(reactionEvent.user)));
            }
        }
        else if(reactionEvent.reactionState){
            await Promise.all(reactionEvent.message.reactions.cache.filter(reaction =>
                reaction.users.cache.has(reactionEvent.user.id) &&
                reactionEvent.emoji !== reaction.emoji.name &&
                emojis.includes(reactionEvent.emoji)
            ).map(reaction => reaction.users.remove(reactionEvent.user)));
        }

        let toRemove = pollAnswers.map(x => x.PollReaction.PollReactionUsers)
            .flat()
            .filter(x => x.uid === reactionEvent.user.id);
        await Promise.all(toRemove.map(x => x.destroy()));

        const hasVotedForAnswer = Boolean(userPollAnswer);
        if(!isDelayed && !hasVotedForAnswer !== reactionEvent.reactionState) return;
        if(hasVotedForAnswer) {
            await userPollAnswer.destroy();
        }
        else {
            await thisAnswer.PollReaction.createPollReactionUser({uid: reactionEvent.user.id});
        }

        if(isDelayed) {
            let msg = await reactionEvent.message.channel.send(hasVotedForAnswer ? "🗑 Deine Reaktion wurde gelöscht." : "💾 Deine Reaktion wurde gespeichert.");
            await FadingMessage.newFadingMessage(msg, 1500);
        }
    }

    /**
     * @param {PollReactionEvent} reactionEvent
     * @param {PollSettings} pollSettings
     */
    async onPollReaction(reactionEvent, pollSettings) {
        const pollAnswers = await this.getPollAnswers({
            include: [
                {
                    model: PollReaction,
                    include: [
                        {
                            model: PollReactionUser
                        }
                    ]
                }
            ]
        });
        const thisAnswer = pollAnswers.filter(x => x.PollReaction.emoji === reactionEvent.emoji)[0];
        const userPollAnswer = thisAnswer.PollReaction.PollReactionUsers.filter(x => x.uid === reactionEvent.user.id)[0];
        const isDelayed = pollSettings.get("isDelayed");
        // We don't care about negative reactionStates when we are a delayed poll
        if(isDelayed && !reactionEvent.reactionState) return;

        const emojis = pollAnswers.map(x => x.PollReaction.emoji);

        if(isDelayed && reactionEvent.reactionState) {
            await Promise.all(reactionEvent.message.reactions.cache.filter(reaction =>
                reaction.users.cache.has(reactionEvent.user.id) &&
                emojis.includes(reactionEvent.emoji)
            ).map(reaction => reaction.users.remove(reactionEvent.user)));
        }

        const hasVotedForAnswer = Boolean(userPollAnswer);
        if(!isDelayed && !hasVotedForAnswer !== reactionEvent.reactionState) return;
        if(hasVotedForAnswer) {
            await userPollAnswer.destroy();
        }
        else {
            await thisAnswer.PollReaction.createPollReactionUser({uid: reactionEvent.user.id});
        }

        if(isDelayed) {
            let msg = await reactionEvent.message.channel.send(hasVotedForAnswer ? "🗑 Deine Reaktion wurde gelöscht." : "💾 Deine Reaktion wurde gespeichert.");
            await FadingMessage.newFadingMessage(msg, 1500);
        }
    }

    /**
     * @param {PollReactionEvent} reactionEvent
     * @returns {Promise<any>}
     */
    async onReaction(reactionEvent) {
        const pollSetting = await this.getPollSetting();

        if(pollSetting.isStrawpoll) {
            return await this.onStrawpollReaction(reactionEvent, pollSetting);
        }

        return await this.onPollReaction(reactionEvent, pollSetting);
    }

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
        pollSetting.set("delayBeginTime", new Date());
        await pollSetting.save();

        return true;
    }

    /**
     * @param {import("discord.js").Client} client
     * @returns {Promise<any>}
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
     * @param {import("discord.js").Client} client 
     * @returns {Promise<any | null>}
     */
    async constructResultMessage(client) {
        /** @type {PollSettings} */
        const pollSetting = await this.getPollSetting();
        /** @type {DiscordPath} */
        const parentPath = await pollSetting.getDiscordPath();
        /** @type {PollAnswer[]} */
        const pollAnswers = await this.getPollReactions({
            include: [
                {
                    model: PollReaction,
                    include: [PollReactionUser]
                }
            ]
        });

        if(!parentPath) {
            if(pollSetting.isStarted) {
                logger.warn(`Poll [${this.id}] tried to construct the result message but has no discord path.`);
            }
            return null;
        }

        const parentMessage = await parentPath.resolveMessage();
        if(!parentMessage) {
            logger.warn(`Found invalid parent message for poll [${this.id}]: [${JSON.stringify(parentPath)}].`);
            return null;
        }

        const title = `Zusammenfassung: ${parentMessage.embeds[0].title}`;
        const description = `${pollAnswers.map(x => `${x.PollReactions.emojiText} - ${x.PollReactions.emojiText} (${pollAnswers.PollReactions.length})`).join("\n")}`
        const initiator = await this.resolveInitiator(client);

        if(!initiator) {
            logger.warn(`Could not find initiator for poll [${this.id}]`);
            return null;
        }

        return {
            embed: {
                title,
                description,
                timestamp: moment.utc.format(),
                author: {
                    name: message.embeds[0].author.name,
                    icon_url: message.embeds[0].author.iconUrl
                },
                footer: {
                    text: `Gesamtabstimmungen: ${pollAnswers.PollReactions.map(x => x.length).reduce((a, b) => a + b)}`
                }
            }
        };
    }

    /**
     * Creates a new Poll with everything you need
     * @param {string} question
     * @param {string[]} answers
     * @param {string} initiator
     * @param {PollOptions} options
     * @param {string[][]} emojiMapping
     */
    static async newPoll(question, answers, initiator, options, emojiMapping = DEFAULT_EMOJI_MAPPING) {
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
            isStrawpoll: options.isStrawpoll,
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

    /**
     * Resolves the initiatorUid field to a Discord User
     * @param {import("discord.js").Client} client
     * @returns {Promise<import("discord.js").User>}
     */
    async resolveInitiator(client) {
        try {
            // @ts-ignore
            return await client.users.fetch(this.initiatorUid);
        }
        catch {
            return null;
        }
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
