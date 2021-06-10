/* eslint-disable new-cap */
"use strict";

// Dependencies
let uuid = require("uuid");
let {Model, DataTypes} = require("sequelize");

class PollSettings extends Model {
    static initialize(sequelize) {
        this.init({
            id: {
                type: DataTypes.STRING(36),
                defaultValue: () => uuid.v4(),
                primaryKey: true
            },
            isExtendable: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            isDelayed: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            isAnonymous: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            isStrawpoll: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            delayBeginTime: {
                type: DataTypes.DATE,
                allowNull: true
            },
            delayEndTime: {
                type: DataTypes.DATE,
                allowNull: true
            },
            isStarted: {
                type: DataTypes.VIRTUAL,
                get() {
                    return this.get("delayBeginTime") !== null;
                }
            },
            isFinished: {
                type: DataTypes.VIRTUAL,
                get() {
                    return this.isStarted && this.get("delayEndTime") !== null;
                }
            }
        }, {
            sequelize
        });
    }
}

module.exports = PollSettings;
