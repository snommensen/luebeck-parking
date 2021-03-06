$(document).ready(function () {
    var sockjsUrl = '/data';
    var sockjs = new SockJS(sockjsUrl);

    sockjs.onopen = function () {
        console.log('[*] open' + JSON.stringify(sockjs.protocol));
    };

    sockjs.onclose = function () {
        console.log('[*] close');
    };

    function initMap() {
        var myOptions = {
            center: new google.maps.LatLng(53.867814, 10.687208),
            zoom: 14,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };
        var map = new google.maps.Map(document.getElementById("map_canvas"),
            myOptions);
    }

    function calculateOccupation(parking) {
        return Math.floor(100 - ((parking.free * 100) / parking.spaces));
    }

    function onData(data) {
        var current;
        var parkings;
        var i;

        if (!data.hasOwnProperty("current")) {
            return;
        }
        current = data.current;

        if (!current.hasOwnProperty("parkings")) {
            return;
        }
        parkings = current.parkings;
        var $parkings = $('#parkings');
        $($parkings).empty();
        $($parkings).append('<li class="nav-header">PARKPL&Auml;TZE</li>');

        for (i = 0; i < parkings.length; i += 1) {
            $('#parkings').append('<li><a href="#">'
                + '<div class="free" style="float:right;margin-right:15px;"><div class="occupied" style="width: '
                + calculateOccupation(parkings[i])
                + '%;"></div></div>'
                + parkings[i].name
                + '</a></li>');
        }
    }

    function onNoData() {
        console.log("Error fetching data!");
    }

    /* After the data is loaded once initially, the data is updated via web-socket */
    sockjs.onmessage = function (e) {
        console.log('[.] message' + JSON.stringify(e.data));
        var dataObj = JSON.parse(e.data);
        if (typeof dataObj === "undefined" || dataObj === null) {
            return;
        }
        onData(dataObj);
    };

    /* Initialize Google Map */
    initMap();

    /* Fetch data once initially */
    $.get("/json/current/")
        .done(onData)
        .fail(onNoData);
});