var redis = require("redis");
var util = require("util");
var async = require("async");
var redisClient = redis.createClient();

redisClient.on("error", function (err) {
    if (typeof err !== "undefined" && err !== null) {
        util.log("Redis error: " + err);
    }
});

function filterName(name) {
    var result = name;
    if (typeof name !== "undefined" && name !== null) {
        result = name.replace(/[^a-zA-Z0-9 ]/g, "").replace(" ", "_");
    }
    return result;
}

function createParkingKey(name) {
    return "parking:" + filterName(name);
}

function createTimelineKey(name) {
    return "timeline:" + filterName(name);
}

var PARKING_SET = "parkings";

exports.storeHistory = function (parkings, callback) {
    if (typeof parkings === "undefined" || parkings === null) {
        callback();
    }

    var millis = new Date().getTime();

    async.forEach(
        parkings,
        function (p, done) {
            storeHistoryItem(p, millis, function (err) {
                if (typeof err !== "undefined" && err !== null) {
                    done(err);
                }
                done(null);
            });
        },
        function (err) {
            if (typeof err !== "undefined" && err !== null) {
                util.log("Error storing parking: " + err);
            }
            callback();
        }
    );
};

function storeHistoryItem(parking, timestamp, callback) {
    util.log("storeHistoryItem( " + JSON.stringify(parking) + " )");
    var parkingKey;

    if (typeof parking === "undefined" || parking === null) {
        callback("Parking is undefined or null: " + JSON.stringify(parking));
    }

    /* 1) Save master data */
    if (parking.hasOwnProperty("name") && parking.hasOwnProperty("spaces")) {
        parkingKey = createParkingKey(parking.name);

        redisClient.sadd(PARKING_SET, parkingKey, function (err, result) {
            if (typeof err !== "undefined" && err !== null) {
                callback("Error saving master data: " + err);
            }
            if (result === 1) {
                redisClient.hmset(parkingKey, "name", parking.name, "spaces", parking.spaces, function (err) {
                    if (typeof err !== "undefined" && err !== null) {
                        callback("Error saving master data: " + err);
                    }
                });
            }
        });
    }

    /* 2) Save variable data */
    if (parking.hasOwnProperty("name")
        && parking.hasOwnProperty("free")
        && typeof timestamp !== "undefined"
        && timestamp !== null) {

        var timelineKey = createTimelineKey(parking.name);
        var timelineKeyWithTimestamp = timelineKey + ":" + timestamp;

        /* Add timeline reference to parking */
        redisClient.hset(parkingKey, "timeline", timelineKey);

        redisClient.lpush(timelineKey, timelineKeyWithTimestamp, function (err) {
            if (typeof err !== "undefined" && err !== null) {
                callback("Error saving variable parking data: " + err);
            }

            /* Set timeline attributes */
            redisClient.hmset(timelineKeyWithTimestamp, "timestamp", timestamp, "free", parking.free, function (err) {
                if (typeof err !== "undefined" && err !== null) {
                    callback("Error setting timeline attributes: " + err);
                }
                util.log("Saved timeline entry: " + JSON.stringify(timelineKeyWithTimestamp));
                callback(null);
            });
        });
    }
}

exports.findTimelineByName = function (name, callback) {
    var result = [];

    /* Get parking with all attributes */
    redisClient.hgetall(createParkingKey(name), function (err, parking) {
        if (typeof err !== "undefined" && err !== null) {
            util.log("Error fetching parking for key: " + createParkingKey(name) + ", Cause: " + err);
            callback([], 0);
        } else {
            if (typeof parking === "undefined"
                || parking === null
                || !parking.hasOwnProperty("timeline")
                || !parking.hasOwnProperty("spaces")) {
                callback([], 0);
            } else {
                /* List this parking's timeline entries for the last two weeks */
                redisClient.lrange(parking.timeline, 0, -1, function (err, timelines) {
                    if (typeof err !== "undefined" && err !== null) {
                        // TODO Use callback(err);
                        util.log(err);
                    }

                    /* Iterate this parking's timelines and collect attributes in result array */
                    async.forEach(
                        timelines,
                        function (timelineKey, done) {
                            util.log("HGETALL " + timelineKey);
                            redisClient.hgetall(timelineKey, function (err, timelineAttributes) {
                                if (typeof err !== "undefined" && err !== null) {
                                    done(err);
                                }
                                if (timelineAttributes && timelineAttributes.hasOwnProperty("timestamp")) {
                                    var twoWeeksMillis = 1000 * 60 * 60 * 24 * 14;
                                    var currentMillis = new Date().getTime();
                                    if (timelineAttributes.timestamp > (currentMillis - twoWeeksMillis)) {
                                        result.push(timelineAttributes);
                                    }
                                }
                                done(null);
                            });
                        },
                        function (err) {
                            if (typeof err !== "undefined" && err !== null) {
                                util.log("Error fetching parking timelines: " + err);
                            }
                            callback(result, parking.spaces);
                        }
                    );
                });
            }
        }
    });
};

