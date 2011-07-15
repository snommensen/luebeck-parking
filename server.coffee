_request = require 'request'
_jsdom   = require 'jsdom'
_json2   = require './json2'

console.log 'Scraping server started...'

fetch = () ->
    _request uri:'http://kwlpls.adiwidjaja.com/index.php', (error, response, body) ->
        console.log 'Fehler beim Kontaktieren der KWL Webseite!' if (error && response.statusCode != 200)

        _jsdom.env
            html: body,
            scripts: [
                'http://code.jquery.com/jquery-1.6.1.min.js'
            ]
        , (err, window) ->
            $ = window.jQuery
            scrapeDivId = 'cc-m-externalsource-container-m8a3ae44c30fa9708'

            rows = new Array()

            processPage = ->
                rows = $('table tbody').children()
                num  = $(rows).size()

                console.log '#rows=' + num

                rows.each( (i, row) ->
                    processRow(row) if (i > 1 || i == num - 1) # Header und Footer abschneiden
                )

                console.log _json2.JSON.stringify(rows)

            processRow = (row) ->
                console.log 'processRow( ' + row + ' )'
                elements     = $(row).children('td')
                item         = new Object()
                item.name    = elements.eq(0).html()

                if elements.size() > 2
                    item.free     = elements.eq(1).html()
                    item.parkings = elements.eq(2).html()
                    item.status   = 'open'
                else if elements.size() > 0
                    # Voruebergehend geschlossen
                    item.status = 'closed'
                else
                    return # Dies ist kein Item (z.B. 'Travemünde' header)


                rows.push(item)
                #console.log(rows[rows.length-1]);

            processPage()