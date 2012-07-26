var path = require("path");
var util = require("util");
var async = require("async");
var _ = require("underscore");
var modules_dir = "modules";
var scraper = require(path.join(__dirname, modules_dir, "scraper"));
var history = require(path.join(__dirname, modules_dir, "history"));

// ----------------------------------------------------------------------------

var CURRENT = {"current":{"cities":[], "parkings":[]}};

function onScrape() {
    util.log("Scraping...");
    scraper.scrape(function (err, result) {
        if (typeof err !== "undefined" && err !== null) {
            throw err;
        }
        if (typeof result !== "undefined" && result !== null) {
            CURRENT = result;
            if (!CURRENT.hasOwnProperty("current")) {
                return;
            } else {
                if (!CURRENT.current.hasOwnProperty("parkings")) {
                    return;
                }
            }
            util.log("#" + CURRENT.current.parkings.length + " parkings returned.");
            // Send data to connected clients via socket.io
            updateClients();
        }
    });
}

function onHistory() {
    var parkings;
    if (!CURRENT.hasOwnProperty("current")) {
        return;
    } else {
        if (!CURRENT.current.hasOwnProperty("parkings")) {
            return;
        }
    }
    util.log("Storing history data...");
    parkings = CURRENT.current.parkings;
    if (typeof parkings !== "undefined" && parkings !== null) {
        history.storeHistory(parkings, function () {
            util.log("#" + parkings.length + " parkings historized.");
        });
    }
}

var scrapeDelay = 2 * 60 * 1000;
setInterval(onScrape, scrapeDelay);

var historyDelay = 30 * 60 * 1000;
setInterval(onHistory, historyDelay);

// ----------------------------------------------------------------------------

var express = require("express");
var host = "0.0.0.0";
var port = 8080;

var app = express.createServer();

app.configure(function () {
    app.use(express.methodOverride());
    app.use(express.bodyParser());
    app.use(app.router);
    app.use(express.static(__dirname + "/public"));
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

//app.configure("production", function () {
//    var oneYear = 31557600000;
//    app.use(express.static(__dirname + "/public", { maxAge:oneYear }));
//    app.use(express.errorHandler());
//});

/**
 * Route mobile devices to the mobile page and "normal" browsers to the desktop page.
 */
app.get("/", function (req, res) {
    var ua = req.headers['user-agent'].toLowerCase();
    if (/android.+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(ua) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|e\-|e\/|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(di|rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|xda(\-|2|g)|yas\-|your|zeto|zte\-/i.test(ua.substr(0, 4))) {
        res.writeHead(302, {Location:'/mobile'});
        res.end();
    } else {
        res.writeHead(302, {Location:'/desktop'});
        res.end();
    }
});

app.get("/json/current", function (req, res) {
    console.time("Delivered: /json/current");
    if (typeof CURRENT === "undefined" || CURRENT === null) {
        res.send("Derzeit keine Daten verf&uuml;gbar.", 404);
    } else {
        res.json(CURRENT);
    }
    console.timeEnd("Delivered: /json/current");
    util.log("Answered request from: " + (req.header("host")));
});

app.get("/json/history/:name", function (req, res) {
    var name, feedback;
    name = req.params["name"];
    console.time("Delivered: /json/history/" + name);
    history.findTimelineByName(name, function (timeline, spaces) {
        feedback = {
            "name":name,
            "spaces":spaces,
            "timeline":timeline
        };

        if (typeof timeline !== "undefined" && timeline !== null && timeline.length > 0) {
            res.json(feedback);
        } else {
            res.send("Derzeit keine Daten f&uuml;r Parkplatz \"" + name + "\" verf&uuml;gbar.", 404);
        }
        console.timeEnd("Delivered: /json/history/" + name);
    });
});

app.listen(port, host);

util.log("Server running: http://" + host + ":" + port + "/");

// ----------------------------------------------------------------------------

var socket = require("socket.io");
var io = socket.listen(app);

/*
 * Manage web-socket connections.
 */
var CONNECTED_CLIENTS = [];

io.sockets.on("connection", function (client) {
    util.log(client.id + " connected");
    CONNECTED_CLIENTS.push(client);

    client.on("disconnect", function () {
        CONNECTED_CLIENTS = _.without(CONNECTED_CLIENTS, client);
        util.log(client.id + " disconnected");
    });
});

function updateClients() {
    var clientsToNotify = _.clone(CONNECTED_CLIENTS);
    async.forEach(
        clientsToNotify,
        function (client, done) {
            util.log("emit to client " + client.id);
            client.emit("current", JSON.stringify(CURRENT));
            done();
        },
        function (err) {
            if (typeof err !== "undefined" && err !== null) {
                util.log(err);
            } else {
                util.log("done emitting data to all clients");
            }
        }
    );
}

// ----------------------------------------------------------------------------
