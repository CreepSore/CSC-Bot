"use strict";

// ========================= //
// = Copyright (c) NullDev = //
// ========================= //

// Models
let FadingMessage = require("../storage/model/FadingMessage");
let AdditionalMessageData = require("../storage/model/AdditionalMessageData");

// Utils
let log = require("../utils/logger");

// Models
let Poll = require("../storage/model/polls/Poll");
let PollSettings = require("../storage/model/polls/PollSettings");
let DiscordPath = require("../storage/model/DiscordPath");

const events = {
    MESSAGE_REACTION_ADD: "messageReactionAdd",
    MESSAGE_REACTION_REMOVE: "messageReactionRemove"
};

/**
 * @param {import("discord.js").Client} client
 * @param {import("discord.js").User} reactingUser
 * @param {import("discord.js").Message} message
 * @param {string} emoji
 * @param {string} eventType
 */
let handlePolls = async function(client, reactingUser, message, emoji, eventType) {
    if(reactingUser.id === client.user.id) return;
    if(!["MESSAGE_REACTION_ADD", "MESSAGE_REACTION_REMOVE"].includes(eventType)) return;
    const newState = eventType === "MESSAGE_REACTION_ADD";

    const poll = await Poll.findOne({
        include: [{
            model: PollSettings,
            include: [
                {
                    model: DiscordPath,
                    where: {
                        messageId: message.id,
                        channelId: message.channel.id,
                        guildId: message.guild.id
                    }
                }
            ]
        }]
    });

    if(!poll) return;

    await poll.onReaction({
        client,
        message,
        emoji,
        user: reactingUser,
        reactionState: newState
    });
};

/**
 * Handles changes on reactions
 *
 * @param {any} event
 * @param {import("discord.js").Client} client
 * @returns
 */
module.exports = async function(event, client) {
    if (!Object.prototype.hasOwnProperty.call(events, event.t)) return;

    const { d: data } = event;

    /** @type {import("discord.js").Message} */
    const message = await client.channels.cache.get(data.channel_id).messages.fetch(data.message_id);

    //if (message.author.id !== client.user.id) return;
    let user = await message.guild.members.fetch((await client.users.fetch(data.user_id)).id);


    if (event.d.emoji.name === "✅") {
        const member = message.guild.members.cache.get(client.users.cache.get(data.user_id).id);

        if (member.id !== client.user.id) {
            const role = message.guild.roles.cache.find(r => r.name === message.content);
            if (event.t === "MESSAGE_REACTION_ADD") member.roles.add(role.id).catch(log.error);
            else if (event.t === "MESSAGE_REACTION_REMOVE") member.roles.remove(role.id).catch(log.error);
        }
        return;
    }

    await handlePolls(client, user, message, event.d.emoji.name, event.t);
};
