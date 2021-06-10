/* eslint-disable new-cap */
"use strict";

// Dependencies
let uuid = require("uuid");
let {Model, DataTypes} = require("sequelize");

class DiscordPath extends Model {
    /**
     * Resolves this path to a Discord.JS Message object
     * Returns null if conversion was not successful
     * @param {import("discord.js").Client} client
     * @returns {Promise<import("discord.js").Message | null>}
     */
    async resolveMessage(client) {
        try {
            let channel = await this.resolveChannel(client);
            if(!channel) return null;

            return await channel.messages.fetch(this.messageId);
        }
        catch {
            return null;
        }
    }

    /**
     * Resolves this path to a Discord.JS Channel object
     * Returns null if conversion was not successful
     * @param {import("discord.js").Client} client
     * @returns {Promise<import("discord.js").Channel | null>}
     */
    async resolveChannel(client) {
        try {
            let guild = await this.resolveGuild(client);
            if(!guild) return null;

            return await guild.channels.cache.get(this.channelId);
        }
        catch(err) {
            return null;
        }
    }

    /**
     * Resolves this path to a Discord.JS Guild object
     * Returns null if conversion was not successful
     * @param {import("discord.js").Client} client
     * @returns {Promise<import("discord.js").Guild | null>}
     */
    async resolveGuild(client) {
        try {
            return await client.guilds.fetch(this.guildId);
        }
        catch(err) {
            return null;
        }
    }

    /**
     * @param {string} messageId
     * @param {string} channelId
     * @param {string} guildId
     * @param {boolean} [create=true]  if the path should be created automatically if it doesn't exist
     * @returns {Promise<DiscordPath>}
     */
    static async getFromPath(messageId, channelId, guildId, create = true) {
        let resolvedPath = await DiscordPath.findOne({
            where: {
                messageId,
                channelId,
                guildId
            }
        });

        if(!resolvedPath && create) {
            resolvedPath = await DiscordPath.create({
                messageId,
                channelId,
                guildId
            });
        }

        return resolvedPath;
    }

    /**
     * @param {import("discord.js").Message} message
     * @param {boolean?} create if the path should be created automatically if it doesn't exist
     * @returns {Promise<DiscordPath>}
     */
    static getFromMessage(message, create = undefined) {
        return this.getFromPath(message.id, message.channel.id, message.guild.id, create);
    }

    static initialize(sequelize) {
        this.init({
            id: {
                type: DataTypes.STRING(36),
                primaryKey: true,
                defaultValue: () => uuid.v4()
            },
            messageId: {
                type: DataTypes.STRING(36),
                allowNull: true
            },
            channelId: {
                type: DataTypes.STRING(36),
                allowNull: true
            },
            guildId: {
                type: DataTypes.STRING(36),
                allowNull: false
            }
        }, {
            sequelize,
            indexes: [
                {
                    unique: true,
                    fields: ["messageId", "channelId", "guildId"]
                }
            ]
        });
    }
}

module.exports = DiscordPath;
