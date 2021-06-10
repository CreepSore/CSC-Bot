/* eslint-disable new-cap */
"use strict";

// Dependencies
let uuid = require("uuid");
let {Model, DataTypes} = require("sequelize");

class PollReactionUser extends Model {
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
