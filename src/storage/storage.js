"use strict";
// Core Modules
let path = require("path");

// Dependencies
let {Sequelize} = require("sequelize");

// Models
let FadingMessage = require("./model/FadingMessage");
let AdditionalMessageData = require("./model/AdditionalMessageData");
let DiscordPath = require("./model/DiscordPath");

exports.initialize = async function() {
    let sequelize = new Sequelize({
        dialect: "sqlite",
        storage: path.resolve(__dirname, "..", "..", "storage.db"),
        logging: false
    });

    DiscordPath.initialize(sequelize);
    FadingMessage.initialize(sequelize);
    AdditionalMessageData.initialize(sequelize);

    await sequelize.sync();
};
