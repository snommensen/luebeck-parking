$(document).ready(function () {
    var host = "control.local";
    var port = 8080;
    var socket = io.connect(host + ":" + port);

    function initialize() {
        var myOptions = {
            center:new google.maps.LatLng(53.867814, 10.687208),
            zoom:14,
            mapTypeId:google.maps.MapTypeId.ROADMAP
        };
        var map = new google.maps.Map(document.getElementById("map_canvas"),
                myOptions);
    }

    function calculateOccupation(parking) {
        return Math.floor(100 - ((parking.free * 100) / parking.spaces));
    }

    function onData(data) {
        if (!data.hasOwnProperty("current")) return;
        var current = data.current;
        if (!current.hasOwnProperty("parkings")) return;
        var parkings = current.parkings;
        $('#parkings').empty();
        $('#parkings').append('<li class="nav-header">PARKPL&Auml;TZE</li>');
        for (var i = 0; i < parkings.length; ++i) {
            $('#parkings').append('<li><a href="#">'
                + '<div class="free" style="float:right;margin-right:15px;"><div class="occupied" style="width: '
                + calculateOccupation(parkings[i])
                + '%;"></div></div>'
                + parkings[i].name
                + '</a></li>');
        }
    }

    function onNoData() {
        console.log("Error fetching data from host: " + host);
    }

    socket.on("connect", function () {
        console.log("Connected to: " + host);
    });

    /* After the data is loaded once initially, the data is updated via socket.io */
    socket.on("current", function (data) {
        var dataObj = JSON.parse(data);
        if (typeof dataObj === "undefined" || dataObj === null) {
            return;
        }
        onData(dataObj);
    });

    /* Initialize Google Map */
    initialize();

    /* Fetch data once initially */
    $.ajax({
        url:"http://" + host + ":" + port + "/json/current/",
        method:"GET",
        dataType:"json",
        success:onData,
        statusCode:{
            404:onNoData
        }
    });
});