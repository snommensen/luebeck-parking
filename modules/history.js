var redis = require("redis");
var util = require("util");
var async = require("async");
var db = redis.createClient();

db.on("error", function (err) {
    if (typeof err !== "undefined" && err !== null) {
        util.log(err);
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

    var now = new Date();
    var timestamp = now.getTime();

    async.forEach(
        parkings,
        function (p, done) {
            storeHistoryItem(p, timestamp, function () {
                done();
            });
        },
        function (err) {
            if (typeof err !== "undefined" && err !== null) {
                throw err;
            }
            callback();
        }
    );
};

function storeHistoryItem(parking, timestamp, callback) {
    var parkingKey;

    if (typeof parking === "undefined" || parking === null) {
        callback();
    }

    /* 1) Save master data */
    if (parking.hasOwnProperty("name") && parking.hasOwnProperty("spaces")) {
        parkingKey = createParkingKey(parking.name);

        db.sadd(PARKING_SET, parkingKey, function (err, result) {
            if (typeof err !== "undefined" && err !== null) {
                throw err;
            }
            if (result === 1) {
                db.hmset(parkingKey, "name", parking.name, "spaces", parking.spaces, function (err) {
                    if (typeof err !== "undefined" && err !== null) {
                        throw err;
                    }
                });
            }
        });
    }

    /* 2) Save variable data */
    if (parking.hasOwnProperty("free") && typeof timestamp !== "undefined"
                                       && timestamp !== null) {
        var timelineKey  = createTimelineKey(parking.name);
        var timelineKeyWithTimestamp = timelineKey + ":" + timestamp;

        /* Add timeline reference to parking */
        db.hset(parkingKey, "timeline", timelineKey);

        db.lpush(timelineKey, timelineKeyWithTimestamp, function (err) {
            if (typeof err !== "undefined" && err !== null) {
                throw err;
            }

            /* Set timeline attributes */
            db.hmset(timelineKeyWithTimestamp, "timestamp", timestamp, "free", parking.free, function (err) {
                if (typeof err !== "undefined" && err !== null) {
                    throw err;
                }
                callback();
            });
        });
    }
}

exports.findTimelineByName = function (name, callback) {
    var result = [];

    /* Get parking with all attributes */
    db.hgetall(createParkingKey(name), function (err, parking) {
        if (typeof err !== "undefined" && err !== null) {
            throw err;
        }

        if (typeof parking === "undefined"
            || parking === null
            || !parking.hasOwnProperty("timeline")
            || !parking.hasOwnProperty("spaces")) {
            callback([], 0);        
        }

        var twoWeeks = 672;

        /* List this parking's timeline entries for the last two weeks */
        db.lrange(parking.timeline, twoWeeks * -1, -1, function (err, timelines) {
            if (typeof err !== "undefined" && err !== null) {
                throw err;
            }

            /* Iterate this parking's timelines and collect attributes in result array */
            async.forEach(
                timelines,
                function (timelineKey, done) {
                    util.log("HGETALL " + timelineKey);
                    db.hgetall(timelineKey, function (err, timelineAttributes) {
                        if (typeof err !== "undefined" && err !== null) {
                            throw err;
                        }
                        result.push(timelineAttributes);
                        done();
                    });
                },
                function (err) {
                    if (typeof err !== "undefined" && err !== null) {
                        throw err;
                    }
                    callback(result, parking.spaces);
                }
            );
        });
    });
};

