/* eslint-disable new-cap */
"use strict";

// Dependencies
let uuid = require("uuid");
let {Model, DataTypes} = require("sequelize");

class PollAnswer extends Model {
    static initialize(sequelize) {
        this.init({
            id: {
                type: DataTypes.STRING(36),
                defaultValue: () => uuid.v4(),
                primaryKey: true
            },
            nr: {
                type: DataTypes.NUMBER,
                allowNull: false
            },
            text: {
                type: DataTypes.TEXT,
                allowNull: false
            }
        }, {
            sequelize,
            indexes: [
                {
                    unique: true,
                    fields: ["id", "nr"]
                }
            ]
        });
    }
}

module.exports = PollAnswer;
