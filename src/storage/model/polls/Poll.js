/* eslint-disable new-cap */
"use strict";

// Dependencies
let uuid = require("uuid");
let {Model, DataTypes} = require("sequelize");

// Typedefs
/**
 * @typedef {import("./PollAnswer")} PollAnswer
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
     * Creates a new Poll with everything you need
     * @param {string} question
     * @param {string[]} answers
     * @param {string[]} emojiMapping
     */
    static async newPoll(question, answers, emojiMapping = DEFAULT_EMOJI_MAPPING) {
        if(answers.length > emojiMapping.length) {
            throw new Error("Can't have more answers than reaction emojis!");
        }

        const poll = await Poll.create({
            question
        });

        /** @type {PollAnswer[]} */
        const pollAnswers = await Promise.all(answers
            .map((answer, index) => poll.createPollAnswer({
                nr: index,
                text: answer
            })));

        const pollReactions = await Promise.all(pollAnswers
            .map((pollAnswer, index) => pollAnswer.createPollReaction({
                emoji: emojiMapping[index][0],
                emojiText: emojiMapping[index][1]
            })));

        return {
            poll,
            pollAnswers,
            pollReactions
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
            }
        }, {
            sequelize
        });
    }
}

module.exports = Poll;
