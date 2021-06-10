"use strict";
// Core Modules
let path = require("path");

// Dependencies
let {Sequelize} = require("sequelize");

// Models
let FadingMessage = require("./model/FadingMessage");
let AdditionalMessageData = require("./model/AdditionalMessageData");
let DiscordPath = require("./model/DiscordPath");

let Poll = require("./model/polls/Poll");
let PollAnswer = require("./model/polls/PollAnswer");
let PollReaction = require("./model/polls/PollReaction");
let PollSettings = require("./model/polls/PollSettings");
let PollReactionUsers = require("./model/polls/PollReactionUser");

exports.initialize = async function() {
    let sequelize = new Sequelize({
        dialect: "sqlite",
        storage: path.resolve(__dirname, "..", "..", "storage.db"),
        logging: false
    });

    DiscordPath.initialize(sequelize);
    FadingMessage.initialize(sequelize);
    AdditionalMessageData.initialize(sequelize);

    // Polls
    Poll.initialize(sequelize);
    PollAnswer.initialize(sequelize);
    PollReaction.initialize(sequelize);
    PollSettings.initialize(sequelize);
    PollReactionUsers.initialize(sequelize);

    Poll.hasMany(PollAnswer);
    PollAnswer.belongsTo(Poll);

    Poll.hasOne(PollSettings);
    PollSettings.belongsTo(Poll);

    PollSettings.belongsTo(DiscordPath);

    PollAnswer.hasOne(PollReaction);
    PollReaction.belongsTo(PollAnswer);

    PollReaction.hasMany(PollReactionUsers);
    PollReactionUsers.belongsTo(PollReaction);

    await sequelize.sync();
};
