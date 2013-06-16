$(function () {
    var occupancy = [];
    var total = [];
    var spaces = 0;

    var plot = null;
    var smallPlot = null;

    var i, j;

    var parking = "Falkenstrasse"; // default

    var options = {
        series: {
            stack: true,
            lines: { show: true, fill: true },
            points: { show: false },
            shadowSize: 0
        },
        xaxis: {
            mode: "time",
            tickLength: 5
        },
        yaxis: {
            min: 0
        },
        selection: { mode: "x" },
        grid: { hoverable: true, clickable: true, markings: weekendAreas }
    };

    var smallOptions = {
        series: {
            lines: { show: true, lineWidth: 1, fill: true },
            shadowSize: 0,
            stack: true
        },
        xaxis: { ticks: [], mode: "time" },
        yaxis: { ticks: [], min: 0, autoscaleMargin: 0.1 },
        selection: { mode: "x" }
    };

    // Returns the weekends in a period
    function weekendAreas(axes) {
        var markings = [];
        var d = new Date(axes.xaxis.min);
        var time = d.getTime();

        // go to the first Saturday
        d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 1) % 7));
        d.setUTCSeconds(0);
        d.setUTCMinutes(0);
        d.setUTCHours(0);

        do {
            // when we don"t set yaxis, the rectangle automatically
            // extends to infinity upwards and downwards
            markings.push({ xaxis: { from: time, to: time + 2 * 24 * 60 * 60 * 1000 } });
            time += 7 * 24 * 60 * 60 * 1000;
        } while (time < axes.xaxis.max);

        return markings;
    }

    function onDataReceived(parkingData) {
        if ($("#tooltip")) {
            $("#tooltip").remove();
        }

        //if (console && console.log) console.log(JSON.stringify(parkingData));

        if (parkingData && parkingData.spaces) {
            spaces = parseInt(parkingData.spaces);
        }

        jQuery.each(parkingData.timeline, function (i, t) {
            var millis = parseInt(t.timestamp);
            var occupied = spaces - parseInt(t.free);
            occupancy.push([millis, occupied]);
            total.push([millis, spaces - occupied]); // avoid stacking
        });

        // set maximum für y-axis
        options.yaxis.max = spaces;
        smallOptions.yaxis.max = spaces;

        // first correct the timestamps - they are recorded as the daily
        // midnights in UTC+0100, but Flot always displays dates in UTC
        // so we have to add one hour to hit the midnights in the plot
        for (i = 0; i < occupancy.length; i += 1) {
            occupancy[i][0] += 60 * 60 * 1000;
        }

        for (j = 0; j < total.length; j += 1) {
            total[j][0] += 60 * 60 * 1000;
        }

        // and plot all we got
        plot = $.plot(
            $("#placeholder"),
            [
                { data: occupancy, color: "rgb(200, 20, 30)" },
                { data: total, color: "rgb(30, 180, 20)" }
            ],
            options
        );

        smallPlot = $.plot(
            $("#overview"),
            [
                { data: occupancy, color: "rgb(200, 20, 30)" },
                { data: total, color: "rgb(30, 180, 20)" }
            ],
            smallOptions
        );

        $("#placeholder").bind("plotselected", function (event, ranges) {
            // do the zooming
            plot = $.plot(
                $("#placeholder"),
                [
                    { data: occupancy, color: "rgb(200, 20, 30)" },
                    { data: total, color: "rgb(30, 180, 20)" }
                ],
                $.extend(true, {}, options, {
                    xaxis: { min: ranges.xaxis.from, max: ranges.xaxis.to }
                }));

            // Don"t fire event on the overview to prevent eternal loop
            smallPlot.setSelection(ranges, true);
        });

        var previousPoint = null;

        $("#placeholder").bind("plothover", function (event, pos, item) {
            $("#x").text(pos.x.toFixed(2));
            $("#y").text(pos.y.toFixed(2));

            if (typeof item !== "undefined" && item !== null) {
                if (previousPoint !== item.dataIndex) {
                    previousPoint = item.dataIndex;
                    $("#tooltip").remove();
                    var parkingOccupation = item.datapoint[1].toFixed(2);
                    var parkingTimestamp = item.datapoint[0].toFixed(2);
                    var now = new Date();
                    now.setTime(parkingTimestamp + 60 * 60 * 1000);
                    showTooltip(item.pageX, item.pageY,
                        "<b>Belegung: </b>"
                            + parseInt(parkingOccupation)
                            + "/"
                            + spaces
                            + "; <b>Zeitpunkt:</b> "
                            + now
                    );
                }
            }
            else {
                $("#tooltip").remove();
                previousPoint = null;
            }
        });

        $("#overview").bind("plotselected", function (event, ranges) {
            plot.setSelection(ranges);
        });
    }

    function showTooltip(x, y, contents) {
        //$("tooltip").twipsy({ html:"<div>" + contents + "</div>", animate:true });
        $("<div id=\"tooltip\">" + contents + "</div>").css({
            position: "absolute",
            display: "none",
            top: y + 5,
            left: x + 5,
            border: "1px solid #fdd",
            padding: "2px",
            "background-color": "#fee",
            opacity: 0.80
        }).appendTo("body").fadeIn(200);
    }

    function onNoDataRecieved() {
        plot = $.plot(
            $("#placeholder"),
            [
                { data: [], color: "rgb(200, 20, 30)" },
                { data: [], color: "rgb(30, 180, 20)" }
            ],
            options
        );

        smallPlot = $.plot(
            $("#overview"),
            [
                { data: [], color: "rgb(200, 20, 30)" },
                { data: [], color: "rgb(30, 180, 20)" }
            ],
            smallOptions
        );

        $("div.alert").remove();

        $("<div class=\"alert alert-error\">"
            + "<a id=\"close\"  data-dismiss=\"alert\" class=\"close\">×</a>"
            + "<strong>F&uuml;r diesen Parkplatz sind keine Daten verf&uuml;gbar!</strong>"
            + "</div>").appendTo("#info").fadeIn(200);
    }

    $("#parkings").change(function () {
        parking = $(this).val();
        loadParkingData(parking);
    });

    $("#reset").click(function () {
        loadParkingData(parking);
    });

    function loadParkingData(p) {
        /* Reset data */
        occupancy = [];
        total = [];

        $("div.alert").remove();

        $.get("/json/history/" + p)
            .done(onDataReceived)
            .fail(onNoDataRecieved);
    }

    loadParkingData(parking);
});