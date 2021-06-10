/* eslint-disable new-cap */
"use strict";

// Dependencies
let uuid = require("uuid");
let {Model, DataTypes} = require("sequelize");

class PollReaction extends Model {
    static initialize(sequelize) {
        this.init({
            id: {
                type: DataTypes.STRING(36),
                defaultValue: () => uuid.v4(),
                primaryKey: true
            },
            emoji: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            emojiText: {
                type: DataTypes.TEXT,
                allowNull: false
            }
        }, {
            sequelize
        });
    }
}

module.exports = PollReaction;
