/* eslint-disable new-cap */
"use strict";

// Dependencies
let uuid = require("uuid");
let {Model, DataTypes} = require("sequelize");

class PollReactionUser extends Model {
    /**
     * Resolves the uid field to a Discord User
     * @param {import("discord.js").Client} client
     * @returns {Promise<import("discord.js").User>}
     */
    async resolveUser(client) {
        try {
            // @ts-ignore
            return await client.users.fetch(this.uid);
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
            uid: {
                type: DataTypes.STRING(36),
                allowNull: false
            }
        }, {
            sequelize
        });
    }
}

module.exports = PollReactionUser;
